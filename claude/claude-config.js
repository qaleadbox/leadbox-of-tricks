/**
 * @fileoverview Configuration management for Claude API integration
 * @module claude/claude-config
 *
 * Handles storage and retrieval of Claude API configuration including
 * API keys, model preferences, and feature-specific settings.
 */

const STORAGE_KEYS = {
  API_KEY: 'claudeApiKey',
  MODEL: 'claudeModel',
  ENABLED_FEATURES: 'claudeEnabledFeatures',
  IMAGE_ANALYSIS_ENABLED: 'claudeImageAnalysisEnabled',
  DATA_VALIDATION_ENABLED: 'claudeDataValidationEnabled',
  FIELD_MAPPING_ENABLED: 'claudeFieldMappingEnabled',
  DEBUG_ASSISTANT_ENABLED: 'claudeDebugAssistantEnabled',
  LAST_USED: 'claudeLastUsed',
  USAGE_COUNT: 'claudeUsageCount'
};

const DEFAULT_CONFIG = {
  model: 'claude-3-5-sonnet-20241022',
  enabledFeatures: {
    imageAnalysis: true,
    dataValidation: true,
    fieldMapping: true,
    debugAssistant: true
  },
  temperature: 1.0,
  maxTokens: 4096
};

/**
 * Claude configuration manager
 */
export class ClaudeConfig {
  /**
   * Save Claude API key
   * @param {string} apiKey - Claude API key
   * @returns {Promise<void>}
   */
  static async saveApiKey(apiKey) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.API_KEY]: apiKey,
      [STORAGE_KEYS.LAST_USED]: Date.now()
    });
  }

  /**
   * Get Claude API key
   * @returns {Promise<string|null>} API key or null if not set
   */
  static async getApiKey() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    return result[STORAGE_KEYS.API_KEY] || null;
  }

  /**
   * Remove Claude API key
   * @returns {Promise<void>}
   */
  static async removeApiKey() {
    await chrome.storage.local.remove(STORAGE_KEYS.API_KEY);
  }

  /**
   * Check if API key is configured
   * @returns {Promise<boolean>} True if API key exists
   */
  static async hasApiKey() {
    const apiKey = await this.getApiKey();
    return !!apiKey;
  }

  /**
   * Save model preference
   * @param {string} model - Model identifier
   * @returns {Promise<void>}
   */
  static async saveModel(model) {
    await chrome.storage.local.set({ [STORAGE_KEYS.MODEL]: model });
  }

  /**
   * Get model preference
   * @returns {Promise<string>} Model identifier
   */
  static async getModel() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.MODEL);
    return result[STORAGE_KEYS.MODEL] || DEFAULT_CONFIG.model;
  }

  /**
   * Enable or disable a specific feature
   * @param {string} featureName - Feature name (imageAnalysis, dataValidation, etc.)
   * @param {boolean} enabled - Enable or disable
   * @returns {Promise<void>}
   */
  static async setFeatureEnabled(featureName, enabled) {
    const features = await this.getEnabledFeatures();
    features[featureName] = enabled;
    await chrome.storage.local.set({ [STORAGE_KEYS.ENABLED_FEATURES]: features });
  }

  /**
   * Get enabled features
   * @returns {Promise<Object>} Object with feature enable/disable flags
   */
  static async getEnabledFeatures() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ENABLED_FEATURES);
    return result[STORAGE_KEYS.ENABLED_FEATURES] || DEFAULT_CONFIG.enabledFeatures;
  }

  /**
   * Check if a specific feature is enabled
   * @param {string} featureName - Feature name
   * @returns {Promise<boolean>} True if feature is enabled
   */
  static async isFeatureEnabled(featureName) {
    const features = await this.getEnabledFeatures();
    return features[featureName] !== false;
  }

  /**
   * Get full configuration
   * @returns {Promise<Object>} Complete configuration object
   */
  static async getConfig() {
    const [apiKey, model, enabledFeatures] = await Promise.all([
      this.getApiKey(),
      this.getModel(),
      this.getEnabledFeatures()
    ]);

    return {
      apiKey,
      model,
      enabledFeatures,
      ...DEFAULT_CONFIG
    };
  }

  /**
   * Increment usage count
   * @returns {Promise<number>} New usage count
   */
  static async incrementUsage() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE_COUNT);
    const count = (result[STORAGE_KEYS.USAGE_COUNT] || 0) + 1;

    await chrome.storage.local.set({
      [STORAGE_KEYS.USAGE_COUNT]: count,
      [STORAGE_KEYS.LAST_USED]: Date.now()
    });

    return count;
  }

  /**
   * Get usage statistics
   * @returns {Promise<Object>} Usage stats
   */
  static async getUsageStats() {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.USAGE_COUNT,
      STORAGE_KEYS.LAST_USED
    ]);

    return {
      count: result[STORAGE_KEYS.USAGE_COUNT] || 0,
      lastUsed: result[STORAGE_KEYS.LAST_USED] || null
    };
  }

  /**
   * Reset all configuration
   * @returns {Promise<void>}
   */
  static async reset() {
    await chrome.storage.local.remove([
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.MODEL,
      STORAGE_KEYS.ENABLED_FEATURES,
      STORAGE_KEYS.LAST_USED,
      STORAGE_KEYS.USAGE_COUNT
    ]);
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key to validate
   * @returns {boolean} True if format is valid
   */
  static validateApiKeyFormat(apiKey) {
    // Claude API keys start with 'sk-ant-' and are followed by additional characters
    return typeof apiKey === 'string' &&
           apiKey.startsWith('sk-ant-') &&
           apiKey.length > 20;
  }

  /**
   * Test API key by making a minimal request
   * @param {string} apiKey - API key to test
   * @returns {Promise<boolean>} True if API key is valid
   */
  static async testApiKey(apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }

  /**
   * Export configuration (excluding API key for security)
   * @returns {Promise<Object>} Exportable configuration
   */
  static async exportConfig() {
    const config = await this.getConfig();
    return {
      model: config.model,
      enabledFeatures: config.enabledFeatures,
      hasApiKey: !!config.apiKey
    };
  }

  /**
   * Import configuration
   * @param {Object} config - Configuration to import
   * @returns {Promise<void>}
   */
  static async importConfig(config) {
    if (config.model) {
      await this.saveModel(config.model);
    }
    if (config.enabledFeatures) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.ENABLED_FEATURES]: config.enabledFeatures
      });
    }
  }
}

/**
 * Storage keys export for reference
 */
export { STORAGE_KEYS, DEFAULT_CONFIG };
