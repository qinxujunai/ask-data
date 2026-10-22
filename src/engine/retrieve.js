// Retrieval: find what the model needs to answer this question, and only that.
//   - columns: which indicators the question is about (their 口径 and unit);
//   - terms:   business terms it uses (金砖国家, 最新, 发达国家…);
//   - examples: the most similar verified question → query pairs;
//   - places:  countries it names, resolved to codes.
// Ranking is BM25 (MiniSearch). Chinese has no spaces, so text is indexed as character pairs.

import MiniSearch from 'minisearch';
import { INDICATORS } from '../schema.js';
import { TERMS } from '../knowledge/terms.js';
import { EXAMPLES } from '../knowledge/examples.js';

// Latin words whole; CJK as overlapping pairs (中国人均 → 中国 国人 人均) plus single characters.
export function tokenize(text) {
  const out = [];
  for (const m of String(text).toLowerCase().matchAll(/[a-z0-9.&]+|[㐀-鿿]+/g)) {
    const s = m[0];
    if (!/[㐀-鿿]/.test(s)) { out.push(s); continue; }
    const chars = [...s];
    if (chars.length === 1) out.push(s);
    for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
  }
  return out;
}

// Common names that differ from the World Bank's official Chinese names.
const ALIASES = {
  中国香港: 'HKG', 中国澳门: 'MAC', 俄罗斯: 'RUS', 韩国: 'KOR', 南韩: 'KOR', 朝鲜: 'PRK', 北韩: 'PRK', 香港: 'HKG', 澳门: 'MAC', 伊朗: 'IRN', 埃及: 'EGY',
  委内瑞拉: 'VEN', 叙利亚: 'SYR', 也门: 'YEM', 捷克: 'CZE', 斯洛伐克: 'SVK', 文莱: 'BRN', 阿联酋: 'ARE', 沙特: 'SAU',
  欧盟: 'EUU', 全球: 'WLD', 全世界: 'WLD', 美利坚: 'USA', 大陆: 'CHN', 内地: 'CHN',
};

function index(docs, fields) {
  const ms = new MiniSearch({ fields, storeFields: ['id'], tokenize, processTerm: (t) => t });
  ms.addAll(docs);
  return ms;
}

export class Retriever {
  // countries: [{ code, name, name_en }] from the database, used to recognise places.
  constructor(countries = []) {
    this.columns = index(INDICATORS.map((i) => ({ id: i.column, text: `${i.name} ${i.terms} ${i.note}` })), ['text']);
    this.terms = index(TERMS.map((t, n) => ({ id: n, text: t.term })), ['text']);
    this.examples = index(EXAMPLES.map((e) => ({ id: e.id, text: e.question })), ['text']);
    this.places = [
      ...countries.flatMap((c) => [[c.name, c.code], [c.name_en, c.code], [c.code, c.code]]),
      ...Object.entries(ALIASES),
    ].filter(([n]) => n && n.length >= 2).sort((a, b) => b[0].length - a[0].length);
    this.countryName = Object.fromEntries(countries.map((c) => [c.code, c.name]));
  }

  // exclude: an example id to leave out (used by the evaluation, so a question can't find itself).
  retrieve(question, { exclude, k = 4 } = {}) {
    const q = String(question);
    const columns = this.columns.search(q).slice(0, k).map((r) => ({ ...INDICATORS.find((i) => i.column === r.id), score: r.score }));
    const terms = this.terms.search(q).filter((r) => r.score > 1).slice(0, k).map((r) => ({ ...TERMS[r.id], score: r.score }));
    const examples = this.examples.search(q).filter((r) => r.id !== exclude).slice(0, 3).map((r) => ({ ...EXAMPLES.find((e) => e.id === r.id), score: r.score }));
    return { columns, terms, examples, places: this.findPlaces(q) };
  }

  // Longest names first, each stretch of the question used once (中国香港 is HKG, not CHN).
  findPlaces(q) {
    let rest = q;
    const found = new Map();
    for (const [name, code] of this.places) {
      const isCode = /^[A-Z]{3}$/.test(name);
      const hit = isCode ? new RegExp(`\\b${name}\\b`).test(rest) : rest.toLowerCase().includes(name.toLowerCase());
      if (!hit) continue;
      if (!found.has(code)) found.set(code, this.countryName[code] || name);
      rest = isCode ? rest.replace(new RegExp(`\\b${name}\\b`, 'g'), ' ') : rest.split(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).join(' ');
    }
    return [...found].map(([code, name]) => ({ code, name }));
  }

  // The verified example a question asks for, if it is (nearly) the same question.
  match(question) {
    const norm = (s) => String(s).replace(/[\s？?。！!，,、]/g, '');
    const q = norm(question);
    return EXAMPLES.find((e) => norm(e.question) === q) || null;
  }
}
