# Requirements Analysis

## Scope Confirmed By Client Documents

The client wants to rebuild the Grafana data supply so Grafana no longer depends on web scraping. The target architecture is:

1. n8n workflows collect official API data.
2. n8n writes cleaned time-series values into PostgreSQL.
3. Grafana reads only from PostgreSQL.
4. The system must run continuously and be more stable than the previous scraper-based setup.

The first implementation scope is the existing Grafana dashboard:

| Dashboard area | Required values | Intended refresh |
| --- | --- | --- |
| Grid frequency | Target frequency, actual frequency | 1 to 5 seconds |
| Grid time deviation | Grid time, time deviation in seconds | 1 second |
| EPEX Spot intraday | Current/running price | To be clarified |
| EPEX Spot 15-minute prices | High, low, last per 15-minute block | 15-minute market interval |
| EPEX Spot 60-minute prices | High, low, last per hour | Hourly market interval |
| Single stat panels | 15-min low/high, 60-min low/high | Derived from stored EPEX data |

The broader future scope mentioned by the client, but not yet approved as first build, includes:

- Net power generation by energy source.
- Cross-border electricity flows.
- Official wind, solar, and load forecasts.
- Balancing energy activations.

## Countries And Markets

The first release is confirmed as Germany. Market-price collection uses the Germany/Luxembourg bidding zone (`DE-LU`, EIC `10Y1001A1001A82H`). Switzerland, France, and Austria remain future expansion scope. The schema keeps country and bidding-zone dimensions so those markets can be added without redesigning the storage model.

## System Architecture Summary

The recommended architecture is a small ingestion platform around PostgreSQL:

1. API source layer
   - Live grid metric source: client-approved `netzfrequenzmessung.de` endpoint.
   - Primary official market price source: ENTSO-E Transparency Platform.
   - Client-named official-platform fallback/cross-check: SMARD Germany/DE-LU wholesale-price JSON.

2. n8n workflow layer
   - One workflow per data domain and refresh rhythm.
   - Short-interval workflows for live grid frequency and time deviation.
   - Slower workflows for market prices and derived aggregates.
   - Workflow-level error handling, retries, and failure notifications.

3. PostgreSQL storage layer
   - Raw API response archive tables for audit and troubleshooting.
   - Normalized measurement tables for Grafana.
   - Optional aggregate/materialized views for fast Grafana panels.

4. Grafana visualization layer
   - PostgreSQL datasource only.
   - Time-series panels for live metrics and price curves.
   - Stat panels derived from PostgreSQL queries.

5. Operations layer
   - Monitoring of workflow run success/failure.
   - Ingestion health tables.
   - Logs for API latency, API errors, and database write errors.

## Required API Integrations

### 1. Grid Frequency API

Purpose:

- Fetch target grid frequency.
- Fetch actual grid frequency.

Selected source:

- `netzfrequenzmessung.de`, which is explicitly allowed by the detailed client requirements.
- SMARD has no suitable documented sub-5-second frequency series, so it is not used for this metric.

Required response fields:

- Measurement timestamp.
- Target frequency, normally 50 Hz.
- Actual frequency in Hz.
- Country or synchronous area identifier.
- Source timestamp, if different from collector timestamp.

### 2. Grid Time Deviation API

Purpose:

- Fetch grid time.
- Fetch grid time deviation in seconds.

Selected first-build method:

- Integrate deviation from stored frequency samples and mark every row as calculated.
- Replace this workflow if the client later supplies an official grid-time endpoint.

Required response fields:

- Measurement timestamp.
- Grid time.
- Time deviation in seconds.
- Country or synchronous area identifier.

### 3. EPEX Spot / Intraday Price API

Purpose:

- Fetch the current running intraday electricity price.
- Support price monitoring for EPEX Spot markets.

Selected sources:

- ENTSO-E `A44` as primary official day-ahead source.
- SMARD filter `4169` as client-named fallback/cross-check.
- aWATTar remains disabled and is not required for the first build.

Open issues:

- ENTSO-E primarily provides official market transparency data but may not expose every real-time EPEX intraday trade value needed for a "running price" panel.
- aWATTar may provide easier JSON endpoints for market prices, but the client must approve it as an official-enough source if ENTSO-E does not cover the exact intraday requirement.
- True continuous EPEX intraday trade prices are not available from the selected free APIs; DE-LU is confirmed for this release.

Required response fields:

- Market/bidding zone.
- Product type: intraday, 15-minute, 60-minute/day-ahead.
- Delivery start and end timestamps.
- Price in EUR/MWh.
- Currency.
- Source publication timestamp if available.

### 4. EPEX 15-Minute Price Aggregation

Purpose:

- Produce high, low, and last price for every 15-minute block.

Possible implementation:

- If the selected API provides 15-minute OHLC/last directly, store those values.
- If the selected API provides individual trades or price points, calculate high, low, and last inside n8n or PostgreSQL.

Open issue:

- The source document does not confirm whether the API response contains OHLC fields directly or requires calculation.

### 5. EPEX 60-Minute Price Aggregation

Purpose:

- Produce high, low, and last price for each full hour.

Possible implementation:

- Use official hourly price series where available.
- Or aggregate 15-minute/intraday source values into hourly OHLC/last.

Open issue:

- The source of truth must be confirmed. Hourly "day-ahead" prices and intraday hourly OHLC are not the same product.

## External Dependencies

Infrastructure:

- PostgreSQL server.
- Grafana server, already available at the client-provided URL.
- n8n instance close to the Grafana/bot environment.
- Stable network access from n8n to external API providers.

APIs/services:

- SMARD.de API, if selected for grid metrics.
- netzfrequenzmessung.de API, if selected for live frequency/time deviation.
- ENTSO-E Transparency Platform API, if selected for market prices.
- aWATTar API, if selected for market prices.

Credentials:

- PostgreSQL database user/password.
- Grafana PostgreSQL datasource credentials.
- n8n PostgreSQL credential.
- ENTSO-E security token, if ENTSO-E is used.
- Any required SMARD/netzfrequenzmessung/aWATTar tokens, if applicable.
- SMTP, Slack, Teams, or other notification credentials for workflow alerts, if desired.

Libraries/tools:

- n8n core nodes: Schedule Trigger, HTTP Request, Code, PostgreSQL, IF/Switch, Error Trigger.
- Optional n8n community nodes only if approved by client.
- PostgreSQL extensions to consider: `pg_stat_statements` for DB performance visibility; TimescaleDB only if the client wants time-series partitioning beyond plain PostgreSQL.

## Configuration Values Needed From Client

Access and hosting:

- PostgreSQL host, port, database name, username, password, SSL mode.
- Grafana URL, admin or datasource-management access if dashboards will be configured later.
- n8n URL and access credentials.
- Deployment target: client server, VPS, Docker host, or managed service.
- Backup policy and existing backup location.

Data source choices:

- Final approved grid metric provider: SMARD.de or netzfrequenzmessung.de.
- Final approved market price provider: ENTSO-E, aWATTar, or both.
- API keys/tokens for selected providers.
- API documentation or sample successful API calls from the client's live test.

Business scope:

- Countries/bidding zones for first release.
- Whether Switzerland is required in first release, because it may differ from EU transparency data coverage.
- Exact definition of "current running intraday price."
- Whether 60-minute prices mean day-ahead hourly prices or intraday hourly products.
- Expected historical backfill period.
- Data retention period.
- Acceptable delay for Grafana panels.
- Alert recipients for failed workflows.

Operations:

- Timezone to display in Grafana: client documents mention CET/CEST.
- Whether database timestamps should be stored in UTC. Recommended answer: yes.
- Expected uptime/SLA.
- Maintenance window.
- Who approves schema changes and dashboard changes.

## Remaining Operational Inputs

Implementation files are ready, but live activation still needs:

1. PostgreSQL host, port, database, username, password, and SSL mode.
2. n8n access and assignment of the PostgreSQL credential to imported nodes.
3. ENTSO-E security token configured as `ENTSOE_SECURITY_TOKEN` in n8n.
4. Client confirmation that day-ahead interval prices are acceptable until licensed continuous intraday trade data is available.
5. Retention period for high-frequency frequency/deviation rows.
6. Alert recipients and notification channel.
7. Historical backfill period, if any.

## Current Implementation Decisions

- PostgreSQL will be the source of truth for Grafana.
- All measurement timestamps will be stored in UTC.
- Display timezone in Grafana will be CET/CEST.
- Source payloads should be stored for troubleshooting where reasonable.
- Initial schema should support multiple countries/bidding zones even if Germany is built first.
- The first implementation should avoid TimescaleDB unless the client confirms it is allowed, because plain PostgreSQL is enough to begin and simpler to operate.
