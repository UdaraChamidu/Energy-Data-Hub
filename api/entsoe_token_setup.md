# ENTSO-E Web API Token Setup

ENTSO-E Transparency Platform data and normal REST API access are free, but the API requires a registered account and an enabled security token.

## Request Access

1. Register an account at `https://transparency.entsoe.eu/`.
2. Verify the registered email address and sign in.
3. Email `transparency@entsoe.eu`.
4. Use the subject:

   ```text
   Restful API access
   ```

5. In the message body, include the exact email address used for registration and ask ENTSO-E to enable RESTful Web API access.
6. Wait for ENTSO-E to approve the request.
7. Sign in again and open the account/profile settings.
8. Find **Web API Security Token** and select **Generate** or **Generate and overwrite**.
9. Store the token immediately. ENTSO-E's current token-management guide says the generated token is not visible again after the dialog closes.

If the token is lost, generate a replacement. Replacing the token invalidates the previous value.

## Configure n8n

Set the token in the environment of the running n8n service:

```text
ENTSOE_SECURITY_TOKEN=replace_with_the_real_token
```

Restart or redeploy n8n after changing its environment. The imported workflow reads:

```text
{{$env.ENTSOE_SECURITY_TOKEN}}
```

Do not store or commit the real token in workflow JSON, SQL files, screenshots, or project documentation.

## Verify

Manually execute `market_prices_entsoe_de_lu` and inspect **Fetch ENTSO-E Prices**. A successful price response should contain a `Publication_MarketDocument` with at least one `TimeSeries`.

Then verify PostgreSQL:

```sql
select
  p.product,
  count(*) as row_count,
  min(p.delivery_start) as earliest_delivery,
  max(p.delivery_end) as latest_delivery,
  max(p.ingested_at) as last_ingested_at
from energy_data.market_price_points p
join energy_data.data_sources s on s.id = p.source_id
where s.code = 'entsoe'
group by p.product
order by p.product;
```

Official references:

- ENTSO-E API Token Management:
  `https://transparency.entsoe.eu/content/static_content/download?path=%2FStatic+content%2FAPI-Token-Management.pdf`
- ENTSO-E Transparency Platform:
  `https://transparency.entsoe.eu/`
