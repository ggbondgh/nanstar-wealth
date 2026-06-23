# NanStar Wealth Guosen iQuant sync strategy.
#
# Run this only after iquant_probe_strategy.py can read ACCOUNT/POSITION data.
# It imports sync_guosen.py and pushes the merged state to Cloudflare using
# tools/guosen-sync/config.json.

import builtins
import importlib.util
import os
import sys

ACCOUNT_ID = "PUT_YOUR_GUOSEN_ACCOUNT_ID_HERE"
ACCOUNT_TYPE = "stock"
CONFIG_PATH = r"D:\NanStar-Wealth\tools\guosen-sync\config.json"
SYNC_MODULE_PATH = r"D:\NanStar-Wealth\tools\guosen-sync\sync_guosen.py"


def init(ContextInfo):
    ContextInfo.nanstar_sync_done = False
    try:
        ContextInfo.set_account(ACCOUNT_ID)
    except Exception as exc:
        print("[NanStar Sync] set_account failed:", repr(exc))
    print("[NanStar Sync] init, account =", ACCOUNT_ID)


def handlebar(ContextInfo):
    if getattr(ContextInfo, "nanstar_sync_done", False):
        return
    ContextInfo.nanstar_sync_done = True

    try:
        builtins.get_trade_detail_data = get_trade_detail_data
        spec = importlib.util.spec_from_file_location("nanstar_sync_guosen", SYNC_MODULE_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        config = module.load_config(module.Path(CONFIG_PATH))
        config["account_id"] = ACCOUNT_ID
        config["account_type"] = ACCOUNT_TYPE
        summary = module.sync_once(config)
        print("[NanStar Sync] ok:", summary)
    except Exception as exc:
        print("[NanStar Sync] failed:", repr(exc))

