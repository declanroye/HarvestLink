# Submission evidence — honest status

## Delivered

- Runnable Portuguese farmer / English buyer offline PWA and Node server.
- Learned local intent classifier: 8,621 bytes (JSON file, uncompressed). Not a generative LLM.
- Missing-field dialogue, explicit lot confirmation, compatible pooling, dated BRL/GYD cost comparison, offline choice snapshots and consent-filtered exporter handover.
- Official Twilio SMS/WhatsApp adapter with signed webhook validation, idempotency, server-side credentials and consenting-recipient allowlist.
- Six passing unit/integration tests, including synthetic signed provider webhook tests.
- Desktop browser end-to-end tests with network disabled, zero inference API requests, fresh-process persistent storage restart, 390px viewport and no browser JavaScript errors.
- Captioned 2–5-minute desktop demonstration video: `artifacts/harvestlink-demo.webm`.

## Not yet established — required before claiming the complete brief

1. **Physical budget Android proof.** A real phone has not been available in this session. Model/OS/RAM and handset p50/p95/max latency remain unmeasured. Record airplane mode with Wi-Fi/data off and reopening the app. Desktop offline tests are not substitutes.
2. **Real messaging exchange.** No live credentials, configured sender, public webhook or consenting handset have been supplied. The adapter passed signed synthetic webhook tests; no live message SID or delivered handset exchange is claimed.
3. **Bilingual human review.** Controlled templates have code-level field checks and assistant wording review, but independent Portuguese/English reviewer sign-off remains pending in `TEMPLATE-REVIEW.md`.

## Evidence files

- `browser-evidence.json`: actual desktop UI state, confirmed lots, choice/cost snapshots, model metrics and browser errors/network request results.
- `restart-evidence.json`: new browser process, persistent profile, offline launch and records restored.
- `exporter-handover-demo.json`: a sample handover, never dispatch-authorized.
- `buyer-pooling.png`, `mobile-offline-restart.png`: screenshots from real prototype tests.

Desktop response figures must be labelled desktop only. `performance.now()` is quantized by browser privacy settings: a reported 0 ms means below timer resolution, not zero processing time. Model file size excludes JavaScript runtime and application assets.

Every price, order, cost and FX assumption is DEMONSTRATION DATA. Shipment status: **awaiting buyer confirmation and trade-requirement checks**. No export authorization, genuine buyer commitment or actual profitability is claimed.

## Phone and provider filming sequence (~3 minutes)

0:00–0:20 Scope and demo-data label.

0:20–1:05 Show phone model, airplane mode/Wi-Fi/data off; Portuguese input → missing-field prompts → human-confirmed lot.

1:05–1:35 English buyer summary and 200 kg pooled proposal.

1:35–2:05 Dated FX and each cost deduction, farmer choice and confirmation.

2:05–2:30 Close/reopen while offline; display restored choice and handset benchmark/model bytes.

2:30–3:00 Restore connectivity; show actual SMS/WhatsApp inbound/reply exchange and verified provider record.

3:00–3:20 Exporter handover and pending shipment/trade checks.
