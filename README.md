# Energy Data Hub

Germany-first electricity-grid and market-data pipeline for the client's Grafana monitoring system.

The project replaces fragile webpage scraping with scheduled n8n collectors, PostgreSQL storage, and a Grafana dashboard that reads only from PostgreSQL.

```text
netzfrequenzmessung.de ----+
                           |
ENTSO-E Transparency ------+--> n8n --> PostgreSQL --> Grafana
                           |
SMARD.de ------------------+
```

## Current Status

| Component | Status |
| --- | --- |
| Germany-first requirements and API selection | Complete |
| PostgreSQL schema, seed data, indexes, and views | Created by the operator |
| Six importable n8n workflows | Implemented and locally validated |
| Grafana PostgreSQL datasource | Connected by the operator |
| Germany Grafana dashboard | Imported and reported working |
| Automated workflow and dashboard validation | Passing |
| Production alert delivery, retention, and backups | Still to be implemented |
| Licensed continuous EPEX intraday data | Not connected |

Local validation checks the repository files and parsers. It does not replace live monitoring of the deployed n8n, PostgreSQL, and Grafana instances.

## First-Release Scope

The current release covers Germany and the Germany/Luxembourg bidding zone (`DE-LU`, EIC `10Y1001A1001A82H`).

The dashboard includes:

1. Target and actual grid frequency.
2. Calculated grid time.
3. Calculated cumulative grid-time deviation.
4. Current electricity delivery price.
5. 15-minute High, Low, and Last values.
6. 60-minute High, Low, and Last values.
7. Daily 15-minute Low and High statistics.
8. Daily 60-minute Low and High statistics.
9. Ingestion-health status.

All timestamps are stored as PostgreSQL `timestamptz`. Grafana displays them using `Europe/Berlin`, which handles CET and CEST automatically.

## Data Sources

| Requirement | Current source | Authentication | Schedule |
| --- | --- | --- | --- |
| Actual grid frequency | `netzfrequenzmessung.de` XML endpoint | None | Every 3 seconds |
| Target grid frequency | Configured Continental Europe target, `50.000 Hz` | None | Stored with each sample |
| Grid time and deviation | Calculated from stored frequency samples | None | Every 3 seconds |
| Primary DE-LU prices | ENTSO-E Transparency Platform, document `A44` | `ENTSOE_SECURITY_TOKEN` | Every 15 minutes |
| Price fallback/cross-check | SMARD filter `4169`, region `DE-LU` | None | Every 15 minutes |
| 15/60-minute derived values | PostgreSQL aggregation of stored price points | None | Every 5 minutes |
| Ingestion health | PostgreSQL health view | None | Every minute |

Detailed source decisions and endpoint contracts are in [`api/`](api/README.md).

## Important Data Limitations

The dashboard is honest about the capabilities of the selected free sources:

- ENTSO-E and SMARD provide official day-ahead delivery-interval prices. They are not continuous EPEX intraday trade feeds.
- The current-price panel shows the price for the delivery interval active now.
- A 15-minute interval normally has one auction clearing price, so its High, Low, and Last values can be equal.
- The 60-minute values aggregate quarter-hour delivery prices; they are not trade-by-trade OHLC values.
- Grid-time deviation is an internal frequency-integral approximation, not an official live grid-time API measurement.
- True continuous intraday Current/High/Low/Last requires a licensed EPEX/EEX feed or another approved trade-data provider.

See [`api/api_limitations_and_decisions.md`](api/api_limitations_and_decisions.md) for the full rationale.

## Repository Structure

```text
.
|-- api/             API selection, endpoints, and limitations
|-- client_docs/     Original client messages and technical brief
|-- database/        Executable PostgreSQL migrations and SQL references
|-- docs/            Requirements, architecture, schema, and roadmap
|-- grafana/         Dashboard generator, validator, and importable JSON
|-- scripts/         Local workflow and dashboard validation
|-- workflows/       Importable n8n workflow JSON files
|-- .env.example     Configuration reference without real secrets
`-- README.md        Main setup and operations guide
```

## Prerequisites

- PostgreSQL with permission to create the `energy_data` schema.
- n8n with Schedule Trigger, HTTP Request, Code, and PostgreSQL core nodes.
- Grafana with PostgreSQL datasource access.
- Node.js 18 or newer for local validation and dashboard generation.
- Outbound network access from n8n to ENTSO-E, SMARD, and `netzfrequenzmessung.de`.
- An ENTSO-E Transparency Platform security token for the primary price workflow.

No n8n community nodes are required.

## Required Credentials

| Credential or secret | Required by | Notes |
| --- | --- | --- |
| PostgreSQL host, port, database, user, password, and SSL mode | n8n | Assign one PostgreSQL credential to every PostgreSQL node |
| `ENTSOE_SECURITY_TOKEN` | n8n ENTSO-E workflow | Store in the n8n runtime environment or an approved secret store |
| Grafana PostgreSQL datasource credential | Grafana | Use a dedicated read-only database user in production |
| SMARD API key | Not required | The selected endpoint is public |
| `netzfrequenzmessung.de` API key | Not required | The selected endpoint is public |

Never commit real passwords or tokens. [`.env.example`](.env.example) contains placeholders only.

See [`api/entsoe_token_setup.md`](api/entsoe_token_setup.md) for the free ENTSO-E registration, API-access request, token generation, and n8n configuration steps.

## Installation

### 1. Create The PostgreSQL Objects

Apply these scripts to the same PostgreSQL database in this exact order:

1. [`database/001_create_energy_data_schema.sql`](database/001_create_energy_data_schema.sql)
2. [`database/002_seed_germany_sources.sql`](database/002_seed_germany_sources.sql)
3. [`database/003_create_views.sql`](database/003_create_views.sql)
4. [`database/005_align_client_api_sources.sql`](database/005_align_client_api_sources.sql)

The scripts are idempotent and can be applied again when necessary.

Do not run [`database/004_upsert_examples.sql`](database/004_upsert_examples.sql) as a migration. It contains reference queries for n8n PostgreSQL nodes.

Basic database verification:

```sql
select * from energy_data.data_sources order by code;
select * from energy_data.markets order by country_code, bidding_zone;
select * from energy_data.collector_settings order by key;
select * from energy_data.v_ingestion_health;
```

### 2. Configure n8n

Set the ENTSO-E token in the n8n runtime:

```text
ENTSOE_SECURITY_TOKEN=your_real_token
```

Create one PostgreSQL credential in n8n and assign it to every imported PostgreSQL node. The workflow JSON intentionally contains no database credential IDs or passwords.

Import and manually test the workflows in this order:

1. [`workflows/01_grid_frequency_netzfrequenzmessung_de.json`](workflows/01_grid_frequency_netzfrequenzmessung_de.json)
2. [`workflows/02_grid_time_deviation_calculated.json`](workflows/02_grid_time_deviation_calculated.json)
3. [`workflows/03_market_prices_entsoe_de_lu.json`](workflows/03_market_prices_entsoe_de_lu.json)
4. [`workflows/03a_market_prices_smard_de_lu.json`](workflows/03a_market_prices_smard_de_lu.json)
5. [`workflows/04_market_price_ohlc_builder.json`](workflows/04_market_price_ohlc_builder.json)
6. [`workflows/05_ingestion_health_monitor.json`](workflows/05_ingestion_health_monitor.json)

Keep each workflow inactive until its manual execution succeeds. Activate it only after confirming the expected PostgreSQL rows.

The complete test sequence is in [`workflows/IMPORT_TEST_CHECKLIST.md`](workflows/IMPORT_TEST_CHECKLIST.md).

### 3. Verify Stored Data

```sql
select * from energy_data.v_grid_frequency_latest;
select * from energy_data.v_grid_time_deviation_latest;
select * from energy_data.v_grafana_current_market_price;
select *
from energy_data.v_grafana_market_price_stats_today
order by source_code, interval_type;
select * from energy_data.v_ingestion_health;
select *
from energy_data.ingestion_alerts
where resolved_at is null;
```

### 4. Import The Grafana Dashboard

The ready-to-import file is:

[`grafana/dashboards/germany-energy-monitoring.json`](grafana/dashboards/germany-energy-monitoring.json)

In Grafana:

1. Open **Dashboards**.
2. Open the **New** drop-down.
3. Select **Import dashboard**.
4. Upload `germany-energy-monitoring.json`.
5. Map **Energy Data Hub PostgreSQL** to the connected PostgreSQL datasource.
6. Click **Import**.
7. Leave **Price source** on `Auto`, or force `ENTSO-E`/`SMARD` for comparison.

Do not paste the classic dashboard JSON into the `{}` **Edit as code** sidebar. That editor is not the dashboard-import page.

[`grafana/generate_dashboard.js`](grafana/generate_dashboard.js) is the JavaScript source used locally to generate the JSON. It is not uploaded to Grafana.

Regenerate the import file after changing the dashboard source:

```powershell
node .\grafana\generate_dashboard.js
node .\scripts\validate_grafana_dashboard.js
```

## n8n Workflow Reference

| Workflow | Nodes | Purpose |
| --- | ---: | --- |
| `grid_frequency_netzfrequenzmessung_de` | 4 | Fetch, parse, and store live frequency |
| `grid_time_deviation_calculated` | 2 | Integrate new frequency samples and store calculated deviation |
| `market_prices_entsoe_de_lu` | 5 | Fetch, parse, and store ENTSO-E `A44` price points |
| `market_prices_smard_de_lu` | 6 | Resolve the latest SMARD series and bulk-upsert valid prices |
| `market_price_ohlc_builder` | 2 | Build separate 15/60-minute aggregates for each source |
| `ingestion_health_monitor` | 2 | Insert, refresh, and resolve stale-data alerts |

Two-node workflows are intentional when PostgreSQL performs the calculation atomically in one SQL statement.

## PostgreSQL Model

Core tables:

| Table | Purpose |
| --- | --- |
| `data_sources` | Provider registry and source metadata |
| `markets` | Country, bidding zone, EIC, and timezone |
| `collector_settings` | Non-secret collector configuration and secret placeholders |
| `raw_api_payloads` | Source-response audit and troubleshooting archive |
| `grid_frequency_measurements` | Target and actual frequency samples |
| `grid_time_deviation_measurements` | Calculated grid time and deviation |
| `market_price_points` | Normalized source delivery prices |
| `market_price_ohlc` | Derived 15/60-minute High, Low, and Last values |
| `ingestion_runs` | Workflow execution records |
| `ingestion_alerts` | Open and resolved stale-data alerts |
| `workflow_state` | Incremental calculation state |

Grafana and operations views:

- `v_grid_frequency_latest`
- `v_grid_time_deviation_latest`
- `v_market_price_latest`
- `v_grafana_grid_frequency`
- `v_grafana_grid_time_deviation`
- `v_grafana_market_price_points`
- `v_grafana_current_market_price`
- `v_grafana_market_price_ohlc`
- `v_grafana_market_price_stats_24h`
- `v_grafana_market_price_stats_today`
- `v_ingestion_health`

## Validation

Run both local validators before committing workflow or dashboard changes:

```powershell
node .\scripts\validate_workflows.js
node .\scripts\validate_grafana_dashboard.js
```

Optional live API contract checks:

```powershell
node .\scripts\validate_workflows.js --live-frequency
node .\scripts\validate_workflows.js --live-smard
```

The default workflow validator checks:

- Valid workflow JSON.
- Unique node IDs and names.
- Valid node connections.
- JavaScript syntax in Code nodes.
- PostgreSQL query presence.
- SMARD null-price handling.
- ENTSO-E quarter-hour parser behavior.

The dashboard validator checks:

- All required panels.
- Required PostgreSQL object references.
- Unique panel IDs.
- Shared price-source filtering.
- `Europe/Berlin` timezone.
- Five-second dashboard refresh.

## Operations

Check ingestion freshness:

```sql
select * from energy_data.v_ingestion_health;
```

Check unresolved alerts:

```sql
select *
from energy_data.ingestion_alerts
where resolved_at is null
order by severity, last_seen_at desc;
```

Check recent workflow records:

```sql
select *
from energy_data.ingestion_runs
order by started_at desc
limit 100;
```

At a three-second interval, each grid measurement table can receive approximately 28,800 rows per day. Define retention and downsampling before retaining high-frequency data indefinitely.

## Troubleshooting

### Grafana Import Is Not Visible

Leave the new-dashboard editor, return to **Dashboards**, open the **New** drop-down, and select **Import dashboard**.

### Grafana Shows No Frequency Data

- Confirm the frequency workflow is active.
- Query `v_grid_frequency_latest`.
- Use a Grafana time range that includes recent data.
- Confirm the dashboard is mapped to the correct PostgreSQL datasource.

### A Price Panel Shows No Data

- Leave **Price source** on `Auto`, or switch between `ENTSO-E` and `SMARD`.
- Confirm the selected source has an interval covering the current time.
- Run the OHLC builder after the price collector.
- Query `v_grafana_market_price_stats_today`.
- Run [`grafana/dashboard_data_diagnostics.sql`](grafana/dashboard_data_diagnostics.sql) to see exactly which source and interval is missing.

### ENTSO-E Returns Authentication Errors

- Confirm `ENTSOE_SECURITY_TOKEN` exists inside the n8n runtime, not only on the local computer.
- Restart n8n after changing its runtime environment.
- Confirm the token has Transparency Platform Web API access.

### PostgreSQL Authentication Fails

- Re-enter the password instead of copying a masked value.
- Confirm the database name, host, port, username, SSL mode, and network access.
- Assign the correct n8n credential to every PostgreSQL node.

### Grid-Time Values Differ From An Official Source

This is expected within the current implementation. The value is marked as calculated and should be replaced when an approved official live grid-time endpoint becomes available.

## Recommended Next Work

The most important production improvements are:

1. Add centralized n8n error handling, retries, and real failed-run records.
2. Deliver health alerts through email, Teams, Slack, or another approved channel.
3. Add retention, one-minute downsampling, and cleanup for high-frequency tables and raw payloads.
4. Create separate n8n writer and Grafana read-only PostgreSQL roles.
5. Add automated PostgreSQL backups and a tested restore procedure.
6. Reconcile ENTSO-E and SMARD prices and alert on missing intervals or material differences.
7. Provision the Grafana dashboard from version-controlled JSON for repeatable deployment.
8. Add a licensed EPEX/EEX feed when true continuous intraday prices are required.

Client-requested future modules:

- Net generation mix by energy source.
- Cross-border electricity flows.
- Wind, solar, and load forecasts.
- Balancing-energy activations.
- Austria, France, and Switzerland market expansion.
- Historical backfill and longer-term analytics.

## Documentation

- [Client requirement traceability](docs/client_requirements_traceability.md)
- [Requirements analysis](docs/requirements_analysis.md)
- [Development roadmap](docs/development_roadmap.md)
- [Database setup](database/README.md)
- [n8n workflow setup](workflows/README.md)
- [Grafana dashboard setup](grafana/README.md)
- [Germany API selection](api/germany_api_selection.md)
- [Germany endpoint reference](api/germany_endpoint_reference.md)
