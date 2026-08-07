const html = String($json.data ?? '');
if (html.length < 10000 || !/js-table-values/i.test(html)) {
  throw new Error(
    `EPEX ${$json.key} response is empty, blocked or unexpected (${html.length} bytes).`,
  );
}

function cleanText(value) {
  return String(value)
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
    throw new Error(`Invalid EPEX ${$json.key} ${label}: ${cleanText(value)}`);
  }
  return parsed;
}

function tableDate(value) {
  const match = String(value).match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) return null;
  return `20${match[3]}-${match[2]}-${match[1]}`;
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const tables = [...html.matchAll(/<table\s+data-head="([^"]+)"[^>]*>([\s\S]*?)<\/table>/gi)]
  .map((match) => ({ date: tableDate(match[1]), body: match[2] }))
  .filter((table) => table.date === $json.delivery_date);

if (tables.length === 0) {
  throw new Error(
    `EPEX ${$json.key} returned no table for delivery date ${$json.delivery_date}.`,
  );
}

const workflowName = 'epex_complete_market_results_de';
let rows = [];

if ($json.kind === 'auction') {
  const table = tables.find(
    (candidate) => !/Weight\s*Avg\./i.test(candidate.body) && /class="[^"]*child/i.test(candidate.body),
  );
  if (!table) {
    throw new Error(`EPEX ${$json.key} auction table was not found.`);
  }

  const rowPattern = /<tr\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of table.body.matchAll(rowPattern)) {
    const classes = match[1].trim().split(/\s+/);
    if (!classes.includes('child')) continue;
    const cells = [...match[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 4) continue;
    rows.push({
      delivery_date: $json.delivery_date,
      position: rows.length,
      buy_volume_mwh: numberValue(cells[0][1], 'buy volume'),
      sell_volume_mwh: numberValue(cells[1][1], 'sell volume'),
      volume_mwh: numberValue(cells[2][1], 'volume'),
      price_eur_mwh: numberValue(cells[3][1], 'auction price'),
    });
  }

  if (![92, 96, 100].includes(rows.length)) {
    throw new Error(
      `Expected 92, 96 or 100 EPEX ${$json.key} rows, received ${rows.length}.`,
    );
  }
} else if ($json.kind === 'continuous') {
  const table = tables.find(
    (candidate) => /Weight\s*Avg\./i.test(candidate.body) && /class="child-\d+/i.test(candidate.body),
  );
  if (!table) {
    throw new Error(
      `EPEX ${$json.key} returned an auction/default table instead of continuous results.`,
    );
  }

  const rowPattern = /<tr\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of table.body.matchAll(rowPattern)) {
    const classes = match[1].trim().split(/\s+/);
    const hasProductClass = classes.some((name) => /^child-\d+$/.test(name));
    if (!hasProductClass) continue;
    const isQuarterHour = classes.includes('lvl-2');
    const isHourly = !classes.includes('lvl-1') && !classes.includes('lvl-2');
    if (
      ($json.product_minutes === 15 && !isQuarterHour) ||
      ($json.product_minutes === 60 && !isHourly)
    ) {
      continue;
    }
    const cells = [...match[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 3) continue;
    const row = {
      delivery_date: $json.delivery_date,
      interval_type: $json.product_minutes === 15 ? '15m' : '60m',
      position: rows.length,
      low_price_eur_mwh: numberValue(cells[0][1], 'Low'),
      high_price_eur_mwh: numberValue(cells[1][1], 'High'),
      last_price_eur_mwh: numberValue(cells[2][1], 'Last'),
    };
    if (
      row.high_price_eur_mwh < row.low_price_eur_mwh ||
      row.last_price_eur_mwh < row.low_price_eur_mwh ||
      row.last_price_eur_mwh > row.high_price_eur_mwh
    ) {
      throw new Error(`Invalid EPEX ${$json.key} price bounds at position ${row.position}.`);
    }
    rows.push(row);
  }

  const expectedCounts = $json.product_minutes === 15 ? [92, 96, 100] : [23, 24, 25];
  if (!expectedCounts.includes(rows.length)) {
    throw new Error(
      `Expected ${expectedCounts.join(', ')} EPEX ${$json.key} rows, received ${rows.length}.`,
    );
  }
} else {
  throw new Error(`Unsupported EPEX request kind: ${$json.kind}`);
}

const payload = {
  key: $json.key,
  kind: $json.kind,
  auction_code: $json.auction_code,
  market_area: $json.market_area,
  trading_date: $json.trading_date,
  delivery_date: $json.delivery_date,
  product_minutes: $json.product_minutes,
  row_count: rows.length,
  rows,
};

const commonCtes = `with source_market as (
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
    ${sqlString($json.request_url)},
    md5(${sqlString(JSON.stringify(payload))}),
    200,
    ${sqlJson(payload)}
  from required_source_market
  returning id
)`;

let sql;
if ($json.kind === 'auction') {
  sql = `${commonCtes}, input_rows as (
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
      + make_interval(mins => i.position * ${Number($json.product_minutes)}) as delivery_start
  from input_rows i
), upserted as (
  insert into energy_data.epex_intraday_auction_results (
    source_id, market_id, auction_code, trading_date, product_minutes, market_area,
    delivery_start, delivery_end, buy_volume_mwh, sell_volume_mwh, volume_mwh,
    price_eur_mwh, source_published_at, raw_payload_id
  )
  select
    sm.source_id, sm.market_id, ${sqlString($json.auction_code)},
    ${sqlString($json.trading_date)}::date, ${Number($json.product_minutes)},
    ${sqlString($json.market_area)}, n.delivery_start,
    n.delivery_start + make_interval(mins => ${Number($json.product_minutes)}),
    n.buy_volume_mwh, n.sell_volume_mwh, n.volume_mwh, n.price_eur_mwh, now(), rp.id
  from normalized n
  cross join required_source_market sm
  cross join raw_payload rp
  on conflict (source_id, market_id, auction_code, delivery_start, delivery_end)
  do update set
    trading_date = excluded.trading_date,
    product_minutes = excluded.product_minutes,
    market_area = excluded.market_area,
    buy_volume_mwh = excluded.buy_volume_mwh,
    sell_volume_mwh = excluded.sell_volume_mwh,
    volume_mwh = excluded.volume_mwh,
    price_eur_mwh = excluded.price_eur_mwh,
    raw_payload_id = excluded.raw_payload_id,
    ingested_at = now()
  returning 1
)
insert into energy_data.ingestion_runs (
  workflow_name, source_id, finished_at, status, records_read, records_written, metadata
)
select ${sqlString(workflowName)}, sm.source_id, now(), 'success', ${rows.length},
  count(*)::integer, ${sqlJson({ key: $json.key, delivery_date: $json.delivery_date })}
from required_source_market sm
cross join upserted
group by sm.source_id
returning status, records_read, records_written;`;
} else {
  const intervalType = $json.product_minutes === 15 ? '15m' : '60m';
  sql = `${commonCtes}, input_rows as (
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
      + make_interval(mins => i.position * ${Number($json.product_minutes)}) as interval_start
  from input_rows i
), upserted_ohlc as (
  insert into energy_data.market_price_ohlc (
    source_id, market_id, interval_type, interval_start, interval_end,
    high_price_eur_mwh, low_price_eur_mwh, last_price_eur_mwh,
    observation_count, calculated_from, source_published_at, raw_payload_id
  )
  select
    sm.source_id, sm.market_id, ${sqlString(intervalType)}, n.interval_start,
    n.interval_start + make_interval(mins => ${Number($json.product_minutes)}),
    n.high_price_eur_mwh, n.low_price_eur_mwh, n.last_price_eur_mwh,
    1, 'epex_public_market_results_complete', now(), rp.id
  from normalized n
  cross join required_source_market sm
  cross join raw_payload rp
  on conflict (source_id, market_id, interval_type, interval_start, interval_end)
  do update set
    high_price_eur_mwh = excluded.high_price_eur_mwh,
    low_price_eur_mwh = excluded.low_price_eur_mwh,
    last_price_eur_mwh = excluded.last_price_eur_mwh,
    observation_count = excluded.observation_count,
    calculated_from = excluded.calculated_from,
    source_published_at = coalesce(
      energy_data.market_price_ohlc.source_published_at,
      excluded.source_published_at
    ),
    raw_payload_id = excluded.raw_payload_id,
    calculated_at = now()
  returning 1
), upserted_points as (
  insert into energy_data.market_price_points (
    source_id, market_id, product, delivery_start, delivery_end, price_eur_mwh,
    currency, source_published_at, source_position, resolution, raw_payload_id
  )
  select
    sm.source_id, sm.market_id, 'intraday_continuous', n.interval_start,
    n.interval_start + make_interval(mins => ${Number($json.product_minutes)}),
    n.last_price_eur_mwh, 'EUR', timestamp with time zone '1970-01-01 00:00:00+00',
    n.position + 1, ${sqlString($json.product_minutes === 15 ? 'PT15M' : 'PT60M')}, rp.id
  from normalized n
  cross join required_source_market sm
  cross join raw_payload rp
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
  workflow_name, source_id, finished_at, status, records_read, records_written, metadata
)
select ${sqlString(workflowName)}, sm.source_id, now(), 'success', ${rows.length},
  count(*)::integer, ${sqlJson({ key: $json.key, delivery_date: $json.delivery_date })}
from required_source_market sm
cross join upserted_ohlc
group by sm.source_id
returning status, records_read, records_written;`;
}

return [{
  json: {
    workflow_name: workflowName,
    result_type: $json.key,
    delivery_date: $json.delivery_date,
    records_valid: rows.length,
    sql,
  },
}];
