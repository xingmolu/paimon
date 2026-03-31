/**
 * Assess tool - Run self-assessment checks for code changes
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { extractErrorPatterns } from "../errors.js";
import type { AssessmentResult } from "../types.js";

/**
 * Assess tool - Run self-assessment checks
 */
export const assessTool: AgentTool = {
	name: "assess",
	label: "Self-Assessment",
	description:
		"Run a self-assessment check to evaluate code changes. Checks build, tests, lint, and provides recommendations. Use this before completing a self-evolution task.",
	parameters: Type.Object({
		runBuild: Type.Optional(Type.Boolean({ description: "Run npm run build (default: true)" })),
		runTests: Type.Optional(Type.Boolean({ description: "Run npm test (default: true)" })),
		runLint: Type.Optional(Type.Boolean({ description: "Run npm run lint (default: true)" })),
		maxAttempts: Type.Optional(
			Type.Number({
				description:
					"Maximum retry attempts for error recovery (default: 1, no retries). Use higher values to enable automatic retry loops.",
			}),
		),
		confidenceThreshold: Type.Optional(
			Type.Number({
				description:
					"Minimum confidence score (0-100) for recommendations to be shown (default: 80). Higher values filter out more potential false positives.",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<AssessmentResult>> => {
		const {
			runBuild = true,
			runTests = true,
			runLint = true,
			maxAttempts = 1,
			confidenceThreshold = 80,
		} = params as {
			runBuild?: boolean;
			runTests?: boolean;
			runLint?: boolean;
			maxAttempts?: number;
			confidenceThreshold?: number;
		};

		const result: AssessmentResult = {
			buildStatus: "unknown",
			testStatus: "unknown",
			lintStatus: "unknown",
			changedFiles: [],
			timestamp: new Date().toISOString(),
			recommendations: [],
			attempts: 0,
			errorPatterns: [],
		};

		// Error recovery loop - retry up to maxAttempts times
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			result.attempts = attempt;

			try {
				// Get changed files (only on first attempt)
				if (attempt === 1) {
					try {
						const statusOutput = execSync("git status --porcelain", {
							encoding: "utf-8",
							timeout: 10000,
						});
						result.changedFiles = statusOutput
							.trim()
							.split("\n")
							.filter(Boolean)
							.map((line) => line.slice(3)); // Remove status prefix (M, A, etc.)
					} catch {
						result.recommendations.push("Could not determine changed files - git not available");
					}
				}

				// Run build
				if (runBuild && result.buildStatus !== "pass") {
					try {
						const buildOutput = execSync("npm run build", {
							encoding: "utf-8",
							timeout: 120000,
						});
						result.buildStatus = "pass";
						// Extract any warnings from successful build
						const patterns = extractErrorPatterns(buildOutput);
						for (const p of patterns) {
							if (p.message.toLowerCase().includes("warning")) {
								result.recommendations.push(`⚠️ Warning: ${p.message} (${p.file || "unknown"})`);
							}
						}
					} catch (e) {
						result.buildStatus = "fail";
						const output = e instanceof Error ? e.message : String(e);
						result.recommendations.push(
							`Build failed (attempt ${attempt}): ${output.slice(0, 500)}`,
						);
						// Extract error patterns for actionable suggestions
						const patterns = extractErrorPatterns(output);
						result.errorPatterns = patterns;
						// Filter by confidence threshold
						const highConfPatterns = patterns.filter((p) => p.confidence >= confidenceThreshold);
						for (const pattern of highConfPatterns.slice(0, 5)) {
							result.recommendations.push(`💡 Fix (${pattern.confidence}%): ${pattern.suggestion}`);
						}
					}
				}

				// Run tests
				if (runTests && result.testStatus !== "pass") {
					try {
						execSync("npm test -- --run", {
							encoding: "utf-8",
							timeout: 120000,
						});
						result.testStatus = "pass";
					} catch (e) {
						result.testStatus = "fail";
						const output = e instanceof Error ? e.message : String(e);
						result.recommendations.push(
							`Tests failed (attempt ${attempt}): ${output.slice(0, 500)}`,
						);
						// Extract test failure patterns
						const patterns = extractErrorPatterns(output);
						// Filter test patterns by confidence threshold
						const highConfPatterns = patterns.filter(
							(p) => p.type === "test" && p.confidence >= confidenceThreshold,
						);
						for (const pattern of highConfPatterns.slice(0, 5)) {
							result.recommendations.push(`💡 Fix (${pattern.confidence}%): ${pattern.suggestion}`);
						}
						// Merge error patterns (all types, for display later)
						result.errorPatterns = [...(result.errorPatterns || []), ...patterns];
					}
				}

				// Run lint
				if (runLint && result.lintStatus !== "pass") {
					try {
						execSync("npm run lint", {
							encoding: "utf-8",
							timeout: 60000,
						});
						result.lintStatus = "pass";
					} catch (e) {
						result.lintStatus = "fail";
						const output = e instanceof Error ? e.message : String(e);
						result.recommendations.push(
							`Lint failed (attempt ${attempt}): ${output.slice(0, 500)}`,
						);
						// Try auto-fix with --fix flag if this is a retry
						if (attempt > 1) {
							try {
								execSync("npm run lint -- --fix", {
									encoding: "utf-8",
									timeout: 60000,
								});
								result.lintStatus = "pass";
								result.recommendations.push("✅ Auto-fixed lint issues");
							} catch {
								// Auto-fix didn't work, manual fix needed
								const patterns = extractErrorPatterns(output);
								// Filter by confidence threshold
								const highConfPatterns = patterns.filter(
									(p) => p.confidence >= confidenceThreshold,
								);
								for (const pattern of highConfPatterns.slice(0, 3)) {
									result.recommendations.push(
										`💡 Fix (${pattern.confidence}%): ${pattern.suggestion}`,
									);
								}
							}
						}
					}
				}

				// Check for dangerous patterns in changed files
				for (const file of result.changedFiles) {
					if (file.endsWith(".ts") || file.endsWith(".js")) {
						try {
							const content = readFileSync(file, "utf-8");
							if (content.includes("eval(")) {
								result.recommendations.push(`⚠️ Security: eval() found in ${file}`);
							}
							if (content.includes("exec(") && content.includes("user")) {
								result.recommendations.push(
									`⚠️ Security: Potential exec() with user input in ${file}`,
								);
							}
						} catch {
							// File might not exist or be readable
						}
					}
				}

				// Check if all passed - if so, we can exit the retry loop
				const allPassed =
					(!runBuild || result.buildStatus === "pass") &&
					(!runTests || result.testStatus === "pass") &&
					(!runLint || result.lintStatus === "pass");

				if (allPassed) {
					break; // Success, no need to retry
				}

				// If we have retries remaining, wait briefly before next attempt
				if (attempt < maxAttempts && !allPassed) {
					result.recommendations.push(`🔄 Retrying... (${attempt}/${maxAttempts} attempts used)`);
					// Brief pause before retry (100ms)
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				result.recommendations.push(`Error during assessment attempt ${attempt}: ${error}`);
			}
		}

		// Generate summary
		const allPassed =
			(!runBuild || result.buildStatus === "pass") &&
			(!runTests || result.testStatus === "pass") &&
			(!runLint || result.lintStatus === "pass");

		const statusEmoji = {
			pass: "✅",
			fail: "❌",
			unknown: "⏭️",
		};

		let output = "📊 Self-Assessment Report\n";
		output += `Generated: ${new Date(result.timestamp).toLocaleString()}\n`;
		if (result.attempts > 1) {
			output += `Attempts: ${result.attempts}/${maxAttempts}\n`;
		}
		output += `${"─".repeat(40)}\n`;
		output += `${statusEmoji[result.buildStatus]} Build: ${result.buildStatus}\n`;
		output += `${statusEmoji[result.testStatus]} Tests: ${result.testStatus}\n`;
		output += `${statusEmoji[result.lintStatus]} Lint: ${result.lintStatus}\n`;
		output += `📄 Changed files: ${result.changedFiles.length > 0 ? result.changedFiles.join(", ") : "(none)"}\n`;
		output += `${"─".repeat(40)}\n`;

		if (allPassed && result.recommendations.filter((r) => !r.includes("Retrying")).length === 0) {
			output += "🎉 All checks passed! Ready to commit.\n";
		} else if (result.recommendations.length > 0) {
			// Filter out retry messages for final summary
			const filteredRecs = result.recommendations.filter((r) => !r.includes("Retrying"));
			if (filteredRecs.length > 0) {
				output += "⚠️ Recommendations:\n";
				for (const rec of filteredRecs) {
					output += `  - ${rec}\n`;
				}
			}
		} else if (!allPassed) {
			output += `❌ Some checks failed after ${result.attempts} attempts. Fix issues before committing.\n`;
		}

		// Show error patterns if available (filtered by confidence threshold)
		if (result.errorPatterns && result.errorPatterns.length > 0) {
			// Filter by confidence threshold
			const highConfidencePatterns = result.errorPatterns.filter(
				(p) => p.confidence >= confidenceThreshold,
			);
			const filteredOut = result.errorPatterns.length - highConfidencePatterns.length;

			if (highConfidencePatterns.length > 0) {
				output += `\n📋 Error Patterns Detected (confidence ≥ ${confidenceThreshold}%):\n`;
				for (const pattern of highConfidencePatterns.slice(0, 5)) {
					output += `  • [${pattern.confidence}%] [${pattern.type}] ${pattern.message}\n`;
					if (pattern.file) {
						output += `    File: ${pattern.file}:${pattern.line || "?"}\n`;
					}
				}
				if (filteredOut > 0) {
					output += `\n  (${filteredOut} low-confidence patterns filtered out)\n`;
				}
			} else if (result.errorPatterns.length > 0) {
				output += `\n📋 ${result.errorPatterns.length} error patterns detected, but all below confidence threshold (${confidenceThreshold}%).\n`;
				output += "  Consider lowering confidenceThreshold to see more patterns.\n";
			}
		}

		return {
			content: [{ type: "text", text: output }],
			details: result,
		};
	},
};
