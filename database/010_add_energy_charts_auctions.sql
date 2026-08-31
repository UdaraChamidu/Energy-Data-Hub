-- Add Fraunhofer Day-Ahead and IDA1-3 auction clearing prices.
-- Safe to run more than once. Apply after migration 007.

begin;

insert into energy_data.data_sources (
  code, name, base_url, requires_auth, is_active, notes
)
values (
  'energy_charts',
  'Fraunhofer ISE Energy-Charts',
  'https://energy-charts.info/',
  false,
  true,
  'Provisional source for DE-LU Day-Ahead and IDA1-3 auction clearing prices. Weekly chart JSON is validated and archived because it is not a documented stable API contract.'
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
    'ENERGY_CHARTS_AUCTION_BASE_URL',
    'https://energy-charts.info/charts/price_spot_market/data/de/',
    'Fraunhofer 15-minute weekly chart JSON used for DE-LU Day-Ahead and IDA1-3 auction curves.',
    false
  ),
  (
    'ENERGY_CHARTS_AUCTION_POLL_MINUTES',
    '30',
    'Polling interval for provisional Fraunhofer auction results.',
    false
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

create table if not exists energy_data.energy_charts_auction_prices (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  auction_code text not null,
  delivery_start timestamptz not null,
  delivery_end timestamptz not null,
  price_eur_mwh numeric(14,6) not null,
  currency char(3) not null default 'EUR',
  source_series_name text not null,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  ingested_at timestamptz not null default now(),
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, auction_code, delivery_start, delivery_end),
  constraint energy_charts_auction_code_chk
    check (auction_code in ('day_ahead', 'ida1', 'ida2', 'ida3')),
  constraint energy_charts_auction_window_chk
    check (delivery_end = delivery_start + interval '15 minutes')
);

create index if not exists energy_charts_auction_market_time_idx
on energy_data.energy_charts_auction_prices
  (market_id, auction_code, delivery_start desc);

create index if not exists energy_charts_auction_observed_idx
on energy_data.energy_charts_auction_prices (last_observed_at desc);

create or replace view energy_data.v_grafana_energy_charts_auctions as
select
  p.delivery_start as "time",
  p.delivery_start,
  p.delivery_end,
  p.auction_code,
  p.price_eur_mwh,
  p.currency,
  p.source_series_name,
  p.first_observed_at,
  p.last_observed_at,
  p.ingested_at,
  s.code as source_code,
  m.country_code,
  m.bidding_zone,
  m.timezone
from energy_data.energy_charts_auction_prices p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id;

create or replace view energy_data.v_energy_charts_auction_coverage as
select
  p.auction_code,
  count(*) as row_count,
  min(p.delivery_start) as earliest_delivery,
  max(p.delivery_end) as latest_delivery,
  max(p.last_observed_at) as latest_source_check,
  count(*) filter (
    where (p.delivery_start at time zone m.timezone)::date =
          (now() at time zone m.timezone)::date
  ) as rows_today_berlin,
  count(*) filter (
    where (p.delivery_start at time zone m.timezone)::date =
          ((now() at time zone m.timezone)::date + 1)
  ) as rows_tomorrow_berlin
from energy_data.energy_charts_auction_prices p
join energy_data.markets m on m.id = p.market_id
group by p.auction_code;

commit;

select case
  when to_regclass('energy_data.energy_charts_auction_prices') is not null
   and to_regclass('energy_data.v_grafana_energy_charts_auctions') is not null
   and to_regclass('energy_data.v_energy_charts_auction_coverage') is not null
  then 'Migration 010 completed successfully'
  else 'Migration 010 verification failed'
end as migration_status;
