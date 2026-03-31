/**
 * Reflect tool - Analyze failures and extract lessons
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ErrorPattern, ReflectionResult } from "../types.js";

/**
 * Reflect tool - Analyze failures and update MEMORY.md
 */
export const reflectTool: AgentTool = {
	name: "reflect",
	label: "Reflect on Failures",
	description:
		"Analyze failures and extract lessons to update MEMORY.md. Use this when assessment fails after multiple attempts to capture learnings.",
	parameters: Type.Object({
		errorPatterns: Type.Optional(
			Type.Array(
				Type.Object({
					type: Type.String({ description: "Error type: typescript, test, lint, runtime" }),
					file: Type.Optional(Type.String({ description: "File where error occurred" })),
					line: Type.Optional(Type.Number({ description: "Line number of error" })),
					message: Type.String({ description: "Error message" }),
					suggestion: Type.String({ description: "Suggested fix" }),
				}),
			),
		),
		taskDescription: Type.String({
			description: "What task was being attempted when the failure occurred",
		}),
		writeToMemory: Type.Optional(
			Type.Boolean({
				description: "Write the reflection to MEMORY.md automatically (default: true)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<ReflectionResult>> => {
		const {
			errorPatterns,
			taskDescription,
			writeToMemory = true,
		} = params as {
			errorPatterns?: ErrorPattern[];
			taskDescription: string;
			writeToMemory?: boolean;
		};

		// Generate reflection based on error patterns
		const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

		// Analyze patterns to determine root cause and insight
		const context = `Attempted: ${taskDescription}`;
		let insight = "";
		let action = "";

		if (errorPatterns && errorPatterns.length > 0) {
			// Analyze the types of errors
			const tsErrors = errorPatterns.filter((p) => p.type === "typescript");
			const testErrors = errorPatterns.filter((p) => p.type === "test");
			const lintErrors = errorPatterns.filter((p) => p.type === "lint");

			// Build insight based on error analysis
			if (tsErrors.length > 0) {
				const files = tsErrors.filter((p) => p.file).map((p) => p.file);
				const codes = tsErrors
					.filter((p) => p.message.includes("TS"))
					.map((p) => p.message.match(/TS\d+/)?.[0])
					.filter(Boolean);

				insight = "TypeScript errors detected";
				if (codes.length > 0) {
					insight += ` (${codes.join(", ")})`;
				}
				if (files.length > 0) {
					insight += ` in ${files.join(", ")}`;
				}
				insight += ". ";

				// Add specific insight based on error type
				for (const error of tsErrors.slice(0, 2)) {
					if (error.message.includes("Cannot find module")) {
						insight += "Module resolution failed - check imports and dependencies.";
					} else if (error.message.includes("is not assignable to type")) {
						insight += "Type mismatch - verify type definitions and conversions.";
					} else if (error.message.includes("does not exist on type")) {
						insight += "Property access error - check object structure and typing.";
					} else {
						insight += error.suggestion;
					}
				}
				action =
					"Verify imports, check type definitions, and ensure correct property access. Use TypeScript strict mode to catch errors early.";
			} else if (testErrors.length > 0) {
				insight = "Test failures detected";
				const testNames = testErrors
					.filter((p) => p.message.includes("Test failed"))
					.map((p) => p.message);
				if (testNames.length > 0) {
					insight += `: ${testNames.slice(0, 2).join(", ")}`;
				}
				insight += ". ";
				insight += "Tests reveal assumptions about behavior that don't match implementation.";
				action =
					"Review test assertions, ensure implementation matches expected behavior, and check for edge cases.";
			} else if (lintErrors.length > 0) {
				insight = "Lint issues detected";
				const lintFiles = lintErrors.filter((p) => p.file).map((p) => p.file);
				if (lintFiles.length > 0) {
					insight += ` in ${lintFiles.join(", ")}`;
				}
				insight += ". ";
				insight += "Code style or quality issues found.";
				action = "Run `npm run lint -- --fix` to auto-fix, or manually correct style issues.";
			} else {
				// Generic error handling
				insight = `Multiple errors occurred during ${taskDescription}. `;
				for (const pattern of errorPatterns.slice(0, 2)) {
					insight += `${pattern.suggestion}. `;
				}
				action =
					"Review error patterns and fix issues systematically. Run assess again after fixes.";
			}
		} else {
			// No error patterns provided - generic reflection
			insight =
				"Failure occurred but no specific error patterns captured. Review the error output manually.";
			action =
				"Run assess with verbose logging to capture more details, or check build/test output directly.";
		}

		// Format the MEMORY.md entry
		const formattedEntry = `### ${date}: ${taskDescription.split(" ").slice(0, 5).join(" ")}...

**Context:** ${context}

**Insight:** ${insight}

**Action:** ${action}

---

`;

		const result: ReflectionResult = {
			context,
			insight,
			action,
			formattedEntry,
			writtenToMemory: false,
		};

		// Write to MEMORY.md if requested
		if (writeToMemory) {
			const memoryPath = "MEMORY.md";
			try {
				if (existsSync(memoryPath)) {
					const existingContent = readFileSync(memoryPath, "utf-8");
					// Find the Learnings section and append
					if (existingContent.includes("## Learnings")) {
						// Append after the Learnings header
						const learningsIndex = existingContent.indexOf("## Learnings");
						const formatIndex = existingContent.indexOf("## Format");
						if (formatIndex > learningsIndex) {
							// Insert before Format section
							const beforeFormat = existingContent.slice(0, formatIndex);
							const afterFormat = existingContent.slice(formatIndex);
							writeFileSync(memoryPath, `${beforeFormat}${formattedEntry}${afterFormat}`, "utf-8");
						} else {
							// Append at end
							writeFileSync(memoryPath, `${existingContent}\n${formattedEntry}`, "utf-8");
						}
					} else {
						// No Learnings section, append at end
						writeFileSync(memoryPath, `${existingContent}\n${formattedEntry}`, "utf-8");
					}
					result.writtenToMemory = true;
				} else {
					// Create new MEMORY.md
					const newMemory = `# Memory

Persistent learnings stored across sessions.

---

## Learnings

${formattedEntry}

## Format

Each learning should be:
- **Date:** When it was learned
- **Context:** What problem was being solved
- **Insight:** What was learned
- **Action:** How to apply it
`;
					writeFileSync(memoryPath, newMemory, "utf-8");
					result.writtenToMemory = true;
				}
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				result.formattedEntry += `\n(Error writing to MEMORY.md: ${error})`;
			}
		}

		// Generate output
		let output = "📝 Reflection on Failures\n";
		output += `${"─".repeat(40)}\n`;
		output += `**Context:** ${context}\n`;
		output += `**Insight:** ${insight}\n`;
		output += `**Action:** ${action}\n`;
		output += `${"─".repeat(40)}\n`;
		if (result.writtenToMemory) {
			output += "✅ Learning entry added to MEMORY.md\n";
		} else if (writeToMemory) {
			output += "⚠️ Failed to write to MEMORY.md - see formatted entry below\n";
		} else {
			output += "📋 Formatted entry (not written to MEMORY.md):\n";
			output += `${"─".repeat(40)}\n`;
			output += formattedEntry;
		}

		return {
			content: [{ type: "text", text: output }],
			details: result,
		};
	},
};
