/**
 * Reasoning Model Support Module (Aider Pattern)
 *
 * Provides configuration and support for reasoning models like:
 * - OpenAI o1, o3, o3-mini (reasoning_effort: low/medium/high)
 * - Anthropic Claude 3.7 Sonnet Extended Thinking (thinking_tokens budget)
 * - DeepSeek R1 (reasoning in <think>...</think> tags)
 *
 * Reasoning models have specific limitations:
 * - Many don't support temperature
 * - Some don't support streaming
 * - Some don't support system prompts
 *
 * Inspired by Aider's reasoning model configuration
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface ReasoningModelConfig {
	name: string;
	provider: string;
	editFormat: string;
	weakModelName?: string;
	useRepoMap: boolean;
	useTemperature: boolean;
	streaming: boolean;
	useSystemPrompt: boolean;
	editorModelName?: string;
	editorEditFormat?: string;
	extraParams?: Record<string, unknown>;
	acceptsSettings: ("reasoning_effort" | "thinking_tokens")[];
	reasoningTag?: string;
	maxTokens?: number;
}

export interface ReasoningSettings {
	reasoningEffort?: "low" | "medium" | "high";
	thinkingTokens?: number;
}

export interface ReasoningModelStats {
	totalModels: number;
	modelsByProvider: Record<string, number>;
	modelsBySetting: Record<string, number>;
	activeModel?: string;
	activeSettings?: ReasoningSettings;
}

export interface ReasoningModelManagerConfig {
	enabled: boolean;
	settingsPath: string;
	activeModel?: string;
	activeSettings: ReasoningSettings;
	checkModelAcceptsSettings: boolean;
}

// Default reasoning model configurations
const DEFAULT_REASONING_MODELS: ReasoningModelConfig[] = [
	// OpenAI reasoning models
	{
		name: "o3-mini",
		provider: "openai",
		editFormat: "diff",
		weakModelName: "gpt-4o-mini",
		useRepoMap: true,
		useTemperature: false,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "gpt-4o",
		editorEditFormat: "editor-diff",
		acceptsSettings: ["reasoning_effort"],
	},
	{
		name: "o3",
		provider: "openai",
		editFormat: "diff",
		weakModelName: "gpt-4o-mini",
		useRepoMap: true,
		useTemperature: false,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "gpt-4o",
		editorEditFormat: "editor-diff",
		acceptsSettings: ["reasoning_effort"],
	},
	{
		name: "o1",
		provider: "openai",
		editFormat: "diff",
		weakModelName: "gpt-4o-mini",
		useRepoMap: true,
		useTemperature: false,
		streaming: false,
		useSystemPrompt: false,
		editorModelName: "gpt-4o",
		editorEditFormat: "editor-diff",
		acceptsSettings: [],
	},
	{
		name: "o1-preview",
		provider: "openai",
		editFormat: "diff",
		weakModelName: "gpt-4o-mini",
		useRepoMap: true,
		useTemperature: false,
		streaming: false,
		useSystemPrompt: false,
		editorModelName: "gpt-4o",
		editorEditFormat: "editor-diff",
		acceptsSettings: [],
	},
	{
		name: "o1-mini",
		provider: "openai",
		editFormat: "diff",
		weakModelName: "gpt-4o-mini",
		useRepoMap: true,
		useTemperature: false,
		streaming: false,
		useSystemPrompt: false,
		editorModelName: "gpt-4o",
		editorEditFormat: "editor-diff",
		acceptsSettings: [],
	},
	// Anthropic reasoning models
	{
		name: "claude-3-7-sonnet",
		provider: "anthropic",
		editFormat: "diff",
		weakModelName: "claude-3-5-haiku",
		useRepoMap: true,
		useTemperature: true,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "claude-3-5-sonnet",
		editorEditFormat: "editor-diff",
		acceptsSettings: ["thinking_tokens"],
		maxTokens: 64000,
	},
	{
		name: "claude-sonnet-4",
		provider: "anthropic",
		editFormat: "diff",
		weakModelName: "claude-3-5-haiku",
		useRepoMap: true,
		useTemperature: true,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "claude-3-5-sonnet",
		editorEditFormat: "editor-diff",
		acceptsSettings: ["thinking_tokens"],
		maxTokens: 128000,
	},
	// DeepSeek reasoning models
	{
		name: "deepseek-reasoner",
		provider: "deepseek",
		editFormat: "diff",
		weakModelName: "deepseek-chat",
		useRepoMap: true,
		useTemperature: false,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "deepseek-chat",
		editorEditFormat: "editor-diff",
		acceptsSettings: [],
		reasoningTag: "think",
		maxTokens: 160000,
	},
	{
		name: "deepseek-r1",
		provider: "deepseek",
		editFormat: "diff",
		weakModelName: "deepseek-chat",
		useRepoMap: true,
		useTemperature: false,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "deepseek-chat",
		editorEditFormat: "editor-diff",
		acceptsSettings: [],
		reasoningTag: "think",
		maxTokens: 160000,
	},
	// Fireworks DeepSeek R1
	{
		name: "fireworks_ai/accounts/fireworks/models/deepseek-r1",
		provider: "fireworks",
		editFormat: "diff",
		weakModelName: "fireworks_ai/accounts/fireworks/models/deepseek-v3",
		useRepoMap: true,
		useTemperature: false,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "fireworks_ai/accounts/fireworks/models/deepseek-v3",
		editorEditFormat: "editor-diff",
		acceptsSettings: [],
		reasoningTag: "think",
		maxTokens: 160000,
	},
	// OpenRouter models
	{
		name: "openrouter/deepseek/deepseek-r1",
		provider: "openrouter",
		editFormat: "diff",
		weakModelName: "openrouter/deepseek/deepseek-chat",
		useRepoMap: true,
		useTemperature: false,
		streaming: true,
		useSystemPrompt: true,
		editorModelName: "openrouter/deepseek/deepseek-chat",
		editorEditFormat: "editor-diff",
		acceptsSettings: [],
		reasoningTag: "think",
		maxTokens: 160000,
	},
];

const DEFAULT_CONFIG: ReasoningModelManagerConfig = {
	enabled: true,
	settingsPath: "",
	activeSettings: {},
	checkModelAcceptsSettings: true,
};

let managerInstance: ReasoningModelSupportManager | null = null;

export class ReasoningModelSupportManager {
	private config: ReasoningModelManagerConfig;
	private models: Map<string, ReasoningModelConfig>;
	private customModels: Map<string, ReasoningModelConfig>;
	private dataPath: string;
	private stats: ReasoningModelStats;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "reasoning-models.json");
		this.models = new Map();
		this.customModels = new Map();
		this.stats = {
			totalModels: 0,
			modelsByProvider: {},
			modelsBySetting: {},
		};

		// Load default models
		for (const model of DEFAULT_REASONING_MODELS) {
			this.models.set(model.name.toLowerCase(), model);
		}

		this.loadConfig();
		this.loadData();
		this.updateStats();
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || ".";
			const configPath = path.join(homeDir, ".paimon", "reasoning-model-config.json");
			if (fs.existsSync(configPath)) {
				const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...loaded };
			}
		} catch {
			// Use defaults
		}
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				if (data.customModels) {
					for (const model of data.customModels) {
						this.customModels.set(model.name.toLowerCase(), model);
					}
				}
				this.stats = { ...this.stats, ...data.stats };
			}
		} catch {
			// Start fresh
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						config: this.config,
						customModels: Array.from(this.customModels.values()),
						stats: this.stats,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save reasoning model data:", error);
		}
	}

	private updateStats(): void {
		const allModels = [...this.models.values(), ...this.customModels.values()];
		this.stats.totalModels = allModels.length;

		this.stats.modelsByProvider = {};
		for (const model of allModels) {
			this.stats.modelsByProvider[model.provider] =
				(this.stats.modelsByProvider[model.provider] || 0) + 1;
		}

		this.stats.modelsBySetting = {};
		for (const model of allModels) {
			for (const setting of model.acceptsSettings) {
				this.stats.modelsBySetting[setting] = (this.stats.modelsBySetting[setting] || 0) + 1;
			}
		}
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public getConfig(): ReasoningModelManagerConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<ReasoningModelManagerConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	/**
	 * Check if a model is a reasoning model
	 */
	public isReasoningModel(modelName: string): boolean {
		const normalizedName = modelName.toLowerCase();
		return (
			this.models.has(normalizedName) ||
			this.customModels.has(normalizedName) ||
			this.detectReasoningModel(modelName) !== null
		);
	}

	/**
	 * Detect reasoning model from name patterns
	 */
	private detectReasoningModel(modelName: string): ReasoningModelConfig | null {
		const name = modelName.toLowerCase();

		// OpenAI o-series
		if (name.match(/o[13](-mini|-preview)?$/)) {
			return {
				name: modelName,
				provider: "openai",
				editFormat: "diff",
				useRepoMap: true,
				useTemperature: false,
				streaming: !name.includes("o1"),
				useSystemPrompt: !name.includes("o1"),
				acceptsSettings: name.includes("o3") ? ["reasoning_effort"] : [],
			};
		}

		// DeepSeek R1
		if (name.includes("deepseek") && (name.includes("r1") || name.includes("reasoner"))) {
			return {
				name: modelName,
				provider: "deepseek",
				editFormat: "diff",
				useRepoMap: true,
				useTemperature: false,
				streaming: true,
				useSystemPrompt: true,
				acceptsSettings: [],
				reasoningTag: "think",
				maxTokens: 160000,
			};
		}

		// Claude with extended thinking
		if (
			name.includes("claude") &&
			(name.includes("sonnet") || name.includes("opus")) &&
			(name.includes("3-7") || name.includes("4") || name.includes("3.7"))
		) {
			return {
				name: modelName,
				provider: "anthropic",
				editFormat: "diff",
				useRepoMap: true,
				useTemperature: true,
				streaming: true,
				useSystemPrompt: true,
				acceptsSettings: ["thinking_tokens"],
			};
		}

		return null;
	}

	/**
	 * Get model configuration
	 */
	public getModel(modelName: string): ReasoningModelConfig | null {
		const normalizedName = modelName.toLowerCase();
		return (
			this.models.get(normalizedName) ||
			this.customModels.get(normalizedName) ||
			this.detectReasoningModel(modelName)
		);
	}

	/**
	 * Add custom reasoning model configuration
	 */
	public addModel(config: ReasoningModelConfig): void {
		this.customModels.set(config.name.toLowerCase(), config);
		this.updateStats();
		this.saveData();
	}

	/**
	 * Remove custom model configuration
	 */
	public removeModel(modelName: string): boolean {
		const normalizedName = modelName.toLowerCase();
		const result = this.customModels.delete(normalizedName);
		if (result) {
			this.updateStats();
			this.saveData();
		}
		return result;
	}

	/**
	 * List all reasoning models
	 */
	public listModels(): ReasoningModelConfig[] {
		return [...this.models.values(), ...this.customModels.values()];
	}

	/**
	 * Get models by provider
	 */
	public getModelsByProvider(provider: string): ReasoningModelConfig[] {
		return this.listModels().filter((m) => m.provider === provider);
	}

	/**
	 * Get models that accept a specific setting
	 */
	public getModelsBySetting(
		setting: "reasoning_effort" | "thinking_tokens",
	): ReasoningModelConfig[] {
		return this.listModels().filter((m) => m.acceptsSettings.includes(setting));
	}

	/**
	 * Set active model and settings
	 */
	public setActiveModel(modelName: string, settings?: ReasoningSettings): boolean {
		const model = this.getModel(modelName);
		if (!model) return false;

		// Validate settings against model's accepted settings
		if (this.config.checkModelAcceptsSettings && settings) {
			const validSettings: ReasoningSettings = {};

			if (settings.reasoningEffort && model.acceptsSettings.includes("reasoning_effort")) {
				validSettings.reasoningEffort = settings.reasoningEffort;
			}

			if (
				settings.thinkingTokens !== undefined &&
				model.acceptsSettings.includes("thinking_tokens")
			) {
				validSettings.thinkingTokens = settings.thinkingTokens;
			}

			this.config.activeSettings = validSettings;
		} else if (settings) {
			this.config.activeSettings = settings;
		}

		this.config.activeModel = modelName;
		this.stats.activeModel = modelName;
		this.stats.activeSettings = this.config.activeSettings;
		this.saveData();

		return true;
	}

	/**
	 * Get active model and settings
	 */
	public getActiveModel(): { model: string; settings: ReasoningSettings } | null {
		if (!this.config.activeModel) return null;
		return {
			model: this.config.activeModel,
			settings: this.config.activeSettings,
		};
	}

	/**
	 * Validate settings for a model
	 */
	public validateSettings(
		modelName: string,
		settings: ReasoningSettings,
	): { valid: boolean; warnings: string[] } {
		const model = this.getModel(modelName);
		const warnings: string[] = [];

		if (!model) {
			return { valid: false, warnings: [`Unknown model: ${modelName}`] };
		}

		if (settings.reasoningEffort && !model.acceptsSettings.includes("reasoning_effort")) {
			warnings.push(
				`${modelName} does not support 'reasoning_effort', ignoring. Use checkModelAcceptsSettings: false to force.`,
			);
		}

		if (
			settings.thinkingTokens !== undefined &&
			!model.acceptsSettings.includes("thinking_tokens")
		) {
			warnings.push(
				`${modelName} does not support 'thinking_tokens', ignoring. Use checkModelAcceptsSettings: false to force.`,
			);
		}

		return {
			valid: warnings.length === 0 || !this.config.checkModelAcceptsSettings,
			warnings,
		};
	}

	/**
	 * Parse thinking tokens string (e.g., "8k", "0.01M", "1024")
	 */
	public parseThinkingTokens(value: string): number {
		const match = value.match(/^(\d+(?:\.\d+)?)(k|m)?$/i);
		if (!match) return 0;

		const num = Number.parseFloat(match[1]);
		const multiplier = match[2]?.toLowerCase();

		if (multiplier === "k") return Math.floor(num * 1024);
		if (multiplier === "m") return Math.floor(num * 1024 * 1024);
		return Math.floor(num);
	}

	/**
	 * Format thinking tokens for display
	 */
	public formatThinkingTokens(tokens: number): string {
		if (tokens >= 1024 * 1024) {
			return `${(tokens / (1024 * 1024)).toFixed(2)}M`;
		}
		if (tokens >= 1024) {
			return `${(tokens / 1024).toFixed(tokens % 1024 === 0 ? 0 : 1)}k`;
		}
		return tokens.toString();
	}

	/**
	 * Parse reasoning content from model output
	 * Extracts content wrapped in reasoning tags (e.g., <think>...</think>)
	 */
	public parseReasoningContent(
		output: string,
		modelName?: string,
	): {
		reasoning: string;
		response: string;
	} {
		const model = modelName ? this.getModel(modelName) : null;
		const reasoningTag = model?.reasoningTag || "think";

		const tagRegex = new RegExp(`<${reasoningTag}>([\\s\\S]*?)</${reasoningTag}>`, "g");

		const reasoning: string[] = [];
		let match = tagRegex.exec(output);

		while (match !== null) {
			reasoning.push(match[1].trim());
			match = tagRegex.exec(output);
		}

		// Remove reasoning tags from response
		const response = output.replace(tagRegex, "").trim();

		return {
			reasoning: reasoning.join("\n\n"),
			response,
		};
	}

	/**
	 * Get model limitations
	 */
	public getModelLimitations(modelName: string): {
		supportsTemperature: boolean;
		supportsStreaming: boolean;
		supportsSystemPrompt: boolean;
	} {
		const model = this.getModel(modelName);
		if (!model) {
			return {
				supportsTemperature: true,
				supportsStreaming: true,
				supportsSystemPrompt: true,
			};
		}

		return {
			supportsTemperature: model.useTemperature,
			supportsStreaming: model.streaming,
			supportsSystemPrompt: model.useSystemPrompt,
		};
	}

	/**
	 * Get API parameters for a model
	 */
	public getApiParams(modelName: string, settings?: ReasoningSettings): Record<string, unknown> {
		const model = this.getModel(modelName);
		if (!model) return {};

		const params: Record<string, unknown> = {
			...model.extraParams,
		};

		// Add reasoning effort for OpenAI models
		if (settings?.reasoningEffort && model.acceptsSettings.includes("reasoning_effort")) {
			params.reasoning_effort = settings.reasoningEffort;
		}

		// Add thinking tokens for Anthropic models
		if (settings?.thinkingTokens && model.acceptsSettings.includes("thinking_tokens")) {
			params.thinking = {
				type: "enabled",
				budget_tokens: settings.thinkingTokens,
			};
		}

		// Add max tokens if specified
		if (model.maxTokens) {
			params.max_tokens = model.maxTokens;
		}

		return params;
	}

	/**
	 * Get statistics
	 */
	public getStats(): ReasoningModelStats {
		return { ...this.stats };
	}

	/**
	 * Reset to defaults
	 */
	public reset(): void {
		this.config = DEFAULT_CONFIG;
		this.customModels.clear();
		this.stats = {
			totalModels: 0,
			modelsByProvider: {},
			modelsBySetting: {},
		};
		this.updateStats();
		this.saveData();
	}
}

// Singleton getter
export function getReasoningModelSupportManager(): ReasoningModelSupportManager {
	if (!managerInstance) {
		managerInstance = new ReasoningModelSupportManager();
	}
	return managerInstance;
}

// Export for convenience
export const DEFAULT_REASONING_MODEL_NAMES = [
	"o3-mini",
	"o3",
	"o1",
	"o1-preview",
	"o1-mini",
	"claude-3-7-sonnet",
	"claude-sonnet-4",
	"deepseek-reasoner",
	"deepseek-r1",
];
