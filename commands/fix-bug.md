# Fix Bug

You are fixing a bug in the LeadBox of Tricks Chrome Extension.

## Bug Investigation Process

### 1. Reproduce the Bug
- [ ] Identify exact steps to reproduce
- [ ] Note which URLs/pages trigger the bug
- [ ] Check if bug occurs in specific browser versions
- [ ] Verify if bug is related to specific user actions

### 2. Gather Information
- [ ] Check browser console for errors
- [ ] Check extension service worker logs
- [ ] Check chrome.storage state
- [ ] Review recent code changes (git log)
- [ ] Check if bug is in "Known Issues" list

### 3. Isolate the Problem
- [ ] Identify which module/file is involved
- [ ] Check for timing issues (race conditions)
- [ ] Verify API responses (OCR, OpenAI, Claude)
- [ ] Check DOM selectors and element availability
- [ ] Test with different SRP page structures

### 4. Root Cause Analysis
- [ ] Identify the exact line/function causing the issue
- [ ] Understand why the bug occurs
- [ ] Check for edge cases not handled
- [ ] Review error handling

## Common Bug Categories

### DOM-Related
- Selectors not matching elements
- Elements not loaded when script runs
- MutationObserver not catching changes
- Infinite scroll pagination issues

### Storage-Related
- Data not persisting across sessions
- Storage quota exceeded
- Race conditions when reading/writing
- Incorrect key names or data structure

### Message Passing
- Messages lost when popup closes
- Service worker terminated mid-operation
- Response timeout issues
- Incorrect message routing

### API Integration
- API keys not stored correctly
- Rate limiting or timeout issues
- Response parsing errors
- CORS or CSP violations

### Timing Issues
- Scripts running before DOM ready
- Popup closing before operation completes
- Race conditions in async operations
- Service worker lifecycle issues

## Bug Fix Checklist

1. [ ] Write a minimal test case that reproduces the bug
2. [ ] Fix the root cause (not just symptoms)
3. [ ] Test the fix thoroughly
4. [ ] Check for similar issues elsewhere in codebase
5. [ ] Update error handling if needed
6. [ ] Add defensive code to prevent regression
7. [ ] Update documentation if behavior changed
8. [ ] Update or remove from "Known Issues" if applicable
9. [ ] Test edge cases
10. [ ] Verify fix doesn't break other features

## Testing Scenarios

### Test on Multiple Sites
- my.leadboxhq.net
- car-dealer-production-qa.azurewebsites.net
- Various dealer SRP pages (different structures)

### Test Different States
- Fresh install
- After browser restart
- Multiple tabs open
- During ongoing operations
- With/without API keys configured

### Test Error Conditions
- Network offline
- API service down
- Invalid API keys
- Malformed page structure
- Empty/missing data

## Code Review
Before committing, review:
- Is the fix minimal and focused?
- Does it handle edge cases?
- Is error handling appropriate?
- Are there any performance implications?
- Does it follow existing code patterns?
- Are variable names clear?
- Is the fix well-commented if complex?
