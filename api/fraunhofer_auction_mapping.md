# Fraunhofer Auction Data Mapping

## Verified Contract

The seven-day audit covers 2026-08-24 through 2026-08-30 for bidding zone
`DE-LU`.

The official Energy-Charts endpoint `/v2/price` exposes one stable series:

| API series ID | Meaning |
| --- | --- |
| `day_ahead_price` | Day-ahead spot-market clearing price |

It does not expose IDA1, IDA2, or IDA3 as separate series.

The public 15-minute weekly chart JSON contains the four client-requested
auction curves:

| Internal code | Exact chart series name |
| --- | --- |
| `day_ahead` | `Day Ahead Auction (DE-LU)` |
| `ida1` | `Pan-European Intraday auction, 15 minutes IDA1 price (DE-LU)` |
| `ida2` | `Pan-European Intraday auction, 15 minutes IDA2 price (DE-LU)` |
| `ida3` | `Pan-European Intraday auction, 15 minutes IDA3 price (DE-LU)` |

## Timestamp Rules

- Weekly chart timestamps are Unix epoch milliseconds and therefore identify
  absolute instants.
- PostgreSQL stores them as `timestamptz`.
- Grafana renders them in `Europe/Berlin`.
- No fixed UTC offset is used. PostgreSQL/Grafana timezone data handle CET,
  CEST, and daylight-saving transitions.
- Each timestamp marks the start of a 15-minute delivery interval.

## Price Rules

- Each auction has one signed clearing price in EUR/MWh for each published
  delivery interval.
- Negative prices are valid and must not be filtered or clamped to zero.
- Auction panels use step-after interpolation and no area fill.
- Missing source values remain missing; the collector does not interpolate or
  manufacture prices.

## Operational Caveat

The `/v2/price` endpoint is documented by Fraunhofer. The weekly chart JSON is
the data contract currently used by the public Energy-Charts visualization, but
it is not documented as a stable public API endpoint. Raw payload archiving,
strict field validation, freshness monitoring, and client confirmation of
commercial/display rights remain required before production use.

## Reproduce The Audit

```powershell
node scripts\analyze_fraunhofer_auction_data.js 2026-08-24 2026-08-30 2026 35
```

Generated files are stored in `api/samples/` as full JSON and normalized CSV.
