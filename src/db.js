// The page's handle on the database worker. A query that runs past the limit is stopped by ending the
// worker; a fresh one is started for the next question.

const LIMIT_MS = 4000;

export class Database {
  constructor(dbUrl) {
    this.dbUrl = dbUrl;
    this.seq = 0;
    this.start();
  }

  start() {
    this.worker = new Worker(new URL('./db.worker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'ready') return resolve(data.countries);
        if (data.type === 'failed') return reject(new Error(data.error));
        const p = this.pending.get(data.id);
        if (!p) return;
        this.pending.delete(data.id);
        clearTimeout(p.timer);
        if (data.error) p.reject(new Error(data.error));
        else p.resolve({ columns: data.columns, rows: data.rows, ms: data.ms });
      };
    });
    this.worker.postMessage({ type: 'init', dbUrl: this.dbUrl });
  }

  async run(sql) {
    await this.ready;
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.worker.terminate();
        this.start();
        reject(new Error(`查询超过 ${LIMIT_MS / 1000} 秒，已停止`));
      }, LIMIT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ type: 'run', id, sql });
    });
  }
}
