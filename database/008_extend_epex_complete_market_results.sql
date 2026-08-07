-- Extend the provisional EPEX schema for Werner's complete market-result set.
-- Safe to run more than once. Apply after migration 006.

begin;

alter table energy_data.epex_intraday_auction_results
  add column if not exists trading_date date,
  add column if not exists product_minutes integer not null default 15,
  add column if not exists market_area text not null default 'DE-LU';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'epex_auction_product_minutes_chk'
      and conrelid = 'energy_data.epex_intraday_auction_results'::regclass
  ) then
    alter table energy_data.epex_intraday_auction_results
      add constraint epex_auction_product_minutes_chk
      check (product_minutes in (15, 30, 60));
  end if;
end $$;

alter table energy_data.market_price_ohlc
  add column if not exists source_published_at timestamptz,
  add column if not exists raw_payload_id bigint references energy_data.raw_api_payloads(id);

create index if not exists epex_auction_code_delivery_idx
on energy_data.epex_intraday_auction_results
  (auction_code, delivery_start desc);

create or replace view energy_data.v_grafana_epex_auction_results as
select
  r.delivery_start as "time",
  r.delivery_end,
  r.trading_date,
  r.auction_code,
  r.product_minutes,
  r.market_area,
  r.price_eur_mwh,
  r.buy_volume_mwh,
  r.sell_volume_mwh,
  r.volume_mwh,
  r.source_published_at,
  r.ingested_at,
  s.code as source_code,
  m.country_code,
  m.bidding_zone
from energy_data.epex_intraday_auction_results r
join energy_data.data_sources s on s.id = r.source_id
join energy_data.markets m on m.id = r.market_id;

create or replace view energy_data.v_grafana_epex_continuous_results as
select
  p.interval_start as "time",
  p.interval_end,
  p.interval_type,
  p.high_price_eur_mwh,
  p.low_price_eur_mwh,
  p.last_price_eur_mwh,
  p.observation_count,
  p.source_published_at,
  p.calculated_at as ingested_at,
  s.code as source_code,
  m.country_code,
  m.bidding_zone
from energy_data.market_price_ohlc p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id
where s.code = 'epex_spot_web'
  and p.calculated_from = 'epex_public_market_results_complete';

create or replace view energy_data.v_epex_complete_coverage as
select
  product_name,
  max(latest_delivery) as latest_delivery,
  max(latest_ingestion) as latest_ingestion,
  sum(row_count)::bigint as row_count
from (
  select
    r.auction_code as product_name,
    max(r.delivery_start) as latest_delivery,
    max(r.ingested_at) as latest_ingestion,
    count(*) as row_count
  from energy_data.epex_intraday_auction_results r
  where r.auction_code in ('MRC', 'IDA1', 'IDA2', 'IDA3')
  group by r.auction_code

  union all

  select
    'CONTINUOUS_' || upper(replace(p.interval_type, 'm', 'MIN')) as product_name,
    max(p.interval_start) as latest_delivery,
    max(p.calculated_at) as latest_ingestion,
    count(*) as row_count
  from energy_data.market_price_ohlc p
  join energy_data.data_sources s on s.id = p.source_id
  where s.code = 'epex_spot_web'
    and p.calculated_from = 'epex_public_market_results_complete'
  group by p.interval_type
) coverage
group by product_name;

commit;

select case
  when to_regclass('energy_data.v_grafana_epex_auction_results') is not null
   and to_regclass('energy_data.v_grafana_epex_continuous_results') is not null
   and to_regclass('energy_data.v_epex_complete_coverage') is not null
  then 'Migration 008 completed successfully'
  else 'Migration 008 verification failed'
end as migration_status;
