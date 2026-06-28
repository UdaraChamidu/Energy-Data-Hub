# API Limitations And Decisions

## Germany-First Scope

The first build is Germany only. Use the DE-LU bidding zone for market-price collection.

```text
Germany / Luxembourg bidding zone EIC: 10Y1001A1001A82H
```

The existing database schema already supports more countries later.

## Final API Choices For Now

Use now:

- `netzfrequenzmessung.de` for actual grid frequency.
- ENTSO-E Transparency Platform for Germany day-ahead / official price series.

Keep as fallback:

- aWATTar for simple JSON day-ahead spot price ingestion tests.

Keep as later upgrade:

- EPEX SPOT / EEX Group market data service for true continuous intraday High/Low/Last.
- SMARD for future official German generation/load/market-data expansions.

## Known Gaps

### 1. Target Frequency

The selected frequency API returns actual frequency only. Store target as configuration:

```text
target_hz = 50.000
```

Swissgrid explains that the European grid normally uses 50 Hz, and that correction values of 49.990 Hz or 50.010 Hz may be used when grid time deviation exceeds thresholds. The first build should store `50.000` unless a source for the current correction setpoint is added later.

### 2. Grid Time Deviation

The client asks for grid time and deviation every second. I did not find a clean official public API endpoint for that.

For the first build, the practical path is:

1. Store actual frequency from `netzfrequenzmessung.de`.
2. Calculate approximate grid time deviation from frequency samples.
3. Keep this calculation clearly marked as calculated.
4. Replace with official source later if one becomes available.

### 3. Intraday Current Running Price

ENTSO-E is not a real-time continuous EPEX trade feed. It is excellent for official transparency and day-ahead price data, but "current running intraday price" likely requires EPEX/EEX market-data licensing.

First build should not pretend ENTSO-E is live continuous intraday trade data. Store ENTSO-E prices with product names such as:

```text
day_ahead
quarter_hour_day_ahead
hour_day_ahead
```

Only use:

```text
intraday_continuous
```

after EPEX/EEX or another approved intraday trade feed is connected.

### 4. 15-Minute And 60-Minute High/Low/Last

If the source gives one price per delivery interval, then high/low/last will be equal for that interval unless multiple observations/trades exist.

For the first build:

- Store raw price points.
- Build OHLC only when multiple records exist for the same interval.
- Otherwise mark OHLC as derived from single official interval price.

This keeps the database honest and avoids fake market volatility.

## Impact On n8n Workflows

Recommended initial workflows:

1. `grid_frequency_netzfrequenzmessung_de`
   - Poll XML.
   - Parse `f` and `z`.
   - Insert/upsert `grid_frequency_measurements`.

2. `grid_time_deviation_calculated`
   - Read recent frequency samples from PostgreSQL.
   - Calculate approximate deviation.
   - Insert/upsert `grid_time_deviation_measurements`.

3. `market_prices_entsoe_de_lu`
   - Poll ENTSO-E A44 price document.
   - Parse XML.
   - Insert/upsert `market_price_points`.

4. `market_price_ohlc_builder`
   - Build 15-minute and 60-minute records from stored points where possible.
   - Insert/upsert `market_price_ohlc`.

5. `ingestion_health_monitor`
   - Detect stale frequency and price data.
   - Write `ingestion_alerts`.

## Environment Variables Needed

```text
GRID_FREQUENCY_PROVIDER=netzfrequenzmessung
GRID_FREQUENCY_URL=https://dat.netzfrequenzmessung.de:9080/frequenz.xml
GRID_FREQUENCY_TARGET_HZ=50.000
GRID_FREQUENCY_POLL_SECONDS=3

GRID_TIME_DEVIATION_MODE=calculated_from_frequency
GRID_TIME_DEVIATION_BASE_HZ=50.000

ENTSOE_API_BASE_URL=https://web-api.tp.entsoe.eu/api
ENTSOE_SECURITY_TOKEN=replace_me
ENTSOE_DE_LU_DOMAIN=10Y1001A1001A82H
ENTSOE_PRICE_DOCUMENT_TYPE=A44
ENTSOE_PRICE_POLL_MINUTES=15

POSTGRES_HOST=replace_me
POSTGRES_PORT=5432
POSTGRES_DB=replace_me
POSTGRES_USER=replace_me
POSTGRES_PASSWORD=replace_me
POSTGRES_SSL_MODE=require_or_disable
```

