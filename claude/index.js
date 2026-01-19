/**
 * @fileoverview Claude AI Integration for LeadBox of Tricks
 * @module claude
 *
 * Main entry point for Claude AI features including:
 * - Enhanced image analysis
 * - Intelligent data validation
 * - Smart field mapping
 * - Debugging assistance
 */

// Core client and configuration
export { ClaudeClient, getSharedClient, initializeClient } from './claude-client.js';
export { ClaudeConfig, STORAGE_KEYS, DEFAULT_CONFIG } from './claude-config.js';

// Feature modules
export { ClaudeImageAnalyzer, getSharedAnalyzer } from './claude-image-analyzer.js';
export { ClaudeDataValidator, getSharedValidator } from './claude-data-validator.js';
export { ClaudeFieldMapper, getSharedMapper, STANDARD_FIELDS } from './claude-field-mapper.js';
export { ClaudeDebugAssistant, getSharedAssistant } from './claude-debug-assistant.js';

/**
 * Initialize Claude integration with API key
 * @param {string} apiKey - Claude API key
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initializeClaude(apiKey) {
  try {
    // Validate API key format
    if (!ClaudeConfig.validateApiKeyFormat(apiKey)) {
      throw new Error('Invalid API key format');
    }

    // Test API key
    const isValid = await ClaudeConfig.testApiKey(apiKey);
    if (!isValid) {
      throw new Error('API key validation failed');
    }

    // Save API key
    await ClaudeConfig.saveApiKey(apiKey);

    // Initialize shared client
    initializeClient(apiKey);

    return true;

  } catch (error) {
    console.error('Claude initialization failed:', error);
    return false;
  }
}

/**
 * Check if Claude is configured and ready to use
 * @returns {Promise<boolean>} True if Claude is ready
 */
export async function isClaudeReady() {
  const hasKey = await ClaudeConfig.hasApiKey();
  if (!hasKey) return false;

  const client = getSharedClient();
  const apiKey = await ClaudeConfig.getApiKey();
  client.setApiKey(apiKey);

  return true;
}

/**
 * Get Claude status and configuration
 * @returns {Promise<Object>} Status information
 */
export async function getClaudeStatus() {
  const [hasKey, config, stats] = await Promise.all([
    ClaudeConfig.hasApiKey(),
    ClaudeConfig.getConfig(),
    ClaudeConfig.getUsageStats()
  ]);

  const client = getSharedClient();
  const clientStats = client.getStats();

  return {
    configured: hasKey,
    model: config.model,
    enabledFeatures: config.enabledFeatures,
    usage: {
      totalRequests: stats.count,
      lastUsed: stats.lastUsed,
      sessionRequests: clientStats.requestCount
    }
  };
}

/**
 * Quick setup helper - prompts for API key and configures Claude
 * @returns {Promise<Object>} Setup result
 */
export async function quickSetup() {
  const hasKey = await ClaudeConfig.hasApiKey();

  if (hasKey) {
    const apiKey = await ClaudeConfig.getApiKey();
    const client = getSharedClient();
    client.setApiKey(apiKey);

    return {
      success: true,
      message: 'Claude already configured',
      needsKey: false
    };
  }

  return {
    success: false,
    message: 'API key required',
    needsKey: true
  };
}
