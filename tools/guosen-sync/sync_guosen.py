#!/usr/bin/env python3
"""Sync Guosen iQuant/GTrade account data into NanStar Wealth cloud state.

The script is intentionally conservative:
- no cookies or passwords
- local brokerage API only
- GET current Cloudflare state, merge, then PUT the full merged state
"""

import argparse
import builtins
import copy
import datetime as dt
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple


DEFAULT_CONFIG = {
    "account_id": "",
    "account_type": "stock",
    "cloud_state_url": "https://nanstar-wealth.pages.dev/api/state",
    "sync_token": "",
    "poll_seconds": 60,
    "dry_run": True,
    "push_transactions": True,
    "push_snapshots": True,
    "update_prices_from_positions": True,
    "max_orders": 100,
    "max_deals": 300,
    "user_agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
}

EMPTY_STATE = {
    "prices": {},
    "dayChangePct": {},
    "watchlist": [],
    "transactions": [],
    "brokerage": None,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Guosen account data to NanStar Wealth.")
    parser.add_argument("--config", default="config.json", help="Path to config JSON.")
    parser.add_argument("--once", action="store_true", help="Run one sync and exit.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without pushing.")
    parser.add_argument("--sample", help="Read brokerage snapshot JSON instead of Guosen API.")
    parser.add_argument("--write-state", help="Write merged state JSON to this path.")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    if args.dry_run:
        config["dry_run"] = True

    while True:
        try:
            summary = sync_once(config, sample_path=args.sample, write_state=args.write_state)
            print(json.dumps(summary, ensure_ascii=False, indent=2))
        except KeyboardInterrupt:
            return 130
        except Exception as exc:  # noqa: BLE001 - command line tool should report all failures.
            print(f"[guosen-sync] failed: {exc}", file=sys.stderr)
            if args.once or config.get("dry_run"):
                return 1

        if args.once or config.get("dry_run") or args.sample:
            return 0

        poll_seconds = max(15, int(config.get("poll_seconds") or 60))
        time.sleep(poll_seconds)


def load_config(path: Path) -> Dict[str, Any]:
    config = copy.deepcopy(DEFAULT_CONFIG)
    if path.exists():
        with path.open("r", encoding="utf-8-sig") as handle:
            loaded = json.load(handle)
        if not isinstance(loaded, dict):
            raise ValueError(f"Config must be a JSON object: {path}")
        config.update(loaded)
    else:
        print(f"[guosen-sync] config not found, using defaults: {path}", file=sys.stderr)

    config["account_id"] = str(config.get("account_id") or "").strip()
    config["account_type"] = str(config.get("account_type") or "stock").strip() or "stock"
    config["cloud_state_url"] = str(config.get("cloud_state_url") or "").strip()
    config["sync_token"] = str(config.get("sync_token") or "").strip()

    if not config["cloud_state_url"]:
        raise ValueError("cloud_state_url is required")
    if not config["sync_token"]:
        raise ValueError("sync_token is required")
    if not config["account_id"]:
        raise ValueError("account_id is required")
    return config


def sync_once(config: Dict[str, Any], sample_path: Optional[str] = None, write_state: Optional[str] = None) -> Dict[str, Any]:
    snapshot = load_sample_snapshot(Path(sample_path)) if sample_path else fetch_guosen_snapshot(config)
    current_state, remote_updated_at = fetch_cloud_state(config)
    merged_state, merge_summary = merge_state(current_state, snapshot, config)

    if write_state:
        Path(write_state).write_text(json.dumps(merged_state, ensure_ascii=False, indent=2), encoding="utf-8")

    pushed = False
    pushed_updated_at = None
    if not config.get("dry_run"):
        pushed_updated_at = push_cloud_state(config, merged_state)
        pushed = True

    return {
        "dryRun": bool(config.get("dry_run")),
        "remoteUpdatedAt": remote_updated_at,
        "pushed": pushed,
        "pushedUpdatedAt": pushed_updated_at,
        **merge_summary,
    }


def fetch_guosen_snapshot(config: Dict[str, Any]) -> Dict[str, Any]:
    get_trade_detail_data = find_guosen_trade_function()
    account_id = config["account_id"]
    account_type = config["account_type"]

    def query(kind: str) -> List[Any]:
        try:
            data = get_trade_detail_data(account_id, account_type, kind)
        except TypeError:
            data = get_trade_detail_data(accountID=account_id, accountType=account_type, dataType=kind)
        if data is None:
            return []
        if isinstance(data, list):
            return data
        if isinstance(data, tuple):
            return list(data)
        return [data]

    return {
        "provider": "guosen",
        "accountId": account_id,
        "accountType": account_type,
        "fetchedAt": now_iso(),
        "accounts": query("ACCOUNT"),
        "positions": query("POSITION"),
        "orders": query("ORDER"),
        "deals": query("DEAL"),
    }


def find_guosen_trade_function() -> Callable[..., Any]:
    candidate = getattr(builtins, "get_trade_detail_data", None)
    if callable(candidate):
        return candidate

    main_module = sys.modules.get("__main__")
    candidate = getattr(main_module, "get_trade_detail_data", None) if main_module else None
    if callable(candidate):
        return candidate

    for module_name in ("iQuant", "iquant", "gtrade"):
        try:
            module = __import__(module_name)
        except Exception:
            continue
        candidate = getattr(module, "get_trade_detail_data", None)
        if callable(candidate):
            return candidate

    raise RuntimeError(
        "Guosen API function get_trade_detail_data is unavailable. "
        "Run this script inside the Guosen iQuant/GTrade Python environment."
    )


def load_sample_snapshot(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("Sample snapshot must be a JSON object")
    data.setdefault("provider", "guosen")
    data.setdefault("fetchedAt", now_iso())
    return data


def fetch_cloud_state(config: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[str]]:
    request = urllib.request.Request(
        config["cloud_state_url"],
        headers=cloud_headers(config),
        method="GET",
    )
    data = request_json(request)
    if not isinstance(data, dict):
        raise ValueError("Cloud state response is not a JSON object")
    state = data.get("state") or copy.deepcopy(EMPTY_STATE)
    if not isinstance(state, dict):
        state = copy.deepcopy(EMPTY_STATE)
    return ensure_state(state), data.get("updatedAt")


def push_cloud_state(config: Dict[str, Any], state: Dict[str, Any]) -> Optional[str]:
    payload = json.dumps({"state": state}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        config["cloud_state_url"],
        data=payload,
        headers={
            **cloud_headers(config),
            "Content-Type": "application/json; charset=utf-8",
        },
        method="PUT",
    )
    data = request_json(request)
    if not isinstance(data, dict) or not data.get("ok"):
        raise ValueError(f"Cloud state push failed: {data}")
    return data.get("updatedAt")


def request_json(request: urllib.request.Request) -> Any:
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc


def cloud_headers(config: Dict[str, Any]) -> Dict[str, str]:
    return {
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "User-Agent": str(config.get("user_agent") or DEFAULT_CONFIG["user_agent"]),
        "x-nanstar-sync-token": config["sync_token"],
    }


def merge_state(current_state: Dict[str, Any], snapshot: Dict[str, Any], config: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    state = ensure_state(copy.deepcopy(current_state))
    account_id = str(snapshot.get("accountId") or config.get("account_id") or "")
    account_type = str(snapshot.get("accountType") or config.get("account_type") or "stock")
    fetched_at = str(snapshot.get("fetchedAt") or now_iso())
    max_orders = int(config.get("max_orders") or 100)
    max_deals = int(config.get("max_deals") or 300)

    accounts = [normalize_account(row) for row in rows(snapshot.get("accounts"))]
    positions = [normalize_position(row) for row in rows(snapshot.get("positions"))]
    orders = [normalize_order(row) for row in rows(snapshot.get("orders"))]
    deals = [normalize_deal(row) for row in rows(snapshot.get("deals"))]

    accounts = [item for item in accounts if item]
    positions = [item for item in positions if item.get("symbol") or item.get("name")]
    orders = [item for item in orders if item.get("symbol") or item.get("orderId")]
    deals = [item for item in deals if item.get("symbol") or item.get("dealId")]

    for item in accounts + positions + orders + deals:
        item["accountIdMasked"] = mask_account_id(account_id)

    added_transactions = 0
    if config.get("push_transactions", True):
        transactions = list(state.get("transactions") or [])
        existing_ids = {str(tx.get("id")) for tx in transactions if isinstance(tx, dict) and tx.get("id")}
        for deal in deals:
            tx = deal_to_transaction(deal, account_id)
            if not tx or tx["id"] in existing_ids:
                continue
            transactions.append(tx)
            existing_ids.add(tx["id"])
            added_transactions += 1
        state["transactions"] = sorted(transactions, key=lambda tx: f"{tx.get('date', '')} {tx.get('time', '')} {tx.get('id', '')}")

    updated_prices = 0
    if config.get("update_prices_from_positions", True):
        for position in positions:
            key = instrument_key(position.get("symbol"), position.get("type"))
            price = number(position.get("lastPrice")) or number(position.get("costPrice"))
            if key and price > 0:
                state["prices"][key] = price
                updated_prices += 1
            day_change_pct = nullable_number(position.get("dayChangePct"))
            if key and day_change_pct is not None:
                state["dayChangePct"][key] = day_change_pct

    if config.get("push_snapshots", True):
        state["brokerage"] = {
            "provider": "guosen",
            "source": "local-bridge",
            "accountType": account_type,
            "accountIdMasked": mask_account_id(account_id),
            "updatedAt": fetched_at,
            "accounts": accounts,
            "positions": positions,
            "orders": sorted(orders, key=lambda item: f"{item.get('date', '')} {item.get('time', '')}", reverse=True)[:max_orders],
            "deals": sorted(deals, key=lambda item: f"{item.get('date', '')} {item.get('time', '')}", reverse=True)[:max_deals],
        }

    return state, {
        "accountIdMasked": mask_account_id(account_id),
        "accounts": len(accounts),
        "positions": len(positions),
        "orders": len(orders),
        "deals": len(deals),
        "transactionsAdded": added_transactions,
        "pricesUpdated": updated_prices,
        "brokerageUpdatedAt": fetched_at,
    }


def ensure_state(state: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(state.get("prices"), dict):
        state["prices"] = {}
    if not isinstance(state.get("dayChangePct"), dict):
        state["dayChangePct"] = {}
    if not isinstance(state.get("watchlist"), list):
        state["watchlist"] = []
    if not isinstance(state.get("transactions"), list):
        state["transactions"] = []
    if "brokerage" not in state:
        state["brokerage"] = None
    return state


def normalize_account(row: Any) -> Dict[str, Any]:
    source = to_record(row)
    return compact_dict(
        {
            "totalAsset": field_number(source, ACCOUNT_TOTAL_ASSET),
            "cashBalance": field_number(source, ACCOUNT_CASH_BALANCE),
            "availableCash": field_number(source, ACCOUNT_AVAILABLE_CASH),
            "fetchableCash": field_number(source, ACCOUNT_FETCHABLE_CASH),
            "marketValue": field_number(source, ACCOUNT_MARKET_VALUE),
            "frozenCash": field_number(source, ACCOUNT_FROZEN_CASH),
            "pnl": field_number(source, ACCOUNT_PNL),
        }
    )


def normalize_position(row: Any) -> Dict[str, Any]:
    source = to_record(row)
    symbol = normalize_symbol(field_text(source, SYMBOL_KEYS))
    name = field_text(source, NAME_KEYS)
    last_price = field_number(source, POSITION_LAST_PRICE)
    cost_price = field_number(source, POSITION_COST_PRICE)
    market_value = field_number(source, POSITION_MARKET_VALUE)
    quantity = field_number(source, POSITION_QUANTITY)
    pnl = field_number(source, POSITION_PNL)
    pnl_rate = field_number(source, POSITION_PNL_RATE)
    day_change_pct = field_number(source, POSITION_DAY_CHANGE_PCT)
    return compact_dict(
        {
            "symbol": symbol,
            "name": name,
            "type": infer_instrument_type(symbol, name),
            "quantity": quantity,
            "availableQuantity": field_number(source, POSITION_AVAILABLE_QUANTITY),
            "costPrice": cost_price,
            "lastPrice": last_price,
            "marketValue": market_value,
            "pnl": pnl,
            "pnlRate": normalize_ratio(pnl_rate),
            "dayChangePct": normalize_ratio(day_change_pct),
        }
    )


def normalize_order(row: Any) -> Dict[str, Any]:
    source = to_record(row)
    symbol = normalize_symbol(field_text(source, SYMBOL_KEYS))
    name = field_text(source, NAME_KEYS)
    return compact_dict(
        {
            "date": normalize_date(field_text(source, DATE_KEYS)),
            "time": normalize_time(field_text(source, TIME_KEYS)),
            "symbol": symbol,
            "name": name,
            "type": infer_instrument_type(symbol, name),
            "action": map_action(field_text(source, ACTION_KEYS)),
            "status": field_text(source, ORDER_STATUS_KEYS),
            "quantity": field_number(source, ORDER_QUANTITY),
            "tradedQuantity": field_number(source, ORDER_TRADED_QUANTITY),
            "price": field_number(source, PRICE_KEYS),
            "amount": field_number(source, AMOUNT_KEYS),
            "orderId": field_text(source, ORDER_ID_KEYS),
        }
    )


def normalize_deal(row: Any) -> Dict[str, Any]:
    source = to_record(row)
    symbol = normalize_symbol(field_text(source, SYMBOL_KEYS))
    name = field_text(source, NAME_KEYS)
    quantity = field_number(source, QUANTITY_KEYS)
    price = field_number(source, PRICE_KEYS)
    amount = field_number(source, AMOUNT_KEYS)
    if amount is None and quantity is not None and price is not None:
        amount = quantity * price
    return compact_dict(
        {
            "date": normalize_date(field_text(source, DATE_KEYS)),
            "time": normalize_time(field_text(source, TIME_KEYS)),
            "symbol": symbol,
            "name": name,
            "type": infer_instrument_type(symbol, name),
            "action": map_action(field_text(source, ACTION_KEYS)),
            "quantity": quantity,
            "price": price,
            "amount": amount,
            "fee": field_number(source, FEE_KEYS) or 0,
            "dealId": field_text(source, DEAL_ID_KEYS),
            "orderId": field_text(source, ORDER_ID_KEYS),
        }
    )


def deal_to_transaction(deal: Dict[str, Any], account_id: str) -> Optional[Dict[str, Any]]:
    action = deal.get("action")
    if action not in {"buy", "sell", "dividend", "deposit", "withdraw"}:
        return None

    symbol = normalize_symbol(deal.get("symbol"))
    tx_type = deal.get("type") or infer_instrument_type(symbol, deal.get("name") or "")
    quantity = number(deal.get("quantity"))
    price = number(deal.get("price"))
    amount = number(deal.get("amount"))

    if action in {"deposit", "withdraw", "dividend"}:
        symbol = "CASH"
        tx_type = "cash"
        quantity = amount or quantity
        price = 1
        input_mode = "amount"
    else:
        input_mode = "shares"

    if not symbol or (action in {"buy", "sell"} and quantity <= 0):
        return None

    date = deal.get("date") or now_iso()[:10]
    time_value = deal.get("time") or "15:00"
    basis = [
        "guosen",
        mask_account_id(account_id),
        date,
        time_value,
        symbol,
        action,
        quantity,
        price,
        amount,
        deal.get("dealId"),
        deal.get("orderId"),
    ]
    tx_id = "guosen-deal-" + stable_hash(basis)[:18]
    return {
        "id": tx_id,
        "date": date,
        "time": time_value,
        "action": action,
        "status": "confirmed",
        "symbol": symbol,
        "name": deal.get("name") or symbol,
        "type": tx_type,
        "account": "Guosen " + mask_account_id(account_id),
        "inputMode": input_mode,
        "quantity": round(quantity, 6),
        "price": round(price, 6),
        "fee": round(number(deal.get("fee")), 4),
        "currency": "CNY",
        "note": "Imported from Guosen local sync",
        "source": "guosen",
        "sourceId": deal.get("dealId") or deal.get("orderId") or tx_id,
    }


def rows(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def to_record(row: Any) -> Dict[str, Any]:
    if isinstance(row, dict):
        return {str(key).strip(): clean_value(value) for key, value in row.items()}

    record: Dict[str, Any] = {}
    for name in dir(row):
        if name.startswith("__"):
            continue
        try:
            value = getattr(row, name)
        except Exception:
            continue
        if callable(value):
            continue
        record[name] = clean_value(value)
    return record


def clean_value(value: Any) -> Any:
    if isinstance(value, bytes):
        for encoding in ("utf-8", "gbk", "gb18030"):
            try:
                return value.decode(encoding)
            except UnicodeDecodeError:
                continue
        return value.decode("utf-8", errors="replace")
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()
    return value


def field_text(source: Dict[str, Any], candidates: List[str]) -> str:
    value = field(source, candidates)
    if value is None:
        return ""
    return str(value).strip()


def field_number(source: Dict[str, Any], candidates: List[str]) -> Optional[float]:
    value = field(source, candidates)
    parsed = nullable_number(value)
    return parsed


def field(source: Dict[str, Any], candidates: List[str]) -> Any:
    if not source:
        return None
    normalized = {normalize_key(key): value for key, value in source.items()}
    for candidate in candidates:
        key = normalize_key(candidate)
        if key in normalized and normalized[key] not in (None, ""):
            return normalized[key]
    return None


def normalize_key(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", "").replace("-", "")


def nullable_number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        parsed = float(value)
        return parsed if parsed == parsed and parsed not in (float("inf"), float("-inf")) else None
    text = str(value).strip().replace(",", "").replace("%", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def number(value: Any) -> float:
    parsed = nullable_number(value)
    return parsed if parsed is not None else 0.0


def compact_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in data.items() if value not in (None, "")}


def normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def infer_instrument_type(symbol: str, name: str = "") -> str:
    text = f"{symbol} {name}"
    if "ETF" in text.upper() and not any(word in text for word in ("联接", "连接")):
        return "etf"
    if symbol.isdigit() and len(symbol) == 6 and symbol.startswith(
        ("510", "511", "512", "513", "515", "516", "517", "518", "588", "159", "162", "163", "164", "165", "166", "168", "169")
    ):
        return "etf"
    if any(word in text for word in ("基金", "混合", "债券", "货币", "指数", "QDII", "FOF", "联接", "连接")):
        return "fund"
    return "stock" if symbol.isdigit() and len(symbol) == 6 else "fund"


def instrument_key(symbol: Any, instrument_type: Any) -> str:
    symbol_text = normalize_symbol(symbol)
    type_text = str(instrument_type or "fund").strip() or "fund"
    return f"{type_text}:{symbol_text}" if symbol_text else ""


def normalize_ratio(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    if abs(value) > 1:
        return value / 100
    return value


def normalize_date(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) >= 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    return text[:10]


def normalize_time(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if ":" in text:
        parts = text.split(":")
        if len(parts) >= 2:
            return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) >= 4:
        return f"{digits[:2]}:{digits[2:4]}"
    return text


def map_action(value: str) -> str:
    text = str(value or "").strip().upper()
    if any(word in text for word in ("红利", "股息", "分红", "利息", "DIVIDEND")):
        return "dividend"
    if any(word in text for word in ("转入", "入金", "DEPOSIT")):
        return "deposit"
    if any(word in text for word in ("转出", "出金", "WITHDRAW")):
        return "withdraw"
    if text in {"B", "BUY"} or any(word in text for word in ("买", "BUY")):
        return "buy"
    if text in {"S", "SELL"} or any(word in text for word in ("卖", "SELL")):
        return "sell"
    return ""


def mask_account_id(account_id: str) -> str:
    text = str(account_id or "").strip()
    if len(text) <= 4:
        return "****" + text
    return "****" + text[-4:]


def stable_hash(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


SYMBOL_KEYS = [
    "symbol",
    "code",
    "stock_code",
    "instrument_id",
    "security_code",
    "证券代码",
    "合约代码",
    "m_strInstrumentID",
    "m_strSecurityID",
    "m_strStockCode",
]
NAME_KEYS = [
    "name",
    "stock_name",
    "instrument_name",
    "security_name",
    "证券名称",
    "合约名称",
    "m_strInstrumentName",
    "m_strSecurityName",
    "m_strStockName",
]
DATE_KEYS = ["date", "trade_date", "order_date", "成交日期", "委托日期", "m_strTradeDate", "m_strOrderDate", "m_nTradeDate", "m_nOrderDate"]
TIME_KEYS = ["time", "trade_time", "order_time", "成交时间", "委托时间", "m_strTradeTime", "m_strOrderTime", "m_nTradeTime", "m_nOrderTime"]
ACTION_KEYS = ["action", "direction", "business_name", "买卖方向", "业务名称", "m_strDirection", "m_nDirection", "m_strBusinessName"]
PRICE_KEYS = ["price", "deal_price", "trade_price", "成交价格", "委托价格", "m_dPrice", "m_dTradePrice", "m_dLimitPrice"]
QUANTITY_KEYS = ["quantity", "volume", "deal_volume", "成交数量", "成交股数", "m_nVolume", "m_nTradeVolume", "m_dVolume"]
AMOUNT_KEYS = ["amount", "deal_amount", "trade_amount", "成交金额", "发生金额", "m_dAmount", "m_dTradeAmount", "m_dBalance"]
FEE_KEYS = ["fee", "commission", "费用", "手续费", "佣金", "m_dCommission", "m_dFee", "m_dCommisson"]
DEAL_ID_KEYS = ["deal_id", "trade_id", "成交编号", "m_strTradeID", "m_strDealID"]
ORDER_ID_KEYS = ["order_id", "order_sys_id", "委托编号", "合同编号", "m_strOrderSysID", "m_strOrderID", "m_strOrderRef"]
ORDER_STATUS_KEYS = ["status", "order_status", "委托状态", "m_strOrderStatus", "m_nOrderStatus"]
ORDER_QUANTITY = ["order_quantity", "quantity", "委托数量", "m_nVolumeTotalOriginal", "m_nVolume", "m_dVolume"]
ORDER_TRADED_QUANTITY = ["traded_quantity", "deal_volume", "成交数量", "m_nVolumeTraded", "m_nTradeVolume"]

ACCOUNT_TOTAL_ASSET = ["total_asset", "asset", "总资产", "m_dTotalAsset", "m_dAsset", "m_dAssetBalance", "m_dAssureAsset"]
ACCOUNT_CASH_BALANCE = ["cash_balance", "balance", "资金余额", "m_dBalance"]
ACCOUNT_AVAILABLE_CASH = ["available_cash", "available", "可用资金", "m_dAvailable"]
ACCOUNT_FETCHABLE_CASH = ["fetchable_cash", "fetchable", "可取资金", "m_dFetchBalance"]
ACCOUNT_MARKET_VALUE = ["market_value", "instrument_value", "证券市值", "持仓市值", "m_dMarketValue", "m_dInstrumentValue"]
ACCOUNT_FROZEN_CASH = ["frozen_cash", "冻结资金", "m_dFrozenCash", "m_dFrozenMargin"]
ACCOUNT_PNL = ["pnl", "position_profit", "浮动盈亏", "持仓盈亏", "m_dPositionProfit", "m_dProfit"]

POSITION_QUANTITY = ["quantity", "volume", "持仓数量", "证券数量", "m_nVolume", "m_dVolume"]
POSITION_AVAILABLE_QUANTITY = ["available_quantity", "can_use_volume", "可用数量", "可卖数量", "m_nCanUseVolume", "m_dCanUseVolume"]
POSITION_COST_PRICE = ["cost_price", "open_price", "成本价", "持仓成本", "m_dSingleCost", "m_dAvgOpenPrice", "m_dOpenPrice", "m_dCostPrice"]
POSITION_LAST_PRICE = ["last_price", "price", "最新价", "现价", "m_dLastPrice", "m_dPrice"]
POSITION_MARKET_VALUE = ["market_value", "市值", "持仓市值", "m_dMarketValue", "m_dInstrumentValue"]
POSITION_PNL = ["pnl", "profit", "持仓盈亏", "浮动盈亏", "m_dPositionProfit", "m_dFloatProfit", "m_dProfit"]
POSITION_PNL_RATE = ["pnl_rate", "profit_rate", "盈亏比例", "盈亏率", "m_dProfitRate"]
POSITION_DAY_CHANGE_PCT = ["day_change_pct", "涨跌幅", "今日涨幅", "m_dProfitRatio", "m_dRiseRatio"]


if __name__ == "__main__":
    raise SystemExit(main())
