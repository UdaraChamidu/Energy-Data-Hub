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

const berlin = berlinDateParts(new Date());
const berlinNoon = new Date(`${berlin.year}-${berlin.month}-${berlin.day}T12:00:00Z`);
const current = isoWeek(berlinDateParts(berlinNoon));
berlinNoon.setUTCDate(berlinNoon.getUTCDate() + 7);
const next = isoWeek(berlinDateParts(berlinNoon));
const base = 'https://energy-charts.info/charts/price_spot_market/data/de';

return [current, next].map((period, index) => ({
  json: {
    period: index === 0 ? 'current_week' : 'next_week',
    iso_year: period.year,
    iso_week: period.week,
    request_url: `${base}/week_15min_${period.year}_${period.week}.json`,
  },
}));
