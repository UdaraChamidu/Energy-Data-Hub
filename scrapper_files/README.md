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

## Missing requirements

The two supplied PHP files are not a complete runnable scraper. Ask Peter for:

1. `proxyConnector.class.php` and details of the proxy/Tor service it expects.
2. `Connections/dbconnect.php` with credentials removed or supplied securely.
3. `simple_html_dom.php` and its version/source.
4. An export of the `params` rows for `INTRA`, `CONT15`, and `CONT1H`. These rows
   contain the actual request URLs and URL fragments; they are not in the PHP.
5. The schemas and sample rows for `netzdaten_chronik`, `tempintra15`,
   `tempcont15`, `tempcont1h`, `timeidx15`, and `timeidx1h`.
6. The old cron schedules, PHP version, server timezone, and a successful sample
   response for each of the three EPEX requests.
7. Confirmation that the scraper still works against the current EPEX website
   and that its use is authorized for the company's intended purpose.

## Important findings

- The EPEX URLs are stored in the old MySQL `params` table, so the destination
  and exact response format cannot be verified from these files alone.
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
