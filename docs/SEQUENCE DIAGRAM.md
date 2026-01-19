## CSV ↔ SRP Validation
1. **User** clicks `Validate SRP Cards with CSV Data` inside the popup.
2. **popup.js** reads selectors via `storage/vehicle-card-storage.js`, parses the pasted CSV, then injects:
   - `core/$card-highlighter.js`
   - `core/$scrolling.js`
   - `core/$data-handler.js`
   - `srp-csv/csv-srp-data-matcher.js`
3. **Injected runtime** pulls vehicle cards using the saved selectors, normalizes values, and compares them against the CSV map.
4. **csv-srp-data-matcher.js** builds the mismatch report and calls `core/$csv-exporter.js` to download the results.
5. **popup.js** displays summary stats and resets the spinner via `chrome.runtime.sendMessage({ type: 'stopProcessing' })`.

## Coming Soon Image Scan
1. **User** expands the Coming Soon module, selects OCR or OpenAI, and clicks `Start scanning`.
2. **coming-soon/coming-soon-checker.js** verifies stored API keys, then injects the same core runtime plus its own `callFindUrlsAndModels` helper.
3. **core/$data-handler.js** enumerates SRP cards, toggles highlight states, and hands card metadata + image URLs to the checker.
4. **callFindUrlsAndModels** requests image analysis through `chrome.runtime.sendMessage({ type: 'checkImageByOCR' | 'checkImageByOpenAI' })`.
5. **background.js** proxies each request to `coming-soon/ocr-image-checker.js` or `coming-soon/openai-image-checker.js`, returns the verdict, and rotates the action icon while processing.
6. **Checker runtime** aggregates positive matches, calls `$csv-exporter` when the user asks for a report, and finally emits `stopProcessing`.

## Small Image Detector
1. **User** clicks `Scan for Small Images`.
2. **srp-csv/small-images-checker.js** injects the shared core scripts, pulls the latest selectors, and measures each card’s image dimensions/size.
3. **core/$card-highlighter.js** marks cards with `small-image-card` styling; the checker maintains a list of offending cards.
4. **$csv-exporter** writes the CSV (stock number, model, size, timestamp) on demand, entirely within the page context.
5. **background.js** only tracks spinner state for this flow (no external API calls).
