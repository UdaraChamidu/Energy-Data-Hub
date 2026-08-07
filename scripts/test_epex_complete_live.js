const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const codeDir = path.join(root, 'workflows', 'code');

function source(name) {
  return fs.readFileSync(path.join(codeDir, name), 'utf8');
}

async function fetchHtml(request) {
  const response = await fetch(request.request_url, {
    headers: {
      'User-Agent': 'Energy-Data-Hub/1.0 (normal EPEX public-results request)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.text();
  if (!response.ok) {
    throw new Error(`${request.key}: HTTP ${response.status}, ${data.length} bytes`);
  }
  return data;
}

async function main() {
  const requests = new Function(
    '$json',
    '$execution',
    source('epex_complete_build_requests.js'),
  )({}, { mode: 'manual' });
  const parser = new Function('$json', source('epex_complete_parse.js'));

  for (const item of requests) {
    const request = item.json;
    try {
      const data = await fetchHtml(request);
      const result = parser({ ...request, data })[0].json;
      console.log(
        `PASS ${result.result_type}: ${result.records_valid} rows for ${result.delivery_date}`,
      );
    } catch (error) {
      console.error(`FAIL ${request.key}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
