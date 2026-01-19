# Claude Integration - Quick Start Guide

This document provides a quick overview of the Claude AI integration added to LeadBox of Tricks extension (v3.8).

## What Was Added

### 1. Claude AI Module (`/claude/`)
Complete Claude API integration with 4 AI-powered features:
- **Image Analyzer**: AI vision for detecting placeholder images and quality assessment
- **Data Validator**: Intelligent CSV matching with natural language explanations
- **Field Mapper**: Automatic field detection and mapping suggestions
- **Debug Assistant**: Error analysis and troubleshooting recommendations

### 2. Development Commands (`/commands/`)
Preprompts for Claude Code CLI to help with development:
- `debug-extension.md` - Chrome extension debugging guide
- `add-feature.md` - Feature addition workflow
- `fix-bug.md` - Bug fixing methodology
- `optimize-performance.md` - Performance optimization strategies
- `refactor-module.md` - Code refactoring best practices
- `test-feature.md` - Comprehensive testing checklist
- `update-docs.md` - Documentation maintenance guide

### 3. Updated Files
- `manifest.json` - Added Claude API permissions and web accessible resources (v3.8)
- `README.md` - Added Feature 008 documentation and updated file tree
- Added comprehensive module documentation in `/claude/README.md`

## Quick Start for Developers

### Using Claude in the Extension

```javascript
// Import Claude modules
import { initializeClaude, isClaudeReady } from './claude/index.js';
import { getSharedAnalyzer } from './claude/claude-image-analyzer.js';
import { getSharedValidator } from './claude/claude-data-validator.js';

// Initialize (in popup or background)
const apiKey = 'sk-ant-your-api-key';
await initializeClaude(apiKey);

// Use image analysis
if (await isClaudeReady()) {
  const analyzer = getSharedAnalyzer();
  const result = await analyzer.detectComingSoon(imageUrl);
  console.log(result.isComingSoon ? 'Placeholder detected' : 'Real image');
}

// Use data validation
const validator = getSharedValidator();
const validation = await validator.validateMatch(csvRow, cardData);
console.log(validation.summary);
```

### Using Commands with Claude Code CLI

```bash
# Reference preprompts when using Claude Code CLI
claude "I need to debug why images aren't loading @commands/debug-extension.md"
claude "Add a new feature for duplicate detection @commands/add-feature.md"
claude "Optimize the CSV matching performance @commands/optimize-performance.md"
```

## Architecture

### Module Structure
```
/claude/
├── index.js                    # Main entry point, exports all modules
├── claude-client.js            # Core API client (handles requests, rate limiting)
├── claude-config.js            # Configuration and storage management
├── claude-image-analyzer.js    # Image analysis with Claude Vision
├── claude-data-validator.js    # Data validation and matching
├── claude-field-mapper.js      # Field mapping and detection
├── claude-debug-assistant.js   # Error analysis and debugging
└── README.md                   # Detailed documentation
```

### Key Design Patterns

#### Singleton Pattern
Each feature module has a shared instance:
```javascript
const analyzer = getSharedAnalyzer();  // Returns same instance
const validator = getSharedValidator();
const mapper = getSharedMapper();
const assistant = getSharedAssistant();
```

#### Feature Toggle
All features can be enabled/disabled:
```javascript
await ClaudeConfig.setFeatureEnabled('imageAnalysis', true);
await ClaudeConfig.setFeatureEnabled('dataValidation', false);
```

#### Graceful Degradation
All features include fallback mechanisms:
```javascript
// If Claude fails, falls back to heuristic methods
const result = await mapper.autoDetectMappings(headers, sampleRows);
// Returns either AI-powered or heuristic mapping
```

## Integration Points

### 1. Coming Soon Image Detection
Augment existing OCR/OpenAI detection with Claude Vision:
```javascript
// In coming-soon/coming-soon-checker.js
import { getSharedAnalyzer } from '../claude/claude-image-analyzer.js';

const analyzer = getSharedAnalyzer();
if (await analyzer.isAvailable()) {
  const result = await analyzer.detectComingSoon(imageUrl);
  // Use result alongside OCR/OpenAI
}
```

### 2. CSV Data Validation
Add AI-powered validation to existing CSV matcher:
```javascript
// In srp-csv/csv-srp-data-matcher.js
import { getSharedValidator } from '../claude/claude-data-validator.js';

const validator = getSharedValidator();
const report = await validator.validateDataset(csvData, cardData, {
  onProgress: (current, total) => updateProgress(current, total)
});
console.log(report.summary);  // Natural language summary
```

### 3. Field Mapping
Auto-detect CSV column mappings:
```javascript
// In storage/field-map-storage.js or popup
import { getSharedMapper } from '../claude/claude-field-mapper.js';

const mapper = getSharedMapper();
const result = await mapper.autoDetectMappings(csvHeaders, sampleRows);
// Suggest mappings to user
```

### 4. Error Handling
Catch and analyze errors throughout the extension:
```javascript
// In any module
import { getSharedAssistant } from '../claude/claude-debug-assistant.js';

try {
  // Some operation
} catch (error) {
  const assistant = getSharedAssistant();
  const analysis = await assistant.analyzeError(error, {
    feature: 'CSV validation',
    context: 'Additional context'
  });

  // Show analysis.steps to user
  console.log('Root cause:', analysis.rootCause);
  analysis.steps.forEach(step => {
    console.log(`${step.step}. ${step.action}`);
  });
}
```

## Configuration Flow

### User Setup
1. User installs extension
2. User gets Claude API key from https://console.anthropic.com/
3. User enters API key in popup (to be implemented in popup UI)
4. Extension validates and saves key
5. User selects which features to enable

### Storage Schema
```javascript
chrome.storage.local = {
  // Claude configuration
  claudeApiKey: 'sk-ant-...',
  claudeModel: 'claude-3-5-sonnet-20241022',
  claudeEnabledFeatures: {
    imageAnalysis: true,
    dataValidation: true,
    fieldMapping: true,
    debugAssistant: true
  },
  claudeUsageCount: 42,
  claudeLastUsed: 1234567890000
}
```

## Next Steps for Full Integration

### Popup UI Updates (To Be Implemented)
Add to `/popup/popup.html` and `/popup/popup.js`:
```html
<section id="claude-config">
  <h3>Claude AI Configuration</h3>
  <input type="password" id="claudeApiKey" placeholder="sk-ant-...">
  <button id="saveClaudeKey">Save & Test</button>
  <div id="claudeStatus"></div>

  <h4>Enable Features</h4>
  <label><input type="checkbox" id="enableImageAnalysis"> Enhanced Image Analysis</label>
  <label><input type="checkbox" id="enableDataValidation"> Smart Data Validation</label>
  <label><input type="checkbox" id="enableFieldMapping"> Auto Field Mapping</label>
  <label><input type="checkbox" id="enableDebugAssistant"> Debug Assistant</label>
</section>
```

### Feature Integration Examples

#### Enhance Coming Soon Checker
```javascript
// In coming-soon/coming-soon-checker.js
async function checkImages(images) {
  const analyzer = getSharedAnalyzer();

  if (await analyzer.isAvailable()) {
    // Use Claude Vision
    const results = await analyzer.batchAnalyze(images, {
      concurrency: 3,
      onProgress: updateProgress
    });
    return results;
  } else {
    // Fallback to OCR/OpenAI
    return await checkWithOCR(images);
  }
}
```

#### Enhance CSV Matcher
```javascript
// In srp-csv/csv-srp-data-matcher.js
async function matchData(csvData, cardData) {
  const validator = getSharedValidator();

  if (await validator.isAvailable()) {
    // Use Claude AI validation
    const report = await validator.validateDataset(csvData, cardData);

    // Show natural language summary
    showSummary(report.summary);

    // Highlight issues with explanations
    report.mismatches.forEach(mismatch => {
      highlightCard(mismatch.card);
      showExplanation(mismatch.validation.summary);
    });

    return report;
  } else {
    // Fallback to basic matching
    return await basicMatch(csvData, cardData);
  }
}
```

## Testing the Integration

### Manual Testing
1. Load extension in Chrome
2. Get Claude API key from https://console.anthropic.com/
3. Open popup and enter API key
4. Test each feature:
   - Run image scan on SRP page
   - Validate CSV data
   - Check field mapping suggestions
   - Trigger an error and check debug assistant

### Chrome Console Testing
```javascript
// In extension console
import { initializeClaude, getClaudeStatus } from './claude/index.js';

// Initialize
await initializeClaude('sk-ant-your-key');

// Check status
const status = await getClaudeStatus();
console.log(status);

// Test image analysis
import { getSharedAnalyzer } from './claude/claude-image-analyzer.js';
const analyzer = getSharedAnalyzer();
const result = await analyzer.detectComingSoon('https://example.com/image.jpg');
console.log(result);
```

## Cost Considerations

Typical API costs:
- Image analysis: ~$0.01-$0.02 per image
- Data validation: ~$0.001-$0.005 per comparison
- Field mapping: ~$0.01-$0.03 per dataset
- Debug analysis: ~$0.01-$0.05 per error

For a typical use case:
- Scanning 50 images: ~$0.50-$1.00
- Validating 100 vehicles: ~$0.10-$0.50
- One field mapping: ~$0.01-$0.03

Monitor usage:
```javascript
const stats = await ClaudeConfig.getUsageStats();
console.log(`Total API calls: ${stats.count}`);
```

## Security Notes

- API keys stored in `chrome.storage.local` (not synced)
- Keys never exposed to content scripts or web pages
- All API calls go directly from extension to Claude API
- No data logged or stored except standard Anthropic API logs

## Troubleshooting

### API Key Issues
```javascript
// Check if key is configured
const hasKey = await ClaudeConfig.hasApiKey();

// Validate key format
const isValidFormat = ClaudeConfig.validateApiKeyFormat(apiKey);

// Test key actually works
const works = await ClaudeConfig.testApiKey(apiKey);
```

### Feature Not Working
```javascript
// Check if feature is enabled
const isEnabled = await ClaudeConfig.isFeatureEnabled('imageAnalysis');

// Check if Claude is ready
const ready = await isClaudeReady();

// Check for errors
try {
  const result = await analyzer.detectComingSoon(url);
} catch (error) {
  console.error('Feature failed:', error);
}
```

## Resources

- **Claude API Docs**: https://docs.anthropic.com/
- **Get API Key**: https://console.anthropic.com/
- **Module Documentation**: `/claude/README.md`
- **Command Guides**: `/commands/README.md`
- **Support**: https://support.anthropic.com/

## Contributing

When adding new Claude features:
1. Follow existing module patterns (singleton, shared instances)
2. Include error handling and fallbacks
3. Add feature toggle support
4. Update documentation
5. Test API cost impact
6. Add usage examples

## Summary

The Claude integration provides powerful AI capabilities to the extension:
- Makes image detection more accurate
- Provides intelligent data validation with explanations
- Automates field mapping
- Assists with debugging

All features are optional, have fallbacks, and can be toggled on/off. The integration is designed to enhance existing features without breaking backward compatibility.
