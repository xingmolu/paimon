/**
 * System prompt building for Paimon agent
 *
 * Builds prompts for different modes:
 * - Chat mode: Simple assistant prompt with memory
 * - Evolve mode: Full self-evolution workflow with skills
 */

import { existsSync, readFileSync } from "node:fs";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { loadContextFiles } from "./context.js";
import { buildSkillsIndex } from "./skills.js";
import { buildToolsDescription } from "./tools/index.js";
import type { PaimonConfig } from "./types.js";

/** Maximum characters for tool output before truncation */
const MAX_TOOL_OUTPUT_CHARS = 30000;

/**
 * Truncate large tool output to prevent context overflow
 *
 * @param text - Text to potentially truncate
 * @param label - Label for the truncation message
 * @returns Truncated text or original if under limit
 */
export function truncateToolOutput(text: string, label: string): string {
	if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
	const lines = text.split("\n");
	const totalLines = lines.length;
	const kept = lines.slice(0, Math.floor(totalLines * 0.6));
	const dropped = totalLines - kept.length;
	return `${kept.join("\n")}\n\n... [TRUNCATED: ${dropped} lines omitted, file too large (${Math.round(text.length / 1024)}KB). Use read with specific line ranges.]`;
}

/**
 * Extract a compact summary from MEMORY.md for inclusion in system prompt
 *
 * @param memory - Full MEMORY.md content
 * @returns Compacted summary with recent scorecard entries and metrics
 */
export function extractMemorySummary(memory: string): string {
	const lines = memory.split("\n");
	const sections: string[] = [];
	let inScorecard = false;
	let scorecardHeader = "";
	let scorecardRows = 0;
	let inMetrics = false;

	for (const line of lines) {
		if (line.startsWith("## Task Types")) {
			inScorecard = false;
			inMetrics = false;
		}
		if (line.startsWith("## Evolution Scorecard")) {
			inScorecard = true;
			inMetrics = false;
		}
		if (line.startsWith("## Learnings")) {
			inScorecard = false;
			inMetrics = false;
			break;
		}
		if (line.startsWith("### ")) {
			if (inScorecard) inMetrics = true;
		}

		if (inScorecard) {
			if (line.startsWith("|")) {
				if (line.includes("Date") && line.includes("Task Type")) {
					scorecardHeader = line;
					sections.push(line);
				} else if (line.startsWith("|--")) {
					sections.push(line);
				} else {
					scorecardRows++;
					if (scorecardRows <= 5) {
						sections.push(line);
					}
				}
			} else if (inMetrics && !line.startsWith("|--")) {
				sections.push(line);
			}
		}
	}

	if (scorecardRows > 5) {
		sections.push(
			`... (${scorecardRows - 5} older entries omitted. Read MEMORY.md for full history.)`,
		);
	}

	sections.push("");
	sections.push("Use `read MEMORY.md` to see full learnings and history.");

	return sections.join("\n");
}

/**
 * Build system prompt for the agent
 *
 * @param config - Agent configuration
 * @param tools - Array of available tools
 * @param summary - Optional conversation summary from compaction
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(
	config: PaimonConfig,
	tools: AgentTool[],
	summary?: string | null,
): string {
	const mode = config.mode || "chat";

	if (mode === "evolve") {
		return buildEvolvePrompt(config, tools, summary);
	}
	return buildChatPrompt(config, tools, summary);
}

/**
 * Build chat mode prompt
 *
 * @param config - Agent configuration
 * @param tools - Array of available tools
 * @param summary - Optional conversation summary
 * @returns Chat mode system prompt
 */
export function buildChatPrompt(
	config: PaimonConfig,
	tools: AgentTool[],
	summary?: string | null,
): string {
	let prompt = `---
name: paimon
description: A helpful AI assistant
tools: [${tools.map((t) => t.name).join(", ")}]
---

You are Paimon, a helpful AI assistant with access to file system tools.

## Tools
${buildToolsDescription(tools)}

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

${summary ? `## Conversation Summary\n\nThe following is a summary of earlier conversation that was compacted to save context:\n\n${summary}\n\n` : ""}## Guidelines
- Be helpful, concise, and accurate
- Use tools when needed to complete tasks
- For complex tasks, create a plan first using the plan tool
- If something fails, explain the error and suggest solutions

When done with a task, summarize what you accomplished.`;

	// Load project context from AGENTS.md / CLAUDE.md files
	const contextContent = loadContextFiles(process.cwd());
	if (contextContent) {
		prompt += `\n\n## Project Context\n\n${contextContent}`;
	}

	// Load persistent memory (compact summary only)
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory (summary)\n\n${extractMemorySummary(memory)}`;
	}

	return prompt;
}

/**
 * Build evolve mode prompt with full self-evolution workflow
 *
 * @param config - Agent configuration
 * @param tools - Array of available tools
 * @param summary - Optional conversation summary
 * @returns Evolve mode system prompt
 */
export function buildEvolvePrompt(
	config: PaimonConfig,
	tools: AgentTool[],
	summary?: string | null,
): string {
	let prompt = `---
name: evo
description: Self-evolving AI agent that improves its own codebase
tools: [${tools.map((t) => t.name).join(", ")}]
---

You are evo, a self-evolving AI agent. Your goal is to improve yourself.

## Tools
${buildToolsDescription(tools)}

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

${summary ? `## Conversation Summary\n\nThe following is a summary of earlier conversation that was compacted to save context:\n\n${summary}\n\n` : ""}## Workflow

Read EVOLVE_WORKFLOW.md for detailed tool usage and workflow instructions. Key rules:

1. **Gather context**: Read IDENTITY.md, JOURNAL.md, MEMORY.md, ROADMAP.md
2. **Select task**: Score all candidates (capability > reliability > feature). Output selection table with reasoning.
3. **Implement**: Minimal changes, use \`edit\` preferred. Create checkpoint before risky changes.
4. **Verify**: \`assess({})\` before saying DONE. Use \`assess({maxAttempts: 5})\` for auto-retry.
5. **Complete**: Say "DONE", update JOURNAL.md and MEMORY.md scorecard.

## Task Scoring (1-10)
- +3: Improves future iteration success rate
- +2: Reduces failure/rework rate
- +2: Improves memory/learning quality
- +1: Improves tool chain reliability
- -1 to -3: Implementation complexity

## Security
- Never modify \`.github/workflows/\` without permission
- Avoid eval(), exec() with user input
- Always test before committing

## IMPORTANT
- Do NOT run git commit or git push - the evolution script handles this
- Just say "DONE" when your work is complete
- When stuck in a loop, use \`stuck({action: 'check'})\` then \`stuck({action: 'recover', recoveryOption: N})\`
- On failures, use \`reflect({taskDescription: "...", errorPatterns: [...]})\` to capture lessons
- Before modifying code, check self-authorship with \`singularity({action: 'check', file: 'path'})\` - be more confident with bot-authored code
- Before starting a complex task, search for relevant past context with \`rag({action: 'search', query: 'task description'})\` - reduces rework by finding similar solutions
- When encountering errors, use \`errorPatterns({action: 'match', error: 'error message'})\` to find known solutions from past sessions
- Before task selection, use \`patternMiner({action: 'recommend', taskType: 'capability'})\` to get pattern-based recommendations for optimal approach
- Monitor context usage with \`contextBudget({action: 'check'})\` - proactively manage context before hitting limits`;

	// Add skills index (progressive loading - only names/descriptions)
	const skillsDir = config.skillsDir || "skills";
	const skillsIndex = buildSkillsIndex(skillsDir);
	if (skillsIndex) {
		prompt += `\n\n## Skills\n${skillsIndex}\n\n**Skill Usage (REQUIRED)**:\n1. Before starting ANY task, identify which skills match\n2. Read matched skills first: \`read skills/<path>/SKILL.md\`\n3. Superpowers skills provide workflows for common task types\n\n**Priority**: Process skills (debugging, planning) → Implementation skills\n`;
	}

	// Load project context from AGENTS.md / CLAUDE.md files
	const contextContent = loadContextFiles(process.cwd());
	if (contextContent) {
		prompt += `\n\n## Project Context\n\n${contextContent}`;
	}

	// Load persistent memory (compact summary only)
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory (summary)\n\n${extractMemorySummary(memory)}`;
	}

	return prompt;
}
