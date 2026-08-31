const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(
  path.join(root, 'database', '010_add_energy_charts_auctions.sql'),
  'utf8',
);
const workflow = {
  name: 'database_migration_010_add_energy_charts_auctions',
  nodes: [
    {
      parameters: {},
      id: 'migration-010-manual-trigger',
      name: 'Run Migration 010 Manually',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [300, 300],
    },
    {
      parameters: { operation: 'executeQuery', query: sql, options: {} },
      id: 'migration-010-postgres',
      name: 'Apply Fraunhofer Auction Schema',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [580, 300],
    },
  ],
  connections: {
    'Run Migration 010 Manually': {
      main: [[{ node: 'Apply Fraunhofer Auction Schema', type: 'main', index: 0 }]],
    },
  },
  settings: { executionOrder: 'v1' },
  active: false,
  pinData: {},
  versionId: '00000000-0000-4000-8000-000000000010',
};

const output = path.join(
  root,
  'database',
  'n8n_workflows',
  '010_add_energy_charts_auctions.json',
);
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Generated ${path.relative(root, output)}`);
