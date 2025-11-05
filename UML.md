          ┌──────────────────────────┐
          │        Popup UI          │
          │──────────────────────────│
          │ + popup.html             │
          │ + popup.js               │
          │ + buttons: export/import │
          │ + input: selectors       │
          └──────────┬───────────────┘
                     │
                     │ uses chrome.runtime + chrome.storage
                     ▼
┌──────────────────────────────────────────────────────────┐
│                 vehicle-card-store.js                    │
│──────────────────────────────────────────────────────────│
│ + getCurrentDomain(): string                             │
│ + getVehicleCardSelectors(domain): obj                   │
│ + setVehicleCardSelectors(domain, map): void             │
│ + exportVehicleCardSelectors(): downloads JSON           │
│ + importVehicleCardSelectors(file): loads JSON           │
│──────────────────────────────────────────────────────────│
│ * called by popup.js                                     │
│ * uses chrome.storage.local                              │
│ * persists mappings per-domain                           │
│ * exposes helpers via module exports                     │
└──────────┬───────────────────────────────────────────────┘
           │
           │ later used in injected context
           ▼
┌──────────────────────────────────────────────────────────┐
│             local-storage.js                      │
│──────────────────────────────────────────────────────────│
│ + window.getActiveVehicleSelectors(): Promise<object>    │
│    → Loads selectors from chrome.storage.local           │
│──────────────────────────────────────────────────────────│
│ * injected dynamically via chrome.scripting              │
│ * defines a global function on window                    │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                 $data-handler.js                         │
│──────────────────────────────────────────────────────────│
│ + window.$dataHandler(allVehicleCards, ...)              │
│    - Uses getActiveVehicleSelectors()                    │
│    - Detects card structure                              │
│    - Extracts model, trim, stock, image                  │
│──────────────────────────────────────────────────────────│
│ * injected dynamically after local-storage.js     │
│ * runs directly in the DOM of target page                │
│ * calls chrome.runtime.sendMessage for exports           │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                background.js                             │
│──────────────────────────────────────────────────────────│
│ onMessage(type='exportToCSV') → exportToCSVFile()        │
│──────────────────────────────────────────────────────────│
│ * receives chrome.runtime messages                       │
│ * performs file creation (Blob + anchor click)           │
│ * runs always in background (service_worker)             │
└──────────────────────────────────────────────────────────┘
