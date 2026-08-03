const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const codeDirectory = path.join(projectRoot, 'workflows', 'code');
const outputPath = path.join(
  projectRoot,
  'workflows',
  '06_epex_spot_intraday_web_de.json',
);

function code(name) {
  const source = fs.readFileSync(path.join(codeDirectory, name), 'utf8');
  // n8n Code-node programs allow a top-level return.
  new Function('$json', source);
  return source;
}

function httpNode(id, name, urlExpression, position) {
  return {
    parameters: {
      url: urlExpression,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          {
            name: 'User-Agent',
            value:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
              'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138 Safari/537.36',
          },
          {
            name: 'Accept-Language',
            value: 'en-US,en;q=0.9',
          },
          {
            name: 'Accept',
            value: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          {
            name: 'Cache-Control',
            value: 'no-cache',
          },
          {
            name: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      responseFormat: 'string',
      options: {
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

function codeNode(id, name, fileName, position) {
  return {
    parameters: {
      jsCode: code(fileName),
    },
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
  name: 'epex_spot_intraday_web_de',
  nodes: [
    {
      parameters: {
        rule: {
          interval: [
            {
              field: 'minutes',
              minutesInterval: 15,
            },
          ],
        },
      },
      id: 'epex-schedule',
      name: 'Every 15 minutes',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 120],
    },
    codeNode(
      'epex-build-urls',
      'Build EPEX URLs',
      'epex_build_urls.js',
      [240, 120],
    ),
    httpNode(
      'epex-fetch-auction',
      'Fetch EPEX Intraday Auction',
      '={{$json.auction_url}}',
      [500, 0],
    ),
    codeNode(
      'epex-parse-auction',
      'Parse EPEX Intraday Auction',
      'epex_parse_auction.js',
      [760, 0],
    ),
    postgresNode(
      'epex-store-auction',
      'Store EPEX Intraday Auction',
      [1020, 0],
    ),
    httpNode(
      'epex-fetch-continuous',
      'Fetch EPEX Continuous Results',
      '={{$json.continuous_url}}',
      [500, 240],
    ),
    codeNode(
      'epex-parse-continuous',
      'Parse EPEX Continuous Results',
      'epex_parse_continuous.js',
      [760, 240],
    ),
    postgresNode(
      'epex-store-continuous',
      'Store EPEX Continuous Results',
      [1020, 240],
    ),
  ],
  connections: {
    'Every 15 minutes': {
      main: [
        [
          {
            node: 'Build EPEX URLs',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
    'Build EPEX URLs': {
      main: [
        [
          {
            node: 'Fetch EPEX Intraday Auction',
            type: 'main',
            index: 0,
          },
          {
            node: 'Fetch EPEX Continuous Results',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
    'Fetch EPEX Intraday Auction': {
      main: [
        [
          {
            node: 'Parse EPEX Intraday Auction',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
    'Parse EPEX Intraday Auction': {
      main: [
        [
          {
            node: 'Store EPEX Intraday Auction',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
    'Fetch EPEX Continuous Results': {
      main: [
        [
          {
            node: 'Parse EPEX Continuous Results',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
    'Parse EPEX Continuous Results': {
      main: [
        [
          {
            node: 'Store EPEX Continuous Results',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
  },
  active: false,
  settings: {
    executionOrder: 'v1',
  },
  tags: [],
};

fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
