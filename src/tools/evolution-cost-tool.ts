/**
 * Evolution Cost Prediction Tool
 *
 * Tool for predicting effort/complexity of implementing capabilities.
 */

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import { Type } from '@sinclair/typebox';
import {
  getEvolutionCostPredictor,
} from '../evolution-cost.js';
import type {
  ComplexityLevel,
  CostPrediction,
  EvolutionCostStats,
  HistoricalTask,
  CostFactors,
  RiskFactor,
} from '../evolution-cost.js';

/**
 * Evolution Cost Tool
 *
 * Predicts effort/complexity of implementing a capability before starting.
 */
export const evolutionCostToolDef: AgentTool = {
  name: 'evolutionCost',
  label: 'Evolution Cost Prediction',
  description: `Predict effort/complexity of implementing a capability before starting. Use this to estimate task cost and identify risk factors before starting implementation.

Actions:
- predict: Predict cost for a task (requires taskDescription, taskType)
- quick-check: Quick cost check without full details (requires taskDescription, taskType)
- record: Record outcome for learning (requires taskDescription, taskType, actualTimeMinutes, success, errors)
- history: View historical task data (optional: limit)
- factors: Analyze cost factors for a task (requires taskDescription, taskType)
- risks: Identify risk factors for a task (requires taskDescription, taskType)
- similar: Find similar past tasks (requires taskDescription, taskType)
- stats: View prediction statistics
- accuracy: View prediction accuracy metrics
- config: View configuration
- update-config: Update configuration
- clear: Clear history
- enable: Enable cost prediction
- disable: Disable cost prediction
- weights: View complexity weights
- estimates: View base time estimates
- help: Show help message

Complexity Levels: simple (5-15m), moderate (15-30m), complex (30-60m), very-complex (60-120m)

Example usage:
evolutionCost({action: 'predict', taskDescription: 'Add new tool', taskType: 'capability'})
evolutionCost({action: 'quick-check', taskDescription: 'Fix bug', taskType: 'reliability'})
evolutionCost({action: 'record', taskDescription: 'Add tool', taskType: 'capability', actualTimeMinutes: 20, success: true, errors: ['lint']})
evolutionCost({action: 'stats'})`,
  parameters: Type.Object({
    action: Type.String({
      description: 'Action: predict, quick-check, record, history, factors, risks, similar, stats, accuracy, config, update-config, clear, enable, disable, weights, estimates, help',
    }),
    taskDescription: Type.Optional(Type.String({
      description: 'Task description for prediction/analysis',
    })),
    taskType: Type.Optional(Type.String({
      description: 'Task type: capability, reliability, or feature',
    })),
    actualTimeMinutes: Type.Optional(Type.Number({
      description: 'Actual time taken in minutes (for record action)',
    })),
    success: Type.Optional(Type.Boolean({
      description: 'Whether task succeeded (for record action)',
    })),
    errors: Type.Optional(Type.Array(Type.String(), {
      description: 'Errors encountered (for record action)',
    })),
    limit: Type.Optional(Type.Number({
      description: 'Limit for history results',
    })),
    enabled: Type.Optional(Type.Boolean({
      description: 'Enable/disable setting (for update-config)',
    })),
    confidenceThreshold: Type.Optional(Type.Number({
      description: 'Confidence threshold (for update-config)',
    })),
    maxHistorySize: Type.Optional(Type.Number({
      description: 'Maximum history size (for update-config)',
    })),
  }),
  execute: async (_toolCallId: string, params: unknown): Promise<AgentToolResult<string>> => {
    const output = handleEvolutionCostToolCall(params as Record<string, unknown>);
    return {
      content: [{ type: "text", text: output }],
      details: output,
    };
  },
};

/**
 * Handle evolution cost tool calls
 */
export function handleEvolutionCostToolCall(args: Record<string, unknown>): string {
  const predictor = getEvolutionCostPredictor();
  const action = String(args.action || 'help');

  try {
    switch (action) {
      case 'predict': {
        const taskDescription = String(args.taskDescription || '');
        const taskType = String(args.taskType || 'capability') as 'capability' | 'reliability' | 'feature';
        
        if (!taskDescription) {
          return 'Error: taskDescription required for predict action';
        }
        
        const prediction = predictor.predict(taskDescription, taskType);
        return formatPrediction(prediction);
      }

      case 'quick-check': {
        const taskDescription = String(args.taskDescription || '');
        const taskType = String(args.taskType || 'capability') as 'capability' | 'reliability' | 'feature';
        
        if (!taskDescription) {
          return 'Error: taskDescription required for quick-check action';
        }
        
        const check = predictor.quickCheck(taskDescription, taskType);
        return [
          'Quick Cost Check',
          `Task: ${taskDescription}`,
          `Complexity: ${check.complexity}`,
          `Estimated Time: ${check.estimatedMinutes} minutes`,
          `Confidence: ${check.confidence}%`
        ].join('\n');
      }

      case 'record': {
        const taskDescription = String(args.taskDescription || '');
        const taskType = String(args.taskType || 'capability') as 'capability' | 'reliability' | 'feature';
        const actualTimeMinutes = Number(args.actualTimeMinutes || 0);
        const success = Boolean(args.success);
        const errors = (args.errors as string[]) || [];
        
        if (!taskDescription || actualTimeMinutes === 0) {
          return 'Error: taskDescription and actualTimeMinutes required for record action';
        }
        
        predictor.recordOutcome(taskDescription, taskType, actualTimeMinutes, success, errors);
        return [
          'Outcome recorded successfully',
          `Task: ${taskDescription}`,
          `Actual Time: ${actualTimeMinutes} minutes`,
          `Success: ${success ? 'Yes' : 'No'}`,
          `Errors: ${errors.length > 0 ? errors.join(', ') : 'none'}`
        ].join('\n');
      }

      case 'history': {
        const limit = Number(args.limit || 20);
        const history = predictor.getHistory().slice(-limit);
        
        if (history.length === 0) {
          return 'No historical task data available';
        }
        
        const lines = history.map((task: HistoricalTask, i: number) => 
          `${i + 1}. ${task.taskDescription.substring(0, 60)}... [${task.taskType}] ${task.actualTimeMinutes}m ${task.success ? '✓' : '✗'}`
        );
        
        return `Historical Tasks (${history.length})\n${lines.join('\n')}`;
      }

      case 'factors': {
        const taskDescription = String(args.taskDescription || '');
        const taskType = String(args.taskType || 'capability') as 'capability' | 'reliability' | 'feature';
        
        if (!taskDescription) {
          return 'Error: taskDescription required for factors action';
        }
        
        const factors = predictor.analyzeTaskFactors(taskDescription, taskType);
        const score = predictor.calculateComplexityScore(factors);
        const complexity = predictor.determineComplexityLevel(score);
        
        return formatFactors(factors, score, complexity);
      }

      case 'risks': {
        const taskDescription = String(args.taskDescription || '');
        const taskType = String(args.taskType || 'capability') as 'capability' | 'reliability' | 'feature';
        
        if (!taskDescription) {
          return 'Error: taskDescription required for risks action';
        }
        
        const factors = predictor.analyzeTaskFactors(taskDescription, taskType);
        const risks = predictor.identifyRiskFactors(factors, taskDescription);
        
        if (risks.length === 0) {
          return 'No significant risk factors identified';
        }
        
        const lines = risks.map((risk: RiskFactor, i: number) => 
          `${i + 1}. ${risk.type} (impact: ${risk.impact})\n   ${risk.description}\n   Mitigation: ${risk.mitigation || 'N/A'}`
        );
        
        return `Risk Factors (${risks.length})\n${lines.join('\n')}`;
      }

      case 'similar': {
        const taskDescription = String(args.taskDescription || '');
        const taskType = String(args.taskType || 'capability') as 'capability' | 'reliability' | 'feature';
        
        if (!taskDescription) {
          return 'Error: taskDescription required for similar action';
        }
        
        const similar = predictor.findSimilarTasks(taskDescription, taskType);
        
        if (similar.length === 0) {
          return 'No similar past tasks found';
        }
        
        const lines = similar.map((task: HistoricalTask, i: number) => 
          `${i + 1}. ${task.taskDescription.substring(0, 50)}... [${task.complexityLevel}] ${task.actualTimeMinutes}m ${task.success ? '✓' : '✗'}`
        );
        
        return `Similar Past Tasks (${similar.length})\n${lines.join('\n')}`;
      }

      case 'stats': {
        const stats = predictor.getStats();
        return formatStats(stats);
      }

      case 'accuracy': {
        const stats = predictor.getStats();
        
        if (stats.accuracyHistory.length === 0) {
          return 'No accuracy data available - record task outcomes first';
        }
        
        const recentAccuracy = stats.accuracyHistory.slice(-10);
        const lines = recentAccuracy.map((acc: number, i: number) => `Prediction ${i + 1}: ${acc.toFixed(1)}%`);
        
        return [
          'Prediction Accuracy Metrics',
          `Average Accuracy: ${stats.averageAccuracy.toFixed(1)}%`,
          `Total Predictions: ${stats.predictionsTotal}`,
          'Recent Accuracy: ',
          lines.join('\n')
        ].join('\n');
      }

      case 'config': {
        const config = predictor.getConfig();
        return [
          'Evolution Cost Configuration',
          `Enabled: ${config.enabled}`,
          `History File: ${config.historyFile}`,
          `Max History Size: ${config.maxHistorySize}`,
          `Confidence Threshold: ${config.confidenceThreshold}`
        ].join('\n');
      }

      case 'update-config': {
        const updates: Record<string, unknown> = {};
        
        if (args.enabled !== undefined) updates.enabled = Boolean(args.enabled);
        if (args.confidenceThreshold !== undefined) updates.confidenceThreshold = Number(args.confidenceThreshold);
        if (args.maxHistorySize !== undefined) updates.maxHistorySize = Number(args.maxHistorySize);
        
        predictor.updateConfig(updates);
        const lines = Object.entries(updates).map(([k, v]) => `${k}: ${String(v)}`);
        return `Configuration updated\n${lines.join('\n')}`;
      }

      case 'clear': {
        predictor.clearHistory();
        return 'Evolution cost history cleared';
      }

      case 'enable': {
        predictor.setEnabled(true);
        return 'Evolution cost prediction enabled';
      }

      case 'disable': {
        predictor.setEnabled(false);
        return 'Evolution cost prediction disabled';
      }

      case 'weights': {
        const weights = predictor.getComplexityWeights();
        const lines = Object.entries(weights).map(([k, v]) => `${k}: ${String(v)}`);
        return `Complexity Weights\n${lines.join('\n')}`;
      }

      case 'estimates': {
        const estimates = predictor.getBaseTimeEstimates();
        const entries = estimates as Record<string, { min: number; max: number; avg: number }>;
        const lines = Object.entries(entries).map(([k, v]) => 
          `${k}: min ${v.min}m, max ${v.max}m, avg ${v.avg}m`
        );
        return `Base Time Estimates by Complexity\n${lines.join('\n')}`;
      }

      case 'help': {
        return [
          'Evolution Cost Prediction Tool',
          '',
          'Predicts effort/complexity of implementing a capability before starting.',
          '',
          'Actions:',
          '- predict: Full cost prediction for a task',
          '- quick-check: Quick cost check (complexity and time)',
          '- record: Record outcome for learning',
          '- history: View historical task data',
          '- factors: Analyze cost factors',
          '- risks: Identify risk factors',
          '- similar: Find similar past tasks',
          '- stats: View prediction statistics',
          '- accuracy: View accuracy metrics',
          '- config: View configuration',
          '- update-config: Update configuration',
          '- clear: Clear history',
          '- enable/disable: Toggle prediction',
          '- weights: View complexity weights',
          '- estimates: View base time estimates',
          '',
          'Complexity Levels:',
          '- simple: 5-15 minutes (score 3 or less)',
          '- moderate: 15-30 minutes (score 7 or less)',
          '- complex: 30-60 minutes (score 12 or less)',
          '- very-complex: 60-120 minutes (score above 12)',
          '',
          'Example usage:',
          'evolutionCost({action: "predict", taskDescription: "Add new tool", taskType: "capability"})',
          'evolutionCost({action: "stats"})'
        ].join('\n');
      }

      default:
        return `Unknown action: ${action}. Use "help" for available actions.`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Format prediction result
 */
function formatPrediction(prediction: CostPrediction): string {
  const sections: string[] = [];
  
  sections.push(`Cost Prediction for: ${prediction.taskDescription}`);
  sections.push(`Task Type: ${prediction.taskType}`);
  sections.push(`Complexity: ${prediction.complexityLevel}`);
  sections.push(`Estimated Time: ${prediction.estimatedTimeMinutes} minutes (range: ${prediction.estimatedTimeRange.min}-${prediction.estimatedTimeRange.max}m)`);
  sections.push(`Confidence: ${prediction.confidence}%`);

  if (prediction.riskFactors.length > 0) {
    sections.push(`\nRisk Factors (${prediction.riskFactors.length}):`);
    for (const risk of prediction.riskFactors.slice(0, 5)) {
      sections.push(`  - ${risk.type} (impact: ${risk.impact}): ${risk.description}`);
      if (risk.mitigation) {
        sections.push(`    Mitigation: ${risk.mitigation}`);
      }
    }
  }

  if (prediction.similarTasks.length > 0) {
    sections.push(`\nSimilar Tasks: ${prediction.similarTasks.length} found`);
  }

  if (prediction.recommendations.length > 0) {
    sections.push('\nRecommendations:');
    for (const rec of prediction.recommendations) {
      sections.push(`  - ${rec}`);
    }
  }

  return sections.join('\n');
}

/**
 * Format cost factors
 */
function formatFactors(factors: CostFactors, score: number, complexity: ComplexityLevel): string {
  const lines: string[] = [];
  
  lines.push('Cost Factors Analysis');
  lines.push(`Complexity Score: ${score.toFixed(1)} (${complexity})`);
  lines.push('');
  lines.push('Detected Factors:');
  lines.push(`  New Module: ${factors.newModule ? 'Yes' : 'No'}`);
  lines.push(`  Hook Integration: ${factors.hookIntegration ? 'Yes' : 'No'}`);
  lines.push(`  Tool Chain Changes: ${factors.toolChainChanges ? 'Yes' : 'No'}`);
  lines.push(`  File Count: ${factors.fileCount}`);
  lines.push(`  Dependencies: ${factors.dependencies}`);
  lines.push(`  Testing Required: ${factors.testingRequired ? 'Yes' : 'No'}`);
  lines.push(`  State Persistence: ${factors.statePersistence ? 'Yes' : 'No'}`);
  lines.push(`  API Integration: ${factors.apiIntegration ? 'Yes' : 'No'}`);
  lines.push(`  Error Handling: ${factors.errorHandling ? 'Yes' : 'No'}`);
  lines.push(`  Similar Tasks: ${factors.similarTasks}`);

  return lines.join('\n');
}

/**
 * Format statistics
 */
function formatStats(stats: EvolutionCostStats): string {
  const sections: string[] = [];
  
  sections.push('Evolution Cost Prediction Statistics');
  sections.push(`Total Predictions: ${stats.predictionsTotal}`);
  sections.push(`Average Accuracy: ${stats.averageAccuracy.toFixed(1)}%`);
  sections.push('');
  sections.push('By Complexity Level:');
  sections.push(`  Simple: ${stats.predictionsByComplexity.simple}`);
  sections.push(`  Moderate: ${stats.predictionsByComplexity.moderate}`);
  sections.push(`  Complex: ${stats.predictionsByComplexity.complex}`);
  sections.push(`  Very-Complex: ${stats.predictionsByComplexity['very-complex']}`);
  sections.push('');
  sections.push('By Task Type:');
  sections.push(`  Capability: ${stats.predictionsByType.capability}`);
  sections.push(`  Reliability: ${stats.predictionsByType.reliability}`);
  sections.push(`  Feature: ${stats.predictionsByType.feature}`);

  if (stats.topRiskFactors.length > 0) {
    sections.push('');
    sections.push('Top Risk Factors:');
    for (const item of stats.topRiskFactors.slice(0, 5)) {
      sections.push(`  ${item.type}: ${item.count}`);
    }
  }

  return sections.join('\n');
}
