-- Reference SQL for n8n PostgreSQL nodes.
-- Do not apply as a migration. Copy the relevant statements into n8n nodes.

-- 1. Start an ingestion run.
insert into energy_data.ingestion_runs (workflow_name, source_id, status, metadata)
select
  $1,
  id,
  'running',
  coalesce($2::jsonb, '{}'::jsonb)
from energy_data.data_sources
where code = $3
returning id;

-- 2. Finish an ingestion run successfully.
update energy_data.ingestion_runs
set
  finished_at = now(),
  status = 'success',
  records_read = $2,
  records_written = $3,
  error_message = null
where id = $1;

-- 3. Finish an ingestion run with failure.
update energy_data.ingestion_runs
set
  finished_at = now(),
  status = 'failed',
  error_message = $2
where id = $1;

-- 4. Insert raw API payload.
insert into energy_data.raw_api_payloads (
  source_id,
  workflow_name,
  request_url,
  request_hash,
  response_status,
  payload
)
select
  s.id,
  $1,
  $2,
  $3,
  $4,
  $5::jsonb
from energy_data.data_sources s
where s.code = $6
returning id;

-- 5. Upsert grid frequency from netzfrequenzmessung.de.
-- Params: measured_at, actual_hz, raw_payload_id.
insert into energy_data.grid_frequency_measurements (
  source_id,
  market_id,
  measured_at,
  target_hz,
  actual_hz,
  source_published_at,
  quality,
  raw_payload_id
)
select
  s.id,
  m.id,
  $1::timestamptz,
  50.000,
  $2::numeric,
  $1::timestamptz,
  'ok',
  $3::bigint
from energy_data.data_sources s
cross join energy_data.markets m
where s.code = 'netzfrequenzmessung'
  and m.country_code = 'DE'
  and m.bidding_zone = 'DE-LU'
on conflict (source_id, market_id, measured_at) do update
set
  target_hz = excluded.target_hz,
  actual_hz = excluded.actual_hz,
  source_published_at = excluded.source_published_at,
  quality = excluded.quality,
  raw_payload_id = coalesce(excluded.raw_payload_id, energy_data.grid_frequency_measurements.raw_payload_id),
  ingested_at = now();

-- 6. Upsert calculated grid time deviation.
insert into energy_data.grid_time_deviation_measurements (
  source_id,
  market_id,
  measured_at,
  grid_time,
  deviation_seconds,
  source_published_at,
  quality,
  calculation_method
)
select
  s.id,
  m.id,
  $1::timestamptz,
  $2::timestamptz,
  $3::numeric,
  $1::timestamptz,
  'calculated',
  'frequency_integral_approximation'
from energy_data.data_sources s
cross join energy_data.markets m
where s.code = 'calculated'
  and m.country_code = 'DE'
  and m.bidding_zone = 'DE-LU'
on conflict (source_id, market_id, measured_at) do update
set
  grid_time = excluded.grid_time,
  deviation_seconds = excluded.deviation_seconds,
  source_published_at = excluded.source_published_at,
  quality = excluded.quality,
  calculation_method = excluded.calculation_method,
  ingested_at = now();

-- 7. Upsert ENTSO-E price point.
-- Product should be one of: day_ahead, quarter_hour_day_ahead, hour_day_ahead.
insert into energy_data.market_price_points (
  source_id,
  market_id,
  product,
  delivery_start,
  delivery_end,
  price_eur_mwh,
  currency,
  source_published_at,
  source_position,
  resolution,
  raw_payload_id
)
select
  s.id,
  m.id,
  $1,
  $2::timestamptz,
  $3::timestamptz,
  $4::numeric,
  coalesce($5, 'EUR'),
  coalesce($6::timestamptz, timestamp with time zone '1970-01-01 00:00:00+00'),
  $7::integer,
  $8,
  $9::bigint
from energy_data.data_sources s
cross join energy_data.markets m
where s.code = 'entsoe'
  and m.country_code = 'DE'
  and m.bidding_zone = 'DE-LU'
on conflict (source_id, market_id, product, delivery_start, delivery_end, source_published_at) do update
set
  price_eur_mwh = excluded.price_eur_mwh,
  currency = excluded.currency,
  source_position = excluded.source_position,
  resolution = excluded.resolution,
  raw_payload_id = coalesce(excluded.raw_payload_id, energy_data.market_price_points.raw_payload_id),
  ingested_at = now();

-- 8. Build simple OHLC from stored price points for a time window.
-- Params: interval type ('15m' or '60m'), from timestamp, to timestamp.
insert into energy_data.market_price_ohlc (
  source_id,
  market_id,
  interval_type,
  interval_start,
  interval_end,
  high_price_eur_mwh,
  low_price_eur_mwh,
  last_price_eur_mwh,
  observation_count,
  calculated_from
)
select
  p.source_id,
  p.market_id,
  $1 as interval_type,
  case
    when $1 = '15m' then to_timestamp(floor(extract(epoch from p.delivery_start) / 900) * 900)
    when $1 = '60m' then date_trunc('hour', p.delivery_start)
  end as interval_start,
  case
    when $1 = '15m' then to_timestamp(floor(extract(epoch from p.delivery_start) / 900) * 900) + interval '15 minutes'
    when $1 = '60m' then date_trunc('hour', p.delivery_start) + interval '1 hour'
  end as interval_end,
  max(p.price_eur_mwh) as high_price_eur_mwh,
  min(p.price_eur_mwh) as low_price_eur_mwh,
  (array_agg(p.price_eur_mwh order by coalesce(p.source_published_at, p.ingested_at) desc, p.ingested_at desc))[1] as last_price_eur_mwh,
  count(*) as observation_count,
  'market_price_points' as calculated_from
from energy_data.market_price_points p
where p.delivery_start >= $2::timestamptz
  and p.delivery_start < $3::timestamptz
  and $1 in ('15m', '60m')
group by p.source_id, p.market_id, interval_start, interval_end
on conflict (source_id, market_id, interval_type, interval_start, interval_end) do update
set
  high_price_eur_mwh = excluded.high_price_eur_mwh,
  low_price_eur_mwh = excluded.low_price_eur_mwh,
  last_price_eur_mwh = excluded.last_price_eur_mwh,
  observation_count = excluded.observation_count,
  calculated_from = excluded.calculated_from,
  calculated_at = now();
