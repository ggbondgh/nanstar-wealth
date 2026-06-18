function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function inferInstrumentType(symbol, name = "") {
  const text = `${symbol} ${name}`;
  if (/ETF/i.test(text) && /联接|连接/i.test(text)) return "fund";
  if (/ETF|LOF/i.test(text)) return "etf";
  if (/^\d{6}$/.test(symbol) && /^(510|511|512|513|515|516|517|518|588|159|162|163|164|165|166|168|169)/.test(symbol)) return "etf";
  if (/基金|混合|债券|货币|指数|QDII|FOF/.test(text)) return "fund";
  return /^\d{6}$/.test(symbol) ? "stock" : "fund";
}

function normalizeInstrumentType(type, symbol = "", name = "") {
  const current = String(type || "").trim();
  if (current === "cash" || current === "crypto") return current;
  const text = `${symbol || ""} ${name || ""}`;
  const inferred = inferInstrumentType(symbol, name || "");
  if (name || !current) return inferred;
  if (current === "fund" || current === "etf" || current === "stock") return current;
  if (/基金|混合|债券|货币|指数|联接|连接|QDII|FOF|ETF/i.test(text)) return inferred;
  return inferred;
}

function instrumentKey(symbol, type = "") {
  const normalizedSymbol = normalizeSymbol(symbol || "");
  const normalizedType = String(type || "").trim() || "fund";
  return normalizedSymbol ? `${normalizedType}:${normalizedSymbol}` : "";
}

function normalizeTransactionInstrument(tx) {
  if (!tx) return;
  tx.symbol = normalizeSymbol(tx.symbol || "");
  tx.type = normalizeInstrumentType(tx.type, tx.symbol, tx.name);
}

function getTransactionGross(tx) {
  const rawQuantity = number(tx.quantity);
  const price = number(tx.price);
  if (tx.inputMode === "amount") return rawQuantity;
  return rawQuantity * price;
}

function getTransactionShares(tx) {
  const rawQuantity = number(tx.quantity);
  const price = number(tx.price);
  if (tx.inputMode === "amount") return price > 0 ? rawQuantity / price : 0;
  return rawQuantity;
}

const tx = {
  symbol: "002611",
  name: "博时黄金ETF联接C",
  action: "buy",
  inputMode: "amount",
  quantity: 2000,
  price: 3.0827,
  fee: 0.1
};

const currentPrice = 2.953;
const shares = getTransactionShares(tx);
const cost = getTransactionGross(tx) + tx.fee;
const value = shares * currentPrice;
const pnl = value - cost;
const pnlRate = pnl / cost;

if (Math.abs(shares - 648.7826) > 0.01) {
  throw new Error(`Unexpected shares ${shares}`);
}

if (Math.abs(value - 1916.08) > 0.5) {
  throw new Error(`Unexpected market value ${value}`);
}

if (Math.abs(pnl - -84.02) > 0.5) {
  throw new Error(`Unexpected pnl ${pnl}`);
}

console.log(JSON.stringify({
  ok: true,
  shares: Number(shares.toFixed(4)),
  cost: Number(cost.toFixed(2)),
  value: Number(value.toFixed(2)),
  pnl: Number(pnl.toFixed(2)),
  pnlRate: Number((pnlRate * 100).toFixed(2))
}, null, 2));

const collisionTransactions = [
  {
    symbol: "002611",
    name: "博时黄金ETF联接C",
    type: "stock",
    action: "buy",
    inputMode: "amount",
    quantity: 2000,
    price: 3.0827,
    fee: 0.1,
    currency: "CNY"
  },
  {
    symbol: "002611",
    name: "东方精工",
    type: "stock",
    action: "buy",
    inputMode: "shares",
    quantity: 100,
    price: 18.47,
    fee: 0,
    currency: "CNY"
  }
];

collisionTransactions.forEach(normalizeTransactionInstrument);

if (collisionTransactions[0].type !== "fund") {
  throw new Error(`Expected fund type for 002611 fund, got ${collisionTransactions[0].type}`);
}

if (collisionTransactions[1].type !== "stock") {
  throw new Error(`Expected stock type for 002611 stock, got ${collisionTransactions[1].type}`);
}

const collisionKeys = new Set(collisionTransactions.map((item) => instrumentKey(item.symbol, item.type)));
if (collisionKeys.size !== 2) {
  throw new Error(`Expected separate instrument keys, got ${Array.from(collisionKeys).join(",")}`);
}

console.log(JSON.stringify({
  collisionOk: true,
  keys: Array.from(collisionKeys)
}, null, 2));
