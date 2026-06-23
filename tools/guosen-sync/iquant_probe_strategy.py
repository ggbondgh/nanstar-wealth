# NanStar Wealth Guosen iQuant probe strategy.
#
# Usage:
# 1. Copy this file content into a new iQuant Python strategy.
# 2. Set ACCOUNT_ID to your Guosen stock fund account.
# 3. Compile/save, then run it in simulation or live strategy mode.
# 4. Check iQuant logs for ACCOUNT/POSITION/ORDER/DEAL output.

ACCOUNT_ID = "PUT_YOUR_GUOSEN_ACCOUNT_ID_HERE"
ACCOUNT_TYPE = "stock"


def init(ContextInfo):
    ContextInfo.nanstar_probe_done = False
    try:
        ContextInfo.set_account(ACCOUNT_ID)
    except Exception as exc:
        print("[NanStar Probe] set_account failed:", repr(exc))
    print("[NanStar Probe] init, account =", ACCOUNT_ID, "type =", ACCOUNT_TYPE)


def handlebar(ContextInfo):
    if getattr(ContextInfo, "nanstar_probe_done", False):
        return
    ContextInfo.nanstar_probe_done = True

    for data_type in ("account", "position", "order", "deal"):
        try:
            rows = get_trade_detail_data(ACCOUNT_ID, ACCOUNT_TYPE, data_type)
            print("[NanStar Probe]", data_type, "rows =", len(rows or []))
            for row in (rows or [])[:3]:
                print("[NanStar Probe]", data_type, "fields =", dir(row))
                print("[NanStar Probe]", data_type, "sample =", row)
        except Exception as exc:
            print("[NanStar Probe]", data_type, "failed:", repr(exc))

