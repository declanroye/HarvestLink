# One verified account across WhatsApp and the offline companion

This build implements phone verification and shared records. It does **not** claim that the new Functions are already deployed. Browser automation timed out during this update, so the previously deployed WhatsApp handler remains the last live version verified. The public Pages companion is a static frontend, never the backend.

## Recommended hackathon deployment: Twilio Functions + Sync

Use the existing `harvestlink-test` Function service and existing Sync service. Keep both Functions on the **same Sync service and document**. The build migrates existing channel profiles in `harvestlink-demo-v1` into the account index. Export existing records before updating a live service.

1. From `prototype`, run `npm run build:twilio`.
2. Replace the existing `/harvestlink-reply` Function code with `twilio/harvestlink-reply.protected.js`. Visibility must remain **Protected**. This makes Twilio validate incoming provider signatures before the handler receives a phone identity.
3. Add `/harvestlink-companion`, using `twilio/harvestlink-companion.public.js`, with visibility **Public**. Public means the browser can reach the endpoint; account records still require a verified per-device credential. Never expose the operator key or Twilio credentials to the browser.
4. Keep `SYNC_SERVICE_SID=IS1ff3cd828f191e251e43fe48e0c342e0`. Add `COMPANION_ORIGINS=https://declanroye.github.io,http://127.0.0.1:4173`. Keep `HARVESTLINK_PROFILE=general`. Enable the existing Twilio credentials integration. Use a runtime that supports `structuredClone` (Node 18+). Save and deploy both Functions.
5. Keep Sandbox inbound POST set to `https://harvestlink-test-9531.twil.io/harvestlink-reply`.
6. In the updated companion's **Connect WhatsApp / SMS** panel, select **Twilio** and save `https://harvestlink-test-9531.twil.io/harvestlink-companion` as the service address. This address will work only after step 4 is deployed.

The Sync implementation has a bounded **14,500-byte** safety cap beneath the document limit. It rejects a full store before acknowledging a save. This is a hackathon store for a few accounts, not a production database. Move to a transactional database before field rollout. Node and Twilio are alternative deployments; do not use the Node store for the companion while using Sync for WhatsApp.

## Linking and everyday use

1. On your phone, open `https://wa.me/14155238886?text=join%20where-necessary` and send **join where-necessary**. Wait for the Twilio Sandbox welcome. If rejected, check the current join code in Twilio Console; trial joining may expire.
2. Send **INICIAR**, then answer consent, name, community, language and **CONFIRMO**.
3. In the companion, tap **Create pairing code**. The code expires after ten minutes. Send the displayed **VINCULAR CODE** from the onboarded WhatsApp number.
4. Review the account and device name in WhatsApp. Reply **CONFIRMO**. Then tap **Check link** in the companion and explicitly activate that account.
5. A backup is exported before activation. Available local lots are copied only if you separately confirm ownership; records are never merged by name. Previous local lots remain stored. Local choices need coordinator review rather than automatic migration.
6. Use **Fetch my WhatsApp records** or **Submit my records**. Submission requires a checkbox. This acknowledges receipt by the service, never buyer acceptance or shipment authorization.
7. **DESVINCULAR**, followed by **CONFIRMO** in WhatsApp, revokes every linked device. The companion can also revoke its own access. Downloaded local records remain on the device.

Device tokens have 256 bits of randomness, are stored hashed on the server and scoped to one farmer. The browser stores its token locally to retain access after restart. Treat the phone as an account credential: protect it with a screen lock. Exports omit device/claim tokens. Codes are single-use, and the possession proof comes from the signature-verified provider sender plus explicit confirmation. Initial linking is unavailable offline.

## Offline and conflicts

Install the companion over HTTPS while connected. The service worker caches the classifier, weights, vocabulary, metadata and UI. After linking, your profile and fetched records survive restart in local browser storage. Local classification needs no inference network request.

An offline edit remains local until explicit upload. Each upload has a stable operation ID and account revision. Retrying an accepted operation does not duplicate records. A changed WhatsApp revision returns **409**, before any record is changed. Review the shared version; export a backup before replacing local changes. The current conflict flow supports explicit replacement, not automatic field-by-field merging. Clearing site data removes records and device credentials; exported backups preserve records but cannot bypass phone verification.

## Alternative: one Node server

Run `npm ci --ignore-scripts`, then `npm start` from `prototype`. Same-origin companion requests use `/companion/`. The signed WhatsApp webhook is `/webhooks/twilio`; **it must point to this same Node server** for one shared account. Use the variables in `.env.example`, a public HTTPS deployment and durable `DATA_DIR`. Add `COMPANION_ORIGINS=https://declanroye.github.io` for the Pages frontend. Do not paste Twilio credentials into the frontend. The Node store uses atomic file replacement and serialized transactions, supports one process, and needs a transactional database for multiple workers. Existing operator endpoints remain coordinator-only.

## What is verified here

Automated tests cover signed webhook verification, code expiry, second confirmation, one-time claims, identical names belonging to different accounts, device revocation, per-farmer record isolation, shared reads/writes, retry idempotency, stale-revision rejection, invalid-batch rejection, and persistent server restart. Paired generated Function tests exercise the same store with simulated Sync responses. These are synthetic tests, **not a real WhatsApp exchange or a deployed-provider test**.

Real exchange evidence requires a participant's inbound message and received HarvestLink reply, matching actual Twilio Message SIDs and timestamps. Keep personal phone numbers redacted in public evidence. Provider acceptance alone is not delivery proof.
