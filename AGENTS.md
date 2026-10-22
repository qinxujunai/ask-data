# AGENTS.md — 问数（ask-data）

用一句话问世界银行的数据。纯静态网站（GitHub Pages），数据库在浏览器里。产品说明见 README.md。

## 结构
```
src/schema.js            两张表和 17 个指标的口径：下载、建库、提示词、检索都从这里取，只写一次
src/knowledge/terms.js   业务口径（金砖国家、最新、发达国家…）
src/knowledge/examples.js 验证过的「问题 → SQL → 回答模板 → 图表」，测试会逐条真跑
src/engine/              与界面无关、Node 和浏览器共用：retrieve（检索）、prompt、llm、guard（SQL 边界）、
                         pipeline（一问的全流程）、answer（占位符填数）、format（按单位格式化）
src/db.worker.js, db.js  sql.js 在 Web Worker 里，只读连接，超时结束 worker
src/main.js, chart.js    页面与图表（Observable Plot）
scripts/                 fetch-data（下载）、build-db（CSV → public/wdi.sqlite）、eval（评测）
data/                    世界银行原始数据 CSV（提交进仓库，构建可复现）
```

## 不许回退的决定
| 决定 | 原因 |
| --- | --- |
| 模型不写数字：回答里只能用 `{{行.列}}` 占位符，程序填数；模型写了数字就不显示这句话 | 这是项目的核心：数字只来自数据库 |
| SQL 两道边界：`guard.js` 检查单条只读、限 500 行；数据库连接 `PRAGMA query_only`；worker 4 秒超时 | 只靠正则拦不住所有写法，只靠数据库又看不到原因；两层都要 |
| 示例库命中的问题直接用验证过的查询，不调模型 | 没有 key 的访客也能用；验证过的答案比现写的可靠 |
| 检索用 MiniSearch（BM25，中文按相邻两字切分），不上向量库 | 知识只有几十条，关键词检索够用、可解释、零服务器；超过几百条再换 |
| key 由访客自己填，浏览器直连 DeepSeek（已确认其接口允许跨域），不做代理服务器 | 纯静态部署；不替别人保管 key |
| 页面里模型和数据的文字一律 `textContent`，不用 innerHTML | 防注入 |
| 评测把被测题的示例从检索里拿掉（`exclude`） | 否则模型抄自己的示例，分数虚高 |

## 规则
- 新增指标：只改 `src/schema.js`，再 `npm run data`。新增示例：写进 `examples.js`，`npm test` 会真跑它。
- 不在页面或 README 写准确率，除非 `eval/report.md` 有结果，并写明日期和模型。
- 提交只署作者本人：`qinxujunai <266454737+qinxujunai@users.noreply.github.com>`，提交说明里不加 `Co-Authored-By`、`Claude-Session` 这类署名。

## 验证
```bash
npm test && npm run build
npx vite preview   # 手机和电脑、深浅色各看一遍；问一个示例问题、一个自由问题
```

## 交接日志
- **2026-10-23**：第一版。验证：`npm test` 7 组（含 21 条示例真跑、数据库拒绝写入、假模型走完「拦下 → 修正 → 回答」）；浏览器里手机浅色、电脑深色：示例问题、无 key 自由提问、有 key（拦截 DeepSeek 请求模拟）三条路径，axe 0 违规、无横向溢出、无报错。真实模型还没跑过评测（需要仓库 Secret `DEEPSEEK_API_KEY`，再手动运行 Eval）。
