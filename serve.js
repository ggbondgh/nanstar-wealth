const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const host = "127.0.0.1";
const port = Number(process.env.PORT || process.argv[2] || 4333);

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

const apiCache = new Map();
const upstreamTimeoutMs = 6000;

http
  .createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${host}:${port}`);
    const rawPath = decodeURIComponent(requestUrl.pathname);

    if (rawPath.startsWith("/api/")) {
      await handleApi(rawPath, requestUrl.searchParams, res);
      return;
    }

    const relPath = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
    const filePath = path.normalize(path.join(root, relPath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(error.code === "ENOENT" ? 404 : 500);
        res.end(error.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Cache-Control": "no-cache",
        "Content-Type": mime[ext] || "application/octet-stream",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'"
      });
      res.end(data);
    });
  })
  .listen(port, host, () => {
    console.log(`NanStar Wealth: http://${host}:${port}/index.html`);
  });

async function handleApi(rawPath, searchParams, res) {
  const parts = rawPath.split("/").filter(Boolean);
  if (parts[1] === "ocr") {
    sendJson(res, 501, {
      error: "OCR import is reserved but not enabled",
      status: "placeholder",
      next: "Upload screenshots can later be parsed here and returned as transaction rows for the existing import preview."
    });
    return;
  }

  if (parts[1] === "chart" && parts[2]) {
    try {
      const data = await getInstrumentChart(
        parts[2],
        searchParams.get("kind") || "",
        searchParams.get("range") || "daily"
      );
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Chart data unavailable" });
    }
    return;
  }

  if (parts[1] === "instrument" && parts[2]) {
    try {
      const data = await getInstrumentProfile(
        parts[2],
        searchParams.get("kind") || "",
        searchParams.get("date") || "",
        searchParams.get("time") || ""
      );
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Instrument data unavailable" });
    }
    return;
  }

  if (parts[1] === "search") {
    try {
      const data = await searchInstruments(searchParams.get("q") || "");
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Search unavailable" });
    }
    return;
  }

  if (parts[1] === "fund" && parts[2]) {
    try {
      const data = await getFundProfile(parts[2]);
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Fund data unavailable" });
    }
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

async function getInstrumentProfile(rawCode, kind = "", date = "", time = "") {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) throw new Error("Invalid code");

  if (kind === "stock") return getStockProfile(code);
  if (kind === "etf") return getStockProfile(code)
    .then((data) => ({ ...data, type: "etf" }))
    .catch(() => getFundProfile(code, date, time).then((data) => ({ ...data, type: "etf" })));
  if (kind === "fund") return getFundProfile(code, date, time);

  if (/^\d{6}$/.test(code)) {
    return getFundProfile(code, date, time).catch(() => getStockProfile(code));
  }

  return getStockProfile(code);
}

async function getInstrumentChart(rawCode, kind = "", range = "daily") {
  const code = String(rawCode || "").trim().toUpperCase();
  const normalizedRange = normalizeChartRange(range);
  if (!code) throw new Error("Invalid code");

  const cacheKey = `chart:${kind || "auto"}:${code}:${normalizedRange}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < getChartCacheTtl(normalizedRange)) return cached.data;

  const data = await fetchInstrumentChart(code, kind, normalizedRange);
  apiCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}

async function searchInstruments(query) {
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
    const isEtf = isEtfFundName(item.Name || "");
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
      type: isEtfFundName(item.name) ? "etf" : "fund",
      currency: "CNY",
      source: "eastmoney-fund-list",
      subtitle: item.category
    }));
}

function isEtfFundName(name) {
  return /ETF/i.test(name || "") && !/联接|连接/i.test(name || "");
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
  const type = market === 105 || /^[A-Z.]+$/.test(normalized) ? "stock" : "stock";
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
    type,
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

async function fetchInstrumentChart(code, kind, range) {
  const profile = await getInstrumentProfile(code, kind).catch(() => null);
  const fundOnly = kind === "fund" || (!kind && profile?.type === "fund");

  if (!fundOnly) {
    try {
      if (range === "intraday") {
        const intraday = await fetchEastmoneyIntraday(code);
        return {
          source: "eastmoney-trends",
          code: intraday.code || profile?.code || code,
          name: intraday.name || profile?.name || code,
          type: kind === "etf" ? "etf" : profile?.type || "stock",
          range,
          chartType: "line",
          currency: profile?.currency || "CNY",
          stats: intraday.stats,
          points: intraday.points
        };
      }

      const candles = await fetchEastmoneyKline(code, range);
      return {
        source: "eastmoney-kline",
        code: candles.code || profile?.code || code,
        name: candles.name || profile?.name || code,
        type: kind === "etf" ? "etf" : profile?.type || "stock",
        range,
        chartType: "candlestick",
        currency: profile?.currency || "CNY",
        stats: candles.stats,
        points: candles.points
      };
    } catch (error) {
      if (kind === "stock") throw error;
    }
  }

  const fundProfile = profile || await getFundProfile(code);
  const points = compressFundTrendForRange(fundProfile.trend || [], range);
  const firstPoint = points.length ? points[0] : null;
  const latestPoint = points.length ? points[points.length - 1] : null;
  const latestValue = numberOrNull(latestPoint?.value) ?? numberOrNull(fundProfile.nav);
  const openValue = numberOrNull(firstPoint?.value);
  const change = Number.isFinite(latestValue) && Number.isFinite(openValue) ? latestValue - openValue : null;
  return {
    source: range === "intraday" ? "eastmoney-fund-recent-nav" : "eastmoney-fund-trend",
    code: fundProfile.code || code,
    name: fundProfile.name || code,
    type: fundProfile.type || "fund",
    range,
    chartType: "line",
    currency: fundProfile.currency || "CNY",
    stats: {
      latest: latestValue,
      open: openValue,
      high: maxNumber(points.map((point) => point.value)),
      low: minNumber(points.map((point) => point.value)),
      change,
      changePct: Number.isFinite(change) && openValue ? (change / openValue) * 100 : numberOrNull(fundProfile.estimatedChangePct),
      latestDate: fundProfile.navDate || (latestPoint ? latestPoint.date : "")
    },
    points
  };
}

async function fetchEastmoneyIntraday(code) {
  const candidates = stockSecidCandidates(code);
  for (const secid of candidates) {
    const url = `https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&iscca=0&ndays=1`;
    const data = await fetchJsonFromUpstream(url).catch(() => null);
    if (data?.rc === 0 && data.data?.trends?.length) return parseIntradayPayload(data.data);
  }
  throw new Error("Intraday chart not found");
}

async function fetchEastmoneyKline(code, range) {
  const candidates = stockSecidCandidates(code);
  const klt = range === "weekly" ? "102" : range === "monthly" ? "103" : "101";
  const lmt = range === "monthly" ? 180 : range === "weekly" ? 220 : 260;
  for (const secid of candidates) {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${klt}&fqt=1&end=20500101&lmt=${lmt}`;
    const data = await fetchJsonFromUpstream(url).catch(() => null);
    if (data?.rc === 0 && data.data?.klines?.length) return parseKlinePayload(data.data);
  }
  throw new Error("K-line chart not found");
}

function parseIntradayPayload(payload) {
  const points = (payload.trends || []).map((row) => {
    const fields = String(row).split(",");
    return {
      time: fields[0] || "",
      open: numberOrNull(fields[1]),
      value: numberOrNull(fields[2]),
      high: numberOrNull(fields[3]),
      low: numberOrNull(fields[4]),
      volume: numberOrNull(fields[5]),
      amount: numberOrNull(fields[6]),
      average: numberOrNull(fields[7])
    };
  }).filter((point) => Number.isFinite(point.value));

  const latest = points.length ? points[points.length - 1] : null;
  const first = points.length ? points[0] : null;
  const previousClose = numberOrNull(payload.preClose);
  const open = numberOrNull(first?.open) ?? numberOrNull(first?.value);
  const latestValue = numberOrNull(latest?.value);
  const baseline = Number.isFinite(previousClose) && previousClose > 0 ? previousClose : open;
  const change = Number.isFinite(latestValue) && Number.isFinite(baseline) ? latestValue - baseline : null;
  return {
    code: payload.code || "",
    name: payload.name || "",
    points,
    stats: {
      latest: latestValue,
      open,
      previousClose,
      high: maxNumber(points.map((point) => point.high)),
      low: minNumber(points.map((point) => point.low)),
      change,
      changePct: Number.isFinite(change) && baseline ? (change / baseline) * 100 : null,
      average: latest?.average ?? null,
      volume: sumNumber(points.map((point) => point.volume)),
      latestDate: latest?.time || ""
    }
  };
}

function parseKlinePayload(payload) {
  const points = (payload.klines || []).map((row) => {
    const fields = String(row).split(",");
    return {
      date: fields[0] || "",
      open: numberOrNull(fields[1]),
      close: numberOrNull(fields[2]),
      high: numberOrNull(fields[3]),
      low: numberOrNull(fields[4]),
      volume: numberOrNull(fields[5]),
      amount: numberOrNull(fields[6]),
      amplitudePct: numberOrNull(fields[7]),
      changePct: numberOrNull(fields[8]),
      change: numberOrNull(fields[9]),
      turnoverPct: numberOrNull(fields[10])
    };
  }).filter((point) => Number.isFinite(point.close) && Number.isFinite(point.high) && Number.isFinite(point.low));

  const latest = points.length ? points[points.length - 1] : null;
  return {
    code: payload.code || "",
    name: payload.name || "",
    points,
    stats: {
      latest: latest?.close ?? null,
      open: latest?.open ?? null,
      high: latest?.high ?? null,
      low: latest?.low ?? null,
      volume: latest?.volume ?? null,
      amount: latest?.amount ?? null,
      change: latest?.change ?? null,
      changePct: latest?.changePct ?? null,
      latestDate: latest?.date || ""
    }
  };
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 NanStar-Wealth/0.1",
      "Referer": "https://fund.eastmoney.com/"
    }
  }).catch((error) => {
    if (error?.name === "AbortError") throw new Error("Upstream timeout");
    throw error;
  }).finally(() => clearTimeout(timeout));
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

function normalizeChartRange(range) {
  if (["intraday", "daily", "weekly", "monthly"].includes(range)) return range;
  return "daily";
}

function getChartCacheTtl(range) {
  return range === "intraday" ? 20 * 1000 : 10 * 60 * 1000;
}

function compressFundTrendForRange(trend, range) {
  if (!Array.isArray(trend) || !trend.length) return [];
  if (range === "weekly") return compressByPeriod(trend, (date) => weekKey(date));
  if (range === "monthly") return compressByPeriod(trend, (date) => String(date || "").slice(0, 7));
  if (range === "intraday") return trend.slice(-120);
  return trend.slice(-260);
}

function compressByPeriod(trend, getKey) {
  const rows = [];
  let currentKey = "";
  for (const point of trend) {
    const key = getKey(point.date);
    if (!key) continue;
    if (key !== currentKey) {
      rows.push({ ...point });
      currentKey = key;
    } else {
      rows[rows.length - 1] = { ...point };
    }
  }
  return rows.slice(-260);
}

function weekKey(rawDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate || "")) return "";
  const date = new Date(`${rawDate}T00:00:00`);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(`${date.getFullYear()}-01-01T00:00:00`);
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-${String(week).padStart(2, "0")}`;
}

function maxNumber(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? Math.max(...valid) : null;
}

function minNumber(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? Math.min(...valid) : null;
}

function sumNumber(values) {
  return values.reduce((sum, value) => Number.isFinite(value) ? sum + value : sum, 0);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(body));
}
