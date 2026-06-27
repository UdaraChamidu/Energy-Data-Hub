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

The client mentions Germany, Switzerland, France, and Austria for real-time grid stability and electricity prices. The initial dashboard investigation focuses mainly on Germany. This creates an open scope decision:

- Minimum first release: Germany only, matching the investigated dashboard.
- Expanded first release: Germany, Switzerland, France, and Austria.

This should be clarified before implementation because it affects API parameters, table cardinality, Grafana filters, and historical retention volume.

## System Architecture Summary

The recommended architecture is a small ingestion platform around PostgreSQL:

1. API source layer
   - Official grid metric API source: SMARD.de or netzfrequenzmessung.de.
   - Official market price API source: ENTSO-E Transparency Platform or aWATTar.

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

Candidate sources from client docs:

- SMARD.de API.
- netzfrequenzmessung.de.

Open issue:

- The client documents do not provide exact endpoint URLs, request parameters, authentication details, response examples, or rate limits.
- It must be confirmed whether SMARD provides the live 1-second frequency and grid time deviation values required by the dashboard, or whether netzfrequenzmessung.de is the correct source for this live data.

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

Candidate sources from client docs:

- SMARD.de API.
- netzfrequenzmessung.de.

Open issue:

- Same as frequency: exact endpoint, response format, and rate limits are missing.

Required response fields:

- Measurement timestamp.
- Grid time.
- Time deviation in seconds.
- Country or synchronous area identifier.

### 3. EPEX Spot / Intraday Price API

Purpose:

- Fetch the current running intraday electricity price.
- Support price monitoring for EPEX Spot markets.

Candidate sources from client docs:

- ENTSO-E Transparency Platform API.
- aWATTar API.

Open issues:

- ENTSO-E primarily provides official market transparency data but may not expose every real-time EPEX intraday trade value needed for a "running price" panel.
- aWATTar may provide easier JSON endpoints for market prices, but the client must approve it as an official-enough source if ENTSO-E does not cover the exact intraday requirement.
- Exact market areas must be confirmed: DE-LU, AT, FR, CH, or other bidding zones.

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

## Missing Information And Clarifications

The following must be clarified before implementation code is generated:

1. Which API provider is final for grid frequency and grid time deviation?
2. Which exact endpoints and parameters were used in the client's successful live test?
3. Does the grid source permit 1-second polling under its terms and rate limits?
4. Which API provider is final for EPEX/market prices?
5. Are intraday values actual live trades, official index prices, or latest published market data?
6. Are 15-minute high/low/last values provided by the API or must they be calculated?
7. Are 60-minute high/low/last values hourly intraday products or day-ahead hourly prices?
8. Which first-release countries/bidding zones are required?
9. Is historical backfill required before live collection starts?
10. What are the Grafana dashboard refresh intervals expected by the users?
11. What retention period should be used for 1-second grid data?
12. Should failed API responses be archived for audit/debugging?
13. Should n8n send alerts on every failure, repeated failures only, or after a downtime threshold?

## Key Assumptions For Planning Only

These are planning assumptions, not implementation decisions:

- PostgreSQL will be the source of truth for Grafana.
- All measurement timestamps will be stored in UTC.
- Display timezone in Grafana will be CET/CEST.
- Source payloads should be stored for troubleshooting where reasonable.
- Initial schema should support multiple countries/bidding zones even if Germany is built first.
- The first implementation should avoid TimescaleDB unless the client confirms it is allowed, because plain PostgreSQL is enough to begin and simpler to operate.

