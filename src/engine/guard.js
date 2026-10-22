// The boundary around model-written SQL. Two layers:
//   1. here, before running: one statement, a query (SELECT / WITH), none of the words that change
//      or reach outside the database, a row cap;
//   2. in the database itself: it is opened with PRAGMA query_only, so even a query that slipped
//      through cannot write. The worker also stops any query that runs too long (db.js).

const FORBIDDEN = /\b(insert|update|delete|replace|drop|create|alter|attach|detach|pragma|vacuum|reindex|analyze|begin|commit|rollback|savepoint|release|load_extension)\b/i;
export const MAX_ROWS = 500;

// Text with string literals, quoted names and comments blanked out, so keywords inside them don't count.
function code(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

export function checkSql(input) {
  let sql = String(input ?? '').trim().replace(/^```(?:sql)?\s*/i, '').replace(/```$/, '').trim();
  sql = sql.replace(/;\s*$/, '').trim();
  if (!sql) return { ok: false, reason: '没有查询' };
  const bare = code(sql);
  if (bare.includes(';')) return { ok: false, reason: '只允许一条语句' };
  if (!/^\s*(select|with)\b/i.test(bare)) return { ok: false, reason: '只允许查询（SELECT）' };
  const bad = bare.match(FORBIDDEN);
  if (bad) return { ok: false, reason: `不允许使用 ${bad[1].toUpperCase()}` };
  return { ok: true, sql, limited: `SELECT * FROM (${sql}) LIMIT ${MAX_ROWS}` };
}
