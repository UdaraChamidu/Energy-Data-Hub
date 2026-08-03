const html = String($json.data ?? $json.body ?? '');
if (html.length < 10000 || !/js-table-values/i.test(html)) {
  throw new Error(`EPEX intraday-auction response is empty or unexpected (${html.length} bytes).`);
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
if (!tableMatch) throw new Error('EPEX intraday-auction table was not found.');

const date = deliveryDate(tableMatch[1]);
const rows = [];
const rowPattern = /<tr\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
for (const match of tableMatch[2].matchAll(rowPattern)) {
  const classes = match[1].trim().split(/\s+/);
  if (!classes.includes('child')) continue;
  const cells = [...match[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
  if (cells.length < 4) continue;
  rows.push({
    delivery_date: date,
    position: rows.length,
    buy_volume_mwh: numberValue(cells[0][1], 'buy volume'),
    sell_volume_mwh: numberValue(cells[1][1], 'sell volume'),
    volume_mwh: numberValue(cells[2][1], 'volume'),
    price_eur_mwh: numberValue(cells[3][1], 'auction price'),
  });
}

if (![92, 96, 100].includes(rows.length)) {
  throw new Error(`Expected 92, 96 or 100 EPEX auction rows, received ${rows.length}.`);
}

const workflowName = 'epex_spot_intraday_web_de';
const requestUrl =
  `https://www.epexspot.com/en/market-results?market_area=DE-LU` +
  `&auction=IDA1&delivery_date=${date}&modality=Auction` +
  '&sub_modality=Intraday&data_mode=table';
const payload = {
  result_type: 'intraday_auction_ida1',
  delivery_date: date,
  row_count: rows.length,
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
    position integer,
    buy_volume_mwh numeric,
    sell_volume_mwh numeric,
    volume_mwh numeric,
    price_eur_mwh numeric
  )
), normalized as (
  select
    i.*,
    (i.delivery_date::timestamp at time zone 'Europe/Berlin')
      + make_interval(mins => i.position * 15) as delivery_start
  from input_rows i
), upserted as (
  insert into energy_data.epex_intraday_auction_results (
    source_id,
    market_id,
    auction_code,
    delivery_start,
    delivery_end,
    buy_volume_mwh,
    sell_volume_mwh,
    volume_mwh,
    price_eur_mwh,
    source_published_at,
    raw_payload_id
  )
  select
    sm.source_id,
    sm.market_id,
    'IDA1',
    n.delivery_start,
    n.delivery_start + interval '15 minutes',
    n.buy_volume_mwh,
    n.sell_volume_mwh,
    n.volume_mwh,
    n.price_eur_mwh,
    timestamp with time zone '1970-01-01 00:00:00+00',
    rp.id
  from normalized n
  cross join required_source_market sm
  cross join raw_payload rp
  on conflict (source_id, market_id, auction_code, delivery_start, delivery_end)
  do update set
    buy_volume_mwh = excluded.buy_volume_mwh,
    sell_volume_mwh = excluded.sell_volume_mwh,
    volume_mwh = excluded.volume_mwh,
    price_eur_mwh = excluded.price_eur_mwh,
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
  count(*)::integer
from required_source_market sm
cross join upserted
group by sm.source_id
returning status, records_read, records_written;`;

return [{
  json: {
    workflow_name: workflowName,
    result_type: 'intraday_auction_ida1',
    delivery_date: date,
    records_valid: rows.length,
    sql,
  },
}];
