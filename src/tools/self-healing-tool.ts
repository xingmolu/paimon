/**
 * Self-Healing Tool Wrapper
 *
 * Wraps the SelfHealingManager as an AgentTool for use in the Paimon agent.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type SelfHealingToolArgs,
	getSelfHealingManager,
	selfHealingTool,
} from "../self-healing.js";

/**
 * Self-healing tool for automatic error detection and correction
 */
export const selfHealingToolWrapper: AgentTool = {
	name: "selfHealing",
	label: "Self-Healing",
	description: `Manage self-healing code patterns - automatic detection and correction of common error patterns.

Actions:
- detect: Detect patterns in error content (requires errorContent)
- fix: Apply fix for detected pattern (requires errorContent)
- auto-fix: Auto-fix all detected patterns (requires errorContent)
- patterns: List all patterns
- pattern: Get details of a specific pattern (requires patternId)
- categories: List patterns by category
- severity: List patterns by severity level (requires severity)
- stats: View statistics
- config: View or update configuration
- enable: Enable self-healing
- disable: Disable self-healing
- add: Add custom pattern (requires pattern object)
- remove: Remove a pattern (requires patternId)
- reset: Reset statistics
- history: View detection history
- help: Get help message

Example usage:
selfHealing({action: 'detect', errorContent: 'Cannot find name "foo"', filePath: 'src/test.ts'})
selfHealing({action: 'auto-fix', errorContent: '...lint errors...', filePath: 'src/file.ts'})
selfHealing({action: 'patterns'})
selfHealing({action: 'stats'})
`,
	parameters: Type.Object({
		action: Type.String({
			description: "Action to perform",
			enum: [
				"detect",
				"fix",
				"auto-fix",
				"patterns",
				"pattern",
				"categories",
				"severity",
				"stats",
				"config",
				"enable",
				"disable",
				"add",
				"remove",
				"reset",
				"history",
				"help",
			],
		}),
		errorContent: Type.Optional(
			Type.String({ description: "Error content to detect patterns in" }),
		),
		filePath: Type.Optional(Type.String({ description: "File path if applicable" })),
		patternId: Type.Optional(Type.String({ description: "Pattern ID for specific operations" })),
		category: Type.Optional(
			Type.String({
				description: "Category to filter by",
				enum: ["typescript", "lint", "test", "runtime", "import", "syntax", "dependency"],
			}),
		),
		severity: Type.Optional(
			Type.String({
				description: "Severity level",
				enum: ["low", "medium", "high", "critical"],
			}),
		),
		workingDirectory: Type.Optional(Type.String({ description: "Working directory" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const args = params as SelfHealingToolArgs;
		const result = selfHealingTool(args);
		return {
			content: [{ type: "text", text: result }],
			details: result,
		};
	},
};

/**
 * Get self-healing manager for advanced operations
 */
export function getSelfHealing(): ReturnType<typeof getSelfHealingManager> {
	return getSelfHealingManager();
}
