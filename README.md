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
