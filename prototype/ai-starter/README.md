# HarvestLink: small AI reference starter

Created 3 October 2026. This is a runnable, compact intent classifier and an export example. It is not the full HarvestLink MVP. There is no phone UI, offline installation, messaging gateway, field extractor, sale calculation or synchronization implementation in this package.

## What this establishes

Training happens on a laptop in Python. The phone receives the vocabulary, learned weights and small JavaScript prediction module. Prediction needs ordinary CPU arithmetic, no GPU, no Python installation and no remote inference call.

The starter predicts six intents: offer, compare, correct, cancel, help and other. It uses binary presence of 3-5 character fragments and logistic regression. Its vocabulary is capped at 4,000 features. With six labels and 32-bit weights, the coefficient file contains 4,000 x 6 x 4 = 96,000 bytes. Vocabulary and metadata add 29,597 bytes. Prediction code adds 2,587 bytes. Model plus runtime: 128,184 bytes, approximately 128 KB using decimal units. This excludes the interface, phrase packs, commercial data, browser and operating system.

This is a measured file-size result. It is NOT measured working RAM, latency, battery consumption or smartphone compatibility. Parsed dictionaries and the browser use additional memory.

## What is in the folder

- train.py: reproducible training and export, containing 72 synthetic seed messages.
- training_examples.json: exported English and Portuguese seed data with provenance.
- model/weights.f32: label-major little-endian float32 coefficients.
- model/vocabulary.json: character fragments in the exact trained feature order.
- model/metadata.json: labels, intercepts, normalization and settings.
- predict.mjs: dependency-free JavaScript prediction module, usable by a browser or Node.
- check.mjs and parity_reference.json: cross-runtime export checks.
- measurement_report.json: measured sizes, synthetic checks and limitations.
- requirements.txt: exact Python package versions used in this run.

## Run it on a developer laptop

From this extracted folder:

    node check.mjs "Tenho tomates prontos para vender"

This needs Node but does not need Python or the internet. To retrain, install the dependencies once and run:

    python3 -m pip install -r requirements.txt
    python3 train.py
    node check.mjs

Training installs nothing on a farmer's phone. New training data means retraining on the laptop and shipping a new model version. Do not ship a Python pickle or joblib file and expect a phone browser to execute it.

## Add it to the local phone interface

Import HarvestIntentModel from predict.mjs in the browser application. Load metadata and vocabulary as JSON, and weights.f32 as an ArrayBuffer. Pass those three values to the constructor and call model.predict(text). The constructor and predictor make no network requests.

For the hackathon, a minimal PWA can cache all four assets and its interface in a service worker, with records in IndexedDB. Initial installation must use HTTPS while connected; a service worker does not become available merely by opening a downloaded ZIP or an HTTP URL at a laptop's LAN address. After caching completes, show an offline-ready state and test an offline restart. The smartphone needs no further network connection for local classification.

Explicitly request persistent browser storage when supported and check the returned result. A browser may refuse and may otherwise evict data under storage pressure; clearing site data also removes assets and records. Test this behavior. A native Android implementation can use bundled assets and local app storage instead, especially if a pilot needs more predictable installation and storage behavior. Use that route when the team has the necessary Android skills. This package does not supply an APK.

The farmer's WhatsApp or SMS path remains a connected service adapter. Our trained model cannot be inserted into the user's WhatsApp installation. Offline local chat is a separate HarvestLink interface on an existing smartphone. For a basic phone with no signal, immediate assistance needs an available shared smartphone; this package does not change that limitation.

## Compatibility target and regional evidence

Use an existing Android phone with 2 GB RAM as the first budget-device test target, plus Android 10 or later and a current working Chrome browser for the PWA route. This is a proposed test target, not a proven minimum and not a claim that most Guyanese or Roraima farmers have this specification. Google currently lists Android 10+ for Chrome. Confirm the exact phone, Android/browser version, free space and offline features before promising support. Android version alone does not guarantee manufacturer security updates.

Samsung's Galaxy A03 Core is a concrete low-spec hardware reference: the manufacturer lists up to 2 GB RAM and 32 GB storage. Samsung also has a Brazil product page. Neither establishes farm ownership or regional market share. We have not obtained a representative inventory of farmers' phone models, RAM or browser versions. National phone ownership/access surveys cannot establish those specifications.

Test the oldest available 1 GB phone separately if relevant; mark unsupported features honestly. Feature phones can use the SMS channel while cellular service exists, but cannot run this JavaScript browser module unless their actual runtime supports it. No blanket feature-phone compatibility is claimed.

## Tests completed and still required

Completed in the execution workspace: training/export; 88 Python-to-JavaScript comparisons, including Portuguese accents, whitespace, empty text and truncation. All prediction labels matched and score differences were below 0.00001. The Node environment is recorded. Twelve additional synthetic label checks also matched, but they were authored by the same assistant as the training seeds. This is not an independent accuracy benchmark and must not be advertised as real-farmer accuracy.

Required before submission: obtain fresh messages from another person; hold out authors and paraphrase families; review Portuguese; compare against a keyword/menu baseline; test multi-intent messages, negation and out-of-domain input; measure errors and clarification rates; run and restart the full interface on a real budget phone in airplane mode; measure actual response time and working memory; test persistence after closing and reopening; record at least one real configured messaging exchange.

The model's confidence score is uncalibrated. Its example clarification thresholds are engineering placeholders, not validated safety thresholds. A false needsClarification value does not authorize sharing, a record update or a sale. A person must confirm material facts and final actions. Treat cancellation/contradiction conservatively; arbitrary language, new regional expressions and unseen units remain unsupported until tested.

## Data and licenses

The 72 seed examples and 12 synthetic label checks were generated by the assistant for this starter. They are not collected farmer messages or downloaded MASSIVE examples. The generated data and model artifacts are offered under CC0-1.0; see https://creativecommons.org/publicdomain/zero/1.0/. Starter source code uses the MIT license in LICENSE. Third-party libraries retain their own licenses. Any future MASSIVE release or real-user corpus needs its own source, size, license and consent record. No external dataset is needed to run the included export.

## Primary technical sources

- scikit-learn text features: https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.CountVectorizer.html
- scikit-learn logistic regression and exported coefficients: https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html
- Android Go device constraints: https://developer.android.com/guide/topics/androidgo
- Chrome Android system requirements: https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DAndroid&hl=en-GB
- Samsung A03 Core hardware: https://www.samsung.com/africa_fr/business/smartphones/galaxy-a/galaxy-a03-core-sm-a032fzkdxfe/
- Samsung Brazil product page: https://shop.samsung.com/br/galaxy-a03-core/p?skuId=2447
- PWA offline storage: https://web.dev/learn/pwa/offline-data
- Service-worker secure contexts: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- Persistent storage may be refused: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
