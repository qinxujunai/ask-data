// Every number a person sees is formatted here, from the query result, by the column's unit.
// The model never writes a number; it only points at a cell (see answer.js).

import { COLUMN } from '../schema.js';

const trim = (n, digits) => Number(n.toFixed(digits)).toLocaleString('zh-CN', { maximumFractionDigits: digits });

// Big amounts read the Chinese way: 万, 亿, 万亿.
function big(n, unit) {
  const a = Math.abs(n);
  if (a >= 1e12) return `${trim(n / 1e12, 2)} 万亿${unit}`;
  if (a >= 1e8) return `${trim(n / 1e8, a >= 1e11 ? 0 : 1)} 亿${unit}`;
  if (a >= 1e4) return `${trim(n / 1e4, 1)} 万${unit}`;
  return `${trim(n, 0)} ${unit}`.trim();
}

// What kind of number a column holds: from the schema, or guessed from the name of a computed column.
export function kindOf(column) {
  const c = String(column).toLowerCase();
  if (c === 'year' || c.endsWith('_year') || c.startsWith('year_')) return 'year';
  const known = COLUMN[c];
  if (known) {
    if (known.unit === '%') return 'pct';
    if (known.unit === '美元') return 'usd';
    if (known.unit === '人') return 'people';
    return known.unit;
  }
  if (/(pct|percent|share|ratio_pct|_rate)$/.test(c)) return 'pct';
  if (/(usd|gdp)/.test(c) && !/(ratio|times|multiple|growth)/.test(c)) return 'usd';
  if (/population|people/.test(c)) return 'people';
  if (/(ratio|times|multiple)/.test(c)) return 'times';
  if (/(count|^n$|num)/.test(c)) return 'count';
  return '';
}

export function formatValue(value, column) {
  if (value === null || value === undefined) return '无数据';
  if (typeof value !== 'number') return String(value);
  const kind = kindOf(column);
  if (kind === 'year' || kind === 'count') return String(Math.round(value));
  if (kind === 'pct') return `${trim(value, 1)}%`;
  if (kind === 'usd') return big(value, '美元');
  if (kind === 'people') return big(value, '人');
  if (kind === 'times') return `${trim(value, 2)} 倍`;
  if (kind) return `${trim(value, 2)} ${kind}`;
  return trim(value, Math.abs(value) >= 100 ? 0 : 2);
}
