/**
 * Security Guidance Tool
 *
 * Tool for managing security pattern detection and warnings
 * Inspired by Claude Code security-guidance plugin
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type RiskLevel,
	type SecurityCategory,
	type SecurityGuidanceConfig,
	type SecurityGuidanceStats,
	type SecurityPattern,
	type SecurityScanResult,
	getSecurityGuidanceManager,
} from "../security-guidance.js";

/**
 * Security guidance tool
 */
export const securityGuidanceTool: AgentTool = {
	name: "securityGuidance",
	label: "Security Guidance",
	description: `Manage security guidance - proactive security pattern detection before code changes. Use this to scan code for security vulnerabilities before applying changes.

Actions:
- scan: Scan content or file for security patterns (provide content or file parameter)
- patterns: List all security patterns
- pattern: Get a specific pattern (provide patternId)
- categories: List patterns by category (provide category)
- risk: List patterns by risk level (provide riskLevel)
- add: Add a custom security pattern
- remove: Remove a custom pattern (provide patternId)
- enable: Enable a pattern (provide patternId)
- disable: Disable a pattern (provide patternId)
- config: View or update configuration
- stats: View statistics
- reset: Reset statistics

Example usage:
securityGuidance({action: 'scan', content: 'code to scan'})
securityGuidance({action: 'scan', file: 'src/agent.ts'})
securityGuidance({action: 'patterns'})
securityGuidance({action: 'stats'})
`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: scan, patterns, pattern, categories, risk, add, remove, enable, disable, config, stats, reset",
		}),
		content: Type.Optional(Type.String({ description: "Code content to scan (for scan action)" })),
		file: Type.Optional(Type.String({ description: "File path to scan (for scan action)" })),
		patternId: Type.Optional(
			Type.String({ description: "Pattern ID for pattern/enable/disable/remove actions" }),
		),
		category: Type.Optional(
			Type.String({
				description:
					"Security category: command-injection, xss, eval-usage, dangerous-html, pickle-deserialization, os-system, sql-injection, path-traversal, sensitive-data",
			}),
		),
		riskLevel: Type.Optional(
			Type.String({ description: "Risk level: critical, high, medium, low" }),
		),
		name: Type.Optional(Type.String({ description: "Pattern name (for add action)" })),
		description: Type.Optional(
			Type.String({ description: "Pattern description (for add action)" }),
		),
		pattern: Type.Optional(Type.String({ description: "Regex pattern string (for add action)" })),
		suggestion: Type.Optional(Type.String({ description: "Suggested fix (for add action)" })),
		languages: Type.Optional(
			Type.Array(Type.String(), {
				description: "File extensions where pattern applies (for add action)",
			}),
		),
		enabled: Type.Optional(
			Type.Boolean({ description: "Enable/disable security guidance (for config action)" }),
		),
		blockCritical: Type.Optional(
			Type.Boolean({ description: "Block operations with critical warnings (for config action)" }),
		),
		blockHigh: Type.Optional(
			Type.Boolean({ description: "Block operations with high warnings (for config action)" }),
		),
		warnMedium: Type.Optional(
			Type.Boolean({ description: "Show warnings for medium risk (for config action)" }),
		),
		warnLow: Type.Optional(
			Type.Boolean({ description: "Show warnings for low risk (for config action)" }),
		),
		maxWarningsToShow: Type.Optional(
			Type.Number({ description: "Maximum warnings to show in results (for config action)" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getSecurityGuidanceManager();
		const p = params as Record<string, unknown>;

		try {
			switch (p.action) {
				case "scan":
					return handleScan(manager, p);
				case "patterns":
					return handlePatterns(manager);
				case "pattern":
					return handlePattern(manager, p);
				case "categories":
					return handleCategories(manager, p);
				case "risk":
					return handleRisk(manager, p);
				case "add":
					return handleAdd(manager, p);
				case "remove":
					return handleRemove(manager, p);
				case "enable":
					return handleEnable(manager, p);
				case "disable":
					return handleDisable(manager, p);
				case "config":
					return handleConfig(manager, p);
				case "stats":
					return handleStats(manager);
				case "reset":
					return handleReset(manager);
				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${p.action}. Available actions: scan, patterns, pattern, categories, risk, add, remove, enable, disable, config, stats, reset`,
							},
						],
						details: "Unknown action",
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

function handleScan(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const content = params.content as string | undefined;
	const file = params.file as string | undefined;

	if (!content && !file) {
		return {
			content: [
				{ type: "text", text: "Error: Provide either content or file parameter for scan action" },
			],
			details: "Error: missing content or file",
		};
	}

	const result: SecurityScanResult = file
		? manager.scanFile(file)
		: manager.scanContent(content || "", file);

	if (result.warnings.length === 0) {
		return {
			content: [{ type: "text", text: `✅ No security issues detected\n\n${result.summary}` }],
			details: result.summary,
		};
	}

	const lines: string[] = [];

	if (result.blocked) {
		lines.push("🚫 **SECURITY BLOCKED**: Critical or high-risk patterns detected");
		lines.push("");
	} else {
		lines.push("⚠️ **Security Warnings Detected**");
		lines.push("");
	}

	lines.push(`**Summary**: ${result.summary}`);
	lines.push("");
	lines.push("**Warnings**:");

	for (const warning of result.warnings) {
		const riskEmoji = getRiskEmoji(warning.riskLevel);
		const location = warning.file
			? `${warning.file}:${warning.line || "?"}`
			: `line ${warning.line || "?"}`;

		lines.push("");
		lines.push(`${riskEmoji} **${warning.name}** [${warning.riskLevel}]`);
		lines.push(`   - Category: ${warning.category}`);
		lines.push(`   - Location: ${location}`);
		lines.push(`   - Match: \`${warning.match}\``);
		lines.push(`   - Description: ${warning.description}`);
		lines.push(`   - Suggestion: ${warning.suggestion}`);
	}

	lines.push("");
	lines.push(
		result.blocked
			? "**Action blocked due to critical security risk**"
			: "**Review suggestions before proceeding**",
	);

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: result.summary,
	};
}

function handlePatterns(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
): AgentToolResult<string> {
	const patterns = manager.getPatterns();
	const lines: string[] = ["## Security Patterns", "", `Total patterns: ${patterns.length}`, ""];

	const byCategory: Record<string, SecurityPattern[]> = {};
	for (const p of patterns) {
		if (!byCategory[p.category]) byCategory[p.category] = [];
		byCategory[p.category].push(p);
	}

	for (const [category, categoryPatterns] of Object.entries(byCategory)) {
		lines.push(`### ${category}`);
		for (const p of categoryPatterns) {
			const status = p.enabled ? "✅" : "❌";
			lines.push(`- ${status} **${p.id}** [${p.riskLevel}]: ${p.name}`);
			lines.push(`    ${p.description}`);
		}
		lines.push("");
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: `Total patterns: ${patterns.length}`,
	};
}

function handlePattern(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const patternId = params.patternId as string;
	if (!patternId) {
		return {
			content: [{ type: "text", text: "Error: Provide patternId parameter" }],
			details: "Error: missing patternId",
		};
	}

	const pattern = manager.getPattern(patternId);
	if (!pattern) {
		return {
			content: [{ type: "text", text: `Pattern not found: ${patternId}` }],
			details: "Pattern not found",
		};
	}

	const lines: string[] = [
		`## Pattern: ${pattern.name}`,
		"",
		`**ID**: ${pattern.id}`,
		`**Category**: ${pattern.category}`,
		`**Risk Level**: ${pattern.riskLevel}`,
		`**Enabled**: ${pattern.enabled ? "Yes" : "No"}`,
		"",
		`**Description**: ${pattern.description}`,
		"",
		`**Pattern**: \`/${pattern.pattern.source}/${pattern.pattern.flags}\``,
		"",
		`**Languages**: ${pattern.languages.join(", ")}`,
		"",
		`**Suggestion**: ${pattern.suggestion}`,
	];

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: `Pattern: ${pattern.name}`,
	};
}

function handleCategories(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const category = params.category as SecurityCategory | undefined;

	if (!category) {
		const categories: SecurityCategory[] = [
			"command-injection",
			"xss",
			"eval-usage",
			"dangerous-html",
			"pickle-deserialization",
			"os-system",
			"sql-injection",
			"path-traversal",
			"sensitive-data",
		];

		const lines: string[] = ["## Security Categories", ""];
		for (const cat of categories) {
			const patterns = manager.getPatternsByCategory(cat);
			lines.push(`- **${cat}**: ${patterns.length} patterns`);
		}
		return {
			content: [{ type: "text", text: lines.join("\n") }],
			details: "Security categories",
		};
	}

	const patterns = manager.getPatternsByCategory(category);
	if (patterns.length === 0) {
		return {
			content: [{ type: "text", text: `No patterns found for category: ${category}` }],
			details: "No patterns found",
		};
	}

	const lines: string[] = [
		`## Patterns in category: ${category}`,
		"",
		`Count: ${patterns.length}`,
		"",
	];
	for (const p of patterns) {
		const riskEmoji = getRiskEmoji(p.riskLevel);
		lines.push(`${riskEmoji} **${p.id}** [${p.riskLevel}]: ${p.name}`);
		lines.push(`   ${p.description}`);
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: `Category: ${category}, ${patterns.length} patterns`,
	};
}

function handleRisk(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const riskLevel = params.riskLevel as RiskLevel | undefined;

	if (!riskLevel) {
		const levels: RiskLevel[] = ["critical", "high", "medium", "low"];
		const lines: string[] = ["## Risk Levels", ""];
		for (const level of levels) {
			const patterns = manager.getPatternsByRiskLevel(level);
			lines.push(`- **${level}**: ${patterns.length} patterns`);
		}
		return {
			content: [{ type: "text", text: lines.join("\n") }],
			details: "Risk levels",
		};
	}

	const patterns = manager.getPatternsByRiskLevel(riskLevel);
	if (patterns.length === 0) {
		return {
			content: [{ type: "text", text: `No patterns found for risk level: ${riskLevel}` }],
			details: "No patterns found",
		};
	}

	const lines: string[] = [
		`## Patterns with risk level: ${riskLevel}`,
		"",
		`Count: ${patterns.length}`,
		"",
	];
	for (const p of patterns) {
		lines.push(`${getRiskEmoji(p.riskLevel)} **${p.id}** (${p.category}): ${p.name}`);
		lines.push(`   ${p.description}`);
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: `Risk: ${riskLevel}, ${patterns.length} patterns`,
	};
}

function handleAdd(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const category = params.category as SecurityCategory;
	const name = params.name as string;
	const description = params.description as string;
	const patternStr = params.pattern as string;
	const riskLevel = params.riskLevel as RiskLevel;
	const suggestion = params.suggestion as string;
	const languages = params.languages as string[] | undefined;

	if (!category || !name || !description || !patternStr || !riskLevel || !suggestion) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Provide all required parameters: category, name, description, pattern, riskLevel, suggestion",
				},
			],
			details: "Error: missing parameters",
		};
	}

	try {
		const regex = new RegExp(patternStr, "gi");
		const newPattern = manager.addPattern({
			category,
			name,
			description,
			pattern: regex,
			riskLevel,
			suggestion,
			languages: languages || ["*"],
		});

		return {
			content: [
				{
					type: "text",
					text: `✅ Added custom security pattern:\n\n**ID**: ${newPattern.id}\n**Name**: ${newPattern.name}\n**Category**: ${newPattern.category}\n**Risk Level**: ${newPattern.riskLevel}`,
				},
			],
			details: `Added pattern: ${newPattern.id}`,
		};
	} catch (error) {
		return {
			content: [{ type: "text", text: `Error: Invalid regex pattern - ${error}` }],
			details: "Error: invalid regex",
		};
	}
}

function handleRemove(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const patternId = params.patternId as string;
	if (!patternId) {
		return {
			content: [{ type: "text", text: "Error: Provide patternId parameter" }],
			details: "Error: missing patternId",
		};
	}

	const removed = manager.removePattern(patternId);
	if (removed) {
		return {
			content: [{ type: "text", text: `✅ Removed custom pattern: ${patternId}` }],
			details: `Removed: ${patternId}`,
		};
	}
	return {
		content: [
			{
				type: "text",
				text: `❌ Cannot remove pattern: ${patternId} (default patterns cannot be removed or not found)`,
			},
		],
		details: `Cannot remove: ${patternId}`,
	};
}

function handleEnable(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const patternId = params.patternId as string;
	if (!patternId) {
		return {
			content: [{ type: "text", text: "Error: Provide patternId parameter" }],
			details: "Error: missing patternId",
		};
	}

	const enabled = manager.setPatternEnabled(patternId, true);
	if (enabled) {
		return {
			content: [{ type: "text", text: `✅ Enabled pattern: ${patternId}` }],
			details: `Enabled: ${patternId}`,
		};
	}
	return {
		content: [{ type: "text", text: `❌ Pattern not found: ${patternId}` }],
		details: `Not found: ${patternId}`,
	};
}

function handleDisable(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const patternId = params.patternId as string;
	if (!patternId) {
		return {
			content: [{ type: "text", text: "Error: Provide patternId parameter" }],
			details: "Error: missing patternId",
		};
	}

	const disabled = manager.setPatternEnabled(patternId, false);
	if (disabled) {
		return {
			content: [{ type: "text", text: `✅ Disabled pattern: ${patternId}` }],
			details: `Disabled: ${patternId}`,
		};
	}
	return {
		content: [{ type: "text", text: `❌ Pattern not found: ${patternId}` }],
		details: `Not found: ${patternId}`,
	};
}

function handleConfig(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const currentConfig = manager.getConfig();

	const hasUpdates =
		params.enabled !== undefined ||
		params.blockCritical !== undefined ||
		params.blockHigh !== undefined ||
		params.warnMedium !== undefined ||
		params.warnLow !== undefined ||
		params.maxWarningsToShow !== undefined;

	if (!hasUpdates) {
		const lines: string[] = [
			"## Security Guidance Configuration",
			"",
			`**Enabled**: ${currentConfig.enabled}`,
			`**Block Critical**: ${currentConfig.blockCritical}`,
			`**Block High**: ${currentConfig.blockHigh}`,
			`**Warn Medium**: ${currentConfig.warnMedium}`,
			`**Warn Low**: ${currentConfig.warnLow}`,
			`**Max Warnings to Show**: ${currentConfig.maxWarningsToShow}`,
			"",
			"Use config parameters to update settings.",
		];
		return {
			content: [{ type: "text", text: lines.join("\n") }],
			details: "Configuration",
		};
	}

	const updates: Partial<SecurityGuidanceConfig> = {};
	if (params.enabled !== undefined) updates.enabled = params.enabled as boolean;
	if (params.blockCritical !== undefined) updates.blockCritical = params.blockCritical as boolean;
	if (params.blockHigh !== undefined) updates.blockHigh = params.blockHigh as boolean;
	if (params.warnMedium !== undefined) updates.warnMedium = params.warnMedium as boolean;
	if (params.warnLow !== undefined) updates.warnLow = params.warnLow as boolean;
	if (params.maxWarningsToShow !== undefined)
		updates.maxWarningsToShow = params.maxWarningsToShow as number;

	manager.updateConfig(updates);
	const newConfig = manager.getConfig();

	const lines: string[] = ["✅ Configuration updated", "", "## New Configuration", ""];
	for (const [key, value] of Object.entries(newConfig)) {
		if (key !== "dataPath") {
			lines.push(`**${key}**: ${value}`);
		}
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: "Configuration updated",
	};
}

function handleStats(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
): AgentToolResult<string> {
	const stats: SecurityGuidanceStats = manager.getStats();

	const lines: string[] = [
		"## Security Guidance Statistics",
		"",
		`**Total Scans**: ${stats.totalScans}`,
		`**Scans with Warnings**: ${stats.scansWithWarnings}`,
		`**Scans Blocked**: ${stats.scansBlocked}`,
		stats.lastScanTime ? `**Last Scan**: ${stats.lastScanTime}` : "",
		"",
		"### Warnings by Category",
		"",
	];

	for (const [category, count] of Object.entries(stats.warningsByCategory)) {
		if (count > 0) {
			lines.push(`- **${category}**: ${count}`);
		}
	}

	lines.push("");
	lines.push("### Warnings by Risk Level");
	lines.push("");

	for (const [level, count] of Object.entries(stats.warningsByRiskLevel)) {
		if (count > 0) {
			lines.push(`- ${getRiskEmoji(level as RiskLevel)} **${level}**: ${count}`);
		}
	}

	if (stats.topPatterns.length > 0) {
		lines.push("");
		lines.push("### Top Patterns");
		lines.push("");

		for (const { patternId, count } of stats.topPatterns.slice(0, 5)) {
			lines.push(`- **${patternId}**: ${count} occurrences`);
		}
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: `Stats: ${stats.totalScans} scans`,
	};
}

function handleReset(
	manager: ReturnType<typeof getSecurityGuidanceManager>,
): AgentToolResult<string> {
	manager.resetStats();
	return {
		content: [{ type: "text", text: "✅ Statistics reset" }],
		details: "Stats reset",
	};
}

function getRiskEmoji(level: RiskLevel): string {
	switch (level) {
		case "critical":
			return "🔴";
		case "high":
			return "🟠";
		case "medium":
			return "🟡";
		case "low":
			return "🟢";
		default:
			return "⚪";
	}
}
