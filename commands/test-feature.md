# Test Feature

You are testing features in the LeadBox of Tricks Chrome Extension to ensure quality and catch regressions.

## Testing Strategy

### Test Pyramid
1. **Manual Testing** (70%): Primary method due to Chrome extension nature
2. **Integration Testing** (20%): Test component interactions
3. **Unit Testing** (10%): Test isolated utility functions

## Manual Testing Checklist

### Pre-Test Setup
- [ ] Load unpacked extension in Chrome
- [ ] Open DevTools (F12)
- [ ] Open extension service worker console
- [ ] Clear chrome.storage.local if testing fresh state
- [ ] Prepare test data (CSV files, API keys, etc.)

### Feature Testing Matrix

#### Feature 001: Check Missing Images (Coming Soon)
**Test Sites**:
- [ ] landrovertoronto.ca/used-vehicles/
- [ ] jaguartoronto.com/new-vehicles/
- [ ] countychevroletessex.com/search/
- [ ] Custom dealer site

**Test Cases**:
- [ ] Click "Scan for Coming Soon Images" button
- [ ] Verify popup shows loading state
- [ ] Verify icon spinner starts
- [ ] Check if OCR API key prompt appears (if not set)
- [ ] Enter valid OCR API key
- [ ] Verify images are scanned progressively
- [ ] Check that "coming soon" images are detected
- [ ] Verify CSV report is generated
- [ ] Check report accuracy (manual verification)
- [ ] Test with OpenAI image checker option
- [ ] Test error handling (invalid API key)
- [ ] Test with API service down

**Expected Results**:
- All images scanned without errors
- "Coming soon" images correctly identified
- CSV downloaded with results
- No false positives/negatives

#### Feature 002: Check Small Images
**Test Sites**: Same as above

**Test Cases**:
- [ ] Click "Scan for Small Images" button
- [ ] Verify images below 10KB are detected
- [ ] Verify images below 300x200px are detected
- [ ] Check visual highlighting (red border)
- [ ] Verify "SMALL IMAGE" label appears
- [ ] Test customizable threshold
- [ ] Test with various image sizes
- [ ] Verify CSV report accuracy

**Expected Results**:
- Small images highlighted correctly
- Report matches actual image sizes
- No missed small images

#### Feature 003: CSV Data Matching
**Test Sites**: Same as above

**Test Data**:
- Valid CSV with matching data
- CSV with some mismatches
- CSV with invalid format
- Empty CSV
- Very large CSV (100+ rows)

**Test Cases**:
- [ ] Click "Validate SRP Cards with CSV Data" button
- [ ] Paste CSV data in popup textarea
- [ ] Verify data parsing works
- [ ] Check match/mismatch detection
- [ ] Verify visual feedback on cards
- [ ] Test with different CSV formats
- [ ] Test dynamic header recognition
- [ ] Test image URL comparison
- [ ] Verify CSV export
- [ ] Test with special characters in data
- [ ] Test with missing fields

**Expected Results**:
- CSV parsed correctly
- Matches/mismatches accurately identified
- Visual highlighting works
- Report generated successfully

#### Feature 004: HREF Extraction
**Test Data**:
- Valid sitemap UL element
- Invalid HTML structure
- Empty list
- Very large list (100+ links)

**Test Cases**:
- [ ] Copy sitemap UL element
- [ ] Paste in popup
- [ ] Verify links extracted
- [ ] Check formatting for spreadsheet
- [ ] Test with various link formats
- [ ] Verify all links captured

**Expected Results**:
- All links extracted correctly
- Format suitable for spreadsheet paste
- No malformed output

#### Feature 005: IMS Internals Leads Printer Icon
**Test URLs**:
- [ ] https://my.leadboxhq.net/leads/internal
- [ ] https://car-dealer-production-qa.azurewebsites.net/leads/internal

**Test Cases**:
- [ ] Navigate to test URL
- [ ] Verify printer icons appear next to leads
- [ ] Click printer icon
- [ ] Verify print view opens
- [ ] Test on multiple leads
- [ ] Test with different lead types
- [ ] Refresh page and retest

**Expected Results**:
- Icons appear automatically
- Print view works correctly
- No console errors

#### Feature 006: Text Autofiller
**Test Cases**:
- [ ] Type in any input field
- [ ] Click save button
- [ ] Clear field
- [ ] Type partial text
- [ ] Press Tab key
- [ ] Verify autofill suggestion appears
- [ ] Test with multiple fields
- [ ] Test across browser restarts

**Expected Results**:
- Text saved correctly
- Autofill suggestions appear
- Tab key completes suggestion
- Data persists across sessions

#### Feature 007: IMS Internals Leads Edit Icon
Similar to Feature 005, test edit functionality instead of print.

### Cross-Feature Testing
- [ ] Run multiple features in sequence
- [ ] Test feature while another is running
- [ ] Open multiple tabs with extension active
- [ ] Test popup open/close behavior
- [ ] Verify storage doesn't conflict between features

### Error Handling Testing
- [ ] Test with no internet connection
- [ ] Test with invalid API keys
- [ ] Test on unsupported pages
- [ ] Test with malformed data
- [ ] Test during Chrome updates
- [ ] Test with extension reload during operation

### Performance Testing
- [ ] Test on page with 100+ vehicle cards
- [ ] Measure scan time for all features
- [ ] Check memory usage (Chrome Task Manager)
- [ ] Verify no memory leaks
- [ ] Test scrolling performance during scans
- [ ] Check CPU usage

### Compatibility Testing
**Browsers**:
- [ ] Chrome (latest)
- [ ] Chrome (version 88)
- [ ] Edge (Chromium)

**Operating Systems**:
- [ ] Windows 10/11
- [ ] macOS
- [ ] Linux

**Screen Sizes**:
- [ ] 1920x1080
- [ ] 1366x768
- [ ] 2560x1440

## Edge Cases to Test

### Data Edge Cases
- [ ] Empty data sets
- [ ] Very large data sets (1000+ items)
- [ ] Special characters (é, ñ, ™, ©)
- [ ] Unicode characters
- [ ] HTML entities in data
- [ ] Null/undefined values
- [ ] Whitespace variations

### DOM Edge Cases
- [ ] Pages with dynamic content loading
- [ ] Pages with infinite scroll
- [ ] Pages with lazy-loaded images
- [ ] Shadow DOM elements
- [ ] iframes
- [ ] Single Page Applications (SPAs)
- [ ] Pages with multiple selectors matching

### Timing Edge Cases
- [ ] Close popup during operation
- [ ] Navigate away during scan
- [ ] Reload extension during operation
- [ ] Service worker termination
- [ ] Multiple rapid button clicks
- [ ] Tab switching during operation

## Bug Report Template

When finding a bug, document:

```markdown
## Bug Description
[Clear description of the issue]

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Chrome Version:
- Extension Version:
- OS:
- URL:

## Console Errors
[Paste any console errors]

## Screenshots
[If applicable]

## Additional Context
[Any other relevant information]
```

## Regression Testing

Before each release, test:
- [ ] All 7 main features
- [ ] All known edge cases
- [ ] All previously fixed bugs
- [ ] Cross-feature interactions
- [ ] Storage persistence
- [ ] Performance benchmarks

## Automated Testing Ideas

While the extension is primarily manually tested, consider:

### Unit Tests (Jest)
```javascript
// Test utility functions
describe('normalizePrice', () => {
  test('removes currency symbols', () => {
    expect(normalizePrice('$12,345.67')).toBe('12345.67');
  });

  test('handles empty string', () => {
    expect(normalizePrice('')).toBe('');
  });
});
```

### Integration Tests (Puppeteer)
```javascript
// Test extension in real browser
test('Coming soon scanner detects images', async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [`--load-extension=${extensionPath}`]
  });

  // Test automation
  const page = await browser.newPage();
  await page.goto('https://example.com/srp');
  await page.click('#scanComingSoonBtn');
  // ... assertions
});
```

## Test Results Documentation

Document test results in a format like:

```markdown
# Test Run: 2024-01-15

## Environment
- Chrome: 120.0.6099.109
- Extension: v3.7
- Tester: [Name]

## Results Summary
- Total Features Tested: 7
- Pass: 6
- Fail: 1
- Blocked: 0

## Failed Tests
1. Feature 001: OCR API timeout on large images
   - Issue: API timeout after 30s
   - Action: Add retry logic

## Performance Metrics
- Feature 001: 45s for 50 images (average)
- Feature 002: 12s for 50 images
- Feature 003: 8s for 100 CSV rows

## Notes
[Any additional observations]
```
