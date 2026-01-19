/**
 * @fileoverview Claude API client for LeadBox of Tricks extension
 * @module claude/claude-client
 *
 * Provides a unified interface for interacting with Anthropic's Claude API.
 * Handles authentication, rate limiting, error handling, and response parsing.
 */

const CLAUDE_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const CLAUDE_API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 4096;
const REQUEST_TIMEOUT = 60000; // 60 seconds

/**
 * Claude API client
 */
export class ClaudeClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  /**
   * Set or update the API key
   * @param {string} apiKey - Claude API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Check if API key is configured
   * @returns {boolean} True if API key is set
   */
  hasApiKey() {
    return !!this.apiKey;
  }

  /**
   * Rate limiting: Ensure minimum time between requests
   * @private
   */
  async rateLimit() {
    const MIN_REQUEST_INTERVAL = 100; // 100ms between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Send a message to Claude API
   * @param {Array<Object>} messages - Array of message objects with role and content
   * @param {Object} options - Additional options
   * @param {string} options.model - Model to use (default: claude-3-5-sonnet-20241022)
   * @param {number} options.maxTokens - Maximum tokens in response
   * @param {number} options.temperature - Temperature for response (0-1)
   * @param {string} options.system - System prompt
   * @returns {Promise<Object>} API response
   * @throws {Error} If API key is not set or request fails
   */
  async sendMessage(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    await this.rateLimit();

    const {
      model = DEFAULT_MODEL,
      maxTokens = MAX_TOKENS,
      temperature = 1.0,
      system = null
    } = options;

    const payload = {
      model,
      max_tokens: maxTokens,
      messages,
      temperature
    };

    if (system) {
      payload.system = system;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(CLAUDE_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CLAUDE_API_VERSION
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Claude API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Claude API request timeout');
      }
      throw error;
    }
  }

  /**
   * Send a simple text prompt to Claude
   * @param {string} prompt - Text prompt
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Claude's response text
   */
  async prompt(prompt, options = {}) {
    const messages = [
      { role: 'user', content: prompt }
    ];

    const response = await this.sendMessage(messages, options);
    return this.extractTextFromResponse(response);
  }

  /**
   * Analyze an image with Claude Vision
   * @param {string} imageData - Base64 encoded image or image URL
   * @param {string} prompt - Analysis prompt
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Claude's analysis
   */
  async analyzeImage(imageData, prompt, options = {}) {
    // Determine if imageData is base64 or URL
    const isBase64 = imageData.startsWith('data:image') || !imageData.startsWith('http');

    let imageContent;
    if (isBase64) {
      // Extract media type and base64 data
      const match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const [, mediaType, base64Data] = match;
        imageContent = {
          type: 'image',
          source: {
            type: 'base64',
            media_type: `image/${mediaType}`,
            data: base64Data
          }
        };
      } else {
        // Assume it's already base64 without data URI prefix
        imageContent = {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imageData
          }
        };
      }
    } else {
      // URL
      imageContent = {
        type: 'image',
        source: {
          type: 'url',
          url: imageData
        }
      };
    }

    const messages = [
      {
        role: 'user',
        content: [
          imageContent,
          { type: 'text', text: prompt }
        ]
      }
    ];

    const response = await this.sendMessage(messages, options);
    return this.extractTextFromResponse(response);
  }

  /**
   * Batch process multiple items with Claude
   * @param {Array<string>} items - Array of items to process
   * @param {Function} promptGenerator - Function that takes an item and returns a prompt
   * @param {Object} options - Additional options
   * @param {number} options.concurrency - Number of parallel requests (default: 3)
   * @returns {Promise<Array<string>>} Array of responses
   */
  async batchProcess(items, promptGenerator, options = {}) {
    const { concurrency = 3, ...apiOptions } = options;
    const results = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const promises = batch.map(item =>
        this.prompt(promptGenerator(item), apiOptions)
          .catch(error => ({ error: error.message }))
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Extract text content from Claude API response
   * @private
   * @param {Object} response - API response
   * @returns {string} Extracted text
   */
  extractTextFromResponse(response) {
    if (!response.content || !Array.isArray(response.content)) {
      throw new Error('Invalid response format from Claude API');
    }

    const textBlocks = response.content.filter(block => block.type === 'text');
    return textBlocks.map(block => block.text).join('\n');
  }

  /**
   * Get usage statistics
   * @returns {Object} Usage stats
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * Reset usage statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
}

/**
 * Shared singleton instance
 */
let sharedInstance = null;

/**
 * Get shared Claude client instance
 * @returns {ClaudeClient} Shared instance
 */
export function getSharedClient() {
  if (!sharedInstance) {
    sharedInstance = new ClaudeClient();
  }
  return sharedInstance;
}

/**
 * Initialize shared client with API key
 * @param {string} apiKey - Claude API key
 */
export function initializeClient(apiKey) {
  const client = getSharedClient();
  client.setApiKey(apiKey);
  return client;
}
