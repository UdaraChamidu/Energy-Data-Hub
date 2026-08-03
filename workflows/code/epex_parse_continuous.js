const html = String($json.data ?? $json.body ?? '');
if (html.length < 10000 || !/js-table-values/i.test(html)) {
  throw new Error(`EPEX continuous response is empty or unexpected (${html.length} bytes).`);
}

function cleanText(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&minus;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function numberValue(value, label) {
  const normalized = cleanText(value).replace(/,/g, '').replace(/\s/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid EPEX ${label}: ${cleanText(value)}`);
  }
  return parsed;
}

function deliveryDate(value) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) throw new Error(`Unexpected EPEX table date: ${value}`);
  return `20${match[3]}-${match[2]}-${match[1]}`;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const tableMatch = html.match(/<table\s+data-head="([^"]+)"[^>]*>([\s\S]*?)<\/table>/i);
if (!tableMatch) throw new Error('EPEX continuous-results table was not found.');
if (!/Weight\s*Avg\./i.test(tableMatch[2]) || !/class="child-\d+/i.test(tableMatch[2])) {
  throw new Error(
    'EPEX returned the auction/default table instead of the continuous-results hierarchy.',
  );
}

const date = deliveryDate(tableMatch[1]);
const quarterHourRows = [];
const hourlyRows = [];
const rowPattern = /<tr\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
for (const match of tableMatch[2].matchAll(rowPattern)) {
  const classes = match[1].trim().split(/\s+/);
  const productClass = classes.find((name) => /^child-\d+$/.test(name));
  if (!productClass) continue;
  const isQuarterHour = classes.includes('lvl-2');
  const isHourly = !classes.includes('lvl-1') && !classes.includes('lvl-2');
  if (!isQuarterHour && !isHourly) continue;
  const cells = [...match[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
  if (cells.length < 3) continue;
  const target = isQuarterHour ? quarterHourRows : hourlyRows;
  const row = {
    delivery_date: date,
    interval_type: isQuarterHour ? '15m' : '60m',
    position: target.length,
    low_price_eur_mwh: numberValue(cells[0][1], 'Low'),
    high_price_eur_mwh: numberValue(cells[1][1], 'High'),
    last_price_eur_mwh: numberValue(cells[2][1], 'Last'),
  };
  if (
    row.high_price_eur_mwh < row.low_price_eur_mwh ||
    row.last_price_eur_mwh < row.low_price_eur_mwh ||
    row.last_price_eur_mwh > row.high_price_eur_mwh
  ) {
    throw new Error(`Invalid EPEX ${row.interval_type} price bounds at position ${row.position}.`);
  }
  target.push(row);
}

if (![92, 96, 100].includes(quarterHourRows.length)) {
  throw new Error(`Expected 92, 96 or 100 EPEX 15-minute rows, received ${quarterHourRows.length}.`);
}
if (![23, 24, 25].includes(hourlyRows.length)) {
  throw new Error(`Expected 23, 24 or 25 EPEX hourly rows, received ${hourlyRows.length}.`);
}

const rows = [...quarterHourRows, ...hourlyRows];
const workflowName = 'epex_spot_intraday_web_de';
const requestUrl =
  `https://www.epexspot.com/en/market-results?market_area=DE` +
  `&delivery_date=${date}&modality=Continuous&data_mode=table&product=60`;
const payload = {
  result_type: 'continuous_low_high_last',
  delivery_date: date,
  quarter_hour_count: quarterHourRows.length,
  hourly_count: hourlyRows.length,
  rows,
};

const sql = `with source_market as (
  select s.id as source_id, m.id as market_id
  from energy_data.data_sources s
  cross join energy_data.markets m
  where s.code = 'epex_spot_web'
    and m.country_code = 'DE'
    and m.bidding_zone = 'DE-LU'
), required_source_market as (
  select
    (select source_id from source_market) as source_id,
    (select market_id from source_market) as market_id
), raw_payload as (
  insert into energy_data.raw_api_payloads (
    source_id, workflow_name, request_url, request_hash, response_status, payload
  )
  select
    source_id,
    ${sqlString(workflowName)},
    ${sqlString(requestUrl)},
    md5(${sqlString(JSON.stringify(payload))}),
    200,
    ${sqlJson(payload)}
  from required_source_market
  returning id
), input_rows as (
  select *
  from jsonb_to_recordset(${sqlJson(rows)}) as x(
    delivery_date date,
    interval_type text,
    position integer,
    low_price_eur_mwh numeric,
    high_price_eur_mwh numeric,
    last_price_eur_mwh numeric
  )
), normalized as (
  select
    i.*,
    (i.delivery_date::timestamp at time zone 'Europe/Berlin')
      + make_interval(
          mins => i.position * case when i.interval_type = '15m' then 15 else 60 end
        ) as interval_start
  from input_rows i
), upserted_ohlc as (
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
    sm.source_id,
    sm.market_id,
    n.interval_type,
    n.interval_start,
    n.interval_start
      + case when n.interval_type = '15m' then interval '15 minutes' else interval '1 hour' end,
    n.high_price_eur_mwh,
    n.low_price_eur_mwh,
    n.last_price_eur_mwh,
    1,
    'epex_public_market_results_continuous'
  from normalized n
  cross join required_source_market sm
  on conflict (source_id, market_id, interval_type, interval_start, interval_end)
  do update set
    high_price_eur_mwh = excluded.high_price_eur_mwh,
    low_price_eur_mwh = excluded.low_price_eur_mwh,
    last_price_eur_mwh = excluded.last_price_eur_mwh,
    observation_count = excluded.observation_count,
    calculated_from = excluded.calculated_from,
    calculated_at = now()
  returning 1
), upserted_points as (
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
    sm.source_id,
    sm.market_id,
    'intraday_continuous',
    n.interval_start,
    n.interval_start + interval '15 minutes',
    n.last_price_eur_mwh,
    'EUR',
    timestamp with time zone '1970-01-01 00:00:00+00',
    n.position + 1,
    'PT15M',
    rp.id
  from normalized n
  cross join required_source_market sm
  cross join raw_payload rp
  where n.interval_type = '15m'
  on conflict (source_id, market_id, product, delivery_start, delivery_end, source_published_at)
  do update set
    price_eur_mwh = excluded.price_eur_mwh,
    source_position = excluded.source_position,
    resolution = excluded.resolution,
    raw_payload_id = excluded.raw_payload_id,
    ingested_at = now()
  returning 1
)
insert into energy_data.ingestion_runs (
  workflow_name, source_id, finished_at, status, records_read, records_written
)
select
  ${sqlString(workflowName)},
  sm.source_id,
  now(),
  'success',
  ${rows.length},
  ((select count(*) from upserted_ohlc) + (select count(*) from upserted_points))::integer
from required_source_market sm
returning status, records_read, records_written;`;

return [{
  json: {
    workflow_name: workflowName,
    result_type: 'continuous_low_high_last',
    delivery_date: date,
    quarter_hour_records: quarterHourRows.length,
    hourly_records: hourlyRows.length,
    records_valid: rows.length,
    sql,
  },
}];
