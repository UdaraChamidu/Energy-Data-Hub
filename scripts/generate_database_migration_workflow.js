const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const migrationName = '006_add_epex_spot_web';
const migrationPath = path.join(
  projectRoot,
  'database',
  `${migrationName}.sql`,
);
const outputDirectory = path.join(projectRoot, 'database', 'n8n_workflows');
const outputPath = path.join(outputDirectory, `${migrationName}.json`);

const migrationSql = fs.readFileSync(migrationPath, 'utf8').trim();
const verificationSql = `

select
  case
    when exists (
      select 1
      from energy_data.data_sources
      where code = 'epex_spot_web'
    )
    and to_regclass('energy_data.epex_intraday_auction_results') is not null
    and to_regclass('energy_data.v_grafana_epex_intraday_auction') is not null
    then 'Migration 006 completed successfully'
    else 'Migration 006 verification failed'
  end as migration_status;
`;

const workflow = {
  name: 'database_migration_006_add_epex_spot_web',
  nodes: [
    {
      parameters: {},
      id: 'migration-manual-trigger',
      name: 'Run Migration Manually',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 0],
    },
    {
      parameters: {
        operation: 'executeQuery',
        query: `${migrationSql}${verificationSql}`,
        options: {},
      },
      id: 'migration-postgres',
      name: 'Apply and Verify Migration 006',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [260, 0],
    },
  ],
  connections: {
    'Run Migration Manually': {
      main: [
        [
          {
            node: 'Apply and Verify Migration 006',
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

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
