# Energy Data Hub

Germany-first energy-data ingestion for the client's Grafana rebuild.

```text
netzfrequenzmessung.de -> n8n -> PostgreSQL
ENTSO-E A44            -> n8n -> PostgreSQL
SMARD filter 4169      -> n8n -> PostgreSQL
                                  |
                                  +-> Grafana
```

The system stores live grid frequency, calculated grid-time deviation, official DE-LU day-ahead price intervals, derived 15/60-minute aggregates, and ingestion-health records. The Grafana dashboard is supplied as generated, importable JSON.

Start here:

1. Read `docs/client_requirements_traceability.md` for the exact requirement-to-implementation mapping.
2. Apply the SQL files listed in `database/README.md`.
3. Configure the values in `.env.example` in the n8n runtime and create the PostgreSQL n8n credential.
4. Import and test workflows in the order listed in `workflows/README.md`.
5. Generate, validate, and import the dashboard using `grafana/README.md`.

Important limitation: the free client-named sources provide day-ahead interval prices, not continuous EPEX intraday trades. True intraday Current/High/Low/Last requires a licensed EPEX/EEX or another approved trade feed.
