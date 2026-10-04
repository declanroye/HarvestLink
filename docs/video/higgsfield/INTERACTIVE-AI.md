# Interactive local AI and offline diagram

Open `/local-ai-demo.html` on the prototype site. The visual sequence follows the actual compact classifier: English/Portuguese training examples → capped 4,000 character features → 24,000 float32 weights → 125,597-byte inference pack → cached phone companion. The slider and autoplay visualize export and phone fitting, not large-language-model compression.

The offline tab runs the actual `loadLocalModel` and `HarvestIntentModel.predict` implementation, including integrity checks and clarification gates. Its record demo uses a separate IndexedDB database (`harvestlink-ai-explainer`) and explicit confirmation. Loading caches the diagram assets alongside the companion's existing service-worker/model cache. The offline toggle is labelled a preview, not a physical radio-state measurement. Reconnect is an explanatory preview and does not send an order.

Verified in the browser: Portuguese `Tenho mandioca disponivel para vender` → `offer` with 80 matched features; confirmed draft survived reload. The demo does not assert independent model accuracy, general conversational reasoning, actual backend sync, or physical phone benchmarks. Provenance and model-file measurements are in `prototype/ai-starter/measurement_report.json`.

The latest one-minute **Vision** film replaces the testing/deployment narrative with the farmer journey, useful decisions, local/offline intelligence and a regional network explicitly presented as “Our Vision”. Fictional footage and illustrative commercial figures remain labelled; full implementation evidence stays in supporting documentation.
