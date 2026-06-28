-- Seed Germany-first providers, market, and non-secret collector settings.
-- Apply after 001_create_energy_data_schema.sql.

begin;

insert into energy_data.data_sources (code, name, base_url, requires_auth, is_active, notes)
values
  (
    'netzfrequenzmessung',
    'netzfrequenzmessung.de',
    'https://dat.netzfrequenzmessung.de:9080',
    false,
    true,
    'Selected first-build source for live actual grid frequency. Endpoint returns XML with frequency and UTC timestamp.'
  ),
  (
    'entsoe',
    'ENTSO-E Transparency Platform',
    'https://web-api.tp.entsoe.eu/api',
    true,
    true,
    'Selected first-build source for official Germany/DE-LU market price documents. Requires securityToken.'
  ),
  (
    'awattar',
    'aWATTar Marketdata API',
    'https://api.awattar.de/v1/marketdata',
    false,
    false,
    'Fallback/test price feed only. Not selected as primary source for official market data.'
  ),
  (
    'smard',
    'SMARD.de',
    'https://www.smard.de',
    false,
    false,
    'Future candidate for German generation, load, forecast, and market data expansion.'
  ),
  (
    'calculated',
    'Internal Calculations',
    null,
    false,
    true,
    'Internal derived values such as approximate grid time deviation and OHLC aggregates.'
  )
on conflict (code) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  requires_auth = excluded.requires_auth,
  is_active = excluded.is_active,
  notes = excluded.notes,
  updated_at = now();

insert into energy_data.markets (country_code, bidding_zone, eic_code, display_name, timezone, is_active, notes)
values
  (
    'DE',
    'DE-LU',
    '10Y1001A1001A82H',
    'Germany / Luxembourg',
    'Europe/Berlin',
    true,
    'Germany-first market. ENTSO-E bidding zone EIC for DE-LU.'
  )
on conflict (country_code, bidding_zone) do update
set
  eic_code = excluded.eic_code,
  display_name = excluded.display_name,
  timezone = excluded.timezone,
  is_active = excluded.is_active,
  notes = excluded.notes,
  updated_at = now();

insert into energy_data.collector_settings (key, value, description, is_secret)
values
  (
    'GRID_FREQUENCY_URL',
    'https://dat.netzfrequenzmessung.de:9080/frequenz.xml',
    'Live grid frequency XML endpoint for the first Germany build.',
    false
  ),
  (
    'GRID_FREQUENCY_TARGET_HZ',
    '50.000',
    'Configured target frequency. Actual source endpoint returns actual frequency only.',
    false
  ),
  (
    'GRID_FREQUENCY_POLL_SECONDS',
    '3',
    'Recommended polling interval. Do not poll more often than once per second.',
    false
  ),
  (
    'GRID_TIME_DEVIATION_MODE',
    'calculated_from_frequency',
    'First-build mode because no clean public live grid-time API has been selected.',
    false
  ),
  (
    'ENTSOE_API_BASE_URL',
    'https://web-api.tp.entsoe.eu/api',
    'ENTSO-E Transparency Platform API base URL.',
    false
  ),
  (
    'ENTSOE_DE_LU_DOMAIN',
    '10Y1001A1001A82H',
    'Germany/Luxembourg bidding zone EIC code.',
    false
  ),
  (
    'ENTSOE_PRICE_DOCUMENT_TYPE',
    'A44',
    'ENTSO-E price document type.',
    false
  ),
  (
    'ENTSOE_PRICE_POLL_MINUTES',
    '15',
    'Initial market price polling interval.',
    false
  ),
  (
    'ENTSOE_SECURITY_TOKEN',
    'SET_IN_N8N_CREDENTIALS_OR_ENV',
    'Secret value placeholder. Do not store real API tokens in this table.',
    true
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

commit;

