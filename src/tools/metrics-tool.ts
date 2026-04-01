/**
 * Evolution Metrics Dashboard tool - View and analyze evolution metrics
 *
 * Tracks and visualizes evolution metrics over time.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	EvolutionMetricsTracker,
	formatMetricsDashboard,
	formatSuccessRateChart,
	getMetricsTracker,
} from "../metrics.js";

/**
 * Metrics tool for viewing evolution metrics dashboard
 */
export const metricsTool: AgentTool = {
	name: "metrics",
	label: "Evolution Metrics Dashboard",
	description:
		"View and analyze evolution metrics over time. Use this to track success rate trends, time metrics, error patterns, skill effectiveness, and capability velocity.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'dashboard' (full metrics view), 'success' (success rate metrics), 'time' (time metrics), 'errors' (error metrics), 'skills' (skill effectiveness), 'velocity' (capability velocity), 'chart' (success rate chart), 'refresh' (reload sessions), 'save' (save metrics to file)",
		}),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action } = params as { action: string };

		try {
			const tracker = getMetricsTracker();

			switch (action) {
				case "dashboard": {
					const metrics = tracker.getMetrics();
					return {
						content: [{ type: "text", text: formatMetricsDashboard(metrics) }],
						details: { metrics },
					};
				}

				case "success": {
					const metrics = tracker.getMetrics();
					const lines: string[] = [
						"## First-Try Success Rate Metrics",
						"",
						`**Current Rate:** ${metrics.successRate.current.toFixed(1)}%`,
						`**Weekly Average:** ${metrics.successRate.weeklyAverage.toFixed(1)}%`,
						`**Improvement:** ${metrics.successRate.improvement >= 0 ? "+" : ""}${metrics.successRate.improvement.toFixed(1)}%`,
						"",
					];

					if (metrics.successRate.points.length > 0) {
						lines.push("### Weekly Trend");
						for (const point of metrics.successRate.points) {
							const trendIcon = point.trend === "up" ? "📈" : point.trend === "down" ? "📉" : "➡️";
							lines.push(`- ${point.date}: ${point.value.toFixed(1)}% ${trendIcon}`);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { successRate: metrics.successRate },
					};
				}

				case "time": {
					const metrics = tracker.getMetrics();
					const lines: string[] = [
						"## Time Metrics",
						"",
						`**Average Time:** ~${metrics.time.averageMinutes.toFixed(1)}m`,
						`**Fastest Task:** "${metrics.time.fastestTask}"`,
						`**Slowest Task:** "${metrics.time.slowestTask}"`,
						"",
					];

					if (Object.keys(metrics.time.byTaskType).length > 0) {
						lines.push("### By Task Type");
						for (const [type, avg] of Object.entries(metrics.time.byTaskType)) {
							lines.push(`- ${type}: ~${avg.toFixed(1)}m`);
						}
					}

					if (metrics.time.points.length > 0) {
						lines.push("", "### Weekly Trend");
						for (const point of metrics.time.points) {
							const trendIcon = point.trend === "up" ? "⏱️" : point.trend === "down" ? "🐌" : "➡️";
							lines.push(`- ${point.date}: ~${point.value.toFixed(1)}m ${trendIcon}`);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { time: metrics.time },
					};
				}

				case "errors": {
					const metrics = tracker.getMetrics();
					const lines: string[] = [
						"## Error Metrics",
						"",
						`**Total Errors:** ${metrics.errors.totalErrors}`,
						"",
					];

					if (Object.keys(metrics.errors.byType).length > 0) {
						lines.push("### By Error Type");
						for (const [type, count] of Object.entries(metrics.errors.byType)) {
							lines.push(`- ${type}: ${count}`);
						}
					}

					if (metrics.errors.commonPatterns.length > 0) {
						lines.push("", "### Common Patterns");
						for (const pattern of metrics.errors.commonPatterns) {
							lines.push(`- ${pattern}`);
						}
					}

					if (metrics.errors.recentErrors.length > 0) {
						lines.push("", "### Recent Errors");
						for (const error of metrics.errors.recentErrors.slice(0, 5)) {
							lines.push(`- ${error}`);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { errors: metrics.errors },
					};
				}

				case "skills": {
					const metrics = tracker.getMetrics();
					const lines: string[] = ["## Skill Effectiveness Metrics", ""];

					if (metrics.skills.length > 0) {
						lines.push("### Top Skills (by usage)");
						for (const skill of metrics.skills) {
							const trendIcon =
								skill.trend === "improving" ? "📈" : skill.trend === "declining" ? "📉" : "➡️";
							lines.push(`- **${skill.skill}**`);
							lines.push(`  - Usage: ${skill.usageCount} times`);
							lines.push(`  - Success Rate: ${skill.successRate.toFixed(0)}%`);
							lines.push(`  - Average Time: ~${skill.averageTime.toFixed(0)}m`);
							lines.push(`  - Trend: ${trendIcon} ${skill.trend}`);
						}
					} else {
						lines.push("No skill data available.");
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { skills: metrics.skills },
					};
				}

				case "velocity": {
					const metrics = tracker.getMetrics();
					const lines: string[] = [
						"## Capability Velocity Metrics",
						"",
						`**Current Velocity:** ${metrics.capabilityVelocity.current.toFixed(1)} capabilities/day`,
						`**Total Capabilities:** ${metrics.capabilityVelocity.totalCapabilities}`,
						`**High Impact:** ${metrics.capabilityVelocity.highImpactCount} (${metrics.capabilityVelocity.highImpactPercentage.toFixed(0)}%)`,
						"",
					];

					if (metrics.capabilityVelocity.points.length > 0) {
						lines.push("### Weekly Velocity Trend");
						for (const point of metrics.capabilityVelocity.points) {
							lines.push(`- ${point.date}: ${point.value.toFixed(1)} caps/day`);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { velocity: metrics.capabilityVelocity },
					};
				}

				case "chart": {
					const metrics = tracker.getMetrics();
					return {
						content: [{ type: "text", text: formatSuccessRateChart(metrics) }],
						details: { chart: metrics.successRate },
					};
				}

				case "refresh": {
					const refreshed = tracker.refresh();
					return {
						content: [
							{
								type: "text",
								text: `Metrics refreshed. ${refreshed.iterationsAnalyzed} iterations analyzed.\n\n${formatMetricsDashboard(refreshed)}`,
							},
						],
						details: { metrics: refreshed },
					};
				}

				case "save": {
					tracker.saveMetrics();
					const metrics = tracker.getMetrics();
					return {
						content: [
							{
								type: "text",
								text: `Metrics saved to data/evolution-metrics.json\n\nLast updated: ${metrics.lastUpdated}`,
							},
						],
						details: { saved: true, lastUpdated: metrics.lastUpdated },
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: dashboard, success, time, errors, skills, velocity, chart, refresh, save`,
							},
						],
						details: `Error: Unknown action '${action}'`,
					};
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};
