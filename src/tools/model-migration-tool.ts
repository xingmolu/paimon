/**
 * Model Migration Tool
 *
 * Provides tool interface for the ModelMigrationManager.
 *
 * Actions:
 * - scan: Scan a file or directory for migration opportunities
 * - create: Create a new migration plan
 * - execute: Execute a migration
 * - list: List all migrations
 * - status: Get migration status or statistics
 * - rollback: Rollback a completed migration
 * - rules: View migration rules
 * - add-rule: Add a custom migration rule
 * - remove-rule: Remove a migration rule
 * - stats: View migration statistics
 * - config: View or update configuration
 * - migrations: List supported migrations
 * - help: Show help message
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type MigrationRule, modelMigrationTool } from "../model-migration.js";

// Tool definition
export const modelMigrationToolDefinition: AgentTool = {
	name: "modelMigration",
	label: "Model Migration",
	description: `Manage model migration between LLM versions - scan for migration opportunities, create migration plans, execute migrations, rollback changes.

Actions:
- scan: Scan a file or directory for migration opportunities
- create: Create a new migration plan
- execute: Execute a migration
- list: List all migrations
- status: Get migration status or statistics
- rollback: Rollback a completed migration
- rules: View migration rules
- add-rule: Add a custom migration rule
- remove-rule: Remove a migration rule
- stats: View migration statistics
- config: View or update configuration
- migrations: List supported migrations
- help: Show help message

Example usage:
modelMigration({action: 'scan', path: 'src/'})
modelMigration({action: 'create', fromModel: 'claude-3', toModel: 'claude-4', path: '.'})
modelMigration({action: 'execute', migrationId: 'migration-123'})
modelMigration({action: 'rollback', migrationId: 'migration-123'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: scan, create, execute, list, status, rollback, rules, add-rule, remove-rule, stats, config, migrations, help",
		}),
		path: Type.Optional(
			Type.String({ description: "File or directory path to scan (for scan, create actions)" }),
		),
		fromModel: Type.Optional(
			Type.String({ description: "Source model name (for create action, e.g., 'claude-3')" }),
		),
		toModel: Type.Optional(
			Type.String({ description: "Target model name (for create action, e.g., 'claude-4')" }),
		),
		migrationId: Type.Optional(
			Type.String({ description: "Migration ID for status, execute, or rollback actions" }),
		),
		recursive: Type.Optional(
			Type.Boolean({ description: "Scan directories recursively (default: true)" }),
		),
		dryRun: Type.Optional(
			Type.Boolean({ description: "Simulate migration without applying changes" }),
		),
		rule: Type.Optional(
			Type.Object({
				fromPattern: Type.String(),
				toReplacement: Type.String(),
				description: Type.String(),
				filePatterns: Type.Array(Type.String()),
				priority: Type.Number(),
			}),
		),
		pattern: Type.Optional(Type.String({ description: "Pattern string for remove-rule action" })),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = modelMigrationTool({
			action: String(p.action),
			path: p.path as string | undefined,
			fromModel: p.fromModel as string | undefined,
			toModel: p.toModel as string | undefined,
			migrationId: p.migrationId as string | undefined,
			recursive: p.recursive as boolean | undefined,
			dryRun: p.dryRun as boolean | undefined,
			rule: p.rule as MigrationRule | undefined,
			pattern: p.pattern as string | undefined,
		});
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};
