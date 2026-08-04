const intervalType = '__INTERVAL_TYPE__';
const intervalMinutes = intervalType === '15m' ? 15 : 60;
const inputItems = typeof $input !== 'undefined' ? $input.all() : [];
let payload;
if (inputItems.length > 1) {
  payload = inputItems.map((item) => item.json);
} else {
  const input = inputItems[0]?.json ?? $json;
  if (typeof input?.body === 'string') payload = input.body;
  else if (typeof input?.data === 'string') payload = input.data;
  else payload = input;
}
if (typeof payload === 'string') payload = JSON.parse(payload);
if (!Array.isArray(payload) || payload.length === 0) {
  throw new Error('Unexpected Energy-Charts response: series array is missing.');
}

const axisSeries = payload.find((series) => series && Array.isArray(series.xAxisValues));
const timestamps = axisSeries?.xAxisValues;
if (!Array.isArray(timestamps) || timestamps.length === 0) {
  throw new Error('Energy-Charts response has no shared timestamp axis.');
}

function englishName(series) {
  let name = series?.name;
  while (Array.isArray(name)) name = name[0];
  return typeof name === 'string' ? name : name?.en;
}

const prefix = intervalType === '15m'
  ? 'Intraday Continuous 15 minutes '
  : 'Intraday Continuous ';
const expectedNames = {
  average: `${prefix}Average Price (DE-LU)`,
  low: `${prefix}Low Price (DE-LU)`,
  high: `${prefix}High Price (DE-LU)`,
  id1: `${prefix}ID1-Price (DE-LU)`,
  id3: `${prefix}ID3-Price (DE-LU)`,
};
const selected = {};
for (const [field, name] of Object.entries(expectedNames)) {
  selected[field] = payload.find((series) => englishName(series) === name);
  if (!selected[field] || !Array.isArray(selected[field].data)) {
    throw new Error(`Energy-Charts series is missing: ${name}`);
  }
  if (selected[field].data.length !== timestamps.length) {
    throw new Error(`Energy-Charts ${name} length does not match the timestamp axis.`);
  }
}

function finiteOrNull(value) {
  if (value === null || value === '' || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const rows = [];
for (let index = 0; index < timestamps.length; index += 1) {
  const timestamp = Number(timestamps[index]);
  const average = finiteOrNull(selected.average.data[index]);
  const low = finiteOrNull(selected.low.data[index]);
  const high = finiteOrNull(selected.high.data[index]);
  if (!Number.isFinite(timestamp) || average === null || low === null || high === null) continue;
  if (high < low || average < low || average > high) {
    throw new Error(`Invalid Energy-Charts price bounds at timestamp ${timestamp}.`);
  }
  rows.push({
    interval_start_ms: timestamp,
    average_price_eur_mwh: average,
    low_price_eur_mwh: low,
    high_price_eur_mwh: high,
    id1_price_eur_mwh: finiteOrNull(selected.id1.data[index]),
    id3_price_eur_mwh: finiteOrNull(selected.id3.data[index]),
  });
}
if (rows.length === 0) {
  throw new Error(`Energy-Charts ${intervalType} response contains no complete published rows.`);
}

const publishedMs = Math.max(
  ...payload.map((series) => Number(series?.date)).filter(Number.isFinite),
);
if (!Number.isFinite(publishedMs)) {
  throw new Error('Energy-Charts response has no valid publication timestamp.');
}
const sourcePublishedAt = new Date(publishedMs).toISOString();

function sqlString(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const workflowName = 'market_prices_energy_charts_intraday_de_lu';
const requestUrl = intervalType === '15m'
  ? 'https://energy-charts.info/charts/price_spot_market/data/de/week_15min_CURRENT.json'
  : 'https://energy-charts.info/charts/price_spot_market/data/de/week_CURRENT.json';
const normalizedPayload = {
  interval_type: intervalType,
  source_published_at: sourcePublishedAt,
  rows,
};
const payloadHash = JSON.stringify(normalizedPayload);

const sql = `with source_market as (
  select s.id as source_id, m.id as market_id
  from energy_data.data_sources s
  cross join energy_data.markets m
  where s.code = 'energy_charts'
    and m.country_code = 'DE'
    and m.bidding_zone = 'DE-LU'
), required_source_market as (
  select
    (select source_id from source_market) as source_id,
    (select market_id from source_market) as market_id
), existing_payload as (
  select r.id
  from energy_data.raw_api_payloads r
  cross join required_source_market sm
  where r.source_id = sm.source_id
    and r.request_hash = md5(${sqlString(payloadHash)})
  order by r.received_at desc
  limit 1
), inserted_payload as (
  insert into energy_data.raw_api_payloads (
    source_id, workflow_name, request_url, request_hash, response_status, payload
  )
  select
    sm.source_id,
    ${sqlString(workflowName)},
    ${sqlString(requestUrl)},
    md5(${sqlString(payloadHash)}),
    200,
    ${sqlJson(normalizedPayload)}
  from required_source_market sm
  where not exists (select 1 from existing_payload)
  returning id
), raw_payload as (
  select id from inserted_payload
  union all
  select id from existing_payload
  limit 1
), input_rows as (
  select *
  from jsonb_to_recordset(${sqlJson(rows)}) as x(
    interval_start_ms bigint,
    average_price_eur_mwh numeric,
    low_price_eur_mwh numeric,
    high_price_eur_mwh numeric,
    id1_price_eur_mwh numeric,
    id3_price_eur_mwh numeric
  )
), upserted as (
  insert into energy_data.energy_charts_intraday_prices (
    source_id, market_id, interval_type, interval_start, interval_end,
    average_price_eur_mwh, low_price_eur_mwh, high_price_eur_mwh,
    id1_price_eur_mwh, id3_price_eur_mwh, source_published_at, raw_payload_id
  )
  select
    sm.source_id,
    sm.market_id,
    ${sqlString(intervalType)},
    to_timestamp(i.interval_start_ms / 1000.0),
    to_timestamp(i.interval_start_ms / 1000.0) + make_interval(mins => ${intervalMinutes}),
    i.average_price_eur_mwh,
    i.low_price_eur_mwh,
    i.high_price_eur_mwh,
    i.id1_price_eur_mwh,
    i.id3_price_eur_mwh,
    ${sqlString(sourcePublishedAt)}::timestamptz,
    rp.id
  from input_rows i
  cross join required_source_market sm
  cross join raw_payload rp
  on conflict (source_id, market_id, interval_type, interval_start, interval_end)
  do update set
    average_price_eur_mwh = excluded.average_price_eur_mwh,
    low_price_eur_mwh = excluded.low_price_eur_mwh,
    high_price_eur_mwh = excluded.high_price_eur_mwh,
    id1_price_eur_mwh = excluded.id1_price_eur_mwh,
    id3_price_eur_mwh = excluded.id3_price_eur_mwh,
    source_published_at = excluded.source_published_at,
    raw_payload_id = excluded.raw_payload_id,
    ingested_at = now()
  returning 1
)
insert into energy_data.ingestion_runs (
  workflow_name, source_id, finished_at, status, records_read, records_written, metadata
)
select
  ${sqlString(workflowName)},
  sm.source_id,
  now(),
  'success',
  ${timestamps.length},
  count(*)::integer,
  ${sqlJson({ interval_type: intervalType, source_published_at: sourcePublishedAt })}
from required_source_market sm
cross join upserted
group by sm.source_id
returning status, records_read, records_written;`;

return [{
  json: {
    workflow_name: workflowName,
    source: 'energy_charts',
    interval_type: intervalType,
    source_published_at: sourcePublishedAt,
    records_read: timestamps.length,
    records_valid: rows.length,
    sql,
  },
}];
