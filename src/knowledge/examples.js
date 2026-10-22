// Verified examples: a question, the query that answers it, how to say the answer, how to draw it.
// Three uses:
//   1. retrieval: the most similar ones go into the prompt as worked examples;
//   2. without a model key, a question that matches one is answered by its verified query;
//   3. evaluation: scripts/eval.mjs asks the model each question (with that example held out of
//      retrieval) and compares its result with the verified one.
// Every query here is run by the tests, so a broken example fails the build.
// Answers point at result cells as {{row.column}}; numbers are filled in by code.

export const EXAMPLES = [
  {
    id: 'china-gdp-per-capita',
    question: '中国现在的人均 GDP 是多少？',
    sql: `SELECT c.name, s.year, s.gdp_per_capita_usd
FROM stats s JOIN countries c ON c.code = s.code
WHERE s.code = 'CHN' AND s.gdp_per_capita_usd IS NOT NULL
ORDER BY s.year DESC LIMIT 1`,
    answer: '{{0.year}} 年，{{0.name}}的人均 GDP 是 {{0.gdp_per_capita_usd}}（现价）。',
    chart: { type: 'none' },
  },
  {
    id: 'china-us-gdp',
    question: '中国和美国的 GDP 这 30 年是怎么变化的？',
    sql: `SELECT s.year, c.name, s.gdp_usd
FROM stats s JOIN countries c ON c.code = s.code
WHERE s.code IN ('CHN','USA') AND s.year > 1994 AND s.gdp_usd IS NOT NULL
ORDER BY s.year, c.name`,
    answer: '{{0.year}} 年，{{0.name}}的 GDP 是 {{0.gdp_usd}}，{{1.name}}是 {{1.gdp_usd}}；到 {{-1.year}} 年，{{-2.name}}是 {{-2.gdp_usd}}，{{-1.name}}是 {{-1.gdp_usd}}。',
    chart: { type: 'line', x: 'year', y: 'gdp_usd', series: 'name' },
  },
  {
    id: 'china-share-world-gdp',
    question: '中国 GDP 占世界的比重是怎么变化的？',
    sql: `SELECT cn.year, ROUND(100.0 * cn.gdp_usd / w.gdp_usd, 2) AS share_pct
FROM stats cn JOIN stats w ON w.year = cn.year AND w.code = 'WLD'
WHERE cn.code = 'CHN' AND cn.gdp_usd IS NOT NULL AND w.gdp_usd IS NOT NULL
ORDER BY cn.year`,
    answer: '中国 GDP 占世界的比重，{{0.year}} 年是 {{0.share_pct}}，{{-1.year}} 年是 {{-1.share_pct}}。',
    chart: { type: 'line', x: 'year', y: 'share_pct' },
  },
  {
    id: 'top10-gdp-per-capita',
    question: '2023 年人均 GDP 最高的 10 个国家是哪些？',
    sql: `SELECT c.name, s.gdp_per_capita_usd
FROM stats s JOIN countries c ON c.code = s.code
WHERE s.year = 2023 AND c.is_aggregate = 0 AND s.gdp_per_capita_usd IS NOT NULL
ORDER BY s.gdp_per_capita_usd DESC LIMIT 10`,
    answer: '2023 年人均 GDP 最高的是{{0.name}}，{{0.gdp_per_capita_usd}}；第二是{{1.name}}，{{1.gdp_per_capita_usd}}。',
    chart: { type: 'bar', x: 'name', y: 'gdp_per_capita_usd' },
  },
  {
    id: 'aging-top10',
    question: '哪些国家老龄化最严重？',
    sql: `WITH latest AS (SELECT MAX(year) AS y FROM stats WHERE age65_pct IS NOT NULL)
SELECT c.name, s.year, s.age65_pct
FROM stats s JOIN countries c ON c.code = s.code, latest
WHERE s.year = latest.y AND c.is_aggregate = 0 AND s.age65_pct IS NOT NULL
ORDER BY s.age65_pct DESC LIMIT 10`,
    answer: '{{0.year}} 年，65 岁及以上人口占比最高的是{{0.name}}（{{0.age65_pct}}），其次是{{1.name}}（{{1.age65_pct}}）和{{2.name}}（{{2.age65_pct}}）。',
    chart: { type: 'bar', x: 'name', y: 'age65_pct' },
  },
  {
    id: 'china-fertility-below-1-5',
    question: '中国的总和生育率是哪一年跌破 1.5 的？',
    sql: `SELECT year, fertility_rate
FROM stats
WHERE code = 'CHN' AND fertility_rate < 1.5
ORDER BY year LIMIT 1`,
    answer: '{{0.year}} 年，中国的总和生育率降到 {{0.fertility_rate}}，第一次低于 1.5。',
    chart: { type: 'none' },
  },
  {
    id: 'east-asia-fertility',
    question: '中日韩的生育率这些年怎么变的？',
    sql: `SELECT s.year, c.name, s.fertility_rate
FROM stats s JOIN countries c ON c.code = s.code
WHERE s.code IN ('CHN','JPN','KOR') AND s.fertility_rate IS NOT NULL
ORDER BY s.year, c.name`,
    answer: '到 {{-1.year}} 年，三国的总和生育率分别是：{{-3.name}} {{-3.fertility_rate}}、{{-2.name}} {{-2.fertility_rate}}、{{-1.name}} {{-1.fertility_rate}}。',
    chart: { type: 'line', x: 'year', y: 'fertility_rate', series: 'name' },
  },
  {
    id: 'india-passes-china',
    question: '印度人口是哪一年超过中国的？',
    sql: `SELECT i.year, i.population AS india_population, c.population AS china_population
FROM stats i JOIN stats c ON c.year = i.year AND c.code = 'CHN'
WHERE i.code = 'IND' AND i.population > c.population
ORDER BY i.year LIMIT 1`,
    answer: '按世界银行的数据，{{0.year}} 年印度人口 {{0.india_population}}，超过中国的 {{0.china_population}}。',
    chart: { type: 'none' },
  },
  {
    id: 'world-population',
    question: '世界人口是怎么增长的？',
    sql: `SELECT year, population FROM stats WHERE code = 'WLD' AND population IS NOT NULL ORDER BY year`,
    answer: '世界人口从 {{0.year}} 年的 {{0.population}}，增长到 {{-1.year}} 年的 {{-1.population}}。',
    chart: { type: 'line', x: 'year', y: 'population' },
  },
  {
    id: 'rnd-top10',
    question: '哪些国家研发投入占 GDP 的比例最高？',
    sql: `WITH latest AS (SELECT code, MAX(year) AS y FROM stats WHERE rnd_pct_gdp IS NOT NULL GROUP BY code)
SELECT c.name, s.year, s.rnd_pct_gdp
FROM latest l JOIN stats s ON s.code = l.code AND s.year = l.y JOIN countries c ON c.code = s.code
WHERE c.is_aggregate = 0 AND s.year >= 2020
ORDER BY s.rnd_pct_gdp DESC LIMIT 10`,
    answer: '按各国有数据的最近一年，研发支出占 GDP 比例最高的是{{0.name}}（{{0.year}} 年，{{0.rnd_pct_gdp}}），其次是{{1.name}}（{{1.rnd_pct_gdp}}）。',
    chart: { type: 'bar', x: 'name', y: 'rnd_pct_gdp' },
  },
  {
    id: 'china-urbanization-decades',
    question: '中国的城镇化率每十年变化多少？',
    sql: `SELECT year, urban_pct FROM stats
WHERE code = 'CHN' AND year IN (1990, 2000, 2010, 2020, 2024)
ORDER BY year`,
    answer: '中国城镇人口占比，{{0.year}} 年是 {{0.urban_pct}}，{{2.year}} 年是 {{2.urban_pct}}，{{-1.year}} 年是 {{-1.urban_pct}}。',
    chart: { type: 'bar', x: 'year', y: 'urban_pct' },
  },
  {
    id: 'brics-growth-2024',
    question: '金砖国家 2024 年的经济增速各是多少？',
    sql: `SELECT c.name, s.gdp_growth_pct
FROM stats s JOIN countries c ON c.code = s.code
WHERE s.code IN ('BRA','RUS','IND','CHN','ZAF') AND s.year = 2024
ORDER BY s.gdp_growth_pct DESC`,
    answer: '2024 年金砖五国里增速最高的是{{0.name}}（{{0.gdp_growth_pct}}），最低的是{{-1.name}}（{{-1.gdp_growth_pct}}）。',
    chart: { type: 'bar', x: 'name', y: 'gdp_growth_pct' },
  },
  {
    id: 'high-income-vs-china',
    question: '高收入国家的人均 GDP 是中国的几倍？',
    sql: `SELECT h.year, ROUND(h.gdp_per_capita_usd / c.gdp_per_capita_usd, 2) AS ratio
FROM stats h JOIN stats c ON c.year = h.year AND c.code = 'CHN'
WHERE h.code = 'HIC' AND h.gdp_per_capita_usd IS NOT NULL AND c.gdp_per_capita_usd IS NOT NULL
ORDER BY h.year`,
    answer: '{{0.year}} 年，高收入国家整体的人均 GDP 是中国的 {{0.ratio}}；到 {{-1.year}} 年是 {{-1.ratio}}。',
    chart: { type: 'line', x: 'year', y: 'ratio' },
  },
  {
    id: 'co2-china-eu-us',
    question: '中国、欧盟和美国的人均碳排放对比',
    sql: `SELECT s.year, c.name, s.co2_per_capita_t
FROM stats s JOIN countries c ON c.code = s.code
WHERE s.code IN ('CHN','EUU','USA') AND s.co2_per_capita_t IS NOT NULL
ORDER BY s.year, c.name`,
    answer: '{{-1.year}} 年，人均二氧化碳排放：{{-3.name}} {{-3.co2_per_capita_t}}，{{-2.name}} {{-2.co2_per_capita_t}}，{{-1.name}} {{-1.co2_per_capita_t}}。',
    chart: { type: 'line', x: 'year', y: 'co2_per_capita_t', series: 'name' },
  },
  {
    id: 'asean-internet',
    question: '东盟国家的互联网普及率是多少？',
    sql: `WITH latest AS (SELECT MAX(year) AS y FROM stats WHERE internet_pct IS NOT NULL AND code IN ('BRN','KHM','IDN','LAO','MYS','MMR','PHL','SGP','THA','VNM'))
SELECT c.name, s.year, s.internet_pct
FROM stats s JOIN countries c ON c.code = s.code, latest
WHERE s.code IN ('BRN','KHM','IDN','LAO','MYS','MMR','PHL','SGP','THA','VNM') AND s.year = latest.y AND s.internet_pct IS NOT NULL
ORDER BY s.internet_pct DESC`,
    answer: '{{0.year}} 年，东盟里互联网普及率最高的是{{0.name}}（{{0.internet_pct}}），最低的是{{-1.name}}（{{-1.internet_pct}}）。',
    chart: { type: 'bar', x: 'name', y: 'internet_pct' },
  },
  {
    id: 'renewables-over-half',
    question: '哪些国家的可再生能源占比超过一半？',
    sql: `WITH latest AS (SELECT MAX(year) AS y FROM stats WHERE renewable_energy_pct IS NOT NULL)
SELECT c.name, s.year, s.renewable_energy_pct
FROM stats s JOIN countries c ON c.code = s.code, latest
WHERE s.year = latest.y AND c.is_aggregate = 0 AND s.renewable_energy_pct > 50
ORDER BY s.renewable_energy_pct DESC LIMIT 20`,
    answer: '{{0.year}} 年，可再生能源占最终能源消费一半以上的国家里，最高的是{{0.name}}（{{0.renewable_energy_pct}}）。下表是前 20 个。',
    chart: { type: 'bar', x: 'name', y: 'renewable_energy_pct' },
  },
  {
    id: 'us-inflation-peaks',
    question: '美国通胀最高的是哪几年？',
    sql: `SELECT year, inflation_pct FROM stats
WHERE code = 'USA' AND inflation_pct IS NOT NULL
ORDER BY inflation_pct DESC LIMIT 5`,
    answer: '1990 年以来，美国通胀最高的一年是 {{0.year}} 年（{{0.inflation_pct}}），其次是 {{1.year}} 年（{{1.inflation_pct}}）。',
    chart: { type: 'bar', x: 'year', y: 'inflation_pct' },
  },
  {
    id: 'japan-avg-growth',
    question: '日本过去 30 年平均经济增速是多少？',
    sql: `SELECT MIN(year) AS from_year, MAX(year) AS to_year, ROUND(AVG(gdp_growth_pct), 2) AS avg_growth_pct
FROM stats WHERE code = 'JPN' AND year > 1994 AND gdp_growth_pct IS NOT NULL`,
    answer: '{{0.from_year}}–{{0.to_year}} 年，日本 GDP 实际增长率的年平均值是 {{0.avg_growth_pct}}。',
    chart: { type: 'none' },
  },
  {
    id: 'unemployment-top10',
    question: '失业率最高的 10 个国家',
    sql: `WITH latest AS (SELECT MAX(year) AS y FROM stats WHERE unemployment_pct IS NOT NULL)
SELECT c.name, s.year, s.unemployment_pct
FROM stats s JOIN countries c ON c.code = s.code, latest
WHERE s.year = latest.y AND c.is_aggregate = 0 AND s.unemployment_pct IS NOT NULL
ORDER BY s.unemployment_pct DESC LIMIT 10`,
    answer: '{{0.year}} 年，失业率最高的是{{0.name}}（{{0.unemployment_pct}}），其次是{{1.name}}（{{1.unemployment_pct}}）。这是国际劳工组织的统一估计，可能和各国官方数字不同。',
    chart: { type: 'bar', x: 'name', y: 'unemployment_pct' },
  },
  {
    id: 'g7-gdp-per-capita-2024',
    question: '七国集团 2024 年的人均 GDP 对比',
    sql: `SELECT c.name, s.gdp_per_capita_usd
FROM stats s JOIN countries c ON c.code = s.code
WHERE s.code IN ('USA','JPN','DEU','GBR','FRA','ITA','CAN') AND s.year = 2024
ORDER BY s.gdp_per_capita_usd DESC`,
    answer: '2024 年七国集团里人均 GDP 最高的是{{0.name}}（{{0.gdp_per_capita_usd}}），最低的是{{-1.name}}（{{-1.gdp_per_capita_usd}}）。',
    chart: { type: 'bar', x: 'name', y: 'gdp_per_capita_usd' },
  },
  {
    id: 'china-life-expectancy',
    question: '中国人的预期寿命提高了多少？',
    sql: `SELECT year, life_expectancy FROM stats
WHERE code = 'CHN' AND life_expectancy IS NOT NULL ORDER BY year`,
    answer: '中国出生时预期寿命从 {{0.year}} 年的 {{0.life_expectancy}}，提高到 {{-1.year}} 年的 {{-1.life_expectancy}}。',
    chart: { type: 'line', x: 'year', y: 'life_expectancy' },
  },
];

// Shown as one-tap questions on the page.
export const SUGGESTED = ['china-us-gdp', 'aging-top10', 'india-passes-china', 'east-asia-fertility', 'rnd-top10', 'china-share-world-gdp'];
