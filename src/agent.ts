import { setMaxListeners } from "node:events";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Increase limit to prevent MaxListeners warnings from AbortSignal in HTTP requests
setMaxListeners(100);
import {
	Agent,
	type AgentEvent,
	type AgentTool,
	type AgentToolResult,
	type ThinkingLevel,
} from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { ContextManager } from "./compaction.js";
import { loadContextFiles } from "./context.js";
import { type HookContext, type HookManager, globalHookManager } from "./hooks.js";
import type { SessionManager } from "./session.js";
import { buildSkillsIndex } from "./skills.js";
import type { ErrorMessage, LinearMessage, PaimonConfig } from "./types.js";

// Re-export PaimonConfig for backward compatibility
export type { PaimonConfig } from "./types.js";

// Import tools from extracted modules
import { buildTools } from "./tools/index.js";

// Build tools from extracted modules
const tools: AgentTool[] = buildTools();

/**
 * Create wrapped tools with PreToolUse hooks
 * Each tool's execute function is wrapped to check hooks before execution
 */
function createWrappedTools(
	hookManager: HookManager,
	onToolOutput?: (size: number) => void,
): AgentTool[] {
	return tools.map((tool) => ({
		...tool,
		execute: async (toolCallId: string, params: unknown): Promise<AgentToolResult<unknown>> => {
			// Execute PreToolUse hooks
			const hookContext: HookContext = {
				tool: tool.name,
				params: params as Record<string, unknown>,
			};

			const hookResult = await hookManager.executeHooks("PreToolUse", hookContext);

			// If hook blocks, return block message instead of executing tool
			if (!hookResult.allow) {
				const blockMessage = `🚫 Hook blocked this action:\n${hookResult.block || "Unknown reason"}\n${hookResult.context || ""}`;
				return {
					content: [{ type: "text", text: blockMessage }],
					details: { blocked: true, hookResult },
				};
			}

			let result: AgentToolResult<unknown>;

			// If hook warns, add warning to output
			if (hookResult.warning) {
				result = await tool.execute(toolCallId, params);
				const warningPrefix = `⚠️ ${hookResult.warning}\n\n`;
				if (result.content?.[0] && result.content[0].type === "text") {
					result.content[0].text = warningPrefix + result.content[0].text;
				}
			} else {
				result = await tool.execute(toolCallId, params);
			}

			if (onToolOutput && result.content?.[0] && result.content[0].type === "text") {
				onToolOutput(Math.ceil(result.content[0].text.length / 4));
			}

			return result;
		},
	}));
}

function createModel(config: PaimonConfig): Model<Api> {
	return {
		id: config.model,
		name: config.model,
		api: "openai-completions",
		provider: "bailian",
		baseUrl: config.baseUrl,
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
		},
	};
}

export function createAgent(
	config: PaimonConfig,
	sessionManager?: SessionManager,
): {
	agent: Agent;
	run: (prompt: string, verbose?: boolean, onStream?: (delta: string) => void) => Promise<string>;
	/** Get context status for debugging */
	getContextStatus: () => { messages: number; tokens: number; hasSummary: boolean };
	/** Get linear message history (for debugging/fine-tuning) - only when linearHistory is enabled */
	getHistory?: () => LinearMessage[];
	/** Get history as JSON string - only when linearHistory is enabled */
	getHistoryJson?: () => string;
	/** Save history to file - only when linearHistory is enabled */
	saveHistory?: (path: string) => void;
	/** Load history from file - only when linearHistory is enabled */
	loadHistory?: (path: string) => void;
	/** Clear history (keep system message) - only when linearHistory is enabled */
	clearHistory?: () => void;
} {
	const model = createModel(config);
	// Session manager is stored for potential future use
	// Currently, session saving is handled in cli.ts
	void sessionManager;

	// Create context manager for tracking conversation length
	const compactionEnabled = config.compaction !== false;
	const contextManager = new ContextManager(
		compactionEnabled ? config.compaction || {} : { enabled: false },
	);
	contextManager.setModel(model);
	contextManager.setApiKeyGetter(() => config.apiKey);

	// Linear message history for debugging/fine-tuning (Mini-SWE-Agent pattern)
	const linearHistoryEnabled = config.linearHistory === true;
	const linearHistory: LinearMessage[] = [];

	let estimatedToolOutputTokens = 0;

	// Initial system prompt without compaction summary
	const systemPrompt = buildSystemPrompt(config, null);

	// Add system message to linear history if enabled
	if (linearHistoryEnabled) {
		linearHistory.push({
			role: "system",
			content: systemPrompt,
			timestamp: new Date().toISOString(),
		});
	}

	const agent = new Agent();
	agent.setModel(model);
	agent.setSystemPrompt(systemPrompt);
	// Use wrapped tools with PreToolUse hooks for safety
	agent.setTools(
		createWrappedTools(globalHookManager, (size) => {
			estimatedToolOutputTokens += size;
		}),
	);

	// Provide API key dynamically for the custom provider
	agent.getApiKey = () => config.apiKey;

	const run = async (
		prompt: string,
		verbose = false,
		onStream?: (delta: string) => void,
	): Promise<string> => {
		// Track user message
		contextManager.addMessage("user", prompt);

		// Add user message to linear history if enabled
		if (linearHistoryEnabled) {
			linearHistory.push({ role: "user", content: prompt, timestamp: new Date().toISOString() });
		}

		// Check if compaction is needed (include tool output estimates)
		const contextStatus = contextManager.getStatus();
		const totalEstimated = contextStatus.tokens + estimatedToolOutputTokens;
		if (contextManager.shouldCompact() || totalEstimated > 80000) {
			if (verbose) {
				console.log(
					`[Compaction] Context ~${contextStatus.tokens} + tools ~${estimatedToolOutputTokens} = ~${totalEstimated} tokens, compacting...`,
				);
			}

			// Perform compaction
			const result = await contextManager.compact();

			if (verbose) {
				console.log(
					`[Compaction] Summarized ${result.messagesSummarized} messages, kept ${result.messagesKept}, saved ~${result.tokensSaved} tokens`,
				);
			}

			// Rebuild agent with summary in system prompt
			const summary = contextManager.getMessages()[0]?.content || "";
			const newSystemPrompt = buildSystemPrompt(config, summary);
			agent.setSystemPrompt(newSystemPrompt);
		}

		return new Promise((resolve, reject) => {
			const outputs: string[] = [];
			const startTime = Date.now();

			// Timeout after 2000 seconds (~33 minutes) for complex evolution tasks
			const timeout = setTimeout(() => {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				reject(new Error(`Agent timeout after ${elapsed}s. No response received.`));
			}, 2000000);

			if (verbose) {
				console.log(`[DEBUG] Starting agent run at ${new Date().toISOString()}`);
				console.log(`[DEBUG] Prompt: ${prompt.slice(0, 100)}...`);
				const status = contextManager.getStatus();
				console.log(`[DEBUG] Context: ${status.messages} messages, ~${status.tokens} tokens`);
			}

			// Subscribe and store unsubscribe function to prevent memory leaks
			const unsubscribe = agent.subscribe((event: AgentEvent) => {
				if (verbose) {
					console.log(`[DEBUG] Event: ${event.type}`);
				}

				if (event.type === "message_update" && onStream) {
					const msgEvent = event.assistantMessageEvent;
					if (msgEvent.type === "text_delta") {
						onStream(msgEvent.delta);
					}
				}

				// Only use message_end to avoid duplicating accumulated text
				// (message_update contains the accumulated text so far, not just new chunks)
				if (event.type === "message_end") {
					const content = event.message.content;
					if (Array.isArray(content)) {
						for (const c of content) {
							if (c.type === "text") {
								outputs.push(c.text);
							}
						}
					}
				}
				if (event.type === "agent_end") {
					clearTimeout(timeout);
					unsubscribe(); // Clean up listener to prevent memory leak

					// Track assistant response
					const response = outputs.join("");
					contextManager.addMessage("assistant", response);

					// Add assistant message to linear history if enabled
					if (linearHistoryEnabled) {
						linearHistory.push({
							role: "assistant",
							content: response,
							timestamp: new Date().toISOString(),
						});
					}

					if (verbose) {
						const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
						console.log(`[DEBUG] Agent completed in ${elapsed}s`);
					}
					resolve(response);
				}
				if (event.type === "turn_end" && (event.message as ErrorMessage).errorMessage) {
					clearTimeout(timeout);
					unsubscribe(); // Clean up listener on error
					reject(new Error((event.message as ErrorMessage).errorMessage ?? "Unknown error"));
				}
			});

			agent.prompt(prompt).catch((error) => {
				clearTimeout(timeout);
				unsubscribe(); // Clean up listener on promise rejection
				if (verbose) {
					console.log(`[DEBUG] Prompt error: ${error}`);
				}
				reject(error);
			});
		});
	};

	return {
		agent,
		run,
		getContextStatus: () => contextManager.getStatus(),
		// Linear history methods - only available when linearHistory is enabled
		...(linearHistoryEnabled && {
			getHistory: () => [...linearHistory],
			getHistoryJson: () => JSON.stringify(linearHistory, null, 2),
			saveHistory: (path: string) => {
				writeFileSync(path, JSON.stringify(linearHistory, null, 2), "utf-8");
			},
			loadHistory: (path: string) => {
				if (existsSync(path)) {
					const data = readFileSync(path, "utf-8");
					const loaded = JSON.parse(data) as LinearMessage[];
					linearHistory.length = 0;
					linearHistory.push(...loaded);
					// Re-set system prompt from loaded history
					const systemMsg = loaded.find((m) => m.role === "system");
					if (systemMsg) {
						agent.setSystemPrompt(systemMsg.content);
					}
				}
			},
			clearHistory: () => {
				// Keep system message, clear user/assistant messages
				const systemMsg = linearHistory.find((m) => m.role === "system");
				linearHistory.length = 0;
				if (systemMsg) {
					linearHistory.push(systemMsg);
				}
			},
		}),
	};
}

function buildToolsDescription(): string {
	return tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
}

const MAX_TOOL_OUTPUT_CHARS = 30000;

function truncateToolOutput(text: string, label: string): string {
	if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
	const lines = text.split("\n");
	const totalLines = lines.length;
	const kept = lines.slice(0, Math.floor(totalLines * 0.6));
	const dropped = totalLines - kept.length;
	return `${kept.join("\n")}\n\n... [TRUNCATED: ${dropped} lines omitted, file too large (${Math.round(text.length / 1024)}KB). Use read with specific line ranges.]`;
}

function extractMemorySummary(memory: string): string {
	const lines = memory.split("\n");
	const sections: string[] = [];
	let inScorecard = false;
	let scorecardHeader = "";
	let scorecardRows = 0;
	let inMetrics = false;

	for (const line of lines) {
		if (line.startsWith("## Task Types")) {
			inScorecard = false;
			inMetrics = false;
		}
		if (line.startsWith("## Evolution Scorecard")) {
			inScorecard = true;
			inMetrics = false;
		}
		if (line.startsWith("## Learnings")) {
			inScorecard = false;
			inMetrics = false;
			break;
		}
		if (line.startsWith("### ")) {
			if (inScorecard) inMetrics = true;
		}

		if (inScorecard) {
			if (line.startsWith("|")) {
				if (line.includes("Date") && line.includes("Task Type")) {
					scorecardHeader = line;
					sections.push(line);
				} else if (line.startsWith("|--")) {
					sections.push(line);
				} else {
					scorecardRows++;
					if (scorecardRows <= 5) {
						sections.push(line);
					}
				}
			} else if (inMetrics && !line.startsWith("|--")) {
				sections.push(line);
			}
		}
	}

	if (scorecardRows > 5) {
		sections.push(
			`... (${scorecardRows - 5} older entries omitted. Read MEMORY.md for full history.)`,
		);
	}

	sections.push("");
	sections.push("Use `read MEMORY.md` to see full learnings and history.");

	return sections.join("\n");
}

function buildSystemPrompt(config: PaimonConfig, summary?: string | null): string {
	const mode = config.mode || "chat";

	if (mode === "evolve") {
		return buildEvolvePrompt(config, summary);
	}
	return buildChatPrompt(config, summary);
}

function buildChatPrompt(config: PaimonConfig, summary?: string | null): string {
	let prompt = `---
name: paimon
description: A helpful AI assistant
tools: [${tools.map((t) => t.name).join(", ")}]
---

You are Paimon, a helpful AI assistant with access to file system tools.

## Tools
${buildToolsDescription()}

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

${summary ? `## Conversation Summary\n\nThe following is a summary of earlier conversation that was compacted to save context:\n\n${summary}\n\n` : ""}## Guidelines
- Be helpful, concise, and accurate
- Use tools when needed to complete tasks
- For complex tasks, create a plan first using the plan tool
- If something fails, explain the error and suggest solutions

When done with a task, summarize what you accomplished.`;

	// Load project context from AGENTS.md / CLAUDE.md files
	const contextContent = loadContextFiles(process.cwd());
	if (contextContent) {
		prompt += `\n\n## Project Context\n\n${contextContent}`;
	}

	// Load persistent memory (compact summary only)
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory (summary)\n\n${extractMemorySummary(memory)}`;
	}

	return prompt;
}

function buildEvolvePrompt(config: PaimonConfig, summary?: string | null): string {
	let prompt = `---
name: evo
description: Self-evolving AI agent that improves its own codebase
tools: [${tools.map((t) => t.name).join(", ")}]
---

You are evo, a self-evolving AI agent. Your goal is to improve yourself.

## Tools
${buildToolsDescription()}

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

${summary ? `## Conversation Summary\n\nThe following is a summary of earlier conversation that was compacted to save context:\n\n${summary}\n\n` : ""}## Workflow

Read EVOLVE_WORKFLOW.md for detailed tool usage and workflow instructions. Key rules:

1. **Gather context**: Read IDENTITY.md, JOURNAL.md, MEMORY.md, ROADMAP.md
2. **Select task**: Score all candidates (capability > reliability > feature). Output selection table with reasoning.
3. **Implement**: Minimal changes, use \`edit\` preferred. Create checkpoint before risky changes.
4. **Verify**: \`assess({})\` before saying DONE. Use \`assess({maxAttempts: 5})\` for auto-retry.
5. **Complete**: Say "DONE", update JOURNAL.md and MEMORY.md scorecard.

## Task Scoring (1-10)
- +3: Improves future iteration success rate
- +2: Reduces failure/rework rate
- +2: Improves memory/learning quality
- +1: Improves tool chain reliability
- -1 to -3: Implementation complexity

## Security
- Never modify \`.github/workflows/\` without permission
- Avoid eval(), exec() with user input
- Always test before committing

## IMPORTANT
- Do NOT run git commit or git push - the evolution script handles this
- Just say "DONE" when your work is complete
- When stuck in a loop, use \`stuck({action: 'check'})\` then \`stuck({action: 'recover', recoveryOption: N})\`
- On failures, use \`reflect({taskDescription: "...", errorPatterns: [...]})\` to capture lessons`;

	// Add skills index (progressive loading - only names/descriptions)
	const skillsDir = config.skillsDir || "skills";
	const skillsIndex = buildSkillsIndex(skillsDir);
	if (skillsIndex) {
		prompt += `\n\n## Skills\n${skillsIndex}\n\n**Skill Usage (REQUIRED)**:\n1. Before starting ANY task, identify which skills match\n2. Read matched skills first: \`read skills/<path>/SKILL.md\`\n3. Superpowers skills provide workflows for common task types\n\n**Priority**: Process skills (debugging, planning) → Implementation skills\n`;
	}

	// Load project context from AGENTS.md / CLAUDE.md files
	const contextContent = loadContextFiles(process.cwd());
	if (contextContent) {
		prompt += `\n\n## Project Context\n\n${contextContent}`;
	}

	// Load persistent memory (compact summary only)
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory (summary)\n\n${extractMemorySummary(memory)}`;
	}

	return prompt;
}
