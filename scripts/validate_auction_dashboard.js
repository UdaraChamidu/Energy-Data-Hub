const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dashboardPath = path.join(
  root, 'grafana', 'dashboards',
  'germany-energy-monitoring-fraunhofer-auctions.json',
);
const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
const panels = dashboard.panels ?? [];
const auctionTitles = [
  'Day-Ahead Auction',
  'Intraday Auction IDA1',
  'Intraday Auction IDA2',
  'Intraday Auction IDA3',
];
const expectedTitles = [
  'Grid Frequency - Target vs Actual',
  'Grid Time Deviation',
  ...auctionTitles,
  'Continuous Intraday - 15 Minute High / Low / Average (Provisional)',
  'Continuous Intraday - 60 Minute High / Low / Average (Provisional)',
];

function fail(message) {
  throw new Error(`Auction dashboard validation failed: ${message}`);
}

if (dashboard.timezone !== 'Europe/Berlin') fail('timezone must be Europe/Berlin');
if (dashboard.graphTooltip !== 1) fail('shared crosshair must be enabled');
if (dashboard.time?.to !== 'now+24h') fail('future delivery periods must be visible');
if ((dashboard.templating?.list ?? []).length !== 0) fail('public-safe dashboard must not use variables');

for (const title of expectedTitles) {
  const panel = panels.find((candidate) => candidate.title === title);
  if (!panel) fail(`missing panel: ${title}`);
  if (panel.gridPos?.x !== 0 || panel.gridPos?.w !== 24) {
    fail(`${title} must be full width`);
  }
  if (panel.fieldConfig?.defaults?.custom?.axisWidth !== 110) {
    fail(`${title} must use the common 110-pixel Y-axis width`);
  }
  if ('min' in (panel.fieldConfig?.defaults ?? {})) {
    fail(`${title} must leave the Y-axis minimum on Auto`);
  }
}

for (const title of auctionTitles) {
  const panel = panels.find((candidate) => candidate.title === title);
  if (panel.fieldConfig.defaults.custom.lineInterpolation !== 'stepAfter') {
    fail(`${title} must use step-after interpolation`);
  }
  if (panel.fieldConfig.defaults.custom.fillOpacity !== 0) {
    fail(`${title} must use lines without fill`);
  }
  const sql = panel.targets?.[0]?.rawSql ?? '';
  if (!sql.includes('v_grafana_energy_charts_auctions')) {
    fail(`${title} must query the auction view`);
  }
  if (/high_price|low_price|average_price/i.test(sql)) {
    fail(`${title} must use one clearing price, not High/Low/Average`);
  }
}

for (let index = 1; index < panels.length; index += 1) {
  if (panels[index].gridPos.y <= panels[index - 1].gridPos.y) {
    fail('panels must be stacked in one vertical timeline');
  }
}

console.log(`PASS: Fraunhofer auction dashboard (${panels.length} aligned panels)`);
