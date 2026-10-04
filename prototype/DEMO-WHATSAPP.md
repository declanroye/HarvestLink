# WhatsApp-first demo test

For an existing English profile named Declan in Bonfim, send each line separately and wait for the reply:

1. DEMO MARKET
2. I have 120 kg of tomatoes
3. grade A
4. 2026-10-04
5. BRL 3.50/kg
6. CONFIRM
7. MARKET
8. COMPARE EARNINGS
9. CHOOSE PROPOSAL
10. CONFIRM
11. LOGISTICS
12. TRADE
13. HANDOVER
14. CONFIRM
15. STATUS

The fictional order needs 200 kg. A clearly marked fictional partner contributes 80 kg in the demo view only. Your 120 kg should yield local net BRL 390.00 and estimated proposal net BRL 530.25 using costs dated 2026-10-03, valid through 2026-10-10, FX 40 GYD/BRL and 5% assumed loss. No live prices, freight quotes, buyer commitments or trade checks are connected. All shipment records remain awaiting buyer confirmation and trade-requirement checks; dispatchAuthorized is false.

Marketplace commands: OFFER DEMO-CASSAVA, OFFER DEMO-BANANA, OFFER DEMO-TOMATO. DEMO OFF disables the example. Matching requires crop, grade, source location and date compatibility. This is not a production marketplace.

Open the published v18 companion, connect using the existing pairing workflow, activate the verified WhatsApp account, then open Marketplace. Its snapshot polls the shared backend every 15 seconds while visible, preserves local unsent work, and retains the last snapshot offline. Refresh never submits a farmer decision. Offline handovers are local drafts; submit the confirmed proposal choice after reconnecting and create the backend handover through WhatsApp. Offline handover upload is not implemented.

The learned character n-gram logistic-regression intent classifier is bundled into the WhatsApp backend and runs locally in the companion. It classifies intents; deterministic extraction and reviewed templates ask for details. It is not an LLM. Model pack 125597 bytes; runtime 2587 bytes; total 128184 bytes. Physical Android timings and airplane-mode proof remain pending.

## Goal-based assistant (v19)

After onboarding, try: Help me sell my harvest; What is my best option?; What should I do next?; What do you know about me?; Arrange transport; Prepare an exporter handover. Portuguese equivalents include Ajude-me a vender minha colheita; Qual a melhor opção?; Meu plano; Organizar transporte. With multiple lots, choose USE LOT <ID>. The goal persists in channel session storage. Natural-language routing and planning are deterministic domain tools around the compact learned intent model, not a general-purpose generative LLM. It cannot know unconnected live data or book a carrier.

Offline: the same planning and comparison logic runs locally over confirmed account records and demo/cached assumptions. It does not refresh external sources or submit anything. Local goals currently remain on their channel/device and are not synchronized as account fields; linked confirmed lots and choices use the shared backend. Confirmations are still explicit, and expired costs stop recommendations.
