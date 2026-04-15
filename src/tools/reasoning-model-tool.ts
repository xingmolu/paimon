/**
 * Reasoning Model Support Tool (Aider Pattern)
 *
 * Tool for configuring and managing reasoning model settings
 * for models like OpenAI o1/o3, DeepSeek R1, Claude with Extended Thinking
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ReasoningModelConfig,
	type ReasoningSettings,
	getReasoningModelSupportManager,
} from "../reasoning-model-support.js";

// Tool definition
export const reasoningModelToolDefinition: AgentTool = {
	name: "reasoningModel",
	label: "Reasoning Model Support",
	description: `Manage reasoning model support for advanced LLMs (Aider Pattern)

Actions:
- detect: Check if a model is a reasoning model and get its config
- config: Configure reasoning model settings (reasoning_effort, thinking_tokens)
- models: List all supported reasoning models
- add: Add a custom reasoning model configuration
- remove: Remove a custom model configuration
- validate: Validate settings for a model
- limitations: Get model limitations (temperature, streaming, system prompt)
- params: Get API parameters for a model
- parse: Parse reasoning content from model output
- stats: View statistics
- help: Show help message

Reasoning models supported:
- OpenAI: o3-mini, o3, o1, o1-preview, o1-mini (reasoning_effort: low/medium/high)
- Anthropic: claude-3-7-sonnet, claude-sonnet-4 (thinking_tokens budget)
- DeepSeek: deepseek-r1, deepseek-reasoner (reasoning in  ...  tags)

Example usage:
reasoningModel({action: 'detect', model: 'o3-mini'})
reasoningModel({action: 'config', model: 'o3-mini', reasoningEffort: 'high'})
reasoningModel({action: 'config', model: 'claude-3-7-sonnet', thinkingTokens: 8192})
reasoningModel({action: 'models'})
reasoningModel({action: 'validate', model: 'o3-mini', reasoningEffort: 'high'})
`,
	parameters: Type.Object({
		action: Type.Union([
			Type.Literal("detect"),
			Type.Literal("config"),
			Type.Literal("models"),
			Type.Literal("add"),
			Type.Literal("remove"),
			Type.Literal("validate"),
			Type.Literal("limitations"),
			Type.Literal("params"),
			Type.Literal("parse"),
			Type.Literal("stats"),
			Type.Literal("help"),
		]),
		model: Type.Optional(Type.String()),
		reasoningEffort: Type.Optional(
			Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
		),
		thinkingTokens: Type.Optional(Type.Union([Type.Number(), Type.String()])),
		provider: Type.Optional(Type.String()),
		editFormat: Type.Optional(Type.String()),
		useTemperature: Type.Optional(Type.Boolean()),
		streaming: Type.Optional(Type.Boolean()),
		useSystemPrompt: Type.Optional(Type.Boolean()),
		reasoningTag: Type.Optional(Type.String()),
		acceptsSettings: Type.Optional(Type.Array(Type.String())),
		output: Type.Optional(Type.String()),
		checkModelAcceptsSettings: Type.Optional(Type.Boolean()),
	}),
	execute: async (
		_toolCallId,
		params,
	): Promise<{
		content: Array<{ type: "text"; text: string }>;
		details: Record<string, unknown>;
	}> => {
		const result = await reasoningModelTool(params as ReasoningModelToolParams);
		return {
			content: [{ type: "text", text: result }],
			details: {},
		};
	},
};

type ReasoningModelToolParams = {
	action:
		| "detect"
		| "config"
		| "models"
		| "add"
		| "remove"
		| "validate"
		| "limitations"
		| "params"
		| "parse"
		| "stats"
		| "help";
	model?: string;
	reasoningEffort?: "low" | "medium" | "high";
	thinkingTokens?: number | string;
	provider?: string;
	editFormat?: string;
	useTemperature?: boolean;
	streaming?: boolean;
	useSystemPrompt?: boolean;
	reasoningTag?: string;
	acceptsSettings?: string[];
	output?: string;
	checkModelAcceptsSettings?: boolean;
};

export async function reasoningModelTool(params: ReasoningModelToolParams): Promise<string> {
	const manager = getReasoningModelSupportManager();

	switch (params.action) {
		case "detect": {
			if (!params.model) {
				return "Error: model parameter required for detect action";
			}
			const config = manager.getModel(params.model);
			if (!config) {
				return `Model '${params.model}' is not recognized as a reasoning model.`;
			}
			const isReasoning = manager.isReasoningModel(params.model);
			const limitations = manager.getModelLimitations(params.model);

			return `## Reasoning Model: ${params.model}

**Provider:** ${config.provider}
**Edit Format:** ${config.editFormat}
**Accepts Settings:** ${config.acceptsSettings.length > 0 ? config.acceptsSettings.join(", ") : "none"}
**Reasoning Tag:** ${config.reasoningTag || "none"}

### Limitations
- **Temperature:** ${limitations.supportsTemperature ? "Supported" : "❌ Not supported"}
- **Streaming:** ${limitations.supportsStreaming ? "Supported" : "❌ Not supported"}
- **System Prompt:** ${limitations.supportsSystemPrompt ? "Supported" : "❌ Not supported"}

### Configuration
${
	config.acceptsSettings.includes("reasoning_effort")
		? `- Use \`reasoningEffort: 'low' | 'medium' | 'high'\` to control reasoning depth`
		: ""
}
${
	config.acceptsSettings.includes("thinking_tokens")
		? `- Use \`thinkingTokens: number\` to set thinking budget (e.g., 8192, "8k")`
		: ""
}
${config.reasoningTag ? `- Reasoning output wrapped in \`<${config.reasoningTag}>...\` tags` : ""}
`;
		}

		case "config": {
			if (!params.model) {
				return "Error: model parameter required for config action";
			}

			const settings: ReasoningSettings = {};
			if (params.reasoningEffort) {
				settings.reasoningEffort = params.reasoningEffort;
			}
			if (params.thinkingTokens !== undefined) {
				settings.thinkingTokens =
					typeof params.thinkingTokens === "string"
						? manager.parseThinkingTokens(params.thinkingTokens)
						: params.thinkingTokens;
			}

			// Validate settings
			const validation = manager.validateSettings(params.model, settings);
			if (validation.warnings.length > 0) {
				console.warn("Validation warnings:", validation.warnings);
			}

			const success = manager.setActiveModel(params.model, settings);
			if (!success) {
				return `Error: Failed to configure model '${params.model}'. Model not found.`;
			}

			const formattedTokens = settings.thinkingTokens
				? manager.formatThinkingTokens(settings.thinkingTokens)
				: "disabled";

			return `## Reasoning Model Configured

**Model:** ${params.model}
**Settings:**
${settings.reasoningEffort ? `- Reasoning Effort: ${settings.reasoningEffort}` : ""}
${settings.thinkingTokens ? `- Thinking Tokens: ${formattedTokens} (${settings.thinkingTokens})` : ""}

${
	validation.warnings.length > 0
		? `### Warnings\n${validation.warnings.map((w) => `- ${w}`).join("\n")}`
		: ""
}
`;
		}

		case "models": {
			const models = manager.listModels();
			const byProvider: Record<string, ReasoningModelConfig[]> = {};

			for (const model of models) {
				if (!byProvider[model.provider]) {
					byProvider[model.provider] = [];
				}
				byProvider[model.provider].push(model);
			}

			let output = "## Supported Reasoning Models\n\n";

			for (const [provider, providerModels] of Object.entries(byProvider)) {
				output += `### ${provider.charAt(0).toUpperCase() + provider.slice(1)}\n`;
				for (const model of providerModels) {
					const settings =
						model.acceptsSettings.length > 0 ? ` (${model.acceptsSettings.join(", ")})` : "";
					const tag = model.reasoningTag ? ` [tag: ${model.reasoningTag}]` : "";
					output += `- **${model.name}**${settings}${tag}\n`;
				}
				output += "\n";
			}

			output += `### Legend
- \`reasoning_effort\`: Use \`reasoningEffort: 'low' | 'medium' | 'high'\`
- \`thinking_tokens\`: Use \`thinkingTokens: number\` (e.g., 8192, "8k")
- \`[tag: think]\`: Model outputs reasoning in \`<think>...\` tags
`;
			return output;
		}

		case "add": {
			if (!params.model) {
				return "Error: model parameter required for add action";
			}

			const config: ReasoningModelConfig = {
				name: params.model,
				provider: params.provider || "custom",
				editFormat: params.editFormat || "diff",
				useRepoMap: true,
				useTemperature: params.useTemperature ?? true,
				streaming: params.streaming ?? true,
				useSystemPrompt: params.useSystemPrompt ?? true,
				acceptsSettings:
					(params.acceptsSettings as ("reasoning_effort" | "thinking_tokens")[]) || [],
				reasoningTag: params.reasoningTag,
			};

			manager.addModel(config);
			return `Added custom reasoning model: ${params.model}

**Provider:** ${config.provider}
**Accepts Settings:** ${config.acceptsSettings.join(", ") || "none"}
**Reasoning Tag:** ${config.reasoningTag || "none"}
`;
		}

		case "remove": {
			if (!params.model) {
				return "Error: model parameter required for remove action";
			}
			const success = manager.removeModel(params.model);
			if (success) {
				return `Removed custom model: ${params.model}`;
			}
			return `Model '${params.model}' not found in custom models (only custom models can be removed)`;
		}

		case "validate": {
			if (!params.model) {
				return "Error: model parameter required for validate action";
			}

			const settings: ReasoningSettings = {};
			if (params.reasoningEffort) {
				settings.reasoningEffort = params.reasoningEffort;
			}
			if (params.thinkingTokens !== undefined) {
				settings.thinkingTokens =
					typeof params.thinkingTokens === "string"
						? manager.parseThinkingTokens(params.thinkingTokens)
						: params.thinkingTokens;
			}

			const validation = manager.validateSettings(params.model, settings);

			return `## Validation Result for ${params.model}

**Valid:** ${validation.valid ? "✅ Yes" : "❌ No"}

${
	validation.warnings.length > 0
		? `### Warnings\n${validation.warnings.map((w) => `- ${w}`).join("\n")}`
		: "No warnings"
}
`;
		}

		case "limitations": {
			if (!params.model) {
				return "Error: model parameter required for limitations action";
			}

			const limitations = manager.getModelLimitations(params.model);
			const config = manager.getModel(params.model);

			return `## Limitations for ${params.model}

| Feature | Supported |
|---------|-----------|
| Temperature | ${limitations.supportsTemperature ? "✅ Yes" : "❌ No"} |
| Streaming | ${limitations.supportsStreaming ? "✅ Yes" : "❌ No"} |
| System Prompt | ${limitations.supportsSystemPrompt ? "✅ Yes" : "❌ No"} |

${
	!limitations.supportsTemperature ||
	!limitations.supportsStreaming ||
	!limitations.supportsSystemPrompt
		? "\n**Note:** This reasoning model has restrictions. Ensure your API calls respect these limitations."
		: ""
}

**Provider:** ${config?.provider || "unknown"}
**Accepts Settings:** ${config?.acceptsSettings.join(", ") || "none"}
`;
		}

		case "params": {
			if (!params.model) {
				return "Error: model parameter required for params action";
			}

			const settings: ReasoningSettings = {};
			if (params.reasoningEffort) {
				settings.reasoningEffort = params.reasoningEffort;
			}
			if (params.thinkingTokens !== undefined) {
				settings.thinkingTokens =
					typeof params.thinkingTokens === "string"
						? manager.parseThinkingTokens(params.thinkingTokens)
						: params.thinkingTokens;
			}

			const apiParams = manager.getApiParams(params.model, settings);

			return `## API Parameters for ${params.model}

\`\`\`json
${JSON.stringify(apiParams, null, 2)}
\`\`\`

**Settings Applied:**
${settings.reasoningEffort ? `- reasoning_effort: ${settings.reasoningEffort}` : ""}
${settings.thinkingTokens ? `- thinking_tokens: ${settings.thinkingTokens}` : ""}
`;
		}

		case "parse": {
			if (!params.output) {
				return "Error: output parameter required for parse action";
			}

			const result = manager.parseReasoningContent(params.output, params.model);

			return `## Parsed Reasoning Content

### Reasoning (Internal)
\`\`\`
${result.reasoning || "(none)"}
\`\`\`

### Response (For Processing)
\`\`\`
${result.response}
\`\`\`

${
	params.model
		? `**Model:** ${params.model}`
		: "**Note:** Specify model parameter for correct reasoning tag detection"
}
`;
		}

		case "stats": {
			const stats = manager.getStats();
			const config = manager.getConfig();

			return `## Reasoning Model Statistics

**Total Models:** ${stats.totalModels}
**Check Model Accepts Settings:** ${config.checkModelAcceptsSettings}

### Models by Provider
${Object.entries(stats.modelsByProvider)
	.map(([provider, count]) => `- ${provider}: ${count}`)
	.join("\n")}

### Models by Setting
${Object.entries(stats.modelsBySetting)
	.map(([setting, count]) => `- ${setting}: ${count}`)
	.join("\n")}

### Active Configuration
${stats.activeModel ? `- **Model:** ${stats.activeModel}` : "- No active model"}
${
	stats.activeSettings?.reasoningEffort
		? `- **Reasoning Effort:** ${stats.activeSettings.reasoningEffort}`
		: ""
}
${
	stats.activeSettings?.thinkingTokens
		? `- **Thinking Tokens:** ${manager.formatThinkingTokens(stats.activeSettings.thinkingTokens)}`
		: ""
}
`;
		}

		case "help": {
			return `## Reasoning Model Support (Aider Pattern)

Configure and manage reasoning model settings for advanced LLMs.

### Supported Models
- **OpenAI:** o3-mini, o3, o1, o1-preview, o1-mini
- **Anthropic:** claude-3-7-sonnet, claude-sonnet-4
- **DeepSeek:** deepseek-r1, deepseek-reasoner

### Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| detect | Check if model is a reasoning model | model |
| config | Configure model settings | model, reasoningEffort?, thinkingTokens? |
| models | List all supported models | - |
| add | Add custom model | model, provider?, acceptsSettings?, ... |
| remove | Remove custom model | model |
| validate | Validate settings for model | model, reasoningEffort?, thinkingTokens? |
| limitations | Get model limitations | model |
| params | Get API parameters | model, reasoningEffort?, thinkingTokens? |
| parse | Parse reasoning from output | output, model? |
| stats | View statistics | - |

### Settings Types

**reasoning_effort** (OpenAI o-series):
- \`low\`: Faster, less reasoning
- \`medium\`: Balanced
- \`high\`: More reasoning, slower

**thinking_tokens** (Anthropic Claude):
- Budget for extended thinking
- Format: number or string (e.g., 8192, "8k", "0.01M")
- Use 0 to disable

### Example Usage

\`\`\`typescript
// Configure o3-mini with high reasoning
reasoningModel({action: 'config', model: 'o3-mini', reasoningEffort: 'high'})

// Configure Claude with 8k thinking tokens
reasoningModel({action: 'config', model: 'claude-3-7-sonnet', thinkingTokens: '8k'})

// Validate settings
reasoningModel({action: 'validate', model: 'o3-mini', thinkingTokens: 8192})
// Warning: o3-mini does not support 'thinking_tokens'
\`\`\`

### Limitations

Reasoning models often have restrictions:
- **Temperature:** Many don't support it
- **Streaming:** Some don't support it (o1)
- **System Prompt:** Some don't support it (o1)

Use \`limitations\` action to check specific model restrictions.
`;
		}

		default:
			return `Unknown action: ${params.action}. Use 'help' for available actions.`;
	}
}
