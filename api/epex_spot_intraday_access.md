# EPEX SPOT Germany Intraday Data Access

Research checked: 2026-07-31.

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

Fraunhofer Energy-Charts publicly displays German continuous intraday average,
Low, High, ID1 and ID3 series. However, its documented API version 1.6 exposes
only a `/price` endpoint for Day-Ahead Price; it does not document an endpoint
for continuous intraday Low, High or Last. The public API also directs
commercial customers to request API-key access.

Therefore Energy-Charts is useful for manual comparison, but it is not a
confirmed replacement for the licensed EPEX feed required by this production
dashboard. An undocumented website endpoint must not be treated as a stable or
licensed API.

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
