// The database lives in this worker, so a slow query never freezes the page and can be stopped.
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let db;

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const [SQL, buf] = await Promise.all([
        initSqlJs({ locateFile: () => wasmUrl }),
        fetch(data.dbUrl).then((r) => { if (!r.ok) throw new Error(`数据库下载失败 ${r.status}`); return r.arrayBuffer(); }),
      ]);
      db = new SQL.Database(new Uint8Array(buf));
      // The second boundary: whatever the query says, this connection cannot write.
      db.run('PRAGMA query_only = 1');
      const countries = db.exec('SELECT code, name, name_en FROM countries')[0].values.map(([code, name, name_en]) => ({ code, name, name_en }));
      self.postMessage({ type: 'ready', countries });
    } catch (e) {
      self.postMessage({ type: 'failed', error: e.message });
    }
    return;
  }
  if (data.type === 'run') {
    const t = performance.now();
    try {
      const r = db.exec(data.sql)[0];
      self.postMessage({ id: data.id, columns: r ? r.columns : [], rows: r ? r.values : [], ms: Math.round(performance.now() - t) });
    } catch (e) {
      self.postMessage({ id: data.id, error: e.message });
    }
  }
};
