# n8n Import And Test Checklist

Keep every workflow inactive until its manual test passes.

## Prerequisites

- Apply `database/001_create_energy_data_schema.sql`.
- Apply `database/002_seed_germany_sources.sql`.
- Apply `database/003_create_views.sql`.
- Apply `database/005_align_client_api_sources.sql`.
- Apply `database/006_add_epex_spot_web.sql`.
- Apply `database/007_add_energy_charts_intraday.sql`.
- Apply `database/008_extend_epex_complete_market_results.sql`.
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
7. `06_epex_spot_intraday_web_de.json`
   - Keep the workflow inactive and assign the PostgreSQL credential to both Postgres nodes.
   - Run it manually and confirm both terminal Postgres nodes succeed.
   - On a normal day, confirm 96 auction rows, 96 continuous 15-minute rows and 24 continuous hourly rows.
   - Do not activate it if EPEX returns HTTP 202, an empty page, the wrong table or a row-count validation error.
8. `07_market_prices_energy_charts_intraday_de_lu.json`
   - Assign the PostgreSQL credential to both Store Fraunhofer nodes.
   - Confirm both HTTP and parser branches succeed.
   - The current live contract returns 96 published 15-minute rows and 24 published hourly rows.
   - Confirm records are stored with source `energy_charts`; then activate the workflow.
9. `08_epex_complete_market_results_de.json`
   - Assign the PostgreSQL credential to `Store Validated EPEX Result`.
   - Keep workflow `06` inactive; workflow `08` is its separate complete-product test.
   - Execute workflow `08` manually. A manual execution requests MRC, IDA1, IDA2, IDA3, Continuous 15-minute, and Continuous 60-minute.
   - Confirm six successful PostgreSQL outputs and coverage rows for all six products.
   - If any request is blocked, returns the wrong table, or fails row-count validation, keep workflow `08` inactive and continue using Fraunhofer workflow `07`.

## Verification Queries

```sql
select * from energy_data.v_grid_frequency_latest;
select * from energy_data.v_grid_time_deviation_latest;
select * from energy_data.v_grafana_current_market_price;
select * from energy_data.v_grafana_market_price_stats_today order by source_code, interval_type;
select * from energy_data.v_grafana_energy_charts_intraday_latest;
select * from energy_data.v_grafana_energy_charts_intraday_stats_latest_day;
select * from energy_data.v_epex_complete_coverage order by product_name;
select * from energy_data.v_ingestion_health;
select * from energy_data.ingestion_alerts where resolved_at is null;
```
