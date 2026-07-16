const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workflowsDir = path.join(root, 'workflows');
const workflowFiles = fs
  .readdirSync(workflowsDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function loadWorkflows() {
  return workflowFiles.map((file) => {
    const fullPath = path.join(workflowsDir, file);
    let workflow;

    try {
      workflow = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (error) {
      fail(`${file} is not valid JSON: ${error.message}`);
      return { file, workflow: null };
    }

    const nodes = workflow.nodes ?? [];
    const names = nodes.map((node) => node.name);
    const ids = nodes.map((node) => node.id);

    for (const [label, values] of [
      ['node name', names],
      ['node id', ids],
    ]) {
      const duplicates = [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
      if (duplicates.length > 0) {
        fail(`${file} has duplicate ${label}s: ${duplicates.join(', ')}`);
      }
    }

    for (const node of nodes) {
      if (node.parameters?.jsCode) {
        try {
          new Function('$json', node.parameters.jsCode);
        } catch (error) {
          fail(`${file} / ${node.name} has invalid JavaScript: ${error.message}`);
        }
      }

      if (node.type === 'n8n-nodes-base.postgres' && !node.parameters?.query) {
        fail(`${file} / ${node.name} has no PostgreSQL query`);
      }
    }

    for (const [sourceName, connectionTypes] of Object.entries(workflow.connections ?? {})) {
      if (!names.includes(sourceName)) {
        fail(`${file} connection source does not exist: ${sourceName}`);
      }

      for (const branches of Object.values(connectionTypes)) {
        for (const branch of branches ?? []) {
          for (const connection of branch ?? []) {
            if (!names.includes(connection.node)) {
              fail(`${file} connection target does not exist: ${connection.node}`);
            }
          }
        }
      }
    }

    console.log(`PASS: ${file} (${nodes.length} nodes)`);
    return { file, workflow };
  });
}

async function validateLiveSmard(workflows) {
  const entry = workflows.find(({ file }) => file === '03a_market_prices_smard_de_lu.json');
  if (!entry?.workflow) {
    fail('SMARD workflow is unavailable for the live test');
    return;
  }

  const indexUrl = 'https://www.smard.de/app/chart_data/4169/DE-LU/index_quarterhour.json';
  const indexResponse = await fetch(indexUrl);
  if (!indexResponse.ok) {
    throw new Error(`SMARD index returned HTTP ${indexResponse.status}`);
  }

  const indexPayload = await indexResponse.json();
  const buildNode = entry.workflow.nodes.find((node) => node.name === 'Build Latest SMARD URL');
  const buildResult = new Function('$json', buildNode.parameters.jsCode)(indexPayload);
  const seriesUrl = buildResult[0].json.series_url;

  const seriesResponse = await fetch(seriesUrl);
  if (!seriesResponse.ok) {
    throw new Error(`SMARD series returned HTTP ${seriesResponse.status}`);
  }

  const seriesPayload = await seriesResponse.json();
  const parseNode = entry.workflow.nodes.find((node) => node.name === 'Parse SMARD JSON');
  const parseResult = new Function('$json', parseNode.parameters.jsCode)(seriesPayload)[0].json;

  if (parseResult.records_valid < 1 || !parseResult.sql.includes('jsonb_to_recordset')) {
    throw new Error('SMARD parser did not produce valid rows and bulk-upsert SQL');
  }

  console.log(
    `PASS: live SMARD contract (${parseResult.records_valid} valid of ${seriesPayload.series.length} points)`,
  );
}

function validateSmardNullHandling(workflows) {
  const entry = workflows.find(({ file }) => file === '03a_market_prices_smard_de_lu.json');
  const parseNode = entry?.workflow?.nodes.find((node) => node.name === 'Parse SMARD JSON');
  if (!parseNode) {
    fail('SMARD parser is unavailable for the null-price regression test');
    return;
  }

  const sample = {
    meta_data: { created: 1784202780044 },
    series: [
      [1783893600000, 131.94],
      [1783894500000, null],
      [1783895400000, ''],
    ],
  };
  const result = new Function('$json', parseNode.parameters.jsCode)(sample)[0].json;

  if (result.records_valid !== 1) {
    fail('SMARD parser converts unpublished null/empty prices into numeric values');
    return;
  }

  console.log('PASS: SMARD null-price regression');
}

function validateEntsoeParser(workflows) {
  const entry = workflows.find(({ file }) => file === '03_market_prices_entsoe_de_lu.json');
  const parseNode = entry?.workflow?.nodes.find((node) => node.name === 'Parse ENTSO-E XML');
  if (!parseNode) {
    fail('ENTSO-E parser is unavailable for the sample contract test');
    return;
  }

  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
    <Publication_MarketDocument>
      <TimeSeries>
        <Period>
          <timeInterval><start>2026-07-16T00:00Z</start><end>2026-07-16T00:30Z</end></timeInterval>
          <resolution>PT15M</resolution>
          <Point><position>1</position><price.amount>-12.34</price.amount></Point>
          <Point><position>2</position><price.amount>45.67</price.amount></Point>
        </Period>
      </TimeSeries>
    </Publication_MarketDocument>`;
  const result = new Function('$json', parseNode.parameters.jsCode)({ data: sampleXml });

  if (
    result.length !== 2 ||
    result[0].json.product !== 'quarter_hour_day_ahead' ||
    result[0].json.price_eur_mwh !== -12.34 ||
    result[1].json.delivery_start !== '2026-07-16T00:15:00.000Z'
  ) {
    fail('ENTSO-E parser does not map the sample A44 quarter-hour points correctly');
    return;
  }

  console.log('PASS: ENTSO-E A44 parser sample');
}

async function validateLiveFrequency(workflows) {
  const entry = workflows.find(({ file }) => file === '01_grid_frequency_netzfrequenzmessung_de.json');
  const parseNode = entry?.workflow?.nodes.find((node) => node.name === 'Parse Frequency XML');
  if (!parseNode) {
    throw new Error('frequency parser is unavailable for the live test');
  }

  const url = 'https://dat.netzfrequenzmessung.de:9080/frequenz.xml';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`frequency endpoint returned HTTP ${response.status}`);
  }

  const xml = await response.text();
  const result = new Function('$json', parseNode.parameters.jsCode)({ data: xml })[0].json;
  if (result.actual_hz < 45 || result.actual_hz > 55 || result.target_hz !== 50) {
    throw new Error(`frequency parser returned an implausible value: ${result.actual_hz}`);
  }

  console.log(`PASS: live frequency contract (${result.actual_hz} Hz at ${result.measured_at})`);
}

async function main() {
  const workflows = loadWorkflows();
  validateSmardNullHandling(workflows);
  validateEntsoeParser(workflows);

  if (process.argv.includes('--live-smard')) {
    try {
      await validateLiveSmard(workflows);
    } catch (error) {
      fail(`live SMARD contract: ${error.message}`);
    }
  }

  if (process.argv.includes('--live-frequency')) {
    try {
      await validateLiveFrequency(workflows);
    } catch (error) {
      fail(`live frequency contract: ${error.message}`);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`All ${workflowFiles.length} workflows passed validation.`);
}

main();
