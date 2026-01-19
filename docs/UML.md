┌──────────────────────────────────────────────────────────────┐
│                         Popup UI                             │
│──────────────────────────────────────────────────────────────│
│ popup.html / popup.js                                        │
│ • Builds selector inputs & module buttons                    │
│ • Imports storage helpers to read/write chrome.storage       │
│ • Launches feature scripts via chrome.scripting.executeScript│
└───────────────┬──────────────────────────────────────────────┘
                │ imports
                ▼
┌──────────────────────────────────────────────────────────────┐
│                    storage helpers                            │
│──────────────────────────────────────────────────────────────│
│ storage/vehicle-card-storage.js                               │
│ storage/field-map-storage.js                                  │
│ • Persist per-domain CSS selectors + arbitrary field maps     │
│ • Expose export/import helpers used exclusively by popup.js   │
└───────────────┬──────────────────────────────────────────────┘
                │ triggers feature launchers
                ▼
┌──────────────────────────────────────────────────────────────┐
│                   Feature launchers (popup)                   │
│──────────────────────────────────────────────────────────────│
│ coming-soon/coming-soon-checker.js                            │
│ srp-csv/csv-srp-data-matcher.js                               │
│ srp-csv/small-images-checker.js                               │
│ ims-tools/* , sitemap-tools/*, intellisense/*                 │
│ • Validate API keys / thresholds                              │
│ • Request selector data                                       │
│ • Inject shared runtime + module-specific code into the tab   │
└───────────────┬──────────────────────────────────────────────┘
                │ chrome.scripting.executeScript()
                ▼
┌──────────────────────────────────────────────────────────────┐
│              Injected page-context runtime (core/)            │
│──────────────────────────────────────────────────────────────│
│ core/$data-handler.js     → loads selectors, iterates cards   │
│ core/$card-highlighter.js → visual states + tooltips          │
│ core/$scrolling.js        → auto-scroll / pagination helpers  │
│ core/$csv-exporter.js     → client-side CSV downloads         │
│ • All run inside SRP DOM (no background needed)               │
│ • Feature launchers call into these helpers to process cards  │
└───────────────┬──────────────────────────────────────────────┘
                │ chrome.runtime.sendMessage()
                ▼
┌──────────────────────────────────────────────────────────────┐
│                      background.js                           │
│──────────────────────────────────────────────────────────────│
│ • Rotates toolbar icons while processing                     │
│ • Brokers OCR / OpenAI requests via coming-soon/* adapters   │
│ • Stops spinner when modules report completion               │
└──────────────────────────────────────────────────────────────┘

Supporting modules plugged into the runtime:
• srp-csv/csv-srp-data-matcher.js – parses pasted CSV, compares against `$data-handler`
• srp-csv/small-images-checker.js – inspects image dimensions/size and flags cards
• coming-soon/coming-soon-checker.js – checks each card image via OCR or OpenAI, then exports
