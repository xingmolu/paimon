/**
 * Script to truncate JOURNAL.md using the journal-manager module
 */

import { getJournalStats, parseJournal, truncateJournal } from "../src/journal-manager.js";

// First check current stats
const stats = getJournalStats();
console.log("Current stats:", JSON.stringify(stats, null, 2));

// Parse entries to see how many we have
const entries = parseJournal();
console.log("Total entries:", entries.length);
console.log("Oldest entry:", entries[0]?.day, entries[0]?.date);
console.log("Newest entry:", entries[entries.length - 1]?.day, entries[entries.length - 1]?.date);

// Truncate to keep last 30 entries
const result = truncateJournal(undefined, { maxEntries: 30 });
console.log("Truncate result:", JSON.stringify(result, null, 2));

// Verify new stats
const newStats = getJournalStats();
console.log("New stats:", JSON.stringify(newStats, null, 2));
