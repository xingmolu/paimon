/**
 * Journal Tool - Manage JOURNAL.md with auto-truncation and archiving
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type JournalEntry,
	type JournalStats,
	type TruncateResult,
	formatStats,
	formatTruncateResult,
	getEntriesByDateRange,
	getJournalStats,
	journalManager,
	listArchives,
	parseJournal,
	readArchivedEntry,
	truncateJournal,
} from "../journal-manager.js";

/**
 * Create the journal management tool
 */
export const journalTool: AgentTool = {
	name: "journal",
	label: "Journal Manager",
	description: `Manage JOURNAL.md with auto-truncation and archiving. Use to reduce context bloat.

Actions:
- stats: View journal statistics (entries, lines, tokens estimate)
- truncate: Truncate old entries, keep recent, archive old with summaries
- archives: List archived journal files
- read: Read archived entry by day number
- entries: View entries summary
- config: View truncation configuration

Usage:
journal({action: 'stats'})
journal({action: 'truncate', maxEntries: 30})
journal({action: 'archives'})
journal({action: 'read', day: 10})`,
	parameters: Type.Object({
		action: Type.String({
			description: "Action: stats, truncate, archives, read, entries, config",
		}),
		maxEntries: Type.Optional(
			Type.Number({
				description: "Max entries to keep (default: 30)",
			}),
		),
		maxLines: Type.Optional(
			Type.Number({
				description: "Max lines before truncation (default: 500)",
			}),
		),
		day: Type.Optional(
			Type.Number({
				description: "Day number to read from archive",
			}),
		),
		startDate: Type.Optional(
			Type.String({
				description: "Start date for date range filter (YYYY-MM-DD)",
			}),
		),
		endDate: Type.Optional(
			Type.String({
				description: "End date for date range filter (YYYY-MM-DD)",
			}),
		),
	}),
	execute: async (_toolCallId: string, params): Promise<AgentToolResult<unknown>> => {
		const { action } = params as { action: string };

		try {
			switch (action) {
				case "stats":
					return handleStats();

				case "truncate":
					return handleTruncate(params as Record<string, unknown>);

				case "archives":
					return handleArchives();

				case "read":
					return handleRead(params as Record<string, unknown>);

				case "entries":
					return handleEntries(params as Record<string, unknown>);

				case "config":
					return handleConfig();

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Available: stats, truncate, archives, read, entries, config`,
							},
						],
						details: { error: `Unknown action: ${action}` },
					};
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: { error },
			};
		}
	},
};

function handleStats(): AgentToolResult<unknown> {
	const stats = getJournalStats();
	return {
		content: [{ type: "text", text: formatStats(stats) }],
		details: stats,
	};
}

function handleTruncate(params: Record<string, unknown>): AgentToolResult<unknown> {
	const config = {
		maxEntries: (params.maxEntries as number) ?? 30,
		maxLines: (params.maxLines as number) ?? 500,
	};

	const result = truncateJournal(undefined, config);
	return {
		content: [{ type: "text", text: formatTruncateResult(result) }],
		details: result,
	};
}

function handleArchives(): AgentToolResult<unknown> {
	const archives = listArchives();

	if (archives.length === 0) {
		return {
			content: [{ type: "text", text: "## Archived Journals\n\nNo archived journal files found." }],
			details: { archives: [] },
		};
	}

	const content = `## Archived Journals\n\n${archives.map((f) => `- ${f}`).join("\n")}`;
	return {
		content: [{ type: "text", text: content }],
		details: { archives },
	};
}

function handleRead(params: Record<string, unknown>): AgentToolResult<unknown> {
	const day = params.day as number;

	if (!day) {
		return {
			content: [{ type: "text", text: "Error: day parameter required for read action" }],
			details: { error: "Missing day parameter" },
		};
	}

	const entry = readArchivedEntry(day);

	if (!entry) {
		return {
			content: [{ type: "text", text: `No archived entry found for Day ${day}` }],
			details: { error: `Entry ${day} not found`, day },
		};
	}

	return {
		content: [{ type: "text", text: entry }],
		details: { day },
	};
}

function handleEntries(params: Record<string, unknown>): AgentToolResult<unknown> {
	let entries: JournalEntry[];
	const startDate = params.startDate as string;
	const endDate = params.endDate as string;

	if (startDate && endDate) {
		entries = getEntriesByDateRange(startDate, endDate);
	} else {
		entries = parseJournal();
	}

	if (entries.length === 0) {
		return {
			content: [{ type: "text", text: "## Journal Entries\n\nNo entries found." }],
			details: { entries: [] },
		};
	}

	// Show summary of entries (not full content)
	const summary = entries
		.map((e) => `- Day ${e.day} (${e.date}): **${e.title}** — ${e.lineCount} lines`)
		.join("\n");

	const content = `## Journal Entries (${entries.length} total)\n\n${summary}`;
	return {
		content: [{ type: "text", text: content }],
		details: {
			count: entries.length,
			entries: entries.map((e) => ({
				day: e.day,
				date: e.date,
				title: e.title,
				lineCount: e.lineCount,
			})),
		},
	};
}

function handleConfig(): AgentToolResult<unknown> {
	const content = `## Journal Configuration

- **maxEntries**: 30 (maximum entries to keep in main JOURNAL.md)
- **maxLines**: 500 (maximum lines before triggering truncation)
- **archiveDir**: archive/journal (directory for archived entries)
- **summaryMaxLength**: 3 (maximum lines for summary)

Truncation triggers when entries > maxEntries or lines > maxLines.
Old entries are archived with summaries in main file.
`;

	return {
		content: [{ type: "text", text: content }],
		details: {
			maxEntries: 30,
			maxLines: 500,
			archiveDir: "archive/journal",
			summaryMaxLength: 3,
		},
	};
}
