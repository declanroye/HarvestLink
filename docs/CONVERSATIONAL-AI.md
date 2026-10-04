# Conversational HarvestLink

HarvestLink now includes an online general-language-model adapter plus optional offline generative guidance. Configuration is required; absence of credentials does not silently pretend to be a language model.

## Online activation

In the hosting provider's server environment (not the browser, repository or phone), configure `OPENAI_API_KEY` and `HARVESTLINK_CHAT_MODEL` with a tool-capable model available to that account. Restart/redeploy after updating variables. The same variables are supported by the existing protected Twilio Function, so the demo can run before the PostgreSQL migration. In the PostgreSQL deployment, also configure `DATABASE_URL` and the Twilio signature variables described in the deployment guide.

The farmer's message, limited account context and up to four compact conversation-memory entries go to the OpenAI Responses API with `store:false`. This is not a promise of zero provider retention; review the provider account's data controls. No phone number, bearer credentials or other farmer's records are included by the context tool. Do not put secrets or sensitive documents into chat.

Incoming signed WhatsApp/SMS → shared-account transaction → model → allowlisted tools → verified receipt → durable save → reply. The model can read context, check earnings, prepare a harvest and prepare documents. It cannot invoke confirmation, email delivery, linking, identity changes or shipment authorization. Literal human confirmations bypass inference. Harvest tool arguments must match facts extracted from the current message; unclear dates and units require clarification. Read-only conversational replies are model-generated and can be wrong; critical values and action receipts come from deterministic tools.

Calls have a 6.5-second total inference budget, up to three provider rounds, one tool call per round, one draft action, bounded output and 20 conversational requests per minute per channel/device. Provider failures explicitly fall back to the small structured assistant. Duplicate messaging receipts avoid another model request after a committed save. Storage conflicts may replay a model request before commit; business actions remain idempotent, but API spend is not exactly once. The current implementation holds an account transaction during this bounded call; high-volume deployment should move inference to a durable queue with revision-checked commits. The Twilio demo remains limited to its existing small Sync document; persistent conversation memory is intentionally bounded.

## Offline conversation

Account → Offline assistant → Load offline conversation model. This opt-in action downloads Qwen2.5 0.5B Instruct q4f32 through the official WebLLM package. It needs WebGPU, substantial disk space and approximately 1.06 GB model VRAM per the library's model configuration, plus browser overhead. Compatibility and output quality on budget Android devices are not yet measured. Keep the tiny intent model and harvest form available as the default, including on unsupported devices.

The runtime executes in a Web Worker. Runtime files and model assets use separate persistent browser caches. After restart, select Load again to initialize from cache; browser eviction or incomplete downloads can require reconnection. Weight downloads contact the model publisher/CDN; inference runs locally. Download failures preserve existing records. Offline answers use only local owner records, are displayed as guidance and cannot write records, send messages or authorize shipments. The normal offline forms and existing confirmation workflow still handle core transactions. This is deliberately not yet parity with the online tool-calling agent.

An offline advice record stores the question, answer, latency, token usage when supplied and observed connectivity. Connectivity flags are not proof of physical airplane mode. Model size, physical Android latency and Portuguese quality still need measurement; no such performance claim is made.

CSP permits WebAssembly compilation (`wasm-unsafe-eval`, not JavaScript `unsafe-eval`) and named model-download hosts. Models are not automatically downloaded. WebLLM caches are separate from versioned app caches. This version does not claim independently pinned model-artifact integrity; publisher assets need a pinned, verified distribution before a production rollout.

## Validation

`npm test --prefix prototype` includes mocked-provider conversation/tool tests, owner isolation, explicit-field grounding, confirmation bypass, duplicate messaging, honest outage fallback and offline context isolation. These are integration contract tests, not live model quality evaluations.

Build: `npm run build:offline --prefix prototype` and `npm run build:twilio --prefix prototype`. Bundled browser runtime assets are checked in so static deployments do not need to download a model at build time. Runtime packages use their respective upstream licenses; redistributed notices accompany the bundles.

Test messages after activation:

1. “I grow cassava. Help me plan a sale.”
2. “I have 80 kg of cassava, grade B, harvested 2026-10-04, BRL 4/kg.”
3. Review the details, then “CONFIRM”.
4. “What are my options and what information is missing?”
5. “Prepare a harvest summary for this lot.” Review, then “CONFIRM”.

Real buyers, live quotations, shipment clearance, Android evidence and configured email delivery remain separate readiness requirements.
