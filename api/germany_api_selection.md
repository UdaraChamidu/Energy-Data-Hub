# Germany API Selection

## Decision Summary

For the Germany-first version, use this API strategy:

| Data requirement | Selected API for first build | Why |
| --- | --- | --- |
| Actual grid frequency | `netzfrequenzmessung.de` XML API | Public live XML endpoint, current value every 3 seconds, provider asks callers not to request more than once per second. |
| Target grid frequency | Store as configured value `50.000 Hz` | Target is normally 50 Hz for the Continental Europe synchronous area. No separate target value is returned by the selected frequency endpoint. |
| Grid time deviation | Calculate internally from frequency unless a better official endpoint is provided later | I did not find a clean public official API for live grid time deviation. Swissgrid explains the concept but does not expose a simple documented API on the inspected pages. |
| Germany day-ahead / market prices | ENTSO-E Transparency Platform Web API | Official European transparency source, suited for day-ahead price time series, requires security token. |
| Germany 15-minute prices | ENTSO-E first, if the returned German day-ahead series uses 15-minute resolution; otherwise use EPEX/EEX licensed market data | EPEX public pages show 15-minute market result structure, but reliable programmatic access for full market data points to market-data products/licensing. |
| Germany 60-minute prices | ENTSO-E day-ahead hourly/aggregated data or derived from 15-minute data | Fits current database design. |
| True continuous intraday High/Low/Last | EPEX SPOT / EEX market data service, if credentials/license are available | ENTSO-E is not a real-time continuous intraday trade feed. EPEX/EEX is the proper market source for this. |
| Fallback simple price feed | aWATTar marketdata API | Easy JSON endpoint for EPEX spot next-day prices, no token on the documented Austrian API, but it is not true continuous intraday OHLC. |

## Recommended First Build

Build the first PostgreSQL ingestion with two provider groups:

1. Grid frequency collector:
   - Provider: `netzfrequenzmessung.de`.
   - Endpoint: `https://dat.netzfrequenzmessung.de:9080/frequenz.xml`.
   - Polling: every 3 seconds recommended; never more than once per second.
   - Stored fields:
     - `measured_at`
     - `target_hz = 50.000`
     - `actual_hz`
     - `source_published_at`
     - `quality`

2. Market price collector:
   - Provider: ENTSO-E Transparency Platform.
   - Endpoint: `https://web-api.tp.entsoe.eu/api`.
   - Germany bidding zone: `10Y1001A1001A82H` for DE-LU.
   - Requires: ENTSO-E security token.
   - Stored fields:
     - `delivery_start`
     - `delivery_end`
     - `price_eur_mwh`
     - `currency`
     - `product`
     - `source_published_at`

## Why Not SMARD For The First Live Collectors?

SMARD is useful and official for German electricity market data downloads and future dashboard expansions. Its download page states that SMARD data can be downloaded, stored, and reused under CC BY 4.0.

However, for the immediate first build, the client needs:

- Live grid frequency every 1 to 5 seconds.
- Grid time deviation every second.
- EPEX price data.

From the inspected SMARD pages, SMARD is not the strongest fit for live sub-5-second grid frequency collection. Keep SMARD as a candidate for future German market, generation, load, and forecast data.

## Why Not aWATTar As Primary?

aWATTar is easy to use and provides a JSON marketdata endpoint. The documented API says:

- Server: `https://api.awattar.at`
- Resource: `v1/marketdata`
- Method: HTTP GET
- Format: JSON
- No token required since 2020
- Fair use: 100 calls/day

But aWATTar is a simplified price feed for next-day EPEX spot prices. It is not the best source for official full market transparency, and it does not satisfy true continuous intraday High/Low/Last.

Use aWATTar only as a fallback when:

- ENTSO-E token is not ready.
- We want a quick test ingestion into PostgreSQL.
- We only need next-day spot price series, not true intraday OHLC.

## Important Limitation

The original client request asks for "Intraday current running price" and "High/Low/Last" for 15-minute and 60-minute blocks. That sounds like continuous intraday trading data.

That is different from day-ahead auction prices.

Best practical interpretation for first build:

- Start with official ENTSO-E day-ahead prices for Germany.
- Store intervals cleanly so 15-minute and 60-minute views can be derived.
- Add EPEX/EEX licensed market-data feed later if the client confirms they need true continuous intraday trade OHLC.

This avoids blocking the project while still building the correct PostgreSQL/n8n foundation.

## Sources Checked

- netzfrequenzmessung.de frequency API announcement: https://www.netzfrequenzmessung.de/aktuelles.htm
- netzfrequenzmessung.de homepage: https://www.netzfrequenzmessung.de/
- Swissgrid frequency explanation: https://www.swissgrid.ch/en/home/operation/regulation/frequency.html
- Swissgrid current grid figures: https://www.swissgrid.ch/en/home/operation/grid-data/current-data.html
- ENTSO-E Transparency Platform: https://transparency.entsoe.eu/
- EPEX SPOT Market Results: https://www.epexspot.com/en/market-results
- SMARD market data download page: https://www.smard.de/home/downloadcenter/download-marktdaten
- aWATTar API documentation: https://www.awattar.at/services/api/

