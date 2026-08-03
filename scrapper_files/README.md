# Peter's Legacy EPEX Scraper Files

## What these files do

- `freq-cron.php` retrieves a Swissgrid frequency response and inserts timestamped
  rows into the legacy MySQL table `scraper.netzdaten_chronik`.
- `epex-cron.php` retrieves three HTML pages, parses intraday values, and updates
  price columns on the rows that already exist in `netzdaten_chronik`.

This explains Peter's statement that the EPEX job needs the frequency job. The
dependency comes from the old database design: the EPEX code performs `UPDATE`
statements and does not create its own time-series rows.

The new Energy Data Hub does not need to preserve this dependency. Its existing
n8n frequency workflow can continue independently, while a new EPEX collector
can upsert price records directly into PostgreSQL using their delivery interval
timestamps.

## Received database structure

Peter supplied `scraper.sql` on 2026-08-01. It is a schema-only MySQL/MariaDB
export: it contains `CREATE TABLE` statements but no table rows. It confirms the
old storage model for:

- intraday buy volume, sell volume, volume and price;
- 15-minute Low, High and Last;
- 60-minute Low, High and Last;
- 96 quarter-hour and 24 hourly time-index rows; and
- the combined frequency/price history table `netzdaten_chronik`.

The time-index rows do not need to be requested because the new collector can
calculate interval boundaries directly. The old PHP libraries and MySQL
connection file also do not need to be reused if the collector is rewritten for
n8n and PostgreSQL.

## Parameter and time-index exports received

Peter supplied `params.sql`, `timeidx15.sql`, `timeidx30.sql`, and
`timeidx1h.sql` on 2026-08-03. The parameter rows identify:

- `INTRA`: DE-LU intraday auction IDA1 results;
- `CONT15`: German continuous results requested with product 15;
- `CONT1H`: German continuous results requested with product 60; and
- `CONT30`: German continuous results requested with product 30.

The old continuous page contains a hierarchy of hourly, half-hourly and
quarter-hourly rows. The new parser uses the row hierarchy and calculates UTC
interval boundaries from Europe/Berlin midnight, so the static time-index tables
are not required and daylight-saving days can be handled without Peter's lookup
tables.

## Live test status

Tests on 2026-08-03 produced mixed results:

- The IDA1 auction URL returned HTTP 200 and exactly 96 valid quarter-hour rows.
- A continuous URL returned the expected table once: 24 hourly rows, 48
  half-hourly rows and 96 quarter-hourly rows.
- Repeated continuous requests sometimes returned the auction table instead of
  the requested continuous table.
- Later requests received HTTP 202 with an AWS WAF challenge and an empty body.

The generated n8n workflow therefore validates the table type, date, row counts,
numbers and Low/High/Last bounds before creating SQL. It writes nothing for an
empty, challenged, partial or wrong table. Keep it inactive until a manual run
from the company's n8n host successfully completes both branches.

## Important findings

- The EPEX URLs were recovered from `params.sql`; current delivery remains
  dependent on EPEX returning the requested table consistently.
- The EPEX job expects a SOCKS5 proxy on `127.0.0.1:9050` and additional proxy
  helper code.
- Its HTML selectors are tied to an older page structure and may no longer match
  the current EPEX website.
- The scripts concatenate scraped values into SQL instead of using parameters,
  have little validation/error reporting, and should not be deployed unchanged.
- `freq-cron.php` contains a plaintext database password. Treat it as exposed,
  rotate it, and replace hard-coded secrets with managed credentials.

## Recommended new architecture

1. n8n runs the EPEX collection on an agreed schedule.
2. A permitted and working collector returns normalized JSON for Germany.
3. n8n validates timestamps, intervals, prices, and observation counts.
4. PostgreSQL receives idempotent upserts into the Energy Data Hub price tables.
5. Grafana reads the EPEX source from PostgreSQL and displays it in the aligned
   intraday panel and 15/60-minute charts.

Do not execute the supplied files on the production n8n or database hosts until
the missing dependencies, current endpoint behavior, authorization, and exposed
credential have been resolved.
