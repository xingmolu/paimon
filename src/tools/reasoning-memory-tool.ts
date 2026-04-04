/**
 * Reasoning Memory Tool
 *
 * Tool for managing agentic reasoning memory - storing and recalling
 * reasoning chains across evolution iterations.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ReasoningChain,
	type ReasoningMemoryManager,
	getReasoningMemoryManager,
} from "../reasoning-memory.js";

// Tool implementation
export const reasoningMemoryTool: AgentTool = {
	name: "reasoningMemory",
	label: "Reasoning Memory",
	description:
		"Manage agentic reasoning memory for storing and recalling reasoning chains across evolution iterations. Use to learn from past reasoning, avoid re-exploring same solutions, and improve convergence speed.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: start, step, complete, cancel, current, similar, guidance, chain, chains, pattern, patterns, stats, config, clear, reset, help",
		}),
		taskDescription: Type.Optional(
			Type.String({ description: "Task description for start action" }),
		),
		taskType: Type.Optional(
			Type.String({
				description: "Task type: capability, reliability, or feature",
				enum: ["capability", "reliability", "feature"],
			}),
		),
		stepType: Type.Optional(
			Type.String({
				description: "Type of reasoning step: analysis, decision, action, observation, conclusion",
				enum: ["analysis", "decision", "action", "observation", "conclusion"],
			}),
		),
		content: Type.Optional(Type.String({ description: "Content for the step" })),
		toolUsed: Type.Optional(Type.String({ description: "Tool used in this step" })),
		toolResult: Type.Optional(Type.String({ description: "Result from tool execution" })),
		confidence: Type.Optional(Type.Number({ description: "Confidence level for this step (0-1)" })),
		outcome: Type.Optional(
			Type.String({
				description: "Outcome for complete action: success, failure, or partial",
				enum: ["success", "failure", "partial"],
			}),
		),
		filesModified: Type.Optional(
			Type.Array(Type.String(), { description: "List of files modified" }),
		),
		errors: Type.Optional(Type.Array(Type.String(), { description: "List of errors encountered" })),
		learnings: Type.Optional(
			Type.Array(Type.String(), { description: "List of learnings from this chain" }),
		),
		chainId: Type.Optional(Type.String({ description: "Chain ID for chain/pattern actions" })),
		patternId: Type.Optional(Type.String({ description: "Pattern ID for pattern action" })),
		limit: Type.Optional(Type.Number({ description: "Maximum number of results to return" })),
		target: Type.Optional(
			Type.String({ description: "Target for clear action: chains or patterns" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getReasoningMemoryManager();
		const p = params as Record<string, unknown>;
		const action = p.action as string;

		try {
			let result: string;
			switch (action) {
				case "start":
					result = handleStart(manager, p);
					break;
				case "step":
					result = handleStep(manager, p);
					break;
				case "complete":
					result = handleComplete(manager, p);
					break;
				case "cancel":
					result = handleCancel(manager);
					break;
				case "current":
					result = handleCurrent(manager);
					break;
				case "similar":
					result = handleSimilar(manager, p);
					break;
				case "guidance":
					result = handleGuidance(manager, p);
					break;
				case "chain":
					result = handleChain(manager, p);
					break;
				case "chains":
					result = handleChains(manager, p);
					break;
				case "pattern":
					result = handlePattern(manager, p);
					break;
				case "patterns":
					result = handlePatterns(manager, p);
					break;
				case "stats":
					result = manager.formatStats();
					break;
				case "config":
					result = handleConfig(manager);
					break;
				case "clear":
					result = handleClear(manager, p);
					break;
				case "reset":
					result = handleReset(manager);
					break;
				case "help":
					result = getHelpMessage();
					break;
				default:
					result = `Unknown action: ${action}. Use 'help' to see available actions.`;
			}
			return { content: [{ type: "text", text: result }], details: result };
		} catch (error) {
			const errorMessage = `Error executing action '${action}': ${error instanceof Error ? error.message : String(error)}`;
			return { content: [{ type: "text", text: errorMessage }], details: errorMessage };
		}
	},
};

function handleStart(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const taskDescription = params.taskDescription as string;
	const taskType = (params.taskType as "capability" | "reliability" | "feature") || "capability";

	if (!taskDescription) {
		return "Error: taskDescription is required for start action";
	}

	const chainId = manager.startChain(taskDescription, taskType);
	return `Started reasoning chain: ${chainId}\nTask: ${taskDescription}\nType: ${taskType}`;
}

function handleStep(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const stepType = params.stepType as ReasoningChain["steps"][0]["type"];
	const content = params.content as string;
	const toolUsed = params.toolUsed as string | undefined;
	const toolResult = params.toolResult as string | undefined;
	const confidence = params.confidence as number | undefined;

	if (!stepType || !content) {
		return "Error: stepType and content are required for step action";
	}

	const stepId = manager.addStep(stepType, content, toolUsed, toolResult, confidence);
	if (!stepId) {
		return "Error: No active reasoning chain. Start a chain first with 'start' action.";
	}

	return `Added ${stepType} step: ${stepId}\n${content.slice(0, 100)}${content.length > 100 ? "..." : ""}`;
}

function handleComplete(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const outcome = params.outcome as "success" | "failure" | "partial";
	const filesModified = (params.filesModified as string[]) || [];
	const errors = (params.errors as string[]) || [];
	const learnings = (params.learnings as string[]) || [];

	if (!outcome) {
		return "Error: outcome is required for complete action";
	}

	const chain = manager.completeChain(outcome, filesModified, errors, learnings);
	if (!chain) {
		return "Error: No active reasoning chain to complete";
	}

	return `Completed reasoning chain: ${chain.id}\nOutcome: ${outcome}\nSteps: ${chain.steps.length}\nDuration: ${Math.round(chain.durationMs / 1000)}s`;
}

function handleCancel(manager: ReasoningMemoryManager): string {
	manager.cancelChain();
	return "Cancelled current reasoning chain";
}

function handleCurrent(manager: ReasoningMemoryManager): string {
	const chain = manager.getCurrentChain();
	if (!chain) {
		return "No active reasoning chain";
	}
	return manager.formatChain(chain);
}

function handleSimilar(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const taskDescription = params.taskDescription as string;
	const taskType = params.taskType as "capability" | "reliability" | "feature" | undefined;
	const limit = (params.limit as number) || 5;

	if (!taskDescription) {
		return "Error: taskDescription is required for similar action";
	}

	const results = manager.findSimilarChains(taskDescription, taskType, limit);

	if (results.length === 0) {
		return "No similar chains found";
	}

	const lines: string[] = ["## Similar Reasoning Chains", ""];
	for (const result of results) {
		const outcome =
			result.chain.outcome === "success" ? "✅" : result.chain.outcome === "partial" ? "⚠️" : "❌";
		lines.push(
			`${outcome} **${result.chain.id}** - ${Math.round(result.similarity * 100)}% similar`,
		);
		lines.push(`   Task: ${result.chain.taskDescription.slice(0, 60)}...`);
		lines.push(`   Keywords: ${result.matchingKeywords.slice(0, 5).join(", ")}`);
		lines.push(`   Tags: ${result.matchingTags.join(", ")}`);
		lines.push("");
	}

	return lines.join("\n");
}

function handleGuidance(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const taskDescription = params.taskDescription as string;
	const taskType = params.taskType as "capability" | "reliability" | "feature" | undefined;

	if (!taskDescription) {
		return "Error: taskDescription is required for guidance action";
	}

	return manager.getReasoningGuidance(taskDescription, taskType);
}

function handleChain(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const chainId = params.chainId as string;

	if (!chainId) {
		return "Error: chainId is required for chain action";
	}

	const chain = manager.getChain(chainId);
	if (!chain) {
		return `Chain not found: ${chainId}`;
	}

	return manager.formatChain(chain);
}

function handleChains(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const limit = (params.limit as number) || 10;
	const chains = manager.getRecentChains(limit);

	if (chains.length === 0) {
		return "No reasoning chains stored";
	}

	const lines: string[] = ["## Recent Reasoning Chains", ""];
	for (const chain of chains) {
		const outcome = chain.outcome === "success" ? "✅" : chain.outcome === "partial" ? "⚠️" : "❌";
		lines.push(
			`${outcome} **${chain.id}** - ${chain.taskType} - ${chain.steps.length} steps - ${Math.round(chain.durationMs / 1000)}s`,
		);
		lines.push(`   ${chain.taskDescription.slice(0, 70)}...`);
		lines.push("");
	}

	return lines.join("\n");
}

function handlePattern(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const patternId = params.patternId as string;

	if (!patternId) {
		return "Error: patternId is required for pattern action";
	}

	const pattern = manager.getPattern(patternId);
	if (!pattern) {
		return `Pattern not found: ${patternId}`;
	}

	return manager.formatPattern(pattern);
}

function handlePatterns(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const taskType = params.taskType as "capability" | "reliability" | "feature" | undefined;
	const patterns = manager.findApplicablePatterns(taskType);

	if (patterns.length === 0) {
		return "No reasoning patterns available";
	}

	const lines: string[] = ["## Reasoning Patterns", ""];
	for (const pattern of patterns.slice(0, 10)) {
		const successRate = Math.round(pattern.successRate * 100);
		lines.push(
			`- **${pattern.name}**: ${pattern.description.slice(0, 60)}... (${successRate}% success, ${pattern.occurrences} occurrences)`,
		);
		lines.push(`  Sequence: \`${pattern.sequence.join(" → ")}\``);
		lines.push("");
	}

	return lines.join("\n");
}

function handleConfig(manager: ReasoningMemoryManager): string {
	const config = manager.getConfig();
	const lines: string[] = [
		"## Reasoning Memory Configuration",
		"",
		`Enabled: ${config.enabled}`,
		`Max Chains: ${config.maxChains}`,
		`Max Patterns: ${config.maxPatterns}`,
		`Similarity Threshold: ${config.similarityThreshold}`,
		`Auto Extract Patterns: ${config.autoExtractPatterns}`,
		`Storage Path: ${config.storagePath}`,
	];
	return lines.join("\n");
}

function handleClear(manager: ReasoningMemoryManager, params: Record<string, unknown>): string {
	const target = params.target as string;

	if (target === "patterns") {
		manager.clearPatterns();
		return "Cleared all custom reasoning patterns";
	}

	manager.clearChains();
	return "Cleared all reasoning chains";
}

function handleReset(manager: ReasoningMemoryManager): string {
	manager.reset();
	return "Reset reasoning memory to defaults";
}

function getHelpMessage(): string {
	return `## Reasoning Memory Tool

Manage agentic reasoning memory for storing and recalling reasoning chains across evolution iterations.

### Actions

**Chain Management:**
- \`start\` - Start a new reasoning chain (requires taskDescription, optional taskType)
- \`step\` - Add a reasoning step (requires stepType, content; optional toolUsed, toolResult, confidence)
- \`complete\` - Complete the current chain (requires outcome; optional filesModified, errors, learnings)
- \`cancel\` - Cancel the current chain
- \`current\` - Get the current active chain

**Retrieval:**
- \`similar\` - Find similar past chains (requires taskDescription; optional taskType, limit)
- \`guidance\` - Get reasoning guidance for a task (requires taskDescription; optional taskType)
- \`chain\` - Get a specific chain by ID (requires chainId)
- \`chains\` - List recent chains (optional limit)

**Patterns:**
- \`patterns\` - List reasoning patterns (optional taskType)
- \`pattern\` - Get a specific pattern (requires patternId)

**Management:**
- \`stats\` - View reasoning memory statistics
- \`config\` - View configuration
- \`clear\` - Clear chains or patterns (target: "chains" or "patterns")
- \`reset\` - Reset to defaults
- \`help\` - Show this help message

### Example Usage

\`\`\`javascript
// Start a new reasoning chain
reasoningMemory({action: 'start', taskDescription: 'Add new tool for X', taskType: 'capability'})

// Add reasoning steps
reasoningMemory({action: 'step', stepType: 'analysis', content: 'Analyzed codebase...'})
reasoningMemory({action: 'step', stepType: 'decision', content: 'Decided to create new module'})
reasoningMemory({action: 'step', stepType: 'action', content: 'Created module', toolUsed: 'write', confidence: 0.9})

// Complete the chain
reasoningMemory({action: 'complete', outcome: 'success', filesModified: ['src/new-module.ts'], learnings: ['Pattern X works well']})

// Get guidance for a similar task
reasoningMemory({action: 'guidance', taskDescription: 'Add another tool for Y'})
\`\`\`

### Reasoning Step Types

1. **analysis** - Analyzing the problem or situation
2. **decision** - Making a decision about approach
3. **action** - Taking an action (using tools)
4. **observation** - Observing results
5. **conclusion** - Drawing conclusions`;
}

export default reasoningMemoryTool;
