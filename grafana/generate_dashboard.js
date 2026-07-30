const fs = require('fs');
const path = require('path');

const outputPath = path.join(
  __dirname,
  'dashboards',
  'germany-energy-monitoring.json',
);
const externalOutputPath = path.join(
  __dirname,
  'dashboards',
  'germany-energy-monitoring-external.json',
);

const datasource = {
  type: 'grafana-postgresql-datasource',
  uid: '${DS_POSTGRESQL}',
};

function postgresTarget(rawSql, format = 'time_series', refId = 'A') {
  return {
    datasource,
    editorMode: 'code',
    format,
    rawQuery: true,
    rawSql,
    refId,
  };
}

function rowPanel(id, title, y) {
  return {
    collapsed: false,
    gridPos: { h: 1, w: 24, x: 0, y },
    id,
    panels: [],
    title,
    type: 'row',
  };
}

function timeSeriesPanel({
  id,
  title,
  description,
  gridPos,
  rawSql,
  unit,
  decimals,
  overrides = [],
}) {
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
          axisPlacement: 'auto',
          barAlignment: 0,
          drawStyle: 'line',
          fillOpacity: 8,
          gradientMode: 'none',
          hideFrom: {
            legend: false,
            tooltip: false,
            viz: false,
          },
          insertNulls: false,
          lineInterpolation: 'linear',
          lineWidth: 2,
          pointSize: 4,
          scaleDistribution: { type: 'linear' },
          showPoints: 'never',
          spanNulls: false,
          stacking: {
            group: 'A',
            mode: 'none',
          },
          thresholdsStyle: { mode: 'off' },
        },
        decimals,
        mappings: [],
        thresholds: {
          mode: 'absolute',
          steps: [{ color: 'green', value: null }],
        },
        unit,
      },
      overrides,
    },
    gridPos,
    id,
    options: {
      legend: {
        calcs: ['lastNotNull', 'min', 'max'],
        displayMode: 'table',
        placement: 'bottom',
        showLegend: true,
      },
      tooltip: {
        mode: 'multi',
        sort: 'none',
      },
    },
    targets: [postgresTarget(rawSql)],
    title,
    type: 'timeseries',
  };
}

function statPanel({
  id,
  title,
  description,
  gridPos,
  rawSql,
  unit = 'short',
  decimals,
  colorMode = 'value',
  textMode = 'auto',
  showAllValues = false,
}) {
  return {
    datasource,
    description,
    fieldConfig: {
      defaults: {
        color: { mode: 'thresholds' },
        decimals,
        mappings: [],
        noValue: 'No data',
        thresholds: {
          mode: 'absolute',
          steps: [{ color: 'green', value: null }],
        },
        unit,
      },
      overrides: [],
    },
    gridPos,
    id,
    options: {
      colorMode,
      graphMode: 'none',
      justifyMode: 'center',
      orientation: 'auto',
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        limit: 1,
        values: showAllValues,
      },
      showPercentChange: false,
      textMode,
      wideLayout: true,
    },
    targets: [postgresTarget(rawSql, 'table')],
    title,
    type: 'stat',
  };
}

function healthTablePanel(id, y) {
  return {
    datasource,
    description:
      'Operational view of freshness and recent records for every ingestion domain.',
    fieldConfig: {
      defaults: {
        custom: {
          align: 'auto',
          cellOptions: { type: 'auto' },
          inspect: false,
        },
        mappings: [],
        thresholds: {
          mode: 'absolute',
          steps: [{ color: 'green', value: null }],
        },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'Age (seconds)' },
          properties: [
            { id: 'unit', value: 's' },
            { id: 'decimals', value: 1 },
          ],
        },
        {
          matcher: { id: 'byName', options: 'Status' },
          properties: [
            {
              id: 'mappings',
              value: [
                {
                  options: {
                    Healthy: {
                      color: 'green',
                      index: 0,
                      text: 'Healthy',
                    },
                    Stale: {
                      color: 'red',
                      index: 1,
                      text: 'Stale',
                    },
                  },
                  type: 'value',
                },
              ],
            },
            {
              id: 'custom.cellOptions',
              value: {
                mode: 'basic',
                type: 'color-text',
              },
            },
          ],
        },
      ],
    },
    gridPos: { h: 7, w: 24, x: 0, y },
    id,
    options: {
      cellHeight: 'sm',
      footer: {
        countRows: false,
        enablePagination: false,
        fields: '',
        reducer: ['sum'],
        show: false,
      },
      showHeader: true,
      sortBy: [],
    },
    targets: [
      postgresTarget(
        `SELECT
  data_domain AS "Data Domain",
  latest_data_at AS "Latest Data",
  round(extract(epoch FROM data_age)::numeric, 1) AS "Age (seconds)",
  records_recent AS "Recent Records",
  CASE
    WHEN data_domain = 'grid_frequency'
      AND latest_data_at IS NOT NULL
      AND data_age <= interval '30 seconds' THEN 'Healthy'
    WHEN data_domain = 'grid_time_deviation'
      AND latest_data_at IS NOT NULL
      AND data_age <= interval '60 seconds' THEN 'Healthy'
    WHEN data_domain = 'market_price_points'
      AND latest_data_at IS NOT NULL
      AND records_recent > 0 THEN 'Healthy'
    ELSE 'Stale'
  END AS "Status"
FROM energy_data.v_ingestion_health
ORDER BY data_domain;`,
        'table',
      ),
    ],
    title: 'Ingestion Health',
    type: 'table',
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
  deviation_seconds AS "Time Deviation"
FROM energy_data.v_grafana_grid_time_deviation
WHERE $__timeFilter("time")
  AND country_code = 'DE'
ORDER BY "time";`;

const gridTimeSql = `SELECT
  round(
    extract(
      epoch FROM coalesce(
        grid_time,
        "time" + make_interval(secs => deviation_seconds::double precision)
      )
    ) * 1000
  )::double precision AS "Grid Time"
FROM energy_data.v_grafana_grid_time_deviation
WHERE country_code = 'DE'
  AND deviation_seconds IS NOT NULL
ORDER BY "time" DESC
LIMIT 1;`;

const priceSourceVariable = '${price_source:sqlstring}';
const priceSourcePriority =
  "CASE s.code WHEN 'entsoe' THEN 1 WHEN 'smard' THEN 2 ELSE 99 END";

const currentPriceSql = `WITH chosen_source AS (
  SELECT s.id
  FROM energy_data.data_sources s
  WHERE s.code IN ('entsoe', 'smard')
    AND (
      ${priceSourceVariable} = 'auto'
      OR s.code = ${priceSourceVariable}
    )
    AND EXISTS (
      SELECT 1
      FROM energy_data.market_price_points candidate
      JOIN energy_data.markets candidate_market
        ON candidate_market.id = candidate.market_id
      WHERE candidate.source_id = s.id
        AND now() >= candidate.delivery_start
        AND now() < candidate.delivery_end
        AND candidate.product IN (
          'day_ahead',
          'quarter_hour_day_ahead',
          'hour_day_ahead'
        )
        AND candidate_market.country_code = 'DE'
    )
  ORDER BY ${priceSourcePriority}
  LIMIT 1
)
SELECT
  p.price_eur_mwh AS "Current Price"
FROM energy_data.market_price_points p
JOIN chosen_source selected ON selected.id = p.source_id
JOIN energy_data.markets m ON m.id = p.market_id
WHERE now() >= p.delivery_start
  AND now() < p.delivery_end
  AND p.product IN ('day_ahead', 'quarter_hour_day_ahead', 'hour_day_ahead')
  AND m.country_code = 'DE'
ORDER BY p.ingested_at DESC
LIMIT 1;`;

function priceChartSql(intervalType) {
  return `WITH chosen_source AS (
  SELECT s.id
  FROM energy_data.data_sources s
  WHERE s.code IN ('entsoe', 'smard')
    AND (
      ${priceSourceVariable} = 'auto'
      OR s.code = ${priceSourceVariable}
    )
    AND EXISTS (
      SELECT 1
      FROM energy_data.market_price_ohlc candidate
      JOIN energy_data.markets candidate_market
        ON candidate_market.id = candidate.market_id
      WHERE candidate.source_id = s.id
        AND candidate.interval_type = '${intervalType}'
        AND $__timeFilter(candidate.interval_start)
        AND candidate_market.country_code = 'DE'
    )
  ORDER BY ${priceSourcePriority}
  LIMIT 1
)
SELECT
  p.interval_start AS "time",
  p.high_price_eur_mwh AS "High",
  p.low_price_eur_mwh AS "Low",
  p.last_price_eur_mwh AS "Last"
FROM energy_data.market_price_ohlc p
JOIN chosen_source selected ON selected.id = p.source_id
JOIN energy_data.markets m ON m.id = p.market_id
WHERE $__timeFilter(p.interval_start)
  AND p.interval_type = '${intervalType}'
  AND m.country_code = 'DE'
ORDER BY p.interval_start;`;
}

function priceStatSql(intervalType, valueColumn, alias) {
  return `WITH chosen_source AS (
  SELECT s.code
  FROM energy_data.data_sources s
  WHERE s.code IN ('entsoe', 'smard')
    AND (
      ${priceSourceVariable} = 'auto'
      OR s.code = ${priceSourceVariable}
    )
    AND EXISTS (
      SELECT 1
      FROM energy_data.v_grafana_market_price_stats_today candidate
      WHERE candidate.source_code = s.code
        AND candidate.country_code = 'DE'
        AND candidate.interval_type = '${intervalType}'
    )
  ORDER BY ${priceSourcePriority}
  LIMIT 1
)
SELECT
  stats.${valueColumn} AS "${alias}"
FROM energy_data.v_grafana_market_price_stats_today stats
JOIN chosen_source selected ON selected.code = stats.source_code
WHERE stats.country_code = 'DE'
  AND stats.interval_type = '${intervalType}'
LIMIT 1;`;
}

const panels = [
  rowPanel(1, 'Grid Stability', 0),
  timeSeriesPanel({
    id: 2,
    title: 'Grid Frequency - Target vs Actual',
    description:
      'Continental Europe target frequency and measured live frequency for the Germany dashboard.',
    gridPos: { h: 8, w: 24, x: 0, y: 1 },
    rawSql: frequencySql,
    unit: 'hertz',
    decimals: 3,
    overrides: [
      {
        matcher: { id: 'byName', options: 'Target Frequency' },
        properties: [
          { id: 'color', value: { fixedColor: 'green', mode: 'fixed' } },
          { id: 'custom.lineStyle', value: { dash: [8, 6], fill: 'dash' } },
          { id: 'custom.lineWidth', value: 1 },
        ],
      },
    ],
  }),
  timeSeriesPanel({
    id: 3,
    title: 'Grid Time Deviation',
    description:
      'Calculated cumulative grid-time deviation from stored frequency samples. This is an approximation, not an official grid-time API feed.',
    gridPos: { h: 8, w: 18, x: 0, y: 9 },
    rawSql: deviationSql,
    unit: 's',
    decimals: 3,
  }),
  statPanel({
    id: 4,
    title: 'Grid Time',
    description:
      'Latest calculated grid time displayed in Europe/Berlin local time.',
    gridPos: { h: 8, w: 6, x: 18, y: 9 },
    rawSql: gridTimeSql,
    unit: 'time:HH:mm:ss',
    textMode: 'value',
  }),
  rowPanel(5, 'Electricity Prices', 17),
  statPanel({
    id: 6,
    title: 'Current Delivery Price',
    description:
      'Price for the delivery interval active now. Auto prefers ENTSO-E and falls back to SMARD. This is day-ahead interval data, not a continuous intraday trade.',
    gridPos: { h: 8, w: 6, x: 0, y: 18 },
    rawSql: currentPriceSql,
    unit: 'suffix: EUR/MWh',
    decimals: 2,
    colorMode: 'background',
  }),
  timeSeriesPanel({
    id: 7,
    title: '15-Minute Price - High / Low / Last',
    description:
      'Derived 15-minute values from the selected official price source. With one clearing price per interval, High, Low and Last can be equal.',
    gridPos: { h: 8, w: 18, x: 6, y: 18 },
    rawSql: priceChartSql('15m'),
    unit: 'suffix: EUR/MWh',
    decimals: 2,
  }),
  timeSeriesPanel({
    id: 8,
    title: '60-Minute Price - High / Low / Last',
    description:
      'Hourly high and low across quarter-hour delivery prices; Last is the final quarter-hour in the hour.',
    gridPos: { h: 8, w: 24, x: 0, y: 26 },
    rawSql: priceChartSql('60m'),
    unit: 'suffix: EUR/MWh',
    decimals: 2,
  }),
  rowPanel(9, 'Daily Price Records', 34),
  statPanel({
    id: 10,
    title: '15-Minute Low Today',
    description:
      'Lowest 15-minute price in the current Europe/Berlin calendar day.',
    gridPos: { h: 5, w: 6, x: 0, y: 35 },
    rawSql: priceStatSql(
      '15m',
      'low_price_eur_mwh',
      '15-Minute Low',
    ),
    unit: 'suffix: EUR/MWh',
    decimals: 2,
  }),
  statPanel({
    id: 11,
    title: '15-Minute High Today',
    description:
      'Highest 15-minute price in the current Europe/Berlin calendar day.',
    gridPos: { h: 5, w: 6, x: 6, y: 35 },
    rawSql: priceStatSql(
      '15m',
      'high_price_eur_mwh',
      '15-Minute High',
    ),
    unit: 'suffix: EUR/MWh',
    decimals: 2,
  }),
  statPanel({
    id: 12,
    title: '60-Minute Low Today',
    description:
      'Lowest hourly aggregate price in the current Europe/Berlin calendar day.',
    gridPos: { h: 5, w: 6, x: 12, y: 35 },
    rawSql: priceStatSql(
      '60m',
      'low_price_eur_mwh',
      '60-Minute Low',
    ),
    unit: 'suffix: EUR/MWh',
    decimals: 2,
  }),
  statPanel({
    id: 13,
    title: '60-Minute High Today',
    description:
      'Highest hourly aggregate price in the current Europe/Berlin calendar day.',
    gridPos: { h: 5, w: 6, x: 18, y: 35 },
    rawSql: priceStatSql(
      '60m',
      'high_price_eur_mwh',
      '60-Minute High',
    ),
    unit: 'suffix: EUR/MWh',
    decimals: 2,
  }),
  rowPanel(14, 'System Operations', 40),
  healthTablePanel(15, 41),
];

const dashboard = {
  __inputs: [
    {
      name: 'DS_POSTGRESQL',
      label: 'Energy Data Hub PostgreSQL',
      description:
        'Select the PostgreSQL datasource connected to the grafana database.',
      type: 'datasource',
      pluginId: 'grafana-postgresql-datasource',
      pluginName: 'PostgreSQL',
    },
  ],
  __requires: [
    {
      type: 'grafana',
      id: 'grafana',
      name: 'Grafana',
      version: '10.0.0',
    },
    {
      type: 'datasource',
      id: 'grafana-postgresql-datasource',
      name: 'PostgreSQL',
      version: '1.0.0',
    },
    {
      type: 'panel',
      id: 'timeseries',
      name: 'Time series',
      version: '',
    },
    {
      type: 'panel',
      id: 'stat',
      name: 'Stat',
      version: '',
    },
    {
      type: 'panel',
      id: 'table',
      name: 'Table',
      version: '',
    },
  ],
  annotations: {
    list: [
      {
        builtIn: 1,
        datasource: {
          type: 'grafana',
          uid: '-- Grafana --',
        },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
        type: 'dashboard',
      },
    ],
  },
  description:
    'Germany-first energy monitoring from n8n and PostgreSQL. Covers grid frequency, calculated grid-time deviation, official day-ahead prices, derived 15/60-minute values, daily records and ingestion health.',
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 1,
  id: null,
  links: [],
  liveNow: true,
  panels,
  refresh: '5s',
  schemaVersion: 39,
  tags: ['energy', 'germany', 'postgresql', 'n8n'],
  templating: {
    list: [
      {
        current: {
          selected: true,
          text: 'Auto (ENTSO-E, then SMARD)',
          value: 'auto',
        },
        definition: 'Auto : auto,ENTSO-E : entsoe,SMARD : smard',
        hide: 0,
        includeAll: false,
        label: 'Price source',
        multi: false,
        name: 'price_source',
        options: [
          {
            selected: true,
            text: 'Auto (ENTSO-E, then SMARD)',
            value: 'auto',
          },
          {
            selected: false,
            text: 'ENTSO-E',
            value: 'entsoe',
          },
          {
            selected: false,
            text: 'SMARD',
            value: 'smard',
          },
        ],
        query: 'Auto : auto,ENTSO-E : entsoe,SMARD : smard',
        refresh: 0,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        type: 'custom',
      },
    ],
  },
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: {
    refresh_intervals: ['3s', '5s', '10s', '30s', '1m', '5m', '15m'],
    time_options: ['15m', '1h', '6h', '12h', '24h', '2d', '7d'],
  },
  timezone: 'Europe/Berlin',
  title: 'Germany Energy Monitoring',
  uid: 'energy-data-hub-de',
  version: 4,
  weekStart: 'monday',
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8');
console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);

const externalDashboard = JSON.parse(JSON.stringify(dashboard));
externalDashboard.title = 'Germany Energy Monitoring - External';
externalDashboard.uid = 'energy-data-hub-de-external';
externalDashboard.tags = [...externalDashboard.tags, 'external'];
externalDashboard.templating = { list: [] };

for (const panel of externalDashboard.panels) {
  for (const target of panel.targets ?? []) {
    if (typeof target.rawSql === 'string') {
      target.rawSql = target.rawSql.replaceAll(
        '${price_source:sqlstring}',
        "'auto'",
      );
    }
  }
}

fs.writeFileSync(
  externalOutputPath,
  `${JSON.stringify(externalDashboard, null, 2)}\n`,
  'utf8',
);
console.log(`Generated ${path.relative(process.cwd(), externalOutputPath)}`);
