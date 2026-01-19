# Optimize Performance

You are optimizing performance for the LeadBox of Tricks Chrome Extension.

## Performance Goals
- Fast page load and script injection
- Smooth scrolling and pagination
- Quick DOM queries and manipulation
- Efficient memory usage
- Responsive popup UI

## Common Performance Bottlenecks

### 1. DOM Operations
**Problem**: Frequent DOM queries and manipulations slow down the page

**Solutions**:
- Cache DOM query results instead of repeated queries
- Use document fragments for batch DOM insertion
- Minimize reflows by batching style changes
- Use `requestAnimationFrame` for visual updates
- Prefer `querySelectorAll` once over multiple `querySelector` calls

### 2. Data Processing
**Problem**: Large datasets cause UI freezing

**Solutions**:
- Process data in chunks with `setTimeout` or `requestIdleCallback`
- Use Web Workers for heavy computation
- Implement virtual scrolling for large lists
- Stream data processing instead of loading all at once
- Use efficient data structures (Map/Set over arrays for lookups)

### 3. API Calls
**Problem**: Multiple sequential API calls slow down features

**Solutions**:
- Batch API requests when possible
- Implement caching for repeated requests
- Use Promise.all() for parallel requests
- Add request debouncing for user inputs
- Implement progressive loading (show partial results)

### 4. Storage Operations
**Problem**: Frequent chrome.storage calls cause delays

**Solutions**:
- Batch storage writes
- Cache frequently accessed data in memory
- Use storage.local (faster than storage.sync)
- Minimize data size stored
- Clean up old/unused data

### 5. Content Script Loading
**Problem**: Heavy content scripts slow down page load

**Solutions**:
- Lazy load features only when needed
- Split large scripts into smaller modules
- Use dynamic imports for optional features
- Minimize code in content_scripts array
- Inject scripts only when user activates feature

## Optimization Checklist

### Code Level
- [ ] Remove console.log from production code (or use debug mode)
- [ ] Eliminate duplicate code and unused functions
- [ ] Use const/let appropriately (const is slightly faster)
- [ ] Avoid creating unnecessary closures in loops
- [ ] Use efficient array methods (map, filter, reduce)
- [ ] Cache regex patterns
- [ ] Use template literals efficiently

### DOM Operations
- [ ] Cache frequently accessed DOM elements
- [ ] Minimize layout thrashing (read then write, don't interleave)
- [ ] Use CSS classes instead of inline styles
- [ ] Debounce scroll/resize handlers
- [ ] Use event delegation instead of multiple listeners
- [ ] Clean up event listeners when done

### Memory Management
- [ ] Remove event listeners when no longer needed
- [ ] Clear large data structures when done
- [ ] Avoid memory leaks in long-running operations
- [ ] Use WeakMap/WeakSet for object references
- [ ] Profile memory usage with Chrome DevTools

### Network/API
- [ ] Implement request caching
- [ ] Add retry logic with exponential backoff
- [ ] Cancel pending requests when no longer needed
- [ ] Use compression for large payloads
- [ ] Minimize data transferred

### Service Worker
- [ ] Keep service worker scripts minimal
- [ ] Implement efficient message routing
- [ ] Clean up resources when idle
- [ ] Use alarms API for scheduled tasks
- [ ] Handle service worker termination gracefully

## Performance Testing

### Measure First
1. Use Chrome DevTools Performance tab
2. Record CPU and memory profiles
3. Measure Time to Interactive (TTI)
4. Check frame rates during animations
5. Monitor network waterfall

### Key Metrics
- Script injection time: < 100ms
- DOM query time: < 10ms
- Feature execution time: < 2s for most operations
- Memory usage: < 50MB for typical use
- No jank during scrolling (60fps)

### Test Scenarios
- Large SRP pages (100+ vehicle cards)
- Slow network conditions
- Multiple features running simultaneously
- Multiple tabs with extension active
- Long-running operations (CSV validation)

## Specific Optimizations for This Extension

### Auto-Scroll Feature
```javascript
// Bad: Synchronous scroll
window.scrollTo(0, document.body.scrollHeight);

// Good: Smooth async scroll with batching
async function smoothScroll() {
  return new Promise(resolve => {
    const scrollHeight = document.documentElement.scrollHeight;
    const step = scrollHeight / 10;
    let current = 0;

    const scroll = () => {
      current += step;
      window.scrollTo(0, current);
      if (current < scrollHeight) {
        requestAnimationFrame(scroll);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(scroll);
  });
}
```

### Image Processing
```javascript
// Bad: Process all images at once
images.forEach(async img => await analyzeImage(img));

// Good: Process in batches with concurrency limit
async function processBatch(items, batchSize = 5) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(item => analyzeImage(item)));
  }
}
```

### CSV Data Matching
```javascript
// Bad: Nested loops O(n²)
csvData.forEach(row => {
  cards.forEach(card => {
    if (row.stock === card.stock) { /* ... */ }
  });
});

// Good: Use Map for O(n) lookup
const stockMap = new Map(csvData.map(row => [row.stock, row]));
cards.forEach(card => {
  const match = stockMap.get(card.stock);
  if (match) { /* ... */ }
});
```

## After Optimization
- [ ] Verify functionality still works correctly
- [ ] Measure improvement (before/after metrics)
- [ ] Test on slow devices/networks
- [ ] Check for regressions in other features
- [ ] Document optimization in code comments
