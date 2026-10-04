# HarvestLink product journey

HarvestLink's primary interface is a conversation. The phone companion keeps useful work possible without a signal. The web control panel helps farmers inspect their records and helps coordinators review availability, costs, buyers and unresolved issues. Bonfim tomatoes → Lethem is one example of this broader workflow.

## Three surfaces, one verified account

| Surface | Everyday responsibility | Connectivity |
| --- | --- | --- |
| WhatsApp / SMS | Onboard, register/correct harvests, list own lots, see offers, compare earnings, confirm decisions, change profile, request help | Online/provider connection |
| Installed phone companion | Same structured conversation locally, saved profile/lots, recent proposal/cost snapshots, draft decisions, backup export | Runs offline after installation/cache |
| Web control panel | Profile and record overview, receipts, buyer summaries, compatible pools, cost assumptions, consent/handover review, support queue | Local records offline; shared records require backend connection |

The current build uses one verified farmer ID across WhatsApp and the companion when both use the same backend. Expiring pairing codes, confirmation from a provider-verified sender, scoped device credentials, shared records, revision checks and explicit conflict review are implemented and tested locally. Both paired Functions and the public companion are deployed; live pairing-code creation and authentication rejection are verified. A real participant must still confirm linking in WhatsApp. Names are never identifiers. GitHub Pages is only the frontend. Choose either paired Twilio Functions using the same Sync document, or one Node server for both channels; these deployment alternatives do not replicate each other. See [SHARED-SETUP.md](SHARED-SETUP.md).

## First conversation

A farmer scans a QR code or receives the HarvestLink number from a trusted cooperative. In the trial they first complete Twilio's Sandbox join. That join is provider setup, not HarvestLink onboarding; a production WhatsApp sender removes this trial-specific step.

HarvestLink introduces itself and asks whether the farmer agrees to saving their name and production area and presenting confirmed availability to buyers. No national ID, bank details or residential address are needed for initial harvest registration. Declining/cancelling leaves no confirmed profile. The prototype records consent text/version/time; legal review and a real privacy notice are required before field rollout.

Ask a single question per turn:

1. “May we save your profile for harvest coordination?” → ACEITO / CANCELAR.
2. “What should we call you?” → plain name.
3. “Which town/community do you produce in?” → coarse location.
4. “Which menu language?” → PT / EN.
5. Show the profile and ask CONFIRMO. Then ask what is available today.

If the first message already contains a harvest, retain it during onboarding and resume it after profile confirmation. Ask only missing harvest details. Reuse the confirmed profile's name/location on later harvests. Do not overwrite historical lots when the profile changes.

This version parses harvest input in Portuguese. The English UI and controlled buyer summaries are supported; choosing EN on a profile is a saved preference, not proof that the crop model can interpret arbitrary English messages. Full English dialogue is a subsequent model/template milestone.

## Everyday harvest conversation

“Tenho 120 kg de mandioca.” → ask grade → ask harvest date → ask achievable local price per kg → show the full lot → explicit CONFIRMO. These are necessary data questions, not a long registration form. Corrections are ordinary messages; CANCELAR clears the draft while preserving confirmed records. Boxes require known kg per box before conversion. Unknown quality/crop or unclear text should lead to clarification/coordinator assistance, never invented facts. The current MVP supports seven crops, grades A/B, ISO dates and BRL local prices; ungraded lots, natural dates and additional currencies remain work to implement.

A confirmed lot means declared availability, not verified quality, a sale, an allocation or dispatch. The record keeps its owner, source and confirmation time. Lot IDs let farmers manage several harvests without changing the wrong one.

## Commands implemented in the prototype

| Farmer sends | Behavior |
| --- | --- |
| INICIAR / START | Create a consented profile, or point an existing farmer to their current account |
| MENU / AJUDA / HELP | Available actions |
| COLHEITA / HARVEST | Start a new draft, reusing name and location |
| LOTES / LOTS | List only lots owned by this channel profile |
| CONTA / ACCOUNT | Review profile and available commands |
| ALTERAR NOME Ana / ALTERAR LOCAL Boa Vista | Review change, then CONFIRMO; prior lots retain historical fields |
| IDIOMA PT / IDIOMA EN | Save menu-language preference |
| PROPOSTAS / OFFERS | Show configured proposal, or explicitly say there is none |
| COMPARAR GANHOS | Compare the last compatible confirmed lot using dated order/cost inputs |
| ESCOLHO LOCAL / ESCOLHO PROPOSTA | Review estimated net receipts and intended decision; second CONFIRMO saves |
| STATUS | State local/online record status separately from buyer and shipment confirmation |
| RETIRAR LOTE followed by short ID | Review and confirm removal from availability; history retained; reserved/selected lots need coordinator review |
| SUPORTE / SUPPORT | Create a pending support request; no automatic human notification is implemented |
| EXPORTAR / EXPORT | Return a compact record summary; full local JSON export is available in My account |

The trial messaging store has a bounded capacity and short retry history, as described in SETUP.md. Account/lots queries are scoped to the session's stable owner ID. The signature-validated Twilio sender selects the session. A shared phone remains a shared channel profile in this prototype: distinct farmer identities on one handset require a deliberate verified switching flow, not a guessed name.

## Buyer proposals and farmer decisions

A coordinator registers a real buyer request with crop, grade, origin/collection area, quantity, harvest/pickup window, offered currency/price, payment terms and offer expiry. Confirmed compatible availability can be pooled; withdrawn, reserved or incompatible lots are excluded. The current UI contains an optional demonstration order, not a full buyer-order creation system.

Each participating farmer receives a short proposal in their preferred language: their own allocated kg, local net, proposed net, itemised costs, FX source/date, expiry, payment responsibility, known risks and open checks. Allow “show costs” to expand detail in production. A model may extract intent or propose structure; it cannot accept a purchase or commit a farmer. Reviewed controlled templates translate structured records, with human bilingual sign-off before field use.

A decision records exactly the cost/order snapshot the farmer reviewed. A changed price, costs, expiry or allocation needs renewed review and consent. Partial allocations must be explicit: unsold remaining weight stays separate. Farmer choice, buyer confirmation, payment, pickup, inspection, trade approval and dispatch are different states. Cross-border status remains **awaiting buyer confirmation and trade-requirement checks** until real checks are completed.

## Offline behavior and honest sync

A farmer opens the previously cached installed companion. The small model and dialogue run locally; drafts, profile, lots and choice snapshots persist on that device. WhatsApp itself is not the offline AI host, and an unsent SMS is not a recorded harvest. The farmer can back up records without a network. Cached prices/orders must show their timestamps/expiry. A saved choice is an intention awaiting review; it must not claim a fresh buyer acceptance.

The control panel shows local records and service receipts separately. Farmer-scoped sync requires verified phone linking and explicit submission. The service acknowledges receipt; it does not prove buyer acceptance. An account revision mismatch rejects the whole batch before modification. The review flow exports a backup before explicitly replacing local changes with the shared version. Coordinator tools still use a separate operator key.

For the production implementation, use an operation outbox rather than copying arrays:

- Each confirmed mutation has an operation ID, owner ID, record ID, base revision, timestamp and type. Drafts never enter buyer-visible availability.
- Reconnect → verify account session → submit queued operations → server returns accepted/conflict/rejected per operation → save durable receipts → fetch current server revisions. Network status alone must not mark data synced.
- A lost acknowledgement retries the same operation ID. The server deduplicates persistently. Never replay a new financial acceptance implicitly.
- If the online lot was reserved, changed or withdrawn while the phone was offline, show both versions and ask the farmer/coordinator to resolve. Preserve originals; do not silently overwrite or double-count harvests.
- An expired proposal remains a historical snapshot. A refreshed proposal requires renewed confirmation before a trade can proceed.

## Verified linking: deployed, participant confirmation pending

The farmer requests “Link my phone” in the installed companion. The backend issues a short-lived pairing challenge and a high-entropy private claim bound to that browser. The WhatsApp sender confirms the device and account before the browser can claim a device credential. The farmer sends that challenge from their WhatsApp/SMS account. A signature-validated provider webhook proves the sender. The phone polls the challenge result using its own scoped session, then asks the farmer to review the linked number. Names/crops are never used as evidence of ownership. Challenges expire, are rate limited, cannot be used twice and cannot replace an existing link without re-verification. Lost phones, changed numbers, shared devices and account recovery require documented handling.

After linking, the shared backend owns Accounts, Lots, Orders, Allocations, Decisions, ConsentEvents, SupportRequests, OutboxReceipts and ProviderEvents. Both the webhook and the control-panel API use those services. The phone keeps a local replica. Twilio delivers messages; it does not independently define the trading state. Proactive WhatsApp notifications require actual user consent and provider-approved delivery outside applicable conversation windows; the prototype does not implement those notifications.

## Control-panel permissions

The farmer sees their own account, lots, received proposals, exact cost snapshots, status history, local changes and sync receipts. A buyer sees consented availability and the requests they are party to, not other farmers' account data or private messages. A coordinator can review their assigned farmers/pools, update documented cost assumptions, triage support and prepare a handover. Exporters see only consenting allocated lots and open operational checks. Production needs authenticated roles and server-side ownership checks on every API; hiding a tab is not access control. The public demo is not a multi-user production trading service.

## What to validate with farmers

Test onboarding completion without an instructor; retained initial harvest; correction before confirmation; farmer understanding of kg/class/local price; retrieval of multiple lots; distinction between offline save and a submitted proposal; expired-cost decisions; actual airplane-mode restart; provider reply times; and recovery from interrupted sync. Ask farmers to explain how much they expect to receive and whether a sale is confirmed. Record failures, not just a successful scripted demo.

Prioritise the next release: complete participant confirmation and real messaging evidence; measure a real budget Android phone; expand role authorization and recovery; add real buyer/order entry and expiry, human support assignment, notification consent/delivery tracking and a production transactional database. Then expand natural-language coverage, grades, currencies and voice-note accessibility using farmer-tested examples.
