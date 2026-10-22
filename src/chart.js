// Charts with Observable Plot. Axis ticks use short Chinese units (万, 亿, 万亿); the axis title carries
// the indicator's name and unit from the schema.

import * as Plot from '@observablehq/plot';
import { COLUMN } from './schema.js';
import { kindOf, formatValue, labelOf } from './engine/format.js';

const COLORS = ['#0071e3', '#ff9f0a', '#34c759', '#af52de', '#ff2d55', '#5ac8fa', '#a2845e'];

function short(n) {
  const a = Math.abs(n);
  if (a >= 1e12) return `${+(n / 1e12).toFixed(1)}万亿`;
  if (a >= 1e8) return `${+(n / 1e8).toFixed(1)}亿`;
  if (a >= 1e4) return `${+(n / 1e4).toFixed(1)}万`;
  return `${+n.toFixed(2)}`;
}

// Hover tips show the same formatted numbers as the answer and the table.
const tipFormat = (spec) => ({ x: kindOf(spec.x) === 'year' ? (d) => String(d) : true, y: (d) => formatValue(d, spec.y), stroke: !!spec.series, fill: !!spec.series });

function label(column) {
  const c = COLUMN[column];
  if (c) return c.name.includes(c.unit) ? c.name : `${c.name}（${c.unit}）`;
  const words = labelOf(column);
  return kindOf(column) === 'pct' && !words.includes('%') ? `${words}（%）` : words;
}

export function renderChart(spec, result, width) {
  const plot = draw(spec, result, width);
  if (!plot) return null;
  // One description for the whole chart. Plot labels its inner groups (and redraws the hover tip),
  // so its output is hidden from screen readers and the wrapper speaks for it; the table below has the data.
  plot.setAttribute('aria-hidden', 'true');
  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `${spec.type === 'line' ? '折线图' : '柱状图'}：${label(spec.y)}${spec.series ? `，按${spec.series}分组` : ''}，数据见下表`);
  wrap.append(plot);
  return wrap;
}

function draw(spec, result, width) {
  if (!spec || spec.type === 'none') return null;
  const { columns, rows } = result;
  const data = rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))).filter((d) => d[spec.y] !== null);
  if (data.length < 2) return null;
  const isYear = kindOf(spec.x) === 'year';
  const common = {
    width,
    height: Math.round(Math.min(360, Math.max(240, width * 0.55))),
    marginLeft: 56,
    marginBottom: spec.type === 'bar' && !isYear ? 64 : 32,
    style: { fontSize: '12px', background: 'transparent', color: 'currentColor' },
    y: { grid: true, label: label(spec.y), tickFormat: short },
    color: { range: COLORS, legend: !!spec.series },
  };
  if (spec.type === 'line') {
    return Plot.plot({
      ...common,
      x: { label: null, tickFormat: isYear ? 'd' : undefined },
      marks: [
        Plot.lineY(data, { x: spec.x, y: spec.y, stroke: spec.series ? spec.series : () => '', strokeWidth: 2.2, curve: 'monotone-x', tip: { format: tipFormat(spec) } }),
      ],
    });
  }
  return Plot.plot({
    ...common,
    x: { label: null, domain: data.map((d) => d[spec.x]), tickRotate: !isYear && data.length > 6 ? -35 : 0, tickFormat: isYear ? 'd' : undefined },
    marks: [
      Plot.barY(data, { x: spec.x, y: spec.y, fill: spec.series ? spec.series : () => '', tip: { format: tipFormat(spec) }, rx: 3 }),
      Plot.ruleY([0], { stroke: 'currentColor', strokeOpacity: 0.3 }),
    ],
  });
}
