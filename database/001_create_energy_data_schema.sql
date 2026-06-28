-- Energy Data Hub PostgreSQL foundation.
-- Apply first. Safe to run more than once on a new or existing database.

begin;

create schema if not exists energy_data;

create table if not exists energy_data.data_sources (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  base_url text,
  requires_auth boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists energy_data.markets (
  id bigserial primary key,
  country_code char(2) not null,
  bidding_zone text not null,
  eic_code text,
  display_name text not null,
  timezone text not null default 'Europe/Berlin',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, bidding_zone),
  unique (eic_code)
);

create table if not exists energy_data.collector_settings (
  key text primary key,
  value text not null,
  description text,
  is_secret boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists energy_data.raw_api_payloads (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  workflow_name text not null,
  request_url text,
  request_hash text,
  response_status integer,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists energy_data.grid_frequency_measurements (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  measured_at timestamptz not null,
  target_hz numeric(8,4) not null,
  actual_hz numeric(8,4) not null,
  source_published_at timestamptz not null default timestamp with time zone '1970-01-01 00:00:00+00',
  ingested_at timestamptz not null default now(),
  quality text not null default 'ok',
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, measured_at),
  constraint grid_frequency_quality_chk check (quality in ('ok', 'estimated', 'calculated', 'missing', 'error')),
  constraint grid_frequency_target_chk check (target_hz > 0),
  constraint grid_frequency_actual_chk check (actual_hz > 0)
);

create table if not exists energy_data.grid_time_deviation_measurements (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  measured_at timestamptz not null,
  grid_time timestamptz,
  deviation_seconds numeric(12,3) not null,
  source_published_at timestamptz not null default timestamp with time zone '1970-01-01 00:00:00+00',
  ingested_at timestamptz not null default now(),
  quality text not null default 'calculated',
  calculation_method text,
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, measured_at),
  constraint grid_time_deviation_quality_chk check (quality in ('ok', 'estimated', 'calculated', 'missing', 'error'))
);

create table if not exists energy_data.market_price_points (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  product text not null,
  delivery_start timestamptz not null,
  delivery_end timestamptz not null,
  price_eur_mwh numeric(14,6) not null,
  currency char(3) not null default 'EUR',
  source_published_at timestamptz not null default timestamp with time zone '1970-01-01 00:00:00+00',
  source_trade_id text,
  source_position integer,
  resolution text,
  ingested_at timestamptz not null default now(),
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, product, delivery_start, delivery_end, source_published_at),
  constraint market_price_product_chk check (
    product in (
      'day_ahead',
      'quarter_hour_day_ahead',
      'hour_day_ahead',
      'intraday_continuous',
      'intraday_index',
      'awattar_marketdata',
      'unknown'
    )
  ),
  constraint market_price_delivery_window_chk check (delivery_end > delivery_start)
);

create unique index if not exists market_price_points_source_trade_uidx
on energy_data.market_price_points (source_id, source_trade_id)
where source_trade_id is not null;

create table if not exists energy_data.market_price_ohlc (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  interval_type text not null,
  interval_start timestamptz not null,
  interval_end timestamptz not null,
  high_price_eur_mwh numeric(14,6) not null,
  low_price_eur_mwh numeric(14,6) not null,
  last_price_eur_mwh numeric(14,6) not null,
  observation_count integer not null default 1,
  calculated_from text not null,
  calculated_at timestamptz not null default now(),
  unique (source_id, market_id, interval_type, interval_start, interval_end),
  constraint market_price_ohlc_interval_type_chk check (interval_type in ('15m', '60m')),
  constraint market_price_ohlc_window_chk check (interval_end > interval_start),
  constraint market_price_ohlc_count_chk check (observation_count > 0),
  constraint market_price_ohlc_bounds_chk check (
    high_price_eur_mwh >= low_price_eur_mwh
    and last_price_eur_mwh <= high_price_eur_mwh
    and last_price_eur_mwh >= low_price_eur_mwh
  )
);

create table if not exists energy_data.ingestion_runs (
  id bigserial primary key,
  workflow_name text not null,
  source_id bigint references energy_data.data_sources(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  records_read integer not null default 0,
  records_written integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint ingestion_runs_status_chk check (status in ('running', 'success', 'partial', 'failed')),
  constraint ingestion_runs_counts_chk check (records_read >= 0 and records_written >= 0)
);

create table if not exists energy_data.ingestion_alerts (
  id bigserial primary key,
  workflow_name text not null,
  severity text not null,
  message text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint ingestion_alerts_severity_chk check (severity in ('info', 'warning', 'error', 'critical'))
);

create table if not exists energy_data.workflow_state (
  workflow_name text primary key,
  source_id bigint references energy_data.data_sources(id),
  last_success_at timestamptz,
  last_source_timestamp timestamptz,
  last_processed_key text,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists grid_frequency_market_time_idx
on energy_data.grid_frequency_measurements (market_id, measured_at desc);

create index if not exists grid_frequency_source_time_idx
on energy_data.grid_frequency_measurements (source_id, measured_at desc);

create index if not exists grid_time_deviation_market_time_idx
on energy_data.grid_time_deviation_measurements (market_id, measured_at desc);

create index if not exists grid_time_deviation_source_time_idx
on energy_data.grid_time_deviation_measurements (source_id, measured_at desc);

create index if not exists market_price_points_market_product_time_idx
on energy_data.market_price_points (market_id, product, delivery_start desc);

create index if not exists market_price_points_source_time_idx
on energy_data.market_price_points (source_id, delivery_start desc);

create index if not exists market_price_ohlc_market_interval_time_idx
on energy_data.market_price_ohlc (market_id, interval_type, interval_start desc);

create index if not exists raw_api_payloads_source_received_idx
on energy_data.raw_api_payloads (source_id, received_at desc);

create index if not exists raw_api_payloads_request_hash_idx
on energy_data.raw_api_payloads (request_hash)
where request_hash is not null;

create index if not exists ingestion_runs_workflow_started_idx
on energy_data.ingestion_runs (workflow_name, started_at desc);

create index if not exists ingestion_runs_status_started_idx
on energy_data.ingestion_runs (status, started_at desc);

create index if not exists ingestion_alerts_open_idx
on energy_data.ingestion_alerts (severity, last_seen_at desc)
where resolved_at is null;

commit;
