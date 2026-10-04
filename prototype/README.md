# HarvestLink hackathon MVP

Portuguese-speaking tomato farmers around Bonfim, Roraima → English-speaking produce importers in Lethem, Guyana.

## Run

Requires Node 22+ (tested with Node 24). No build step. The offline application needs no npm dependencies.

```powershell
cd prototype
node scripts/train.mjs
npm start
```

Open http://127.0.0.1:4173. Open once online and wait for “Offline cache ready”. Reload once before disconnecting. Assets, the classifier and UI are cached; lots, drafts, choices and handovers live in localStorage. Download the evidence bundle for backup. Clearing site data removes records. This hackathon build is a single-device prototype, not a production multi-user system.

## Actual local AI

HarvestIntent-PT v1 is an 8,621-byte multinomial naive Bayes intent classifier trained on the authored Portuguese corpus in `scripts/train.mjs`. It runs in local JavaScript; no inference API, weights download or generative model is needed after caching. Structured entity extraction and missing-field prompts are deterministic. Confidence below 0.65 abstains. Fixed confirmation phrases, field validation and farmer confirmation gate lot creation. This is a compact learned AI model, **not an on-device LLM**. The small training corpus needs broader field testing.

## Demonstration workflow

1. Send `Sou Ana, tenho 120 kg de tomate, classe A`.
2. Reply `2026-10-04`, then `R$ 3,50/kg` to missing-field prompts.
3. Review the record and press Confirmar lote.
4. Send `Sou Paulo, tenho 100 kg de tomate, classe A, colheita 2026-10-04, R$ 3,50/kg`; confirm.
5. Buyer & pooling: the 200 kg DEMO order uses Ana’s 120 kg and Paulo’s 80 kg, leaving 20 kg unallocated. Crop, grade and harvest window must match.
6. Comparar ganhos: 200 kg local gross 700 BRL less 50 BRL transport = 650 BRL net. Proposed sale bills 190 kg after 5% loss × 250 GYD = 47,500 GYD ÷ 40 = 1,187.50 BRL. Costs: transport 130, packaging 60, handling 40, fee 23.75, trade allowance 50 = 303.75 BRL. Net = 883.75 BRL. Allocated by kg: Ana 530.25 and Paulo 353.50 BRL. All values are illustrative, not live prices or trade advice.
7. Choose a farmer, review costs, tick confirmation, save choice offline. Snapshot preserves dated rates and costs.
8. Exporter handover includes only proposal-consenting farmers and marks incomplete consent explicitly. It never authorizes dispatch. Status: **awaiting buyer confirmation and trade-requirement checks**.

## Real SMS or WhatsApp connection

1. Run `npm install` to install the optional official Twilio SDK.
2. Copy `.env.example` to `.env`, configure account SID/token, sender, operator key and a consenting recipient allowlist. Keep tokens server-side; `.env` and provider data are ignored by Git. For WhatsApp use `whatsapp:+…` sender/recipient and join the provider sandbox from your test handset.
3. Provide a public HTTPS endpoint for this server and set `PUBLIC_WEBHOOK_URL` to the **exact** incoming URL, including `/webhooks/twilio`. Configure that URL in the provider console for incoming messages. Use an HTTPS deployment or a trusted local tunnel. Set HOST appropriately only when hosting; API endpoints require the operator key.
4. Restart with `npm start`. In Evidence enter the operator key, click Load provider messages. Send a message to the allowlisted test handset, then reply in Portuguese. The signed inbound webhook responds with a Portuguese missing-field prompt. Reply with fields and `CONFIRMO`. Load messages to import the farmer-confirmed lot.
5. Save the inbound MessageSid, outbound SID, timestamps and actual handset reply footage. Server records are in `data/messages.json` (private). Provider acceptance alone is not delivery proof. Webhook tests use synthetic credentials and are not real messages.

No live connection is available until credentials, public hosting and a real test participant exist. Airplane-mode AI needs no provider connection; SMS/WhatsApp transmission needs connectivity. Offline sync is explicit. API key must never be embedded in public source.

Webhook validation uses the official SDK: [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security). Offline installation needs HTTPS or localhost: [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

## Android proof — mandatory remaining evidence

Use a physical budget Android handset; record model, Android version, RAM and browser version. Deploy over HTTPS and install/open while connected. For USB development with Android debugging available, use `adb reverse tcp:4173 tcp:4173` and open `http://localhost:4173` on the handset. This localhost route satisfies service-worker secure-context requirements.

1. Wait for offline cache and reload. Switch **airplane mode on and Wi-Fi/mobile data off**, showing the quick settings on video.
2. Submit Portuguese messages, confirm a lot and save a choice.
3. Fully close the browser/PWA, reopen while disconnected, show restored lot and choice.
4. In Evidence enter the phone model/version, mark physical-device/airplane attestations and run the 100-inference benchmark. Export evidence. Attestations are self-reported, not automatic network verification.
5. Report actual model bytes, p50/p95/max response time and test conditions. Do not present desktop figures as handset measurements. Browser timing covers classification, extraction and reply generation, excluding rendering.
6. Restore connectivity and film the actual messaging exchange separately.

## Templates and review

Controlled bilingual templates are in `public/core.js` (`questions`, `lotSummary`, confirmation replies). Code checks template fields, but independent Portuguese/English human sign-off has **not** happened. Complete `TEMPLATE-REVIEW.md` before claiming reviewed bilingual templates.

## Verification and video

`npm test` covers intake/confirmation, date/quantity validation, compatibility, FX/cost mathematics and unknown/cancel handling. `scripts/browser-proof.cjs` uses Playwright to verify the UI offline, restart persistence and a mobile-width layout. Set `PLAYWRIGHT_PATH` to your installed Playwright package if outside the bundled Codex runtime. Set `PROOF_HOLD_MS=8500` to record a ~2–3 minute desktop walkthrough. Artifacts are in `artifacts/`; desktop footage explicitly labels missing physical Android and live messaging proof. It is an honest prototype demo, **not the complete submission evidence**.

## Prototype limits

Single demonstration order; no real buyer commitments or trade clearances. No live exchange rates. Cost inputs omit any unmodelled actual costs. Farmer identity is user entered, not authenticated. Local records are not encrypted. Operator sync is for a trusted demo only; there is no role-based production access, reservation reconciliation across devices, or automatic conflict resolution. Human farmer consent is never buyer confirmation. Broader intent accuracy, local terminology and safety against ambiguous quantities require field evaluation.

## Interface language
Use the header's Idioma / Language selector to switch between English and Portuguese. This preference is saved offline. Farmer intake messages remain Portuguese; original messages and raw JSON evidence are preserved.


## Messaging-first interaction
Farmers can send COMPARAR GANHOS, ESCOLHO LOCAL or ESCOLHO PROPOSTA after confirming a matched lot. The assistant returns dated FX/costs and their allocated net amounts in the same conversation. A second CONFIRMO records the choice. The web preview and Twilio webhook share this dialogue engine. The browser WhatsApp/SMS control only changes the preview; it does not send messages. The buyer/cost/handover screens are coordinator tools.

