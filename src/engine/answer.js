// The written answer. The model writes the sentence but may not write a number: it points at result
// cells as {{row.column}} (row 0 is the first, -1 the last) and code fills them in, formatted by unit.
// A digit the model typed itself is refused, and a pointer to a cell that doesn't exist is refused:
// the reader then gets the table, not a sentence that might be wrong.

import { formatValue } from './format.js';

const PLACEHOLDER = /\{\{\s*(-?\d+)\s*\.\s*([A-Za-z_][\w]*)\s*\}\}/g;

// trusted: a verified example's own wording, which may contain fixed numbers ("2023 年").
export function fillAnswer(template, result, { trusted = false } = {}) {
  const { columns = [], rows = [] } = result || {};
  const text = String(template ?? '').trim();
  if (!text) return { ok: false, reason: '没有回答' };
  const outside = text.replace(PLACEHOLDER, '');
  // Digits outside placeholders: numbers the model made up. Allowed: ordinal words, not figures.
  if (!trusted && /[0-9０-９]/.test(outside)) return { ok: false, reason: '回答里有不是从结果里取的数字' };
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    const [whole, rowText, column] = m;
    let row = Number(rowText);
    if (row < 0) row = rows.length + row;
    const col = columns.indexOf(column);
    if (row < 0 || row >= rows.length || col < 0) return { ok: false, reason: `引用了不存在的格子 ${whole}` };
    parts.push({ text: text.slice(last, m.index) });
    const value = rows[row][col];
    parts.push({ text: formatValue(value, column), cell: { row, column, value } });
    last = m.index + whole.length;
  }
  parts.push({ text: text.slice(last) });
  return { ok: true, parts: parts.filter((p) => p.text !== ''), text: parts.map((p) => p.text).join('') };
}
