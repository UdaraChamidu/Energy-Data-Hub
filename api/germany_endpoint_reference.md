# Germany Endpoint Reference

## 1. Grid Frequency

Provider:

- `netzfrequenzmessung.de`

Endpoint:

```text
GET https://dat.netzfrequenzmessung.de:9080/frequenz.xml
```

Documented response example:

```xml
<r>
  <f>49.976</f>
  <z>2025-09-30T16:37:41+00:00</z>
</r>
```

Response mapping:

| XML field | Meaning | PostgreSQL target |
| --- | --- | --- |
| `f` | Actual frequency in Hertz | `grid_frequency_measurements.actual_hz` |
| `z` | UTC timestamp in ISO-8601 format | `grid_frequency_measurements.measured_at` and/or `source_published_at` |

Configuration:

```text
GRID_FREQUENCY_PROVIDER=netzfrequenzmessung
GRID_FREQUENCY_URL=https://dat.netzfrequenzmessung.de:9080/frequenz.xml
GRID_FREQUENCY_TARGET_HZ=50.000
GRID_FREQUENCY_POLL_SECONDS=3
```

Polling:

- Recommended: every 3 seconds because the API publishes a 3-second moving average.
- Hard maximum: do not poll more often than once per second.

Notes:

- The endpoint returns actual frequency only.
- Target frequency should be stored as `50.000` for now.
- Grid time deviation is not returned by this endpoint.

## 2. Grid Time Deviation

No clean public API endpoint has been selected yet.

First-build approach:

- Calculate `grid_time` and `deviation_seconds` internally from stored frequency samples.
- Mark the source/calculation in the database using `quality` or `calculated_from`.

Important:

- This calculated value will be an operational approximation, not an official Swissgrid/ENTSO-E grid-time feed.
- If the client later provides an official grid-time API, swap the workflow source while keeping the same PostgreSQL table.

Suggested configuration:

```text
GRID_TIME_DEVIATION_MODE=calculated_from_frequency
GRID_TIME_DEVIATION_BASE_HZ=50.000
GRID_TIME_DEVIATION_POLL_SECONDS=3
```

## 3. ENTSO-E Day-Ahead / Market Prices For Germany

Provider:

- ENTSO-E Transparency Platform Web API.

Endpoint:

```text
GET https://web-api.tp.entsoe.eu/api
```

Germany bidding zone:

```text
DE_LU_DOMAIN=10Y1001A1001A82H
```

Example query shape:

```text
https://web-api.tp.entsoe.eu/api
  ?securityToken=${ENTSOE_SECURITY_TOKEN}
  &documentType=A44
  &in_Domain=10Y1001A1001A82H
  &out_Domain=10Y1001A1001A82H
  &periodStart=202606270000
  &periodEnd=202606280000
```

Parameters:

| Parameter | Value for Germany first build | Meaning |
| --- | --- | --- |
| `securityToken` | env var | ENTSO-E API token |
| `documentType` | `A44` | Price document |
| `in_Domain` | `10Y1001A1001A82H` | DE-LU bidding zone |
| `out_Domain` | `10Y1001A1001A82H` | DE-LU bidding zone |
| `periodStart` | `YYYYMMDDHHMM` | Start datetime |
| `periodEnd` | `YYYYMMDDHHMM` | End datetime |

Expected response:

- XML document.
- Contains one or more time series.
- Each period contains:
  - interval start/end.
  - resolution such as `PT15M` or `PT60M`.
  - points with position and price amount.

PostgreSQL mapping:

| ENTSO-E field/concept | PostgreSQL target |
| --- | --- |
| period interval start + point position | `market_price_points.delivery_start` |
| resolution | derive `delivery_end` and `product` |
| price amount | `market_price_points.price_eur_mwh` |
| currency/unit if present | `market_price_points.currency` |
| publication timestamp if present | `market_price_points.source_published_at` |

Suggested configuration:

```text
ENTSOE_API_BASE_URL=https://web-api.tp.entsoe.eu/api
ENTSOE_SECURITY_TOKEN=replace_me
ENTSOE_DE_LU_DOMAIN=10Y1001A1001A82H
ENTSOE_PRICE_DOCUMENT_TYPE=A44
ENTSOE_PRICE_POLL_MINUTES=15
```

## 4. EPEX/EEX Market Data Service

Provider:

- EPEX SPOT / EEX Group market data services.

Use case:

- True EPEX continuous intraday current price.
- True 15-minute and 60-minute High/Low/Last if the purchased/licensed feed includes those fields or trade/order data.

Status:

- Not selected for immediate free build because it requires market-data ordering/licensing.
- Keep as the upgrade path if ENTSO-E data is not enough.

Need from client later:

```text
EPEX/EEX market data credentials
Feed type: API, SFTP, or vendor
Licensed products: Germany intraday, day-ahead, 15-minute, 60-minute
Usage rights for storage in PostgreSQL and dashboard display
```

## 5. aWATTar Fallback Price Feed

Documented Austrian endpoint:

```text
GET https://api.awattar.at/v1/marketdata
```

Known German equivalent to verify before use:

```text
GET https://api.awattar.de/v1/marketdata
```

Documented response shape:

```json
{
  "object": "list",
  "data": [
    {
      "start_timestamp": 1428591600000,
      "end_timestamp": 1428595200000,
      "marketprice": 42.09,
      "unit": "Eur/MWh"
    }
  ]
}
```

PostgreSQL mapping:

| JSON field | PostgreSQL target |
| --- | --- |
| `start_timestamp` | `market_price_points.delivery_start` |
| `end_timestamp` | `market_price_points.delivery_end` |
| `marketprice` | `market_price_points.price_eur_mwh` |
| `unit` | `market_price_points.currency` / metadata |

Limitations:

- Good for quick JSON testing.
- Not true continuous intraday OHLC.
- Documented fair use is 100 calls/day.
- Use only as fallback or temporary test source.

