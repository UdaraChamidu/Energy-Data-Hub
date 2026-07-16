# n8n Workflows

This folder contains starter n8n workflows for the Germany-first ingestion phase.

## Import Order

1. `01_grid_frequency_netzfrequenzmessung_de.json`
2. `02_grid_time_deviation_calculated.json`
3. `03_market_prices_entsoe_de_lu.json`
4. `03a_market_prices_smard_de_lu.json`
5. `04_market_price_ohlc_builder.json`
6. `05_ingestion_health_monitor.json`

## Before Activating

Create or select your n8n PostgreSQL credential, then assign it to every PostgreSQL node after import. The workflow JSON files intentionally do not include placeholder PostgreSQL credential IDs, so imports should be cleaner across n8n instances.

For ENTSO-E, define this environment variable in the n8n runtime:

```text
ENTSOE_SECURITY_TOKEN=your_real_token
```

The imported workflow reads it as `{{$env.ENTSOE_SECURITY_TOKEN}}`; the token is not stored in workflow JSON.

## Required Database Scripts

Apply these PostgreSQL files first:

1. `database/001_create_energy_data_schema.sql`
2. `database/002_seed_germany_sources.sql`
3. `database/003_create_views.sql`
4. `database/005_align_client_api_sources.sql`

## Notes

- The grid-frequency workflow polls `netzfrequenzmessung.de` every 3 seconds.
- The grid-time-deviation workflow creates an approximate calculated value from recent frequency samples.
- The ENTSO-E workflow stores Germany/DE-LU price points from document type `A44`.
- The SMARD workflow stores the client-named `4169` Germany/DE-LU quarter-hour wholesale-price series as a fallback/cross-check.
- The OHLC builder derives 15-minute and 60-minute aggregates from stored price points.
- For the free sources, these are day-ahead interval aggregates, not continuous intraday trade OHLC values.
- These workflows are meant as production-oriented starters. After import, test each workflow manually before activation.
