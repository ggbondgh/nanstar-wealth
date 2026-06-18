const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const start = script.indexOf("function selectBestImportCandidate(candidates)");
const end = script.indexOf("function showImportPreview(rows");

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Unable to locate import parser block in script.js");
}

const parserSource = script.slice(start, end);
const sandbox = {
  console,
  TextDecoder,
  normalizeSymbol: (value) => String(value || "").trim().toUpperCase(),
  actionNames: {
    buy: "买入",
    sell: "卖出",
    dividend: "分红",
    deposit: "转入",
    withdraw: "转出",
    bonus: "活动"
  },
  escapeHtml: (value) => String(value ?? ""),
  money: (value) => `¥${Number(value || 0).toFixed(2)}`,
  formatNumber: (value) => Number(value || 0).toFixed(2),
  formatChartPrice: (value) => Number(value || 0).toFixed(3),
  transactionSignature: (tx) => [
    tx.date || "",
    tx.time || "",
    tx.action || "",
    String(tx.symbol || "").toUpperCase(),
    String(tx.type || "fund"),
    tx.inputMode || "",
    Number(tx.quantity || 0).toFixed(4),
    Number(tx.price || 0).toFixed(4),
    Number(tx.fee || 0).toFixed(2)
  ].join("|"),
  hashString: (value) => {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
};

vm.createContext(sandbox);
vm.runInContext(`${parserSource}
globalThis.parseDelimitedText = parseDelimitedText;
globalThis.extractImportRowsFromText = extractImportRowsFromText;
globalThis.decodeImportBuffer = decodeImportBuffer;
globalThis.selectBestImportCandidate = selectBestImportCandidate;
globalThis.buildImportPreview = buildImportPreview;
`, sandbox);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseText(text) {
  const rows = sandbox.extractImportRowsFromText(text);
  return sandbox.buildImportPreview(rows, "测试").rows;
}

const withHeader = parseText([
  "成交日期\t成交时间\t买卖方向\t证券代码\t证券名称\t成交金额\t成交均价\t成交数量\t佣金\t印花税\t过户费\t成交状态\t资金账号",
  "2026-03-23\t15:01\t买入\t002611.OF\t博时黄金ETF联接C\t2000\t3.0827\t648.7826\t0.10\t0\t0\t已成交\t主账户",
  "2026-04-10\t10:30\t证券买入\tSH600519\t贵州茅台\t15000\t1500\t10\t5\t0\t0.20\t已成交\t股票账户",
  "2026-04-11\t09:40\t证券买入\tSZ000001\t平安银行\t1000\t10\t100\t1\t0\t0\t撤单\t股票账户"
].join("\n"));

assert(withHeader.length === 3, "header sample should parse three rows");
assert(withHeader[0].tx.symbol === "002611", "fund code suffix should be normalized");
assert(withHeader[0].tx.type === "fund", "ETF linked fund should stay fund");
assert(withHeader[1].tx.symbol === "600519", "prefixed stock code should be normalized");
assert(withHeader[1].tx.fee === 5.2, "split stock fees should be summed");
assert(withHeader[2].tx.status === "failed", "cancelled order should be saved as failed");

const noHeader = parseText([
  "2026/05/12 14:20 买入 510300 沪深300ETF 11700 3.9 3000 1.2",
  "2026-05-13 15:01 申购 002611 博时黄金ETF联接C 2000 3.1000 645.16 0"
].join("\n"));

assert(noHeader.length === 2, "no-header text should keep first row");
assert(noHeader[0].tx.symbol === "510300", "no-header ETF code should parse");
assert(noHeader[0].tx.name === "沪深300ETF", "no-header ETF name should parse");
assert(noHeader[0].tx.type === "etf", "510300 should infer ETF");
assert(noHeader[0].tx.fee === 1.2, "no-header fee should parse");
assert(noHeader[1].tx.type === "fund", "ETF linked fund name should infer fund");

const realXlsPath = "C:/Users/DELL/Desktop/table.xls";
let realSummary = null;
if (fs.existsSync(realXlsPath)) {
  const bytes = fs.readFileSync(realXlsPath);
  const textRows = sandbox.extractImportRowsFromText(sandbox.decodeImportBuffer(bytes));
  const best = sandbox.selectBestImportCandidate([{ rows: textRows, label: "table.xls" }]);
  const parsed = sandbox.buildImportPreview(best.rows, best.label);
  const validRows = parsed.rows.filter((row) => row.valid && !row.ignored);
  const ignoredRows = parsed.rows.filter((row) => row.ignored);
  const grouped = parsed.rows.reduce((map, row) => {
    const key = row.ignored ? "ignored" : (row.valid ? row.tx.action : `invalid:${row.reason}`);
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  assert(best.label === "table.xls", "real xls text candidate should be selected");
  assert(parsed.rows.length === 66, `real xls should parse 66 rows, got ${parsed.rows.length}`);
  assert(validRows.length === 63, `real xls should import 63 rows, got ${validRows.length}`);
  assert(ignoredRows.length === 3, `real xls should ignore 3 non-cash rows, got ${ignoredRows.length}`);
  assert(grouped.buy === 25, "real xls buy rows should parse");
  assert(grouped.sell === 26, "real xls sell rows should parse");
  assert(grouped.deposit === 7, "real xls deposits should parse");
  assert(grouped.withdraw === 3, "real xls withdrawals/tax should parse");
  assert(grouped.dividend === 2, "real xls dividends/interest should parse");
  realSummary = { rows: parsed.rows.length, importable: validRows.length, ignored: ignoredRows.length, grouped };
}

console.log(JSON.stringify({
  ok: true,
  headerRows: withHeader.length,
  noHeaderRows: noHeader.length,
  realXls: realSummary
}, null, 2));
