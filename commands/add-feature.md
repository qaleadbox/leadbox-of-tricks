# Add New Feature

You are adding a new feature to the LeadBox of Tricks Chrome Extension.

## Architecture Overview

### File Structure
- `/popup/` - Popup UI and feature launcher
- `/core/` - Shared logic injected into SRP pages (scrolling, data handling, CSV export, card highlighting)
- `/storage/` - Chrome storage helpers for persisting data
- `/coming-soon/` - Image analysis features
- `/srp-csv/` - SRP validation utilities
- `/ims-tools/` - Admin panel tools
- `/intellisense/` - Autocomplete system
- `/sitemap-tools/` - Link extraction tools

### Key Principles
1. **Modularity**: Each feature should be self-contained in its own folder
2. **Storage-first**: Use chrome.storage.local for all persistence
3. **Content injection**: Use chrome.scripting.executeScript for dynamic injection
4. **Message passing**: Use chrome.runtime.sendMessage for background communication
5. **Visual feedback**: Update icon spinner and popup UI during operations

## Feature Implementation Checklist

### 1. Create Feature Module
- [ ] Create new folder for feature (e.g., `/my-feature/`)
- [ ] Create main feature file (e.g., `my-feature-checker.js`)
- [ ] Export necessary functions as modules

### 2. Update Popup
- [ ] Add button in `/popup/popup.html`
- [ ] Add event listener in `/popup/popup.js`
- [ ] Add feature launcher function
- [ ] Add loading state management

### 3. Background Integration (if needed)
- [ ] Add message listener in `background.js`
- [ ] Add icon spinner management
- [ ] Add API proxy if calling external services

### 4. Content Script (if needed)
- [ ] Add to manifest.json content_scripts or web_accessible_resources
- [ ] Handle DOM manipulation
- [ ] Use shared core modules ($data-handler, $scrolling, etc.)

### 5. Storage (if needed)
- [ ] Create storage helper in `/storage/` folder
- [ ] Implement save/load functions
- [ ] Add storage keys to constants

### 6. Documentation
- [ ] Update README.md with feature description
- [ ] Add usage instructions
- [ ] Update version history
- [ ] Add to feature list

### 7. Testing
- [ ] Test on target domains
- [ ] Test popup interaction
- [ ] Test storage persistence
- [ ] Test error handling
- [ ] Test with multiple browser tabs

## Code Patterns

### Popup Button
```javascript
document.getElementById('myFeatureBtn').addEventListener('click', async () => {
  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Execute feature script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['/my-feature/my-feature-checker.js']
  });
});
```

### Background Message Handler
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'myFeature') {
    // Handle feature logic
    sendResponse({ success: true });
  }
});
```

### Storage Helper
```javascript
export async function saveMyData(data) {
  await chrome.storage.local.set({ myFeatureData: data });
}

export async function loadMyData() {
  const result = await chrome.storage.local.get('myFeatureData');
  return result.myFeatureData || defaultData;
}
```

## Version Bump
Update `manifest.json` version field following semantic versioning.
