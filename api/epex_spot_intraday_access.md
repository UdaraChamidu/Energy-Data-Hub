# EPEX SPOT Germany Intraday Data Access

Research checked: 2026-07-31.

Client decision on 2026-08-04: use Fraunhofer Energy-Charts as the provisional
test source and reconsider licensed EPEX access later. The implemented workflow
polls the two weekly files every 30 minutes and stores Average/Low/High/ID1/ID3
without labelling Average as Last.

## Requirement

The client requires genuine EPEX SPOT Germany continuous intraday data:

- Current/running intraday price in EUR/MWh.
- 15-minute Low, High and Last.
- 60-minute Low, High and Last.
- Data suitable for PostgreSQL storage and Grafana display.

ENTSO-E A44, SMARD filter 4169 and aWATTar provide auction/delivery
interval prices. They do not provide the continuous trades needed for genuine
intraday Low, High and Last values.

## Official EPEX Options

| Product | Reference | Delivery | Published price | Suitability |
| --- | --- | --- | ---: | --- |
| DE Index on the continuous market - Delayed | `DE RES CONT DEL SFTP` | SFTP, updated every 20 minutes | From EUR 86.67/month | Lowest-cost candidate. Ask EPEX to confirm that the licensed files include 15-minute and 60-minute Low, High and Last results as shown on the public market-results page. |
| DE Data package on the continuous market - Delayed | `DE TRA + RES CONT DEL SFTP` | SFTP, updated every 20 minutes | From EUR 108.33/month | Recommended delayed fallback if the index product is insufficient. Contains all continuous intraday trades and indices, so OHLC can be calculated. |
| DE Continuous API Read-only | `DE CONT API RO RT` | M7 production API, real time | From EUR 400/month | Correct choice when real-time orders/trades are mandatory. Contract, membership/access approval and EPEX documentation are required. |
| DE Indices on the continuous market - EOD | `DE RES CONT EOD` | End of trading session | From EUR 54.17/month | Cheapest official product found, but not suitable for a live dashboard. |

Published prices are starting prices and the subscriptions renew and are
invoiced annually. EPEX may apply additional licensing conditions, especially
when data are shown externally.

## Recommendation

Ask EPEX SPOT for a quote and written field confirmation for:

```text
DE RES CONT DEL SFTP
```

Choose it if it contains all of these fields for German 15-minute and
60-minute continuous products:

```text
delivery start/end
Low
High
Last
weighted average
ID Full
ID1
ID3
publication/update timestamp
```

If it does not contain Low, High and Last, use:

```text
DE TRA + RES CONT DEL SFTP
```

This is the best cost-conscious implementation because one SFTP collection
every 20 minutes is only 72 scheduled checks per day. It also avoids the
complexity and EUR 400/month starting price of the real-time M7 API.

Only choose `DE CONT API RO RT` if the client confirms that a delay of up to
20 minutes is unacceptable.

## Information To Request From EPEX

Contact:

```text
marketdata.sales@epexspot.com
```

Request:

1. Eligibility for a non-trading company to license the selected product.
2. A quote for Germany only.
3. Confirmation of 15-minute and 60-minute Low, High and Last fields.
4. Whether current/running intraday price or Last is included.
5. Internal dashboard and externally shared dashboard display rights.
6. Data storage, retention and redistribution rights.
7. Sample files and current file-format specification.
8. SFTP host, port, username, authentication method and remote paths.
9. Historical/backfill availability.
10. Production and test credentials.

## Suggested Email

```text
Subject: Germany continuous intraday data for monitoring dashboard

Hello EPEX SPOT Market Data Team,

We are building a Germany energy-monitoring dashboard and require official
German continuous intraday market data for 15-minute and 60-minute products.

Required fields are the current/latest price and Low, High and Last in EUR/MWh.
A delay of up to 20 minutes may be acceptable.

Could you please confirm whether product DE RES CONT DEL SFTP includes these
fields for both 15-minute and 60-minute products? If not, please confirm
whether DE TRA + RES CONT DEL SFTP is the least-cost product that allows us to
calculate them.

Please also provide a quote, sample files, technical specifications, access
requirements, and licensing terms for storing the data in PostgreSQL and
displaying it on an internally or externally shared Grafana dashboard.

Kind regards
```

## Implementation After Approval

For a delayed SFTP subscription:

1. Store EPEX credentials in an n8n SFTP credential, never in workflow JSON.
2. Poll once every 20 minutes, after the provider's file update.
3. Track the last processed filename/checksum to avoid duplicate processing.
4. Store raw source metadata and normalized trade/index records.
5. Build 15-minute and 60-minute OHLC with idempotent PostgreSQL upserts.
6. Update Grafana to use the EPEX source only for intraday panels.
7. Keep ENTSO-E and SMARD for day-ahead panels and cross-checking.

Do not scrape the EPEX public market-results page for production use. It is
not a documented public REST API, and the page states that commercial usage
requires explicit EPEX approval.

## Free Alternatives Rechecked

Fraunhofer Energy-Charts publicly displays German continuous intraday Average,
Low, High, ID1 and ID3 series. Its documented API version 1.6 exposes only a
`/price` endpoint for Day-Ahead Price; it does not document an endpoint for
continuous intraday results. The public API also directs commercial customers
to request API-key access.

The chart itself loads public weekly JSON files. These were live-tested on
2026-07-31 and contained the following DE-LU series for both 15-minute and
60-minute products:

```text
Average Price
Low Price
High Price
ID1 Price
ID3 Price
```

Current-week examples:

```text
https://energy-charts.info/charts/price_spot_market/data/de/week_15min_2026_31.json
https://energy-charts.info/charts/price_spot_market/data/de/week_2026_31.json
```

The year and ISO week must be calculated dynamically. The first JSON series
contains `xAxisValues` as Unix milliseconds; all series data arrays use those
same positions.

This route is technically suitable for a low-request provisional collector:
fetch the two files once every 30 minutes (96 HTTP requests/day total), parse
only the five named intraday series, and upsert published values.

Important limitations:

- The files do not contain `Last`, so Average must not be labelled as Last.
- The files are website implementation data, not a documented API contract,
  and their path or schema can change without API deprecation guarantees.
- Commercial/external-dashboard use should be confirmed in writing with
  Fraunhofer Energy-Charts and, if required, EPEX SPOT.
- Direct scraping of EPEX market-results pages is not recommended because EPEX
  explicitly requires approval for commercial use.

SMARD was also rechecked. Its selected public price series contains
day-ahead/wholesale delivery prices, not continuous intraday Average, Low,
High, ID1, ID3 or Last.

## Direct EPEX Website Scraper Feasibility

The client later requested direct scraping of:

```text
https://www.epexspot.com/en/market-data
```

That URL redirects to `/en/market-results`. Live tests on 2026-07-31 found:

- Automated HTTP requests receive HTTP `202` with
  `x-amzn-waf-action: challenge` and an empty response body.
- Headless Chrome receives `403 Forbidden`.
- The results application requires a data-use disclaimer session and a Drupal
  AJAX form submission before table data are returned.

Consequently, a normal n8n HTTP Request workflow cannot scrape this page. A
headless-browser workflow is also not currently viable from the tested host.
Trying to bypass the WAF or repeatedly replay short-lived browser cookies would
be unreliable for a production collector.

Before attempting direct EPEX scraping, obtain Peter's previous scraper source,
runtime details and persisted browser/session configuration. This will show
whether the old system used a licensed endpoint, a manually maintained browser
session, or an infrastructure path that EPEX allows.

The technically available no-key fallback remains the Energy-Charts weekly
JSON collector described above. It is accessible to n8n but has no `Last`
field and still needs usage-rights confirmation.

### Peter's legacy files received

The supplied `epex-cron.php` confirms that the old collector requested three
configurations named `INTRA`, `CONT15`, and `CONT1H`. It parsed:

- buy volume, sell volume, volume and price;
- 15-minute Low, High and Last; and
- 60-minute Low, High and Last.

The schema-only `scraper.sql` received on 2026-08-01 confirms the corresponding
MySQL tables, but it contains no data rows. In particular, the `params` table is
empty in the export, while its rows hold the request URL and URL fragments used
by the PHP code. Those three parameter rows were the only additional legacy data
needed to build a test workflow; the time-index rows and old PHP dependencies can
be replaced in the new implementation.

The parameter and time-index rows were received on 2026-08-03. They confirmed
IDA1 auction and continuous product 15/60 requests. Live testing produced one
valid 96-row auction table and one valid continuous hierarchy containing 96
quarter-hour and 24 hourly rows. Other continuous requests returned the wrong
table or an HTTP 202 AWS challenge, so the source is not yet proven reliable.

The provisional `epex_spot_intraday_web_de` n8n workflow uses two requests per
normal run, validates table type and complete row counts, and writes nothing for
challenged, empty, partial or incorrectly selected responses. It must remain
inactive until both branches pass a manual execution from the actual n8n host.

## Official References

- DE Continuous API Read-only:
  https://webshop.eex-group.com/data-type/de-continuous-api-read-only
- DE delayed continuous index:
  https://webshop.eex-group.com/data-type/de-index-continuous-market-delayed
- DE delayed trades and indices:
  https://webshop.eex-group.com/data-type/de-data-package-continuous-market-delayed
- DE end-of-day indices:
  https://webshop.eex-group.com/data-type/de-indices-continuous-market-eod
- EPEX SPOT market results:
  https://www.epexspot.com/en/market-results
- Fraunhofer Energy-Charts API specification:
  https://api.energy-charts.info/openapi.json
- Fraunhofer Energy-Charts intraday chart:
  https://www.energy-charts.info/charts/price_spot_market/chart.htm?c=DE
