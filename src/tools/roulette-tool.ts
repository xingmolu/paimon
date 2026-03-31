/**
 * Roulette Tool - Model Roulette for agent integration
 *
 * Provides tool interface for Model Roulette functionality.
 * Inspired by Mini-SWE-Agent's model roulette pattern.
 *
 * @see src/model-roulette.ts
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	ModelRoulette,
	type RouletteConfig,
	type RouletteModel,
	formatRouletteStats,
	getModelRoulette,
	resetModelRoulette,
} from "../model-roulette.js";

/**
 * Roulette tool for model switching
 */
export const rouletteTool: AgentTool = {
	name: "roulette",
	label: "Model Roulette",
	description:
		"Manage model roulette - random model switching for improved performance. Actions: select, stats, config, reset, add, remove, weight.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: select (switch model), stats (view statistics), config (view configuration), reset (clear stats), add (add model), remove (remove model), weight (set model weight)",
		}),
		modelId: Type.Optional(Type.String({ description: "Model ID for remove/weight actions" })),
		weight: Type.Optional(Type.Number({ description: "Weight for weighted selection" })),
		model: Type.Optional(
			Type.Object({
				id: Type.String(),
				name: Type.Optional(Type.String()),
				weight: Type.Optional(Type.Number()),
				baseUrl: Type.Optional(Type.String()),
				apiKey: Type.Optional(Type.String()),
			}),
		),
	}),
	execute: async (
		_toolCallId,
		params,
	): Promise<{ content: Array<{ type: "text"; text: string }>; details: string }> => {
		const args = params as {
			action: string;
			modelId?: string;
			weight?: number;
			model?: RouletteModel;
		};

		try {
			const result = executeRouletteAction(args);
			return {
				content: [{ type: "text", text: result }],
				details: result,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: `Error: ${message}` }],
				details: `Error: ${message}`,
			};
		}
	},
};

/**
 * Execute roulette action
 */
function executeRouletteAction(args: {
	action: string;
	modelId?: string;
	weight?: number;
	model?: RouletteModel;
}): string {
	switch (args.action) {
		case "select": {
			try {
				const roulette = getModelRoulette();
				const selection = roulette.selectModel();
				return `Selected model: ${selection.model.id} (${selection.reason} selection on turn ${selection.turn})`;
			} catch {
				return "Error: Roulette not initialized. Configure roulette first.";
			}
		}

		case "stats": {
			try {
				const roulette = getModelRoulette();
				const stats = roulette.getStats();
				return formatRouletteStats(stats);
			} catch {
				return "Error: Roulette not initialized. Configure roulette first.";
			}
		}

		case "config": {
			try {
				const roulette = getModelRoulette();
				const models = roulette.getModels();
				const isValid = roulette.isValid();
				return `Model pool (${isValid ? "valid" : "invalid"}): ${models.map((m) => `${m.id}(weight:${m.weight ?? 1})`).join(", ")}`;
			} catch {
				return "Error: Roulette not initialized. Configure roulette first.";
			}
		}

		case "reset": {
			try {
				const roulette = getModelRoulette();
				roulette.resetStats();
				return "Statistics reset successfully";
			} catch {
				return "Error: Roulette not initialized. Configure roulette first.";
			}
		}

		case "add": {
			if (!args.model) {
				return "Error: model parameter required for add action";
			}
			try {
				const roulette = getModelRoulette();
				roulette.addModel(args.model);
				return `Added model: ${args.model.id} (weight: ${args.model.weight ?? 1})`;
			} catch {
				return "Error: Roulette not initialized. Configure roulette first.";
			}
		}

		case "remove": {
			if (!args.modelId) {
				return "Error: modelId parameter required for remove action";
			}
			try {
				const roulette = getModelRoulette();
				const removed = roulette.removeModel(args.modelId);
				return removed ? `Removed model: ${args.modelId}` : `Model not found: ${args.modelId}`;
			} catch {
				return "Error: Roulette not initialized. Configure roulette first.";
			}
		}

		case "weight": {
			if (!args.modelId || args.weight === undefined) {
				return "Error: modelId and weight parameters required for weight action";
			}
			try {
				const roulette = getModelRoulette();
				const updated = roulette.setModelWeight(args.modelId, args.weight);
				return updated
					? `Updated ${args.modelId} weight to ${args.weight}`
					: `Model not found: ${args.modelId}`;
			} catch {
				return "Error: Roulette not initialized. Configure roulette first.";
			}
		}

		case "init": {
			// Initialize roulette with default models (for testing)
			if (args.model) {
				const config: RouletteConfig = {
					models: [args.model],
					strategy: "random",
					trackStats: true,
				};
				resetModelRoulette();
				new ModelRoulette(config);
				return `Initialized roulette with model: ${args.model.id}`;
			}
			return "Error: model parameter required for init action";
		}

		default:
			return `Unknown action: ${args.action}. Available actions: select, stats, config, reset, add, remove, weight, init`;
	}
}

/**
 * Initialize roulette with configuration
 */
export function initRoulette(config: RouletteConfig, dataDir?: string): ModelRoulette {
	resetModelRoulette();
	return getModelRoulette(config, dataDir);
}
