/**
 * Multi-File Context tool - Cross-file analysis and impact prediction (Cursor Pattern)
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { RepoMap } from "../repomap.js";
import { truncateToolOutput } from "../truncate.js";

/**
 * Multi-File Context tool - Cross-file analysis and impact prediction
 */
export const multiFileContextTool: AgentTool = {
	name: "multiFileContext",
	label: "Multi-File Context Analysis",
	description:
		"Analyze cross-file dependencies, symbol usages, and change impact across the codebase. Inspired by Cursor's multi-file context - helps understand how files relate and predicts which files are affected by changes.",
	parameters: Type.Object({
		action: Type.Union(
			[
				Type.Literal("symbol-usages"),
				Type.Literal("change-impact"),
				Type.Literal("related-files"),
				Type.Literal("top-symbols"),
				Type.Literal("high-risk-files"),
			],
			{
				description:
					"Action to perform: symbol-usages, change-impact, related-files, top-symbols, high-risk-files",
			},
		),
		file: Type.Optional(Type.String({ description: "Target file path for analysis" })),
		symbol: Type.Optional(Type.String({ description: "Symbol name to analyze usages" })),
		root: Type.Optional(Type.String({ description: "Root directory to scan (default: .)" })),
		topN: Type.Optional(
			Type.Number({ description: "Number of top items to return (default: 10)" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const {
			action,
			file,
			symbol,
			root = ".",
			topN = 10,
		} = params as {
			action: string;
			file?: string;
			symbol?: string;
			root?: string;
			topN?: number;
		};

		try {
			const repoMap = new RepoMap({ root });

			switch (action) {
				case "symbol-usages": {
					const usages = repoMap.getSymbolUsages(symbol);
					if (usages.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: symbol
										? `Symbol '${symbol}' not found or not used.`
										: "No symbol usages found.",
								},
							],
							details: symbol
								? `Symbol '${symbol}' not found or not used.`
								: "No symbol usages found.",
						};
					}

					let output = "## Symbol Usages\n\n";
					for (const usage of usages) {
						output += `### ${usage.name} (${usage.type})\n`;
						output += `- **Defined in:** ${usage.definedIn}\n`;
						output += `- **Total usage count:** ${usage.totalUsageCount}\n`;
						if (usage.usedIn.length > 0) {
							output += "- **Used in:**\n";
							for (const u of usage.usedIn) {
								output += `  - ${u.file} (${u.count}x)\n`;
							}
						}
						output += "\n";
					}
					return {
						content: [{ type: "text", text: truncateToolOutput(output, "multiFileContext") }],
						details: truncateToolOutput(output, "multiFileContext"),
					};
				}

				case "change-impact": {
					if (!file) {
						return {
							content: [
								{ type: "text", text: "Error: 'file' parameter required for change-impact action" },
							],
							details: "Error: 'file' parameter required for change-impact action",
						};
					}

					const impact = repoMap.analyzeChangeImpact(file);
					let output = "## Change Impact Analysis\n\n";
					output += `**File:** ${impact.file}\n`;
					output += `**Risk Level:** ${impact.riskLevel.toUpperCase()}\n\n`;
					output += `${impact.summary}\n\n`;

					if (impact.affectedSymbols.length > 0) {
						output += `### Affected Symbols (${impact.affectedSymbols.length})\n`;
						for (const s of impact.affectedSymbols.slice(0, topN)) {
							output += `- ${s.name} (${s.type})\n`;
						}
						output += "\n";
					}

					if (impact.dependentFiles.length > 0) {
						output += `### Dependent Files (${impact.dependentFiles.length})\n`;
						for (const d of impact.dependentFiles.slice(0, topN)) {
							output += `- ${d.file} (${d.risk} risk) - ${d.reason}\n`;
						}
					}

					return {
						content: [{ type: "text", text: truncateToolOutput(output, "multiFileContext") }],
						details: truncateToolOutput(output, "multiFileContext"),
					};
				}

				case "related-files": {
					if (!file) {
						return {
							content: [
								{ type: "text", text: "Error: 'file' parameter required for related-files action" },
							],
							details: "Error: 'file' parameter required for related-files action",
						};
					}

					const related = repoMap.getRelatedFiles(file);
					let output = "## Related Files\n\n";
					output += `**File:** ${related.file}\n\n`;
					output += `${related.summary}\n\n`;

					if (related.related.length > 0) {
						output += `### Related Files (${related.related.length})\n`;
						for (const r of related.related.slice(0, topN)) {
							output += `- ${r.file} (${r.relation}, strength: ${r.strength})\n`;
						}
						output += "\n";
					}

					if (related.editOrder.length > 1) {
						output += "### Recommended Edit Order\n";
						output += related.editOrder.map((f) => `1. ${f}`).join("\n");
						output += "\n";
					}

					return {
						content: [{ type: "text", text: truncateToolOutput(output, "multiFileContext") }],
						details: truncateToolOutput(output, "multiFileContext"),
					};
				}

				case "top-symbols": {
					const usages = repoMap.getSymbolUsages();
					const sorted = [...usages].sort((a, b) => b.totalUsageCount - a.totalUsageCount);
					const top = sorted.slice(0, topN);

					let output = `## Top ${top.length} Most Used Symbols\n\n`;
					output += "| Symbol | Type | File | Usage Count |\n";
					output += "|--------|------|------|-------------|\n";
					for (const u of top) {
						output += `| ${u.name} | ${u.type} | ${u.definedIn} | ${u.totalUsageCount} |\n`;
					}

					return {
						content: [{ type: "text", text: truncateToolOutput(output, "multiFileContext") }],
						details: truncateToolOutput(output, "multiFileContext"),
					};
				}

				case "high-risk-files": {
					const definitions = repoMap.getAllDefinitions();
					const files = [...new Set(definitions.map((d) => d.file))];
					const impacts = files.map((f) => repoMap.analyzeChangeImpact(f));
					const highRisk = impacts
						.filter((i) => i.riskLevel === "high" || i.riskLevel === "critical")
						.sort((a, b) => {
							const order = { critical: 0, high: 1, medium: 2, low: 3 };
							return order[a.riskLevel] - order[b.riskLevel];
						})
						.slice(0, topN);

					let output = `## High Risk Files (${highRisk.length})\n\n`;
					output += "These files have many dependents and changes require careful review:\n\n";
					output += "| File | Risk Level | Dependent Files | Affected Symbols |\n";
					output += "|------|------------|-----------------|------------------|\n";
					for (const i of highRisk) {
						output += `| ${i.file} | ${i.riskLevel.toUpperCase()} | ${i.dependentFiles.length} | ${i.affectedSymbols.length} |\n`;
					}

					return {
						content: [{ type: "text", text: truncateToolOutput(output, "multiFileContext") }],
						details: truncateToolOutput(output, "multiFileContext"),
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Valid actions: symbol-usages, change-impact, related-files, top-symbols, high-risk-files`,
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
