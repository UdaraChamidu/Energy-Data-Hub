-- Query views for n8n checks and future Grafana dashboards.
-- Apply after 001_create_energy_data_schema.sql and 002_seed_germany_sources.sql.

begin;

create or replace view energy_data.v_grid_frequency_latest as
select distinct on (m.id)
  g.measured_at as "time",
  s.code as source_code,
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  g.target_hz,
  g.actual_hz,
  g.source_published_at,
  g.ingested_at,
  g.quality
from energy_data.grid_frequency_measurements g
join energy_data.data_sources s on s.id = g.source_id
join energy_data.markets m on m.id = g.market_id
order by m.id, g.measured_at desc;

create or replace view energy_data.v_grid_time_deviation_latest as
select distinct on (m.id)
  g.measured_at as "time",
  s.code as source_code,
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  g.grid_time,
  g.deviation_seconds,
  g.source_published_at,
  g.ingested_at,
  g.quality,
  g.calculation_method
from energy_data.grid_time_deviation_measurements g
join energy_data.data_sources s on s.id = g.source_id
join energy_data.markets m on m.id = g.market_id
order by m.id, g.measured_at desc;

create or replace view energy_data.v_market_price_latest as
select distinct on (m.id, p.product)
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
  p.source_published_at,
  p.ingested_at
from energy_data.market_price_points p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id
order by m.id, p.product, p.delivery_start desc, p.ingested_at desc;

create or replace view energy_data.v_grafana_grid_frequency as
select
  g.measured_at as "time",
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  g.target_hz,
  g.actual_hz,
  g.quality
from energy_data.grid_frequency_measurements g
join energy_data.markets m on m.id = g.market_id;

create or replace view energy_data.v_grafana_grid_time_deviation as
select
  g.measured_at as "time",
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  g.grid_time,
  g.deviation_seconds,
  g.quality,
  g.calculation_method
from energy_data.grid_time_deviation_measurements g
join energy_data.markets m on m.id = g.market_id;

create or replace view energy_data.v_grafana_market_price_points as
select
  p.delivery_start as "time",
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  p.product,
  p.delivery_start,
  p.delivery_end,
  p.price_eur_mwh,
  p.currency,
  p.resolution
from energy_data.market_price_points p
join energy_data.markets m on m.id = p.market_id;

create or replace view energy_data.v_grafana_market_price_ohlc as
select
  p.interval_start as "time",
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  p.interval_type,
  p.interval_start,
  p.interval_end,
  p.high_price_eur_mwh,
  p.low_price_eur_mwh,
  p.last_price_eur_mwh,
  p.observation_count,
  p.calculated_from,
  p.calculated_at
from energy_data.market_price_ohlc p
join energy_data.markets m on m.id = p.market_id;

create or replace view energy_data.v_grafana_market_price_stats_24h as
select
  m.country_code,
  m.bidding_zone,
  m.eic_code,
  p.interval_type,
  min(p.low_price_eur_mwh) as low_price_eur_mwh,
  max(p.high_price_eur_mwh) as high_price_eur_mwh,
  max(p.calculated_at) as calculated_at
from energy_data.market_price_ohlc p
join energy_data.markets m on m.id = p.market_id
where p.interval_start >= now() - interval '24 hours'
group by m.country_code, m.bidding_zone, m.eic_code, p.interval_type;

create or replace view energy_data.v_ingestion_health as
select
  'grid_frequency' as data_domain,
  max(measured_at) as latest_data_at,
  now() - max(measured_at) as data_age,
  count(*) filter (where measured_at >= now() - interval '5 minutes') as records_recent
from energy_data.grid_frequency_measurements
union all
select
  'grid_time_deviation' as data_domain,
  max(measured_at) as latest_data_at,
  now() - max(measured_at) as data_age,
  count(*) filter (where measured_at >= now() - interval '5 minutes') as records_recent
from energy_data.grid_time_deviation_measurements
union all
select
  'market_price_points' as data_domain,
  max(delivery_start) as latest_data_at,
  now() - max(ingested_at) as data_age,
  count(*) filter (where ingested_at >= now() - interval '1 hour') as records_recent
from energy_data.market_price_points;

commit;
