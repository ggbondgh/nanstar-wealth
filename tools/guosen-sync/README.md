# Guosen local sync bridge

This tool is the safe path for reading Guosen account data into NanStar Wealth.
It does not use browser cookies, does not store your brokerage password, and should
run only on your own Windows machine where Guosen iQuant/GTrade is installed and
logged in.

Data flow:

```text
Guosen iQuant/GTrade on local Windows
  -> iQuant snapshot strategy writes local_guosen_snapshot.json
  -> watch_snapshot_upload.py uploads changed snapshots
  -> https://nanstar-wealth.pages.dev/api/state
  -> Cloudflare D1
  -> NanStar Wealth page on phone/PC
```

## Portable setup on any Windows laptop

Use this on each Windows computer where you have Guosen iQuant/GTrade installed
and logged in. Company laptop and personal laptop can both upload to the same
NanStar Wealth cloud state.

1. Clone or copy this project to that laptop.
2. Run:

```powershell
D:\NanStar-Wealth\tools\guosen-sync\setup_local_sync.bat
```

3. Enter:
   - your Guosen account id.
   - the NanStar sync token from Cloudflare Pages `NANSTAR_SYNC_TOKEN`.

The setup script generates local-only files ignored by Git:

- `config.json`: account id, sync token, upload options.
- `local_iquant_snapshot_strategy.py`: iQuant strategy with the correct local
  snapshot path for this laptop.
- a Windows startup shortcut for the hidden snapshot uploader.

4. In iQuant, create a Python strategy. The setup script copies the generated
   strategy to your clipboard; paste it, compile/save it as something like
   `NanStar Snapshot`, and keep it saved. It writes
   `local_guosen_snapshot.json` every 60 seconds by default.

Daily use after setup:

1. Log into iQuant/GTrade.
2. Run the saved `NanStar Snapshot` iQuant strategy.
3. Open NanStar Wealth and click `立即同步` or refresh.

If iQuant is closed, not logged in, or the saved strategy is not running, the
website will only show the last uploaded snapshot. To remove the startup
uploader, run:

```powershell
D:\NanStar-Wealth\tools\guosen-sync\uninstall_autostart_uploader.bat
```

## Manual setup

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

For iQuant strategy mode, use the helper strategy files:

- `iquant_probe_strategy.py`: first test whether iQuant can read your account,
  positions, orders, and deals.
- `iquant_snapshot_strategy.py`: template for writing a local snapshot. Prefer
  `setup_local_sync.bat`, because it generates the local path automatically.
- `iquant_sync_strategy.py`: direct iQuant-to-Cloudflare push. This is less
  reliable if Cloudflare blocks iQuant networking; the snapshot uploader is the
  safer default.

In iQuant, create a new Python strategy, paste the helper file content, replace
`PUT_YOUR_GUOSEN_ACCOUNT_ID_HERE`, compile/save, and run it from strategy trading
mode. Keep `config.json` as `dry_run: true` until the log output looks right.

After the dry run looks right, set `dry_run` to `false` and run again.

For continuous direct sync without iQuant snapshot mode:

```powershell
python D:\NanStar-Wealth\tools\guosen-sync\sync_guosen.py --config D:\NanStar-Wealth\tools\guosen-sync\config.json
```

For continuous snapshot upload:

```powershell
python D:\NanStar-Wealth\tools\guosen-sync\watch_snapshot_upload.py --config D:\NanStar-Wealth\tools\guosen-sync\config.json --snapshot D:\NanStar-Wealth\tools\guosen-sync\local_guosen_snapshot.json
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
