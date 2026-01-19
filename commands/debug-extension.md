# Debug Chrome Extension

You are debugging the LeadBox of Tricks Chrome Extension. This extension helps dealers manage inventory, validate data, and analyze images on vehicle SRP pages.

## Context
- Extension uses Manifest V3
- Target domains: my.leadboxhq.net, car-dealer-production-qa.azurewebsites.net, and all_urls for content scripts
- Service worker: background.js
- Content scripts inject tools into SRP pages
- Storage API used for persisting selectors and configurations

## Common Issues to Check

### 1. Content Script Injection
- Verify content scripts are loading on target pages
- Check if DOM is ready before accessing elements
- Ensure module imports work correctly

### 2. Storage Issues
- Check chrome.storage.local for saved data
- Verify data persistence across sessions
- Look for storage quota issues

### 3. Background Service Worker
- Verify service worker is active and not terminated
- Check message passing between popup/content/background
- Look for API proxy issues (OCR, OpenAI)

### 4. Popup Communication
- Verify popup can communicate with active tab
- Check if popup closes prematurely during long operations
- Ensure popup state persists appropriately

### 5. Permissions
- Verify all required permissions are granted
- Check host_permissions for target domains
- Ensure web_accessible_resources are properly configured

## Debugging Steps
1. Check browser console for errors (F12)
2. Check extension service worker console (chrome://extensions → inspect service worker)
3. Verify manifest.json configuration
4. Check chrome.storage contents
5. Test message passing between components
6. Verify API keys are properly stored and retrieved
7. Check for CSP violations

## Known Issues Reference
See README.md "Known Issues" section for current high/medium/low severity issues.
