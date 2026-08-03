const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const codeDirectory = path.join(projectRoot, 'workflows', 'code');

function loadCode(name) {
  return fs.readFileSync(path.join(codeDirectory, name), 'utf8');
}

function execute(name, json) {
  return new Function('$json', loadCode(name))(json);
}

async function fetchHtml(url) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(45000),
      });
      const html = await response.text();
      if (!response.ok || html.length < 10000) {
        throw new Error(`HTTP ${response.status}, ${html.length} bytes`);
      }
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  throw lastError;
}

async function main() {
  const [{ json: urls }] = execute('epex_build_urls.js', {});
  const cases = [
    {
      label: 'auction',
      url: urls.auction_url,
      parser: 'epex_parse_auction.js',
    },
    {
      label: 'continuous',
      url: urls.continuous_url,
      parser: 'epex_parse_continuous.js',
    },
  ];

  for (const testCase of cases) {
    const html = await fetchHtml(testCase.url);
    const [{ json: result }] = execute(testCase.parser, { data: html });
    if (!result.sql?.includes('energy_data.')) {
      throw new Error(`${testCase.label} parser did not generate PostgreSQL SQL.`);
    }
    const summary = { ...result, sql: `${result.sql.length} characters` };
    console.log(JSON.stringify({ case: testCase.label, htmlBytes: html.length, ...summary }));
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
