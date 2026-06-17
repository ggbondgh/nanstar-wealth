const apiCache = new Map();

export async function getInstrumentProfile(rawCode, kind = "", date = "", time = "") {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) throw new Error("Invalid code");

  if (kind === "stock") return getStockProfile(code);
  if (kind === "etf" || kind === "fund") return getFundProfile(code, date, time);

  if (/^\d{6}$/.test(code)) {
    return getFundProfile(code, date, time).catch(() => getStockProfile(code));
  }

  return getStockProfile(code);
}

export async function searchInstruments(query) {
  const q = String(query || "").trim();
  if (!q) return { query: q, results: [] };

  const results = [];
  const seen = new Set();
  const add = (item) => {
    if (!item?.code || !item?.name) return;
    const key = `${item.type}:${item.code}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };

  if (/^\d{6}$/.test(q)) {
    await getInstrumentProfile(q).then((item) => add(normalizeSearchResult(item))).catch(() => null);
  }

  const suggestResults = await searchEastmoneySuggest(q).catch(() => []);
  suggestResults.forEach(add);

  if (results.length < 10) {
    const fundResults = await searchFundList(q).catch(() => []);
    fundResults.forEach(add);
  }

  return { query: q, results: results.slice(0, 12) };
}

async function searchEastmoneySuggest(query) {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(query)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=12`;
  const data = await fetchJsonFromUpstream(url);
  return (data?.QuotationCodeTable?.Data || []).map((item) => {
    const classify = String(item.Classify || "");
    const securityType = String(item.SecurityTypeName || "");
    const isFund = classify.includes("FUND") || securityType.includes("基金");
    const isEtf = /ETF/i.test(item.Name || "");
    return {
      code: String(item.Code || item.UnifiedCode || ""),
      symbol: String(item.Code || item.UnifiedCode || ""),
      name: String(item.Name || ""),
      type: isFund ? (isEtf ? "etf" : "fund") : "stock",
      currency: "CNY",
      source: "eastmoney-search",
      market: String(item.QuoteID || ""),
      subtitle: securityType || classify
    };
  }).filter((item) => item.code && item.name);
}

async function searchFundList(query) {
  const list = await getFundCodeList();
  const upper = query.toUpperCase();
  return list
    .filter((item) => item.code.includes(query) || item.name.includes(query) || item.pinyin.includes(upper))
    .slice(0, 12)
    .map((item) => ({
      code: item.code,
      symbol: item.code,
      name: item.name,
      type: /ETF/i.test(item.name) ? "etf" : "fund",
      currency: "CNY",
      source: "eastmoney-fund-list",
      subtitle: item.category
    }));
}

async function getFundCodeList() {
  const cacheKey = "fund-code-list";
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 24 * 60 * 60 * 1000) return cached.data;

  const text = await fetchText("https://fund.eastmoney.com/js/fundcode_search.js");
  const match = text.match(/var\s+r\s*=\s*(\[[\s\S]*\]);?/);
  if (!match) throw new Error("Fund list parse failed");
  const rows = JSON.parse(match[1]);
  const data = rows.map((row) => ({
    code: String(row[0] || ""),
    pinyin: String(row[1] || "").toUpperCase(),
    name: String(row[2] || ""),
    category: String(row[3] || "")
  })).filter((item) => item.code && item.name);
  apiCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}

function normalizeSearchResult(item) {
  return {
    code: item.code || item.symbol,
    symbol: item.symbol || item.code,
    name: item.name,
    type: item.type || "fund",
    currency: item.currency || "CNY",
    source: item.source || "instrument",
    subtitle: item.type || ""
  };
}

async function getFundProfile(rawCode, date = "", time = "") {
  const code = String(rawCode || "").replace(/\D/g, "").padStart(6, "0").slice(-6);
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid fund code");

  const cacheKey = `fund:${code}:${date || "latest"}:${time || ""}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) return cached.data;

  const [quote, profile] = await Promise.all([
    fetchFundQuote(code).catch(() => null),
    fetchEastmoneyFundProfile(code)
  ]);

  const data = {
    source: "eastmoney-fundgz",
    code,
    symbol: code,
    name: profile.name || quote?.name || code,
    type: "fund",
    currency: "CNY",
    navDate: quote?.navDate || profile.lastDate || "",
    nav: numberOrNull(quote?.nav) ?? numberOrNull(profile.lastNav),
    estimatedNav: numberOrNull(quote?.estimatedNav),
    estimatedChangePct: numberOrNull(quote?.estimatedChangePct),
    estimatedTime: quote?.estimatedTime || "",
    returns: profile.returns,
    trend: profile.trend
  };
  const historical = findTradeNav(profile.trend, date, time);
  if (historical) {
    data.priceOnDate = historical.value;
    data.priceDate = historical.date;
  }

  apiCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}

async function getStockProfile(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const cacheKey = `stock:${normalized}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 60 * 1000) return cached.data;

  const candidates = stockSecidCandidates(normalized);
  let payload = null;
  for (const secid of candidates) {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}&fields=f43,f57,f58,f59,f60,f86,f107,f169,f170`;
    const data = await fetchJsonFromUpstream(url).catch(() => null);
    if (data?.rc === 0 && data.data?.f58) {
      payload = data.data;
      break;
    }
  }

  if (!payload) throw new Error("Stock data not found");

  const market = Number(payload.f107);
  const currency = market === 105 ? "USD" : market === 116 ? "HKD" : "CNY";
  const priceBase = Number(payload.f59) || 2;
  const price = normalizeMarketNumber(payload.f43, priceBase);
  const previousClose = normalizeMarketNumber(payload.f60, priceBase);
  const changePct = normalizeMarketNumber(payload.f170, 2);
  const data = {
    source: "eastmoney-quote",
    code: String(payload.f57 || normalized),
    symbol: String(payload.f57 || normalized),
    name: String(payload.f58 || normalized),
    type: "stock",
    currency,
    price,
    previousClose,
    estimatedNav: null,
    estimatedChangePct: changePct,
    estimatedTime: payload.f86 ? new Date(Number(payload.f86) * 1000).toISOString().replace("T", " ").slice(0, 16) : "",
    returns: {},
    trend: []
  };

  apiCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}

async function fetchFundQuote(code) {
  const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
  const text = await fetchText(url);
  const match = text.match(/jsonpgz\((.*)\);?/);
  if (!match) throw new Error("Fund quote parse failed");
  const json = JSON.parse(match[1]);
  return {
    code: json.fundcode,
    name: json.name,
    navDate: json.jzrq,
    nav: json.dwjz,
    estimatedNav: json.gsz,
    estimatedChangePct: json.gszzl,
    estimatedTime: json.gztime
  };
}

async function fetchEastmoneyFundProfile(code) {
  const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;
  const text = await fetchText(url);
  const name = extractVarString(text, "fS_name");
  const trend = extractNetWorthTrend(text);
  return {
    name,
    returns: {
      oneMonth: numberOrNull(extractVarString(text, "syl_1y")),
      threeMonths: numberOrNull(extractVarString(text, "syl_3y")),
      sixMonths: numberOrNull(extractVarString(text, "syl_6y")),
      oneYear: numberOrNull(extractVarString(text, "syl_1n"))
    },
    trend,
    lastDate: trend.length ? trend[trend.length - 1].date : "",
    lastNav: trend.length ? trend[trend.length - 1].value : null
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 NanStar-Wealth/0.1",
      "Referer": "https://fund.eastmoney.com/"
    }
  });
  if (!response.ok) throw new Error(`Upstream ${response.status}`);
  return response.text();
}

async function fetchJsonFromUpstream(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function stockSecidCandidates(code) {
  if (/^\d{6}$/.test(code)) {
    const shPrefixes = ["5", "6", "9"];
    const market = shPrefixes.some((prefix) => code.startsWith(prefix)) ? "1" : "0";
    const alternate = market === "1" ? "0" : "1";
    return [`${market}.${code}`, `${alternate}.${code}`];
  }
  if (/^\d{5}$/.test(code)) return [`116.${code}`];
  return [`105.${code}`, `106.${code}`];
}

function normalizeMarketNumber(value, digits) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= -100000000) return null;
  return parsed / Math.pow(10, Number(digits) || 0);
}

function extractVarString(text, name) {
  const match = text.match(new RegExp(`var\\s+${name}\\s*=\\s*"([^"]*)"`, "m"));
  return match ? match[1] : "";
}

function extractNetWorthTrend(text) {
  const match = text.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]).map((point) => ({
      date: formatLocalDate(point.x),
      value: Number(point.y),
      equityReturn: Number(point.equityReturn || 0)
    })).filter((point) => Number.isFinite(point.value));
  } catch {
    return [];
  }
}

function formatLocalDate(timestamp) {
  const date = new Date(Number(timestamp));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function findTradeNav(trend, date, time = "") {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(trend) || !trend.length) return null;
  const afterCutoff = /^\d{2}:\d{2}/.test(time) && time.slice(0, 5) >= "15:00";
  if (afterCutoff) {
    const next = trend.find((point) => point.date > date);
    if (next) return next;
  }
  const sameOrNext = trend.find((point) => point.date >= date);
  if (sameOrNext) return sameOrNext;
  let found = null;
  for (const point of trend) {
    if (point.date <= date) found = point;
    else break;
  }
  return found;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
