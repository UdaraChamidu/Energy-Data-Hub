const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const codeDir = path.join(root, 'workflows', 'code');
const outputPath = path.join(
  root,
  'workflows',
  '08_epex_complete_market_results_de.json',
);

function source(name) {
  return fs.readFileSync(path.join(codeDir, name), 'utf8');
}

function codeNode(id, name, fileName, position, mode = 'runOnceForEachItem') {
  const jsCode = source(fileName);
  new Function('$json', '$execution', '$', jsCode);
  return {
    parameters: { mode, jsCode },
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
  };
}

const workflow = {
  name: 'epex_complete_market_results_de',
  nodes: [
    {
      parameters: {},
      id: 'epex-complete-manual',
      name: 'Manual Test - All Six Products',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 0],
    },
    {
      parameters: {
        rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] },
      },
      id: 'epex-complete-schedule',
      name: 'Every 30 minutes',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 180],
    },
    codeNode(
      'epex-complete-build',
      'Build EPEX Complete Requests',
      'epex_complete_build_requests.js',
      [260, 90],
      'runOnceForAllItems',
    ),
    {
      parameters: {
        url: '={{$json.request_url}}',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: 'User-Agent',
              value: 'Energy-Data-Hub/1.0 (normal EPEX public-results request)',
            },
            { name: 'Accept-Language', value: 'en-US,en;q=0.9' },
            {
              name: 'Accept',
              value: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          ],
        },
        options: {
          response: { response: { responseFormat: 'text' } },
          timeout: 45000,
        },
      },
      id: 'epex-complete-fetch',
      name: 'Fetch EPEX Result Page',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [520, 90],
      retryOnFail: false,
    },
    codeNode(
      'epex-complete-attach',
      'Attach EPEX Request Metadata',
      'epex_complete_attach_response.js',
      [780, 90],
    ),
    codeNode(
      'epex-complete-parse',
      'Validate and Parse EPEX Result',
      'epex_complete_parse.js',
      [1040, 90],
    ),
    {
      parameters: {
        operation: 'executeQuery',
        query: '={{$json.sql}}',
        options: {},
      },
      id: 'epex-complete-store',
      name: 'Store Validated EPEX Result',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [1300, 90],
    },
  ],
  connections: {
    'Manual Test - All Six Products': {
      main: [[{ node: 'Build EPEX Complete Requests', type: 'main', index: 0 }]],
    },
    'Every 30 minutes': {
      main: [[{ node: 'Build EPEX Complete Requests', type: 'main', index: 0 }]],
    },
    'Build EPEX Complete Requests': {
      main: [[{ node: 'Fetch EPEX Result Page', type: 'main', index: 0 }]],
    },
    'Fetch EPEX Result Page': {
      main: [[{ node: 'Attach EPEX Request Metadata', type: 'main', index: 0 }]],
    },
    'Attach EPEX Request Metadata': {
      main: [[{ node: 'Validate and Parse EPEX Result', type: 'main', index: 0 }]],
    },
    'Validate and Parse EPEX Result': {
      main: [[{ node: 'Store Validated EPEX Result', type: 'main', index: 0 }]],
    },
  },
  active: false,
  settings: {
    executionOrder: 'v1',
    timezone: 'Europe/Berlin',
  },
  tags: [],
};

fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(`Generated ${path.relative(root, outputPath)}`);
