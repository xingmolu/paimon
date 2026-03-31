/**
 * Minimal Agent - Inspired by Mini-SWE-Agent (Princeton/Stanford)
 *
 * A simplified agent that uses only bash commands and linear message history.
 * This approach achieves comparable results to complex tool-based agents
 * with radical simplicity (~100 lines).
 *
 * Key patterns from Mini-SWE-Agent:
 * 1. No special tools - shell commands can do everything (cat, echo, find, etc.)
 * 2. Linear message history - append-only, great for debugging/fine-tuning
 * 3. Independent subprocess execution - no stateful shell session
 * 4. Template-based prompts - easy to customize
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
	Agent,
	type AgentEvent,
	type AgentTool,
	type AgentToolResult,
} from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

/**
 * Minimal agent configuration
 */
export interface MinimalAgentConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	systemPrompt?: string;
	maxIterations?: number;
	timeout?: number;
}

/**
 * Message in linear history
 */
export interface MinimalMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

/**
 * Minimal Agent class with only bash tool and linear history
 */
export class MinimalAgent {
	private messages: MinimalMessage[] = [];
	private agent: Agent;
	private config: MinimalAgentConfig;
	private readonly bashTool: AgentTool;

	constructor(config: MinimalAgentConfig) {
		this.config = {
			maxIterations: 50,
			timeout: 120000,
			...config,
		};

		// Initialize empty message history
		this.messages = [];

		// Create bash-only tool
		this.bashTool = {
			name: "bash",
			label: "Execute Shell Command",
			description:
				"Execute a shell command. Use for all operations: read files (cat), write files (echo >), search (grep), etc.",
			parameters: Type.Object({
				command: Type.String({ description: "The shell command to execute" }),
			}),
			execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
				const { command } = params as { command: string };
				try {
					const output = execSync(command, {
						encoding: "utf-8",
						timeout: this.config.timeout ?? 120000,
						maxBuffer: 10 * 1024 * 1024,
					});
					return {
						content: [{ type: "text", text: output || "(empty)" }],
						details: output,
					};
				} catch (e) {
					const error = e instanceof Error ? e.message : String(e);
					return {
						content: [{ type: "text", text: `Error: ${error}` }],
						details: `Error: ${error}`,
					};
				}
			},
		};

		// Create the core agent with bash only
		this.agent = new Agent();
		this.agent.setTools([this.bashTool]);
		this.agent.getApiKey = () => this.config.apiKey;

		// Set system prompt (use default if not provided)
		const systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
		this.agent.setSystemPrompt(systemPrompt);
		this.messages.push({ role: "system", content: systemPrompt });

		// Create model
		const model = this.createModel();
		this.agent.setModel(model);
	}

	/**
	 * Create model from configuration
	 */
	private createModel(): Model<Api> {
		return {
			api: "openai" as Api,
			id: this.config.model,
			name: this.config.model,
			provider: "dashscope" as never,
			baseUrl: this.config.baseUrl,
			reasoning: false,
			input: ["text"],
			cost: {
				input: 0.002,
				output: 0.006,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 128000,
			maxTokens: 8192,
		};
	}

	/**
	 * Default system prompt for minimal agent
	 */
	private getDefaultSystemPrompt(): string {
		return `---
name: minimal-agent
description: A simple AI agent that solves problems using only shell commands
tools: [bash]
---

You are a minimal AI agent that solves problems using only bash commands.

## Available Commands
You have access to a single tool: bash. Use it for ALL operations:
- Read files: \`cat filename\` or \`head -n filename\`
- Write files: \`echo 'content' > filename\` or \`cat > filename << 'EOF'\\ncontent\\nEOF\`
- Edit files: \`sed -i 's/old/new/g' filename\`
- Search files: \`grep -r 'pattern' .\` or \`find . -name '*.ts'\`
- List files: \`ls -la\` or \`find . -type f\`
- Run tests: \`npm test\` or \`npm run build\`
- Check git: \`git status\` or \`git log\`

## Workflow
1. Understand the task
2. Explore the codebase with shell commands
3. Make changes using sed/echo/cat
4. Verify with npm run build && npm test
5. Report results

## Rules
- One command at a time
- Always verify changes before claiming completion
- Report errors clearly
- Keep changes minimal

When done, say "DONE" and summarize what you accomplished.`;
	}

	/**
	 * Run the agent with a prompt (linear history - append only)
	 */
	async run(prompt: string, verbose = false): Promise<string> {
		// Add user message to linear history
		this.messages.push({ role: "user", content: prompt });

		return new Promise((resolve, reject) => {
			const outputs: string[] = [];
			const startTime = Date.now();

			// Timeout for safety
			const timeout = setTimeout(() => {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				reject(new Error(`Agent timeout after ${elapsed}s`));
			}, 2000000);

			if (verbose) {
				console.log(`[MinimalAgent] Starting run with ${this.messages.length} messages in history`);
			}

			this.agent.subscribe((event: AgentEvent) => {
				if (verbose) {
					console.log(`[MinimalAgent] Event: ${event.type}`);
				}

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
					const response = outputs.join("");
					// Add assistant message to linear history
					this.messages.push({ role: "assistant", content: response });

					if (verbose) {
						const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
						console.log(
							`[MinimalAgent] Completed in ${elapsed}s, history now has ${this.messages.length} messages`,
						);
					}
					resolve(response);
				}

				if (
					event.type === "turn_end" &&
					(event.message as { errorMessage?: string }).errorMessage
				) {
					clearTimeout(timeout);
					reject(
						new Error((event.message as { errorMessage?: string }).errorMessage ?? "Unknown error"),
					);
				}
			});

			this.agent.prompt(prompt).catch((error) => {
				clearTimeout(timeout);
				reject(error);
			});
		});
	}

	/**
	 * Get linear message history (for debugging/fine-tuning)
	 */
	getHistory(): MinimalMessage[] {
		return [...this.messages];
	}

	/**
	 * Get history as JSON (for export/fine-tuning)
	 */
	getHistoryJson(): string {
		return JSON.stringify(this.messages, null, 2);
	}

	/**
	 * Clear history (start fresh session)
	 */
	clearHistory(): void {
		// Keep system message, clear user/assistant messages
		this.messages = this.messages.filter((m) => m.role === "system");
	}

	/**
	 * Save history to file (for session persistence)
	 */
	saveHistory(path: string): void {
		writeFileSync(path, this.getHistoryJson(), "utf-8");
	}

	/**
	 * Load history from file (for session resume)
	 */
	loadHistory(path: string): void {
		if (existsSync(path)) {
			const data = readFileSync(path, "utf-8");
			this.messages = JSON.parse(data) as MinimalMessage[];
		}
	}

	/**
	 * Set custom system prompt (for template-based customization)
	 */
	setSystemPrompt(prompt: string): void {
		this.agent.setSystemPrompt(prompt);
		// Replace system message in history
		this.messages = this.messages.filter((m) => m.role !== "system");
		this.messages.unshift({ role: "system", content: prompt });
	}
}

/**
 * Create a minimal agent instance
 */
export function createMinimalAgent(config: MinimalAgentConfig): MinimalAgent {
	return new MinimalAgent(config);
}
