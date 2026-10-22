import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { checkSql } from '../src/engine/guard.js';
import { fillAnswer } from '../src/engine/answer.js';
import { formatValue } from '../src/engine/format.js';
import { Retriever, tokenize } from '../src/engine/retrieve.js';
import { ask } from '../src/engine/pipeline.js';
import { EXAMPLES, SUGGESTED } from '../src/knowledge/examples.js';

const SQL = await initSqlJs();
const raw = new SQL.Database(readFileSync(new URL('../public/wdi.sqlite', import.meta.url)));
raw.run('PRAGMA query_only = 1');
const db = {
  async run(sql) {
    const r = raw.exec(sql)[0];
    return { columns: r ? r.columns : [], rows: r ? r.values : [], ms: 0 };
  },
};
const countries = raw.exec('SELECT code, name, name_en FROM countries')[0].values.map(([code, name, name_en]) => ({ code, name, name_en }));
const retriever = new Retriever(countries);

test('guard: one read-only query, capped', () => {
  assert.equal(checkSql('SELECT 1;').ok, true);
  assert.match(checkSql('select 1').limited, /LIMIT 500$/);
  assert.equal(checkSql('WITH a AS (SELECT 1) SELECT * FROM a').ok, true);
  assert.equal(checkSql('```sql\nSELECT 1\n```').ok, true);
  for (const bad of ['DELETE FROM stats', 'SELECT 1; DROP TABLE stats', 'PRAGMA query_only=0', "ATTACH 'x' AS y", 'UPDATE stats SET year=1', '']) {
    assert.equal(checkSql(bad).ok, false, bad);
  }
  // Keywords inside strings are only text.
  assert.equal(checkSql("SELECT name FROM countries WHERE name = 'drop; delete'").ok, true);
});

test('the database itself refuses writes', () => {
  assert.throws(() => raw.run("UPDATE stats SET year = 0"), /readonly|read-only|query_only/i);
});

test('answers: numbers only from cells, formatted by unit', () => {
  const result = { columns: ['name', 'year', 'gdp_usd', 'population', 'share_pct'], rows: [['中国', 2024, 18.74e12, 1.408e9, 16.9]] };
  const ok = fillAnswer('{{0.year}} 年，{{0.name}}的 GDP 是 {{0.gdp_usd}}，人口 {{0.population}}，占 {{-1.share_pct}}。', result);
  assert.equal(ok.text, '2024 年，中国的 GDP 是 18.74 万亿美元，人口 14.1 亿人，占 16.9%。');
  assert.equal(fillAnswer('GDP 是 18 万亿美元', result).ok, false);
  assert.equal(fillAnswer('{{3.name}}', result).ok, false);
  assert.equal(fillAnswer('{{0.nope}}', result).ok, false);
  assert.equal(formatValue(null, 'gdp_usd'), '无数据');
  assert.equal(formatValue(2.37, 'ratio'), '2.37 倍');
});

test('retrieval: Chinese tokens, places, terms, columns', () => {
  assert.deepEqual(tokenize('中国GDP'), ['中国', 'gdp']);
  const ctx = retriever.retrieve('金砖国家里，韩国和中国香港的老龄化');
  assert.deepEqual(ctx.places.map((p) => p.code).sort(), ['HKG', 'KOR']);
  assert.ok(ctx.terms.some((t) => t.term.startsWith('金砖')));
  assert.equal(ctx.columns[0].column, 'age65_pct');
  assert.ok(retriever.retrieve('中国人均GDP', { exclude: 'china-gdp-per-capita' }).examples.every((e) => e.id !== 'china-gdp-per-capita'));
});

test('every verified example runs and its answer fills', async () => {
  const ids = new Set();
  for (const e of EXAMPLES) {
    assert.ok(!ids.has(e.id), e.id); ids.add(e.id);
    const r = await ask(e.question, { retriever, db, llm: null });
    assert.equal(r.source, 'verified', e.id);
    assert.ok(r.result.rows.length > 0, `${e.id} returned no rows`);
    assert.ok(r.answer.ok, `${e.id}: ${r.answer.reason}`);
    if (e.chart.type !== 'none') assert.equal(r.chart.type, e.chart.type, e.id);
  }
  for (const id of SUGGESTED) assert.ok(ids.has(id), id);
});

test('pipeline with a model: guard, one repair, answer without invented numbers', async () => {
  const calls = [];
  const replies = [
    { sql: 'DELETE FROM stats', chart: { type: 'none' } },
    { sql: "SELECT year, population FROM stats WHERE code = 'WLD' ORDER BY year", chart: { type: 'line', x: 'year', y: 'population' }, reason: '世界人口' },
    { answer: '世界人口在 {{-1.year}} 年达到 {{-1.population}}。' },
  ];
  const llm = async (messages) => { calls.push(messages); return replies.shift(); };
  const r = await ask('全球人口到多少了', { retriever, db, llm });
  assert.equal(r.source, 'model');
  assert.equal(calls.length, 3);
  assert.match(calls[1].at(-1).content, /只允许查询/);
  assert.match(r.answer.text, /^世界人口在 2024 年达到 [\d.]+ 亿人。$/);
  assert.deepEqual(r.chart, { type: 'line', x: 'year', y: 'population', series: '' });

  const liar = [{ sql: "SELECT year, population FROM stats WHERE code = 'WLD' AND year = 2024" }, { answer: '世界人口有 80 亿。' }];
  const r2 = await ask('全球人口到多少了', { retriever, db, llm: async () => liar.shift() });
  assert.equal(r2.answer.ok, false);
});

test('without a key: verified questions work, others ask for a key', async () => {
  const r = await ask('火星上有多少人', { retriever, db, llm: null });
  assert.equal(r.source, 'need-key');
});
