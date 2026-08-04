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
const compactDashboardPath = path.join(
  projectRoot,
  'grafana',
  'dashboards',
  'germany-energy-monitoring-compact.json',
);
const compactExternalDashboardPath = path.join(
  projectRoot,
  'grafana',
  'dashboards',
  'germany-energy-monitoring-compact-external.json',
);
const fraunhoferDashboardPath = path.join(
  projectRoot,
  'grafana',
  'dashboards',
  'germany-energy-monitoring-fraunhofer.json',
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

if (dashboard.graphTooltip !== 1) {
  fail('dashboard must use shared crosshair');
}

const alignedTimeSeriesTitles = [
  'Grid Frequency - Target vs Actual',
  'Grid Time Deviation',
  '15-Minute Price - High / Low / Last',
  '60-Minute Price - High / Low / Last',
];
const alignedTimeSeries = alignedTimeSeriesTitles.map((title) =>
  panels.find((panel) => panel.title === title),
);
for (const panel of alignedTimeSeries) {
  if (panel?.gridPos?.x !== 0 || panel?.gridPos?.w !== 24) {
    fail(`${panel?.title ?? 'aligned time-series panel'} must be full width`);
  }
}
for (let index = 1; index < alignedTimeSeries.length; index += 1) {
  if (alignedTimeSeries[index]?.gridPos?.y <= alignedTimeSeries[index - 1]?.gridPos?.y) {
    fail('aligned time-series panels must be stacked in chronological panel order');
  }
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

function validateDeviationTarget(panel, label = '') {
  const prefix = label ? `${label} ` : '';
  const panelSql = (panel?.targets ?? [])
    .map((target) => target.rawSql ?? '')
    .join('\n');

  if (!panelSql.includes('0.0::double precision AS "Target"')) {
    fail(`${prefix}Grid Time Deviation must return a zero Target series`);
  }

  const targetOverride = panel?.fieldConfig?.overrides?.find(
    (override) =>
      override.matcher?.id === 'byName' &&
      override.matcher?.options === 'Target',
  );
  if (!targetOverride) {
    fail(`${prefix}Grid Time Deviation must style the Target series`);
  }
}

validateDeviationTarget(
  panels.find((panel) => panel.title === 'Grid Time Deviation'),
);

const expectedPriceColors = {
  High: '#F2CC0C',
  Low: '#E02F44',
  Last: '#3274D9',
};

function validatePriceChartStyle(panel, label = '') {
  const prefix = label ? `${label} ` : '';
  const title = panel?.title ?? 'price chart';
  if (panel?.fieldConfig?.defaults?.custom?.lineInterpolation !== 'stepAfter') {
    fail(`${prefix}${title} must use step-after interpolation`);
  }
  if (panel?.fieldConfig?.defaults?.custom?.fillOpacity !== 0) {
    fail(`${prefix}${title} must not fill below its lines`);
  }
  for (const [series, color] of Object.entries(expectedPriceColors)) {
    const override = panel?.fieldConfig?.overrides?.find(
      (candidate) => candidate.matcher?.options === series,
    );
    const colorProperty = override?.properties?.find(
      (property) => property.id === 'color',
    );
    if (colorProperty?.value?.fixedColor !== color) {
      fail(`${prefix}${title} must color ${series} as ${color}`);
    }
  }
}

for (const title of alignedTimeSeriesTitles.slice(2)) {
  validatePriceChartStyle(
    panels.find((candidate) => candidate.title === title),
  );
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
  if (externalDashboard.graphTooltip !== 1) {
    fail('external dashboard must use shared crosshair');
  }
  for (const title of alignedTimeSeriesTitles) {
    const panel = (externalDashboard.panels ?? []).find(
      (candidate) => candidate.title === title,
    );
    if (panel?.gridPos?.x !== 0 || panel?.gridPos?.w !== 24) {
      fail(`external ${title} must be full width`);
    }
  }
  for (const title of alignedTimeSeriesTitles.slice(2)) {
    validatePriceChartStyle(
      (externalDashboard.panels ?? []).find(
        (candidate) => candidate.title === title,
      ),
      'external',
    );
  }
  validateDeviationTarget(
    (externalDashboard.panels ?? []).find(
      (panel) => panel.title === 'Grid Time Deviation',
    ),
    'external',
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

function validateCompactDashboard(
  candidatePath,
  { external = false, otherUids = [] } = {},
) {
  const label = external ? 'compact external' : 'compact';
  if (!fs.existsSync(candidatePath)) {
    fail(`missing ${path.relative(projectRoot, candidatePath)}`);
    return;
  }

  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const candidatePanels = candidate.panels ?? [];
  const candidateIds = candidatePanels.map((panel) => panel.id);
  const candidateSql = candidatePanels
    .flatMap((panel) => panel.targets ?? [])
    .map((target) => target.rawSql ?? '')
    .join('\n');

  if (otherUids.includes(candidate.uid)) {
    fail(`${label} dashboard must have a separate UID`);
  }
  if (new Set(candidateIds).size !== candidateIds.length) {
    fail(`${label} dashboard panel IDs are not unique`);
  }
  if (candidate.graphTooltip !== 1) {
    fail(`${label} dashboard must use shared crosshair`);
  }
  if (candidate.refresh !== '5s') {
    fail(`${label} dashboard refresh must be 5s`);
  }

  const rightTitles = [
    'Grid Time',
    'Grid Frequency (Live)',
    'Grid Time Deviation (Live)',
    '15-Minute Price (Live)',
    '60-Minute Price (Live)',
  ];
  for (const title of rightTitles) {
    const panel = candidatePanels.find((item) => item.title === title);
    if (panel?.gridPos?.x !== 18 || panel?.gridPos?.w !== 6) {
      fail(`${label} ${title} must be in the right-side column`);
    }
  }

  const currentPrice = candidatePanels.find(
    (panel) => panel.title === 'Current Delivery Price',
  );
  if (currentPrice?.gridPos?.x !== 0 || currentPrice?.gridPos?.w !== 18) {
    fail(`${label} Current Delivery Price must be prominent on the left`);
  }

  for (const title of alignedTimeSeriesTitles) {
    const panel = candidatePanels.find((item) => item.title === title);
    if (panel?.gridPos?.x !== 0 || panel?.gridPos?.w !== 24) {
      fail(`${label} ${title} must be full width`);
    }
  }
  for (const title of alignedTimeSeriesTitles.slice(2)) {
    validatePriceChartStyle(
      candidatePanels.find((panel) => panel.title === title),
      label,
    );
  }

  if (external) {
    if ((candidate.templating?.list ?? []).length !== 0) {
      fail(`${label} dashboard must not define template variables`);
    }
    if (candidateSql.includes('${price_source:sqlstring}')) {
      fail(`${label} dashboard SQL must not use price_source`);
    }
  } else if (
    !candidate.templating?.list?.some(
      (variable) => variable.name === 'price_source',
    )
  ) {
    fail(`${label} dashboard must define price_source`);
  }
}

validateCompactDashboard(compactDashboardPath, {
  otherUids: [dashboard.uid],
});

const compactDashboard = fs.existsSync(compactDashboardPath)
  ? JSON.parse(fs.readFileSync(compactDashboardPath, 'utf8'))
  : {};
validateCompactDashboard(compactExternalDashboardPath, {
  external: true,
  otherUids: [dashboard.uid, compactDashboard.uid],
});

if (!fs.existsSync(fraunhoferDashboardPath)) {
  fail(`missing ${path.relative(projectRoot, fraunhoferDashboardPath)}`);
} else {
  const fraunhofer = JSON.parse(fs.readFileSync(fraunhoferDashboardPath, 'utf8'));
  const fraunhoferPanels = fraunhofer.panels ?? [];
  const fraunhoferSql = fraunhoferPanels
    .flatMap((panel) => panel.targets ?? [])
    .map((target) => target.rawSql ?? '')
    .join('\n');
  if ([dashboard.uid, compactDashboard.uid].includes(fraunhofer.uid)) {
    fail('Fraunhofer dashboard must have a separate UID');
  }
  if ((fraunhofer.templating?.list ?? []).length !== 0) {
    fail('Fraunhofer dashboard must not use a price-source template variable');
  }
  for (const objectName of [
    'energy_data.v_grafana_energy_charts_intraday',
    'energy_data.v_grafana_energy_charts_intraday_latest',
    'energy_data.v_grafana_energy_charts_intraday_stats_latest_day',
  ]) {
    if (!fraunhoferSql.includes(objectName)) {
      fail(`Fraunhofer dashboard does not reference ${objectName}`);
    }
  }
  if (/AS "Last"|High \/ Low \/ Last/.test(fraunhoferSql + fraunhoferPanels.map((p) => p.title).join('\n'))) {
    fail('Fraunhofer dashboard must not label Average as Last');
  }
  for (const title of [
    '15-Minute Price - High / Low / Average',
    '60-Minute Price - High / Low / Average',
  ]) {
    const panel = fraunhoferPanels.find((candidate) => candidate.title === title);
    if (panel?.fieldConfig?.defaults?.custom?.lineInterpolation !== 'stepAfter') {
      fail(`Fraunhofer ${title} must use step-after interpolation`);
    }
    if (panel?.fieldConfig?.defaults?.custom?.fillOpacity !== 0) {
      fail(`Fraunhofer ${title} must use lines without fill`);
    }
    const average = panel?.fieldConfig?.overrides?.find(
      (override) => override.matcher?.options === 'Average',
    );
    const averageColor = average?.properties?.find((property) => property.id === 'color');
    if (averageColor?.value?.fixedColor !== '#3274D9') {
      fail(`Fraunhofer ${title} must color Average blue`);
    }
  }
}

if (!process.exitCode) {
  console.log(
    `Dashboard validation passed: ${requiredPanelTitles.length} required panels, ` +
      `${requiredSqlObjects.length} SQL objects, standard and compact variants.`,
  );
}
