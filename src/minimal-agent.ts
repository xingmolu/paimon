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
import {
	ModelRoulette,
	type RouletteConfig,
	type RouletteModel,
	getModelRoulette,
	resetModelRoulette,
} from "./model-roulette.js";
import {
	type TemplateConfig,
	getBaselineTemplate,
	getDefaultMinimalTemplate,
	renderTemplate,
} from "./templates.js";

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
	/** Baseline mode - clean, standardized configuration for RL/fine-tuning experiments */
	baseline?: boolean;
	/** Template configuration (Jinja-style templates for customization) */
	template?: TemplateConfig;
	/** Roulette configuration - random model switching (Mini-SWE-Agent pattern) */
	roulette?: RouletteConfig;
}

/**
 * Trajectory step for RL/fine-tuning experiments
 */
export interface TrajectoryStep {
	/** Step number in trajectory */
	step: number;
	/** User message that triggered this step */
	userMessage?: string;
	/** Assistant's thought/response */
	assistantResponse: string;
	/** Tool call made (if any) */
	toolCall?: {
		name: string;
		parameters: Record<string, unknown>;
	};
	/** Tool output (if tool was called) */
	toolOutput?: string;
	/** Timestamp */
	timestamp: string;
	/** Whether step resulted in error */
	isError?: boolean;
}

/**
 * Full trajectory for export
 */
export interface Trajectory {
	/** Trajectory metadata */
	metadata: {
		model: string;
		baseline: boolean;
		startTime: string;
		endTime: string;
		totalSteps: number;
		success: boolean;
	};
	/** All steps in trajectory */
	steps: TrajectoryStep[];
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
	private trajectory: Trajectory;
	private currentStep = 0;
	private agent: Agent;
	private config: MinimalAgentConfig;
	private readonly bashTool: AgentTool;
	private startTime: string;
	private roulette?: ModelRoulette;
	private currentRouletteModel?: RouletteModel;

	constructor(config: MinimalAgentConfig) {
		this.config = {
			maxIterations: 50,
			timeout: 120000,
			...config,
		};

		// Initialize roulette if configured
		if (this.config.roulette && this.config.roulette.models.length >= 2) {
			this.roulette = new ModelRoulette(this.config.roulette);
			// Select initial model
			const selection = this.roulette.selectModel();
			this.currentRouletteModel = selection.model;
			// Override model with roulette selection
			this.config.model = selection.model.id;
			if (selection.model.baseUrl) {
				this.config.baseUrl = selection.model.baseUrl;
			}
			if (selection.model.apiKey) {
				this.config.apiKey = selection.model.apiKey;
			}
		}

		// Initialize empty message history
		this.messages = [];
		this.startTime = new Date().toISOString();

		// Initialize trajectory tracking (for baseline mode)
		this.trajectory = {
			metadata: {
				model: this.config.model,
				baseline: this.config.baseline ?? false,
				startTime: this.startTime,
				endTime: "",
				totalSteps: 0,
				success: false,
			},
			steps: [],
		};

		// Create bash-only tool with trajectory tracking
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
				const timestamp = new Date().toISOString();

				try {
					const output = execSync(command, {
						encoding: "utf-8",
						timeout: this.config.timeout ?? 120000,
						maxBuffer: 10 * 1024 * 1024,
					});

					// Track in trajectory (baseline mode)
					if (this.config.baseline) {
						this.trajectory.steps.push({
							step: ++this.currentStep,
							assistantResponse: "",
							toolCall: { name: "bash", parameters: { command } },
							toolOutput: output || "(empty)",
							timestamp,
							isError: false,
						});
					}

					return {
						content: [{ type: "text", text: output || "(empty)" }],
						details: output,
					};
				} catch (e) {
					const error = e instanceof Error ? e.message : String(e);

					// Track error in trajectory (baseline mode)
					if (this.config.baseline) {
						this.trajectory.steps.push({
							step: ++this.currentStep,
							assistantResponse: "",
							toolCall: { name: "bash", parameters: { command } },
							toolOutput: `Error: ${error}`,
							timestamp,
							isError: true,
						});
					}

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

		// Set system prompt (use template if provided, baseline if config.baseline, else default)
		const systemPrompt = this.buildSystemPrompt();
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
			provider: "openai" as never,
			baseUrl: this.config.baseUrl,
			reasoning: false,
			input: ["text"],
			cost: {
				input: 0.002,
				output: 0.006,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 1000000,
			maxTokens: 16384,
		};
	}

	/**
	 * Build system prompt from template or defaults
	 */
	private buildSystemPrompt(): string {
		// If custom systemPrompt provided, use it directly
		if (this.config.systemPrompt) {
			return this.config.systemPrompt;
		}

		// Template variables
		const variables = {
			agent_name: this.config.baseline ? "baseline-agent" : "minimal-agent",
			agent_description: "A simple AI agent that solves problems using only shell commands",
			max_iterations: String(this.config.maxIterations ?? 50),
			timeout: String(this.config.timeout ?? 120000),
			model: this.config.model,
		};

		// If template config provided, use it
		if (this.config.template) {
			if (this.config.template.isFile) {
				return renderTemplate(readFileSync(this.config.template.template, "utf-8"), {
					...variables,
					...this.config.template.variables,
				});
			}
			return renderTemplate(this.config.template.template, {
				...variables,
				...this.config.template.variables,
			});
		}

		// Use baseline or default template
		const template = this.config.baseline ? getBaselineTemplate() : getDefaultMinimalTemplate();
		return renderTemplate(template, variables);
	}

	/**
	 * Default system prompt for minimal agent (legacy method)
	 * @deprecated Use buildSystemPrompt() instead
	 */
	private getDefaultSystemPrompt(): string {
		return renderTemplate(getDefaultMinimalTemplate(), {
			agent_name: "minimal-agent",
			agent_description: "A simple AI agent that solves problems using only shell commands",
			max_iterations: String(this.config.maxIterations ?? 50),
			timeout: String(this.config.timeout ?? 120000),
			model: this.config.model,
		});
	}

	/**
	 * Baseline system prompt for RL/fine-tuning experiments (legacy method)
	 * @deprecated Use buildSystemPrompt() instead
	 */
	private getBaselineSystemPrompt(): string {
		return renderTemplate(getBaselineTemplate(), {
			agent_name: "baseline-agent",
			model: this.config.model,
		});
	}

	/**
	 * Run the agent with a prompt (linear history - append only)
	 */
	async run(prompt: string, verbose = false): Promise<string> {
		// Add user message to linear history
		this.messages.push({ role: "user", content: prompt });

		// Track user message in trajectory (baseline mode)
		if (this.config.baseline) {
			this.trajectory.steps.push({
				step: ++this.currentStep,
				userMessage: prompt,
				assistantResponse: "",
				timestamp: new Date().toISOString(),
			});
		}

		return new Promise((resolve, reject) => {
			const outputs: string[] = [];
			const startTime = Date.now();

			// Timeout for safety
			const timeout = setTimeout(() => {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				reject(new Error(`Agent timeout after ${elapsed}s`));
			}, 2000000);

			// Disable verbose in baseline mode (clean output for experiments)
			const showVerbose = this.config.baseline ? false : verbose;

			if (showVerbose) {
				console.log(`[MinimalAgent] Starting run with ${this.messages.length} messages in history`);
			}

			this.agent.subscribe((event: AgentEvent) => {
				if (showVerbose) {
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

					// Update trajectory (baseline mode)
					if (this.config.baseline) {
						// Find last step with userMessage and add assistant response
						const lastUserStep = this.trajectory.steps.find(
							(s) => s.userMessage === prompt && !s.assistantResponse,
						);
						if (lastUserStep) {
							lastUserStep.assistantResponse = response;
						}

						// Update trajectory metadata
						this.trajectory.metadata.endTime = new Date().toISOString();
						this.trajectory.metadata.totalSteps = this.trajectory.steps.length;
						this.trajectory.metadata.success = response.includes("DONE");
					}

					if (showVerbose) {
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

					// Track error in trajectory (baseline mode)
					if (this.config.baseline) {
						this.trajectory.metadata.endTime = new Date().toISOString();
						this.trajectory.metadata.success = false;
					}

					reject(
						new Error((event.message as { errorMessage?: string }).errorMessage ?? "Unknown error"),
					);
				}
			});

			this.agent.prompt(prompt).catch((error) => {
				clearTimeout(timeout);

				// Track error in trajectory (baseline mode)
				if (this.config.baseline) {
					this.trajectory.metadata.endTime = new Date().toISOString();
					this.trajectory.metadata.success = false;
				}

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

	/**
	 * Get trajectory (for RL/fine-tuning experiments)
	 */
	getTrajectory(): Trajectory {
		return { ...this.trajectory };
	}

	/**
	 * Get trajectory as JSON (for export/RL training)
	 */
	getTrajectoryJson(): string {
		return JSON.stringify(this.trajectory, null, 2);
	}

	/**
	 * Save trajectory to file (for RL experiments)
	 */
	saveTrajectory(path: string): void {
		writeFileSync(path, this.getTrajectoryJson(), "utf-8");
	}

	/**
	 * Get trajectory in Mini-SWE-Agent format (for compatibility)
	 * Format: {input, trajectory: [{action, output}], result}
	 */
	getMiniSweFormat(): {
		input: string;
		trajectory: Array<{ action: string; output: string }>;
		result: string;
	} {
		const input = this.trajectory.steps.find((s) => s.userMessage)?.userMessage || "";
		const traj = this.trajectory.steps
			.filter((s) => s.toolCall)
			.map((s) => ({
				action: s.toolCall?.parameters.command as string,
				output: s.toolOutput || "",
			}));
		const result =
			this.trajectory.steps.find((s) => s.assistantResponse.includes("DONE"))?.assistantResponse ||
			"";

		return { input, trajectory: traj, result };
	}

	/**
	 * Check if baseline mode is enabled
	 */
	isBaseline(): boolean {
		return this.config.baseline ?? false;
	}

	/**
	 * Check if roulette mode is enabled
	 */
	isRoulette(): boolean {
		return this.roulette !== undefined;
	}

	/**
	 * Get current roulette model
	 */
	getCurrentRouletteModel(): RouletteModel | undefined {
		return this.currentRouletteModel;
	}

	/**
	 * Switch to next roulette model (called before each turn)
	 */
	switchRouletteModel(): RouletteModel | undefined {
		if (!this.roulette) return undefined;

		const selection = this.roulette.selectModel();
		this.currentRouletteModel = selection.model;

		// Update model configuration
		this.config.model = selection.model.id;
		if (selection.model.baseUrl) {
			this.config.baseUrl = selection.model.baseUrl;
		}
		if (selection.model.apiKey) {
			this.config.apiKey = selection.model.apiKey;
		}

		// Recreate model with new configuration
		const model = this.createModel();
		this.agent.setModel(model);

		return selection.model;
	}

	/**
	 * Record roulette success (after successful completion)
	 */
	recordRouletteSuccess(responseTime?: number, tokens?: number): void {
		if (this.roulette && this.currentRouletteModel) {
			this.roulette.recordSuccess(this.currentRouletteModel.id, responseTime, tokens);
		}
	}

	/**
	 * Record roulette failure (after error)
	 */
	recordRouletteFailure(responseTime?: number): void {
		if (this.roulette && this.currentRouletteModel) {
			this.roulette.recordFailure(this.currentRouletteModel.id, responseTime);
		}
	}

	/**
	 * Get roulette statistics
	 */
	getRouletteStats(): ReturnType<ModelRoulette["getStats"]> | undefined {
		return this.roulette?.getStats();
	}
}

/**
 * Create a minimal agent instance
 */
export function createMinimalAgent(config: MinimalAgentConfig): MinimalAgent {
	return new MinimalAgent(config);
}
