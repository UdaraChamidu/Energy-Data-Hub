const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'api', 'samples');
const start = process.argv[2] || '2026-08-24';
const end = process.argv[3] || '2026-08-30';
const isoYear = Number(process.argv[4] || 2026);
const isoWeek = String(process.argv[5] || 35).padStart(2, '0');

const apiUrl = `https://api.energy-charts.info/v2/price?bzn=DE-LU&start=${start}&end=${end}`;
const chartUrl = `https://energy-charts.info/charts/price_spot_market/data/de/week_15min_${isoYear}_${isoWeek}.json`;

const auctionNames = {
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

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Energy-Data-Hub/1.0 (Fraunhofer contract audit)' },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const [apiPayload, chartPayload] = await Promise.all([
    getJson(apiUrl),
    getJson(chartUrl),
  ]);

  if (!Array.isArray(apiPayload.series) || apiPayload.series.length !== 1) {
    throw new Error('The official price API contract changed unexpectedly.');
  }
  if (apiPayload.series[0]?.id !== 'day_ahead_price') {
    throw new Error('The official price API no longer identifies day_ahead_price.');
  }
  if (!Array.isArray(chartPayload) || chartPayload.length === 0) {
    throw new Error('The weekly chart payload is not a non-empty series array.');
  }

  const axis = chartPayload.find((series) => Array.isArray(series?.xAxisValues));
  const timestamps = axis?.xAxisValues;
  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    throw new Error('The weekly chart payload has no timestamp axis.');
  }

  const normalized = [];
  const summary = [];
  for (const [auctionCode, expectedName] of Object.entries(auctionNames)) {
    const series = chartPayload.find((candidate) => englishName(candidate) === expectedName);
    if (!series || !Array.isArray(series.data)) {
      throw new Error(`Missing Fraunhofer auction series: ${expectedName}`);
    }
    if (series.data.length !== timestamps.length) {
      throw new Error(`${expectedName} does not match the shared timestamp axis.`);
    }

    for (let index = 0; index < timestamps.length; index += 1) {
      if (series.data[index] === null || series.data[index] === '') continue;
      const timestamp = Number(timestamps[index]);
      const price = Number(series.data[index]);
      if (!Number.isFinite(timestamp) || !Number.isFinite(price)) continue;
      normalized.push({
        auction_code: auctionCode,
        delivery_start_utc: new Date(timestamp).toISOString(),
        delivery_start_berlin: new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Europe/Berlin',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
        }).format(new Date(timestamp)).replace(' ', 'T'),
        delivery_end_utc: new Date(timestamp + 15 * 60 * 1000).toISOString(),
        price_eur_mwh: price,
        source_series_name: expectedName,
      });
    }

    const rows = normalized.filter((row) => row.auction_code === auctionCode);
    summary.push({
      auction_code: auctionCode,
      source_series_name: expectedName,
      valid_rows: rows.length,
      first_delivery_utc: rows[0]?.delivery_start_utc ?? null,
      last_delivery_utc: rows.at(-1)?.delivery_start_utc ?? null,
      minimum_price_eur_mwh: rows.length
        ? Math.min(...rows.map((row) => row.price_eur_mwh)) : null,
      maximum_price_eur_mwh: rows.length
        ? Math.max(...rows.map((row) => row.price_eur_mwh)) : null,
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const stem = `${start}_${end}`;
  fs.writeFileSync(
    path.join(outputDir, `fraunhofer_price_v2_${stem}.json`),
    `${JSON.stringify(apiPayload, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outputDir, `fraunhofer_chart_15min_week_${isoYear}_${isoWeek}.json`),
    `${JSON.stringify(chartPayload, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outputDir, `fraunhofer_auction_mapping_${stem}.json`),
    `${JSON.stringify({ api_url: apiUrl, chart_url: chartUrl, summary }, null, 2)}\n`,
  );

  const columns = [
    'auction_code', 'delivery_start_utc', 'delivery_start_berlin',
    'delivery_end_utc', 'price_eur_mwh', 'source_series_name',
  ];
  const csv = [
    columns.join(','),
    ...normalized.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\n');
  fs.writeFileSync(
    path.join(outputDir, `fraunhofer_auction_prices_${stem}.csv`),
    `${csv}\n`,
  );

  console.log(JSON.stringify({ apiUrl, chartUrl, apiSeries: apiPayload.series, summary }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
