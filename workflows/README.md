# n8n Workflows

This folder contains starter n8n workflows for the Germany-first ingestion phase.

## Import Order

1. `01_grid_frequency_netzfrequenzmessung_de.json`
2. `02_grid_time_deviation_calculated.json`
3. `03_market_prices_entsoe_de_lu.json`
4. `04_market_price_ohlc_builder.json`
5. `05_ingestion_health_monitor.json`

## Before Activating

Create or select your n8n PostgreSQL credential, then assign it to every PostgreSQL node after import. The workflow JSON files intentionally do not include placeholder PostgreSQL credential IDs, so imports should be cleaner across n8n instances.

For ENTSO-E, replace this placeholder in the HTTP Request node:

```text
REPLACE_WITH_ENTSOE_SECURITY_TOKEN
```

Use a real n8n environment variable or credential value if possible.

## Required Database Scripts

Apply these PostgreSQL files first:

1. `database/001_create_energy_data_schema.sql`
2. `database/002_seed_germany_sources.sql`
3. `database/003_create_views.sql`

## Notes

- The grid-frequency workflow polls `netzfrequenzmessung.de` every 3 seconds.
- The grid-time-deviation workflow creates an approximate calculated value from recent frequency samples.
- The ENTSO-E workflow stores Germany/DE-LU price points from document type `A44`.
- The OHLC builder derives 15-minute and 60-minute aggregates from stored price points.
- These workflows are meant as production-oriented starters. After import, test each workflow manually before activation.
