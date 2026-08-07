const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migrationName = '008_extend_epex_complete_market_results';
const sql = fs
  .readFileSync(path.join(root, 'database', `${migrationName}.sql`), 'utf8')
  .trim();

const workflow = {
  name: 'database_migration_008_extend_epex_complete_market_results',
  nodes: [
    {
      parameters: {},
      id: 'migration-008-manual-trigger',
      name: 'Run Migration 008 Manually',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 0],
    },
    {
      parameters: {
        operation: 'executeQuery',
        query: sql,
        options: {},
      },
      id: 'migration-008-postgres',
      name: 'Apply and Verify Migration 008',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [300, 0],
    },
  ],
  connections: {
    'Run Migration 008 Manually': {
      main: [[{ node: 'Apply and Verify Migration 008', type: 'main', index: 0 }]],
    },
  },
  active: false,
  settings: { executionOrder: 'v1' },
  tags: [],
};

const outputDir = path.join(root, 'database', 'n8n_workflows');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, `${migrationName}.json`),
  `${JSON.stringify(workflow, null, 2)}\n`,
  'utf8',
);
console.log(`Generated database/n8n_workflows/${migrationName}.json`);
