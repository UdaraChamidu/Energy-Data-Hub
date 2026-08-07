# n8n Workflows

## EPEX SPOT public results

`06_epex_spot_intraday_web_de.json` is an inactive, provisional collector based
on Peter's legacy URL parameters. It performs two normal requests every 15
minutes:

1. DE-LU intraday auction IDA1 results.
2. Continuous results containing 15-minute and 60-minute Low/High/Last rows.

Before importing it, run `database/006_add_epex_spot_web.sql`. After import, set
the existing PostgreSQL credential on both Postgres nodes and execute the
workflow manually. Both terminal nodes must succeed. Expected parser totals are
96 auction rows and 120 continuous result rows on a normal 24-hour day.

Do not activate it if either HTTP response is challenged/empty or a parser
reports the wrong table or row count. The validation intentionally prevents
partial or incorrectly selected EPEX pages from entering PostgreSQL.

This folder contains starter n8n workflows for the Germany-first ingestion phase.

## Fraunhofer Energy-Charts provisional intraday feed

`07_market_prices_energy_charts_intraday_de_lu.json` is the client-approved
temporary collector. It makes two public requests every 30 minutes and stores
15-minute and 60-minute Average, Low, High, ID1 and ID3 values. It does not
manufacture a Last value. Run database migration `007` before testing it.

## Import Order

1. `01_grid_frequency_netzfrequenzmessung_de.json`
2. `02_grid_time_deviation_calculated.json`
3. `03_market_prices_entsoe_de_lu.json`
4. `03a_market_prices_smard_de_lu.json`
5. `04_market_price_ohlc_builder.json`
6. `05_ingestion_health_monitor.json`
7. `07_market_prices_energy_charts_intraday_de_lu.json`

Keep `06_epex_spot_intraday_web_de.json` inactive while direct EPEX continuous
requests remain unreliable.

## EPEX Complete Market Results

`08_epex_complete_market_results_de.json` implements Werner's exact requested
product list: Day-Ahead MRC, IDA1, IDA2, IDA3, Continuous 15-minute, and
Continuous 60-minute. It uses only normal HTTPS requests. It contains no Tor,
proxy rotation, IP disguise, or embedded secret.

Manual execution builds and tests all six requests. Scheduled execution runs
every 30 minutes, always checks the two continuous products, and checks auction
pages only during their expected Europe/Berlin publication hour to reduce
requests. The parser rejects blocked pages, wrong tables, wrong delivery dates,
invalid price bounds, and incomplete 23/24/25 or 92/96/100-row days before SQL
is executed.

Apply migration `008`, assign the existing PostgreSQL credential to `Store
Validated EPEX Result`, and test manually. Keep workflow `08` inactive unless
all six items reach PostgreSQL successfully through normal access and EPEX use
is approved. Fraunhofer workflow `07` remains the working fallback.

## Before Activating

Create or select your n8n PostgreSQL credential, then assign it to every PostgreSQL node after import. The workflow JSON files intentionally do not include placeholder PostgreSQL credential IDs, so imports should be cleaner across n8n instances.

For ENTSO-E, define this environment variable in the n8n runtime:

```text
ENTSOE_SECURITY_TOKEN=your_real_token
```

The imported workflow reads it as `{{$env.ENTSOE_SECURITY_TOKEN}}`; the token is not stored in workflow JSON.

## Required Database Scripts

Apply these PostgreSQL files first:

1. `database/001_create_energy_data_schema.sql`
2. `database/002_seed_germany_sources.sql`
3. `database/003_create_views.sql`
4. `database/005_align_client_api_sources.sql`

## Notes

- The grid-frequency workflow polls `netzfrequenzmessung.de` every 3 seconds.
- The grid-time-deviation workflow creates an approximate calculated value from recent frequency samples.
- The ENTSO-E workflow stores Germany/DE-LU price points from document type `A44`.
- The SMARD workflow stores the client-named `4169` Germany/DE-LU quarter-hour wholesale-price series as a fallback/cross-check.
- The OHLC builder derives 15-minute and 60-minute aggregates from stored price points.
- For the free sources, these are day-ahead interval aggregates, not continuous intraday trade OHLC values.
- These workflows are meant as production-oriented starters. After import, test each workflow manually before activation.
