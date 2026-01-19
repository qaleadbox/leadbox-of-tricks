/**
 * @fileoverview Smart field mapping using Claude
 * @module claude/claude-field-mapper
 *
 * Automatically detects and suggests field mappings for vehicle data
 * using Claude's understanding of data structures and naming conventions.
 */

import { getSharedClient } from './claude-client.js';
import { ClaudeConfig } from './claude-config.js';

/**
 * Standard vehicle data fields
 */
export const STANDARD_FIELDS = {
  // Identifiers
  stockNumber: { required: true, aliases: ['stock', 'stockNum', 'stock_number'] },
  vin: { required: false, aliases: ['vinNumber', 'vin_number', 'chassis'] },

  // Vehicle basics
  year: { required: true, aliases: ['model_year', 'yr'] },
  make: { required: true, aliases: ['manufacturer', 'brand'] },
  model: { required: true, aliases: ['model_name'] },
  trim: { required: false, aliases: ['trim_level', 'style'] },

  // Pricing
  price: { required: true, aliases: ['sale_price', 'asking_price', 'msrp', 'cost'] },
  originalPrice: { required: false, aliases: ['was_price', 'list_price'] },

  // Specifications
  mileage: { required: false, aliases: ['miles', 'odometer', 'kilometers', 'km'] },
  bodyType: { required: false, aliases: ['body_style', 'type', 'body'] },
  transmission: { required: false, aliases: ['trans', 'transmission_type'] },
  fuelType: { required: false, aliases: ['fuel', 'engine_type'] },
  drivetrain: { required: false, aliases: ['drive_type', 'drive_train'] },
  engineSize: { required: false, aliases: ['engine', 'displacement'] },

  // Appearance
  exteriorColor: { required: false, aliases: ['ext_color', 'color', 'paint'] },
  interiorColor: { required: false, aliases: ['int_color', 'interior'] },

  // Media
  imageUrl: { required: false, aliases: ['image', 'photo', 'picture_url', 'img'] },

  // Status
  status: { required: false, aliases: ['availability', 'stock_status'] },
  condition: { required: false, aliases: ['vehicle_condition', 'state'] }
};

/**
 * Field mapper using Claude
 */
export class ClaudeFieldMapper {
  constructor() {
    this.client = getSharedClient();
  }

  /**
   * Check if Claude field mapping is available
   * @returns {Promise<boolean>} True if configured and enabled
   */
  async isAvailable() {
    const [hasKey, isEnabled] = await Promise.all([
      ClaudeConfig.hasApiKey(),
      ClaudeConfig.isFeatureEnabled('fieldMapping')
    ]);
    return hasKey && isEnabled;
  }

  /**
   * Auto-detect field mappings from CSV headers and sample data
   * @param {Array<string>} headers - CSV column headers
   * @param {Array<Object>} sampleRows - Sample CSV rows (3-5 recommended)
   * @returns {Promise<Object>} Detected field mappings
   */
  async autoDetectMappings(headers, sampleRows = []) {
    const prompt = this.buildMappingPrompt(headers, sampleRows);

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.2,
        maxTokens: 2000
      });

      const result = JSON.parse(response.trim());
      await ClaudeConfig.incrementUsage();

      // Validate and enhance the result
      const validated = this.validateMappings(result.mappings, headers);

      return {
        mappings: validated.mappings,
        confidence: result.confidence || {},
        unmapped: validated.unmapped,
        notes: result.notes || '',
        suggestions: result.suggestions || [],
        method: 'claude-ai',
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Claude field mapping failed:', error);
      // Fallback to basic heuristic mapping
      return this.fallbackMapping(headers);
    }
  }

  /**
   * Build prompt for field mapping
   * @private
   */
  buildMappingPrompt(headers, sampleRows) {
    const standardFieldsList = Object.entries(STANDARD_FIELDS)
      .map(([field, info]) => {
        const aliases = info.aliases ? ` (aliases: ${info.aliases.join(', ')})` : '';
        const required = info.required ? ' [REQUIRED]' : '';
        return `  - ${field}${aliases}${required}`;
      })
      .join('\n');

    return `Analyze these CSV headers and sample data from a vehicle inventory file. Map each CSV column to the appropriate standard field.

CSV Headers:
${JSON.stringify(headers)}

Sample Rows:
${JSON.stringify(sampleRows.slice(0, 3), null, 2)}

Standard Fields:
${standardFieldsList}

Instructions:
1. Match each CSV header to the most appropriate standard field
2. Consider column names, data patterns, and sample values
3. If a CSV column doesn't match any standard field, omit it from mappings
4. Provide confidence score (0-100) for each mapping
5. Note any ambiguities or concerns

Respond with JSON:
{
  "mappings": {
    "CSV_Header_Name": "standardFieldName"
  },
  "confidence": {
    "CSV_Header_Name": 0-100
  },
  "notes": "Overall observations",
  "suggestions": [
    "Any recommendations or warnings"
  ]
}`;
  }

  /**
   * Validate and clean up mappings
   * @private
   */
  validateMappings(mappings, headers) {
    const validMappings = {};
    const unmapped = [];

    // Ensure all mapped fields are valid standard fields
    for (const [csvHeader, standardField] of Object.entries(mappings)) {
      if (STANDARD_FIELDS[standardField]) {
        validMappings[csvHeader] = standardField;
      }
    }

    // Find unmapped headers
    for (const header of headers) {
      if (!validMappings[header]) {
        unmapped.push(header);
      }
    }

    return { mappings: validMappings, unmapped };
  }

  /**
   * Fallback heuristic mapping when Claude is unavailable
   * @private
   */
  fallbackMapping(headers) {
    const mappings = {};
    const confidence = {};
    const unmapped = [];

    for (const header of headers) {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      let matched = false;

      // Try to match against standard fields and aliases
      for (const [standardField, info] of Object.entries(STANDARD_FIELDS)) {
        const patterns = [
          standardField.toLowerCase(),
          ...info.aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''))
        ];

        if (patterns.some(pattern => normalized.includes(pattern) || pattern.includes(normalized))) {
          mappings[header] = standardField;
          confidence[header] = 70;
          matched = true;
          break;
        }
      }

      if (!matched) {
        unmapped.push(header);
      }
    }

    return {
      mappings,
      confidence,
      unmapped,
      notes: 'Fallback heuristic mapping (Claude unavailable)',
      suggestions: ['Consider manually reviewing these mappings'],
      method: 'heuristic',
      timestamp: Date.now()
    };
  }

  /**
   * Suggest missing required fields
   * @param {Object} mappings - Current field mappings
   * @returns {Array<string>} Missing required field names
   */
  getMissingRequiredFields(mappings) {
    const mappedStandardFields = new Set(Object.values(mappings));
    const missing = [];

    for (const [field, info] of Object.entries(STANDARD_FIELDS)) {
      if (info.required && !mappedStandardFields.has(field)) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * Validate mapped data completeness
   * @param {Object} mappings - Field mappings
   * @param {Object} rowData - CSV row data
   * @returns {Object} Validation result
   */
  validateDataCompleteness(mappings, rowData) {
    const missingRequired = [];
    const emptyFields = [];
    const presentFields = [];

    for (const [csvHeader, standardField] of Object.entries(mappings)) {
      const value = rowData[csvHeader];
      const fieldInfo = STANDARD_FIELDS[standardField];

      if (!value || value.toString().trim() === '') {
        emptyFields.push(standardField);
        if (fieldInfo && fieldInfo.required) {
          missingRequired.push(standardField);
        }
      } else {
        presentFields.push(standardField);
      }
    }

    return {
      isComplete: missingRequired.length === 0,
      missingRequired,
      emptyFields,
      presentFields,
      completeness: (presentFields.length / Object.keys(mappings).length) * 100
    };
  }

  /**
   * Get human-readable explanation of field mapping
   * @param {string} csvHeader - CSV column header
   * @param {string} standardField - Mapped standard field
   * @param {number} confidence - Confidence score
   * @returns {Promise<string>} Explanation
   */
  async explainMapping(csvHeader, standardField, confidence) {
    const prompt = `Briefly explain why CSV column "${csvHeader}" was mapped to the standard field "${standardField}" with ${confidence}% confidence.

Write 1 sentence explaining the reasoning.`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.7,
        maxTokens: 100
      });
      return response.trim();
    } catch (error) {
      return `"${csvHeader}" appears to contain ${standardField} data.`;
    }
  }

  /**
   * Suggest alternative mapping for a field
   * @param {string} csvHeader - CSV column header
   * @param {Array<Object>} sampleValues - Sample values from this column
   * @returns {Promise<Array<string>>} Suggested standard fields
   */
  async suggestAlternatives(csvHeader, sampleValues) {
    const standardFieldsList = Object.keys(STANDARD_FIELDS).join(', ');

    const prompt = `Given this CSV column header and sample values, suggest the 3 most likely standard fields it could map to.

Header: ${csvHeader}
Sample Values: ${JSON.stringify(sampleValues.slice(0, 5))}

Standard Fields: ${standardFieldsList}

Respond with JSON array of field names:
["field1", "field2", "field3"]`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.3,
        maxTokens: 100
      });
      const suggestions = JSON.parse(response.trim());
      return Array.isArray(suggestions) ? suggestions : [];
    } catch (error) {
      console.error('Alternative suggestion failed:', error);
      return [];
    }
  }

  /**
   * Export mappings for reuse
   * @param {Object} mappings - Field mappings
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Exportable mapping configuration
   */
  exportMappings(mappings, metadata = {}) {
    return {
      version: '1.0',
      timestamp: Date.now(),
      mappings,
      metadata: {
        source: metadata.source || 'unknown',
        totalFields: Object.keys(mappings).length,
        ...metadata
      }
    };
  }

  /**
   * Import and validate mappings
   * @param {Object} importedConfig - Imported mapping configuration
   * @returns {Object} Validated mappings
   */
  importMappings(importedConfig) {
    if (!importedConfig || !importedConfig.mappings) {
      throw new Error('Invalid mapping configuration');
    }

    const { mappings, unmapped } = this.validateMappings(
      importedConfig.mappings,
      Object.keys(importedConfig.mappings)
    );

    return {
      mappings,
      unmapped,
      metadata: importedConfig.metadata || {},
      imported: true
    };
  }
}

/**
 * Shared instance
 */
let sharedMapper = null;

/**
 * Get shared field mapper instance
 * @returns {ClaudeFieldMapper} Shared instance
 */
export function getSharedMapper() {
  if (!sharedMapper) {
    sharedMapper = new ClaudeFieldMapper();
  }
  return sharedMapper;
}
