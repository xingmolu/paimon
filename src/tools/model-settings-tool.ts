/**
 * Model Settings Tool
 *
 * Displays model settings and metadata for active models.
 * Inspired by Aider's /settings command.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

// Model metadata including pricing and capabilities
interface ModelMetadata {
	name: string;
	provider: string;
	contextWindow: number;
	maxOutput: number;
	inputCost: number; // per 1M tokens
	outputCost: number; // per 1M tokens
	supportsVision: boolean;
	supportsReasoning: boolean;
	supportsStreaming: boolean;
	supportsCache: boolean;
	reasoningType?: "openai" | "anthropic" | "deepseek";
}

// Default model metadata
const DEFAULT_MODEL_METADATA: Record<string, ModelMetadata> = {
	// OpenAI models
	"gpt-4o": {
		name: "GPT-4o",
		provider: "openai",
		contextWindow: 128000,
		maxOutput: 16384,
		inputCost: 2.5,
		outputCost: 10,
		supportsVision: true,
		supportsReasoning: false,
		supportsStreaming: true,
		supportsCache: true,
	},
	"gpt-4o-mini": {
		name: "GPT-4o Mini",
		provider: "openai",
		contextWindow: 128000,
		maxOutput: 16384,
		inputCost: 0.15,
		outputCost: 0.6,
		supportsVision: true,
		supportsReasoning: false,
		supportsStreaming: true,
		supportsCache: true,
	},
	o1: {
		name: "o1",
		provider: "openai",
		contextWindow: 200000,
		maxOutput: 100000,
		inputCost: 15,
		outputCost: 60,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: false,
		supportsCache: false,
		reasoningType: "openai",
	},
	"o1-mini": {
		name: "o1 Mini",
		provider: "openai",
		contextWindow: 128000,
		maxOutput: 65536,
		inputCost: 1.5,
		outputCost: 6,
		supportsVision: false,
		supportsReasoning: true,
		supportsStreaming: false,
		supportsCache: false,
		reasoningType: "openai",
	},
	"o3-mini": {
		name: "o3 Mini",
		provider: "openai",
		contextWindow: 200000,
		maxOutput: 100000,
		inputCost: 1.1,
		outputCost: 4.4,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "openai",
	},
	o3: {
		name: "o3",
		provider: "openai",
		contextWindow: 200000,
		maxOutput: 100000,
		inputCost: 10,
		outputCost: 40,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "openai",
	},

	// Anthropic models
	"claude-3-5-sonnet-20241022": {
		name: "Claude 3.5 Sonnet",
		provider: "anthropic",
		contextWindow: 200000,
		maxOutput: 8192,
		inputCost: 3,
		outputCost: 15,
		supportsVision: true,
		supportsReasoning: false,
		supportsStreaming: true,
		supportsCache: true,
	},
	"claude-3-5-haiku-20241022": {
		name: "Claude 3.5 Haiku",
		provider: "anthropic",
		contextWindow: 200000,
		maxOutput: 8192,
		inputCost: 0.8,
		outputCost: 4,
		supportsVision: true,
		supportsReasoning: false,
		supportsStreaming: true,
		supportsCache: true,
	},
	"claude-3-7-sonnet-20250219": {
		name: "Claude 3.7 Sonnet",
		provider: "anthropic",
		contextWindow: 200000,
		maxOutput: 8192,
		inputCost: 3,
		outputCost: 15,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "anthropic",
	},
	"claude-sonnet-4-20250514": {
		name: "Claude Sonnet 4",
		provider: "anthropic",
		contextWindow: 200000,
		maxOutput: 16000,
		inputCost: 3,
		outputCost: 15,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "anthropic",
	},
	"claude-opus-4-20250514": {
		name: "Claude Opus 4",
		provider: "anthropic",
		contextWindow: 200000,
		maxOutput: 32000,
		inputCost: 15,
		outputCost: 75,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "anthropic",
	},

	// DeepSeek models
	"deepseek-chat": {
		name: "DeepSeek Chat",
		provider: "deepseek",
		contextWindow: 64000,
		maxOutput: 8192,
		inputCost: 0.14,
		outputCost: 0.28,
		supportsVision: false,
		supportsReasoning: false,
		supportsStreaming: true,
		supportsCache: true,
	},
	"deepseek-reasoner": {
		name: "DeepSeek Reasoner",
		provider: "deepseek",
		contextWindow: 64000,
		maxOutput: 8192,
		inputCost: 0.55,
		outputCost: 2.19,
		supportsVision: false,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "deepseek",
	},

	// Gemini models
	"gemini-2.5-pro": {
		name: "Gemini 2.5 Pro",
		provider: "google",
		contextWindow: 1048576,
		maxOutput: 65536,
		inputCost: 1.25,
		outputCost: 10,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "openai",
	},
	"gemini-2.5-flash": {
		name: "Gemini 2.5 Flash",
		provider: "google",
		contextWindow: 1048576,
		maxOutput: 65536,
		inputCost: 0.15,
		outputCost: 0.6,
		supportsVision: true,
		supportsReasoning: true,
		supportsStreaming: true,
		supportsCache: true,
		reasoningType: "openai",
	},
};

type ModelSettingsAction =
	| "show"
	| "all"
	| "main"
	| "editor"
	| "weak"
	| "compare"
	| "list"
	| "providers"
	| "set-main"
	| "set-editor"
	| "set-weak"
	| "metadata"
	| "help";

interface ToolParams {
	action: ModelSettingsAction;
	modelId?: string;
	modelId2?: string;
	provider?: string;
}

// Model Settings Manager
export class ModelSettingsManager {
	private activeMainModel = "claude-3-7-sonnet-20250219";
	private activeEditorModel = "gpt-4o";
	private activeWeakModel = "gpt-4o-mini";
	private configPath: string;

	constructor() {
		const homeDir = process.env.HOME || process.env.USERDIR || "/tmp";
		this.configPath = path.join(homeDir, ".paimon", "model-settings.json");
		this.loadConfig();
	}

	private loadConfig(): void {
		try {
			if (fs.existsSync(this.configPath)) {
				const config = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
				this.activeMainModel = config.mainModel || this.activeMainModel;
				this.activeEditorModel = config.editorModel || this.activeEditorModel;
				this.activeWeakModel = config.weakModel || this.activeWeakModel;
			}
		} catch {
			// Use defaults
		}
	}

	private saveConfig(): void {
		try {
			const dir = path.dirname(this.configPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.configPath,
				JSON.stringify(
					{
						mainModel: this.activeMainModel,
						editorModel: this.activeEditorModel,
						weakModel: this.activeWeakModel,
						updatedAt: new Date().toISOString(),
					},
					null,
					2,
				),
			);
		} catch {
			// Ignore save errors
		}
	}

	/**
	 * Get metadata for a model
	 */
	getModelMetadata(modelId: string): ModelMetadata | null {
		// Normalize model ID
		const normalizedId = modelId.toLowerCase().replace(/[-_.]/g, "-");

		// Direct lookup
		if (DEFAULT_MODEL_METADATA[modelId]) {
			return DEFAULT_MODEL_METADATA[modelId];
		}

		// Try normalized lookup
		for (const [key, value] of Object.entries(DEFAULT_MODEL_METADATA)) {
			if (key.toLowerCase().replace(/[-_.]/g, "-") === normalizedId) {
				return value;
			}
		}

		// Try partial match
		for (const [key, value] of Object.entries(DEFAULT_MODEL_METADATA)) {
			if (
				modelId.toLowerCase().includes(key.toLowerCase()) ||
				key.toLowerCase().includes(modelId.toLowerCase())
			) {
				return value;
			}
		}

		return null;
	}

	/**
	 * Get all available models
	 */
	getAllModels(): ModelMetadata[] {
		return Object.values(DEFAULT_MODEL_METADATA);
	}

	/**
	 * Get models by provider
	 */
	getModelsByProvider(provider: string): ModelMetadata[] {
		return this.getAllModels().filter((m) => m.provider === provider);
	}

	/**
	 * Get current active models
	 */
	getActiveModels(): { main: string; editor: string; weak: string } {
		return {
			main: this.activeMainModel,
			editor: this.activeEditorModel,
			weak: this.activeWeakModel,
		};
	}

	/**
	 * Set main model
	 */
	setMainModel(modelId: string): boolean {
		this.activeMainModel = modelId;
		this.saveConfig();
		return true;
	}

	/**
	 * Set editor model
	 */
	setEditorModel(modelId: string): boolean {
		this.activeEditorModel = modelId;
		this.saveConfig();
		return true;
	}

	/**
	 * Set weak model
	 */
	setWeakModel(modelId: string): boolean {
		this.activeWeakModel = modelId;
		this.saveConfig();
		return true;
	}
}

// Singleton instance
let managerInstance: ModelSettingsManager | null = null;

function getManager(): ModelSettingsManager {
	if (!managerInstance) {
		managerInstance = new ModelSettingsManager();
	}
	return managerInstance;
}

function formatResult(result: Record<string, unknown>): string {
	return `## Model Settings Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
}

/**
 * Model settings tool for displaying model configuration and metadata
 */
export const modelSettingsTool: AgentTool = {
	name: "modelSettings",
	label: "Model Settings",
	description: `Display model settings and metadata for active models (Aider Pattern). Shows main/editor/weak model configuration, pricing, capabilities, and reasoning settings.

Actions:
- show/all: Display all active model settings (main, editor, weak)
- main/editor/weak: Display specific model settings
- compare: Compare two models side-by-side
- list: List all available models (optionally filter by provider)
- providers: List all available providers
- set-main/set-editor/set-weak: Set active models
- metadata: Get detailed metadata for a specific model
- help: Show help message

Example usage:
modelSettings({action: 'show'})
modelSettings({action: 'compare', modelId: 'gpt-4o', modelId2: 'claude-3-7-sonnet'})
modelSettings({action: 'list', provider: 'anthropic'})
modelSettings({action: 'set-main', modelId: 'claude-3-7-sonnet'})
`,
	parameters: Type.Object({
		action: Type.Union(
			[
				Type.Literal("show"),
				Type.Literal("all"),
				Type.Literal("main"),
				Type.Literal("editor"),
				Type.Literal("weak"),
				Type.Literal("compare"),
				Type.Literal("list"),
				Type.Literal("providers"),
				Type.Literal("set-main"),
				Type.Literal("set-editor"),
				Type.Literal("set-weak"),
				Type.Literal("metadata"),
				Type.Literal("help"),
			],
			{ description: "Action to perform" },
		),
		modelId: Type.Optional(Type.String({ description: "Model ID for metadata or set actions" })),
		modelId2: Type.Optional(Type.String({ description: "Second model ID for comparison" })),
		provider: Type.Optional(Type.String({ description: "Provider filter for list action" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getManager();
		const { action, modelId, modelId2, provider } = params as ToolParams;

		let result: Record<string, unknown>;

		switch (action) {
			case "show":
			case "all": {
				const models = manager.getActiveModels();
				result = {
					activeModels: models,
					main: {
						id: models.main,
						metadata: manager.getModelMetadata(models.main),
					},
					editor: {
						id: models.editor,
						metadata: manager.getModelMetadata(models.editor),
					},
					weak: {
						id: models.weak,
						metadata: manager.getModelMetadata(models.weak),
					},
				};
				break;
			}

			case "main": {
				const models = manager.getActiveModels();
				result = {
					modelType: "main",
					id: models.main,
					metadata: manager.getModelMetadata(models.main),
				};
				break;
			}

			case "editor": {
				const models = manager.getActiveModels();
				result = {
					modelType: "editor",
					id: models.editor,
					metadata: manager.getModelMetadata(models.editor),
				};
				break;
			}

			case "weak": {
				const models = manager.getActiveModels();
				result = {
					modelType: "weak",
					id: models.weak,
					metadata: manager.getModelMetadata(models.weak),
				};
				break;
			}

			case "compare": {
				if (!modelId || !modelId2) {
					result = { error: "Both modelId and modelId2 are required for comparison" };
				} else {
					const meta1 = manager.getModelMetadata(modelId);
					const meta2 = manager.getModelMetadata(modelId2);
					result = {
						model1: { id: modelId, metadata: meta1 },
						model2: { id: modelId2, metadata: meta2 },
						comparison:
							meta1 && meta2
								? {
										contextWindowDiff: meta2.contextWindow - meta1.contextWindow,
										inputCostDiff: meta2.inputCost - meta1.inputCost,
										outputCostDiff: meta2.outputCost - meta1.outputCost,
										visionDiff: meta1.supportsVision !== meta2.supportsVision,
										reasoningDiff: meta1.supportsReasoning !== meta2.supportsReasoning,
									}
								: null,
					};
				}
				break;
			}

			case "list": {
				const models = provider ? manager.getModelsByProvider(provider) : manager.getAllModels();
				result = {
					provider: provider || "all",
					count: models.length,
					models: models.map((m) => ({
						name: m.name,
						provider: m.provider,
						contextWindow: m.contextWindow,
						inputCost: m.inputCost,
						outputCost: m.outputCost,
						supportsReasoning: m.supportsReasoning,
					})),
				};
				break;
			}

			case "providers": {
				const models = manager.getAllModels();
				const providers = [...new Set(models.map((m) => m.provider))].sort();
				result = {
					providers,
					count: providers.length,
				};
				break;
			}

			case "set-main": {
				if (!modelId) {
					result = { error: "modelId is required for set-main action" };
				} else {
					manager.setMainModel(modelId);
					result = {
						success: true,
						modelType: "main",
						id: modelId,
						metadata: manager.getModelMetadata(modelId),
					};
				}
				break;
			}

			case "set-editor": {
				if (!modelId) {
					result = { error: "modelId is required for set-editor action" };
				} else {
					manager.setEditorModel(modelId);
					result = {
						success: true,
						modelType: "editor",
						id: modelId,
						metadata: manager.getModelMetadata(modelId),
					};
				}
				break;
			}

			case "set-weak": {
				if (!modelId) {
					result = { error: "modelId is required for set-weak action" };
				} else {
					manager.setWeakModel(modelId);
					result = {
						success: true,
						modelType: "weak",
						id: modelId,
						metadata: manager.getModelMetadata(modelId),
					};
				}
				break;
			}

			case "metadata": {
				if (!modelId) {
					result = { error: "modelId is required for metadata action" };
				} else {
					const metadata = manager.getModelMetadata(modelId);
					result = metadata
						? { id: modelId, metadata }
						: { error: `Model '${modelId}' not found in metadata database` };
				}
				break;
			}

			case "help": {
				result = {
					message: "Model Settings Tool - Display model configuration and metadata (Aider Pattern)",
					actions: [
						"show/all - Display all active model settings",
						"main/editor/weak - Display specific model settings",
						"compare - Compare two models side-by-side",
						"list [provider] - List all available models",
						"providers - List all available providers",
						"set-main/set-editor/set-weak - Set active models",
						"metadata - Get detailed metadata for a model",
						"help - Show this help",
					],
					modelTypes: {
						main: "Primary model for complex reasoning and code generation",
						editor: "Model for editor/architect mode implementations",
						weak: "Fast, cheap model for simple tasks and quick iterations",
					},
				};
				break;
			}

			default:
				result = { error: `Unknown action: ${action}` };
		}

		return {
			content: [{ type: "text", text: formatResult(result) }],
			details: result,
		};
	},
};

export { getManager as getModelSettingsManager };

export default modelSettingsTool;
