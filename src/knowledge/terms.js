// Business terms: what a word in a question means in this data. Retrieved into the prompt when the
// question uses the word. In a company this is the metric glossary (指标口径); here it is World Bank usage.

import { LAST_YEAR } from '../schema.js';

export const TERMS = [
  { term: '世界 全球 世界平均 全世界', means: "用汇总口径 code = 'WLD'（世界），不要自己对各国求平均" },
  { term: '金砖国家 金砖 BRICS', means: "最初五国：code IN ('BRA','RUS','IND','CHN','ZAF')" },
  { term: '七国集团 G7 西方七国', means: "code IN ('USA','JPN','DEU','GBR','FRA','ITA','CAN')" },
  { term: '东盟 东南亚', means: "东盟十国：code IN ('BRN','KHM','IDN','LAO','MYS','MMR','PHL','SGP','THA','VNM')" },
  { term: '欧盟 欧洲联盟', means: "汇总口径 code = 'EUU'" },
  { term: '中日韩 东亚三国', means: "code IN ('CHN','JPN','KOR')" },
  { term: '中美', means: "code IN ('CHN','USA')" },
  { term: '发达国家 富国 高收入国家', means: "世界银行没有“发达国家”口径，用高收入国家近似：单个国家用 countries.income = '高收入国家'，整体用汇总口径 code = 'HIC'" },
  { term: '发展中国家 中低收入国家', means: "整体用汇总口径 code = 'LMY'（中低收入国家）；单个国家用 income IN ('中高等收入国家','中低等收入国家','低收入国家')" },
  { term: '中国 内地', means: "code = 'CHN'。世界银行的中国数据不含香港（HKG）、澳门（MAC）" },
  { term: '最新 现在 目前 最近', means: `指这个指标有数据的最近一年，各国可能不同。单个国家用 ORDER BY year DESC LIMIT 1 且该列 IS NOT NULL；多国排名先取 MAX(year) WHERE 该列 IS NOT NULL（数据范围到 ${LAST_YEAR} 年）` },
  { term: '过去 近 年来 这些年 历年 变化 趋势', means: `“过去 N 年”指 year > ${LAST_YEAR} - N。趋势题按 year 升序返回多行，适合画折线` },
  { term: '排名 最高 最低 前十 哪些国家', means: '排名只比较国家：JOIN countries 并加 is_aggregate = 0，排除空值，ORDER BY 后 LIMIT' },
  { term: '倍 差距 比例 占比 份额', means: '倍数、占比、差值在 SQL 里算出来，给结果列起清楚的名字（如 ratio、share_pct）' },
  { term: '什么时候 哪一年 首次 第一次 超过 跌破', means: '找第一个满足条件的年份：WHERE 条件 ORDER BY year LIMIT 1' },
  { term: '平均 均值', means: '对年份求平均用 AVG()，并在结果里带上起止年份；对国家求整体平均优先用汇总口径（如 WLD）' },
];
