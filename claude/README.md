# Claude AI Integration

This module integrates Anthropic's Claude AI into the LeadBox of Tricks extension, providing intelligent features for image analysis, data validation, field mapping, and debugging assistance.

## Features

### 1. Enhanced Image Analysis (`claude-image-analyzer.js`)
AI-powered image analysis using Claude Vision to:
- Detect "coming soon" placeholder images
- Assess image quality for vehicle listings
- Verify images show actual vehicles
- Provide detailed analysis reports

### 2. Data Validation Assistant (`claude-data-validator.js`)
Intelligent CSV data validation with:
- Smart matching between CSV and SRP card data
- Natural language explanations of discrepancies
- Field mapping suggestions
- Comprehensive validation reports

### 3. Smart Field Mapping (`claude-field-mapper.js`)
Automatic field detection and mapping:
- Auto-detect CSV column meanings
- Suggest standard field mappings
- Validate data completeness
- Export/import mapping configurations

### 4. Debug Assistant (`claude-debug-assistant.js`)
AI-powered debugging help:
- Error analysis and root cause identification
- Troubleshooting step generation
- Code explanation and fix suggestions
- Performance analysis
- Error pattern detection

## Setup

### 1. Get Claude API Key
1. Sign up at https://console.anthropic.com/
2. Create an API key
3. Copy the key (starts with `sk-ant-`)

### 2. Configure in Extension
```javascript
import { initializeClaude } from './claude/index.js';

// Initialize with your API key
const success = await initializeClaude('sk-ant-your-api-key-here');

if (success) {
  console.log('Claude initialized successfully');
} else {
  console.error('Failed to initialize Claude');
}
```

### 3. Check Configuration
```javascript
import { isClaudeReady, getClaudeStatus } from './claude/index.js';

// Quick check
if (await isClaudeReady()) {
  console.log('Claude is ready to use');
}

// Detailed status
const status = await getClaudeStatus();
console.log(status);
```

## Usage Examples

### Image Analysis

```javascript
import { getSharedAnalyzer } from './claude/claude-image-analyzer.js';

const analyzer = getSharedAnalyzer();

// Check if image is "coming soon"
const result = await analyzer.detectComingSoon('https://example.com/vehicle.jpg');
if (result.isComingSoon) {
  console.log('Placeholder image detected');
}

// Comprehensive analysis
const analysis = await analyzer.analyzeImage('https://example.com/vehicle.jpg', {
  checkComingSoon: true,
  checkQuality: true,
  checkVehicle: true
});

console.log(analysis);

// Batch analysis
const imageUrls = ['url1.jpg', 'url2.jpg', 'url3.jpg'];
const results = await analyzer.batchAnalyze(imageUrls, {
  concurrency: 3,
  onProgress: (current, total, result) => {
    console.log(`Analyzed ${current}/${total}`);
  }
});
```

### Data Validation

```javascript
import { getSharedValidator } from './claude/claude-data-validator.js';

const validator = getSharedValidator();

// Validate single match
const csvRow = { stockNumber: '12345', make: 'Toyota', model: 'Camry' };
const cardData = { stock: '12345', make: 'Toyota', model: 'Camry' };

const validation = await validator.validateMatch(csvRow, cardData);

if (validation.isMatch) {
  console.log('Match confirmed:', validation.summary);
} else {
  console.log('Mismatch detected:', validation.issues);
}

// Validate entire dataset
const report = await validator.validateDataset(csvData, cardData, {
  onProgress: (current, total) => {
    console.log(`Validated ${current}/${total}`);
  }
});

console.log(`Match rate: ${report.stats.matchRate}%`);
console.log(report.summary);
```

### Field Mapping

```javascript
import { getSharedMapper } from './claude/claude-field-mapper.js';

const mapper = getSharedMapper();

// Auto-detect mappings
const headers = ['Stock #', 'Year', 'Make', 'Model', 'Price'];
const sampleRows = [
  { 'Stock #': '12345', 'Year': '2023', 'Make': 'Toyota', 'Model': 'Camry', 'Price': '$25000' }
];

const result = await mapper.autoDetectMappings(headers, sampleRows);

console.log('Detected mappings:', result.mappings);
console.log('Confidence:', result.confidence);
console.log('Unmapped fields:', result.unmapped);

// Check for missing required fields
const missing = mapper.getMissingRequiredFields(result.mappings);
if (missing.length > 0) {
  console.log('Missing required fields:', missing);
}

// Export mappings
const exported = mapper.exportMappings(result.mappings, {
  source: 'my-dealer-site.com'
});
```

### Debug Assistant

```javascript
import { getSharedAssistant } from './claude/claude-debug-assistant.js';

const assistant = getSharedAssistant();

// Analyze an error
try {
  // Some code that might fail
  throw new Error('Cannot read property of undefined');
} catch (error) {
  const analysis = await assistant.analyzeError(error, {
    feature: 'CSV validation',
    action: 'parsing data',
    page: 'https://example.com/srp'
  });

  console.log('Root cause:', analysis.rootCause);
  console.log('Severity:', analysis.severity);
  console.log('Steps to fix:');
  analysis.steps.forEach(step => {
    console.log(`${step.step}. ${step.action}`);
    console.log(`   ${step.explanation}`);
  });

  if (analysis.codeExample) {
    console.log('Code example:', analysis.codeExample);
  }
}

// Get troubleshooting steps
const steps = await assistant.getTroubleshootingSteps(
  'Images not loading on SRP page',
  { url: 'https://example.com/srp', browser: 'Chrome 120' }
);

steps.forEach(step => console.log(step));

// Suggest a fix
const fix = await assistant.suggestFix(
  'TypeError: Cannot read property src of null',
  `const imgSrc = card.querySelector('img').src;`
);

console.log('Fixed code:', fix.fixedCode);
console.log('Explanation:', fix.explanation);
```

## Configuration Management

### Feature Toggle

```javascript
import { ClaudeConfig } from './claude/claude-config.js';

// Enable/disable specific features
await ClaudeConfig.setFeatureEnabled('imageAnalysis', true);
await ClaudeConfig.setFeatureEnabled('dataValidation', false);

// Check if feature is enabled
if (await ClaudeConfig.isFeatureEnabled('imageAnalysis')) {
  // Use image analysis
}

// Get all enabled features
const features = await ClaudeConfig.getEnabledFeatures();
console.log(features);
```

### Model Selection

```javascript
// Set preferred model
await ClaudeConfig.saveModel('claude-3-5-sonnet-20241022');

// Get current model
const model = await ClaudeConfig.getModel();
```

### Usage Tracking

```javascript
// Get usage statistics
const stats = await ClaudeConfig.getUsageStats();
console.log(`Total requests: ${stats.count}`);
console.log(`Last used: ${new Date(stats.lastUsed)}`);
```

### Export/Import Configuration

```javascript
// Export configuration (API key is excluded for security)
const config = await ClaudeConfig.exportConfig();
console.log(JSON.stringify(config, null, 2));

// Import configuration
await ClaudeConfig.importConfig({
  model: 'claude-3-5-sonnet-20241022',
  enabledFeatures: {
    imageAnalysis: true,
    dataValidation: true,
    fieldMapping: false,
    debugAssistant: true
  }
});
```

## Error Handling

All Claude modules include comprehensive error handling and fallback mechanisms:

```javascript
// Image analyzer falls back to URL if base64 conversion fails
// Data validator provides basic analysis if Claude is unavailable
// Field mapper uses heuristic matching as fallback
// Debug assistant provides generic steps if Claude fails
```

Example with error handling:

```javascript
const analyzer = getSharedAnalyzer();

try {
  const result = await analyzer.detectComingSoon(imageUrl);

  if (result.error) {
    console.error('Analysis failed:', result.error);
    // Use fallback method (OCR, OpenAI, etc.)
  } else {
    // Use Claude results
    console.log(result);
  }
} catch (error) {
  console.error('Critical error:', error);
  // Handle critical failure
}
```

## Best Practices

### 1. Rate Limiting
The Claude client includes automatic rate limiting (100ms between requests). For high-volume operations, use batch processing:

```javascript
const results = await analyzer.batchAnalyze(urls, {
  concurrency: 3  // Process 3 images at a time
});
```

### 2. Caching
Cache Claude responses when appropriate to reduce API calls:

```javascript
const cache = new Map();

async function getCachedAnalysis(imageUrl) {
  if (cache.has(imageUrl)) {
    return cache.get(imageUrl);
  }

  const result = await analyzer.detectComingSoon(imageUrl);
  cache.set(imageUrl, result);
  return result;
}
```

### 3. Error Recovery
Always provide fallback mechanisms:

```javascript
let result;
if (await analyzer.isAvailable()) {
  result = await analyzer.detectComingSoon(imageUrl);
} else {
  // Fallback to OCR or OpenAI
  result = await ocrChecker.check(imageUrl);
}
```

### 4. User Feedback
Show progress for long-running operations:

```javascript
await analyzer.batchAnalyze(urls, {
  onProgress: (current, total, result) => {
    updateProgressBar(current / total * 100);
    console.log(`Processed ${current}/${total}`);
  }
});
```

## API Costs

Claude API pricing (as of 2024):
- Input: $3 per million tokens
- Output: $15 per million tokens

Typical costs per operation:
- Image analysis: ~$0.01 - $0.02 per image
- Data validation: ~$0.001 - $0.005 per comparison
- Field mapping: ~$0.01 - $0.03 per dataset
- Debug analysis: ~$0.01 - $0.05 per error

Monitor usage with:
```javascript
const stats = await ClaudeConfig.getUsageStats();
console.log(`Total API calls: ${stats.count}`);
```

## Security

### API Key Storage
API keys are stored securely in `chrome.storage.local` and never exposed to content scripts or external pages.

### Validation
All API keys are validated before use:
```javascript
const isValid = ClaudeConfig.validateApiKeyFormat(apiKey);
const works = await ClaudeConfig.testApiKey(apiKey);
```

### Data Privacy
- No user data is sent to Claude without explicit action
- API calls are made directly from the extension
- No data is logged or stored by Anthropic beyond standard API logs

## Troubleshooting

### API Key Issues
```javascript
// Test API key
if (!await ClaudeConfig.hasApiKey()) {
  console.error('API key not configured');
}

if (!ClaudeConfig.validateApiKeyFormat(apiKey)) {
  console.error('Invalid API key format');
}

if (!await ClaudeConfig.testApiKey(apiKey)) {
  console.error('API key not working');
}
```

### Rate Limiting
If you hit rate limits, reduce concurrency:
```javascript
await analyzer.batchAnalyze(urls, {
  concurrency: 1  // Process one at a time
});
```

### Timeout Issues
Increase timeout for large operations:
```javascript
const client = getSharedClient();
// Default timeout is 60 seconds
// Adjust in claude-client.js if needed
```

## Support

For issues related to:
- **Extension**: Create issue in GitHub repo
- **Claude API**: Contact Anthropic support at https://support.anthropic.com/
- **API Key**: Get help at https://console.anthropic.com/

## License

Part of LeadBox of Tricks Chrome Extension.
