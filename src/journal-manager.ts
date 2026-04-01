/**
 * Journal Manager - Auto-truncation and archiving for JOURNAL.md
 *
 * Implements automatic journal management to reduce context bloat:
 * - Truncate old entries while keeping recent ones
 * - Archive full entries to separate files
 * - Generate summaries for quick reference
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface JournalEntry {
	day: number;
	date: string;
	title: string;
	content: string;
	lineCount: number;
}

export interface JournalConfig {
	maxEntries: number; // Maximum entries to keep in main JOURNAL.md
	maxLines: number; // Maximum lines before triggering truncation
	archiveDir: string; // Directory for archived entries
	summaryMaxLength: number; // Maximum lines for summary
}

export interface JournalStats {
	totalEntries: number;
	totalLines: number;
	recentEntries: number;
	archivedEntries: number;
	oldestEntryDate: string;
	newestEntryDate: string;
	estimatedTokens: number;
}

export interface TruncateResult {
	truncated: boolean;
	entriesRemoved: number;
	entriesArchived: number;
	linesBefore: number;
	linesAfter: number;
	archiveFile: string | null;
	summaryGenerated: boolean;
}

const DEFAULT_CONFIG: JournalConfig = {
	maxEntries: 30,
	maxLines: 500,
	archiveDir: "archive/journal",
	summaryMaxLength: 3,
};

/**
 * Parse JOURNAL.md into structured entries
 */
export function parseJournal(journalPath = "JOURNAL.md"): JournalEntry[] {
	if (!fs.existsSync(journalPath)) {
		return [];
	}

	const content = fs.readFileSync(journalPath, "utf-8");
	const lines = content.split("\n");
	const entries: JournalEntry[] = [];

	let currentEntry: JournalEntry | null = null;
	let entryContent: string[] = [];
	let dayNumber = 0;

	for (const line of lines) {
		// Match day headers: "## Day N — Title (YYYY-MM-DD)"
		const dayMatch = line.match(/^## Day (\d+) — (.+) \((\d{4}-\d{2}-\d{2})\)/);

		if (dayMatch) {
			// Save previous entry if exists
			if (currentEntry) {
				currentEntry.content = entryContent.join("\n");
				currentEntry.lineCount = entryContent.length;
				entries.push(currentEntry);
			}

			// Start new entry
			dayNumber = Number.parseInt(dayMatch[1], 10);
			currentEntry = {
				day: dayNumber,
				date: dayMatch[3],
				title: dayMatch[2],
				content: "",
				lineCount: 0,
			};
			entryContent = [line];
		} else if (currentEntry) {
			entryContent.push(line);
		}
	}

	// Save last entry
	if (currentEntry) {
		currentEntry.content = entryContent.join("\n");
		currentEntry.lineCount = entryContent.length;
		entries.push(currentEntry);
	}

	return entries;
}

/**
 * Get journal statistics
 */
export function getJournalStats(journalPath = "JOURNAL.md"): JournalStats {
	const entries = parseJournal(journalPath);

	if (entries.length === 0) {
		return {
			totalEntries: 0,
			totalLines: 0,
			recentEntries: 0,
			archivedEntries: 0,
			oldestEntryDate: "",
			newestEntryDate: "",
			estimatedTokens: 0,
		};
	}

	const totalLines = entries.reduce((sum, e) => sum + e.lineCount, 0);
	const oldestEntry = entries[0];
	const newestEntry = entries[entries.length - 1];

	// Check for archived entries
	const archiveDir = DEFAULT_CONFIG.archiveDir;
	let archivedEntries = 0;
	if (fs.existsSync(archiveDir)) {
		const archiveFiles = fs.readdirSync(archiveDir).filter((f) => f.endsWith(".md"));
		archivedEntries = archiveFiles.length;
	}

	// Estimate tokens (rough: ~4 chars per token)
	const estimatedTokens = Math.ceil((totalLines * 80) / 4); // ~80 chars per line avg

	return {
		totalEntries: entries.length,
		totalLines,
		recentEntries: entries.length,
		archivedEntries,
		oldestEntryDate: oldestEntry.date,
		newestEntryDate: newestEntry.date,
		estimatedTokens,
	};
}

/**
 * Generate summary for an entry (first N meaningful lines)
 */
export function generateEntrySummary(entry: JournalEntry, maxLines = 3): string {
	const lines = entry.content.split("\n");
	const summaryLines: string[] = [];

	// Always include the header
	summaryLines.push(lines[0]);

	// Find "Why this matters" or "What happened" section
	let foundWhy = false;
	for (let i = 1; i < lines.length && summaryLines.length < maxLines + 1; i++) {
		const line = lines[i];

		if (line.includes("**Why this matters:**")) {
			foundWhy = true;
			summaryLines.push(line);
			// Get the next line (the explanation)
			if (i + 1 < lines.length && lines[i + 1].trim()) {
				summaryLines.push(lines[i + 1]);
			}
		} else if (line.includes("**What happened:**")) {
			summaryLines.push(line);
			// Get brief description
			if (i + 1 < lines.length && lines[i + 1].trim().startsWith("-")) {
				summaryLines.push(lines[i + 1]);
			}
		}
	}

	if (!foundWhy && summaryLines.length < maxLines + 1) {
		// Fallback: just add first few meaningful lines after header
		for (let i = 1; i < lines.length && summaryLines.length < maxLines + 1; i++) {
			if (lines[i].trim() && !lines[i].trim().startsWith("---")) {
				summaryLines.push(lines[i]);
			}
		}
	}

	// Add link to full entry
	summaryLines.push(`_(Full entry archived: archive/journal/day-${entry.day}.md)_`);

	return summaryLines.join("\n");
}

/**
 * Truncate JOURNAL.md, keeping recent entries and archiving old ones
 */
export function truncateJournal(
	journalPath = "JOURNAL.md",
	config: Partial<JournalConfig> = {},
): TruncateResult {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const entries = parseJournal(journalPath);

	if (entries.length <= cfg.maxEntries) {
		return {
			truncated: false,
			entriesRemoved: 0,
			entriesArchived: 0,
			linesBefore: entries.reduce((sum, e) => sum + e.lineCount, 0),
			linesAfter: entries.reduce((sum, e) => sum + e.lineCount, 0),
			archiveFile: null,
			summaryGenerated: false,
		};
	}

	const linesBefore = entries.reduce((sum, e) => sum + e.lineCount, 0);

	// Keep last N entries
	const entriesToKeep = entries.slice(-cfg.maxEntries);
	const entriesToArchive = entries.slice(0, entries.length - cfg.maxEntries);

	// Create archive directory
	const archiveDir = cfg.archiveDir;
	if (!fs.existsSync(archiveDir)) {
		fs.mkdirSync(archiveDir, { recursive: true });
	}

	// Archive old entries to files
	const archiveFile = path.join(
		archiveDir,
		`archived-${entriesToArchive[0].day}-${entriesToArchive[entriesToArchive.length - 1].day}.md`,
	);
	const archiveContent = entriesToArchive.map((e) => e.content).join("\n\n---\n\n");
	fs.writeFileSync(archiveFile, archiveContent);

	// Generate summaries for archived entries
	const summaries = entriesToArchive.map((e) => generateEntrySummary(e, cfg.summaryMaxLength));

	// Build new JOURNAL content
	const header = `# Journal

A daily log of Paimon's self-improvements.

---

## Archived Entries (Days ${entriesToArchive[0].day}-${entriesToArchive[entriesToArchive.length - 1].day})

${summaries.join("\n\n---\n\n")}

---

`;

	const recentContent = entriesToKeep.map((e) => e.content).join("\n\n---\n\n");
	const newContent = header + recentContent;

	// Write new JOURNAL
	fs.writeFileSync(journalPath, newContent);

	const linesAfter = newContent.split("\n").length;

	return {
		truncated: true,
		entriesRemoved: entriesToArchive.length,
		entriesArchived: entriesToArchive.length,
		linesBefore,
		linesAfter,
		archiveFile,
		summaryGenerated: true,
	};
}

/**
 * List archived journal files
 */
export function listArchives(archiveDir: string = DEFAULT_CONFIG.archiveDir): string[] {
	if (!fs.existsSync(archiveDir)) {
		return [];
	}

	return fs
		.readdirSync(archiveDir)
		.filter((f) => f.endsWith(".md"))
		.sort();
}

/**
 * Read archived entry by day number
 */
export function readArchivedEntry(
	day: number,
	archiveDir: string = DEFAULT_CONFIG.archiveDir,
): string | null {
	const files = listArchives(archiveDir);

	for (const file of files) {
		const content = fs.readFileSync(path.join(archiveDir, file), "utf-8");
		const dayMatch = content.match(/## Day (\d+)/);
		if (dayMatch && Number.parseInt(dayMatch[1], 10) === day) {
			return content;
		}
	}

	// Also check individual day files
	const dayFile = path.join(archiveDir, `day-${day}.md`);
	if (fs.existsSync(dayFile)) {
		return fs.readFileSync(dayFile, "utf-8");
	}

	return null;
}

/**
 * Get entries by date range
 */
export function getEntriesByDateRange(
	startDate: string,
	endDate: string,
	journalPath = "JOURNAL.md",
): JournalEntry[] {
	const entries = parseJournal(journalPath);
	return entries.filter((e) => e.date >= startDate && e.date <= endDate);
}

/**
 * Format stats as markdown
 */
export function formatStats(stats: JournalStats): string {
	return `## Journal Statistics

- **Total Entries**: ${stats.totalEntries}
- **Total Lines**: ${stats.totalLines}
- **Archived Entries**: ${stats.archivedEntries}
- **Date Range**: ${stats.oldestEntryDate} to ${stats.newestEntryDate}
- **Estimated Tokens**: ~${stats.estimatedTokens} (${Math.ceil(stats.estimatedTokens / 1000)}k)

### Size Analysis
- Lines per entry (avg): ${stats.totalEntries > 0 ? Math.round(stats.totalLines / stats.totalEntries) : 0}
- If > 500 lines, truncation recommended
- Keep max 30 recent entries in main file
`;
}

/**
 * Format truncate result as markdown
 */
export function formatTruncateResult(result: TruncateResult): string {
	if (!result.truncated) {
		return `## Truncate Result

No truncation needed. Journal is within limits.
- Lines: ${result.linesBefore}
- Entries within max limit.
`;
	}

	const reduction = Math.round((1 - result.linesAfter / result.linesBefore) * 100);

	return `## Truncate Result

Successfully truncated JOURNAL.md:
- **Entries Removed**: ${result.entriesRemoved}
- **Lines Before**: ${result.linesBefore}
- **Lines After**: ${result.linesAfter}
- **Reduction**: ${reduction}%
- **Archive File**: ${result.archiveFile}
- **Summary Generated**: ${result.summaryGenerated ? "Yes" : "No"}

Archived entries are summarized in main file with links to full archive.
`;
}

// Export singleton instance for tool usage
export const journalManager = {
	parseJournal,
	getJournalStats,
	truncateJournal,
	listArchives,
	readArchivedEntry,
	getEntriesByDateRange,
	formatStats,
	formatTruncateResult,
	generateEntrySummary,
};
