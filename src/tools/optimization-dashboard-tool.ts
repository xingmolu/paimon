import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	OptimizationDashboardManager,
	getOptimizationDashboardManager,
	resetOptimizationDashboardManager,
} from "../optimization-dashboard.js";

export const optimizationDashboardTool: AgentTool = {
	name: "optimizationDashboard",
	label: "Evolution Optimization Dashboard",
	description:
		"Get a unified view of evolution health, bottlenecks, tool utilization, and optimization recommendations.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: report, health, utilization, bottlenecks, recommendations, compare, stats, config, update-config, mark-applied, reset, export, help",
		}),
		successRate: Type.Optional(Type.Number()),
		avgTime: Type.Optional(Type.Number()),
		errorCount: Type.Optional(Type.Number()),
		capabilitiesUsed: Type.Optional(Type.Number()),
		enabled: Type.Optional(Type.Boolean()),
		updateInterval: Type.Optional(Type.Number()),
		historySize: Type.Optional(Type.Number()),
		bottleneckThreshold: Type.Optional(Type.Number()),
		underutilizedThreshold: Type.Optional(Type.Number()),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getOptimizationDashboardManager();
		const {
			action,
			successRate,
			avgTime,
			errorCount,
			capabilitiesUsed,
			enabled,
			updateInterval,
			historySize,
			bottleneckThreshold,
			underutilizedThreshold,
		} = params as {
			action: string;
			successRate?: number;
			avgTime?: number;
			errorCount?: number;
			capabilitiesUsed?: number;
			enabled?: boolean;
			updateInterval?: number;
			historySize?: number;
			bottleneckThreshold?: number;
			underutilizedThreshold?: number;
		};

		switch (action) {
			case "report":
				return {
					content: [{ type: "text", text: manager.generateReport() }],
					details: { action: "report" },
				};
			case "health": {
				const health = manager.getHealth();
				return {
					content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
					details: health,
				};
			}
			case "utilization": {
				const utilizations = manager.getCapabilityUtilization();
				return {
					content: [{ type: "text", text: JSON.stringify(utilizations, null, 2) }],
					details: utilizations,
				};
			}
			case "bottlenecks": {
				const bottlenecks = manager.identifyBottlenecks();
				return {
					content: [{ type: "text", text: JSON.stringify(bottlenecks, null, 2) }],
					details: bottlenecks,
				};
			}
			case "recommendations": {
				const recommendations = manager.getRecommendations();
				return {
					content: [{ type: "text", text: JSON.stringify(recommendations, null, 2) }],
					details: recommendations,
				};
			}
			case "compare": {
				if (
					successRate === undefined ||
					avgTime === undefined ||
					errorCount === undefined ||
					capabilitiesUsed === undefined
				) {
					return {
						content: [
							{
								type: "text",
								text: "Error: compare requires successRate, avgTime, errorCount, capabilitiesUsed",
							},
						],
						details: { error: true },
					};
				}
				const comparison = manager.compareSession({
					successRate,
					avgTime,
					errorCount,
					capabilitiesUsed,
				});
				return {
					content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
					details: comparison,
				};
			}
			case "stats": {
				const stats = manager.getStats();
				return {
					content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
					details: stats,
				};
			}
			case "config": {
				const config = manager.getConfig();
				return {
					content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
					details: config,
				};
			}
			case "update-config": {
				const updates = {
					...(enabled !== undefined ? { enabled } : {}),
					...(updateInterval !== undefined ? { updateInterval } : {}),
					...(historySize !== undefined ? { historySize } : {}),
					...(bottleneckThreshold !== undefined ? { bottleneckThreshold } : {}),
					...(underutilizedThreshold !== undefined ? { underutilizedThreshold } : {}),
				};
				const config = manager.updateConfig(updates);
				return {
					content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
					details: config,
				};
			}
			case "mark-applied":
				manager.markApplied();
				return {
					content: [{ type: "text", text: "Optimization marked as applied." }],
					details: { applied: true },
				};
			case "reset":
				manager.resetStats();
				return {
					content: [{ type: "text", text: "Optimization dashboard stats reset." }],
					details: { reset: true },
				};
			case "export": {
				const data = manager.exportData();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
					details: data,
				};
			}
			case "help":
				return {
					content: [
						{
							type: "text",
							text: "Actions: report, health, utilization, bottlenecks, recommendations, compare, stats, config, update-config, mark-applied, reset, export, help",
						},
					],
					details: { action: "help" },
				};
			default:
				return {
					content: [{ type: "text", text: "Error: unknown action" }],
					details: { error: true, action },
				};
		}
	},
};

export {
	getOptimizationDashboardManager,
	resetOptimizationDashboardManager,
	OptimizationDashboardManager,
};
