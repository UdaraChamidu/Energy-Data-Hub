# n8n Workflow Design

This document describes the implemented Germany-first n8n workflows. Importable JSON files are in `workflows/` and remain inactive until manually tested with the client's PostgreSQL credential.

## General Workflow Standards

Every workflow should:

- Use a clear name with domain, provider, and interval.
- Write an `ingestion_runs` row at start and completion.
- Store raw payloads when useful for troubleshooting.
- Upsert normalized records into PostgreSQL.
- Avoid duplicate writes using database unique keys.
- Retry transient HTTP errors.
- Raise alerts only after agreed thresholds to avoid noisy notifications.
- Convert all timestamps to UTC before database writes.
- Preserve source timestamps separately from ingestion timestamps.

## Workflow 1: Grid Frequency Collector

Implemented name:

- `grid_frequency_netzfrequenzmessung_de`

Purpose:

- Fetch target frequency and actual frequency.
- Save into `energy_data.grid_frequency_measurements`.

Trigger:

- Schedule trigger every 1 to 5 seconds, depending on source limits and n8n stability.

Nodes:

1. Schedule Trigger.
2. Create ingestion run.
3. HTTP Request to selected grid provider.
4. Validate response shape.
5. Transform response to normalized fields:
   - source
   - market/country
   - measured_at
   - target_hz
   - actual_hz
   - source_published_at
   - quality
6. Store raw payload if enabled.
7. PostgreSQL upsert.
8. Complete ingestion run.
9. Error branch creates alert and marks run failed.

Open design decision:

- If n8n cannot reliably run at 1-second interval, use a lightweight collector service for this specific live metric and let n8n supervise/monitor it. This should be discussed before implementation if true 1-second collection is mandatory.

## Workflow 2: Grid Time Deviation Collector

Implemented name:

- `grid_time_deviation_calculated`

Purpose:

- Fetch grid time and time deviation.
- Save into `energy_data.grid_time_deviation_measurements`.

Trigger:

- Schedule trigger every 1 second if provider and n8n allow it.

Nodes:

1. Schedule Trigger.
2. Create ingestion run.
3. HTTP Request to selected grid provider.
4. Validate response shape.
5. Transform response:
   - source
   - market/country
   - measured_at
   - grid_time
   - deviation_seconds
   - source_published_at
   - quality
6. Store raw payload if enabled.
7. PostgreSQL upsert.
8. Complete ingestion run.
9. Error branch creates alert and marks run failed.

Open design decision:

- The client must confirm provider rate limits and permission for 1-second polling.

## Workflow 3: ENTSO-E DE-LU Price Collector

Implemented name:

- `market_prices_entsoe_de_lu`

Purpose:

- Fetch official ENTSO-E `A44` day-ahead price intervals.
- Save into `energy_data.market_price_points`.

Trigger:

- Every 15 minutes.

Nodes:

1. Schedule Trigger.
2. Create ingestion run.
3. HTTP Request to ENTSO-E with `ENTSOE_SECURITY_TOKEN`.
4. Validate source response.
5. Transform into market price point rows:
   - market/bidding zone
   - product
   - delivery_start
   - delivery_end
   - price_eur_mwh
   - currency
   - source_published_at
   - optional source_trade_id
6. Store raw payload.
7. PostgreSQL upsert.
8. Complete ingestion run.
9. Error branch creates alert and marks run failed.

The database view `v_grafana_current_market_price` chooses the price interval active now. It must not be described as a continuous intraday trade price.

## Workflow 4: SMARD DE-LU Price Collector

Implemented name:

- `market_prices_smard_de_lu`

Purpose:

- Use the client-named SMARD source as an independent official-platform fallback/cross-check.
- Read filter `4169`, region `DE-LU`, quarter-hour JSON data.
- Skip unpublished null values, archive the raw payload, and upsert valid price intervals.

## Workflow 5: 15/60-Minute Price Aggregate Builder

Implemented name:

- `market_price_ohlc_builder`

Purpose:

- Produce high, low, and last for 15-minute and 60-minute intervals.
- Save into `energy_data.market_price_ohlc`.

Trigger:

- Every 5 minutes.

Nodes:

1. Schedule Trigger.
2. Select recent ENTSO-E and SMARD day-ahead price points.
3. Group separately by source, market, and 15/60-minute interval.
4. Calculate:
   - high = maximum price.
   - low = minimum price.
   - last = price for the chronologically final delivery subinterval.
5. PostgreSQL upsert into `market_price_ohlc`.
6. Complete ingestion run.

For day-ahead data, 15-minute high/low/last are normally equal because there is one clearing price for that interval. A 60-minute row compares the four quarter-hour prices. These values are not continuous-trade OHLC.

## Workflow 6: Grafana Stat Views

Purpose:

- Prepare values for single stat panels:
  - 15min Low
  - 15min High
  - 60min Low
  - 60min High

Implementation:

- No separate n8n workflow is needed.
- `v_grafana_market_price_stats_today` calculates the current Europe/Berlin calendar-day high/low values by source and interval.

## Workflow 7: Ingestion Health Monitor

Implemented name:

- `ingestion_health_monitor`

Purpose:

- Detect stale data or repeated failures.

Trigger:

- Every 1 minute.

Checks:

- Latest grid frequency row is not older than expected threshold.
- Latest grid time deviation row is not older than expected threshold.
- Latest market price row is not older than expected threshold.
- Last n8n run did not fail repeatedly.

Actions:

- Insert or refresh one open `energy_data.ingestion_alerts` row per data domain and resolve it after recovery.
- Send notification to approved channel.

## Future Workflow Candidates

The following should wait for client confirmation:

- Net generation mix collector.
- Cross-border flows collector.
- Wind/solar/load forecast collector.
- Balancing energy activations collector.
- Historical backfill workflows.

## n8n Credentials Needed

- PostgreSQL credential.
- HTTP credential or API token for ENTSO-E if selected.
- HTTP credential or API token for other selected providers if required.
- Notification credential for alerts.

## n8n Operational Risks

1-second polling:

- n8n can run frequent workflows, but true 1-second polling may be fragile depending on hosting, workflow complexity, queue mode, and database latency.
- If strict 1-second reliability is required, a small dedicated collector service may be safer for grid metrics, with n8n used for orchestration and monitoring.

API rate limits:

- The chosen provider must allow the planned refresh frequency.

Database write volume:

- 1-second writes are manageable for PostgreSQL, but retention and indexing should be planned.

Timezone handling:

- All writes should use UTC.
- Grafana should display CET/CEST.
