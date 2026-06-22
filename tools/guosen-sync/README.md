# Guosen local sync bridge

This tool is the safe path for reading Guosen account data into NanStar Wealth.
It does not use browser cookies, does not store your brokerage password, and should
run only on your own Windows machine where Guosen iQuant/GTrade is installed and
logged in.

Data flow:

```text
Guosen iQuant/GTrade on local Windows
  -> tools/guosen-sync/sync_guosen.py
  -> https://nanstar-wealth.pages.dev/api/state
  -> Cloudflare D1
  -> NanStar Wealth page on phone/PC
```

## Setup

1. Copy `config.example.json` to `config.json`.
2. Fill:
   - `account_id`: your Guosen fund/stock account id.
   - `sync_token`: the same token as Cloudflare Pages `NANSTAR_SYNC_TOKEN`.
   - keep `dry_run: true` for the first run.
3. Run the script from the Python environment that can access Guosen iQuant APIs:

```powershell
python D:\NanStar-Wealth\tools\guosen-sync\sync_guosen.py --config D:\NanStar-Wealth\tools\guosen-sync\config.json --once
```

If the script says `get_trade_detail_data` is unavailable, run it inside the
Guosen iQuant/GTrade Python environment or add that environment to PATH.

After the dry run looks right, set `dry_run` to `false` and run again.

For continuous sync:

```powershell
python D:\NanStar-Wealth\tools\guosen-sync\sync_guosen.py --config D:\NanStar-Wealth\tools\guosen-sync\config.json
```

## What it writes

- `state.brokerage`: masked account snapshot, positions, recent orders, recent deals.
- `state.transactions`: normalized Guosen deals, using deterministic ids such as
  `guosen-deal-...`, so reruns do not duplicate the same deal.
- `state.prices`: optional latest prices derived from the position snapshot.

The website still keeps your manual records and imported records. This bridge only
adds missing Guosen-origin records and a read-only brokerage snapshot.

## Privacy notes

- Do not commit `config.json`.
- Do not put brokerage cookies, passwords, or SMS codes into this project.
- The Cloudflare sync token is enough to write your NanStar Wealth state, so treat it
  as private.
