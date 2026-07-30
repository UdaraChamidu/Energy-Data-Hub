# API Research And Germany-First Selection

This folder documents the APIs selected for the first implementation phase:

- n8n collects data.
- n8n writes data into PostgreSQL.
- Germany is the first market.
- Grafana/web UI work is deferred.

Client-named sources are implemented as follows:

- ENTSO-E: primary DE-LU official day-ahead price ingestion.
- SMARD: independent DE-LU wholesale-price fallback/cross-check.
- netzfrequenzmessung.de: live frequency source explicitly permitted by the detailed client requirements because SMARD has no suitable sub-5-second series.

Read first:

- [germany_api_selection.md](germany_api_selection.md)
- [germany_endpoint_reference.md](germany_endpoint_reference.md)
- [api_limitations_and_decisions.md](api_limitations_and_decisions.md)
- [entsoe_token_setup.md](entsoe_token_setup.md)
- [../docs/client_requirements_traceability.md](../docs/client_requirements_traceability.md)
