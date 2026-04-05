/**
 * Linting Tool Wrapper
 *
 * Wraps the LintingManager as an AgentTool for use in the Paimon agent.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type LintingToolArgs, getLintingManager, lintingTool } from "../linting-manager.js";

/**
 * Linting tool for interactive linting with auto-fix capabilities
 */
export const lintingToolWrapper: AgentTool = {
	name: "linting",
	label: "Linting",
	description: `Manage interactive linting with built-in linters and auto-fix capabilities (Aider Pattern).

Actions:
- run: Run linting on files (requires files)
- auto-fix: Run linting with auto-fix enabled (requires files)
- linters: List all available linters
- linter: Get details of a specific linter (requires linterId)
- add-linter: Add a custom linter (requires linter config)
- remove-linter: Remove a linter (requires linterId)
- enable: Enable linting
- disable: Disable linting
- config: View or update configuration
- stats: View linting statistics
- reset: Reset statistics
- help: Get help message

Built-in Linters:
- TypeScript: tsc, eslint-ts
- JavaScript: eslint-js
- Python: pylint, mypy, ruff
- Rust: cargo-clippy
- Go: golangci-lint
- JSON: jsonlint
- YAML: yamllint
- Markdown: markdownlint

Example usage:
linting({action: 'run', files: ['src/agent.ts']})
linting({action: 'auto-fix', files: ['src/**/*.ts']})
linting({action: 'linters'})
linting({action: 'stats'})
`,
	parameters: Type.Object({
		action: Type.String({
			description: "Action to perform",
			enum: [
				"run",
				"auto-fix",
				"linters",
				"linter",
				"add-linter",
				"remove-linter",
				"enable",
				"disable",
				"config",
				"stats",
				"reset",
				"help",
			],
		}),
		files: Type.Optional(Type.Array(Type.String({ description: "Files to lint" }))),
		linterId: Type.Optional(Type.String({ description: "Linter ID for specific operations" })),
		linter: Type.Optional(
			Type.Object({
				id: Type.Optional(Type.String()),
				name: Type.Optional(Type.String()),
				language: Type.Optional(Type.String()),
				command: Type.Optional(Type.String()),
				args: Type.Optional(Type.Array(Type.String())),
				fileExtensions: Type.Optional(Type.Array(Type.String())),
				autoFixCommand: Type.Optional(Type.String()),
				autoFixArgs: Type.Optional(Type.Array(Type.String())),
				enabled: Type.Optional(Type.Boolean()),
				priority: Type.Optional(Type.Number()),
			}),
		),
		config: Type.Optional(
			Type.Object({
				enabled: Type.Optional(Type.Boolean()),
				autoLintAfterEdit: Type.Optional(Type.Boolean()),
				autoFix: Type.Optional(Type.Boolean()),
				runOnSave: Type.Optional(Type.Boolean()),
				minSeverity: Type.Optional(Type.String()),
			}),
		),
		directory: Type.Optional(Type.String({ description: "Directory to lint" })),
		recursive: Type.Optional(Type.Boolean({ description: "Recursive directory linting" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const args = params as LintingToolArgs;
		const result = lintingTool(args);
		return {
			content: [{ type: "text", text: result }],
			details: result,
		};
	},
};

/**
 * Get linting manager for advanced operations
 */
export function getLinting(): ReturnType<typeof getLintingManager> {
	return getLintingManager();
}
