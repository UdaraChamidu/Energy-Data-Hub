const fs = require('fs');
const path = require('path');

const output = path.join(
  __dirname,
  'dashboards',
  'germany-energy-monitoring-fraunhofer-auctions.json',
);
const datasource = {
  type: 'grafana-postgresql-datasource',
  uid: '${DS_POSTGRESQL}',
};

function target(rawSql) {
  return {
    datasource,
    editorMode: 'code',
    format: 'time_series',
    rawQuery: true,
    rawSql,
    refId: 'A',
  };
}

function panel({ id, title, description, y, sql, unit, step = false, color, overrides = [] }) {
  const properties = color
    ? [{ id: 'color', value: { fixedColor: color, mode: 'fixed' } }]
    : [];
  return {
    datasource,
    description,
    fieldConfig: {
      defaults: {
        color: { mode: 'palette-classic' },
        custom: {
          axisBorderShow: false,
          axisCenteredZero: false,
          axisColorMode: 'text',
          axisLabel: '',
          axisPlacement: 'left',
          axisWidth: 110,
          barAlignment: 0,
          drawStyle: 'line',
          fillOpacity: 0,
          gradientMode: 'none',
          hideFrom: { legend: false, tooltip: false, viz: false },
          insertNulls: false,
          lineInterpolation: step ? 'stepAfter' : 'linear',
          lineWidth: 2,
          pointSize: 4,
          scaleDistribution: { type: 'linear' },
          showPoints: 'never',
          spanNulls: false,
          stacking: { group: 'A', mode: 'none' },
          thresholdsStyle: { mode: 'off' },
        },
        decimals: unit === 'hertz' ? 3 : 2,
        mappings: [],
        thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
        unit,
      },
      overrides: [
        ...(properties.length
          ? [{ matcher: { id: 'byName', options: 'Price' }, properties }]
          : []),
        ...overrides,
      ],
    },
    gridPos: { h: 7, w: 24, x: 0, y },
    id,
    options: {
      legend: {
        calcs: ['lastNotNull', 'min', 'max'],
        displayMode: 'table',
        placement: 'bottom',
        showLegend: true,
      },
      tooltip: { mode: 'multi', sort: 'none' },
    },
    pluginVersion: '10.0.0',
    targets: [target(sql)],
    title,
    type: 'timeseries',
  };
}

const frequencySql = `SELECT
  "time",
  target_hz AS "Target Frequency",
  actual_hz AS "Actual Frequency"
FROM energy_data.v_grafana_grid_frequency
WHERE $__timeFilter("time")
  AND country_code = 'DE'
ORDER BY "time";`;

const deviationSql = `SELECT
  "time",
  0.0::double precision AS "Target",
  deviation_seconds AS "Time Deviation"
FROM energy_data.v_grafana_grid_time_deviation
WHERE $__timeFilter("time")
  AND country_code = 'DE'
ORDER BY "time";`;

function auctionSql(code) {
  return `SELECT
  "time",
  price_eur_mwh AS "Price"
FROM energy_data.v_grafana_energy_charts_auctions
WHERE $__timeFilter("time")
  AND country_code = 'DE'
  AND auction_code = '${code}'
ORDER BY "time";`;
}

function continuousSql(intervalType) {
  return `SELECT
  "time",
  high_price_eur_mwh AS "High",
  low_price_eur_mwh AS "Low",
  average_price_eur_mwh AS "Average"
FROM energy_data.v_grafana_energy_charts_intraday
WHERE $__timeFilter("time")
  AND country_code = 'DE'
  AND interval_type = '${intervalType}'
ORDER BY "time";`;
}

const targetOverride = {
  matcher: { id: 'byName', options: 'Target' },
  properties: [
    { id: 'color', value: { fixedColor: '#73BF69', mode: 'fixed' } },
    { id: 'custom.lineStyle', value: { dash: [8, 6], fill: 'dash' } },
    { id: 'custom.lineWidth', value: 1 },
  ],
};
const frequencyTargetOverride = {
  ...targetOverride,
  matcher: { id: 'byName', options: 'Target Frequency' },
};
const continuousOverrides = [
  ['High', '#F2CC0C'],
  ['Low', '#E02F44'],
  ['Average', '#3274D9'],
].map(([name, fixedColor]) => ({
  matcher: { id: 'byName', options: name },
  properties: [{ id: 'color', value: { fixedColor, mode: 'fixed' } }],
}));

const panels = [
  panel({
    id: 1,
    title: 'Grid Frequency - Target vs Actual',
    description: 'Validated frequency values aligned to the common Berlin timeline.',
    y: 0,
    sql: frequencySql,
    unit: 'hertz',
    overrides: [frequencyTargetOverride],
  }),
  panel({
    id: 2,
    title: 'Grid Time Deviation',
    description: 'Calculated deviation with the required zero baseline.',
    y: 7,
    sql: deviationSql,
    unit: 's',
    overrides: [targetOverride],
  }),
  ...[
    ['day_ahead', 'Day-Ahead Auction', '#E02F44'],
    ['ida1', 'Intraday Auction IDA1', '#3274D9'],
    ['ida2', 'Intraday Auction IDA2', '#FF9830'],
    ['ida3', 'Intraday Auction IDA3', '#73BF69'],
  ].map(([code, title, color], index) => panel({
    id: 3 + index,
    title,
    description: `${title} fixed clearing price for each 15-minute delivery interval.`,
    y: 14 + index * 7,
    sql: auctionSql(code),
    unit: 'suffix: EUR/MWh',
    step: true,
    color,
  })),
  panel({
    id: 7,
    title: 'Continuous Intraday - 15 Minute High / Low / Average (Provisional)',
    description: 'Delayed continuous-market statistics; these are not auction clearing prices.',
    y: 42,
    sql: continuousSql('15m'),
    unit: 'suffix: EUR/MWh',
    step: true,
    overrides: continuousOverrides,
  }),
  panel({
    id: 8,
    title: 'Continuous Intraday - 60 Minute High / Low / Average (Provisional)',
    description: 'Delayed continuous-market statistics; these are not auction clearing prices.',
    y: 49,
    sql: continuousSql('60m'),
    unit: 'suffix: EUR/MWh',
    step: true,
    overrides: continuousOverrides,
  }),
];

const dashboard = {
  __inputs: [
    {
      name: 'DS_POSTGRESQL',
      label: 'Energy Data Hub PostgreSQL',
      description: 'Select the PostgreSQL datasource connected to the energy database.',
      type: 'datasource',
      pluginId: 'grafana-postgresql-datasource',
      pluginName: 'PostgreSQL',
    },
  ],
  __requires: [
    { type: 'grafana', id: 'grafana', name: 'Grafana', version: '10.0.0' },
    {
      type: 'datasource', id: 'grafana-postgresql-datasource',
      name: 'PostgreSQL', version: '1.0.0',
    },
    { type: 'panel', id: 'timeseries', name: 'Time series', version: '' },
  ],
  annotations: { list: [] },
  description:
    'Aligned Fraunhofer Day-Ahead, IDA1, IDA2 and IDA3 auction clearing prices, plus clearly separated provisional continuous-market panels.',
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 1,
  id: null,
  links: [],
  liveNow: true,
  panels,
  refresh: '5s',
  schemaVersion: 39,
  tags: ['energy', 'germany', 'fraunhofer', 'auctions', 'test'],
  templating: { list: [] },
  time: { from: 'now-24h', to: 'now+24h' },
  timepicker: {
    refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m'],
    time_options: ['6h', '12h', '24h', '2d', '7d'],
  },
  timezone: 'Europe/Berlin',
  title: 'Germany Energy Monitoring - Fraunhofer Auctions Test',
  uid: 'energy-data-hub-de-fraunhofer-auctions',
  version: 1,
  weekStart: 'monday',
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Generated ${path.relative(process.cwd(), output)}`);
