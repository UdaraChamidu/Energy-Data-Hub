const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(
  root, 'workflows', '10_market_prices_energy_charts_auctions_de_lu.json',
);
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const parser = workflow.nodes.find((node) => node.name === 'Parse Day-Ahead and IDA1-3');
const builder = workflow.nodes.find((node) => node.name === 'Build Current and Next Week URLs');
if (!parser || !builder) throw new Error('Auction workflow code nodes are missing.');

function runParser(items) {
  const input = { all: () => items.map((json) => ({ json })) };
  return new Function('$json', '$input', parser.parameters.jsCode)({}, input);
}

function assertResult(result, { requireAllProducts = true } = {}) {
  if (!Array.isArray(result) || result.length < 1) {
    throw new Error('Auction parser returned no output.');
  }
  const item = result[0].json;
  const requiredCodes = requireAllProducts
    ? ['day_ahead', 'ida1', 'ida2', 'ida3']
    : ['day_ahead'];
  for (const code of requiredCodes) {
    if (!(item.product_counts[code] > 0)) {
      throw new Error(`Auction parser produced no ${code} rows.`);
    }
  }
  if (!item.sql.includes('energy_charts_auction_prices')) {
    throw new Error('Auction parser SQL targets the wrong table.');
  }
  if (!item.sql.includes('on conflict (source_id, market_id, auction_code')) {
    throw new Error('Auction parser SQL does not upsert by delivery interval.');
  }
  return item;
}

async function main() {
  if (process.argv.includes('--live')) {
    const urls = new Function('$json', builder.parameters.jsCode)({});
    const bodies = [];
    for (const item of urls) {
      const response = await fetch(item.json.request_url, {
        headers: { 'User-Agent': 'Energy-Data-Hub/1.0 (auction contract test)' },
      });
      if (response.ok) bodies.push({ data: await response.text() });
    }
    const item = assertResult(runParser(bodies), { requireAllProducts: false });
    console.log(
      `PASS: live Fraunhofer auctions (${item.records_valid} rows; ` +
      `${JSON.stringify(item.product_counts)})`,
    );
    return;
  }

  const sample = fs.readFileSync(
    path.join(
      root, 'api', 'samples',
      'fraunhofer_chart_15min_week_2026_35.json',
    ),
    'utf8',
  );
  const item = assertResult(runParser([{ data: sample }]));
  console.log(
    `PASS: sampled Fraunhofer auctions (${item.records_valid} rows; ` +
    `${JSON.stringify(item.product_counts)})`,
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
