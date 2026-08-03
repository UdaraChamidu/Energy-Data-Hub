# Database Setup

This folder contains the PostgreSQL foundation for the Germany-first Energy Data Hub.

## Apply Order

Run these files in order:

1. `001_create_energy_data_schema.sql`
2. `002_seed_germany_sources.sql`
3. `003_create_views.sql`
4. `005_align_client_api_sources.sql`
5. `006_add_epex_spot_web.sql`

`004_upsert_examples.sql` is not a migration. It contains reference SQL snippets for n8n PostgreSQL nodes.

`005_align_client_api_sources.sql` is idempotent and is especially important when `001-003` were applied before the SMARD collector was added.

`006_add_epex_spot_web.sql` is idempotent and must be applied before the EPEX
public-results workflow is tested.

If direct PostgreSQL access is unavailable, import
`database/n8n_workflows/006_add_epex_spot_web.json` into n8n. Assign the existing
PostgreSQL credential to its single Postgres node, execute it once, and confirm
that it returns `Migration 006 completed successfully`. Keep this one-time
migration workflow inactive.

## What This Creates

Schema:

- `energy_data`

Core tables:

- `data_sources`
- `markets`
- `collector_settings`
- `raw_api_payloads`
- `grid_frequency_measurements`
- `grid_time_deviation_measurements`
- `market_price_points`
- `market_price_ohlc`
- `ingestion_runs`
- `ingestion_alerts`
- `workflow_state`

Seeded providers:

- `netzfrequenzmessung`
- `entsoe`
- `awattar`
- `smard`
- `calculated`
- `epex_spot_web` after running `006_add_epex_spot_web.sql`

EPEX web collection also adds `epex_intraday_auction_results` and
`v_grafana_epex_intraday_auction`. Run migration `006` before importing or
executing the EPEX n8n workflow.

Seeded market:

- Germany / Luxembourg, bidding zone `DE-LU`, EIC `10Y1001A1001A82H`.

## Important Notes

- Store real secrets in n8n credentials or environment variables, not in `collector_settings`.
- `ENTSOE_SECURITY_TOKEN` is seeded only as a placeholder.
- Grid frequency target is stored as `50.000 Hz` because the selected live endpoint returns actual frequency only.
- Grid time deviation is designed to be calculated first, then replaced by an official API source later if one becomes available.
- ENTSO-E is the primary DE-LU day-ahead source; SMARD is an independent official-platform fallback/cross-check.
- `v_grafana_current_market_price` returns the interval active now, preferring ENTSO-E and falling back to SMARD.
- `v_grafana_market_price_stats_today` uses the current Europe/Berlin calendar day for the requested daily high/low values.
- Grafana is not required for this phase, but views are included so the database is ready for dashboard work later.

## Basic Verification Queries

```sql
select * from energy_data.data_sources order by code;
select * from energy_data.markets order by country_code, bidding_zone;
select * from energy_data.collector_settings order by key;
select * from energy_data.v_ingestion_health;
```
