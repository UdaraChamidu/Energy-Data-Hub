-- Reject implausible grid-frequency measurements while retaining raw payloads.
-- Safe to run more than once. Apply after migration 003.

begin;

-- The source payload remains in raw_api_payloads for audit purposes.
delete from energy_data.grid_frequency_measurements
where actual_hz < 45 or actual_hz > 55;

alter table energy_data.grid_frequency_measurements
  drop constraint if exists grid_frequency_actual_chk;

alter table energy_data.grid_frequency_measurements
  add constraint grid_frequency_actual_chk
  check (actual_hz between 45 and 55);

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
where g.actual_hz between 45 and 55
order by m.id, g.measured_at desc;

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
join energy_data.markets m on m.id = g.market_id
where g.actual_hz between 45 and 55;

commit;

select
  count(*) filter (where actual_hz < 45 or actual_hz > 55) as invalid_rows_remaining,
  min(actual_hz) as minimum_frequency_hz,
  max(actual_hz) as maximum_frequency_hz
from energy_data.grid_frequency_measurements;
