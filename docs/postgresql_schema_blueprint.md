# PostgreSQL Schema Blueprint

This is the proposed schema in SQL form for review. It should be converted into migration scripts in `database/` only after approval.

```sql
create schema if not exists energy_data;

create table energy_data.data_sources (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  base_url text,
  requires_auth boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table energy_data.markets (
  id bigserial primary key,
  country_code char(2) not null,
  bidding_zone text not null,
  display_name text not null,
  timezone text not null default 'Europe/Berlin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_code, bidding_zone)
);

create table energy_data.raw_api_payloads (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  workflow_name text not null,
  request_url text,
  request_hash text,
  response_status integer,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table energy_data.grid_frequency_measurements (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint references energy_data.markets(id),
  measured_at timestamptz not null,
  target_hz numeric(8,4) not null,
  actual_hz numeric(8,4) not null,
  source_published_at timestamptz,
  ingested_at timestamptz not null default now(),
  quality text not null default 'ok',
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, measured_at)
);

create table energy_data.grid_time_deviation_measurements (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint references energy_data.markets(id),
  measured_at timestamptz not null,
  grid_time timestamptz,
  deviation_seconds numeric(12,3) not null,
  source_published_at timestamptz,
  ingested_at timestamptz not null default now(),
  quality text not null default 'ok',
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, measured_at)
);

create table energy_data.market_price_points (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  product text not null,
  delivery_start timestamptz not null,
  delivery_end timestamptz not null,
  price_eur_mwh numeric(14,6) not null,
  currency char(3) not null default 'EUR',
  source_published_at timestamptz,
  source_trade_id text,
  ingested_at timestamptz not null default now(),
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, product, delivery_start, delivery_end, source_published_at)
);

create unique index market_price_points_source_trade_uidx
on energy_data.market_price_points (source_id, source_trade_id)
where source_trade_id is not null;

create table energy_data.market_price_ohlc (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  interval_type text not null,
  interval_start timestamptz not null,
  interval_end timestamptz not null,
  high_price_eur_mwh numeric(14,6) not null,
  low_price_eur_mwh numeric(14,6) not null,
  last_price_eur_mwh numeric(14,6) not null,
  calculated_from text not null,
  calculated_at timestamptz not null default now(),
  unique (source_id, market_id, interval_type, interval_start, interval_end)
);

create table energy_data.ingestion_runs (
  id bigserial primary key,
  workflow_name text not null,
  source_id bigint references energy_data.data_sources(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  records_read integer not null default 0,
  records_written integer not null default 0,
  error_message text
);

create table energy_data.ingestion_alerts (
  id bigserial primary key,
  workflow_name text not null,
  severity text not null,
  message text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index grid_frequency_market_time_idx
on energy_data.grid_frequency_measurements (market_id, measured_at desc);

create index grid_time_deviation_market_time_idx
on energy_data.grid_time_deviation_measurements (market_id, measured_at desc);

create index market_price_points_market_product_time_idx
on energy_data.market_price_points (market_id, product, delivery_start desc);

create index market_price_ohlc_market_interval_time_idx
on energy_data.market_price_ohlc (market_id, interval_type, interval_start desc);

create index raw_api_payloads_source_received_idx
on energy_data.raw_api_payloads (source_id, received_at desc);

create index ingestion_runs_workflow_started_idx
on energy_data.ingestion_runs (workflow_name, started_at desc);
```

## Proposed Grafana Views

```sql
create view energy_data.v_grafana_grid_frequency as
select
  g.measured_at as "time",
  m.country_code,
  m.bidding_zone,
  g.target_hz,
  g.actual_hz,
  g.quality
from energy_data.grid_frequency_measurements g
left join energy_data.markets m on m.id = g.market_id;

create view energy_data.v_grafana_grid_time_deviation as
select
  g.measured_at as "time",
  m.country_code,
  m.bidding_zone,
  g.grid_time,
  g.deviation_seconds,
  g.quality
from energy_data.grid_time_deviation_measurements g
left join energy_data.markets m on m.id = g.market_id;

create view energy_data.v_grafana_market_price_ohlc as
select
  p.interval_start as "time",
  m.country_code,
  m.bidding_zone,
  p.interval_type,
  p.high_price_eur_mwh,
  p.low_price_eur_mwh,
  p.last_price_eur_mwh
from energy_data.market_price_ohlc p
join energy_data.markets m on m.id = p.market_id;

create view energy_data.v_grafana_market_price_stats as
select
  m.country_code,
  m.bidding_zone,
  p.interval_type,
  min(p.low_price_eur_mwh) as low_price_eur_mwh,
  max(p.high_price_eur_mwh) as high_price_eur_mwh,
  max(p.calculated_at) as calculated_at
from energy_data.market_price_ohlc p
join energy_data.markets m on m.id = p.market_id
where p.interval_start >= now() - interval '24 hours'
group by m.country_code, m.bidding_zone, p.interval_type;
```

## Seed Data To Confirm

Likely source rows:

- `smard`
- `netzfrequenzmessung`
- `entsoe`
- `awattar`

Likely market rows:

- Germany: `DE-LU` or exact approved German bidding zone.
- Austria: `AT`.
- France: `FR`.
- Switzerland: `CH`.

The exact codes should be confirmed against the selected API provider before migrations are created.

