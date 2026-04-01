/**
 * Safety Gates Tool
 *
 * Tool for scanning code changes for dangerous patterns before they're applied.
 * Enables safer self-modification by catching breaking changes proactively.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type CustomPattern,
	type SafetyGateConfig,
	type ScanResult,
	getSafetyGateManager,
} from "../safety-gates.js";

/**
 * Safety gates tool for proactive dangerous pattern detection
 */
export const safetyGatesTool: AgentTool = {
	name: "safetyGates",
	label: "Safety Gates",
	description:
		"Self-Modification Safety Gates - scan code changes for dangerous patterns before they're applied. Use before making risky changes to catch security vulnerabilities, breaking changes, and unsafe operations.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'scan' (scan code), 'config' (view config), 'patterns' (list patterns), 'stats' (statistics), 'reset' (reset stats), 'add' (add pattern), 'remove' (remove pattern), 'ignore' (ignore pattern), 'unignore' (unignore), 'enable' (enable), 'disable' (disable)",
		}),
		content: Type.Optional(
			Type.String({
				description: "Code content to scan (for scan action)",
			}),
		),
		file: Type.Optional(
			Type.String({
				description: "File path being scanned (for scan action)",
			}),
		),
		blockLevel: Type.Optional(
			Type.String({
				description: "Minimum risk level to block: critical, high, medium, low",
			}),
		),
		warnLevel: Type.Optional(
			Type.String({
				description: "Minimum risk level to warn: critical, high, medium, low",
			}),
		),
		allowBypass: Type.Optional(
			Type.Boolean({
				description: "Allow bypassing patterns with explicit approval",
			}),
		),
		id: Type.Optional(
			Type.String({
				description: "Pattern ID (for remove, ignore, unignore actions)",
			}),
		),
		pattern: Type.Optional(
			Type.String({
				description: "Regex pattern string (for add action)",
			}),
		),
		category: Type.Optional(
			Type.String({
				description:
					"Category for custom pattern: security, breaking, data-loss, workflow, dependencies, configuration, resource, self-modification",
			}),
		),
		risk: Type.Optional(
			Type.String({
				description: "Risk level for custom pattern: critical, high, medium, low",
			}),
		),
		description: Type.Optional(
			Type.String({
				description: "Description for custom pattern (for add action)",
			}),
		),
		suggestion: Type.Optional(
			Type.String({
				description: "Suggested fix for custom pattern (for add action)",
			}),
		),
		bypassable: Type.Optional(
			Type.Boolean({
				description: "Whether custom pattern can be bypassed (for add action)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getSafetyGateManager();
		const typedParams = params as Record<string, unknown>;
		const action = String(typedParams.action || "patterns");

		try {
			switch (action) {
				case "scan":
					return handleScan(manager, typedParams);

				case "config":
					return handleConfig(manager, typedParams);

				case "patterns": {
					const output = manager.formatPatternsList();
					return { content: [{ type: "text", text: output }], details: output };
				}

				case "stats": {
					const output = manager.formatStats();
					return { content: [{ type: "text", text: output }], details: output };
				}

				case "reset":
					manager.resetStats();
					return {
						content: [{ type: "text", text: "✅ Safety gate statistics reset" }],
						details: "Stats reset",
					};

				case "add":
					return handleAddPattern(manager, typedParams);

				case "remove":
					return handleRemovePattern(manager, typedParams);

				case "ignore":
					return handleIgnorePattern(manager, typedParams);

				case "unignore":
					return handleUnignorePattern(manager, typedParams);

				case "enable":
					manager.setEnabled(true);
					return {
						content: [{ type: "text", text: "✅ Safety gates enabled" }],
						details: "Safety gates enabled",
					};

				case "disable":
					manager.setEnabled(false);
					return {
						content: [
							{ type: "text", text: "⚠️ Safety gates disabled - risky changes will not be blocked" },
						],
						details: "Safety gates disabled",
					};

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Available: scan, config, patterns, stats, reset, add, remove, ignore, unignore, enable, disable`,
							},
						],
						details: `Unknown action: ${action}`,
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

/**
 * Handle scan action
 */
function handleScan(
	manager: ReturnType<typeof getSafetyGateManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const content = params.content ? String(params.content) : "";
	const file = params.file ? String(params.file) : undefined;

	if (!content) {
		return {
			content: [{ type: "text", text: "Error: No content provided. Use 'content' parameter." }],
			details: "Error: no content",
		};
	}

	const result = manager.scan(content, file);
	const output = manager.formatScanResult(result);
	return { content: [{ type: "text", text: output }], details: output };
}

/**
 * Handle config action
 */
function handleConfig(
	manager: ReturnType<typeof getSafetyGateManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	// If updating config
	if (params.blockLevel || params.warnLevel || params.allowBypass !== undefined) {
		const updates: Partial<SafetyGateConfig> = {};

		if (params.blockLevel) {
			updates.blockLevel = String(params.blockLevel) as SafetyGateConfig["blockLevel"];
		}
		if (params.warnLevel) {
			updates.warnLevel = String(params.warnLevel) as SafetyGateConfig["warnLevel"];
		}
		if (params.allowBypass !== undefined) {
			updates.allowBypass = Boolean(params.allowBypass);
		}

		manager.updateConfig(updates);
	}

	// Display current config
	const config = manager.getConfig();
	let output = "## Safety Gate Configuration\n";
	output += `${"─".repeat(50)}\n`;
	output += `Enabled: ${config.enabled ? "✅" : "❌"}\n`;
	output += `Block Level: ${config.blockLevel}\n`;
	output += `Warn Level: ${config.warnLevel}\n`;
	output += `Allow Bypass: ${config.allowBypass ? "✅" : "❌"}\n`;
	output += `Ignored Patterns: ${config.ignorePatterns.length}\n`;
	output += `Ignored Files: ${config.ignoreFiles.length}\n`;
	output += `Custom Patterns: ${config.customPatterns.length}\n`;

	if (config.ignorePatterns.length > 0) {
		output += "\nIgnored Patterns:\n";
		for (const id of config.ignorePatterns) {
			output += `- ${id}\n`;
		}
	}

	if (config.customPatterns.length > 0) {
		output += "\nCustom Patterns:\n";
		for (const p of config.customPatterns) {
			output += `- ${p.id}: ${p.category}/${p.risk}\n`;
		}
	}

	return { content: [{ type: "text", text: output }], details: output };
}

/**
 * Handle add custom pattern
 */
function handleAddPattern(
	manager: ReturnType<typeof getSafetyGateManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const id = params.id ? String(params.id) : "";
	const pattern = params.pattern ? String(params.pattern) : "";
	const category = params.category ? String(params.category) : "security";
	const risk = params.risk ? String(params.risk) : "medium";
	const description = params.description ? String(params.description) : "Custom pattern";
	const suggestion = params.suggestion ? String(params.suggestion) : "Review and fix";
	const bypassable = params.bypassable !== undefined ? Boolean(params.bypassable) : true;

	if (!id || !pattern) {
		return {
			content: [{ type: "text", text: "Error: 'id' and 'pattern' required." }],
			details: "Error: missing params",
		};
	}

	manager.addCustomPattern({
		id,
		pattern,
		category: category as CustomPattern["category"],
		risk: risk as CustomPattern["risk"],
		description,
		suggestion,
		bypassable,
	});

	return {
		content: [{ type: "text", text: `✅ Custom pattern added: ${id} (${category}/${risk})` }],
		details: `Pattern added: ${id}`,
	};
}

/**
 * Handle remove custom pattern
 */
function handleRemovePattern(
	manager: ReturnType<typeof getSafetyGateManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const id = params.id ? String(params.id) : "";

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: 'id' required." }],
			details: "Error: missing id",
		};
	}

	const removed = manager.removeCustomPattern(id);
	if (removed) {
		return {
			content: [{ type: "text", text: `✅ Custom pattern removed: ${id}` }],
			details: `Pattern removed: ${id}`,
		};
	}
	return {
		content: [{ type: "text", text: `Pattern not found: ${id}` }],
		details: `Pattern not found: ${id}`,
	};
}

/**
 * Handle ignore pattern
 */
function handleIgnorePattern(
	manager: ReturnType<typeof getSafetyGateManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const id = params.id ? String(params.id) : "";

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: 'id' required." }],
			details: "Error: missing id",
		};
	}

	manager.ignorePattern(id);
	return {
		content: [{ type: "text", text: `✅ Pattern ignored: ${id} (will not be detected)` }],
		details: `Pattern ignored: ${id}`,
	};
}

/**
 * Handle unignore pattern
 */
function handleUnignorePattern(
	manager: ReturnType<typeof getSafetyGateManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const id = params.id ? String(params.id) : "";

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: 'id' required." }],
			details: "Error: missing id",
		};
	}

	manager.unignorePattern(id);
	return {
		content: [{ type: "text", text: `✅ Pattern unignored: ${id} (will be detected)` }],
		details: `Pattern unignored: ${id}`,
	};
}

/**
 * Get safety gate manager for integration with hooks
 */
export function getSafetyGatesForHook(): {
	scan: (content: string, file?: string) => ScanResult;
	isEnabled: () => boolean;
} {
	const manager = getSafetyGateManager();
	return {
		scan: (content, file) => manager.scan(content, file),
		isEnabled: () => manager.isEnabled(),
	};
}
