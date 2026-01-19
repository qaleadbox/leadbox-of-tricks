# Update Documentation

You are updating documentation for the LeadBox of Tricks Chrome Extension.

## Documentation Files

### Primary Documentation
- **README.md**: Main user-facing documentation
- **docs/UML.md**: Architecture diagrams
- **docs/SEQUENCE DIAGRAM.md**: Flow diagrams
- **manifest.json**: Extension metadata and version
- **version.js**: Build version info

### Code Documentation
- Inline comments in JavaScript files
- JSDoc comments for functions
- Module-level descriptions

## When to Update Docs

### Always Update For:
- [ ] New features added
- [ ] Feature behavior changed
- [ ] Bugs fixed that affect user behavior
- [ ] Installation steps changed
- [ ] New requirements added
- [ ] API changes (OCR, OpenAI, Claude)
- [ ] Configuration options added
- [ ] Version bumps

### Consider Updating For:
- [ ] Performance improvements (if significant)
- [ ] Refactoring (if it changes architecture)
- [ ] Internal code changes (update diagrams)
- [ ] Bug fixes (update Known Issues)
- [ ] New edge cases discovered

## README.md Update Checklist

### Feature Addition
```markdown
## Feature00X: [Feature Name]
[Brief description]

1. Navigate to [target page]
2. Click "[Button Name]" button
3. [Additional steps...]
4. [Expected result]

[Any special notes or prerequisites]
```

Add to:
- [ ] Key Features section (brief bullet)
- [ ] How to use section (detailed steps)
- [ ] File Tree section (if new files)
- [ ] Version History section
- [ ] Development tracking table (update status)

### Version History Format
```markdown
- vX.Y: [Brief description of main change]
```

### Known Issues
When documenting known issues:
```markdown
| Severity | Description |
|----------|-------------|
| HIGH/MEDIUM/LOW | [Clear description of the issue] |
```

**Severity Guidelines**:
- **HIGH**: Breaks core functionality, data loss, security issues
- **MEDIUM**: Feature partially works, workarounds available, UX issues
- **LOW**: Minor issues, cosmetic problems, edge cases

### Suggestions Section
When adding suggestions:
```markdown
* [Clear, actionable suggestion]
* [Include context if needed]
```

## Architecture Documentation

### UML.md Updates

Update when:
- New modules added
- Module relationships change
- Class structure changes
- Data flow changes

Should include:
- Class diagrams
- Module dependency diagrams
- Data structure diagrams
- Component relationships

### SEQUENCE DIAGRAM.md Updates

Update when:
- Feature flow changes
- Message passing changes
- API interaction changes
- User interaction flow changes

Should include:
- User → Popup → Background → Content Script flows
- API call sequences
- Storage operation sequences
- Error handling flows

## Code Documentation Standards

### File Headers
```javascript
/**
 * @fileoverview [Brief description of file purpose]
 * @module [module-name]
 *
 * [Detailed description if needed]
 *
 * @example
 * // Usage example
 * import { myFunction } from './my-module.js';
 * myFunction(params);
 */
```

### Function Documentation
```javascript
/**
 * [Brief one-line description]
 *
 * [Detailed description if complex]
 *
 * @param {Type} paramName - Description
 * @param {Type} [optionalParam] - Description (optional)
 * @returns {Type} Description of return value
 * @throws {Error} When [condition]
 *
 * @example
 * // Example usage
 * const result = myFunction('value');
 */
function myFunction(paramName, optionalParam) {
  // Implementation
}
```

### Complex Logic Comments
```javascript
// Why: Explain WHY this code exists, not WHAT it does
// The code itself should explain WHAT it does

// BAD: Increment counter
counter++;

// GOOD: Track number of retries for exponential backoff
retryCount++;

// GOOD: Workaround for Chrome bug #123456 where service workers
// can be terminated during long-running operations
keepAlive();
```

### TODO Comments
```javascript
// TODO(username): [Description of what needs to be done]
// TODO(robinson): Implement caching for repeated API calls

// FIXME(username): [Description of bug that needs fixing]
// FIXME(agustin): Race condition when popup closes during scan

// HACK(username): [Temporary solution that should be improved]
// HACK(estevan): Using setTimeout to wait for DOM load, should use MutationObserver
```

## Version Management

### Semantic Versioning
Follow SemVer: MAJOR.MINOR.PATCH

- **MAJOR**: Breaking changes, major rewrites
  - Example: 3.0 → 4.0
- **MINOR**: New features, non-breaking changes
  - Example: 3.7 → 3.8
- **PATCH**: Bug fixes, small improvements
  - Example: 3.7.0 → 3.7.1

### Version Update Checklist
1. [ ] Update `manifest.json` version field
2. [ ] Update `version.js` if it exists
3. [ ] Add entry to README.md Version History
4. [ ] Update changelog if maintained separately
5. [ ] Tag commit with version (git tag v3.7)
6. [ ] Create GitHub release with notes

## Documentation Review Checklist

### Before Publishing
- [ ] Check spelling and grammar
- [ ] Verify all links work
- [ ] Test all code examples
- [ ] Ensure formatting is correct (Markdown)
- [ ] Screenshots are up-to-date
- [ ] Version numbers are consistent
- [ ] Installation steps tested
- [ ] Feature steps tested

### Quality Checks
- [ ] Is it clear for new users?
- [ ] Are prerequisites mentioned?
- [ ] Are error messages explained?
- [ ] Are troubleshooting steps helpful?
- [ ] Is technical jargon explained?
- [ ] Are examples provided?

## Documentation Templates

### New Feature Documentation
```markdown
## Feature00X: [Feature Name]

### Purpose
[Why this feature exists, what problem it solves]

### How It Works
[Technical overview if helpful]

### Usage
1. [Step-by-step instructions]
2. [Include screenshots if helpful]
3. [Expected results]

### Prerequisites
- [Any requirements]
- [API keys, permissions, etc.]

### Troubleshooting
**Issue**: [Common problem]
**Solution**: [How to fix]

### Technical Details
- File: `path/to/file.js`
- Storage: `chrome.storage.local.keyName`
- Permissions: `activeTab`, `storage`
```

### Bug Fix Documentation
```markdown
## Bug Fix: [Brief description]

**Issue**: [What was broken]
**Fix**: [What was changed]
**Affected Features**: [Which features were impacted]
**Version**: v3.X

### For Users
[What users need to know, if anything]

### For Developers
[Technical details of the fix]
```

## API Documentation

### When Adding External API Integration
Document:
- API name and version
- Authentication method
- Rate limits
- Error codes and handling
- Fallback behavior
- Cost implications
- Example requests/responses

Example:
```markdown
### Claude API Integration

**Version**: 2024-01-01
**Authentication**: API key in header `x-api-key`
**Rate Limits**: 1000 requests/day (free tier)
**Timeout**: 30 seconds
**Cost**: $0.01 per 1K tokens

**Error Handling**:
- 429: Rate limit exceeded → Show user message, retry with backoff
- 401: Invalid API key → Prompt user to re-enter key
- 500: Server error → Fallback to alternative method

**Storage**:
- API key: `chrome.storage.local.claudeApiKey`
- Last used: `chrome.storage.local.claudeLastUsed`
```

## Maintenance Schedule

### Monthly
- [ ] Review and update Known Issues
- [ ] Check for outdated screenshots
- [ ] Verify all URLs still work
- [ ] Update browser compatibility info

### Quarterly
- [ ] Review all documentation for accuracy
- [ ] Update architecture diagrams
- [ ] Clean up completed TODOs
- [ ] Archive old version history

### Per Release
- [ ] Update README.md
- [ ] Update version numbers
- [ ] Update changelog
- [ ] Create release notes

## Documentation Best Practices

### Writing Style
- Use clear, simple language
- Write in present tense
- Use active voice
- Be concise but complete
- Include examples
- Use consistent terminology

### Formatting
- Use headings hierarchically
- Use code blocks for code
- Use tables for comparisons
- Use lists for steps/items
- Use bold for emphasis (sparingly)
- Use screenshots for complex UI

### Accessibility
- Add alt text to images
- Use descriptive link text
- Structure headings properly
- Keep line length reasonable
- Use sufficient color contrast in diagrams
