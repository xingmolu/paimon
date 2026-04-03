/**
 * Capability Gap Detection Tool
 *
 * Tool for detecting capability gaps by analyzing ROADMAP, tools, competitor patterns, and integrations.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { CapabilityGap, GapDetectionConfig } from "../capability-gap.js";
import { CapabilityGapDetector, getCapabilityGapDetector } from "../capability-gap.js";

// Tool definition
export const capabilityGapToolDef: AgentTool = {
	name: "capabilityGap",
	label: "Capability Gap Detection",
	description: `Detect capability gaps by analyzing ROADMAP, tools, competitor patterns, and integration gaps.

Actions:
- detect, detect-all: Run all gap detection methods
- roadmap: Detect ROADMAP completion gaps
- tools: Detect tool coverage gaps (documented vs implemented)
- competitor: Detect competitor pattern gaps
- integration: Detect integration gaps between modules
- coverage: Get capability coverage summary
- gaps: Get all detected gaps (optional limit)
- gap: Get specific gap details (requires gapId)
- by-type: Get gaps by type (requires type)
- by-severity: Get gaps by severity (requires severity)
- by-category: Get gaps by category (requires category)
- resolve: Mark a gap as resolved (requires gapId)
- stats: View detection statistics
- suggest: Get ROADMAP suggestions from detected gaps
- config: View configuration
- enable: Enable gap detection
- disable: Disable gap detection
- clear: Clear all gaps
- reset: Reset statistics
- help: Show help message

Example usage:
capabilityGap({action: 'detect'})
capabilityGap({action: 'tools'})
capabilityGap({action: 'coverage'})
capabilityGap({action: 'suggest'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: detect, detect-all, roadmap, tools, competitor, integration, coverage, gaps, gap, by-type, by-severity, by-category, resolve, stats, suggest, config, enable, disable, clear, reset, help",
		}),
		gapId: Type.Optional(Type.String({ description: "Gap ID for specific operations" })),
		type: Type.Optional(
			Type.String({
				description:
					"Gap type filter: missing-tool, missing-module, roadmap-gap, competitor-pattern, integration-gap",
			}),
		),
		severity: Type.Optional(
			Type.String({ description: "Severity level filter: critical, high, medium, low" }),
		),
		category: Type.Optional(Type.String({ description: "Category filter" })),
		limit: Type.Optional(Type.Number({ description: "Maximum number of gaps to return" })),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executeCapabilityGapTool({
			action: String(p.action),
			gapId: p.gapId as string | undefined,
			type: p.type as CapabilityGap["type"] | undefined,
			severity: p.severity as CapabilityGap["severity"] | undefined,
			category: p.category as string | undefined,
			limit: p.limit as number | undefined,
		});
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

/**
 * Execute capability gap tool action
 */
export function executeCapabilityGapTool(args: {
	action: string;
	gapId?: string;
	type?: CapabilityGap["type"];
	severity?: CapabilityGap["severity"];
	category?: string;
	limit?: number;
}): string {
	const detector = getCapabilityGapDetector();

	switch (args.action) {
		case "detect":
		case "detect-all": {
			const gaps = detector.detectAllGaps();
			return detector.formatGaps(gaps);
		}

		case "roadmap": {
			const gaps = detector.detectRoadmapGaps();
			return detector.formatGaps(gaps);
		}

		case "tools": {
			const gaps = detector.detectToolGaps();
			return detector.formatGaps(gaps);
		}

		case "competitor": {
			const gaps = detector.detectCompetitorGaps();
			return detector.formatGaps(gaps);
		}

		case "integration": {
			const gaps = detector.detectIntegrationGaps();
			return detector.formatGaps(gaps);
		}

		case "coverage": {
			return detector.formatCoverage();
		}

		case "gaps": {
			const gaps = detector.getAllGaps();
			const limitedGaps = args.limit ? gaps.slice(0, args.limit) : gaps;
			return detector.formatGaps(limitedGaps);
		}

		case "gap": {
			if (!args.gapId) {
				return "Error: gapId required for gap action";
			}
			const gap = detector.getGap(args.gapId);
			if (!gap) {
				return `Gap not found: ${args.gapId}`;
			}
			return formatSingleGap(gap);
		}

		case "by-type": {
			if (!args.type) {
				return "Error: type required for by-type action. Available types: missing-tool, missing-module, roadmap-gap, competitor-pattern, integration-gap";
			}
			const gaps = detector.getGapsByType(args.type);
			return detector.formatGaps(gaps);
		}

		case "by-severity": {
			if (!args.severity) {
				return "Error: severity required for by-severity action. Available severities: critical, high, medium, low";
			}
			const gaps = detector.getGapsBySeverity(args.severity);
			return detector.formatGaps(gaps);
		}

		case "by-category": {
			if (!args.category) {
				return "Error: category required for by-category action";
			}
			const gaps = detector.getGapsByCategory(args.category);
			return detector.formatGaps(gaps);
		}

		case "resolve": {
			if (!args.gapId) {
				return "Error: gapId required for resolve action";
			}
			const resolved = detector.resolveGap(args.gapId);
			if (resolved) {
				return `Gap resolved: ${args.gapId}`;
			}
			return `Gap not found: ${args.gapId}`;
		}

		case "stats": {
			return detector.formatStats();
		}

		case "suggest": {
			const suggestions = detector.suggestRoadmapItems();
			if (suggestions.length === 0) {
				return "No high-priority gaps detected for ROADMAP suggestions.";
			}
			return `## Suggested ROADMAP Items\n\n${suggestions.join("\n\n")}`;
		}

		case "config": {
			const config = detector.getConfig();
			return formatConfig(config);
		}

		case "enable": {
			detector.setEnabled(true);
			return "Capability gap detection enabled";
		}

		case "disable": {
			detector.setEnabled(false);
			return "Capability gap detection disabled";
		}

		case "clear": {
			detector.clearGaps();
			return "All gaps cleared";
		}

		case "reset": {
			detector.resetStats();
			return "Statistics reset";
		}

		case "help": {
			return getHelpText();
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' action for available options.`;
	}
}

function formatSingleGap(gap: CapabilityGap): string {
	const lines: string[] = [
		`## Gap: ${gap.id}`,
		"",
		`**Type:** ${gap.type}`,
		`**Category:** ${gap.category}`,
		`**Severity:** ${gap.severity}`,
		`**Detected:** ${gap.detectedAt}`,
		`**Source:** ${gap.source}`,
		"",
		`**Description:** ${gap.description}`,
	];

	if (gap.suggestedImplementation) {
		lines.push("", `**Suggested Implementation:** ${gap.suggestedImplementation}`);
	}

	if (gap.relatedCapabilities && gap.relatedCapabilities.length > 0) {
		lines.push("", `**Related Capabilities:** ${gap.relatedCapabilities.join(", ")}`);
	}

	if (gap.competitorRef) {
		lines.push("", `**Competitor Reference:** ${gap.competitorRef}`);
	}

	if (gap.metadata) {
		lines.push("", "**Metadata:**", JSON.stringify(gap.metadata, null, 2));
	}

	return lines.join("\n");
}

function formatConfig(config: GapDetectionConfig): string {
	return `## Gap Detection Configuration

Enabled: ${config.enabled}
Roadmap Path: ${config.roadmapPath}
Tools Dir: ${config.toolsDir}
Prompt Path: ${config.promptPath}
Auto Suggest: ${config.autoSuggest}
Min Severity for Alert: ${config.minSeverityForAlert}`;
}

function getHelpText(): string {
	return `## Capability Gap Detection Tool

Automatically identifies missing capabilities by analyzing ROADMAP, tools, competitor patterns, and integration gaps.

### Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| detect, detect-all | Run all gap detection methods | - |
| roadmap | Detect ROADMAP completion gaps | - |
| tools | Detect tool coverage gaps | - |
| competitor | Detect competitor pattern gaps | - |
| integration | Detect integration gaps | - |
| coverage | Get capability coverage summary | - |
| gaps | Get all detected gaps | optional: limit |
| gap | Get specific gap details | gapId |
| by-type | Get gaps by type | type |
| by-severity | Get gaps by severity | severity |
| by-category | Get gaps by category | category |
| resolve | Mark a gap as resolved | gapId |
| stats | View detection statistics | - |
| suggest | Get ROADMAP suggestions from gaps | - |
| config | View configuration | - |
| enable | Enable gap detection | - |
| disable | Disable gap detection | - |
| clear | Clear all gaps | - |
| reset | Reset statistics | - |
| help | Show this help message | - |

### Gap Types

- **missing-tool**: Tool documented but not implemented
- **missing-module**: Module expected but not found
- **roadmap-gap**: Incomplete ROADMAP items
- **competitor-pattern**: Competitor pattern not implemented
- **integration-gap**: Missing integration between modules

### Severity Levels

- **critical**: Must be addressed immediately
- **high**: Should be addressed soon
- **medium**: Should be addressed eventually
- **low**: Nice to have

### Example Usage

\`\`\`typescript
// Detect all gaps
capabilityGap({action: 'detect'})

// Check tool coverage
capabilityGap({action: 'tools'})

// Get coverage summary
capabilityGap({action: 'coverage'})

// Get ROADMAP suggestions
capabilityGap({action: 'suggest'})

// Resolve a gap
capabilityGap({action: 'resolve', gapId: 'gap-123'})
\`\`\`
`;
}

// Export tool
export const capabilityGapTool = {
	definition: capabilityGapToolDef,
	execute: executeCapabilityGapTool,
};
