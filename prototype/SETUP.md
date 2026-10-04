# HarvestLink setup — this repository

HarvestLink is a messaging-first harvest assistant. Bonfim tomatoes → Lethem is an optional, fictional trade example, not the product boundary. General intake supports tomato, cassava, maize, rice, beans, banana and papaya in Portuguese; unfamiliar crops need a coordinator and are not silently mapped to tomatoes.

## Start on your computer

Use Node 22+:

```sh
cd prototype
npm ci
npm test
npm start
```

Open http://127.0.0.1:4173. For phone use, the static `public` directory needs a public HTTPS host. The included GitHub Pages workflow publishes that directory after repository Settings → Pages → Source is set to GitHub Actions. Localhost on a phone means the phone itself, not your computer.

## Farmer journey

1. Online: join the WhatsApp test sender from your own phone, then send `AJUDA`.
2. Describe the harvest: `Sou Ana, tenho 120 kg de mandioca, em Boa Vista, classe A`.
3. The assistant asks for missing details. Send `2026-10-05, BRL 4/kg` (use your actual harvest date).
4. Read the complete record. Correct any field by resending it. Reply `CONFIRMO` to save. `CANCELAR` abandons a draft.
5. A buyer summary uses controlled English wording. General mode has no invented buyer order.
6. For the Bonfim demo only, compatible lots can pool toward the demonstration order. `COMPARAR GANHOS` shows dated costs and estimated net receipts. `ESCOLHO LOCAL` or `ESCOLHO PROPOSTA` creates a review; a second `CONFIRMO` saves the choice.
7. Without connectivity, open the already cached phone companion. Its compact model, field extraction, dialogue and storage run on the device. WhatsApp/SMS replies themselves need a network. Local and provider records remain separate until explicit export/sync; there is no automatic phone-number identity merge.

## Deploy the WhatsApp webhook without putting tokens on the phone

1. Sign in to Twilio and complete verification yourself. Open Messaging → Try it out → Send a WhatsApp message. Use the exact test sender and `join ...` code shown there. Join from the phone and wait for confirmation.
2. Create a Sync service named `harvestlink-test`. Keep its SID for server configuration.
3. Run `npm run build:twilio`. This generates `twilio/harvestlink-reply.protected.js` from the actual local model and shared dialogue engine.
4. In Functions and Assets, create a test Service and add `/harvestlink-reply`. Set visibility **Protected**. Paste the complete generated file. Keep the Twilio SDK dependency.
5. Under environment variables, set `SYNC_SERVICE_SID` to your Sync service SID and `HARVESTLINK_PROFILE` to `general`. The optional `bonfim` profile enables only the fictional demonstration order. The Function uses the account client supplied by Twilio; it never puts credentials in public source or the phone app.
6. Save and Deploy All. Paste the deployed HTTPS Function URL in the Sandbox's **When a message comes in** field; method POST. Save.
7. From your joined phone send `AJUDA`, the harvest details, and `CONFIRMO`. Check both the real reply on the phone and Twilio message logs. Keep timestamps and Message SIDs as evidence. A deployment or a mock test alone does not establish a real exchange.

The generated Function persists drafts, confirmed lots and choices in a Sync Document, uses conditional revision updates, and remembers the 12 most recent Message SIDs to suppress immediate retries. It is a bounded hackathon store: one document, capped at 14,500 UTF-8 bytes below Sync's 16 KiB limit. It reports failure before acknowledging a save if storage is full/unavailable. Export records from Console before scaling or resetting. A production service needs a proper database, retention policy, farmer identity, full idempotency and buyer/order management.

Twilio Sandbox is a test environment; joining expires after three days, and account/country/billing restrictions apply. This setup does not purchase an SMS number or upgrade the account. If you already have an SMS-capable sender, configure its incoming-message webhook to the same Protected Function. Phone companion → Connect WhatsApp / SMS saves the sender and opens your messaging app; you send the message yourself.

## Alternative Node server and coordinator sync

Copy `.env.example` to `.env` locally. Configure your account credentials, sender, exact public HTTPS webhook URL, operator key and consenting test recipients. Keep `.env` out of Git. The server validates Twilio signatures and stores records in `data/messages.json`. Route `/webhooks/twilio` must be reachable over HTTPS. The operator API and explicit phone sync require this Node server; GitHub Pages alone cannot run them, and the separate Twilio Function's Sync records do not appear automatically in the Node store.

## Install and prove offline behavior

Open the HTTPS phone companion online, wait for the offline-cache message, reload, then install (Android Chrome: Install app; iPhone Safari: Share → Add to Home Screen). Open the installed app online once because its storage may differ from the browser. Create and confirm a lot. Turn on airplane mode and explicitly disable Wi-Fi/mobile data. Close and reopen from the Home Screen. Verify the saved record and submit another Portuguese harvest. Export a backup: clearing website data removes localStorage records.

In Operations & evidence, enter the physical device model/OS and run 100 inferences. The model file is 8,621 bytes, a learned naive Bayes intent classifier with deterministic extraction/templates; it is not a generative LLM and model bytes do not measure RAM. Record p50/p95/max and physical offline steps on video. Device/network attestations are self-reported. Desktop tests and iPhone measurements do not prove budget Android performance.

## Truthful evidence status

The supplied Downloads/SETUP.md describes a different build (IndexedDB, six intents and a 125,597-byte model). This repository uses localStorage and the 8,621-byte model. Do not combine those claims. The existing desktop video predates the broader crop/context redesign. Real provider round trip, physical Android benchmark and bilingual template reviewer sign-off must be recorded separately before submission.

All trade prices, FX, costs and orders are demonstration assumptions. Cross-border shipment remains **awaiting buyer confirmation and trade-requirement checks**. No dispatch is authorized.

Official references: [WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/sandbox), [Protected Functions](https://www.twilio.com/docs/serverless/functions-assets/visibility), [Sync Documents](https://www.twilio.com/docs/sync/api/document-resource). Twilio's [Docs MCP](https://www.twilio.com/docs/ai/mcp) searches documentation; it does not provision an account. The [developer skills](https://www.twilio.com/docs/ai/skills) are optional developer tooling, not the farmer's runtime or offline AI.
