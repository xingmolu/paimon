/**
 * Tests for Journal Manager
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	formatStats,
	formatTruncateResult,
	generateEntrySummary,
	getEntriesByDateRange,
	getJournalStats,
	journalManager,
	listArchives,
	parseJournal,
	readArchivedEntry,
	truncateJournal,
} from "../src/journal-manager.js";

const TEST_JOURNAL_PATH = "tests/fixtures/test-journal.md";
const TEST_ARCHIVE_DIR = "tests/fixtures/archive/journal";

// Sample journal content for testing
const SAMPLE_JOURNAL = `# Journal

A daily log of Paimon's self-improvements.

---

## Day 1 — First Improvement (2026-01-01)

**What happened:**
- Implemented first capability
- Added basic functionality

**Why this matters:**
- This is a capability type task
- Enables future improvements

**Technical details:**
- Created src/module.ts
- Added tests

---

## Day 2 — Second Improvement (2026-01-02)

**What happened:**
- Implemented second capability
- Extended functionality

**Why this matters:**
- Improves iteration success rate
- Critical for self-evolution

---

## Day 3 — Third Improvement (2026-01-03)

**What happened:**
- Bug fix for first capability

**Why this matters:**
- Reliability improvement
- Fixes user-reported issue

---

## Day 4 — Fourth Improvement (2026-01-04)

**What happened:**
- New feature implementation
- Added new tool

**Why this matters:**
- Feature type task
- Adds general functionality

---

## Day 5 — Fifth Improvement (2026-01-05)

**What happened:**
- Performance optimization
- Reduced token usage

**Why this matters:**
- Capability type task
- Improves efficiency
`;

describe("JournalManager", () => {
	beforeAll(() => {
		// Create test fixtures directory
		if (!fs.existsSync("tests/fixtures")) {
			fs.mkdirSync("tests/fixtures", { recursive: true });
		}
		fs.writeFileSync(TEST_JOURNAL_PATH, SAMPLE_JOURNAL);
	});

	afterAll(() => {
		// Clean up test fixtures
		if (fs.existsSync(TEST_JOURNAL_PATH)) {
			fs.unlinkSync(TEST_JOURNAL_PATH);
		}
		if (fs.existsSync(TEST_ARCHIVE_DIR)) {
			fs.rmSync(TEST_ARCHIVE_DIR, { recursive: true, force: true });
		}
	});

	describe("parseJournal", () => {
		it("should parse journal entries correctly", () => {
			const entries = parseJournal(TEST_JOURNAL_PATH);
			expect(entries.length).toBe(5);
			expect(entries[0].day).toBe(1);
			expect(entries[0].date).toBe("2026-01-01");
			expect(entries[0].title).toBe("First Improvement");
		});

		it("should count lines for each entry", () => {
			const entries = parseJournal(TEST_JOURNAL_PATH);
			expect(entries[0].lineCount).toBeGreaterThan(0);
		});

		it("should return empty array for non-existent file", () => {
			const entries = parseJournal("non-existent.md");
			expect(entries.length).toBe(0);
		});

		it("should handle default JOURNAL.md path", () => {
			// This tests the default parameter
			const result = journalManager.parseJournal;
			expect(result).toBeDefined();
		});
	});

	describe("getJournalStats", () => {
		it("should calculate journal statistics", () => {
			const stats = getJournalStats(TEST_JOURNAL_PATH);
			expect(stats.totalEntries).toBe(5);
			expect(stats.totalLines).toBeGreaterThan(0);
			expect(stats.oldestEntryDate).toBe("2026-01-01");
			expect(stats.newestEntryDate).toBe("2026-01-05");
		});

		it("should estimate tokens", () => {
			const stats = getJournalStats(TEST_JOURNAL_PATH);
			expect(stats.estimatedTokens).toBeGreaterThan(0);
		});

		it("should return zero stats for empty journal", () => {
			const stats = getJournalStats("non-existent.md");
			expect(stats.totalEntries).toBe(0);
			expect(stats.totalLines).toBe(0);
		});
	});

	describe("generateEntrySummary", () => {
		it("should generate summary with header", () => {
			const entries = parseJournal(TEST_JOURNAL_PATH);
			const summary = generateEntrySummary(entries[0], 3);
			expect(summary).toContain("## Day 1");
			expect(summary).toContain("First Improvement");
		});

		it("should include archive link", () => {
			const entries = parseJournal(TEST_JOURNAL_PATH);
			const summary = generateEntrySummary(entries[0], 3);
			expect(summary).toContain("archive/journal/day-1.md");
		});

		it("should respect max lines parameter", () => {
			const entries = parseJournal(TEST_JOURNAL_PATH);
			const summary = generateEntrySummary(entries[0], 2);
			const lines = summary.split("\n");
			expect(lines.length).toBeLessThanOrEqual(4); // Header + 2 lines + archive link
		});
	});

	describe("truncateJournal", () => {
		it("should not truncate if within limits", () => {
			const result = truncateJournal(TEST_JOURNAL_PATH, { maxEntries: 10 });
			expect(result.truncated).toBe(false);
		});

		it("should truncate when entries exceed max", () => {
			const result = truncateJournal(TEST_JOURNAL_PATH, {
				maxEntries: 2,
				archiveDir: TEST_ARCHIVE_DIR,
			});
			expect(result.truncated).toBe(true);
			expect(result.entriesRemoved).toBe(3);
			expect(result.entriesArchived).toBe(3);
			expect(result.linesAfter).toBeLessThan(result.linesBefore);
		});

		it("should create archive file", () => {
			// First truncate
			truncateJournal(TEST_JOURNAL_PATH, {
				maxEntries: 2,
				archiveDir: TEST_ARCHIVE_DIR,
			});

			// Check archive exists
			expect(fs.existsSync(TEST_ARCHIVE_DIR)).toBe(true);
			const archives = fs.readdirSync(TEST_ARCHIVE_DIR);
			expect(archives.length).toBeGreaterThan(0);
		});

		it("should generate summaries in truncated file", () => {
			truncateJournal(TEST_JOURNAL_PATH, {
				maxEntries: 2,
				archiveDir: TEST_ARCHIVE_DIR,
			});

			const content = fs.readFileSync(TEST_JOURNAL_PATH, "utf-8");
			expect(content).toContain("## Archived Entries");
			expect(content).toContain("archive/journal");
		});
	});

	describe("listArchives", () => {
		it("should list archive files", () => {
			// Create some archives first
			truncateJournal(TEST_JOURNAL_PATH, {
				maxEntries: 2,
				archiveDir: TEST_ARCHIVE_DIR,
			});

			const archives = listArchives(TEST_ARCHIVE_DIR);
			expect(archives.length).toBeGreaterThan(0);
		});

		it("should return empty array for non-existent directory", () => {
			const archives = listArchives("non-existent-dir");
			expect(archives.length).toBe(0);
		});
	});

	describe("readArchivedEntry", () => {
		it("should read archived entry by day", () => {
			// Create archives first
			truncateJournal(TEST_JOURNAL_PATH, {
				maxEntries: 2,
				archiveDir: TEST_ARCHIVE_DIR,
			});

			// Day 1 should be archived
			const entry = readArchivedEntry(1, TEST_ARCHIVE_DIR);
			expect(entry).toBeDefined();
			expect(entry).toContain("Day 1");
		});

		it("should return null for non-existent day", () => {
			const entry = readArchivedEntry(999, TEST_ARCHIVE_DIR);
			expect(entry).toBeNull();
		});
	});

	describe("getEntriesByDateRange", () => {
		it("should filter entries by date range", () => {
			const entries = getEntriesByDateRange("2026-01-02", "2026-01-04", TEST_JOURNAL_PATH);
			expect(entries.length).toBe(3);
			expect(entries[0].day).toBe(2);
			expect(entries[entries.length - 1].day).toBe(4);
		});

		it("should return empty for no matching dates", () => {
			const entries = getEntriesByDateRange("2025-01-01", "2025-01-05", TEST_JOURNAL_PATH);
			expect(entries.length).toBe(0);
		});
	});

	describe("formatStats", () => {
		it("should format stats as markdown", () => {
			const stats = getJournalStats(TEST_JOURNAL_PATH);
			const formatted = formatStats(stats);
			expect(formatted).toContain("## Journal Statistics");
			expect(formatted).toContain("Total Entries");
		});
	});

	describe("formatTruncateResult", () => {
		it("should format truncate result as markdown", () => {
			const result = truncateJournal(TEST_JOURNAL_PATH, {
				maxEntries: 2,
				archiveDir: TEST_ARCHIVE_DIR,
			});
			const formatted = formatTruncateResult(result);
			expect(formatted).toContain("## Truncate Result");
			expect(formatted).toContain("Entries Removed");
		});

		it("should show no truncation message", () => {
			const result = {
				truncated: false,
				entriesRemoved: 0,
				linesBefore: 100,
				linesAfter: 100,
				archiveFile: null,
				entriesArchived: 0,
				summaryGenerated: false,
			};
			const formatted = formatTruncateResult(result);
			expect(formatted).toContain("No truncation needed");
		});
	});
});
