// How often does the model get the same answer as the verified query?
// Each verified example is asked again with that example held out of retrieval (so it can't copy
// itself), and the result rows are compared with the verified result. Run with and without retrieval
// to see what retrieval is worth.
//
//   DEEPSEEK_API_KEY=… node scripts/eval.mjs            → eval/report.json, eval/report.md
//   DEEPSEEK_API_KEY=… node scripts/eval.mjs --no-rag   (only the schema, no retrieved context)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { Retriever } from '../src/engine/retrieve.js';
import { ask } from '../src/engine/pipeline.js';
import { checkSql } from '../src/engine/guard.js';
import { createLLM } from '../src/engine/llm.js';
import { EXAMPLES } from '../src/knowledge/examples.js';

const key = process.env.DEEPSEEK_API_KEY;
if (!key) { console.error('DEEPSEEK_API_KEY is not set'); process.exit(1); }

const SQL = await initSqlJs();
const raw = new SQL.Database(readFileSync('public/wdi.sqlite'));
raw.run('PRAGMA query_only = 1');
const db = { async run(sql) { const r = raw.exec(sql)[0]; return { columns: r ? r.columns : [], rows: r ? r.values : [], ms: 0 }; } };
const countries = raw.exec('SELECT code, name, name_en FROM countries')[0].values.map(([code, name, name_en]) => ({ code, name, name_en }));
const llm = createLLM({ key });

// A row is its values, numbers rounded; column names and order don't matter.
const norm = (v) => (typeof v === 'number' ? Number(v.toPrecision(4)) : v);
const rowKey = (row) => row.map(norm).map(String);
// Every verified row must appear among the model's rows (extra columns are fine), same number of rows.
function same(gold, got) {
  if (!got || gold.rows.length !== got.rows.length) return false;
  const pool = got.rows.map(rowKey);
  return gold.rows.every((g) => pool.some((p) => rowKey(g).every((v) => p.includes(v))));
}

async function run(rag) {
  const base = new Retriever(countries);
  const retriever = rag ? base : { retrieve: () => ({ columns: [], terms: [], examples: [], places: [] }), match: () => null };
  const rows = [];
  for (const e of EXAMPLES) {
    const gold = await db.run(checkSql(e.sql).limited);
    let r;
    try {
      r = await ask(e.question, { retriever, db, llm, exclude: e.id, useVerified: false });
    } catch (err) {
      r = { source: 'error', reason: err.message };
    }
    const ok = r.source === 'model' && same(gold, r.result);
    rows.push({ id: e.id, question: e.question, ok, source: r.source, sql: r.sql || '', reason: r.reason || '', repaired: !!r.steps?.some((s) => s.kind === 'repair'), answerOk: r.answer?.ok ?? null });
    console.log(`${ok ? '✓' : '✗'} ${e.id}${r.reason && !ok ? ` (${r.reason})` : ''}`);
  }
  return rows;
}

const noRag = process.argv.includes('--no-rag');
const modes = noRag ? [false] : [true, false];
const report = { date: new Date().toISOString().slice(0, 10), model: 'deepseek-chat', total: EXAMPLES.length, runs: {} };
for (const rag of modes) {
  const rows = await run(rag);
  report.runs[rag ? 'with_retrieval' : 'schema_only'] = { correct: rows.filter((r) => r.ok).length, repaired: rows.filter((r) => r.repaired).length, rows };
}

mkdirSync('eval', { recursive: true });
writeFileSync('eval/report.json', JSON.stringify(report, null, 2) + '\n');
const line = (name, r) => `| ${name} | ${r.correct}/${report.total} | ${r.repaired} |`;
writeFileSync('eval/report.md', `# 评测 ${report.date}\n\n模型 ${report.model}。每道题把它自己的示例从检索里拿掉再问，结果行和验证过的查询一致才算对。\n\n| 方式 | 结果一致 | 用了一次修正 |\n| --- | --- | --- |\n${Object.entries(report.runs).map(([k, r]) => line(k === 'with_retrieval' ? '带检索（口径、示例、国家）' : '只给表结构', r)).join('\n')}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.runs).map(([k, r]) => [k, `${r.correct}/${report.total}`]))));
