# HarvestLink

A messaging-first harvest assistant for smallholder farmers. English/Portuguese crop intake and an offline phone companion are the core; **Bonfim tomatoes → Lethem importers** is one optional demonstration scenario.

Farmers register harvests, receive net-earnings comparisons and confirm their choices through **WhatsApp or SMS**. The browser interface is a conversation preview, offline companion, and buyer/coordinator workspace.

[Open the phone companion](https://declanroye.github.io/HarvestLink/) · [Phone / WhatsApp setup](prototype/SETUP.md)

## Run locally

```sh
cd prototype
npm ci
npm start
```

Open http://127.0.0.1:4173. Node 22+ required. See [prototype/SETUP.md](prototype/SETUP.md) for the reconciled phone, WhatsApp, SMS and offline setup.

[Product journey](prototype/PRODUCT.md) · [Shared-account deployment](prototype/SHARED-SETUP.md) · [Small AI & physical phone evidence](prototype/PHONE-TEST.md)

## Included

- Compact learned EN/PT character-ngram intent model (125,597-byte pack + 2,587-byte runtime), structured extraction and missing-field dialogue.
- Explicit farmer confirmation for lots and sales choices, through the shared messaging engine.
- Compatible pooling, dated BRL/GYD cost assumptions and immutable choice snapshots.
- English/Portuguese interface switch, offline records and exporter handover.
- Official Twilio SDK adapter with signature validation and duplicate-message handling.
- Paired Twilio Functions with one shared Sync store, verified phone linking, per-farmer device access, revisioned uploads and conflict review.
- Consent-based one-question onboarding, stable channel profiles, own-lot queries and confirmed account changes.
- Messaging commands for status, proposals, lot withdrawal and support requests.
- Control panel with account overview, local record status and explicit upload receipts.
- Seven recognized crops, explicit harvest location and a general mode without fictional buyer offers.
- HTTPS phone-hosting workflow and real-channel launch links.
- Unit/integration tests and documented hackathon evidence limitations.

The shared-account build is published on GitHub Pages and both Twilio Functions are deployed. GitHub verification passes (28 tests). Live pairing-code creation, scoped API rejection and model loading are verified. A participant’s real WhatsApp confirmation and physical Android evidence are still pending.

## Important demonstration boundaries

All prices, orders and FX/cost inputs are illustrative. Shipment status is **awaiting buyer confirmation and trade-requirement checks**. Live messaging needs a configured provider, public HTTPS webhook and consenting test recipient. The WhatsApp/SMS selector in the browser is a **preview**, not a live connection. Physical budget Android measurements and bilingual human template sign-off remain pending.

Source lives in `prototype/`. Provider credentials, private messages, runtime caches and unrelated local skill repositories are excluded from Git.
