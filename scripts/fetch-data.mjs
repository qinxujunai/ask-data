// Downloads the World Bank data behind 问数 into data/ (CSV, committed, so builds are reproducible).
// Source: World Bank World Development Indicators, https://data.worldbank.org, licence CC BY 4.0.
//   node scripts/fetch-data.mjs
import { writeFile } from 'node:fs/promises';
import { INDICATORS, FIRST_YEAR, LAST_YEAR } from '../src/schema.js';

const API = 'https://api.worldbank.org/v2';

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
}

const csv = (rows) => rows.map((r) => r.map((v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\n') + '\n';

// Countries and aggregates, with Chinese and English names.
const [, zhAll] = await get(`${API}/zh/country?format=json&per_page=400`);
const [, en] = await get(`${API}/en/country?format=json&per_page=400`);
const zh = zhAll.map((c) => ({ ...c, name: c.name.trim() }));
const enName = Object.fromEntries(en.map((c) => [c.id, c.name]));
// Income-group aggregates (HIC, UMC…) come back without an ISO3 code, only the two-letter id.
const iso3 = Object.fromEntries(zh.map((c) => [c.iso2Code, c.id]));
// Lending-group aggregates come without a Chinese name; they are not useful here.
const countries = zh.filter((c) => c.name.trim()).map((c) => [c.id, c.name, enName[c.id] || '', c.region.id === 'NA' ? '' : c.region.value, c.incomeLevel.id === 'NA' ? '' : c.incomeLevel.value, c.region.id === 'NA' ? 1 : 0]);
await writeFile('data/countries.csv', csv([['code', 'name', 'name_en', 'region', 'income', 'is_aggregate'], ...countries]));
console.log('countries', countries.length);

// One request per indicator, all economies and years.
const values = new Map();
for (const ind of INDICATORS) {
  const [meta, rows] = await get(`${API}/country/all/indicator/${ind.code}?format=json&date=${FIRST_YEAR}:${LAST_YEAR}&per_page=20000`);
  let n = 0;
  for (const r of rows || []) {
    if (r.value === null) continue;
    const code = r.countryiso3code || iso3[r.country.id];
    if (!code) continue;
    const key = `${code}|${r.date}`;
    if (!values.has(key)) values.set(key, {});
    values.get(key)[ind.column] = r.value;
    n++;
  }
  console.log(ind.column, n, 'values, updated', meta.lastupdated);
}
const header = ['code', 'year', ...INDICATORS.map((i) => i.column)];
const out = [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => {
  const [code, year] = key.split('|');
  return [code, year, ...INDICATORS.map((i) => v[i.column] ?? '')];
});
await writeFile('data/stats.csv', csv([header, ...out]));
await writeFile('data/SOURCE.md', `# 数据来源\n\n世界银行《世界发展指标》（World Development Indicators），https://data.worldbank.org ，许可 CC BY 4.0。\n下载日期：${new Date().toISOString().slice(0, 10)}；年份 ${FIRST_YEAR}–${LAST_YEAR}。\n\n指标代码见 \`src/schema.js\`。重新下载：\`npm run data\`。\n`);
console.log('rows', out.length);
