-- Add Peter's public EPEX SPOT market-results source and auction storage.

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
  'epex_spot_web',
  'EPEX SPOT public market results',
  'https://www.epexspot.com/en/market-results',
  false,
  true,
  'Client-requested web collector based on Peter''s legacy INTRA, CONT15 and CONT1H configuration. Validate website access and usage permission continuously.'
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
    'EPEX_RESULTS_BASE_URL',
    'https://www.epexspot.com/en/market-results',
    'EPEX SPOT public market-results page used by Peter''s legacy collector.',
    false
  ),
  (
    'EPEX_MARKET_AREA',
    'DE-LU',
    'Germany/Luxembourg bidding zone for the Germany dashboard.',
    false
  ),
  (
    'EPEX_COLLECTION_INTERVAL_MINUTES',
    '15',
    'Normal polling interval for the EPEX public-page workflow.',
    false
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

create table if not exists energy_data.epex_intraday_auction_results (
  id bigserial primary key,
  source_id bigint not null references energy_data.data_sources(id),
  market_id bigint not null references energy_data.markets(id),
  auction_code text not null,
  delivery_start timestamptz not null,
  delivery_end timestamptz not null,
  buy_volume_mwh numeric(16,3) not null,
  sell_volume_mwh numeric(16,3) not null,
  volume_mwh numeric(16,3) not null,
  price_eur_mwh numeric(14,6) not null,
  source_published_at timestamptz not null default timestamp with time zone '1970-01-01 00:00:00+00',
  ingested_at timestamptz not null default now(),
  raw_payload_id bigint references energy_data.raw_api_payloads(id),
  unique (source_id, market_id, auction_code, delivery_start, delivery_end),
  constraint epex_intraday_auction_window_chk check (delivery_end > delivery_start),
  constraint epex_intraday_auction_volume_chk check (
    buy_volume_mwh >= 0
    and sell_volume_mwh >= 0
    and volume_mwh >= 0
  )
);

create index if not exists epex_intraday_auction_market_time_idx
on energy_data.epex_intraday_auction_results (market_id, delivery_start desc);

create index if not exists epex_intraday_auction_source_time_idx
on energy_data.epex_intraday_auction_results (source_id, delivery_start desc);

create or replace view energy_data.v_grafana_epex_intraday_auction as
select
  r.delivery_start as "time",
  r.delivery_end,
  r.auction_code,
  r.price_eur_mwh,
  r.buy_volume_mwh,
  r.sell_volume_mwh,
  r.volume_mwh,
  s.code as source_code,
  m.country_code,
  m.bidding_zone
from energy_data.epex_intraday_auction_results r
join energy_data.data_sources s on s.id = r.source_id
join energy_data.markets m on m.id = r.market_id;

commit;
