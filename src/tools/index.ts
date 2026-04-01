/**
 * Tool registry for Paimon agent
 *
 * This module exports all tools used by the agent.
 * Tools are organized by category:
 * - File tools: bash, read, write, edit
 * - Search tools: glob, grep, find, ls
 * - HTTP tool: http
 * - Meta tools: plan, assess, reflect, checkpoint, parallel, hook
 * - Module tools: stuck, repomap, tom, singularity, rag, trajectory, errorPatterns, patternMiner, bugReport, commitMsg
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";

// Import extracted tool modules
import { assessTool } from "./assess-tool.js";
import { benchmarkTool } from "./benchmark-tool.js";
import { bugReportTool } from "./bug-report-tool.js";
import { checkpointTool } from "./checkpoint-tool.js";
import { commitMsgTool } from "./commit-msg-tool.js";
import { errorPatternsTool } from "./error-patterns-tool.js";
import { fileTools } from "./file-tools.js";
import { hookTool } from "./hook-tool.js";
import { httpTool } from "./http-tool.js";
import { intelligenceTool } from "./intelligence-tool.js";
import { metricsTool } from "./metrics-tool.js";
import { multiAgentTool } from "./multi-agent-tool.js";
import { parallelTool } from "./parallel-tool.js";
import { patternMinerTool } from "./pattern-miner-tool.js";
import { planTool } from "./plan-tool.js";
import { pluginsTool } from "./plugins-tool.js";
import { ragTool } from "./rag-tool.js";
import { reflectTool } from "./reflect-tool.js";
import { repomapTool } from "./repomap-tool.js";
import { rouletteTool } from "./roulette-tool.js";
import { safetyGatesTool } from "./safety-gates-tool.js";
import { sdkTool } from "./sdk-tool.js";
import { searchTools } from "./search-tools.js";
import { singularityTool } from "./singularity-tool.js";
import { stuckTool } from "./stuck-tool.js";
import { taskPredictorTool } from "./task-predictor-tool.js";
import { tokenTrackingTool } from "./token-tracking-tool.js";
import { tomTool } from "./tom-tool.js";
import { toolCacheTool } from "./tool-cache-tool.js";
import { trajectoryTool } from "./trajectory-tool.js";

// Meta tools that have been extracted
export const metaTools: AgentTool[] = [
	planTool,
	assessTool,
	reflectTool,
	checkpointTool,
	parallelTool,
	hookTool,
	stuckTool,
	repomapTool,
	tomTool,
	singularityTool,
	ragTool,
	trajectoryTool,
	errorPatternsTool,
	patternMinerTool,
	bugReportTool,
	commitMsgTool,
	rouletteTool,
	pluginsTool,
	metricsTool,
	taskPredictorTool,
	intelligenceTool,
	sdkTool,
	benchmarkTool,
	safetyGatesTool,
	multiAgentTool,
	tokenTrackingTool,
	toolCacheTool,
];

/**
 * Build complete tool array for the agent
 * All tools are now extracted to modules
 *
 * @returns Combined array of all tools
 */
export function buildTools(): AgentTool[] {
	return [...fileTools, ...searchTools, httpTool, ...metaTools];
}

/**
 * Build tools description for system prompt
 *
 * @param tools - Array of tools to describe
 * @returns Formatted description of all tools
 */
export function buildToolsDescription(tools: AgentTool[]): string {
	const lines: string[] = [];

	for (const tool of tools) {
		lines.push(`- ${tool.name}: ${tool.description}`);
	}

	return lines.join("\n");
}

// Re-export individual tools for direct access
export { fileTools, searchTools, httpTool };
export { assessTool } from "./assess-tool.js";
export { bugReportTool } from "./bug-report-tool.js";
export { checkpointTool } from "./checkpoint-tool.js";
export { commitMsgTool } from "./commit-msg-tool.js";
export { errorPatternsTool } from "./error-patterns-tool.js";
export { bashTool, readTool, writeTool, editTool } from "./file-tools.js";
export { globTool, grepTool, findTool, lsTool } from "./search-tools.js";
export { hookTool } from "./hook-tool.js";
export { parallelTool } from "./parallel-tool.js";
export { patternMinerTool } from "./pattern-miner-tool.js";
export { planTool, getCurrentPlan, setCurrentPlan } from "./plan-tool.js";
export { ragTool } from "./rag-tool.js";
export { reflectTool } from "./reflect-tool.js";
export { repomapTool } from "./repomap-tool.js";
export { stuckTool } from "./stuck-tool.js";
export { tomTool } from "./tom-tool.js";
export { singularityTool } from "./singularity-tool.js";
export { trajectoryTool } from "./trajectory-tool.js";
export { rouletteTool, initRoulette } from "./roulette-tool.js";
export { pluginsTool, getPluginTools } from "./plugins-tool.js";
export { metricsTool } from "./metrics-tool.js";
export { taskPredictorTool } from "./task-predictor-tool.js";
export { intelligenceTool } from "./intelligence-tool.js";
export { sdkTool, createSDKTool } from "./sdk-tool.js";
export { benchmarkTool } from "./benchmark-tool.js";
export { safetyGatesTool, getSafetyGatesForHook } from "./safety-gates-tool.js";
export { multiAgentTool } from "./multi-agent-tool.js";
export { tokenTrackingTool, getTokenTracker, resetTokenTracker } from "./token-tracking-tool.js";
export { toolCacheTool } from "./tool-cache-tool.js";
export { getToolCache, resetToolCache, ToolCache, generateCacheKey } from "../tool-cache.js";
export {
	getBenchmarkRunner,
	createSampleTasks,
	BenchmarkRunner,
} from "../benchmark.js";
export {
	getSDK,
	initSDK,
	EvolutionSDK,
	formatSDKStats,
	formatSession,
	formatEvolutionResult,
	formatBatchResult,
} from "../sdk.js";
