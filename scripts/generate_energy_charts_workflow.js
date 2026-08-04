const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const codeDir = path.join(root, 'workflows', 'code');
const outputPath = path.join(
  root,
  'workflows',
  '07_market_prices_energy_charts_intraday_de_lu.json',
);

function source(name) {
  return fs.readFileSync(path.join(codeDir, name), 'utf8');
}

function parser(intervalType) {
  const code = source('energy_charts_parse.js').replace('__INTERVAL_TYPE__', intervalType);
  new Function('$json', code);
  return code;
}

function httpNode(id, name, url, position) {
  return {
    parameters: {
      url,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Accept', value: 'application/json' },
          {
            name: 'User-Agent',
            value: 'Energy-Data-Hub/1.0 (Fraunhofer provisional collector)',
          },
        ],
      },
      options: {
        response: {
          response: {
            responseFormat: 'text',
          },
        },
        timeout: 45000,
      },
    },
    id,
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
  };
}

function codeNode(id, name, jsCode, position) {
  return {
    parameters: { mode: 'runOnceForAllItems', jsCode },
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
  };
}

function postgresNode(id, name, position) {
  return {
    parameters: {
      operation: 'executeQuery',
      query: '={{$json.sql}}',
      options: {},
    },
    id,
    name,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position,
  };
}

const workflow = {
  name: 'market_prices_energy_charts_intraday_de_lu',
  nodes: [
    {
      parameters: {
        rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] },
      },
      id: 'energy-charts-schedule',
      name: 'Every 30 minutes',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 120],
    },
    codeNode(
      'energy-charts-build-urls',
      'Build Current Fraunhofer URLs',
      source('energy_charts_build_urls.js'),
      [240, 120],
    ),
    httpNode(
      'energy-charts-fetch-15m',
      'Fetch Fraunhofer 15-Minute JSON',
      '={{$json.quarter_hour_url}}',
      [500, 0],
    ),
    codeNode(
      'energy-charts-parse-15m',
      'Parse Fraunhofer 15-Minute Prices',
      parser('15m'),
      [760, 0],
    ),
    postgresNode(
      'energy-charts-store-15m',
      'Store Fraunhofer 15-Minute Prices',
      [1020, 0],
    ),
    httpNode(
      'energy-charts-fetch-60m',
      'Fetch Fraunhofer 60-Minute JSON',
      '={{$json.hourly_url}}',
      [500, 240],
    ),
    codeNode(
      'energy-charts-parse-60m',
      'Parse Fraunhofer 60-Minute Prices',
      parser('60m'),
      [760, 240],
    ),
    postgresNode(
      'energy-charts-store-60m',
      'Store Fraunhofer 60-Minute Prices',
      [1020, 240],
    ),
  ],
  connections: {
    'Every 30 minutes': {
      main: [[{ node: 'Build Current Fraunhofer URLs', type: 'main', index: 0 }]],
    },
    'Build Current Fraunhofer URLs': {
      main: [[
        { node: 'Fetch Fraunhofer 15-Minute JSON', type: 'main', index: 0 },
        { node: 'Fetch Fraunhofer 60-Minute JSON', type: 'main', index: 0 },
      ]],
    },
    'Fetch Fraunhofer 15-Minute JSON': {
      main: [[{ node: 'Parse Fraunhofer 15-Minute Prices', type: 'main', index: 0 }]],
    },
    'Parse Fraunhofer 15-Minute Prices': {
      main: [[{ node: 'Store Fraunhofer 15-Minute Prices', type: 'main', index: 0 }]],
    },
    'Fetch Fraunhofer 60-Minute JSON': {
      main: [[{ node: 'Parse Fraunhofer 60-Minute Prices', type: 'main', index: 0 }]],
    },
    'Parse Fraunhofer 60-Minute Prices': {
      main: [[{ node: 'Store Fraunhofer 60-Minute Prices', type: 'main', index: 0 }]],
    },
  },
  active: false,
  settings: { executionOrder: 'v1' },
  tags: [],
};

fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(`Generated ${path.relative(root, outputPath)}`);
