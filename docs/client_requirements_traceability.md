# Client Requirements Traceability

## Confirmed First Release

The first release is Germany-first and covers data ingestion only. n8n collects the data, PostgreSQL stores it, and Grafana/web-interface work follows later.

| Client requirement | Implemented source/logic | PostgreSQL target | n8n workflow | Status |
| --- | --- | --- | --- | --- |
| Target grid frequency | Configured Continental Europe target, `50.000 Hz` | `grid_frequency_measurements.target_hz` | `grid_frequency_netzfrequenzmessung_de` | Implemented |
| Actual grid frequency every 1-5 seconds | Client-approved `netzfrequenzmessung.de` live XML endpoint, polled every 3 seconds | `grid_frequency_measurements.actual_hz` | `grid_frequency_netzfrequenzmessung_de` | Implemented |
| Grid time and time deviation | Clearly labelled approximation integrated from stored frequency samples | `grid_time_deviation_measurements` | `grid_time_deviation_calculated` | Implemented with source limitation |
| Official DE-LU price intervals | ENTSO-E Transparency Platform `A44` day-ahead price document | `market_price_points` | `market_prices_entsoe_de_lu` | Implemented; token required |
| SMARD.de data source named by client | SMARD public JSON wholesale-price series, filter `4169`, region `DE-LU`, quarter-hour resolution | `market_price_points` | `market_prices_smard_de_lu` | Implemented as independent official-source fallback/cross-check |
| Current price panel | Price whose delivery interval contains the current timestamp, ENTSO-E preferred and SMARD fallback | `v_grafana_current_market_price` | Database view | Implemented |
| 15-minute High/Low/Last | Derived from stored interval price observations | `market_price_ohlc` | `market_price_ohlc_builder` | Implemented with day-ahead limitation |
| 60-minute High/Low/Last | High/low across quarter-hours; last is the final quarter-hour in the hour | `market_price_ohlc` | `market_price_ohlc_builder` | Implemented with day-ahead limitation |
| Daily stat values | Current Europe/Berlin calendar-day high/low by source and interval | `v_grafana_market_price_stats_today` | Database view | Implemented |
| Ingestion monitoring | Stale-data checks with one open alert per data domain | `ingestion_runs`, `ingestion_alerts` | `ingestion_health_monitor` | Implemented |

## Source Decision

The client messages name SMARD and ENTSO-E as the desired sources. The more detailed client document also explicitly allows `netzfrequenzmessung.de` for grid metrics and aWATTar for prices.

The implemented source allocation is deliberately based on what each source actually publishes:

- SMARD does not expose a documented 1-second grid-frequency or grid-time-deviation series. It publishes German electricity market time series and downloadable data.
- `netzfrequenzmessung.de` exposes the live frequency and source timestamp needed by the first dashboard panel. It does not expose grid time deviation.
- ENTSO-E `A44` exposes official day-ahead prices. It is not a continuous EPEX intraday trade feed.
- SMARD filter `4169` exposes the German/Luxembourg wholesale-price series and is retained as a client-requested independent source/fallback.
- True continuous EPEX intraday Current/High/Low/Last still requires a licensed EPEX/EEX market-data product or another client-approved trade feed.

No workflow labels ENTSO-E or SMARD day-ahead prices as continuous intraday trades. This prevents the dashboard from presenting auction interval prices as trade OHLC data.

## Required Before Activation

- Apply the SQL scripts in `database/` in the documented order.
- Assign the real PostgreSQL credential to every PostgreSQL node in n8n.
- Set `ENTSOE_SECURITY_TOKEN` in the n8n runtime environment.
- Manually test the frequency workflow, then deviation, ENTSO-E, SMARD, OHLC, and health workflows in that order.
- Keep the workflows inactive until their manual test succeeds against the client's PostgreSQL database.

## Not Yet Fully Satisfied

Two requested values cannot be truthfully delivered by the currently named free APIs:

1. Official live grid time deviation. The current value is a calculated approximation and is marked `quality = 'calculated'`.
2. True continuous EPEX intraday trade High/Low/Last. The current free-source implementation uses published day-ahead interval prices.

The PostgreSQL schema is already source-aware, so either provider can be replaced later without redesigning Grafana-facing tables.
