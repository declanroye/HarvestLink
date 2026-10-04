# HarvestLink

A messaging-first harvest coordination prototype for Portuguese-speaking tomato farmers around **Bonfim, Roraima** and English-speaking produce importers in **Lethem, Guyana**.

Farmers register harvests, receive net-earnings comparisons and confirm their choices through **WhatsApp or SMS**. The browser interface is a conversation preview, offline companion, and buyer/coordinator workspace.

## Run locally

```sh
cd prototype
npm ci
npm start
```

Open http://127.0.0.1:4173. Node 22+ required. See [prototype/README.md](prototype/README.md) for provider setup and offline/device proof.

## Included

- Compact learned Portuguese intent model (8,621 bytes), structured extraction and missing-field dialogue.
- Explicit farmer confirmation for lots and sales choices, through the shared messaging engine.
- Compatible pooling, dated BRL/GYD cost assumptions and immutable choice snapshots.
- English/Portuguese interface switch, offline records and exporter handover.
- Official Twilio SDK adapter with signature validation and duplicate-message handling.
- Unit/integration tests and documented hackathon evidence limitations.

## Important demonstration boundaries

All prices, orders and FX/cost inputs are illustrative. Shipment status is **awaiting buyer confirmation and trade-requirement checks**. Live messaging needs a configured provider, public HTTPS webhook and consenting test recipient. The WhatsApp/SMS selector in the browser is a **preview**, not a live connection. Physical budget Android measurements and bilingual human template sign-off remain pending.

Source lives in `prototype/`. Provider credentials, private messages, runtime caches and unrelated local skill repositories are excluded from Git.
