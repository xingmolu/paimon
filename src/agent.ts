import { setMaxListeners } from "node:events";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Increase limit to prevent MaxListeners warnings from AbortSignal in HTTP requests
setMaxListeners(100);

import { Agent, type AgentEvent, type AgentTool } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { ContextManager } from "./compaction.js";
import { globalHookManager } from "./hooks.js";
import { buildSystemPrompt } from "./prompt.js";
import type { SessionManager } from "./session.js";
import type { ErrorMessage, LinearMessage, PaimonConfig } from "./types.js";
import { createWrappedTools } from "./wrap.js";

// Import tools from extracted modules
import { buildTools } from "./tools/index.js";

// Re-export PaimonConfig for backward compatibility
export type { PaimonConfig } from "./types.js";

// Build tools from extracted modules
const tools: AgentTool[] = buildTools();

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
	const systemPrompt = buildSystemPrompt(config, tools, null);

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
		createWrappedTools(tools, globalHookManager, (size) => {
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
			const newSystemPrompt = buildSystemPrompt(config, tools, summary);
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
