# Grafana Dashboard

This folder contains the Germany-first Grafana dashboard requested in the client documents.

## Client Requirement Coverage

| Client dashboard block | Implemented panel |
| --- | --- |
| Grid frequency: target and actual | `Grid Frequency - Target vs Actual` |
| Grid time and deviation | `Grid Time` and `Grid Time Deviation` |
| Current electricity price | `Current Delivery Price` |
| 15-minute High, Low and Last | `15-Minute Price - High / Low / Last` |
| 60-minute High, Low and Last | `60-Minute Price - High / Low / Last` |
| 15m/60m daily Low and High | Four panels under `Daily Price Records` |
| Stable unattended operation | `Ingestion Health` table |

## Import Through The Grafana UI

1. Generate or regenerate the dashboard:

   ```powershell
   node grafana\generate_dashboard.js
   node scripts\validate_grafana_dashboard.js
   ```

2. In Grafana, open **Dashboards**.
3. Click **New** and then **Import**.
4. Upload `grafana/dashboards/germany-energy-monitoring.json`.
5. Map `Energy Data Hub PostgreSQL` to the PostgreSQL datasource already connected to the `grafana` database.
6. Keep the UID `energy-data-hub-de` unless that UID already exists.
7. Click **Import**.
8. At the top of the dashboard, use **Price source**:
   - `Auto` prefers ENTSO-E and falls back to SMARD when ENTSO-E has no matching data.
   - `ENTSO-E` and `SMARD` force one source for troubleshooting or comparison.

## Expected Settings

- Dashboard timezone: `Europe/Berlin`.
- Initial time range: last 6 hours.
- Auto refresh: 5 seconds.
- PostgreSQL schema: `energy_data`.
- Grafana datasource account: read-only access to the schema.

## Data Accuracy Notes

- Grid frequency uses the live frequency collector and a configured target of 50 Hz.
- Grid time deviation is calculated from frequency samples and is labelled as an approximation.
- ENTSO-E and SMARD provide day-ahead delivery-interval prices in the current implementation.
- The current price is the price for the delivery interval active now, not a continuous intraday trade.
- A 15-minute interval normally has one clearing price, so its derived High, Low and Last values can be equal.
- True continuous EPEX intraday High/Low/Last requires a licensed trade-data source.

## No-Data Troubleshooting

Twelve hours is enough time for the price panels to populate. A successful price collector followed by one successful OHLC-builder run is sufficient.

Run `grafana/dashboard_data_diagnostics.sql` against PostgreSQL. The important results are:

- `market_price_points` must contain `entsoe` or `smard` rows covering the current date.
- `market_price_ohlc` must contain both `15m` and `60m` rows.
- `v_grafana_market_price_stats_today` must return rows for the current Europe/Berlin date.
- If these are empty, inspect the corresponding n8n workflow executions before changing Grafana.

If SMARD panels work but ENTSO-E panels do not, Grafana and the OHLC pipeline are working. Inspect the latest `market_prices_entsoe_de_lu` execution in n8n, especially the `Fetch ENTSO-E Prices` node. Verify that `ENTSOE_SECURITY_TOKEN` is available inside the running n8n service and that the response contains a `TimeSeries` element.

## Dashboard As Code

`generate_dashboard.js` is the source of truth. Edit the generator and run it again instead of manually editing the generated JSON.

For server-side file provisioning, place the generated JSON in Grafana's dashboard directory and configure a file provider in Grafana's `provisioning/dashboards` directory. The portable JSON uses a datasource import input, so UI import is the recommended first deployment method.
