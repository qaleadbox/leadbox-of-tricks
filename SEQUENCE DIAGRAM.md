User clicks button in popup
      │
      ▼
popup.js → chrome.scripting.executeScript(local-storage.js)
      │
      ▼
popup.js → chrome.scripting.executeScript($data-handler.js)
      │
      ▼
$data-handler.js runs in page context
      │
      ├─> calls window.getActiveVehicleSelectors()
      │       (from local-storage.js)
      │
      ├─> processes DOM vehicle cards
      │
      └─> chrome.runtime.sendMessage({type:"exportToCSV", data})
              │
              ▼
         background.js (service worker)
              │
              └─> calls exportToCSVFile()
                    → creates a Blob
                    → downloads CSV
