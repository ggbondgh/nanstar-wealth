# NanStar Wealth Guosen iQuant local snapshot strategy.
#
# Usage:
# 1. Create a new iQuant Python strategy.
# 2. Paste this file content into the strategy.
# 3. Replace the account id and snapshot path placeholders below.
# 4. Run the strategy while iQuant/GTrade is logged in.
# 5. Keep tools/guosen-sync/start_snapshot_uploader.bat running on Windows.
#
# Easier: run setup_local_sync.bat on each Windows laptop. It generates
# local_iquant_snapshot_strategy.py with the correct path for that machine.

import datetime
import json


ACCOUNT_ID = "PUT_YOUR_GUOSEN_ACCOUNT_ID_HERE"
ACCOUNT_TYPE = "stock"
SNAPSHOT_PATH = r"PUT_YOUR_LOCAL_SNAPSHOT_PATH_HERE"
SNAPSHOT_INTERVAL_SECONDS = 60

QUERY_TYPES = {
    "accounts": ("account", "ACCOUNT"),
    "positions": ("position", "POSITION"),
    "orders": ("order", "ORDER", "entrust", "ENTRUST"),
    "deals": ("deal", "DEAL", "trade", "TRADE", "history_deal", "HISTORY_DEAL"),
}


def init(ContextInfo):
    ContextInfo.nanstar_last_snapshot_at = None
    try:
        ContextInfo.set_account(ACCOUNT_ID)
    except Exception as exc:
        print("[NanStar Snapshot] set_account failed:", repr(exc))
    print("[NanStar Snapshot] init, account =", ACCOUNT_ID)


def handlebar(ContextInfo):
    now = datetime.datetime.now()
    last = getattr(ContextInfo, "nanstar_last_snapshot_at", None)
    if last and (now - last).total_seconds() < SNAPSHOT_INTERVAL_SECONDS:
        return
    ContextInfo.nanstar_last_snapshot_at = now

    try:
        snapshot = {
            "provider": "guosen",
            "accountId": ACCOUNT_ID,
            "accountType": ACCOUNT_TYPE,
            "fetchedAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "accounts": query_any(QUERY_TYPES["accounts"]),
            "positions": query_any(QUERY_TYPES["positions"]),
            "orders": query_any(QUERY_TYPES["orders"]),
            "deals": query_any(QUERY_TYPES["deals"]),
        }
        with open(SNAPSHOT_PATH, "w", encoding="utf-8") as handle:
            json.dump(snapshot, handle, ensure_ascii=False, indent=2, default=str)
        print(
            "[NanStar Snapshot] ok:",
            "accounts =", len(snapshot["accounts"]),
            "positions =", len(snapshot["positions"]),
            "orders =", len(snapshot["orders"]),
            "deals =", len(snapshot["deals"]),
            "path =", SNAPSHOT_PATH,
        )
    except Exception as exc:
        print("[NanStar Snapshot] failed:", repr(exc))


def query_any(data_types):
    by_key = {}
    for data_type in data_types:
        try:
            rows = get_trade_detail_data(ACCOUNT_ID, ACCOUNT_TYPE, data_type)
        except Exception:
            continue
        for index, row in enumerate(rows or []):
            record = to_record(row)
            key = row_key(record) or "%s:%s" % (data_type, index)
            by_key[key] = record
    return list(by_key.values())


def row_key(record):
    fields = [
        record.get("m_strTradeID") or record.get("trade_id") or record.get("deal_id"),
        record.get("m_strOrderID") or record.get("m_strOrderSysID") or record.get("order_id"),
        record.get("m_strInstrumentID") or record.get("symbol"),
        record.get("m_nTradeDate") or record.get("m_strTradeDate") or record.get("date"),
        record.get("m_nTradeTime") or record.get("m_strTradeTime") or record.get("time"),
        record.get("m_nVolume") or record.get("quantity"),
        record.get("m_dPrice") or record.get("price"),
    ]
    key = "|".join(str(item or "") for item in fields)
    return key if key.strip("|") else ""


def to_record(row):
    if isinstance(row, dict):
        return {str(key): clean_value(value) for key, value in row.items()}

    record = {}
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


def clean_value(value):
    if isinstance(value, bytes):
        for encoding in ("utf-8", "gbk", "gb18030"):
            try:
                return value.decode(encoding)
            except Exception:
                pass
        return value.decode("utf-8", errors="replace")
    return value
