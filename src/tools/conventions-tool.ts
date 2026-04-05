/**
 * Coding Conventions Tool (Aider Pattern)
 *
 * Tool for managing coding conventions that the agent follows when writing code.
 * Supports loading from CONVENTIONS.md files and .conventions/ directories.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type CodingConvention,
	type CodingConventionsManager,
	type ConventionCategory,
	type ConventionSource,
	getCodingConventionsManager,
} from "../coding-conventions.js";

type ConventionsAction =
	| "load"
	| "list"
	| "get"
	| "add"
	| "remove"
	| "enable"
	| "disable"
	| "apply"
	| "status"
	| "stats"
	| "config"
	| "reset"
	| "clear"
	| "help";

function formatConvention(convention: CodingConvention): string {
	const lines = [
		`### ${convention.name}`,
		"",
		`- **ID:** ${convention.id}`,
		`- **Category:** ${convention.category}`,
		`- **Source:** ${convention.source}`,
		`- **Enabled:** ${convention.enabled ? "✅" : "❌"}`,
		`- **Priority:** ${convention.priority}`,
		"",
		`**Description:** ${convention.description}`,
	];

	if (convention.rules.length > 0) {
		lines.push("", "**Rules:**");
		for (const rule of convention.rules) {
			const severityEmoji =
				rule.severity === "error" ? "🔴" : rule.severity === "warning" ? "🟡" : "🔵";
			lines.push(`- ${severityEmoji} ${rule.description}`);
			if (rule.example) {
				lines.push(`  - Example: \`${rule.example}\``);
			}
			if (rule.antiExample) {
				lines.push(`  - Avoid: \`${rule.antiExample}\``);
			}
		}
	}

	return lines.join("\n");
}

function formatConventionsList(conventions: CodingConvention[]): string {
	if (conventions.length === 0) {
		return "No conventions found.";
	}

	const lines = ["## Coding Conventions", ""];
	const byCategory = new Map<string, CodingConvention[]>();

	for (const convention of conventions) {
		const category = convention.category;
		if (!byCategory.has(category)) {
			byCategory.set(category, []);
		}
		byCategory.get(category)?.push(convention);
	}

	for (const [category, items] of byCategory) {
		lines.push(`### ${category.charAt(0).toUpperCase()}${category.slice(1)}`);
		lines.push("");
		for (const convention of items) {
			const status = convention.enabled ? "✅" : "❌";
			lines.push(`- ${status} **${convention.name}** (${convention.id})`);
			lines.push(`  - ${convention.description}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

function formatStats(stats: ReturnType<CodingConventionsManager["getStats"]>): string {
	const lines = [
		"## Coding Conventions Statistics",
		"",
		`**Total Conventions:** ${stats.totalConventions}`,
		`**Times Applied:** ${stats.timesApplied}`,
		`**Issues Found:** ${stats.issuesFound}`,
		`**Issues Fixed:** ${stats.issuesFixed}`,
		`**Last Loaded:** ${stats.lastLoaded || "Never"}`,
		"",
		"### By Category",
	];

	for (const [category, count] of Object.entries(stats.byCategory)) {
		lines.push(`- ${category}: ${count}`);
	}

	lines.push("", "### By Source");
	for (const [source, count] of Object.entries(stats.bySource)) {
		lines.push(`- ${source}: ${count}`);
	}

	return lines.join("\n");
}

function formatStatus(manager: CodingConventionsManager): string {
	const config = manager.getConfig();
	const stats = manager.getStats();
	const conventions = manager.getConventions();

	const lines = [
		"## Coding Conventions Status",
		"",
		`**Enabled:** ${config.enabled ? "✅ Yes" : "❌ No"}`,
		`**Auto-Load:** ${config.autoLoad ? "✅ Yes" : "❌ No"}`,
		`**Conventions Path:** ${config.conventionsPath}`,
		`**Detect Conventions:** ${config.detectConventions ? "✅ Yes" : "❌ No"}`,
		`**Enforce Conventions:** ${config.enforceConventions ? "✅ Yes" : "❌ No"}`,
		"",
		`**Total Conventions:** ${conventions.length}`,
		`**Enabled Conventions:** ${conventions.filter((c) => c.enabled).length}`,
		`**Last Loaded:** ${stats.lastLoaded || "Never"}`,
	];

	return lines.join("\n");
}

function getHelpMessage(): string {
	return `## Coding Conventions Tool

Manage coding conventions that the agent follows when writing code.
Inspired by Aider's CONVENTIONS.md pattern.

### Actions

| Action | Description |
|--------|-------------|
| \`load\` | Load conventions from file or directory |
| \`list\` | List all conventions |
| \`get\` | Get a specific convention by ID |
| \`add\` | Add a new convention |
| \`remove\` | Remove a convention |
| \`enable\` | Enable a convention |
| \`disable\` | Disable a convention |
| \`apply\` | Apply conventions to code (analysis) |
| \`status\` | Get current status |
| \`stats\` | View statistics |
| \`config\` | View/update configuration |
| \`reset\` | Reset statistics |
| \`clear\` | Clear all user conventions |
| \`help\` | Show this help message |

### Convention Categories

- \`libraries\` - Library preferences
- \`types\` - Type safety rules
- \`style\` - Code style conventions
- \`patterns\` - Design patterns
- \`testing\` - Testing conventions
- \`documentation\` - Documentation standards
- \`security\` - Security guidelines
- \`performance\` - Performance rules
- \`accessibility\` - Accessibility standards
- \`custom\` - Custom conventions

### Usage Examples

\`\`\`typescript
// Load conventions from CONVENTIONS.md
conventions({ action: 'load' })

// List all conventions
conventions({ action: 'list' })

// Get a specific convention
conventions({ action: 'get', id: 'typescript-types' })

// Add a new convention
conventions({
  action: 'add',
  name: 'Prefer httpx',
  category: 'libraries',
  description: 'Prefer httpx over requests for HTTP requests',
  rules: [
    { description: 'Use httpx instead of requests', severity: 'warning' }
  ],
  priority: 7
})

// Enable/disable a convention
conventions({ action: 'enable', id: 'typescript-types' })
conventions({ action: 'disable', id: 'naming-conventions' })

// View statistics
conventions({ action: 'stats' })

// Update configuration
conventions({ action: 'config', conventionsPath: './docs/CONVENTIONS.md' })
\`\`\`

### CONVENTIONS.md Format

Create a \`CONVENTIONS.md\` file in your project root:

\`\`\`markdown
# Coding Conventions

## Library Preferences
- Prefer httpx over requests for HTTP requests
- Use Zod for runtime type validation

## Type Safety
- Always use explicit types for function parameters
- Avoid 'any' type - use 'unknown' if type is unknown

## Style
- Use camelCase for variables and functions
- Use PascalCase for classes and types
\`\`\`

### Directory Structure

You can also organize conventions in a \`.conventions/\` directory:

\`\`\`
.conventions/
├── typescript.md
├── testing.json
└── style.md
\`\`\`

### Pattern Source

This capability is inspired by Aider's coding conventions:
https://aider.chat/docs/usage/conventions.html
`;
}

/**
 * Coding conventions tool for managing code style and patterns
 */
export const conventionsToolDefinition: AgentTool = {
	name: "conventions",
	label: "Coding Conventions",
	description:
		"Manage coding conventions for the agent to follow when writing code (Aider CONVENTIONS.md pattern)",
	parameters: Type.Object({
		action: Type.Union([
			Type.Literal("load"),
			Type.Literal("list"),
			Type.Literal("get"),
			Type.Literal("add"),
			Type.Literal("remove"),
			Type.Literal("enable"),
			Type.Literal("disable"),
			Type.Literal("apply"),
			Type.Literal("status"),
			Type.Literal("stats"),
			Type.Literal("config"),
			Type.Literal("reset"),
			Type.Literal("clear"),
			Type.Literal("help"),
		]),
		id: Type.Optional(Type.String()),
		name: Type.Optional(Type.String()),
		category: Type.Optional(Type.String()),
		description: Type.Optional(Type.String()),
		rules: Type.Optional(
			Type.Array(
				Type.Object({
					description: Type.String(),
					example: Type.Optional(Type.String()),
					antiExample: Type.Optional(Type.String()),
					severity: Type.Optional(Type.String()),
				}),
			),
		),
		priority: Type.Optional(Type.Number()),
		enabled: Type.Optional(Type.Boolean()),
		conventionsPath: Type.Optional(Type.String()),
		autoLoad: Type.Optional(Type.Boolean()),
		enforceConventions: Type.Optional(Type.Boolean()),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getCodingConventionsManager();
		const {
			action,
			id,
			name,
			category,
			description,
			rules,
			priority,
			enabled,
			conventionsPath,
			autoLoad,
			enforceConventions,
		} = params as {
			action: ConventionsAction;
			id?: string;
			name?: string;
			category?: ConventionCategory;
			description?: string;
			rules?: Array<{
				description: string;
				example?: string;
				antiExample?: string;
				severity?: string;
			}>;
			priority?: number;
			enabled?: boolean;
			conventionsPath?: string;
			autoLoad?: boolean;
			enforceConventions?: boolean;
		};

		switch (action) {
			case "load": {
				const fromFile = manager.loadConventionsFromFile();
				const fromDir = manager.loadConventionsFromDirectory();
				const message =
					fromFile || fromDir
						? "✅ Conventions loaded successfully"
						: "ℹ️ No conventions files found";
				return {
					content: [{ type: "text", text: message }],
					details: { fromFile, fromDir, stats: manager.getStats() },
				};
			}

			case "list": {
				const conventions = manager.getConventions();
				return {
					content: [{ type: "text", text: formatConventionsList(conventions) }],
					details: { conventions },
				};
			}

			case "get": {
				if (!id) {
					return {
						content: [{ type: "text", text: "❌ Convention ID is required for 'get' action" }],
						details: { error: "missing id" },
					};
				}
				const convention = manager.getConvention(id);
				if (!convention) {
					return {
						content: [{ type: "text", text: `❌ Convention not found: ${id}` }],
						details: { error: "not found", id },
					};
				}
				return {
					content: [{ type: "text", text: formatConvention(convention) }],
					details: { convention },
				};
			}

			case "add": {
				if (!name || !category || !description) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Name, category, and description are required for 'add' action",
							},
						],
						details: { error: "missing required fields" },
					};
				}
				const convention = manager.addConvention({
					name,
					category: category as ConventionCategory,
					description,
					rules:
						rules?.map((r, i) => ({
							id: `rule-${Date.now()}-${i}`,
							description: r.description,
							example: r.example,
							antiExample: r.antiExample,
							severity: (r.severity as "error" | "warning" | "info") || "info",
						})) || [],
					enabled: enabled !== false,
					priority: priority || 5,
					source: "user" as ConventionSource,
				});
				return {
					content: [
						{
							type: "text",
							text: `✅ Added convention: ${convention.name} (${convention.id})`,
						},
					],
					details: { convention },
				};
			}

			case "remove": {
				if (!id) {
					return {
						content: [{ type: "text", text: "❌ Convention ID is required for 'remove' action" }],
						details: { error: "missing id" },
					};
				}
				const removed = manager.removeConvention(id);
				return {
					content: [
						{
							type: "text",
							text: removed ? `✅ Removed convention: ${id}` : `❌ Convention not found: ${id}`,
						},
					],
					details: { removed, id },
				};
			}

			case "enable": {
				if (!id) {
					return {
						content: [{ type: "text", text: "❌ Convention ID is required for 'enable' action" }],
						details: { error: "missing id" },
					};
				}
				const success = manager.setConventionEnabled(id, true);
				return {
					content: [
						{
							type: "text",
							text: success ? `✅ Enabled convention: ${id}` : `❌ Convention not found: ${id}`,
						},
					],
					details: { success, id },
				};
			}

			case "disable": {
				if (!id) {
					return {
						content: [{ type: "text", text: "❌ Convention ID is required for 'disable' action" }],
						details: { error: "missing id" },
					};
				}
				const success = manager.setConventionEnabled(id, false);
				return {
					content: [
						{
							type: "text",
							text: success ? `❌ Disabled convention: ${id}` : `❌ Convention not found: ${id}`,
						},
					],
					details: { success, id },
				};
			}

			case "apply": {
				const conventionsPrompt = manager.getConventionsForPrompt();
				if (!conventionsPrompt) {
					return {
						content: [{ type: "text", text: "ℹ️ No conventions to apply" }],
						details: { applied: false },
					};
				}
				manager.recordApplication();
				return {
					content: [
						{
							type: "text",
							text: `✅ Conventions ready for application:\n\n${conventionsPrompt}`,
						},
					],
					details: { applied: true, conventionCount: manager.getConventions().length },
				};
			}

			case "status": {
				return {
					content: [{ type: "text", text: formatStatus(manager) }],
					details: { config: manager.getConfig(), stats: manager.getStats() },
				};
			}

			case "stats": {
				const stats = manager.getStats();
				return {
					content: [{ type: "text", text: formatStats(stats) }],
					details: { stats },
				};
			}

			case "config": {
				if (
					conventionsPath !== undefined ||
					autoLoad !== undefined ||
					enforceConventions !== undefined
				) {
					const updates: Record<string, unknown> = {};
					if (conventionsPath !== undefined) updates.conventionsPath = conventionsPath;
					if (autoLoad !== undefined) updates.autoLoad = autoLoad;
					if (enforceConventions !== undefined) updates.enforceConventions = enforceConventions;

					const config = manager.updateConfig(updates);
					return {
						content: [
							{
								type: "text",
								text: `⚙️ Configuration updated:\n\n- **Enabled:** ${config.enabled ? "✅" : "❌"}\n- **Auto-Load:** ${config.autoLoad ? "✅" : "❌"}\n- **Conventions Path:** ${config.conventionsPath}\n- **Enforce Conventions:** ${config.enforceConventions ? "✅" : "❌"}`,
							},
						],
						details: { config },
					};
				}
				const config = manager.getConfig();
				return {
					content: [
						{
							type: "text",
							text: `## Coding Conventions Configuration\n\n- **Enabled:** ${config.enabled ? "✅" : "❌"}\n- **Auto-Load:** ${config.autoLoad ? "✅" : "❌"}\n- **Conventions Path:** ${config.conventionsPath}\n- **Detect Conventions:** ${config.detectConventions ? "✅" : "❌"}\n- **Enforce Conventions:** ${config.enforceConventions ? "✅" : "❌"}`,
						},
					],
					details: { config },
				};
			}

			case "reset": {
				const result = manager.resetStats();
				return {
					content: [{ type: "text", text: `🔄 ${result.message}` }],
					details: { success: result.success },
				};
			}

			case "clear": {
				const result = manager.clearConventions();
				return {
					content: [{ type: "text", text: `🗑️ ${result.message}` }],
					details: { success: result.success, count: result.count },
				};
			}

			case "help": {
				return {
					content: [{ type: "text", text: getHelpMessage() }],
					details: {},
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `❌ Unknown action: ${action}\nUse 'help' to see available actions.`,
						},
					],
					details: { error: "unknown action", action },
				};
		}
	},
};

// Re-export for convenience
export {
	getCodingConventionsManager,
	CodingConventionsManager,
	type CodingConvention,
	type ConventionCategory,
	type ConventionSource,
	type ConventionsConfig,
	type ConventionsStats,
} from "../coding-conventions.js";
