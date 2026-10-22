// The data model of 问数: two tables, and what every column means.
// This file is the single source for the data download, the database build, the model's prompt
// and the retrieval index, so a column is described once and the same way everywhere.

export const FIRST_YEAR = 1990;
export const LAST_YEAR = 2024;

// One column per World Bank indicator in the `stats` table.
// name: the business definition (口径) shown to people and to the model; unit: how to read the number.
export const INDICATORS = [
  { column: 'gdp_usd', code: 'NY.GDP.MKTP.CD', name: 'GDP（现价美元）', unit: '美元', note: '按当年价格和当年汇率折算。跨年比较会受通胀和汇率影响；比较实际增长用 gdp_growth_pct', terms: '国内生产总值 经济总量 经济规模 GDP 总量' },
  { column: 'gdp_per_capita_usd', code: 'NY.GDP.PCAP.CD', name: '人均 GDP（现价美元）', unit: '美元', note: '按当年价格和汇率折算', terms: '人均国内生产总值 人均收入 富裕程度 人均 GDP' },
  { column: 'gdp_growth_pct', code: 'NY.GDP.MKTP.KD.ZG', name: 'GDP 增长率（不变价）', unit: '%', note: '扣除价格因素后的实际增长，年度同比', terms: '经济增长 增速 增长率 实际增长' },
  { column: 'population', code: 'SP.POP.TOTL', name: '人口总数', unit: '人', note: '年中人口', terms: '人口 人数 人口规模' },
  { column: 'life_expectancy', code: 'SP.DYN.LE00.IN', name: '出生时预期寿命', unit: '岁', note: '', terms: '寿命 预期寿命 平均寿命 长寿' },
  { column: 'urban_pct', code: 'SP.URB.TOTL.IN.ZS', name: '城镇人口占比', unit: '%', note: '', terms: '城镇化 城市化 城镇化率 城市人口' },
  { column: 'fertility_rate', code: 'SP.DYN.TFRT.IN', name: '总和生育率', unit: '每名女性生育数', note: '低于 2.1 意味着人口长期会减少', terms: '生育率 出生 生孩子 少子化' },
  { column: 'age65_pct', code: 'SP.POP.65UP.TO.ZS', name: '65 岁及以上人口占比', unit: '%', note: '超过 14% 通常称为深度老龄化，超过 21% 称为超级老龄化', terms: '老龄化 老年人口 养老 老人' },
  { column: 'exports_pct_gdp', code: 'NE.EXP.GNFS.ZS', name: '货物和服务出口占 GDP 比例', unit: '%', note: '', terms: '出口 外需 出口依存度' },
  { column: 'trade_pct_gdp', code: 'NE.TRD.GNFS.ZS', name: '贸易额占 GDP 比例', unit: '%', note: '进出口之和除以 GDP，可能超过 100%', terms: '贸易 进出口 开放程度 外贸依存度' },
  { column: 'inflation_pct', code: 'FP.CPI.TOTL.ZG', name: '通货膨胀率（CPI）', unit: '%', note: '消费者价格指数年度变化', terms: '通胀 物价 CPI 通货膨胀' },
  { column: 'unemployment_pct', code: 'SL.UEM.TOTL.ZS', name: '失业率（国际劳工组织模拟估计）', unit: '%', note: '口径统一的估计值，可能与各国官方公布数不同', terms: '失业 就业 失业率' },
  { column: 'rnd_pct_gdp', code: 'GB.XPD.RSDV.GD.ZS', name: '研发支出占 GDP 比例', unit: '%', note: '很多国家只有部分年份', terms: '研发 科研投入 创新 R&D' },
  { column: 'internet_pct', code: 'IT.NET.USER.ZS', name: '使用互联网的人口占比', unit: '%', note: '', terms: '互联网 上网 网民 数字化' },
  { column: 'co2_per_capita_t', code: 'EN.GHG.CO2.PC.CE.AR5', name: '人均二氧化碳排放（不含土地利用）', unit: '吨二氧化碳当量', note: '', terms: '碳排放 二氧化碳 排放 碳 气候' },
  { column: 'renewable_energy_pct', code: 'EG.FEC.RNEW.ZS', name: '可再生能源占最终能源消费比例', unit: '%', note: '最新年份通常滞后两三年', terms: '可再生能源 清洁能源 新能源 绿色能源' },
  { column: 'tertiary_enrollment_pct', code: 'SE.TER.ENRR', name: '高等教育毛入学率', unit: '%', note: '毛入学率可能超过 100%', terms: '大学 高等教育 入学率 教育' },
];

export const TABLES = [
  {
    name: 'countries',
    about: '国家和地区，以及世界银行的汇总口径（世界、收入组、地区）',
    columns: [
      ['code', 'TEXT', '三位代码，主键。例：CHN 中国、USA 美国、WLD 世界、HIC 高收入国家'],
      ['name', 'TEXT', '中文名（世界银行官方译名，例：俄罗斯联邦、大韩民国）'],
      ['name_en', 'TEXT', '英文名'],
      ['region', 'TEXT', '所属地区（中文）。汇总口径为空'],
      ['income', 'TEXT', '收入组（中文）：高收入国家、中高等收入国家、中低等收入国家、低收入国家。汇总口径为空'],
      ['is_aggregate', 'INTEGER', '1 表示汇总口径（如世界、欧盟），0 表示国家或地区。比较国家时要加 is_aggregate = 0'],
    ],
  },
  {
    name: 'stats',
    about: `每个国家或汇总口径每年一行，${FIRST_YEAR}–${LAST_YEAR} 年。缺数据的格子是 NULL`,
    columns: [
      ['code', 'TEXT', '国家代码，对应 countries.code'],
      ['year', 'INTEGER', '年份'],
      ...INDICATORS.map((i) => [i.column, 'REAL', `${i.name}，单位：${i.unit}${i.note ? `。${i.note}` : ''}`]),
    ],
  },
];

export const COLUMN = Object.fromEntries(INDICATORS.map((i) => [i.column, i]));

// The schema as the model reads it.
export function schemaText() {
  return TABLES.map((t) => `表 ${t.name}：${t.about}\n${t.columns.map(([n, type, d]) => `  ${n} ${type} -- ${d}`).join('\n')}`).join('\n\n');
}
