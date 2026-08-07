function berlinDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateText, days) {
  const [year, month, day] = dateText.split('-').map(Number);
  return berlinDate(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

const now = new Date();
const today = berlinDate(now);
const tomorrow = addDays(today, 1);
const berlinHour = Number(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now),
);
const executionMode = typeof $execution === 'undefined' ? 'manual' : $execution.mode;
const forceAll = executionMode === 'manual';
const base = 'https://www.epexspot.com/en/market-results';

function request({ key, kind, auctionCode = null, tradingDate, deliveryDate, productMinutes }) {
  const isAuction = kind === 'auction';
  const query = [
    `market_area=${isAuction ? 'DE-LU' : 'DE'}`,
    `auction=${auctionCode ?? ''}`,
    `trading_date=${tradingDate ?? ''}`,
    `delivery_date=${deliveryDate}`,
    'underlying_year=',
    `modality=${isAuction ? 'Auction' : 'Continuous'}`,
    `sub_modality=${isAuction ? (auctionCode === 'MRC' ? 'DayAhead' : 'Intraday') : ''}`,
    'technology=',
    'data_mode=table',
    'period=',
    'production_period=',
    `product=${productMinutes}`,
  ].join('&');
  return {
    json: {
      key,
      kind,
      auction_code: auctionCode,
      market_area: isAuction ? 'DE-LU' : 'DE',
      trading_date: tradingDate,
      delivery_date: deliveryDate,
      product_minutes: productMinutes,
      request_url: `${base}?${query}`,
    },
  };
}

const requests = [
  request({
    key: 'CONTINUOUS_15MIN',
    kind: 'continuous',
    deliveryDate: today,
    productMinutes: 15,
  }),
  request({
    key: 'CONTINUOUS_60MIN',
    kind: 'continuous',
    deliveryDate: today,
    productMinutes: 60,
  }),
];

const auctionWindows = [
  { hour: 12, key: 'MRC', code: 'MRC', deliveryDate: tomorrow },
  { hour: 15, key: 'IDA1', code: 'IDA1', deliveryDate: tomorrow },
  { hour: 22, key: 'IDA2', code: 'IDA2', deliveryDate: tomorrow },
  { hour: 10, key: 'IDA3', code: 'IDA3', deliveryDate: today },
];

for (const auction of auctionWindows) {
  if (!forceAll && berlinHour !== auction.hour) continue;
  requests.push(
    request({
      key: auction.key,
      kind: 'auction',
      auctionCode: auction.code,
      tradingDate: today,
      deliveryDate: auction.deliveryDate,
      productMinutes: 15,
    }),
  );
}

return requests;
