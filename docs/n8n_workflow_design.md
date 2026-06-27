# n8n Workflow Design

This document describes the required n8n workflows. It is a design document only; workflow JSON should be generated after client approval.

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

Proposed name:

- `grid_frequency_live_collector`

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

Proposed name:

- `grid_time_deviation_live_collector`

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

## Workflow 3: Market Intraday Current Price Collector

Proposed name:

- `market_intraday_price_collector`

Purpose:

- Fetch current/running intraday price.
- Save into `energy_data.market_price_points`.

Trigger:

- To be confirmed. Suggested starting point: every 1 minute unless provider rate limits or business needs require otherwise.

Nodes:

1. Schedule Trigger.
2. Create ingestion run.
3. HTTP Request to ENTSO-E/aWATTar/approved source.
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

Open design decision:

- The exact meaning of "current running price" must be confirmed before this workflow is implemented.

## Workflow 4: 15-Minute OHLC Price Builder

Proposed name:

- `market_price_15m_ohlc_builder`

Purpose:

- Produce high, low, and last price for each 15-minute interval.
- Save into `energy_data.market_price_ohlc`.

Trigger:

- Every 1 to 5 minutes, or after new intraday data is collected.

Input options:

- Direct API values if provider supplies OHLC.
- Calculated from `energy_data.market_price_points`.

Nodes:

1. Schedule Trigger or Execute Workflow trigger from intraday collector.
2. Select recent unaggregated price points.
3. Group by market and 15-minute delivery interval.
4. Calculate:
   - high = maximum price.
   - low = minimum price.
   - last = latest by source publication time or ingestion time.
5. PostgreSQL upsert into `market_price_ohlc`.
6. Complete ingestion run.
7. Error branch creates alert.

Open design decision:

- Confirm whether `last` means latest trade, latest publication, or latest collector-observed price.

## Workflow 5: 60-Minute OHLC Price Builder

Proposed name:

- `market_price_60m_ohlc_builder`

Purpose:

- Produce high, low, and last price for each 60-minute interval.
- Save into `energy_data.market_price_ohlc`.

Trigger:

- Every 5 to 15 minutes, or after new source data arrives.

Input options:

- Official hourly/day-ahead values.
- Calculated from 15-minute values.
- Calculated from individual price points.

Nodes:

1. Schedule Trigger or Execute Workflow trigger from price collector.
2. Select source data for recent hourly windows.
3. Group by market and hourly interval.
4. Calculate high, low, and last.
5. PostgreSQL upsert into `market_price_ohlc`.
6. Complete ingestion run.
7. Error branch creates alert.

Open design decision:

- Confirm whether this panel should show hourly day-ahead prices or hourly intraday OHLC.

## Workflow 6: Grafana Stat Value Refresher

Proposed name:

- `market_price_stat_refresh`

Purpose:

- Prepare values for single stat panels:
  - 15min Low
  - 15min High
  - 60min Low
  - 60min High

Trigger:

- Every 1 to 5 minutes, or skipped if Grafana queries calculate stats directly.

Recommended approach:

- Prefer Grafana queries/views over storing separate stat records, because the stats are derived values.
- Add a materialized view only if Grafana performance requires it.

## Workflow 7: Ingestion Health Monitor

Proposed name:

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

- Insert or update `energy_data.ingestion_alerts`.
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

