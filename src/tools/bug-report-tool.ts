/**
 * Bug Report Tool - Generate structured bug reports from failed evolution sessions
 *
 * Automatically captures context, error details, and suggested fixes for future iterations.
 * Inspired by Claude Code's /bug command.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type BugReport,
	type BugReportAttempt,
	BugReportGenerator,
	type BugReportMetadata,
	formatBugReportStats,
} from "../bug-report.js";

// Global bug report generator instance
const bugReportGenerator = new BugReportGenerator("session_plan");

/**
 * Bug report tool - Generate and manage bug reports from failed sessions
 */
export const bugReportTool: AgentTool = {
	name: "bugReport",
	label: "Bug Report Generator",
	description:
		"Generate structured bug reports from failed evolution sessions. Captures context, errors, and suggested fixes. Use after failed tasks to document issues.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'generate' (create report), 'list' (show reports), 'view' (show specific report), 'stats' (view statistics), 'issue' (format as GitHub issue), 'save' (save report)",
		}),
		taskDescription: Type.Optional(
			Type.String({
				description: "Description of the task that failed (for generate/save/issue)",
			}),
		),
		taskType: Type.Optional(
			Type.String({
				description: "Type of task: capability, reliability, feature",
			}),
		),
		errorMessage: Type.Optional(
			Type.String({
				description: "Error message from failed task (for generate/save/issue)",
			}),
		),
		skillsUsed: Type.Optional(
			Type.Array(
				Type.String({
					description: "Skills used during the task",
				}),
			),
		),
		timeElapsed: Type.Optional(
			Type.Number({
				description: "Time elapsed in minutes",
			}),
		),
		attemptedFixes: Type.Optional(
			Type.Array(
				Type.Object({
					step: Type.Number(),
					action: Type.String(),
					result: Type.String(),
					details: Type.String(),
				}),
			),
		),
		metadata: Type.Optional(
			Type.Object({
				firstTrySuccess: Type.Optional(Type.Boolean()),
				reworkCount: Type.Optional(Type.Number()),
				sessionFile: Type.Optional(Type.String()),
				trajectoryFile: Type.Optional(Type.String()),
			}),
		),
		filename: Type.Optional(
			Type.String({
				description: "Bug report filename to view",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const {
			action,
			taskDescription,
			taskType,
			errorMessage,
			skillsUsed,
			timeElapsed,
			attemptedFixes,
			metadata,
			filename,
		} = params as {
			action: string;
			taskDescription?: string;
			taskType?: string;
			errorMessage?: string;
			skillsUsed?: string[];
			timeElapsed?: number;
			attemptedFixes?: BugReportAttempt[];
			metadata?: Partial<BugReportMetadata>;
			filename?: string;
		};

		try {
			switch (action) {
				case "generate": {
					const report = bugReportGenerator.generateReport(
						taskDescription || "Unknown task",
						(taskType as BugReport["context"]["taskType"]) || "capability",
						errorMessage || "No error message provided",
						skillsUsed || [],
						timeElapsed || 0,
						attemptedFixes || [],
						metadata || {},
					);
					const markdown = bugReportGenerator.formatAsMarkdown(report);
					return {
						content: [
							{
								type: "text",
								text: `${markdown}\n\n---\n\nTo save this report, use: bugReport({action: 'save', ...})`,
							},
						],
						details: { report },
					};
				}

				case "list": {
					const reports = bugReportGenerator.listReports();
					if (reports.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: "No bug reports found in session_plan directory.",
								},
							],
							details: { reports: [] },
						};
					}

					const lines: string[] = [
						"## Bug Reports",
						"",
						"| Filename | Title | Type | Task | Time |",
						"|----------|-------|------|------|------|",
						...reports.map(
							(r) =>
								`| ${r.filename} | ${r.title.slice(0, 30)}... | ${r.taskType} | ${r.taskDescription.slice(0, 30)}... | ${r.timeElapsed}m |`,
						),
						"",
						`Total: ${reports.length} reports`,
					];

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { reports },
					};
				}

				case "view": {
					if (!filename) {
						return {
							content: [
								{
									type: "text",
									text: "Error: filename parameter required for view action.\nUsage: bugReport({action: 'view', filename: 'bug-2026-03-31T12-00-00.md'})",
								},
							],
							details: "Error: filename required",
						};
					}

					const report = bugReportGenerator.loadReport(filename);
					if (!report) {
						return {
							content: [
								{
									type: "text",
									text: `Bug report not found: ${filename}. Use bugReport({action: 'list'}) to see available reports.`,
								},
							],
							details: "Report not found",
						};
					}

					return {
						content: [
							{
								type: "text",
								text: bugReportGenerator.formatAsMarkdown(report),
							},
						],
						details: { report },
					};
				}

				case "stats": {
					const stats = bugReportGenerator.getStats();
					return {
						content: [{ type: "text", text: formatBugReportStats(stats) }],
						details: { stats },
					};
				}

				case "issue": {
					const report = bugReportGenerator.generateReport(
						taskDescription || "Unknown task",
						(taskType as BugReport["context"]["taskType"]) || "capability",
						errorMessage || "No error message provided",
						skillsUsed || [],
						timeElapsed || 0,
						[],
						metadata || {},
					);
					return {
						content: [
							{
								type: "text",
								text: bugReportGenerator.formatAsGitHubIssue(report),
							},
						],
						details: { report },
					};
				}

				case "save": {
					const report = bugReportGenerator.generateReport(
						taskDescription || "Unknown task",
						(taskType as BugReport["context"]["taskType"]) || "capability",
						errorMessage || "No error message provided",
						skillsUsed || [],
						timeElapsed || 0,
						attemptedFixes || [],
						metadata || {},
					);
					const filepath = bugReportGenerator.saveReport(report);
					return {
						content: [
							{
								type: "text",
								text: `Bug report saved to: ${filepath}\n\nID: ${report.id}\nTitle: ${report.title}`,
							},
						],
						details: { filepath, report },
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Available actions: generate, list, view, stats, issue, save`,
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

export default bugReportTool;
