# 问数

**用一句话问数据。模型只写查询，数字由数据库现场算出，每个答案都能核对。**

[打开网站](https://qinxujunai.github.io/ask-data/) · [怎么做到的](#怎么做到的) · [数据](#数据)

问「中国 GDP 占世界的比重是怎么变化的？」，它会给你一句回答、一张图、一张结果表，以及这个答案是怎么算出来的：检索到了哪些口径、写了什么查询、跑了几毫秒。SQL 可以复制出去自己再跑一遍。

> 先立边界，再把概率压成确定性。

## 为什么做

企业里问数据，难的不是让模型写出 SQL，而是让人敢用它给的数字。模型会编：编一个看起来很对的数，编一个不存在的字段，或者把「发达国家」理解成它自己想的那几个国家。问数把能编的地方都收走：

- **模型不写数字。** 它写查询，再写一句话；句子里的数字只能是指向结果格子的占位符（`{{0.gdp_usd}}`），由程序按单位填进去。模型自己写了数字，这句话就不显示，只给结果表。
- **查询有边界。** 只允许一条只读查询，最多 500 行，超过 4 秒就停；数据库连接本身也是只读的（`PRAGMA query_only`）。
- **口径写下来。** 「金砖国家」「最新」「发达国家」在这份数据里是什么意思，写在口径库里，检索到才交给模型。
- **验证过的问题不用模型。** 示例库里的问题直接用验证过的查询，没有 key 的访客也能用。

## 怎么做到的

```
问题
 ├─ 检索（RAG）  指标说明 · 业务口径 · 验证过的示例 · 问题里的国家      src/engine/retrieve.js
 ├─ 写查询       示例库命中 → 用验证过的查询；否则 DeepSeek 写一条 SQL     src/engine/pipeline.js、prompt.js
 ├─ 检查         单条、只读、限行；不通过就把原因交回模型，修一次          src/engine/guard.js
 ├─ 运行         SQLite（sql.js）在浏览器的 Web Worker 里，超时就停        src/db.worker.js、db.js
 └─ 回答         模型写句子，数字由程序从结果填入                          src/engine/answer.js、format.js
```

| 部分 | 用的开源项目 | 为什么 |
| --- | --- | --- |
| 数据库 | [sql.js](https://github.com/sql-js/sql.js)（SQLite 的 WebAssembly 版，MIT） | 整个数据库 1.5 MB，在浏览器里跑，不需要服务器 |
| 检索 | [MiniSearch](https://github.com/lucaong/minisearch)（BM25，MIT） | 口径和示例只有几十条，关键词检索够用、可解释；中文按相邻两字切分 |
| 图表 | [Observable Plot](https://github.com/observablehq/plot)（ISC） | 折线、柱状、悬停提示都是现成的 |
| 方法 | 借鉴 [Vanna](https://github.com/vanna-ai/vanna) 的做法：用表结构、文档和「问题 → SQL」示例做检索 | 只借做法，没有用它的代码；它需要 Python 服务端 |

模型默认是 DeepSeek（OpenAI 兼容接口）。key 由访客自己填，从浏览器直接发给 DeepSeek，不经过任何服务器；不填 key 时只能问示例库里的问题。

## 数据

世界银行《世界发展指标》（World Development Indicators），[CC BY 4.0](https://datacatalog.worldbank.org/public-licenses#cc-by)。217 个国家和地区，加上世界、收入组、欧盟等 47 个汇总口径；1990–2024 年；17 个指标：GDP、人均 GDP、GDP 增长率、人口、预期寿命、城镇化率、总和生育率、65 岁以上人口占比、出口占比、贸易占比、通胀率、失业率、研发支出占比、互联网普及率、人均碳排放、可再生能源占比、高等教育毛入学率。指标代码和口径在 `src/schema.js`。

## 评测

`npm run eval`（需要 `DEEPSEEK_API_KEY`）把示例库的每个问题重新交给模型，问之前把这道题自己的示例从检索里拿掉，再把结果和验证过的查询比对；分别跑「带检索」和「只给表结构」两种，看检索值多少。报告写进 `eval/`。也可以在 Actions 里手动运行 Eval（需要仓库 Secret `DEEPSEEK_API_KEY`）。

还没跑过，所以这里不写准确率。

## 开发

```bash
npm install
npm run data      # 重新下载世界银行数据（约 3 分钟），写入 data/*.csv
npm test          # 生成数据库，跑测试（示例库的每条查询都会真跑一遍）
npm run dev       # 本地预览
npm run build     # 输出 dist/
```

推送到 `main` 后，Pages 工作流测试、构建并发布网站。

## 还差什么

- 准确率还没有评测结果（见上）。
- 检索是关键词检索；示例和口径多到几百条以后，应该换成向量检索或两者混合。
- 只回答这一份数据能回答的问题；跨数据源、需要外部知识的问题会说「回答不了」。
- 数据不自动更新，靠手动 `npm run data`。

## 许可

代码 [MIT](LICENSE)；数据 CC BY 4.0，来源世界银行。
