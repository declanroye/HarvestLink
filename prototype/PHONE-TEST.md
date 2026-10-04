# Small AI and budget Android evidence

The provided Small AI starter is now the active classifier in the companion, Node backend and generated Twilio handlers. It uses binary character 3–5 grams and six-label learned logistic regression: offer, compare, correct, cancel, help, other. It is not a generative model. Portuguese field extraction, missing-detail prompts, account commands and confirmation rules remain deterministic. The model never authorizes a sale or record change on its own. English intent recognition does not imply complete English crop intake.

The shipped model pack is **125,597 bytes**: weights 96,000, vocabulary 28,680, metadata 917. The supplied runtime is **2,587 bytes**, for **128,184 bytes** total. This excludes UI, dialogue code, the model loader, browser storage, parsed dictionaries, browser RAM and the operating system. Model size is not working RAM. The earlier 8,621-byte naive Bayes model remains as a legacy regression fixture; it is no longer the active inference model.

All 88 Python-export reference labels and scores match the shipped JavaScript runtime within 0.00001. That checks export correctness, not farmer accuracy. Training uses 72 assistant-authored synthetic messages. No independent field evaluation has been completed. Thresholds are uncalibrated; unsupported messages ask for clarification and exact commands remain usable.

Run `node scripts/measure-small-ai.mjs` from `prototype` for a clearly labelled **desktop-only** report with asset hashes, sizes, cold load, 500 warmed classifier timings and 500 dialogue timings. It cannot stand in for a phone measurement.

## Physical phone protocol — pending until a device is available

Borrow an actual low-cost Android phone. Record its model, Android and Chrome versions, RAM if known, available storage and battery level. A 2 GB device is a proposed test target, not a proven minimum. No physical Android phone was available during this build.

1. Publish the updated companion and both handlers. Open the HTTPS companion connected, wait for offline cache installation and reload. Request persistent storage in **Operations & evidence**; record whether the browser grants it.
2. Complete WhatsApp onboarding and verified linking. Register a lot in WhatsApp, then fetch it on the phone. Record the inbound/reply conversation and actual Message SIDs with personal numbers redacted.
3. Activate airplane mode manually. Disable Wi-Fi and mobile data. Film the quick-settings state and return to the installed companion. Create a different crop lot in Portuguese; show missing questions, correction and **CONFIRMO**. No messaging delivery is claimed while offline.
4. Enter the phone model/version and RAM in **Operations & evidence**, tick the physical-device and airplane-mode attestations, and run 100 inferences. Export the report. Report p50/p95/max and exactly which work is included. Optional JS heap statistics describe the whole browser heap, not model RAM. Attestations are self-reported; the video corroborates them.
5. Close the app/browser and reopen while still in airplane mode. Show the account and confirmed lot restored. Then restore connectivity and explicitly submit records. Show that **LOTES** in WhatsApp includes the same new lot.
6. For a conflict test, edit the account through WhatsApp while the companion has an unsent local edit. Show the 409 review and backup flow. Do not claim automatic merging.
7. Record a 2–5-minute walkthrough covering Portuguese input, English buyer template, compatible pooled lots, dated cost/FX assumptions and human confirmation. Mark all demonstration orders/prices. Shipment status remains **awaiting buyer confirmation and trade-requirement checks**.

Do not publish pairing codes, claim tokens, device credentials, Twilio secrets or unredacted phone numbers in the video or evidence. Evidence exports omit the device/claim token. A desktop recording cannot prove airplane-mode performance on an Android phone.
