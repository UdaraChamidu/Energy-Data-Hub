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

const today = berlinDate(new Date());
const yesterday = berlinDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
const base = 'https://www.epexspot.com/en/market-results';

return [{
  json: {
    delivery_date: today,
    auction_url:
      `${base}?market_area=DE-LU&auction=IDA1&trading_date=${yesterday}` +
      `&delivery_date=${today}&underlying_year&modality=Auction` +
      '&sub_modality=Intraday&technology&data_mode=table&period&production_period',
    continuous_url:
      `${base}?market_area=DE&auction&trading_date&delivery_date=${today}` +
      '&underlying_year&modality=Continuous&sub_modality&technology' +
      '&data_mode=table&period&production_period&product=60',
  },
}];
