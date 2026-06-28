# Database Setup

This folder contains the PostgreSQL foundation for the Germany-first Energy Data Hub.

## Apply Order

Run these files in order:

1. `001_create_energy_data_schema.sql`
2. `002_seed_germany_sources.sql`
3. `003_create_views.sql`

`004_upsert_examples.sql` is not a migration. It contains reference SQL snippets for n8n PostgreSQL nodes.

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

Seeded market:

- Germany / Luxembourg, bidding zone `DE-LU`, EIC `10Y1001A1001A82H`.

## Important Notes

- Store real secrets in n8n credentials or environment variables, not in `collector_settings`.
- `ENTSOE_SECURITY_TOKEN` is seeded only as a placeholder.
- Grid frequency target is stored as `50.000 Hz` because the selected live endpoint returns actual frequency only.
- Grid time deviation is designed to be calculated first, then replaced by an official API source later if one becomes available.
- Grafana is not required for this phase, but views are included so the database is ready for dashboard work later.

## Basic Verification Queries

```sql
select * from energy_data.data_sources order by code;
select * from energy_data.markets order by country_code, bidding_zone;
select * from energy_data.collector_settings order by key;
select * from energy_data.v_ingestion_health;
```

