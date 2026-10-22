// The two requests to the model. It writes a query and a sentence; it never sees a chance to
// write a figure that ends up on screen.

import { schemaText, LAST_YEAR } from '../schema.js';

const SQL_RULES = `你是数据分析师。把用户的问题翻译成一条 SQLite 查询，只用下面两张表。
规则：
1. 只写一条 SELECT（可以用 WITH），不要分号，不要修改数据。
2. 要显示国家名时 JOIN countries 取 name；比较、排名国家时加 countries.is_aggregate = 0。
3. “世界”“高收入国家”“欧盟”等用汇总口径的 code，不要自己对各国求平均。
4. 排除空值；“最新”指该指标有数据的最近一年（数据到 ${LAST_YEAR} 年）。
5. 倍数、占比、差值在 SQL 里算好，给结果列起英文名（如 ratio、share_pct、diff_usd）。
6. 趋势按 year 升序；排名按指标降序并 LIMIT；结果不超过 200 行。
7. 不要编造表里没有的列。如果这些数据回答不了这个问题，sql 留空，在 reason 里说明缺什么。
只输出 JSON：{"sql": "...", "chart": {"type": "line|bar|none", "x": "列名", "y": "列名", "series": "分组列名或空字符串"}, "reason": "一句话说明怎么查的"}`;

function context(ctx) {
  const parts = [];
  if (ctx.columns?.length) parts.push(`可能相关的指标：\n${ctx.columns.map((c) => `- stats.${c.column}：${c.name}，单位 ${c.unit}${c.note ? `。${c.note}` : ''}`).join('\n')}`);
  if (ctx.terms?.length) parts.push(`问题里的业务口径：\n${ctx.terms.map((t) => `- ${t.term.split(' ')[0]}：${t.means}`).join('\n')}`);
  if (ctx.places?.length) parts.push(`问题里提到的国家或口径：${ctx.places.map((p) => `${p.name}=${p.code}`).join('，')}`);
  if (ctx.examples?.length) parts.push(`验证过的相似问题和查询：\n${ctx.examples.map((e) => `问：${e.question}\nSQL：${e.sql}`).join('\n\n')}`);
  return parts.join('\n\n');
}

export function sqlMessages(question, ctx, previous) {
  const messages = [
    { role: 'system', content: `${SQL_RULES}\n\n${schemaText()}` },
    { role: 'user', content: `${context(ctx)}\n\n问题：${question}` },
  ];
  // One repair round: the model sees its query and what the database or the guard said about it.
  if (previous) {
    messages.push({ role: 'assistant', content: JSON.stringify({ sql: previous.sql }) });
    messages.push({ role: 'user', content: `这条查询没通过：${previous.error}\n请改正，仍只输出 JSON。` });
  }
  return messages;
}

const ANSWER_RULES = `根据查询结果，用一两句中文回答用户的问题。
最重要的规则：不要写任何数字（包括年份）。要说到结果里的值，就用占位符 {{行号.列名}} 引用，行号从 0 开始，-1 表示最后一行。
例如：{{0.year}} 年，{{0.name}}的人均 GDP 是 {{0.gdp_per_capita_usd}}。
程序会把占位符换成格式化好的数字和单位，所以不要在占位符后面再写单位。
结果为空时直说没有找到数据。只输出 JSON：{"answer": "..."}`;

export function answerMessages(question, sql, result) {
  const head = result.rows.slice(0, 30).map((r, i) => `${i}: ${JSON.stringify(Object.fromEntries(result.columns.map((c, j) => [c, r[j]])))}`).join('\n');
  return [
    { role: 'system', content: ANSWER_RULES },
    { role: 'user', content: `问题：${question}\nSQL：${sql}\n结果共 ${result.rows.length} 行，列：${result.columns.join(', ')}\n${head}${result.rows.length > 30 ? '\n…' : ''}` },
  ];
}
