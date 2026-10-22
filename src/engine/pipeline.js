// One question, start to finish. Each step is recorded, so the page can show how an answer was made.
//
//   retrieve → (verified query, or) write SQL → check → run (one repair if it fails) → write answer → fill numbers
//
// db:  { run(sql) → Promise<{ columns, rows, ms }> }   (a Web Worker in the browser, sql.js in Node)
// llm: chat(messages) → Promise<object>, or null when no key is set.

import { checkSql } from './guard.js';
import { fillAnswer } from './answer.js';
import { sqlMessages, answerMessages } from './prompt.js';

function chartFor(spec, columns) {
  if (!spec || !['line', 'bar'].includes(spec.type)) return { type: 'none' };
  const has = (c) => c && columns.includes(c);
  if (!has(spec.x) || !has(spec.y)) return { type: 'none' };
  return { type: spec.type, x: spec.x, y: spec.y, series: has(spec.series) ? spec.series : '' };
}

export async function ask(question, { retriever, db, llm, exclude, useVerified = true, onStep = () => {} }) {
  const steps = [];
  const step = (s) => { steps.push(s); onStep(s); };
  const q = String(question).trim();

  const ctx = retriever.retrieve(q, { exclude });
  step({ kind: 'retrieve', ctx });

  // A question we have a verified query for is answered with it: no model, no risk.
  const verified = useVerified ? retriever.match(q) : null;
  if (verified && verified.id !== exclude) {
    const check = checkSql(verified.sql);
    const result = await db.run(check.limited);
    step({ kind: 'verified', example: verified, sql: check.sql, result });
    const answer = fillAnswer(verified.answer, result, { trusted: true });
    return { question: q, source: 'verified', sql: check.sql, result, answer, chart: chartFor(verified.chart, result.columns), steps };
  }

  if (!llm) return { question: q, source: 'need-key', nearest: ctx.examples[0] || null, steps };

  // Write the query; if the guard or the database rejects it, show the model why, once.
  let plan = await llm(sqlMessages(q, ctx));
  step({ kind: 'sql', plan });
  let check = checkSql(plan.sql);
  if (!plan.sql) return { question: q, source: 'unanswerable', reason: plan.reason || '这些数据回答不了这个问题', steps };
  let result;
  let error = check.ok ? null : check.reason;
  if (!error) {
    try { result = await db.run(check.limited); } catch (e) { error = e.message; }
  }
  step({ kind: 'run', sql: check.sql || plan.sql, ok: !error, error, result });
  if (error) {
    plan = await llm(sqlMessages(q, ctx, { sql: plan.sql, error }));
    step({ kind: 'repair', plan });
    check = checkSql(plan.sql);
    if (!plan.sql) return { question: q, source: 'unanswerable', reason: plan.reason || '这些数据回答不了这个问题', steps };
    if (!check.ok) return { question: q, source: 'failed', reason: `查询没有通过检查：${check.reason}`, sql: plan.sql, steps };
    try { result = await db.run(check.limited); } catch (e) {
      step({ kind: 'run', sql: check.sql, ok: false, error: e.message });
      return { question: q, source: 'failed', reason: `查询运行失败：${e.message}`, sql: check.sql, steps };
    }
    step({ kind: 'run', sql: check.sql, ok: true, result });
  }

  // The sentence. Numbers in it come from the result, or the sentence is not shown.
  let answer;
  if (!result.rows.length) {
    answer = { ok: true, parts: [{ text: '没有查到符合条件的数据。' }], text: '没有查到符合条件的数据。' };
  } else {
    const reply = await llm(answerMessages(q, check.sql, result));
    answer = fillAnswer(reply.answer, result);
    step({ kind: 'answer', template: reply.answer, ok: answer.ok, reason: answer.reason });
  }
  return { question: q, source: 'model', sql: check.sql, reason: plan.reason, result, answer, chart: chartFor(plan.chart, result.columns), steps };
}
