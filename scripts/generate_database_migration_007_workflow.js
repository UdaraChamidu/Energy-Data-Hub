const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migrationName = '007_add_energy_charts_intraday';
const sql = fs
  .readFileSync(path.join(root, 'database', `${migrationName}.sql`), 'utf8')
  .trim();
const verification = `

select case
  when exists (
    select 1 from energy_data.data_sources where code = 'energy_charts'
  )
  and to_regclass('energy_data.energy_charts_intraday_prices') is not null
  and to_regclass('energy_data.v_grafana_energy_charts_intraday') is not null
  then 'Migration 007 completed successfully'
  else 'Migration 007 verification failed'
end as migration_status;
`;

const workflow = {
  name: 'database_migration_007_add_energy_charts_intraday',
  nodes: [
    {
      parameters: {},
      id: 'migration-007-manual-trigger',
      name: 'Run Migration 007 Manually',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 0],
    },
    {
      parameters: {
        operation: 'executeQuery',
        query: `${sql}${verification}`,
        options: {},
      },
      id: 'migration-007-postgres',
      name: 'Apply and Verify Migration 007',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [280, 0],
    },
  ],
  connections: {
    'Run Migration 007 Manually': {
      main: [[{ node: 'Apply and Verify Migration 007', type: 'main', index: 0 }]],
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
