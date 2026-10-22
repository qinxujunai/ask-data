// Builds public/wdi.sqlite from data/*.csv with the same SQLite (sql.js) the browser runs.
//   node scripts/build-db.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import initSqlJs from 'sql.js';
import { TABLES } from '../src/schema.js';

const SQL = await initSqlJs();
const db = new SQL.Database();
const rows = async (file) => parse(await readFile(file, 'utf8'), { columns: true, skip_empty_lines: true });

for (const t of TABLES) {
  const cols = t.columns.map(([n, type]) => `${n} ${type}`).join(', ');
  const key = t.name === 'countries' ? ', PRIMARY KEY (code)' : ', PRIMARY KEY (code, year)';
  db.run(`CREATE TABLE ${t.name} (${cols}${key}) WITHOUT ROWID`);
}

const insert = (table, names, records, cast) => {
  const stmt = db.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`);
  db.run('BEGIN');
  for (const r of records) stmt.run(names.map((n) => cast(n, r[n])));
  db.run('COMMIT');
  stmt.free();
};

const countries = await rows('data/countries.csv');
insert('countries', ['code', 'name', 'name_en', 'region', 'income', 'is_aggregate'], countries,
  (n, v) => (n === 'is_aggregate' ? Number(v) : (v ?? '').trim() || null));

const known = new Set(countries.map((c) => c.code));
const stats = (await rows('data/stats.csv')).filter((r) => known.has(r.code));
const statCols = TABLES[1].columns.map(([n]) => n);
insert('stats', statCols, stats, (n, v) => (n === 'code' ? v : v === '' ? null : Number(v)));

db.run('CREATE INDEX stats_year ON stats (year)');
db.run('VACUUM');
const bytes = db.export();
await mkdir('public', { recursive: true });
await writeFile('public/wdi.sqlite', bytes);
const count = (sql) => db.exec(sql)[0].values[0][0];
console.log(`wdi.sqlite ${(bytes.length / 1024).toFixed(0)} KB · countries ${count('SELECT COUNT(*) FROM countries')} · stats ${count('SELECT COUNT(*) FROM stats')}`);
