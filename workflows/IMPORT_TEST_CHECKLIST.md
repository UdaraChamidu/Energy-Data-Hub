# n8n Import And Test Checklist

Keep every workflow inactive until its manual test passes.

## Prerequisites

- Apply `database/001_create_energy_data_schema.sql`.
- Apply `database/002_seed_germany_sources.sql`.
- Apply `database/003_create_views.sql`.
- Apply `database/005_align_client_api_sources.sql`.
- Configure `ENTSOE_SECURITY_TOKEN` in the n8n runtime.
- Create one n8n PostgreSQL credential with SSL mode matching the client database.
- Assign that credential to every PostgreSQL node after import.

## Test Order

1. `01_grid_frequency_netzfrequenzmessung_de.json`
   - Execute manually.
   - Confirm one row in `energy_data.grid_frequency_measurements` with actual Hz near 50 and `quality = 'ok'`.
2. `02_grid_time_deviation_calculated.json`
   - Run after at least two frequency samples exist.
   - Confirm calculated rows and that rerunning without a new frequency sample does not change the stored deviation.
3. `03_market_prices_entsoe_de_lu.json`
   - Confirm the token is available and XML returns `TimeSeries` data.
   - Confirm DE-LU `quarter_hour_day_ahead` or `hour_day_ahead` rows.
4. `03a_market_prices_smard_de_lu.json`
   - Confirm index and latest-series requests succeed.
   - Confirm null future points are skipped and source is `smard`.
5. `04_market_price_ohlc_builder.json`
   - Confirm separate ENTSO-E and SMARD rows in `market_price_ohlc`.
   - For 60-minute rows, verify `last` equals the final quarter-hour price.
6. `05_ingestion_health_monitor.json`
   - Confirm healthy data produces no new open alert.
   - Confirm repeated stale checks refresh one open alert instead of inserting one alert per minute.

## Verification Queries

```sql
select * from energy_data.v_grid_frequency_latest;
select * from energy_data.v_grid_time_deviation_latest;
select * from energy_data.v_grafana_current_market_price;
select * from energy_data.v_grafana_market_price_stats_today order by source_code, interval_type;
select * from energy_data.v_ingestion_health;
select * from energy_data.ingestion_alerts where resolved_at is null;
```
