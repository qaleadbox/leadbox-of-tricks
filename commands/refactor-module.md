# Refactor Module

You are refactoring code in the LeadBox of Tricks Chrome Extension to improve maintainability and code quality.

## Refactoring Principles

### Code Quality Goals
- **Readability**: Code should be self-documenting
- **Maintainability**: Easy to modify and extend
- **Testability**: Functions should be pure and isolated
- **Modularity**: Clear separation of concerns
- **DRY**: Don't Repeat Yourself
- **KISS**: Keep It Simple, Stupid

## When to Refactor

### Red Flags
- [ ] Functions longer than 50 lines
- [ ] Deeply nested conditionals (>3 levels)
- [ ] Duplicate code in multiple places
- [ ] Unclear variable/function names
- [ ] Mixed concerns in single function
- [ ] Hard-coded values scattered throughout
- [ ] Complex boolean logic
- [ ] God objects/functions doing too much

### Good Reasons to Refactor
- Adding similar feature (extract common logic first)
- Bug found in duplicated code
- Difficulty understanding code intent
- Hard to test in isolation
- Performance improvements needed
- Security concerns

### Bad Reasons to Refactor
- "Just because" without clear improvement
- Making code "clever" or over-engineered
- Personal style preferences
- Before understanding the code fully

## Refactoring Checklist

### Before Refactoring
1. [ ] Understand the current code completely
2. [ ] Read any related documentation
3. [ ] Check if tests exist
4. [ ] Create test cases if none exist
5. [ ] Ensure code works currently
6. [ ] Commit current working state
7. [ ] Note any known issues

### During Refactoring
1. [ ] Make small, incremental changes
2. [ ] Test after each change
3. [ ] Commit frequently with descriptive messages
4. [ ] Keep functionality identical (unless fixing bugs)
5. [ ] Update comments and documentation
6. [ ] Check performance impact

### After Refactoring
1. [ ] Verify all features still work
2. [ ] Test edge cases
3. [ ] Check performance metrics
4. [ ] Update documentation
5. [ ] Review code with fresh eyes
6. [ ] Get peer review if available

## Common Refactoring Patterns

### 1. Extract Function
**Before**:
```javascript
function processCards() {
  // 100 lines of mixed logic
  const cards = document.querySelectorAll('.vehicle-card');
  cards.forEach(card => {
    const price = card.querySelector('.price').textContent;
    const cleanPrice = price.replace(/[^0-9.]/g, '');
    // ... more processing
  });
}
```

**After**:
```javascript
function processCards() {
  const cards = getVehicleCards();
  cards.forEach(card => processCard(card));
}

function getVehicleCards() {
  return Array.from(document.querySelectorAll('.vehicle-card'));
}

function processCard(card) {
  const price = extractPrice(card);
  // ... more processing
}

function extractPrice(card) {
  const priceText = card.querySelector('.price')?.textContent || '';
  return priceText.replace(/[^0-9.]/g, '');
}
```

### 2. Replace Magic Numbers/Strings
**Before**:
```javascript
if (imageSize < 10240) { /* too small */ }
if (status === 'coming-soon') { /* ... */ }
```

**After**:
```javascript
const MIN_IMAGE_SIZE_BYTES = 10 * 1024; // 10KB
const STATUS_COMING_SOON = 'coming-soon';

if (imageSize < MIN_IMAGE_SIZE_BYTES) { /* too small */ }
if (status === STATUS_COMING_SOON) { /* ... */ }
```

### 3. Simplify Conditionals
**Before**:
```javascript
if (card.hasAttribute('data-stock') && card.getAttribute('data-stock') !== '' && card.getAttribute('data-stock') !== 'undefined') {
  const stock = card.getAttribute('data-stock');
  // ...
}
```

**After**:
```javascript
const stock = card.getAttribute('data-stock');
if (stock && stock !== 'undefined') {
  // ...
}
```

### 4. Use Object Destructuring
**Before**:
```javascript
function updateCard(data) {
  const stock = data.stock;
  const price = data.price;
  const model = data.model;
  // ...
}
```

**After**:
```javascript
function updateCard({ stock, price, model }) {
  // ...
}
```

### 5. Replace Nested Conditionals
**Before**:
```javascript
if (card) {
  if (card.image) {
    if (card.image.src) {
      return card.image.src;
    }
  }
}
return null;
```

**After**:
```javascript
return card?.image?.src || null;
```

### 6. Extract Configuration
**Before**:
```javascript
// Scattered throughout code
const selectors = {
  card: '.vehicle-card',
  stock: '.stock-number',
  price: '.price'
};
```

**After**:
```javascript
// In separate config file
export const DEFAULT_SELECTORS = {
  card: '.vehicle-card',
  stock: '.stock-number',
  price: '.price',
  image: '.vehicle-image img',
  model: '.vehicle-model'
};
```

## Extension-Specific Refactorings

### Module Organization
```
Good structure:
/my-feature/
  ├── index.js          # Main entry point
  ├── config.js         # Configuration constants
  ├── selectors.js      # DOM selectors
  ├── api.js            # API calls
  ├── storage.js        # Storage operations
  └── utils.js          # Helper functions
```

### Message Passing Patterns
```javascript
// Create typed message creators
export const Messages = {
  startImageScan: (tabId) => ({
    action: 'startImageScan',
    tabId,
    timestamp: Date.now()
  }),

  imageScanned: (result) => ({
    action: 'imageScanned',
    result,
    timestamp: Date.now()
  })
};

// Use in code
chrome.runtime.sendMessage(Messages.startImageScan(tabId));
```

### Storage Abstractions
```javascript
// Create storage layer
export class FeatureStorage {
  constructor(storageKey) {
    this.key = storageKey;
  }

  async load() {
    const result = await chrome.storage.local.get(this.key);
    return result[this.key] || this.getDefaults();
  }

  async save(data) {
    await chrome.storage.local.set({ [this.key]: data });
  }

  getDefaults() {
    return {};
  }
}
```

## Refactoring Priorities

### High Priority
1. Security vulnerabilities
2. Performance bottlenecks
3. Duplicated bug-prone code
4. Hard-to-understand critical code
5. Code blocking new features

### Medium Priority
1. Long functions (>50 lines)
2. Deep nesting (>3 levels)
3. Non-DRY code
4. Poor naming
5. Missing error handling

### Low Priority
1. Style inconsistencies
2. Minor optimizations
3. Comment improvements
4. Variable naming preferences

## Testing Refactored Code

### Manual Tests
- [ ] Test main feature flow
- [ ] Test error cases
- [ ] Test edge cases
- [ ] Test on multiple sites
- [ ] Test with different configurations
- [ ] Test popup interactions
- [ ] Test storage persistence

### Regression Tests
- [ ] Verify other features still work
- [ ] Check for console errors
- [ ] Test service worker stability
- [ ] Verify message passing works
- [ ] Check storage operations
- [ ] Test API integrations

## Documentation Updates

After refactoring, update:
- [ ] Inline code comments
- [ ] Function/module documentation
- [ ] README.md if architecture changed
- [ ] UML diagrams if structure changed
- [ ] Sequence diagrams if flow changed
- [ ] Known issues list if fixed
