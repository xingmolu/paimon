/**
 * Tool Registry — Declarative tool factory.
 *
 * Generates AgentTool objects from declarative configs,
 * eliminating boilerplate across all tool modules.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { type TSchema, Type } from "@sinclair/typebox";

export interface ToolAction {
	description: string;
	parameters?: TSchema;
	handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolConfig {
	name: string;
	label: string;
	description: string;
	actions: Record<string, ToolAction>;
}

export function createTool(config: ToolConfig): AgentTool {
	const actionNames = Object.keys(config.actions);

	// Collect all parameter keys from all action schemas
	const allParams = new Set<string>();
	for (const action of Object.values(config.actions)) {
		if (action.parameters) {
			const props = action.parameters as Record<string, unknown>;
			if (props.properties) {
				const properties = props.properties as Record<string, unknown>;
				for (const k of Object.keys(properties)) {
					allParams.add(k);
				}
			}
		}
	}

	// Build merged parameter schema
	const paramProperties: Record<string, TSchema> = {};
	for (const key of allParams) {
		paramProperties[key] = Type.Optional(Type.Unknown());
	}

	const parameters = Type.Object({
		action: Type.String({
			enum: actionNames,
			description: `Action to perform: ${actionNames.join(", ")}`,
		}),
		...paramProperties,
	});

	// Build description with action list
	const actionList = Object.entries(config.actions)
		.map(([name, def]) => `- ${name}: ${def.description}`)
		.join("\n");
	const fullDescription = `${config.description}\n\nActions:\n${actionList}`;

	// Build execute function
	const execute = async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<unknown>> => {
		const { action, ...rest } = params as { action: string };
		const actionDef = config.actions[action];

		if (!actionDef) {
			return {
				content: [{ type: "text", text: `Unknown action: ${action}` }],
				details: `Unknown action: ${action}`,
			};
		}

		try {
			const result = await actionDef.handler(rest);
			// If result is already AgentToolResult format, return as-is
			if (result && typeof result === "object" && "content" in result) {
				return result as AgentToolResult<unknown>;
			}
			// Otherwise wrap in standard format
			const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
			return {
				content: [{ type: "text", text }],
				details: result,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: `Error: ${message}` }],
				details: `Error: ${message}`,
			};
		}
	};

	return {
		name: config.name,
		label: config.label,
		description: fullDescription,
		parameters,
		execute,
	};
}
