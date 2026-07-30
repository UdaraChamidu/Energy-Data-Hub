const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const dashboardPath = path.join(
  projectRoot,
  'grafana',
  'dashboards',
  'germany-energy-monitoring.json',
);
const externalDashboardPath = path.join(
  projectRoot,
  'grafana',
  'dashboards',
  'germany-energy-monitoring-external.json',
);

const requiredPanelTitles = [
  'Grid Frequency - Target vs Actual',
  'Grid Time Deviation',
  'Grid Time',
  'Current Delivery Price',
  '15-Minute Price - High / Low / Last',
  '60-Minute Price - High / Low / Last',
  '15-Minute Low Today',
  '15-Minute High Today',
  '60-Minute Low Today',
  '60-Minute High Today',
  'Ingestion Health',
];

const requiredSqlObjects = [
  'energy_data.v_grafana_grid_frequency',
  'energy_data.v_grafana_grid_time_deviation',
  'energy_data.market_price_points',
  'energy_data.market_price_ohlc',
  'energy_data.v_grafana_market_price_stats_today',
  'energy_data.v_ingestion_health',
];

function fail(message) {
  console.error(`Dashboard validation failed: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(dashboardPath)) {
  fail(`missing ${path.relative(projectRoot, dashboardPath)}`);
  process.exit();
}

const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
const panels = dashboard.panels ?? [];
const panelTitles = new Set(panels.map((panel) => panel.title));
const panelIds = panels.map((panel) => panel.id);
const sql = panels
  .flatMap((panel) => panel.targets ?? [])
  .map((target) => target.rawSql ?? '')
  .join('\n');

for (const title of requiredPanelTitles) {
  if (!panelTitles.has(title)) {
    fail(`required panel is missing: ${title}`);
  }
}

if (new Set(panelIds).size !== panelIds.length) {
  fail('panel IDs are not unique');
}

for (const objectName of requiredSqlObjects) {
  if (!sql.includes(objectName)) {
    fail(`required SQL object is not referenced: ${objectName}`);
  }
}

if (dashboard.timezone !== 'Europe/Berlin') {
  fail('timezone must be Europe/Berlin');
}

if (dashboard.refresh !== '5s') {
  fail('dashboard refresh must be 5s');
}

const priceSource = dashboard.templating?.list?.find(
  (variable) => variable.name === 'price_source',
);
if (!priceSource) {
  fail('price_source variable is missing');
} else if (priceSource.type !== 'custom') {
  fail('price_source must be a static custom variable');
} else if (priceSource.current?.value !== 'auto') {
  fail('price_source must default to automatic fallback');
}

const gridTimePanel = panels.find((panel) => panel.title === 'Grid Time');
if (gridTimePanel?.fieldConfig?.defaults?.unit !== 'time:HH:mm:ss') {
  fail('Grid Time must use the HH:mm:ss timestamp unit');
}
if (
  !gridTimePanel?.targets?.some((target) =>
    target.rawSql?.includes(')::double precision AS "Grid Time"'),
  )
) {
  fail('Grid Time must return Unix epoch milliseconds as double precision');
}

const pricePanels = panels.filter((panel) =>
  [
    'Current Delivery Price',
    '15-Minute Price - High / Low / Last',
    '60-Minute Price - High / Low / Last',
    '15-Minute Low Today',
    '15-Minute High Today',
    '60-Minute Low Today',
    '60-Minute High Today',
  ].includes(panel.title),
);

for (const panel of pricePanels) {
  const panelSql = (panel.targets ?? [])
    .map((target) => target.rawSql ?? '')
    .join('\n');
  if (!panelSql.includes('${price_source:sqlstring}')) {
    fail(`${panel.title} does not use the selected price source`);
  }
}

if (!fs.existsSync(externalDashboardPath)) {
  fail(`missing ${path.relative(projectRoot, externalDashboardPath)}`);
} else {
  const externalDashboard = JSON.parse(
    fs.readFileSync(externalDashboardPath, 'utf8'),
  );
  const externalSql = (externalDashboard.panels ?? [])
    .flatMap((panel) => panel.targets ?? [])
    .map((target) => target.rawSql ?? '')
    .join('\n');

  if (externalDashboard.uid === dashboard.uid) {
    fail('external dashboard must have a separate UID');
  }
  if ((externalDashboard.templating?.list ?? []).length !== 0) {
    fail('external dashboard must not define template variables');
  }
  if (externalSql.includes('${price_source:sqlstring}')) {
    fail('external dashboard SQL must not use price_source');
  }
  if (!externalSql.includes("'auto' = 'auto'")) {
    fail('external dashboard must retain automatic price-source fallback');
  }
}

if (!process.exitCode) {
  console.log(
    `Dashboard validation passed: ${requiredPanelTitles.length} required panels, ` +
      `${requiredSqlObjects.length} SQL objects, internal and external variants.`,
  );
}
