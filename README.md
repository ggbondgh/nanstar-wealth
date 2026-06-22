# NanStar Wealth

Personal wealth dashboard prototype. Local-first, static, and self-contained.

## Cloudflare sync

This project can sync state through Cloudflare Pages Functions + D1.

Required Cloudflare bindings:

- `NANSTAR_WEALTH_DB`: D1 database binding
- `NANSTAR_SYNC_TOKEN`: optional shared token for API access

Local sync token:

- Click `同步口令` in the app and paste the same token you set in Cloudflare Pages environment variables.

Database setup:

1. Create the D1 database `nanstar-wealth`
2. Apply `schema.sql`
3. Bind `NANSTAR_WEALTH_DB` in Pages

## Guosen local sync bridge

Direct brokerage/account access should stay local. Use
`tools/guosen-sync/sync_guosen.py` on the Windows machine where Guosen
iQuant/GTrade is installed and logged in.

The bridge reads Guosen account, position, order, and deal snapshots through the
local Guosen Python API, merges them with the existing Cloudflare state, and then
pushes the full state back to `/api/state` with `x-nanstar-sync-token`.

Start here:

```powershell
Copy-Item D:\NanStar-Wealth\tools\guosen-sync\config.example.json D:\NanStar-Wealth\tools\guosen-sync\config.json
python D:\NanStar-Wealth\tools\guosen-sync\sync_guosen.py --config D:\NanStar-Wealth\tools\guosen-sync\config.json --once
```

Keep `dry_run` as `true` for the first run. After the output looks right, set it
to `false` and run again. Do not commit `config.json`.
