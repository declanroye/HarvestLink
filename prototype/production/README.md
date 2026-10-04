# PostgreSQL, load-balanced API and document delivery

This is an executable deployment, separate from the existing Twilio Sync demo. It is not deployed to a public database host automatically, and it does not silently import or delete the live demo records.

## Start the stack

Install Docker using its official distribution. In `prototype/production`, create a private `.env` with a strong `POSTGRES_PASSWORD`. Keep it out of Git. Then run:

```sh
docker compose --env-file .env -f compose.yml up -d --build --wait
```

Open `http://localhost:8080`. Nginx balances connections across two Node API workers, which share PostgreSQL. The proxy binds only to the local host. A public deployment needs an HTTPS ingress, secret management, backups, monitoring and a verified public webhook URL. PostgreSQL is not exposed on a host port.

The companion's coordinator service setting should use `Node` and the HTTPS backend base URL ending in `/companion/`. Set `COMPANION_ORIGINS` to the exact companion origins. Configure the Twilio webhook to `/webhooks/twilio` only when ready to switch the real sender. Do not switch one channel before the data migration and pairing plan is reviewed.

## Storage and concurrency

- Account metadata is stored separately in `hl_accounts`; regular farmer transactions lock that account only.
- Lots, choices, handovers, documents and delivery requests are relational rows in `hl_records`, scoped to their account.
- Device credential hashes and account identity routes are in `hl_identity`.
- Pairing metadata has a separate lock; harvest writes do not take it.
- Matching queries use crop, grade and location indexes and a bounded 500-lot candidate set. Larger pools need cursor/batch matching and capacity tests.
- No 14,500-byte application ceiling is applied to PostgreSQL records. The current Twilio Functions still use that bounded demo store until the backend is switched.
- Explicit farmer confirmations, stale-revision checks and operation receipts continue to apply.
- Legacy operator `/api/` endpoints are disabled in PostgreSQL mode; verified farmers use the authenticated companion API.

## Chat-triggered documents

After confirming a harvest, send:

1. `prepare a harvest summary`, `prepare a packing list`, or `prepare a proforma invoice`.
2. Answer any missing packaging question, then `CONFIRM` to generate the draft.
3. `send document here` returns the content in the conversation. The companion can download a `.txt` draft.
4. `email document to you@example.com` previews the destination. `CONFIRM` creates a durable delivery request.

These are drafts for review. They are not tax invoices, signed contracts, official customs documents or evidence of a completed sale. Buyer and trade requirements remain unconfirmed.

## Email relay configuration

Set these only in the worker's private environment:

- `EMAIL_RELAY_URL`: an HTTPS endpoint you operate or trust.
- `EMAIL_RELAY_TOKEN`: bearer credential for that endpoint.
- `EMAIL_FROM`: a verified sender address.
- `EMAIL_RELAY_IDEMPOTENT=true`: only if the relay guarantees duplicate requests with the same idempotency key do not send twice.

The relay receives `POST` JSON `{from,to,subject,text,idempotencyKey}` and an `Idempotency-Key` header. It must return JSON `{id:"provider-acceptance-id"}` for accepted requests. It should return 4xx for permanent rejection, 429/5xx for temporary failures. No recipient data is logged by the worker. The worker stays idle without complete configuration.

PostgreSQL queue jobs use `FOR UPDATE SKIP LOCKED`, retry backoff, leases and a maximum of eight attempts. A stable idempotency key handles an interrupted worker. Status `accepted-by-provider` is not proof of inbox delivery. Delivery/bounce webhooks and provider-specific adapters remain deployment integrations.

## Evidence

`npm test` covers phone migrations, corrupt-state recovery, tab exclusion, retry policy, confirmation and document ownership. GitHub's `Verify production backend` workflow runs real PostgreSQL tests and a Docker/Nginx workload across both API workers. Its workload uses synthetic inbound events and sends no real provider messages. Inspect that run before quoting any capacity or latency numbers.

For an existing database:

```sh
DATABASE_URL=... node --test production/postgres.test.mjs
```

Never run the synthetic workload against a real sender's production database. Backups, point-in-time recovery, sustained load, failover, physical-phone testing and a formal data migration are still operational prerequisites for production launch.

## Vercel deployment

Import declanroye/HarvestLink with Root Directory prototype and preset Other. The checked-in vercel.json builds the offline companion and deploys signed WhatsApp and authenticated companion routes as Node Functions. Connect a PostgreSQL provider through Vercel Marketplace and set DATABASE_URL to its pooled connection string. Use a small DB_POOL_SIZE (for example 2) per function instance; the provider connection limit remains the scaling constraint.

Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, PUBLIC_WEBHOOK_URL (the production origin plus /webhooks/twilio) and COMPANION_ORIGINS privately in project environment variables. Do not switch the live Twilio webhook until health, account migration, pairing and signed-message tests pass. Existing browser storage is origin-specific; a new Vercel URL needs verified pairing and an explicit records migration.

Set CRON_SECRET and the EMAIL_RELAY_* / EMAIL_FROM settings for delivery. Vercel invokes /api/email-drain with the secret. Each invocation claims at most two durable jobs. The included Hobby-compatible daily schedule is for demonstration, not timely production delivery. Frequent delivery needs a supported higher-frequency scheduler or separate worker. Unconfigured delivery remains queued.

Vercel manages function routing and horizontal execution; the Nginx two-worker container test does not establish Vercel capacity. Validate actual deployed latency, concurrency, connection usage and provider quotas before promising scale. The API returns 503 until PostgreSQL is configured; it never uses local filesystem storage on Vercel.
