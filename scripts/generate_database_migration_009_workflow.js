const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'database', '009_validate_grid_frequency.sql'), 'utf8');
const workflow = {
  name: 'database_migration_009_validate_grid_frequency',
  nodes: [
    {
      parameters: {}, id: 'migration-009-manual-trigger',
      name: 'Run Migration 009 Manually', type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1, position: [300, 300],
    },
    {
      parameters: { operation: 'executeQuery', query: sql, options: {} },
      id: 'migration-009-postgres', name: 'Apply Frequency Validation',
      type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [560, 300],
    },
  ],
  connections: {
    'Run Migration 009 Manually': {
      main: [[{ node: 'Apply Frequency Validation', type: 'main', index: 0 }]],
    },
  },
  settings: { executionOrder: 'v1' }, active: false, pinData: {},
  versionId: '00000000-0000-4000-8000-000000000009',
};
const output = path.join(root, 'database', 'n8n_workflows', '009_validate_grid_frequency.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Generated ${path.relative(root, output)}`);
