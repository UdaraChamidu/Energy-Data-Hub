# Fraunhofer Auction Setup

This implementation adds Day-Ahead, IDA1, IDA2, and IDA3 auction clearing
prices without changing the existing SMARD/ENTSO-E or Fraunhofer continuous
workflows and dashboards.

## 1. Apply Migration 010 Through n8n

Import `database/n8n_workflows/010_add_energy_charts_auctions.json`.

1. Assign the existing PostgreSQL credential to
   `Apply Fraunhofer Auction Schema`.
2. Execute the workflow manually once.
3. Confirm `Migration 010 completed successfully`.
4. Leave this migration workflow inactive.

## 2. Import And Test Workflow 10

Import `workflows/10_market_prices_energy_charts_auctions_de_lu.json`.

1. Assign the existing PostgreSQL credential to
   `Store Fraunhofer Auction Prices`.
2. Execute `Test Auctions Manually`.
3. Confirm the parser output contains `product_counts` for `day_ahead`,
   `ida1`, `ida2`, and `ida3`.
4. A zero count is valid when an auction has not yet been published.
5. Confirm the PostgreSQL node succeeds for every parser output item.
6. Activate the workflow. It polls every 30 minutes.

The collector checks the current and following ISO week. On Mondays it also
checks the completed previous week so a `now-24h` dashboard includes Sunday's
rows across the ISO-week boundary. This captures next-day Monday delivery prices
when they become available on Sunday without adding the historical request on
other weekdays. It archives each distinct raw weekly response and upserts
published 15-minute clearing prices.

## 3. Verify PostgreSQL Coverage

Run in Grafana Explore:

```sql
select *
from energy_data.v_energy_charts_auction_coverage
order by auction_code;
```

Expected products are `day_ahead`, `ida1`, `ida2`, and `ida3`. Publication
timing differs by auction. Missing rows must remain missing and must not be
copied, interpolated, or replaced with another product.

## 4. Import The Separate Grafana Test Dashboard

Import
`grafana/dashboards/germany-energy-monitoring-fraunhofer-auctions.json` and map
`Energy Data Hub PostgreSQL` to the existing datasource. Its UID is
`energy-data-hub-de-fraunhofer-auctions`, so it does not replace an existing
dashboard.

The initial range is `now-24h` to `now+24h` in `Europe/Berlin`. All panels use a
fixed 110-pixel Y-axis width and shared crosshair. Auction panels use one signed
clearing price, step-after interpolation, and no fill.

## 5. Client Decisions Still Required

Before making this the production/main dashboard, obtain written confirmation:

1. May the company automatically collect, store, and externally display the
   Fraunhofer weekly chart JSON for commercial use?
2. Should the two provisional continuous High/Low/Average panels remain in the
   final dashboard, or should it contain only the four auction curves?
3. If Fraunhofer remains delayed or unavailable, should the company request a
   Nord Pool quote covering German Day-Ahead and IDA1-3 API rights, storage, and
   external Grafana display?

No API key is required for this provisional Fraunhofer collector. Do not add
the ENTSO-E token, Netztransparenz secret, EPEX credentials, or proxy settings
to workflow 10.
