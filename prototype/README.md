# HarvestLink runnable prototype

Farmers use WhatsApp or SMS as their everyday assistant. The web app is the CRM and marketplace; the installed companion provides local assistance without signal. Bonfim tomatoes → Lethem is one example, not the whole product.

[Product, corridor research, photographs and moonshot vision](../README.md) · [Technical specification and diagrams](../docs/TECHNICAL-SPEC.md) · [Brand identity](../docs/BRAND.md)

## Run

Requires Node 22+. From this directory:

```sh
npm ci
npm start
npm test
```

Open http://127.0.0.1:4173. [Published workspace](https://declanroye.github.io/HarvestLink/?release=v26).

## Small AI and offline behavior

The current EN/PT model is a character-ngram logistic-regression intent classifier: 125,597-byte model pack plus 2,587-byte runtime. Structured extraction, planning and calculations use validated deterministic tools. It is not an open-ended generative LLM. Open and cache the companion online before disconnecting; drafts and records persist locally. WhatsApp delivery and current market refresh need connectivity. Shared account sync uses explicit uploads, ownership and revision checks.

## Setup and evidence

[Provider setup](SETUP.md) · [Shared deployment](SHARED-SETUP.md) · [WhatsApp demo](DEMO-WHATSAPP.md) · [Journey](PRODUCT.md) · [Phone evidence protocol](PHONE-TEST.md)

43 tests cover the existing implementation. English onboarding has a real WhatsApp exchange; participant pairing and the complete physical-phone workflow still need proof. Desktop inference measurements are not budget Android evidence.

Demo prices, orders, carriers and partner quantities are illustrative. Shipment status remains **awaiting buyer confirmation and trade-requirement checks**. No booking or dispatch occurs. Provider credentials remain server-side. The bounded Sync store is hackathon infrastructure.
