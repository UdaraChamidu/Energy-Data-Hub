# Development Roadmap

This roadmap starts after the client approves the analysis and open decisions.

## Phase 0: Client Approval And Access Collection

Goals:

- Confirm data providers.
- Confirm countries/bidding zones.
- Confirm exact meaning of intraday, 15-minute, and 60-minute price panels.
- Collect credentials and infrastructure details.
- Confirm retention and alerting policy.

Deliverables:

- Approved requirements.
- Approved database schema.
- Approved n8n workflow list.
- Client-provided API examples or credentials.

Exit criteria:

- No blocking clarification remains for Phase 1.

## Phase 1: Database Foundation

Goals:

- Create PostgreSQL schema.
- Create source, market, measurement, raw payload, and ingestion health tables.
- Create indexes and Grafana-oriented views.

Deliverables:

- SQL migration files in `database/`.
- Basic seed data for approved sources and markets.
- Database validation notes.

Exit criteria:

- Tables exist.
- Unique keys prevent duplicate records.
- Grafana can connect to PostgreSQL.

## Phase 2: Grid Data Collection

Goals:

- Build live grid frequency collection.
- Build live grid time deviation collection.
- Store data in PostgreSQL.
- Validate Grafana can query the data.

Deliverables:

- n8n workflow JSON files in `workflows/`.
- Environment/config documentation.
- Test run evidence.

Exit criteria:

- Frequency and time deviation data are inserted continuously.
- No duplicate records during retry tests.
- Stale-data alert works.

## Phase 3: Market Price Collection

Goals:

- Build approved EPEX/market price collector.
- Store intraday/current price points.
- Support selected countries/bidding zones.

Deliverables:

- Market price n8n workflow.
- PostgreSQL upsert logic.
- Sample stored records.

Exit criteria:

- Price data is inserted for approved markets.
- Records include delivery intervals and price in EUR/MWh.
- Grafana can query current price data.

## Phase 4: 15-Minute And 60-Minute Aggregations

Goals:

- Build or store high, low, and last values for 15-minute intervals.
- Build or store high, low, and last values for 60-minute intervals.
- Provide values for single stat panels.

Deliverables:

- Aggregation workflow or SQL view/materialized view.
- Grafana query examples.
- Validation against source data.

Exit criteria:

- 15-minute high/low/last values are correct.
- 60-minute high/low/last values are correct.
- Single stat panel values match the dashboard requirement.

## Phase 5: Grafana Dashboard Wiring

Goals:

- Connect Grafana panels to PostgreSQL views/tables.
- Recreate required panels:
  - Netzfrequenz.
  - Netzzeitabweichung.
  - EPEX Spot intraday.
  - EPEX Spot 15-minute.
  - EPEX Spot 60-minute.
  - 15min Low/High and 60min Low/High stat panels.

Deliverables:

- Dashboard JSON export if access is provided.
- Query documentation in `docs/`.
- Screenshot or review notes.

Exit criteria:

- Grafana displays live PostgreSQL-backed data.
- Dashboard timezone is CET/CEST.
- Client confirms panel layout and values.

## Phase 6: Reliability, Monitoring, And Retention

Goals:

- Add health checks.
- Add alert notifications.
- Add retention or downsampling if approved.
- Add backup/restore notes.

Deliverables:

- n8n health monitor workflow.
- Alerting documentation.
- Retention policy implementation.
- Operations runbook.

Exit criteria:

- Workflow failures are visible.
- Stale data is detected.
- Retention policy is implemented or explicitly deferred.

## Phase 7: Deployment And Handover

Goals:

- Deploy approved workflows and schema.
- Document environment variables and credentials.
- Train client/operator on common checks.

Deliverables:

- Deployment checklist.
- Final architecture document.
- Runbook.
- Backup and recovery notes.

Exit criteria:

- Client confirms live dashboard.
- Client has all operational documentation.
- Implementation is ready for production monitoring.

## Future Expansion Phase

Candidate additions:

- Net power generation mix.
- Cross-border flows.
- Wind/solar/load forecasts.
- Balancing energy activations.
- Historical analytics and forecasting.

These should be treated as separate scoped enhancements after the first dashboard is stable.

