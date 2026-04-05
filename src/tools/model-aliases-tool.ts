/**
 * Model Aliases Tool (Aider Pattern)
 *
 * Tool for managing model aliases - shorthand names for frequently used models.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type ModelAlias, getModelAliasManager, resetModelAliasManager } from "../model-aliases.js";

// Parameter schema using TypeBox
const ModelAliasesParameters = Type.Object({
	action: Type.Union([
		Type.Literal("list"),
		Type.Literal("add"),
		Type.Literal("remove"),
		Type.Literal("get"),
		Type.Literal("resolve"),
		Type.Literal("import"),
		Type.Literal("export"),
		Type.Literal("enable"),
		Type.Literal("disable"),
		Type.Literal("stats"),
		Type.Literal("reset"),
		Type.Literal("clear"),
		Type.Literal("help"),
	]),
	name: Type.Optional(Type.String()),
	modelId: Type.Optional(Type.String()),
	description: Type.Optional(Type.String()),
	aliases: Type.Optional(Type.Record(Type.String(), Type.String())),
	format: Type.Optional(Type.Union([Type.Literal("yaml"), Type.Literal("json")])),
});

type ModelAliasesToolParams = {
	action:
		| "list"
		| "add"
		| "remove"
		| "get"
		| "resolve"
		| "import"
		| "export"
		| "enable"
		| "disable"
		| "stats"
		| "reset"
		| "clear"
		| "help";
	name?: string;
	modelId?: string;
	description?: string;
	aliases?: Record<string, string>;
	format?: "yaml" | "json";
};

async function executeModelAliasesTool(params: unknown): Promise<string> {
	const typedParams = params as ModelAliasesToolParams;
	const manager = getModelAliasManager();

	switch (typedParams.action) {
		case "list": {
			const aliases = manager.listAliases();
			if (aliases.length === 0) {
				return "No aliases defined. Use 'add' action to create one.";
			}

			const lines = ["## Model Aliases\n"];
			for (const alias of aliases) {
				lines.push(`- **${alias.name}**: ${alias.modelId}`);
				if (alias.description) {
					lines.push(`  ${alias.description}`);
				}
			}
			return lines.join("\n");
		}

		case "add": {
			if (!typedParams.name) {
				return "Error: 'name' parameter required for add action";
			}
			if (!typedParams.modelId) {
				return "Error: 'modelId' parameter required for add action";
			}

			const alias = manager.addAlias(
				typedParams.name,
				typedParams.modelId,
				typedParams.description,
			);
			return `Added alias: ${alias.name} -> ${alias.modelId}${alias.description ? ` (${alias.description})` : ""}`;
		}

		case "remove": {
			if (!typedParams.name) {
				return "Error: 'name' parameter required for remove action";
			}

			const removed = manager.removeAlias(typedParams.name);
			return removed
				? `Removed alias: ${typedParams.name}`
				: `Alias not found: ${typedParams.name}`;
		}

		case "get": {
			if (!typedParams.name) {
				return "Error: 'name' parameter required for get action";
			}

			const alias = manager.getAlias(typedParams.name);
			if (!alias) {
				return `Alias not found: ${typedParams.name}`;
			}

			return JSON.stringify(alias, null, 2);
		}

		case "resolve": {
			if (!typedParams.name) {
				return "Error: 'name' parameter required for resolve action";
			}

			const result = manager.resolve(typedParams.name);
			if (result.found) {
				return `Resolved: ${result.alias} -> ${result.modelId}${result.description ? `\nDescription: ${result.description}` : ""}`;
			}

			// Not an alias, return as model ID
			return `Not an alias. '${typedParams.name}' is a model ID.`;
		}

		case "import": {
			if (!typedParams.aliases) {
				return "Error: 'aliases' parameter required for import action";
			}

			const imported = manager.importAliases(typedParams.aliases);
			return `Imported ${imported} aliases. Total: ${manager.listAliases().length}`;
		}

		case "export": {
			const format = typedParams.format || "json";

			if (format === "yaml") {
				return manager.formatAsYaml();
			}

			return manager.formatAsJson();
		}

		case "enable": {
			manager.setEnabled(true);
			return "Model aliases enabled";
		}

		case "disable": {
			manager.setEnabled(false);
			return "Model aliases disabled";
		}

		case "stats": {
			const stats = manager.getStats();
			const lines = [
				"## Model Aliases Statistics\n",
				`- **Total Aliases**: ${stats.totalAliases}`,
				`- **Total Resolutions**: ${stats.totalResolutions}`,
				`- **Most Used Alias**: ${stats.mostUsedAlias || "N/A"}`,
				`- **Config Loads**: ${stats.configLoads}`,
			];

			if (Object.keys(stats.aliasUsage).length > 0) {
				lines.push("\n### Usage by Alias");
				const sorted = Object.entries(stats.aliasUsage).sort((a, b) => b[1] - a[1]);
				for (const [name, count] of sorted) {
					lines.push(`- ${name}: ${count} uses`);
				}
			}

			return lines.join("\n");
		}

		case "reset": {
			manager.resetStats();
			return "Statistics reset";
		}

		case "clear": {
			manager.clearAliases();
			return "All custom aliases cleared. Default aliases restored.";
		}

		case "help": {
			return manager.getHelp();
		}

		default:
			return `Unknown action. Use 'help' to see available actions.`;
	}
}

export const modelAliasesTool: AgentTool = {
	name: "modelAliases",
	label: "Model Aliases",
	description:
		"Manage model aliases - shorthand names for frequently used models. Define aliases like 'fast:gpt-4o-mini' and use them to quickly switch models. Supports YAML/JSON config, in-chat alias resolution, and team-shared configurations. Inspired by Aider's model aliases feature.",
	parameters: ModelAliasesParameters,
	execute: async (
		_toolCallId,
		params,
	): Promise<{
		content: Array<{ type: "text"; text: string }>;
		details: Record<string, unknown>;
	}> => {
		const result = await executeModelAliasesTool(params as ModelAliasesToolParams);
		return {
			content: [{ type: "text", text: result }],
			details: {},
		};
	},
};

export const modelAliasesToolDefinition: AgentTool = modelAliasesTool;
