/**
 * @fileoverview Debugging assistant using Claude
 * @module claude/claude-debug-assistant
 *
 * Provides intelligent error analysis, troubleshooting suggestions,
 * and debugging help using Claude's code understanding capabilities.
 */

import { getSharedClient } from './claude-client.js';
import { ClaudeConfig } from './claude-config.js';

/**
 * Debug assistant using Claude
 */
export class ClaudeDebugAssistant {
  constructor() {
    this.client = getSharedClient();
    this.errorHistory = [];
  }

  /**
   * Check if Claude debug assistant is available
   * @returns {Promise<boolean>} True if configured and enabled
   */
  async isAvailable() {
    const [hasKey, isEnabled] = await Promise.all([
      ClaudeConfig.hasApiKey(),
      ClaudeConfig.isFeatureEnabled('debugAssistant')
    ]);
    return hasKey && isEnabled;
  }

  /**
   * Analyze an error and provide debugging suggestions
   * @param {Error|string} error - Error object or error message
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Analysis and suggestions
   */
  async analyzeError(error, context = {}) {
    const errorInfo = this.extractErrorInfo(error);
    this.errorHistory.push({ error: errorInfo, context, timestamp: Date.now() });

    const prompt = `You are a debugging assistant for a Chrome extension. Analyze this error and provide actionable troubleshooting steps.

Error Information:
${JSON.stringify(errorInfo, null, 2)}

Context:
${JSON.stringify(context, null, 2)}

Extension Info:
- Type: Chrome Extension (Manifest V3)
- Features: Vehicle inventory management, image analysis, CSV validation
- Technologies: Content scripts, service workers, Chrome Storage API
- Common issues: DOM timing, message passing, API integration, storage

Provide:
1. Root cause analysis
2. 3-5 actionable troubleshooting steps
3. Code example if applicable
4. Preventive measures

Respond with JSON:
{
  "rootCause": "Brief explanation of what caused this error",
  "severity": "critical|high|medium|low",
  "category": "dom|api|storage|messaging|other",
  "steps": [
    {"step": 1, "action": "What to do", "explanation": "Why this helps"}
  ],
  "codeExample": "Optional code fix example",
  "prevention": "How to prevent this in the future",
  "relatedIssues": ["Possible related problems"]
}`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.5,
        maxTokens: 2000
      });

      const analysis = JSON.parse(response.trim());
      await ClaudeConfig.incrementUsage();

      return {
        ...analysis,
        error: errorInfo,
        context,
        method: 'claude-ai',
        timestamp: Date.now()
      };

    } catch (analyzeError) {
      console.error('Claude error analysis failed:', analyzeError);
      return this.fallbackAnalysis(errorInfo);
    }
  }

  /**
   * Get troubleshooting suggestions for a specific issue
   * @param {string} issue - Description of the issue
   * @param {Object} details - Additional details
   * @returns {Promise<Array<string>>} List of suggestions
   */
  async getTroubleshootingSteps(issue, details = {}) {
    const prompt = `Provide 5 specific troubleshooting steps for this Chrome extension issue:

Issue: ${issue}

Details:
${JSON.stringify(details, null, 2)}

Extension context:
- Chrome Extension (Manifest V3)
- Vehicle inventory management tools
- Uses content scripts, service workers, Chrome APIs
- Common operations: DOM manipulation, API calls, data storage

Provide clear, actionable steps numbered 1-5. Each step should be specific and testable.

Respond with JSON array:
[
  "Step 1: Specific action to take",
  "Step 2: Next action",
  ...
]`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.6,
        maxTokens: 800
      });

      const steps = JSON.parse(response.trim());
      return Array.isArray(steps) ? steps : [];

    } catch (error) {
      console.error('Troubleshooting steps generation failed:', error);
      return [
        'Check browser console for error messages',
        'Verify extension is enabled and has required permissions',
        'Try reloading the extension',
        'Check if the page structure has changed',
        'Test on a different page or browser'
      ];
    }
  }

  /**
   * Explain what a piece of code does (for debugging)
   * @param {string} code - Code snippet
   * @param {string} context - Context about where this code is used
   * @returns {Promise<string>} Explanation
   */
  async explainCode(code, context = '') {
    const prompt = `Explain what this code does in the context of a Chrome extension:

${context ? `Context: ${context}\n\n` : ''}Code:
\`\`\`javascript
${code}
\`\`\`

Provide a clear, concise explanation (2-3 sentences) of what this code does and any potential issues.`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.5,
        maxTokens: 500
      });
      return response.trim();

    } catch (error) {
      console.error('Code explanation failed:', error);
      return 'Unable to generate explanation.';
    }
  }

  /**
   * Suggest code fix for an error
   * @param {string} errorMessage - Error message
   * @param {string} problematicCode - Code that's causing the error
   * @returns {Promise<Object>} Suggested fix
   */
  async suggestFix(errorMessage, problematicCode) {
    const prompt = `Suggest a fix for this error in a Chrome extension:

Error: ${errorMessage}

Problematic Code:
\`\`\`javascript
${problematicCode}
\`\`\`

Provide:
1. Fixed version of the code
2. Explanation of what was wrong
3. Why this fix works

Respond with JSON:
{
  "fixedCode": "Corrected code here",
  "explanation": "What was wrong",
  "reasoning": "Why this fix works"
}`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });

      return JSON.parse(response.trim());

    } catch (error) {
      console.error('Fix suggestion failed:', error);
      return {
        fixedCode: problematicCode,
        explanation: 'Unable to generate fix',
        reasoning: error.message
      };
    }
  }

  /**
   * Analyze performance issue
   * @param {Object} performanceData - Performance metrics
   * @returns {Promise<Object>} Performance analysis
   */
  async analyzePerformance(performanceData) {
    const prompt = `Analyze this Chrome extension performance data and suggest optimizations:

Performance Metrics:
${JSON.stringify(performanceData, null, 2)}

Identify:
1. Performance bottlenecks
2. Specific optimization opportunities
3. Recommended changes

Respond with JSON:
{
  "bottlenecks": ["List of identified bottlenecks"],
  "recommendations": [
    {"issue": "What's slow", "fix": "How to improve", "impact": "Expected improvement"}
  ],
  "priority": "high|medium|low"
}`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.4,
        maxTokens: 1500
      });

      return JSON.parse(response.trim());

    } catch (error) {
      console.error('Performance analysis failed:', error);
      return {
        bottlenecks: [],
        recommendations: [],
        priority: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Get error patterns and trends from history
   * @returns {Promise<Object>} Pattern analysis
   */
  async analyzeErrorPatterns() {
    if (this.errorHistory.length < 3) {
      return {
        patterns: [],
        trends: [],
        note: 'Not enough error data for pattern analysis'
      };
    }

    const recentErrors = this.errorHistory.slice(-10);

    const prompt = `Analyze these recent errors from a Chrome extension and identify patterns:

Errors:
${JSON.stringify(recentErrors, null, 2)}

Identify:
1. Common error patterns
2. Trends or recurring issues
3. Potential systemic problems

Respond with JSON:
{
  "patterns": ["Identified patterns"],
  "trends": ["Observed trends"],
  "systemicIssues": ["Potential root causes affecting multiple errors"]
}`;

    try {
      const response = await this.client.prompt(prompt, {
        temperature: 0.5,
        maxTokens: 1000
      });

      return JSON.parse(response.trim());

    } catch (error) {
      console.error('Pattern analysis failed:', error);
      return {
        patterns: [],
        trends: [],
        systemicIssues: [],
        error: error.message
      };
    }
  }

  /**
   * Extract structured error information
   * @private
   */
  extractErrorInfo(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
        type: 'Error object'
      };
    } else if (typeof error === 'string') {
      return {
        message: error,
        type: 'String error'
      };
    } else {
      return {
        message: JSON.stringify(error),
        type: 'Unknown error type'
      };
    }
  }

  /**
   * Fallback analysis when Claude is unavailable
   * @private
   */
  fallbackAnalysis(errorInfo) {
    return {
      rootCause: 'Unable to analyze (Claude unavailable)',
      severity: 'unknown',
      category: 'other',
      steps: [
        { step: 1, action: 'Check browser console', explanation: 'View full error details' },
        { step: 2, action: 'Verify permissions', explanation: 'Ensure extension has required permissions' },
        { step: 3, action: 'Reload extension', explanation: 'Restart the extension' }
      ],
      error: errorInfo,
      method: 'fallback'
    };
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
  }

  /**
   * Get error history
   * @returns {Array<Object>} Error history
   */
  getHistory() {
    return [...this.errorHistory];
  }

  /**
   * Export error report
   * @returns {Object} Exportable error report
   */
  exportErrorReport() {
    return {
      version: '1.0',
      timestamp: Date.now(),
      errorCount: this.errorHistory.length,
      errors: this.errorHistory,
      extensionInfo: {
        name: 'LeadBox of Tricks',
        type: 'Chrome Extension'
      }
    };
  }
}

/**
 * Shared instance
 */
let sharedAssistant = null;

/**
 * Get shared debug assistant instance
 * @returns {ClaudeDebugAssistant} Shared instance
 */
export function getSharedAssistant() {
  if (!sharedAssistant) {
    sharedAssistant = new ClaudeDebugAssistant();
  }
  return sharedAssistant;
}
