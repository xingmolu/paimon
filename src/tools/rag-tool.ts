/**
 * RAG tool - Context enrichment via semantic search over past sessions
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { RagModule, type RagSearchResult, formatSearchResults } from "../rag.js";

// Singleton RagModule instance
let ragModule: RagModule | null = null;

function getRagModule(): RagModule {
	if (!ragModule) {
		ragModule = new RagModule();
		ragModule.initialize();
	}
	return ragModule;
}

/**
 * RAG tool for context enrichment.
 * Provides semantic search over past sessions, learnings, and reflections.
 */
export const ragTool: AgentTool = {
	name: "rag",
	label: "RAG Context Enrichment",
	description:
		"Semantic search over past sessions, learnings, and reflections. Use this to find relevant context from past work before starting a new task. Inspired by PR-Agent's RAG context enrichment pattern.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'search' (find relevant context), 'enrich' (get enriched context for a task), 'stats' (view index statistics), 'rebuild' (rebuild the index)",
		}),
		query: Type.Optional(
			Type.String({
				description: "Search query (for 'search' and 'enrich' actions)",
			}),
		),
		maxResults: Type.Optional(
			Type.Number({
				description: "Maximum results to return (default: 5)",
			}),
		),
		types: Type.Optional(
			Type.Array(
				Type.String({
					description: "Document types to search: 'learning', 'session', 'reflection', 'journal'",
				}),
			),
		),
	}),
	execute: async (
		_toolCallId,
		params,
	): Promise<
		AgentToolResult<{
			results: RagSearchResult[];
			enrichedContext: string;
			stats: Record<string, unknown>;
		}>
	> => {
		const {
			action,
			query,
			maxResults = 5,
			types,
		} = params as {
			action: string;
			query?: string;
			maxResults?: number;
			types?: string[];
		};

		const rag = getRagModule();

		switch (action) {
			case "search": {
				if (!query) {
					return {
						content: [{ type: "text", text: "Error: query required for search action" }],
						details: { results: [], enrichedContext: "", stats: {} },
					};
				}

				const results = rag.search({
					query,
					maxResults,
					types: types as ("learning" | "session" | "reflection" | "journal")[] | undefined,
					includeSnippet: true,
				});

				const output = formatSearchResults(results);

				return {
					content: [{ type: "text", text: output }],
					details: { results, enrichedContext: "", stats: {} },
				};
			}

			case "enrich": {
				if (!query) {
					return {
						content: [
							{ type: "text", text: "Error: query (task description) required for enrich action" },
						],
						details: { results: [], enrichedContext: "", stats: {} },
					};
				}

				const enrichedContext = rag.enrichContext(query, maxResults);

				if (!enrichedContext) {
					return {
						content: [{ type: "text", text: "No relevant past context found for this task." }],
						details: { results: [], enrichedContext: "", stats: {} },
					};
				}

				return {
					content: [{ type: "text", text: enrichedContext }],
					details: { results: [], enrichedContext, stats: {} },
				};
			}

			case "stats": {
				const stats = rag.getStats();

				const output = `## RAG Index Statistics

**Total Documents:** ${stats.totalDocuments}
**Unique Terms:** ${stats.uniqueTerms}
**Index Size:** ${stats.indexSizeKB} KB

**Documents by Type:**
${Object.entries(stats.byType)
	.map(([type, count]) => `  - ${type}: ${count}`)
	.join("\n")}`;

				return {
					content: [{ type: "text", text: output }],
					details: { results: [], enrichedContext: "", stats },
				};
			}

			case "rebuild": {
				rag.clear();
				rag.initialize();

				const stats = rag.getStats();

				const output = `✅ RAG index rebuilt successfully

**New Index Statistics:**
- Total Documents: ${stats.totalDocuments}
- Unique Terms: ${stats.uniqueTerms}
- Index Size: ${stats.indexSizeKB} KB`;

				return {
					content: [{ type: "text", text: output }],
					details: { results: [], enrichedContext: "", stats },
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `Error: Unknown action '${action}'. Supported: search, enrich, stats, rebuild`,
						},
					],
					details: { results: [], enrichedContext: "", stats: {} },
				};
		}
	},
};
