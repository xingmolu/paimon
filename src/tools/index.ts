/**
 * Tool registry for Paimon agent
 *
 * This module exports all tools used by the agent.
 * Tools are organized by category:
 * - File tools: bash, read, write, edit
 * - Search tools: glob, grep, find, ls
 * - HTTP tool: http
 * - Meta tools: plan, assess, reflect, checkpoint, parallel, hook
 * - Module tools: stuck, repomap, tom
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";

// Import extracted tool modules
import { fileTools } from "./file-tools.js";
import { httpTool } from "./http-tool.js";
import { searchTools } from "./search-tools.js";

// Note: The following tools are still defined in agent.ts and will be progressively migrated:
// - plan, assess, reflect, checkpoint, parallel, hook, stuck, repomap, tom
// These are imported via the buildTools function below

/**
 * Build complete tool array for the agent
 *
 * @param metaTools - Meta tools from agent.ts (plan, assess, reflect, etc.)
 * @returns Combined array of all tools
 */
export function buildTools(metaTools: AgentTool[]): AgentTool[] {
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
export { bashTool, readTool, writeTool, editTool } from "./file-tools.js";
export { globTool, grepTool, findTool, lsTool } from "./search-tools.js";
