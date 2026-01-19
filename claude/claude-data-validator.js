/**
 * @fileoverview Intelligent data validation using Claude
 * @module claude/claude-data-validator
 *
 * Provides AI-powered data validation and matching between CSV data
 * and SRP cards with natural language explanations.
 */

import { getSharedClient } from './claude-client.js';
import { ClaudeConfig } from './claude-config.js';

/**
 * Data validator using Claude
 */
export class ClaudeDataValidator {
  constructor() {
    this.client = getSharedClient();
  }

  /**
   * Check if Claude data validation is available
   * @returns {Promise<boolean>} True if configured and enabled
   */
  async isAvailable() {
    const [hasKey, isEnabled] = await Promise.all([
      ClaudeConfig.hasApiKey(),
      ClaudeConfig.isFeatureEnabled('dataValidation')
    ]);
    return hasKey && isEnabled;
  }

  /**
   * Validate and match CSV row against SRP card data
   * @param {Object} csvRow - CSV data row
   * @param {Object} cardData - SRP card data
   * @returns {Promise<Object>} Validation result with explanations
   */
  async validateMatch(csvRow, cardData) {
    const prompt = `You are a vehicle inventory data validator. Compare these two vehicle records and determine if they represent the same vehicle.

CSV Record:
${JSON.stringify(csvRow, null, 2)}

SRP Card Data:
${JSON.stringify(cardData, null, 2)}

Analyze the following:
1. Stock number match
2. VIN match (if available)
3. Make/Model/Year match
4. Price comparison (note if different)
5. Any other discrepancies

Respond with JSON:
{
  "isMatch": true|false,
  "confidence": 0-100,
  "matchedFields": ["field1", "field2"],
  "mismatchedFields": ["field1", "field2"],
  "issues": [
    {"field": "fieldName", "csv": "csvValue", "card": "cardValue", "severity": "high|medium|low", "explanation": "why this matters"}
  ],
  "summary": "Brief explanation of the match result"
}`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.3,
        maxTokens: 1500
      });

      const result = JSON.parse(response.trim());
      await ClaudeConfig.incrementUsage();

      return {
        ...result,
        method: 'claude-ai',
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Claude data validation failed:', error);
      return {
        isMatch: null,
        confidence: 0,
        error: error.message,
        method: 'claude-ai'
      };
    }
  }

  /**
   * Validate entire CSV dataset against SRP cards
   * @param {Array<Object>} csvData - Array of CSV rows
   * @param {Array<Object>} cardData - Array of SRP card data
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Complete validation report
   */
  async validateDataset(csvData, cardData, options = {}) {
    const { onProgress = null } = options;

    const matches = [];
    const mismatches = [];
    const csvOnly = [];
    const cardOnly = [];

    // Create lookup maps
    const csvMap = new Map(csvData.map(row => [this.getStockNumber(row), row]));
    const cardMap = new Map(cardData.map(card => [this.getStockNumber(card), card]));

    const allStockNumbers = new Set([...csvMap.keys(), ...cardMap.keys()]);
    const total = allStockNumbers.size;
    let processed = 0;

    for (const stockNumber of allStockNumbers) {
      const csvRow = csvMap.get(stockNumber);
      const card = cardMap.get(stockNumber);

      if (csvRow && card) {
        // Both exist - validate match
        const validation = await this.validateMatch(csvRow, card);

        if (validation.isMatch) {
          matches.push({
            stockNumber,
            csvRow,
            card,
            validation
          });
        } else {
          mismatches.push({
            stockNumber,
            csvRow,
            card,
            validation
          });
        }

      } else if (csvRow) {
        // Only in CSV
        csvOnly.push({
          stockNumber,
          csvRow,
          reason: 'Not found on SRP page'
        });

      } else if (card) {
        // Only in SRP
        cardOnly.push({
          stockNumber,
          card,
          reason: 'Not found in CSV data'
        });
      }

      processed++;
      if (onProgress) {
        onProgress(processed, total);
      }
    }

    // Generate summary with Claude
    const summary = await this.generateSummary({
      matches: matches.length,
      mismatches: mismatches.length,
      csvOnly: csvOnly.length,
      cardOnly: cardOnly.length,
      totalCsv: csvData.length,
      totalCards: cardData.length
    });

    return {
      matches,
      mismatches,
      csvOnly,
      cardOnly,
      summary,
      stats: {
        totalCsv: csvData.length,
        totalCards: cardData.length,
        matchCount: matches.length,
        mismatchCount: mismatches.length,
        csvOnlyCount: csvOnly.length,
        cardOnlyCount: cardOnly.length,
        matchRate: (matches.length / Math.max(csvData.length, cardData.length)) * 100
      },
      timestamp: Date.now(),
      method: 'claude-ai'
    };
  }

  /**
   * Generate natural language summary of validation results
   * @private
   * @param {Object} stats - Validation statistics
   * @returns {Promise<string>} Summary text
   */
  async generateSummary(stats) {
    const prompt = `Generate a brief, clear summary of this vehicle inventory data validation:

Statistics:
- Total matches: ${stats.matches}
- Mismatches: ${stats.mismatches}
- Only in CSV: ${stats.csvOnly}
- Only on SRP: ${stats.cardOnly}
- Total CSV records: ${stats.totalCsv}
- Total SRP cards: ${stats.totalCards}

Write 2-3 sentences highlighting the key findings and any concerns.`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.7,
        maxTokens: 200
      });
      return response.trim();
    } catch (error) {
      console.error('Summary generation failed:', error);
      return `Found ${stats.matches} matches, ${stats.mismatches} mismatches, ${stats.csvOnly} CSV-only records, and ${stats.cardOnly} SRP-only cards.`;
    }
  }

  /**
   * Suggest field mappings based on CSV headers
   * @param {Array<string>} headers - CSV column headers
   * @param {Object} sampleRow - Sample CSV row
   * @returns {Promise<Object>} Suggested field mappings
   */
  async suggestFieldMappings(headers, sampleRow) {
    const prompt = `Analyze these CSV column headers and sample data from a vehicle inventory file. Suggest the correct field mapping to standard vehicle data fields.

Headers: ${JSON.stringify(headers)}
Sample Row: ${JSON.stringify(sampleRow)}

Standard Fields:
- stockNumber
- vin
- year
- make
- model
- trim
- price
- mileage / kilometers
- bodyType
- transmission
- fuelType
- exteriorColor
- interiorColor
- imageUrl

Respond with JSON:
{
  "mappings": {
    "csvHeader": "standardField"
  },
  "confidence": {
    "csvHeader": 0-100
  },
  "notes": "Any observations or warnings"
}`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });

      const result = JSON.parse(response.trim());
      return {
        ...result,
        method: 'claude-ai'
      };

    } catch (error) {
      console.error('Field mapping suggestion failed:', error);
      return {
        mappings: {},
        confidence: {},
        notes: `Error: ${error.message}`,
        method: 'claude-ai'
      };
    }
  }

  /**
   * Explain data discrepancy in natural language
   * @param {Object} issue - Issue object from validation
   * @returns {Promise<string>} Human-readable explanation
   */
  async explainDiscrepancy(issue) {
    const prompt = `Explain this vehicle inventory data discrepancy in simple terms:

Field: ${issue.field}
CSV Value: ${issue.csv}
SRP Card Value: ${issue.card}
Severity: ${issue.severity}

Write 1-2 sentences explaining what this means and why it matters.`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.7,
        maxTokens: 150
      });
      return response.trim();
    } catch (error) {
      console.error('Explanation generation failed:', error);
      return `Mismatch in ${issue.field}: CSV shows "${issue.csv}" but SRP shows "${issue.card}".`;
    }
  }

  /**
   * Extract stock number from data object
   * @private
   * @param {Object} data - Data object
   * @returns {string} Stock number or null
   */
  getStockNumber(data) {
    const stockFields = ['stockNumber', 'stock', 'stockNum', 'STOCKNUMBER', 'Stock Number', 'Stock'];
    for (const field of stockFields) {
      if (data[field]) {
        return String(data[field]).trim();
      }
    }
    return null;
  }
}

/**
 * Shared instance
 */
let sharedValidator = null;

/**
 * Get shared data validator instance
 * @returns {ClaudeDataValidator} Shared instance
 */
export function getSharedValidator() {
  if (!sharedValidator) {
    sharedValidator = new ClaudeDataValidator();
  }
  return sharedValidator;
}
