const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const codeDir = path.join(root, 'workflows', 'code');
const source = (name) => fs.readFileSync(path.join(codeDir, name), 'utf8');

const workflow = {
  name: 'market_prices_energy_charts_auctions_de_lu',
  nodes: [
    {
      parameters: {
        rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] },
      },
      id: 'energy-charts-auction-schedule',
      name: 'Every 30 minutes',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 60],
    },
    {
      parameters: {},
      id: 'energy-charts-auction-manual',
      name: 'Test Auctions Manually',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 220],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: source('energy_charts_auction_build_urls.js'),
      },
      id: 'energy-charts-auction-build',
      name: 'Build Current and Next Week URLs',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [260, 140],
    },
    {
      parameters: {
        url: '={{$json.request_url}}',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'Accept', value: 'application/json' },
            {
              name: 'User-Agent',
              value: 'Energy-Data-Hub/1.0 (Fraunhofer auction collector)',
            },
          ],
        },
        options: {
          response: {
            response: { neverError: true, responseFormat: 'text' },
          },
          timeout: 45000,
        },
      },
      id: 'energy-charts-auction-fetch',
      name: 'Fetch Fraunhofer Weekly Auctions',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [540, 140],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: source('energy_charts_auction_parse.js'),
      },
      id: 'energy-charts-auction-parse',
      name: 'Parse Day-Ahead and IDA1-3',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [820, 140],
    },
    {
      parameters: {
        operation: 'executeQuery',
        query: '={{$json.sql}}',
        options: {},
      },
      id: 'energy-charts-auction-store',
      name: 'Store Fraunhofer Auction Prices',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [1100, 140],
    },
  ],
  connections: {
    'Every 30 minutes': {
      main: [[{ node: 'Build Current and Next Week URLs', type: 'main', index: 0 }]],
    },
    'Test Auctions Manually': {
      main: [[{ node: 'Build Current and Next Week URLs', type: 'main', index: 0 }]],
    },
    'Build Current and Next Week URLs': {
      main: [[{ node: 'Fetch Fraunhofer Weekly Auctions', type: 'main', index: 0 }]],
    },
    'Fetch Fraunhofer Weekly Auctions': {
      main: [[{ node: 'Parse Day-Ahead and IDA1-3', type: 'main', index: 0 }]],
    },
    'Parse Day-Ahead and IDA1-3': {
      main: [[{ node: 'Store Fraunhofer Auction Prices', type: 'main', index: 0 }]],
    },
  },
  active: false,
  settings: { executionOrder: 'v1' },
  tags: [],
};

const output = path.join(root, 'workflows', '10_market_prices_energy_charts_auctions_de_lu.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Generated ${path.relative(root, output)}`);
