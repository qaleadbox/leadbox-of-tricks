/**
 * @fileoverview Enhanced image analysis using Claude Vision
 * @module claude/claude-image-analyzer
 *
 * Provides advanced image analysis capabilities for detecting:
 * - "Coming soon" placeholder images
 * - Image quality issues
 * - Inappropriate or missing images
 * - Vehicle image content verification
 */

import { getSharedClient } from './claude-client.js';
import { ClaudeConfig } from './claude-config.js';

/**
 * Image analysis prompts
 */
const PROMPTS = {
  COMING_SOON: `Analyze this vehicle inventory image and determine if it's a "coming soon" placeholder or temporary image.

Look for:
- "Coming Soon" text
- "Image Coming Soon" text
- Generic placeholder graphics
- Gray/blank placeholder images
- Stock placeholder images
- Any text indicating the image is temporary

Respond with only "YES" if this is a placeholder/coming soon image, or "NO" if it's a real vehicle image.`,

  IMAGE_QUALITY: `Analyze this vehicle inventory image and assess its quality for an e-commerce listing.

Evaluate:
- Image resolution and clarity
- Proper lighting
- Whether the vehicle is clearly visible
- Professional presentation
- Any quality issues

Respond with a JSON object:
{
  "quality": "excellent|good|fair|poor",
  "issues": ["list", "of", "issues"],
  "suitable": true|false
}`,

  VEHICLE_VERIFICATION: `Analyze this image and verify it shows a vehicle suitable for an automotive inventory listing.

Check if the image:
- Shows an actual vehicle
- Is appropriate for a dealer inventory
- Matches automotive sales context
- Is not a placeholder or error image

Respond with JSON:
{
  "isVehicle": true|false,
  "vehicleType": "car|truck|suv|motorcycle|other|none",
  "confidence": 0-100,
  "issues": ["list"]
}`
};

/**
 * Image analyzer using Claude Vision
 */
export class ClaudeImageAnalyzer {
  constructor() {
    this.client = getSharedClient();
  }

  /**
   * Check if Claude image analysis is available
   * @returns {Promise<boolean>} True if configured and enabled
   */
  async isAvailable() {
    const [hasKey, isEnabled] = await Promise.all([
      ClaudeConfig.hasApiKey(),
      ClaudeConfig.isFeatureEnabled('imageAnalysis')
    ]);
    return hasKey && isEnabled;
  }

  /**
   * Detect if image is a "coming soon" placeholder
   * @param {string} imageUrl - Image URL or base64 data
   * @returns {Promise<Object>} Analysis result
   */
  async detectComingSoon(imageUrl) {
    try {
      const imageData = await this.prepareImage(imageUrl);
      const response = await this.client.analyzeImage(
        imageData,
        PROMPTS.COMING_SOON,
        { temperature: 0.3, maxTokens: 10 }
      );

      const isComingSoon = response.trim().toUpperCase().includes('YES');

      return {
        isComingSoon,
        confidence: isComingSoon ? 0.9 : 0.9,
        method: 'claude-vision',
        raw: response.trim()
      };

    } catch (error) {
      console.error('Claude coming soon detection failed:', error);
      return {
        isComingSoon: false,
        confidence: 0,
        error: error.message,
        method: 'claude-vision'
      };
    }
  }

  /**
   * Assess image quality
   * @param {string} imageUrl - Image URL or base64 data
   * @returns {Promise<Object>} Quality assessment
   */
  async assessQuality(imageUrl) {
    try {
      const imageData = await this.prepareImage(imageUrl);
      const response = await this.client.analyzeImage(
        imageData,
        PROMPTS.IMAGE_QUALITY,
        { temperature: 0.5, maxTokens: 500 }
      );

      const parsed = JSON.parse(response.trim());

      return {
        quality: parsed.quality,
        issues: parsed.issues || [],
        suitable: parsed.suitable,
        method: 'claude-vision'
      };

    } catch (error) {
      console.error('Claude quality assessment failed:', error);
      return {
        quality: 'unknown',
        issues: [error.message],
        suitable: null,
        error: error.message,
        method: 'claude-vision'
      };
    }
  }

  /**
   * Verify image shows a vehicle
   * @param {string} imageUrl - Image URL or base64 data
   * @returns {Promise<Object>} Verification result
   */
  async verifyVehicle(imageUrl) {
    try {
      const imageData = await this.prepareImage(imageUrl);
      const response = await this.client.analyzeImage(
        imageData,
        PROMPTS.VEHICLE_VERIFICATION,
        { temperature: 0.3, maxTokens: 300 }
      );

      const parsed = JSON.parse(response.trim());

      return {
        isVehicle: parsed.isVehicle,
        vehicleType: parsed.vehicleType,
        confidence: parsed.confidence,
        issues: parsed.issues || [],
        method: 'claude-vision'
      };

    } catch (error) {
      console.error('Claude vehicle verification failed:', error);
      return {
        isVehicle: null,
        vehicleType: 'unknown',
        confidence: 0,
        issues: [error.message],
        error: error.message,
        method: 'claude-vision'
      };
    }
  }

  /**
   * Comprehensive image analysis
   * @param {string} imageUrl - Image URL or base64 data
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Complete analysis
   */
  async analyzeImage(imageUrl, options = {}) {
    const {
      checkComingSoon = true,
      checkQuality = true,
      checkVehicle = true
    } = options;

    const results = {
      imageUrl,
      timestamp: Date.now(),
      method: 'claude-vision'
    };

    try {
      if (checkComingSoon) {
        results.comingSoon = await this.detectComingSoon(imageUrl);
      }

      if (checkVehicle) {
        results.vehicle = await this.verifyVehicle(imageUrl);
      }

      if (checkQuality) {
        results.quality = await this.assessQuality(imageUrl);
      }

      return results;

    } catch (error) {
      console.error('Comprehensive image analysis failed:', error);
      return {
        ...results,
        error: error.message
      };
    }
  }

  /**
   * Batch analyze multiple images
   * @param {Array<string>} imageUrls - Array of image URLs
   * @param {Object} options - Analysis options
   * @returns {Promise<Array<Object>>} Array of analysis results
   */
  async batchAnalyze(imageUrls, options = {}) {
    const { concurrency = 3, onProgress = null } = options;
    const results = [];

    for (let i = 0; i < imageUrls.length; i += concurrency) {
      const batch = imageUrls.slice(i, i + concurrency);
      const promises = batch.map(async (url, batchIndex) => {
        const result = await this.analyzeImage(url, options).catch(error => ({
          imageUrl: url,
          error: error.message
        }));

        if (onProgress) {
          onProgress(i + batchIndex + 1, imageUrls.length, result);
        }

        return result;
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Prepare image for analysis (convert URL to base64 if needed)
   * @private
   * @param {string} imageUrl - Image URL or base64 data
   * @returns {Promise<string>} Prepared image data
   */
  async prepareImage(imageUrl) {
    // If already base64, return as is
    if (imageUrl.startsWith('data:image')) {
      return imageUrl;
    }

    // For HTTP URLs, Claude can handle them directly
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    // If it's a relative URL or needs conversion, fetch and convert
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return await this.blobToBase64(blob);
    } catch (error) {
      console.error('Failed to prepare image:', error);
      // Return URL as fallback
      return imageUrl;
    }
  }

  /**
   * Convert blob to base64
   * @private
   * @param {Blob} blob - Image blob
   * @returns {Promise<string>} Base64 encoded image
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

/**
 * Shared instance
 */
let sharedAnalyzer = null;

/**
 * Get shared image analyzer instance
 * @returns {ClaudeImageAnalyzer} Shared instance
 */
export function getSharedAnalyzer() {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new ClaudeImageAnalyzer();
  }
  return sharedAnalyzer;
}
