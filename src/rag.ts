/**
 * RAG Context Enrichment - Semantic search over past sessions, learnings, and knowledge.
 *
 * Inspired by PR-Agent's "RAG context enrichment" pattern.
 * Provides keyword-based search with TF-IDF-like scoring for finding
 * relevant context from past sessions, MEMORY.md learnings, and reflections.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * A document in the RAG index.
 */
export interface RagDocument {
	id: string;
	type: "learning" | "session" | "reflection" | "journal";
	title: string;
	content: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
	tags: string[];
}

/**
 * A search result from the RAG index.
 */
export interface RagSearchResult {
	document: RagDocument;
	score: number;
	matchedTerms: string[];
	snippet: string;
}

/**
 * RAG search options.
 */
export interface RagSearchOptions {
	query: string;
	maxResults?: number;
	types?: ("learning" | "session" | "reflection" | "journal")[];
	minScore?: number;
	includeSnippet?: boolean;
}

/**
 * RAG index configuration.
 */
export interface RagConfig {
	dataDir?: string;
	maxIndexSize?: number;
}

/**
 * Inverted index for keyword search.
 */
interface InvertedIndex {
	term: string;
	documents: Map<string, number>; // docId -> frequency
	totalDocs: number;
}

/**
 * Find the git root directory.
 */
function findGitRoot(dir: string = process.cwd()): string | null {
	try {
		const gitDir = execSync("git rev-parse --show-toplevel", {
			cwd: dir,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return gitDir || null;
	} catch {
		return null;
	}
}

/**
 * Get the project name for RAG storage.
 */
function getProjectName(): string {
	const gitRoot = findGitRoot();
	if (gitRoot) {
		return basename(gitRoot);
	}
	return basename(process.cwd());
}

/**
 * Tokenize text into searchable terms.
 * Normalizes to lowercase, removes punctuation, splits on whitespace.
 */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length > 2) // Skip very short terms
		.filter((t) => !STOP_WORDS.includes(t));
}

/**
 * Common stop words to ignore.
 */
const STOP_WORDS = [
	"the",
	"a",
	"an",
	"and",
	"or",
	"but",
	"in",
	"on",
	"at",
	"to",
	"for",
	"of",
	"with",
	"by",
	"from",
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"being",
	"have",
	"has",
	"had",
	"do",
	"does",
	"did",
	"will",
	"would",
	"could",
	"should",
	"may",
	"might",
	"must",
	"shall",
	"can",
	"need",
	"this",
	"that",
	"these",
	"those",
	"it",
	"its",
	"they",
	"them",
	"their",
	"we",
	"us",
	"our",
	"you",
	"your",
	"he",
	"him",
	"his",
	"she",
	"her",
	"i",
	"me",
	"my",
	"as",
	"if",
	"when",
	"where",
	"which",
	"who",
	"whom",
	"what",
	"how",
	"why",
	"then",
	"so",
	"just",
	"now",
	"here",
	"there",
	"also",
	"like",
	"such",
	"some",
	"any",
	"all",
	"each",
	"every",
	"both",
	"few",
	"more",
	"most",
	"other",
	"another",
];

/**
 * Generate a snippet around matched content.
 */
function generateSnippet(content: string, matchedTerms: string[], maxLength = 200): string {
	const lowerContent = content.toLowerCase();
	const positions: number[] = [];

	for (const term of matchedTerms) {
		const idx = lowerContent.indexOf(term);
		if (idx >= 0) {
			positions.push(idx);
		}
	}

	if (positions.length === 0) {
		// Return beginning of content
		return content.slice(0, maxLength) + (content.length > maxLength ? "..." : "");
	}

	// Find center of matches
	const avgPos = Math.floor(positions.reduce((a, b) => a + b, 0) / positions.length);
	const start = Math.max(0, avgPos - 50);
	const end = Math.min(content.length, start + maxLength);

	let snippet = content.slice(start, end);
	if (start > 0) snippet = `...${snippet}`;
	if (end < content.length) snippet = `${snippet}...`;

	return snippet;
}

/**
 * RAG Context Enrichment module.
 * Provides keyword-based search over indexed documents with TF-IDF scoring.
 */
export class RagModule {
	private dataDir: string;
	private projectName: string;
	private documents: Map<string, RagDocument> = new Map();
	private invertedIndex: Map<string, InvertedIndex> = new Map();
	private indexFile: string;
	private initialized = false;

	constructor(config: RagConfig = {}) {
		this.dataDir = config.dataDir || join(homedir(), ".paimon", "rag");
		this.projectName = getProjectName();
		this.indexFile = join(this.dataDir, "projects", this.projectName, "index.json");
	}

	/**
	 * Initialize the RAG module - load existing index and documents.
	 */
	initialize(): void {
		if (this.initialized) return;

		this.ensureDir(join(this.dataDir, "projects", this.projectName));

		// Load existing index if available
		if (existsSync(this.indexFile)) {
			try {
				const indexData = readFileSync(this.indexFile, "utf-8");
				const parsed = JSON.parse(indexData) as { documents: RagDocument[] };
				for (const doc of parsed.documents) {
					this.documents.set(doc.id, doc);
					this.addToIndex(doc);
				}
			} catch {
				// Index file corrupted, rebuild
				this.documents.clear();
				this.invertedIndex.clear();
			}
		}

		// Index source files if not already indexed
		this.indexSources();

		this.initialized = true;
	}

	/**
	 * Index source documents: MEMORY.md, JOURNAL.md, sessions, reflections.
	 */
	indexSources(): void {
		// Index MEMORY.md learnings
		this.indexMemoryFile();

		// Index JOURNAL.md entries
		this.indexJournalFile();

		// Index reflection files
		this.indexReflections();

		// Save the index
		this.saveIndex();
	}

	/**
	 * Index MEMORY.md learnings.
	 */
	private indexMemoryFile(): void {
		const memoryPath = "MEMORY.md";
		if (!existsSync(memoryPath)) return;

		const content = readFileSync(memoryPath, "utf-8");

		// Extract learnings (sections under ### headers)
		const learningPattern =
			/### (\d{4}-\d{2}-\d{2}): ([^\n]+)\n\n\*\*Type:\*\* ([^\n]+)\n\n\*\*Context:\*\* ([^\n]+)\n\n\*\*Insight:\*\* ([^\n]+(?:\n(?!\*\*)[^\n]*)*)/g;
		let match: RegExpExecArray | null;
		let idx = 0;

		match = learningPattern.exec(content);
		while (match !== null) {
			const date = match[1];
			const title = match[2].trim();
			const type = match[3].trim();
			const context = match[4].trim();
			const insight = match[5].trim();

			const doc: RagDocument = {
				id: `learning-${date}-${idx}`,
				type: "learning",
				title: title,
				content: `Type: ${type}\nContext: ${context}\nInsight: ${insight}`,
				timestamp: new Date(date).getTime(),
				metadata: { date, learningType: type },
				tags: tokenize(`${title} ${context} ${insight}`),
			};

			// Add or update document
			if (!this.documents.has(doc.id)) {
				this.documents.set(doc.id, doc);
				this.addToIndex(doc);
			}
			idx++;
			match = learningPattern.exec(content);
		}
	}

	/**
	 * Index JOURNAL.md entries.
	 */
	private indexJournalFile(): void {
		const journalPath = "JOURNAL.md";
		if (!existsSync(journalPath)) return;

		const content = readFileSync(journalPath, "utf-8");

		// Extract day entries (sections under ## Day headers)
		const dayPattern = /## Day (\d+) — ([^\n]+) \(([^\n]+)\)/g;
		let match: RegExpExecArray | null;
		let idx = 0;

		match = dayPattern.exec(content);
		while (match !== null) {
			const dayNum = match[1];
			const title = match[2].trim();
			const date = match[3].trim();

			// Extract content until next day header or end
			const startIdx = match.index;
			const nextMatch = dayPattern.exec(content);
			const endIdx = nextMatch ? nextMatch.index : content.length;
			dayPattern.lastIndex = match.index + match[0].length; // Reset for next iteration

			const entryContent = content.slice(startIdx, endIdx);

			const doc: RagDocument = {
				id: `journal-day-${dayNum}`,
				type: "journal",
				title: title,
				content: entryContent.slice(0, 500), // Limit content size
				timestamp: new Date(date).getTime(),
				metadata: { day: dayNum, date },
				tags: tokenize(`${title} ${entryContent.slice(0, 200)}`),
			};

			if (!this.documents.has(doc.id)) {
				this.documents.set(doc.id, doc);
				this.addToIndex(doc);
			}
			idx++;
			match = dayPattern.exec(content);
		}
	}

	/**
	 * Index reflection files from session_plan directory.
	 */
	private indexReflections(): void {
		const reflectionsDir = "session_plan";
		if (!existsSync(reflectionsDir)) return;

		const files = readdirSync(reflectionsDir).filter(
			(f) => f.startsWith("reflection_") && f.endsWith(".md"),
		);

		for (const file of files) {
			const filePath = join(reflectionsDir, file);
			const content = readFileSync(filePath, "utf-8");

			// Extract title from first line or filename
			const titleLine = content.split("\n")[0] || file;
			const title = titleLine.replace(/^#+ /, "").trim();

			const doc: RagDocument = {
				id: `reflection-${file}`,
				type: "reflection",
				title: title,
				content: content.slice(0, 500),
				timestamp: Date.now(),
				metadata: { file },
				tags: tokenize(content.slice(0, 200)),
			};

			if (!this.documents.has(doc.id)) {
				this.documents.set(doc.id, doc);
				this.addToIndex(doc);
			}
		}
	}

	/**
	 * Add a document to the inverted index.
	 */
	private addToIndex(doc: RagDocument): void {
		const terms = tokenize(doc.content);

		// Count term frequencies
		const termFreq = new Map<string, number>();
		for (const term of terms) {
			termFreq.set(term, (termFreq.get(term) || 0) + 1);
		}

		// Update inverted index
		for (const [term, freq] of termFreq) {
			if (!this.invertedIndex.has(term)) {
				this.invertedIndex.set(term, {
					term,
					documents: new Map(),
					totalDocs: this.documents.size,
				});
			}
			const idxEntry = this.invertedIndex.get(term);
			if (idxEntry) {
				idxEntry.documents.set(doc.id, freq);
				idxEntry.totalDocs = this.documents.size;
			}
		}
	}

	/**
	 * Save the index to disk.
	 */
	private saveIndex(): void {
		this.ensureDir(join(this.dataDir, "projects", this.projectName));

		const indexData = {
			project: this.projectName,
			timestamp: Date.now(),
			documents: Array.from(this.documents.values()),
		};

		writeFileSync(this.indexFile, JSON.stringify(indexData, null, 2), "utf-8");
	}

	/**
	 * Search for documents matching the query.
	 * Uses TF-IDF scoring for relevance ranking.
	 */
	search(options: RagSearchOptions): RagSearchResult[] {
		this.initialize();

		const query = options.query.toLowerCase();
		const maxResults = options.maxResults || 5;
		const types = options.types || ["learning", "session", "reflection", "journal"];
		const minScore = options.minScore || 0.1;

		// Tokenize query
		const queryTerms = tokenize(query);
		if (queryTerms.length === 0) {
			return [];
		}

		// Calculate scores for each document
		const scores = new Map<string, { score: number; matchedTerms: string[] }>();

		for (const term of queryTerms) {
			const idxEntry = this.invertedIndex.get(term);
			if (!idxEntry) continue;

			// IDF score: log(totalDocs / docsWithTerm)
			const idf = Math.log(this.documents.size / idxEntry.documents.size);

			for (const [docId, freq] of idxEntry.documents) {
				const doc = this.documents.get(docId);
				if (!doc || !types.includes(doc.type)) continue;

				// TF score: freq / totalTermsInDoc
				const docTerms = tokenize(doc.content);
				const tf = freq / docTerms.length;

				// TF-IDF score
				const tfidf = tf * idf;

				const existing = scores.get(docId) || { score: 0, matchedTerms: [] };
				existing.score += tfidf;
				existing.matchedTerms.push(term);
				scores.set(docId, existing);
			}
		}

		// Rank results by score
		const ranked = Array.from(scores.entries())
			.filter(([, data]) => data.score >= minScore)
			.sort((a, b) => b[1].score - a[1].score)
			.slice(0, maxResults);

		// Build results
		const results: RagSearchResult[] = [];
		for (const [docId, data] of ranked) {
			const doc = this.documents.get(docId);
			if (!doc) continue;

			const snippet =
				options.includeSnippet !== false ? generateSnippet(doc.content, data.matchedTerms) : "";

			results.push({
				document: doc,
				score: data.score,
				matchedTerms: data.matchedTerms,
				snippet,
			});
		}

		return results;
	}

	/**
	 * Get enriched context for a task description.
	 * Returns relevant past learnings, journal entries, etc.
	 */
	enrichContext(taskDescription: string, maxResults = 3): string {
		this.initialize();

		const results = this.search({
			query: taskDescription,
			maxResults,
			types: ["learning", "journal", "reflection"],
			includeSnippet: true,
		});

		if (results.length === 0) {
			return "";
		}

		// Format as enriched context
		const lines: string[] = ["## Relevant Context from Past Sessions"];
		lines.push(`Found ${results.length} relevant entries:`);

		for (const result of results) {
			const doc = result.document;
			const typeEmoji =
				{
					learning: "💡",
					journal: "📝",
					reflection: "🔄",
					session: "💬",
				}[doc.type] || "📄";

			lines.push("");
			lines.push(`${typeEmoji} **${doc.title}** (score: ${result.score.toFixed(2)})`);
			lines.push(`Type: ${doc.type}`);
			if (doc.metadata?.date) {
				lines.push(`Date: ${doc.metadata.date}`);
			}
			lines.push(`Matched: ${result.matchedTerms.join(", ")}`);
			lines.push(`> ${result.snippet}`);
		}

		return lines.join("\n");
	}

	/**
	 * Get statistics about the RAG index.
	 */
	getStats(): {
		totalDocuments: number;
		byType: Record<string, number>;
		uniqueTerms: number;
		indexSizeKB: number;
	} {
		this.initialize();

		const byType: Record<string, number> = {};
		for (const doc of this.documents.values()) {
			byType[doc.type] = (byType[doc.type] || 0) + 1;
		}

		let indexSizeKB = 0;
		if (existsSync(this.indexFile)) {
			const content = readFileSync(this.indexFile, "utf-8");
			indexSizeKB = Math.floor(content.length / 1024);
		}

		return {
			totalDocuments: this.documents.size,
			byType,
			uniqueTerms: this.invertedIndex.size,
			indexSizeKB,
		};
	}

	/**
	 * Clear the index (for testing or rebuilding).
	 */
	clear(): void {
		this.documents.clear();
		this.invertedIndex.clear();
		this.initialized = false;

		if (existsSync(this.indexFile)) {
			writeFileSync(this.indexFile, JSON.stringify({ documents: [] }, null, 2), "utf-8");
		}
	}

	/**
	 * Ensure a directory exists.
	 */
	private ensureDir(dir: string): void {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	/**
	 * Get the data directory path.
	 */
	getDataDir(): string {
		return this.dataDir;
	}
}

/**
 * Format search results for display.
 */
export function formatSearchResults(results: RagSearchResult[]): string {
	if (results.length === 0) {
		return "No relevant context found.";
	}

	const lines: string[] = [`Found ${results.length} relevant entries:`];

	for (const result of results) {
		const doc = result.document;
		const typeEmoji =
			{
				learning: "💡",
				journal: "📝",
				reflection: "🔄",
				session: "💬",
			}[doc.type] || "📄";

		lines.push("");
		lines.push(`${typeEmoji} **${doc.title}**`);
		lines.push(`   Type: ${doc.type}, Score: ${result.score.toFixed(2)}`);
		lines.push(`   Matched terms: ${result.matchedTerms.join(", ")}`);
		lines.push(`   Snippet: ${result.snippet}`);
	}

	return lines.join("\n");
}
