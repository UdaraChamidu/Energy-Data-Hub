# Database Schema Design

This document designs the PostgreSQL schema required for the first dashboard rebuild. It is not a migration file; implementation should wait for approval.

## Design Goals

- Store clean time-series values for Grafana.
- Preserve enough raw source data to debug API/provider issues.
- Support multiple countries and bidding zones.
- Avoid duplicate records from repeated n8n retries.
- Keep high-frequency grid data separate from slower market data.
- Make Grafana queries simple and fast.

## Naming Conventions

- Schema name: `energy_data`.
- Timestamps: `timestamptz`, stored in UTC.
- Money values: `numeric`, not floating point.
- Frequency values: `numeric`, because small precision differences matter.
- Tables include audit timestamps appropriate to their purpose, such as `created_at`, `ingested_at`, `received_at`, `started_at`, and `finished_at`.
- Source deduplication uses provider, market/country, measurement interval, and source timestamp where available.

## Tables

### 1. `energy_data.data_sources`

Purpose:

- Registry of external providers such as SMARD, netzfrequenzmessung, ENTSO-E, and aWATTar.
- Allows provider metadata, source status, and Grafana filtering.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Stable internal source ID |
| `code` | text unique | Machine code such as `smard`, `entsoe` |
| `name` | text | Human-readable source name |
| `base_url` | text | Operational reference |
| `requires_auth` | boolean | Credential planning |
| `is_active` | boolean | Disable source without deleting data |
| `created_at` | timestamptz | Audit |

### 2. `energy_data.markets`

Purpose:

- Stores countries, bidding zones, and market identifiers.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Stable internal market ID |
| `country_code` | char(2) | DE, AT, FR, CH |
| `bidding_zone` | text | API-specific zone such as DE-LU, AT, FR, CH |
| `display_name` | text | Grafana labels |
| `timezone` | text | Display and interval interpretation |
| `is_active` | boolean | Scope control |

### 3. `energy_data.grid_frequency_measurements`

Purpose:

- Stores target and actual grid frequency.
- Drives the "Netzfrequenz" panel.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Row identifier |
| `source_id` | bigint fk | Provider traceability |
| `market_id` | bigint fk nullable | Country/zone when applicable |
| `measured_at` | timestamptz | Time-series X-axis |
| `target_hz` | numeric(8,4) | Required target frequency |
| `actual_hz` | numeric(8,4) | Required actual frequency |
| `source_published_at` | timestamptz nullable | Provider publication time |
| `ingested_at` | timestamptz | Collector timing |
| `quality` | text | `ok`, `estimated`, `missing`, `error` |
| `raw_payload_id` | bigint nullable | Debug link |

Recommended unique key:

- `(source_id, market_id, measured_at)`.

### 4. `energy_data.grid_time_deviation_measurements`

Purpose:

- Stores grid time and time deviation.
- Drives the "Netzzeitabweichung" panel.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Row identifier |
| `source_id` | bigint fk | Provider traceability |
| `market_id` | bigint fk nullable | Country/zone when applicable |
| `measured_at` | timestamptz | Time-series X-axis |
| `grid_time` | timestamptz nullable | Required grid time value |
| `deviation_seconds` | numeric(12,3) | Required time deviation |
| `source_published_at` | timestamptz nullable | Provider publication time |
| `ingested_at` | timestamptz | Collector timing |
| `quality` | text | Data quality/status |
| `raw_payload_id` | bigint nullable | Debug link |

Recommended unique key:

- `(source_id, market_id, measured_at)`.

### 5. `energy_data.market_price_points`

Purpose:

- Stores individual market price records from the selected source.
- Can represent current intraday price, 15-minute products, hourly products, or day-ahead prices.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Row identifier |
| `source_id` | bigint fk | Provider traceability |
| `market_id` | bigint fk | Bidding zone/country |
| `product` | text | `intraday`, `quarter_hour`, `hour`, `day_ahead` |
| `delivery_start` | timestamptz | Start of delivery interval |
| `delivery_end` | timestamptz | End of delivery interval |
| `price_eur_mwh` | numeric(14,6) | Required price |
| `currency` | char(3) | Usually EUR |
| `source_published_at` | timestamptz nullable | Publication time |
| `source_trade_id` | text nullable | Deduplication if available |
| `ingested_at` | timestamptz | Collector timing |
| `raw_payload_id` | bigint nullable | Debug link |

Recommended unique key:

- If source trade IDs exist: `(source_id, source_trade_id)`.
- Otherwise: `(source_id, market_id, product, delivery_start, delivery_end, source_published_at)`.

### 6. `energy_data.market_price_ohlc`

Purpose:

- Stores high, low, and last for 15-minute and 60-minute Grafana panels.
- Can be populated directly from the API or calculated from `market_price_points`.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Row identifier |
| `source_id` | bigint fk | Provider/calculation traceability |
| `market_id` | bigint fk | Bidding zone/country |
| `interval_type` | text | `15m` or `60m` |
| `interval_start` | timestamptz | Grafana X-axis |
| `interval_end` | timestamptz | Interval boundary |
| `high_price_eur_mwh` | numeric(14,6) | Required high |
| `low_price_eur_mwh` | numeric(14,6) | Required low |
| `last_price_eur_mwh` | numeric(14,6) | Required last |
| `calculated_from` | text | `api`, `market_price_points`, `manual_backfill` |
| `calculated_at` | timestamptz | Audit |

Recommended unique key:

- `(source_id, market_id, interval_type, interval_start, interval_end)`.

### 7. `energy_data.raw_api_payloads`

Purpose:

- Stores compact raw responses for troubleshooting, replay, and auditing.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Row identifier |
| `source_id` | bigint fk | Provider traceability |
| `workflow_name` | text | n8n workflow reference |
| `request_url` | text | Debugging |
| `request_hash` | text | Avoid storing duplicate payloads |
| `response_status` | integer | HTTP status |
| `payload` | jsonb | Raw response |
| `received_at` | timestamptz | Audit |

Retention note:

- This table can grow quickly. Retention should be agreed with the client.

### 8. `energy_data.ingestion_runs`

Purpose:

- Records each n8n workflow execution.
- Helps prove uptime and diagnose gaps.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Row identifier |
| `workflow_name` | text | n8n workflow |
| `source_id` | bigint fk nullable | Provider |
| `started_at` | timestamptz | Runtime tracking |
| `finished_at` | timestamptz nullable | Runtime tracking |
| `status` | text | `success`, `partial`, `failed` |
| `records_read` | integer | Operational metric |
| `records_written` | integer | Operational metric |
| `error_message` | text nullable | Failure reason |

### 9. `energy_data.ingestion_alerts`

Purpose:

- Stores alert-worthy ingestion issues so operations can see repeated failures.

Important columns:

| Column | Type | Why needed |
| --- | --- | --- |
| `id` | bigserial primary key | Row identifier |
| `workflow_name` | text | n8n workflow |
| `severity` | text | `warning`, `error`, `critical` |
| `message` | text | Human-readable issue |
| `first_seen_at` | timestamptz | Alert lifecycle |
| `last_seen_at` | timestamptz | Alert lifecycle |
| `resolved_at` | timestamptz nullable | Closeout |

## Grafana-Oriented Views

The following views are recommended after tables are approved:

### `energy_data.v_grafana_grid_frequency`

Columns:

- `time`
- `country_code`
- `bidding_zone`
- `target_hz`
- `actual_hz`
- `quality`

Purpose:

- Simple query source for the Netzfrequenz panel.

### `energy_data.v_grafana_grid_time_deviation`

Columns:

- `time`
- `country_code`
- `bidding_zone`
- `grid_time`
- `deviation_seconds`
- `quality`

Purpose:

- Simple query source for the Netzzeitabweichung panel.

### `energy_data.v_grafana_market_price_ohlc`

Columns:

- `time`
- `country_code`
- `bidding_zone`
- `interval_type`
- `high_price_eur_mwh`
- `low_price_eur_mwh`
- `last_price_eur_mwh`

Purpose:

- Source for 15-minute and 60-minute EPEX panels.

### `energy_data.v_grafana_market_price_stats`

Columns:

- `country_code`
- `bidding_zone`
- `interval_type`
- `low_price_eur_mwh`
- `high_price_eur_mwh`
- `calculated_at`

Purpose:

- Source for the four single stat panels.

## Indexing Plan

Recommended indexes:

- `grid_frequency_measurements (market_id, measured_at desc)`.
- `grid_time_deviation_measurements (market_id, measured_at desc)`.
- `market_price_points (market_id, product, delivery_start desc)`.
- `market_price_ohlc (market_id, interval_type, interval_start desc)`.
- `ingestion_runs (workflow_name, started_at desc)`.
- `raw_api_payloads (source_id, received_at desc)`.

## Retention Planning

High-frequency 1-second data grows quickly:

- 1 country at 1-second interval: about 86,400 rows per day per metric table.
- 4 countries at 1-second interval: about 345,600 rows per day per metric table.

Retention options:

- Keep raw 1-second grid data for 30 to 90 days.
- Downsample older data to 1-minute aggregates.
- Keep market data permanently because volume is much lower.

This must be approved before implementation.
