/**
 * Regression Testing Tool
 *
 * Tool for running regression tests and tracking capability health.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type CapabilityHealth,
	EvolutionRegressionTester,
	type RegressionSnapshot,
	type RegressionTestingConfig,
	type RegressionTestingStats,
	type SnapshotComparison,
	getRegressionTester,
	initRegressionTester,
} from "../regression-testing.js";

// Tool definition
export const regressionTestingToolDef: AgentTool = {
	name: "regressionTesting",
	label: "Regression Testing",
	description: `Run regression tests and track capability health after evolution iterations.

Actions:
- run: Run all tests and create snapshot
- run-after-evolution: Run tests after evolution iteration (requires iterationId, taskDescription)
- health: Get health for specific capability (requires capabilityId)
- health-all: Get health for all capabilities
- health-by-status: Get capabilities by status (requires status: healthy/degraded/broken/unknown)
- snapshot: Get snapshot by ID, or latest if no ID provided
- snapshots: List recent snapshots
- compare: Compare two snapshots (requires beforeId, afterId)
- stats: View regression testing statistics
- config: View configuration
- update-config: Update configuration
- clear: Clear all data
- enable: Enable regression testing
- disable: Disable regression testing
- help: Show help message

Example usage:
regressionTesting({action: 'run'})
regressionTesting({action: 'run-after-evolution', iterationId: 'iter-123', taskDescription: 'Add capability', changes: ['src/new.ts']})
regressionTesting({action: 'health-all'})
regressionTesting({action: 'compare', beforeId: 'snapshot-1', afterId: 'snapshot-2'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: run, run-after-evolution, health, health-all, health-by-status, snapshot, snapshots, compare, stats, config, update-config, clear, enable, disable, help",
		}),
		snapshotId: Type.Optional(Type.String({ description: "Snapshot ID" })),
		beforeId: Type.Optional(Type.String({ description: "Before snapshot ID for comparison" })),
		afterId: Type.Optional(Type.String({ description: "After snapshot ID for comparison" })),
		capabilityId: Type.Optional(Type.String({ description: "Capability ID" })),
		status: Type.Optional(
			Type.String({ description: "Status filter: healthy, degraded, broken, unknown" }),
		),
		iterationId: Type.Optional(
			Type.String({ description: "Iteration ID for run-after-evolution" }),
		),
		taskDescription: Type.Optional(
			Type.String({ description: "Task description for run-after-evolution" }),
		),
		changes: Type.Optional(Type.Array(Type.String(), { description: "Changed files" })),
		limit: Type.Optional(Type.Number({ description: "Limit for snapshots list" })),
		timeout: Type.Optional(Type.Number({ description: "Test timeout in milliseconds" })),
		config: Type.Optional(
			Type.Object({
				enabled: Type.Optional(Type.Boolean()),
				autoRunAfterEvolution: Type.Optional(Type.Boolean()),
				snapshotRetentionDays: Type.Optional(Type.Number()),
				maxSnapshots: Type.Optional(Type.Number()),
				testTimeout: Type.Optional(Type.Number()),
				trackCapabilityHealth: Type.Optional(Type.Boolean()),
			}),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executeRegressionTestingTool({
			action: String(p.action),
			snapshotId: p.snapshotId as string | undefined,
			beforeId: p.beforeId as string | undefined,
			afterId: p.afterId as string | undefined,
			capabilityId: p.capabilityId as string | undefined,
			status: p.status as "healthy" | "degraded" | "broken" | "unknown" | undefined,
			iterationId: p.iterationId as string | undefined,
			taskDescription: p.taskDescription as string | undefined,
			changes: p.changes as string[] | undefined,
			limit: p.limit as number | undefined,
			timeout: p.timeout as number | undefined,
			config: p.config as Partial<RegressionTestingConfig> | undefined,
		});
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

/**
 * Execute regression testing tool action
 */
export function executeRegressionTestingTool(args: {
	action: string;
	snapshotId?: string;
	beforeId?: string;
	afterId?: string;
	capabilityId?: string;
	status?: "healthy" | "degraded" | "broken" | "unknown";
	iterationId?: string;
	taskDescription?: string;
	changes?: string[];
	limit?: number;
	timeout?: number;
	config?: Partial<RegressionTestingConfig>;
}): string {
	const tester = getRegressionTester();

	switch (args.action) {
		case "run": {
			const snapshot = tester.runTests(args.timeout);
			return tester.formatSnapshot(snapshot);
		}

		case "run-after-evolution": {
			if (!args.iterationId || !args.taskDescription) {
				return "Error: iterationId and taskDescription required for run-after-evolution";
			}
			const snapshot = tester.runAfterEvolution(
				args.iterationId,
				args.taskDescription,
				args.changes,
			);
			return tester.formatSnapshot(snapshot);
		}

		case "health": {
			if (!args.capabilityId) {
				return "Error: capabilityId required for health action";
			}
			const health = tester.getCapabilityHealth(args.capabilityId);
			if (!health) {
				return `Capability not found: ${args.capabilityId}`;
			}
			return tester.formatCapabilityHealth(health);
		}

		case "health-all": {
			const healths = tester.getAllCapabilitiesHealth();
			const lines: string[] = [
				"# All Capability Health",
				"",
				`**Total Capabilities:** ${healths.length}`,
				"",
				"| Capability | Status | Pass Rate | Last Tested |",
				"|------------|--------|-----------|-------------|",
			];

			const statusEmoji = {
				healthy: "✅",
				degraded: "⚠️",
				broken: "❌",
				unknown: "❓",
			};

			for (const health of healths.slice(0, 20)) {
				lines.push(
					`| ${health.capabilityName.slice(0, 30)} | ${statusEmoji[health.status]} ${health.status} | ${Math.round(health.passRate * 100)}% | ${health.lastTested} |`,
				);
			}

			if (healths.length > 20) {
				lines.push("", `... and ${healths.length - 20} more`);
			}

			return lines.join("\n");
		}

		case "health-by-status": {
			if (!args.status) {
				return "Error: status required for health-by-status action (healthy, degraded, broken, unknown)";
			}
			const healths = tester.getCapabilitiesByStatus(args.status);
			const lines: string[] = [
				`# Capabilities with Status: ${args.status}`,
				"",
				`**Count:** ${healths.length}`,
				"",
			];

			for (const health of healths) {
				lines.push(`- ${health.capabilityName} (${Math.round(health.passRate * 100)}% pass rate)`);
			}

			return lines.join("\n");
		}

		case "snapshot": {
			if (!args.snapshotId) {
				// Get latest snapshot
				const snapshots = tester.getRecentSnapshots(1);
				if (snapshots.length === 0) {
					return "No snapshots available. Run tests first.";
				}
				return tester.formatSnapshot(snapshots[0]);
			}

			const snapshot = tester.getSnapshot(args.snapshotId);
			if (!snapshot) {
				return `Snapshot not found: ${args.snapshotId}`;
			}
			return tester.formatSnapshot(snapshot);
		}

		case "snapshots": {
			const snapshots = tester.getRecentSnapshots(args.limit || 10);
			if (snapshots.length === 0) {
				return "No snapshots available. Run tests first.";
			}

			const lines: string[] = [
				"# Recent Regression Snapshots",
				"",
				"| Snapshot ID | Timestamp | Pass Rate | Tests | Failed |",
				"|-------------|-----------|-----------|-------|--------|",
			];

			for (const snapshot of snapshots) {
				lines.push(
					`| ${snapshot.id.slice(0, 20)}... | ${snapshot.timestamp.slice(0, 19)} | ${Math.round(snapshot.passRate * 100)}% | ${snapshot.totalTests} | ${snapshot.failedTests} |`,
				);
			}

			return lines.join("\n");
		}

		case "compare": {
			if (!args.beforeId || !args.afterId) {
				return "Error: beforeId and afterId required for compare action";
			}

			const comparison = tester.compareSnapshots(args.beforeId, args.afterId);
			if (!comparison) {
				return "Error: One or both snapshots not found";
			}

			return tester.formatComparison(comparison);
		}

		case "stats": {
			const stats = tester.getStats();
			return tester.formatStats(stats);
		}

		case "config": {
			const config = tester.getConfig();
			if (args.config) {
				tester.updateConfig(args.config);
				return `Configuration updated:\n${JSON.stringify(tester.getConfig(), null, 2)}`;
			}

			const lines: string[] = [
				"# Regression Testing Configuration",
				"",
				"| Setting | Value |",
				"|---------|-------|",
				"| Enabled | ${config.enabled} |",
				"| Auto Run After Evolution | ${config.autoRunAfterEvolution} |",
				"| Snapshot Retention (days) | ${config.snapshotRetentionDays} |",
				"| Max Snapshots | ${config.maxSnapshots} |",
				"| Test Timeout (ms) | ${config.testTimeout} |",
				"| Track Capability Health | ${config.trackCapabilityHealth} |",
				"| Data Path | ${config.dataPath} |",
			];

			return lines.join("\n");
		}

		case "update-config": {
			if (!args.config) {
				return "Error: config object required for update-config action";
			}
			tester.updateConfig(args.config);
			return "Configuration updated successfully";
		}

		case "clear": {
			tester.clear();
			return "All regression testing data cleared";
		}

		case "enable": {
			tester.setEnabled(true);
			return "Regression testing enabled";
		}

		case "disable": {
			tester.setEnabled(false);
			return "Regression testing disabled";
		}

		case "help": {
			return `
# Regression Testing Tool

Run regression tests and track capability health after evolution iterations.

## Actions

| Action | Description |
|--------|-------------|
| run | Run all tests and create snapshot |
| run-after-evolution | Run tests after evolution iteration (requires iterationId, taskDescription) |
| health | Get health for specific capability (requires capabilityId) |
| health-all | Get health for all capabilities |
| health-by-status | Get capabilities by status (requires status: healthy/degraded/broken/unknown) |
| snapshot | Get snapshot by ID, or latest if no ID provided |
| snapshots | List recent snapshots |
| compare | Compare two snapshots (requires beforeId, afterId) |
| stats | View regression testing statistics |
| config | View configuration |
| update-config | Update configuration |
| clear | Clear all data |
| enable | Enable regression testing |
| disable | Disable regression testing |

## Capability Health Status

| Status | Description |
|--------|-------------|
| healthy | Pass rate >= 90% |
| degraded | Pass rate 70-89% |
| broken | Pass rate < 70% |
| unknown | Not yet tested |
`;
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' to see available actions.`;
	}
}

// Export tool
export const regressionTestingTool = {
	definition: regressionTestingToolDef,
	execute: executeRegressionTestingTool,
};
