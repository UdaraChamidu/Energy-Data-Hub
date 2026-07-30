-- Grafana dashboard data diagnostics.
-- This is a read-only troubleshooting script, not a migration.
-- Run it in pgAdmin, psql, or another PostgreSQL query tool.

-- 1. Confirm the latest grid-time row contains a displayable time.
select
  "time" as measured_at,
  grid_time,
  deviation_seconds,
  quality,
  calculation_method
from energy_data.v_grafana_grid_time_deviation
where country_code = 'DE'
order by "time" desc
limit 5;

-- 2. Show market-price coverage by source and product.
select
  s.code as source_code,
  p.product,
  count(*) as row_count,
  min(p.delivery_start) as earliest_delivery,
  max(p.delivery_end) as latest_delivery,
  max(p.ingested_at) as last_ingested_at,
  count(*) filter (
    where now() >= p.delivery_start
      and now() < p.delivery_end
  ) as intervals_active_now
from energy_data.market_price_points p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id
where m.country_code = 'DE'
group by s.code, p.product
order by s.code, p.product;

-- 3. Show OHLC coverage required by the price charts and stat panels.
select
  s.code as source_code,
  p.interval_type,
  count(*) as row_count,
  min(p.interval_start) as earliest_interval,
  max(p.interval_end) as latest_interval,
  max(p.calculated_at) as last_calculated_at,
  count(*) filter (
    where (p.interval_start at time zone m.timezone)::date
      = (now() at time zone m.timezone)::date
  ) as rows_today
from energy_data.market_price_ohlc p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id
where m.country_code = 'DE'
group by s.code, p.interval_type
order by s.code, p.interval_type;

-- 4. Show prices whose delivery interval is active now.
select
  s.code as source_code,
  p.product,
  p.delivery_start,
  p.delivery_end,
  p.price_eur_mwh,
  p.ingested_at
from energy_data.market_price_points p
join energy_data.data_sources s on s.id = p.source_id
join energy_data.markets m on m.id = p.market_id
where m.country_code = 'DE'
  and now() >= p.delivery_start
  and now() < p.delivery_end
order by
  case s.code when 'entsoe' then 1 when 'smard' then 2 else 99 end,
  p.ingested_at desc;

-- 5. Show the exact rows used by the four daily stat panels.
select *
from energy_data.v_grafana_market_price_stats_today
where country_code = 'DE'
order by source_code, interval_type;

-- 6. Check ingestion freshness and recent workflow results.
select * from energy_data.v_ingestion_health order by data_domain;

select
  workflow_name,
  status,
  records_read,
  records_written,
  started_at,
  finished_at,
  error_message
from energy_data.ingestion_runs
order by started_at desc
limit 50;

-- 7. Focused ENTSO-E check. No rows here normally means the workflow failed
-- before reaching PostgreSQL; inspect its execution inside n8n.
select
  p.product,
  count(*) as row_count,
  min(p.delivery_start) as earliest_delivery,
  max(p.delivery_end) as latest_delivery,
  max(p.ingested_at) as last_ingested_at
from energy_data.market_price_points p
join energy_data.data_sources s on s.id = p.source_id
where s.code = 'entsoe'
group by p.product
order by p.product;
