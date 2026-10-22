// 问数 — the page. Everything the model or the data says is put in with textContent, never as HTML.

import './style.css';
import { Database } from './db.js';
import { Retriever } from './engine/retrieve.js';
import { ask } from './engine/pipeline.js';
import { createLLM, DEFAULT_MODEL } from './engine/llm.js';
import { formatValue, labelOf } from './engine/format.js';
import { renderChart } from './chart.js';
import { EXAMPLES, SUGGESTED } from './knowledge/examples.js';
import { COLUMN, INDICATORS } from './schema.js';

const $ = (s) => document.querySelector(s);
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// ── settings: the reader's own model key, kept only in this browser if they ask ──
const STORE = 'ask-data:model';
const store = {
  get() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(STORE); } catch { /* private mode */ } },
};
let settings = { ...DEFAULT_MODEL, key: '', ...store.get() };

const db = new Database(new URL('wdi.sqlite', document.baseURI).href);
let retriever = null;
db.ready.then((countries) => { retriever = new Retriever(countries); $('#status').textContent = ''; })
  .catch((e) => { $('#status').textContent = `数据没加载成功：${e.message}。刷新试试。`; });

// ── the question box ──
const form = $('#ask');
const input = $('#q');
const chips = $('#chips');
for (const id of SUGGESTED) {
  const e = EXAMPLES.find((x) => x.id === id);
  chips.append(h('li', {}, h('button', { type: 'button', class: 'chip', onclick: () => { input.value = e.question; run(e.question); } }, e.question)));
}
form.addEventListener('submit', (ev) => { ev.preventDefault(); if (input.value.trim()) run(input.value); });

function renderKeyNote() {
  const note = $('#keynote');
  note.replaceChildren(settings.key
    ? h('span', {}, '已用你的 DeepSeek key：可以问任意问题。 ', h('button', { type: 'button', class: 'link', onclick: openKey }, '设置'))
    : h('span', {}, '上面这些问题不用 key，答案由验证过的查询现场算出。想问任意问题，', h('button', { type: 'button', class: 'link', onclick: openKey }, '填一个 DeepSeek key ›')));
}

function openKey() {
  const dlg = $('#keydlg');
  $('#key').value = settings.key || '';
  $('#remember').checked = !!store.get().key;
  dlg.showModal();
}
$('#keyform').addEventListener('submit', (ev) => {
  if (ev.submitter?.value !== 'save') return;
  settings = { ...settings, key: $('#key').value.trim() };
  if ($('#remember').checked && settings.key) store.set({ key: settings.key }); else store.clear();
  renderKeyNote();
});
$('#forget').addEventListener('click', () => { settings.key = ''; store.clear(); $('#key').value = ''; renderKeyNote(); });
renderKeyNote();

// ── one question ──
let busy = false;
async function run(question) {
  if (busy) return;
  busy = true;
  const out = $('#result');
  out.hidden = false;
  out.replaceChildren(h('p', { class: 'q' }, question.trim()), h('p', { class: 'working', role: 'status' }, '正在找答案…'));
  out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  try {
    await db.ready;
    const r = await ask(question, { retriever, db, llm: createLLM(settings) });
    out.replaceChildren(...view(r));
    try { history.replaceState(null, '', `?q=${encodeURIComponent(r.question)}#result`); } catch { /* file:// */ }
  } catch (e) {
    out.replaceChildren(h('p', { class: 'q' }, question.trim()), h('p', { class: 'warn' }, e.message));
  } finally {
    busy = false;
  }
}

function view(r) {
  const parts = [h('p', { class: 'q' }, r.question)];
  if (r.source === 'need-key') {
    parts.push(h('p', { class: 'answer' }, '这个问题需要模型来写查询。'));
    parts.push(h('p', { class: 'muted' }, '填一个 DeepSeek key 就能问任意问题；或者看看现成的问题。'));
    const actions = h('p', { class: 'actions' }, h('button', { type: 'button', class: 'button', onclick: openKey }, '填 DeepSeek key'));
    if (r.nearest) actions.append(h('button', { type: 'button', class: 'link', onclick: () => { input.value = r.nearest.question; run(r.nearest.question); } }, `最接近的问题：${r.nearest.question} ›`));
    parts.push(actions);
    return parts;
  }
  if (r.source === 'unanswerable' || r.source === 'failed') {
    parts.push(h('p', { class: 'answer' }, r.source === 'unanswerable' ? '这些数据回答不了这个问题。' : '这次没有算出来。'));
    parts.push(h('p', { class: 'muted' }, r.reason));
    parts.push(trace(r));
    return parts;
  }
  // The answer: every number links back to the cell it came from.
  if (r.answer.ok) {
    parts.push(h('p', { class: 'answer' }, r.answer.parts.map((p) => (p.cell && typeof p.cell.value === 'number' ? h('span', { class: 'num', title: `来自结果第 ${p.cell.row + 1} 行，${heading(p.cell.column)}` }, p.text) : p.text))));
  } else {
    parts.push(h('p', { class: 'answer' }, `查到 ${r.result.rows.length} 行结果，见下表。`));
    parts.push(h('p', { class: 'muted' }, `模型写的那句话没有显示：${r.answer.reason}。`));
  }
  const chart = renderChart(r.chart, r.result, Math.min(860, $('#result').clientWidth || 360));
  if (chart) parts.push(h('figure', { class: 'chart' }, chart));
  parts.push(table(r.result));
  parts.push(trace(r));
  return parts;
}

const heading = labelOf;

function table({ columns, rows }) {
  const FEW = 8;
  const MANY = 200;
  const body = h('tbody');
  const fill = (n) => body.replaceChildren(...rows.slice(0, n).map((row) => h('tr', {}, row.map((v, i) => h('td', { class: typeof v === 'number' ? 'n' : '' }, typeof v === 'number' ? formatValue(v, columns[i]) : v ?? '—')))));
  fill(FEW);
  const more = rows.length > FEW
    ? h('button', { type: 'button', class: 'link more', onclick: (ev) => { fill(MANY); ev.target.replaceWith(rows.length > MANY ? h('p', { class: 'muted' }, `共 ${rows.length} 行，显示前 ${MANY} 行。`) : ''); } }, `显示全部 ${rows.length} 行`)
    : null;
  return h('div', { class: 'table-wrap' },
    h('div', { class: 'table', tabindex: '0', role: 'region', 'aria-label': '查询结果' },
      h('table', {}, h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col' }, heading(c))))), body)),
    more);
}

// How the answer was made, step by step.
function trace(r) {
  const s = (kind) => r.steps.filter((x) => x.kind === kind);
  const ctx = s('retrieve')[0]?.ctx || {};
  const li = [];
  const found = [
    ...(ctx.places || []).map((p) => `${p.name} = ${p.code}`),
    ...(ctx.columns || []).slice(0, 3).map((c) => c.name),
    ...(ctx.terms || []).map((t) => t.term.split(' ')[0]),
  ];
  li.push(h('li', {}, h('strong', {}, '检索'), h('span', {}, found.length ? `找到：${found.join('、')}` : '没有找到明确的指标或国家'),
    ctx.examples?.length ? h('span', { class: 'muted' }, `相似的示例：${ctx.examples.map((e) => e.question).join(' / ')}`) : null));
  if (r.source === 'verified') {
    li.push(h('li', {}, h('strong', {}, '查询'), h('span', {}, '这个问题在示例库里，用验证过的查询，没有调用模型。')));
  } else if (s('sql').length) {
    li.push(h('li', {}, h('strong', {}, '查询'), h('span', {}, `模型写了一条查询${s('sql')[0].plan.reason ? `：${s('sql')[0].plan.reason}` : ''}`)));
    for (const run of s('run').filter((x) => !x.ok)) li.push(h('li', {}, h('strong', {}, '拦下'), h('span', {}, `第一次的查询没通过：${run.error}。把原因交回给模型，改了一次。`)));
  }
  if (r.result) {
    li.push(h('li', {}, h('strong', {}, '检查'), h('span', {}, '只读、单条查询、最多 500 行，数据库本身也禁止写入。')));
    li.push(h('li', {}, h('strong', {}, '运行'), h('span', {}, `在你的浏览器里运行，${r.result.rows.length} 行，${r.result.ms ?? 0} 毫秒。`)));
    li.push(h('li', {}, h('strong', {}, '回答'), h('span', {}, r.source === 'verified' ? '句子是示例库写好的，数字由程序从结果里填入。' : r.answer?.ok ? '模型只写句子，数字由程序从结果里填入。' : '模型写的句子被拦下，只给结果表。')));
  }
  const used = r.result ? r.result.columns.filter((c) => COLUMN[c]).map((c) => `${COLUMN[c].name} ${COLUMN[c].code}`) : [];
  return h('details', { class: 'trace' }, h('summary', {}, '怎么算出来的'),
    h('ol', {}, li),
    r.sql ? h('div', { class: 'sql' }, h('pre', { tabindex: '0', 'aria-label': 'SQL 查询' }, h('code', {}, r.sql)), h('button', { type: 'button', class: 'link', onclick: (ev) => { navigator.clipboard?.writeText(r.sql).then(() => { ev.target.textContent = '已复制'; }); } }, '复制 SQL')) : null,
    h('p', { class: 'muted' }, `数据：世界银行《世界发展指标》，CC BY 4.0${used.length ? `。用到的指标：${used.join('，')}` : ''}。`));
}

// The indicator list in the data section.
$('#indicators').append(...INDICATORS.map((i) => h('li', {}, h('span', {}, i.name), h('span', { class: 'muted' }, i.unit))));

// A shared link opens with its question asked.
const shared = new URLSearchParams(location.search).get('q');
if (shared) { input.value = shared; run(shared); }
