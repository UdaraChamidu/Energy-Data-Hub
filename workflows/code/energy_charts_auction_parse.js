const inputItems = typeof $input !== 'undefined' ? $input.all() : [{ json: $json }];
const expectedNames = {
  day_ahead: 'Day Ahead Auction (DE-LU)',
  ida1: 'Pan-European Intraday auction, 15 minutes IDA1 price (DE-LU)',
  ida2: 'Pan-European Intraday auction, 15 minutes IDA2 price (DE-LU)',
  ida3: 'Pan-European Intraday auction, 15 minutes IDA3 price (DE-LU)',
};

function englishName(series) {
  let name = series?.name;
  while (Array.isArray(name)) name = name[0];
  if (typeof name === 'string') return name;
  return name?.en;
}

function extractPayload(item) {
  let value = item?.json?.body ?? item?.json?.data ?? item?.json;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return Array.isArray(value) ? value : null;
}

function berlinDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function isoWeek(parts) {
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: weekYear, week: String(week).padStart(2, '0') };
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const workflowName = 'market_prices_energy_charts_auctions_de_lu';
const observedAt = new Date().toISOString();
const outputs = [];

for (const inputItem of inputItems) {
  const payload = extractPayload(inputItem);
  if (!payload?.length) continue;

  const axis = payload.find((series) => Array.isArray(series?.xAxisValues));
  const timestamps = axis?.xAxisValues;
  if (!Array.isArray(timestamps) || timestamps.length === 0) continue;

  const firstTimestamp = Number(timestamps[0]);
  if (!Number.isFinite(firstTimestamp)) continue;
  const period = isoWeek(berlinDateParts(new Date(firstTimestamp)));
  const requestUrl = `https://energy-charts.info/charts/price_spot_market/data/de/week_15min_${period.year}_${period.week}.json`;
  const rows = [];
  const counts = {};

  for (const [auctionCode, expectedName] of Object.entries(expectedNames)) {
    const series = payload.find((candidate) => englishName(candidate) === expectedName);
    if (!series) {
      counts[auctionCode] = 0;
      continue;
    }
    if (!Array.isArray(series.data) || series.data.length !== timestamps.length) {
      throw new Error(`${expectedName} does not match the shared timestamp axis.`);
    }

    let count = 0;
    for (let index = 0; index < timestamps.length; index += 1) {
      if (series.data[index] === null || series.data[index] === '') continue;
      const timestamp = Number(timestamps[index]);
      const price = Number(series.data[index]);
      if (!Number.isFinite(timestamp) || !Number.isFinite(price)) continue;
      rows.push({
        auction_code: auctionCode,
        delivery_start: new Date(timestamp).toISOString(),
        delivery_end: new Date(timestamp + 15 * 60 * 1000).toISOString(),
        price_eur_mwh: price,
        source_series_name: expectedName,
      });
      count += 1;
    }
    counts[auctionCode] = count;
  }

  if (rows.length === 0) continue;
  const rawJson = JSON.stringify(payload);
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
    and r.request_hash = md5(${sqlString(rawJson)})
  order by r.received_at desc
  limit 1
), inserted_payload as (
  insert into energy_data.raw_api_payloads (
    source_id, workflow_name, request_url, request_hash, response_status, payload
  )
  select
    sm.source_id, ${sqlString(workflowName)}, ${sqlString(requestUrl)},
    md5(${sqlString(rawJson)}), 200, ${sqlJson(payload)}
  from required_source_market sm
  where not exists (select 1 from existing_payload)
  returning id
), selected_payload as (
  select id from existing_payload
  union all
  select id from inserted_payload
  limit 1
), input_rows as (
  select *
  from jsonb_to_recordset(${sqlJson(rows)}) as x(
    auction_code text,
    delivery_start timestamptz,
    delivery_end timestamptz,
    price_eur_mwh numeric,
    source_series_name text
  )
), upserted as (
  insert into energy_data.energy_charts_auction_prices (
    source_id, market_id, auction_code, delivery_start, delivery_end,
    price_eur_mwh, currency, source_series_name, first_observed_at,
    last_observed_at, raw_payload_id
  )
  select
    sm.source_id, sm.market_id, i.auction_code, i.delivery_start, i.delivery_end,
    i.price_eur_mwh, 'EUR', i.source_series_name, ${sqlString(observedAt)}::timestamptz,
    ${sqlString(observedAt)}::timestamptz, rp.id
  from input_rows i
  cross join required_source_market sm
  cross join selected_payload rp
  on conflict (source_id, market_id, auction_code, delivery_start, delivery_end)
  do update set
    price_eur_mwh = excluded.price_eur_mwh,
    source_series_name = excluded.source_series_name,
    last_observed_at = excluded.last_observed_at,
    ingested_at = now(),
    raw_payload_id = excluded.raw_payload_id
  returning 1
)
insert into energy_data.ingestion_runs (
  workflow_name, source_id, finished_at, status,
  records_read, records_written, metadata
)
select
  ${sqlString(workflowName)}, sm.source_id, now(), 'success',
  ${timestamps.length * Object.keys(expectedNames).length}, count(*)::integer,
  ${sqlJson({ request_url: requestUrl, iso_year: period.year, iso_week: period.week, counts })}
from required_source_market sm
cross join upserted
group by sm.source_id
returning status, records_read, records_written, metadata;`;

  outputs.push({
    json: {
      workflow_name: workflowName,
      request_url: requestUrl,
      iso_year: period.year,
      iso_week: period.week,
      records_valid: rows.length,
      product_counts: counts,
      sql,
    },
  });
}

if (outputs.length === 0) {
  throw new Error('No usable Fraunhofer weekly auction payload was returned.');
}

return outputs;
