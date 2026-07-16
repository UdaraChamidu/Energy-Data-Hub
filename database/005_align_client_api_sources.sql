-- Align an already-created Germany-first database with the final client API selection.
-- Safe to run after 001-003. New installations receive the same values from 002 and 003.

begin;

update energy_data.data_sources
set
  is_active = true,
  notes = 'Client-named Bundesnetzagentur source. Used for the DE-LU quarter-hour wholesale-price fallback/cross-check; not a live frequency source.',
  updated_at = now()
where code = 'smard';

insert into energy_data.collector_settings (key, value, description, is_secret)
values
  ('SMARD_INDEX_URL', 'https://www.smard.de/app/chart_data/4169/DE-LU/index_quarterhour.json', 'SMARD index for Germany/Luxembourg quarter-hour wholesale-price chunks.', false),
  ('SMARD_PRICE_FILTER', '4169', 'SMARD wholesale-price filter for Germany/Luxembourg.', false),
  ('SMARD_PRICE_REGION', 'DE-LU', 'SMARD market region for the Germany-first build.', false),
  ('SMARD_PRICE_RESOLUTION', 'quarterhour', 'SMARD price-series resolution.', false),
  ('SMARD_PRICE_POLL_MINUTES', '15', 'SMARD fallback/cross-check polling interval.', false)
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

create or replace view energy_data.v_grafana_current_market_price as
with ranked_current_prices as (
  select
    p.delivery_start as "time",
    s.code as source_code,
    m.country_code,
    m.bidding_zone,
    m.eic_code,
    p.product,
    p.delivery_start,
    p.delivery_end,
    p.price_eur_mwh,
    p.currency,
    p.resolution,
    p.ingested_at,
    row_number() over (
      partition by m.id
      order by
        case s.code when 'entsoe' then 1 when 'smard' then 2 else 99 end,
        p.ingested_at desc
    ) as source_rank
  from energy_data.market_price_points p
  join energy_data.data_sources s on s.id = p.source_id
  join energy_data.markets m on m.id = p.market_id
  where now() >= p.delivery_start
    and now() < p.delivery_end
    and p.product in ('day_ahead', 'quarter_hour_day_ahead', 'hour_day_ahead')
)
select
  "time",
  source_code,
  country_code,
  bidding_zone,
  eic_code,
  product,
  delivery_start,
  delivery_end,
  price_eur_mwh,
  currency,
  resolution,
  ingested_at
from ranked_current_prices
where source_rank = 1;

create or replace view energy_data.v_grafana_market_price_stats_today as
select
  s.code as source_code,
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  p.interval_type,
  min(p.low_price_eur_mwh) as low_price_eur_mwh,
  max(p.high_price_eur_mwh) as high_price_eur_mwh,
  max(p.calculated_at) as calculated_at
from energy_data.market_price_ohlc p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id
where (p.interval_start at time zone m.timezone)::date = (now() at time zone m.timezone)::date
group by s.code, m.country_code, m.bidding_zone, m.eic_code, p.interval_type;

commit;
