-- Add Fraunhofer ISE Energy-Charts as the provisional intraday source.

begin;

insert into energy_data.data_sources (
  code,
  name,
  base_url,
  requires_auth,
  is_active,
  notes
)
values (
  'energy_charts',
  'Fraunhofer ISE Energy-Charts',
  'https://energy-charts.info/charts/price_spot_market/data/de/',
  false,
  true,
  'Client-approved provisional source. Provides continuous intraday Average, Low, High, ID1 and ID3, but not Last.'
)
on conflict (code) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  requires_auth = excluded.requires_auth,
  is_active = excluded.is_active,
  notes = excluded.notes,
  updated_at = now();

insert into energy_data.collector_settings (key, value, description, is_secret)
values
  (
    'ENERGY_CHARTS_INTRADAY_BASE_URL',
    'https://energy-charts.info/charts/price_spot_market/data/de/',
    'Fraunhofer Energy-Charts weekly JSON directory used by the provisional collector.',
    false
  ),
  (
    'ENERGY_CHARTS_COLLECTION_INTERVAL_MINUTES',
    '30',
    'Polling interval for the two provisional intraday files.',
    false
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

create table if not exists energy_data.energy_charts_intraday_prices (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  interval_type text not null,
  interval_start timestamptz not null,
  interval_end timestamptz not null,
  average_price_eur_mwh numeric(14,6) not null,
  low_price_eur_mwh numeric(14,6) not null,
  high_price_eur_mwh numeric(14,6) not null,
  id1_price_eur_mwh numeric(14,6),
  id3_price_eur_mwh numeric(14,6),
  source_published_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, interval_type, interval_start, interval_end),
  constraint energy_charts_interval_type_chk check (interval_type in ('15m', '60m')),
  constraint energy_charts_window_chk check (interval_end > interval_start),
  constraint energy_charts_price_bounds_chk check (
    high_price_eur_mwh >= low_price_eur_mwh
    and average_price_eur_mwh between low_price_eur_mwh and high_price_eur_mwh
  )
);

create index if not exists energy_charts_intraday_market_time_idx
on energy_data.energy_charts_intraday_prices (market_id, interval_type, interval_start desc);

create index if not exists energy_charts_intraday_source_time_idx
on energy_data.energy_charts_intraday_prices (source_id, interval_start desc);

create or replace view energy_data.v_grafana_energy_charts_intraday as
select
  p.interval_start as "time",
  p.interval_start,
  p.interval_end,
  p.interval_type,
  p.average_price_eur_mwh,
  p.low_price_eur_mwh,
  p.high_price_eur_mwh,
  p.id1_price_eur_mwh,
  p.id3_price_eur_mwh,
  p.source_published_at,
  p.ingested_at,
  s.code as source_code,
  m.country_code,
  m.bidding_zone
from energy_data.energy_charts_intraday_prices p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id;

create or replace view energy_data.v_grafana_energy_charts_intraday_latest as
select distinct on (p.interval_type, m.id)
  p.interval_start as "time",
  p.interval_end,
  p.interval_type,
  p.average_price_eur_mwh,
  p.low_price_eur_mwh,
  p.high_price_eur_mwh,
  p.id1_price_eur_mwh,
  p.id3_price_eur_mwh,
  p.source_published_at,
  p.ingested_at,
  m.country_code,
  m.bidding_zone
from energy_data.energy_charts_intraday_prices p
join energy_data.markets m on m.id = p.market_id
order by p.interval_type, m.id, p.interval_start desc, p.source_published_at desc;

create or replace view energy_data.v_grafana_energy_charts_intraday_stats_today as
select
  p.interval_type,
  min(p.low_price_eur_mwh) as low_price_eur_mwh,
  max(p.high_price_eur_mwh) as high_price_eur_mwh,
  max(p.source_published_at) as source_published_at,
  m.country_code,
  m.bidding_zone
from energy_data.energy_charts_intraday_prices p
join energy_data.markets m on m.id = p.market_id
where (p.interval_start at time zone m.timezone)::date =
      (now() at time zone m.timezone)::date
group by p.interval_type, m.country_code, m.bidding_zone;

create or replace view energy_data.v_grafana_energy_charts_intraday_stats_latest_day as
with latest_days as (
  select
    p.market_id,
    p.interval_type,
    max((p.interval_start at time zone m.timezone)::date) as latest_date
  from energy_data.energy_charts_intraday_prices p
  join energy_data.markets m on m.id = p.market_id
  group by p.market_id, p.interval_type
)
select
  p.interval_type,
  min(p.low_price_eur_mwh) as low_price_eur_mwh,
  max(p.high_price_eur_mwh) as high_price_eur_mwh,
  max(p.source_published_at) as source_published_at,
  d.latest_date,
  m.country_code,
  m.bidding_zone
from energy_data.energy_charts_intraday_prices p
join energy_data.markets m on m.id = p.market_id
join latest_days d
  on d.market_id = p.market_id
 and d.interval_type = p.interval_type
 and d.latest_date = (p.interval_start at time zone m.timezone)::date
group by p.interval_type, d.latest_date, m.country_code, m.bidding_zone;

commit;
