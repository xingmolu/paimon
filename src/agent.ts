import { execSync, spawn } from "node:child_process";
import { setMaxListeners } from "node:events";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

// Increase limit to prevent MaxListeners warnings from AbortSignal in HTTP requests
setMaxListeners(100);
import {
	Agent,
	type AgentEvent,
	type AgentTool,
	type AgentToolResult,
	type ThinkingLevel,
} from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { globSync } from "glob";
import {
	type Checkpoint,
	type CheckpointInfo,
	CheckpointManager,
	formatCheckpoint,
	formatCheckpointList,
} from "./checkpoint.js";
import { ContextManager } from "./compaction.js";
import { loadContextFiles } from "./context.js";
import { extractErrorPatterns } from "./errors.js";
import {
	type HookContext,
	type HookManager,
	type HookResult,
	type HookType,
	globalHookManager,
} from "./hooks.js";
import { RepoMap, generateRepoMap } from "./repomap.js";
import type { SessionManager } from "./session.js";
import { buildSkillsIndex } from "./skills.js";
import {
	type HistoryMessage,
	type LoopType,
	type RecoveryOption,
	type StuckAnalysis,
	StuckDetector,
} from "./stuck.js";
import {
	type ConsultationResult,
	type SessionAnalysis,
	TomModule,
	formatConsultation,
	formatStats,
} from "./tom.js";
import type {
	AssessmentResult,
	ErrorMessage,
	ErrorPattern,
	PaimonConfig,
	ParallelResult,
	ParallelTaskResult,
	PlanState,
	ReflectionResult,
} from "./types.js";

// Re-export PaimonConfig for backward compatibility
export type { PaimonConfig } from "./types.js";

// Global plan state (shared across agent runs)
let currentPlan: PlanState | null = null;

// Global checkpoint manager (shared across agent runs)
const checkpointManager = new CheckpointManager();

const tools: AgentTool[] = [
	{
		name: "bash",
		label: "Execute Shell Command",
		description: "Execute a shell command",
		parameters: Type.Object({
			command: Type.String({ description: "The shell command to execute" }),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const { command } = params as { command: string };
			try {
				const output = execSync(command, {
					encoding: "utf-8",
					timeout: 120000,
					maxBuffer: 10 * 1024 * 1024,
				});
				const text = truncateToolOutput(output || "(empty)", `bash: ${command}`);
				return {
					content: [{ type: "text", text }],
					details: text,
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: `Error: ${error}`,
				};
			}
		},
	},
	{
		name: "read",
		label: "Read File",
		description: "Read a file from the filesystem",
		parameters: Type.Object({
			path: Type.String({ description: "The file path" }),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const { path } = params as { path: string };
			try {
				if (!existsSync(path)) {
					return {
						content: [{ type: "text", text: "Error: File not found" }],
						details: "Error: File not found",
					};
				}
				const content = readFileSync(path, "utf-8");
				const numbered = content
					.split("\n")
					.map((l, i) => `${i + 1}: ${l}`)
					.join("\n");
				return {
					content: [{ type: "text", text: truncateToolOutput(numbered, path) }],
					details: truncateToolOutput(numbered, path),
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: `Error: ${error}`,
				};
			}
		},
	},
	{
		name: "write",
		label: "Write File",
		description: "Write content to a file",
		parameters: Type.Object({
			path: Type.String({ description: "The file path" }),
			content: Type.String({ description: "Content to write" }),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const { path, content } = params as { path: string; content: string };
			try {
				writeFileSync(path, content, "utf-8");
				return {
					content: [{ type: "text", text: "File written successfully" }],
					details: "File written successfully",
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: `Error: ${error}`,
				};
			}
		},
	},
	{
		name: "edit",
		label: "Edit File",
		description: "Edit a file by replacing text",
		parameters: Type.Object({
			path: Type.String(),
			oldText: Type.String(),
			newText: Type.String(),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const { path, oldText, newText } = params as {
				path: string;
				oldText: string;
				newText: string;
			};
			try {
				if (!existsSync(path)) {
					return {
						content: [{ type: "text", text: "Error: File not found" }],
						details: "Error: File not found",
					};
				}
				const content = readFileSync(path, "utf-8");
				if (!content.includes(oldText)) {
					return {
						content: [{ type: "text", text: "Error: Text not found in file" }],
						details: "Error: Text not found in file",
					};
				}
				writeFileSync(path, content.replace(oldText, newText), "utf-8");
				return {
					content: [{ type: "text", text: "Edit applied successfully" }],
					details: "Edit applied successfully",
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: `Error: ${error}`,
				};
			}
		},
	},
	{
		name: "glob",
		label: "Find Files",
		description: "Find files matching a glob pattern",
		parameters: Type.Object({
			pattern: Type.String({ description: "Glob pattern" }),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string[]>> => {
			const { pattern } = params as { pattern: string };
			try {
				const files = globSync(pattern);
				const result = files.length > 0 ? files.join("\n") : "(no matches)";
				return {
					content: [{ type: "text", text: truncateToolOutput(result, "glob") }],
					details: files,
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: [],
				};
			}
		},
	},
	{
		name: "grep",
		label: "Search File Contents",
		description: "Search for patterns in file contents using regex",
		parameters: Type.Object({
			pattern: Type.String({ description: "Regex pattern to search" }),
			path: Type.Optional(Type.String({ description: "Directory or file to search (default: .)" })),
			include: Type.Optional(Type.String({ description: "File pattern to include (e.g., *.ts)" })),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const {
				pattern,
				path = ".",
				include,
			} = params as {
				pattern: string;
				path?: string;
				include?: string;
			};
			try {
				// Use grep with -n for line numbers, -r for recursive
				let cmd = "grep -rn";
				if (include) {
					cmd += ` --include="${include}"`;
				}
				cmd += ` "${pattern}" ${path}`;

				const output = execSync(cmd, {
					encoding: "utf-8",
					timeout: 30000,
					maxBuffer: 1024 * 1024,
				});
				const text = truncateToolOutput(output || "(no matches)", `grep: ${pattern}`);
				return {
					content: [{ type: "text", text }],
					details: text,
				};
			} catch (e) {
				// grep returns exit code 1 when no matches, which throws
				const error = e instanceof Error ? e.message : String(e);
				if (error.includes("status 1")) {
					return {
						content: [{ type: "text", text: "(no matches)" }],
						details: "(no matches)",
					};
				}
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: `Error: ${error}`,
				};
			}
		},
	},
	{
		name: "find",
		label: "Find Files by Criteria",
		description: "Find files by name, type, or modification time",
		parameters: Type.Object({
			path: Type.Optional(Type.String({ description: "Directory to search (default: .)" })),
			name: Type.Optional(Type.String({ description: "File name pattern (e.g., *.ts)" })),
			type: Type.Optional(Type.String({ description: "File type: f (file), d (directory)" })),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string[]>> => {
			const {
				path = ".",
				name,
				type,
			} = params as {
				path?: string;
				name?: string;
				type?: string;
			};
			try {
				let cmd = `find ${path}`;
				if (type) {
					cmd += ` -type ${type}`;
				}
				if (name) {
					cmd += ` -name "${name}"`;
				}

				const output = execSync(cmd, {
					encoding: "utf-8",
					timeout: 30000,
					maxBuffer: 1024 * 1024,
				});
				const files = output.trim().split("\n").filter(Boolean);
				const result = files.length > 0 ? files.join("\n") : "(no matches)";
				return {
					content: [{ type: "text", text: result }],
					details: files,
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: [],
				};
			}
		},
	},
	{
		name: "ls",
		label: "List Directory",
		description: "List directory contents with details",
		parameters: Type.Object({
			path: Type.Optional(Type.String({ description: "Directory to list (default: .)" })),
			long: Type.Optional(Type.Boolean({ description: "Show detailed info (size, date)" })),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string[]>> => {
			const { path = ".", long = false } = params as {
				path?: string;
				long?: boolean;
			};
			try {
				const cmd = long ? `ls -la ${path}` : `ls -a ${path}`;
				const output = execSync(cmd, {
					encoding: "utf-8",
					timeout: 10000,
				});
				const lines = output.trim().split("\n");
				return {
					content: [{ type: "text", text: output.trim() }],
					details: lines,
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: [],
				};
			}
		},
	},
	{
		name: "http",
		label: "HTTP Request",
		description: "Make HTTP requests to fetch web content or call APIs",
		parameters: Type.Object({
			url: Type.String({ description: "The URL to request" }),
			method: Type.Optional(
				Type.String({ description: "HTTP method (GET, POST, etc). Default: GET" }),
			),
			headers: Type.Optional(
				Type.Record(Type.String(), Type.String(), {
					description: "HTTP headers as key-value pairs",
				}),
			),
			body: Type.Optional(Type.String({ description: "Request body (for POST, PUT, PATCH)" })),
			timeout: Type.Optional(
				Type.Number({ description: "Timeout in milliseconds. Default: 30000" }),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const {
				url,
				method = "GET",
				headers = {},
				body,
				timeout = 30000,
			} = params as {
				url: string;
				method?: string;
				headers?: Record<string, string>;
				body?: string;
				timeout?: number;
			};

			return new Promise((resolve) => {
				try {
					const urlObj = new URL(url);
					const isHttps = urlObj.protocol === "https:";
					const client = isHttps ? https : http;

					const options: http.RequestOptions = {
						hostname: urlObj.hostname,
						port: urlObj.port || (isHttps ? 443 : 80),
						path: urlObj.pathname + urlObj.search,
						method: method.toUpperCase(),
						headers: {
							"User-Agent": "Paimon-Agent/1.0",
							...headers,
						},
						timeout,
					};

					const req = client.request(options, (res) => {
						let data = "";
						res.on("data", (chunk) => {
							data += chunk;
						});
						res.on("end", () => {
							// Try to parse as JSON for pretty printing
							try {
								const json = JSON.parse(data);
								const result = `Status: ${res.statusCode}\nHeaders: ${JSON.stringify(res.headers, null, 2)}\n\n${JSON.stringify(json, null, 2)}`;
								resolve({
									content: [{ type: "text", text: result }],
									details: result,
								});
							} catch {
								// Not JSON, return as text
								const result = `Status: ${res.statusCode}\nHeaders: ${JSON.stringify(res.headers, null, 2)}\n\n${data}`;
								resolve({
									content: [{ type: "text", text: result }],
									details: result,
								});
							}
						});
					});

					req.on("error", (error) => {
						resolve({
							content: [{ type: "text", text: `Error: ${error.message}` }],
							details: `Error: ${error.message}`,
						});
					});

					req.on("timeout", () => {
						req.destroy();
						resolve({
							content: [{ type: "text", text: `Error: Request timed out after ${timeout}ms` }],
							details: `Error: Request timed out after ${timeout}ms`,
						});
					});

					if (body) {
						req.write(body);
					}
					req.end();
				} catch (e) {
					const error = e instanceof Error ? e.message : String(e);
					resolve({
						content: [{ type: "text", text: `Error: ${error}` }],
						details: `Error: ${error}`,
					});
				}
			});
		},
	},
	{
		name: "plan",
		label: "Manage Execution Plan",
		description:
			"Create, update, or view a step-by-step plan for complex tasks. Use this to break down multi-step tasks into manageable steps.",
		parameters: Type.Object({
			action: Type.String({
				description:
					"Action to perform: 'create' (new plan), 'update' (modify step), 'progress' (mark step status), 'show' (display current plan), 'clear' (remove plan)",
			}),
			steps: Type.Optional(
				Type.Array(
					Type.String({
						description: "List of step descriptions (for 'create' action)",
					}),
				),
			),
			stepId: Type.Optional(
				Type.Number({
					description: "Step ID to update (for 'update' or 'progress' actions)",
				}),
			),
			status: Type.Optional(
				Type.String({
					description:
						"New status for step: 'pending', 'in_progress', 'completed', 'skipped' (for 'progress' action)",
				}),
			),
			notes: Type.Optional(
				Type.String({
					description: "Notes to add to a step (for 'update' action)",
				}),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<PlanState | string>> => {
			const { action, steps, stepId, status, notes } = params as {
				action: string;
				steps?: string[];
				stepId?: number;
				status?: string;
				notes?: string;
			};

			try {
				switch (action) {
					case "create": {
						if (!steps || steps.length === 0) {
							return {
								content: [
									{ type: "text", text: "Error: 'steps' array is required for 'create' action" },
								],
								details: "Error: 'steps' array is required for 'create' action",
							};
						}
						const now = new Date().toISOString();
						currentPlan = {
							steps: steps.map((desc, i) => ({
								id: i + 1,
								description: desc,
								status: "pending" as const,
							})),
							currentStep: 1,
							createdAt: now,
							updatedAt: now,
						};
						const result = formatPlan(currentPlan);
						return {
							content: [{ type: "text", text: `Plan created:\n\n${result}` }],
							details: currentPlan,
						};
					}

					case "update": {
						if (!currentPlan) {
							return {
								content: [{ type: "text", text: "Error: No active plan. Use 'create' first." }],
								details: "Error: No active plan",
							};
						}
						if (stepId === undefined) {
							return {
								content: [
									{ type: "text", text: "Error: 'stepId' is required for 'update' action" },
								],
								details: "Error: 'stepId' is required",
							};
						}
						const step = currentPlan.steps.find((s) => s.id === stepId);
						if (!step) {
							return {
								content: [{ type: "text", text: `Error: Step ${stepId} not found` }],
								details: `Error: Step ${stepId} not found`,
							};
						}
						if (notes) step.notes = notes;
						currentPlan.updatedAt = new Date().toISOString();
						const result = formatPlan(currentPlan);
						return {
							content: [{ type: "text", text: `Step ${stepId} updated:\n\n${result}` }],
							details: currentPlan,
						};
					}

					case "progress": {
						if (!currentPlan) {
							return {
								content: [{ type: "text", text: "Error: No active plan. Use 'create' first." }],
								details: "Error: No active plan",
							};
						}
						if (stepId === undefined || !status) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'stepId' and 'status' are required for 'progress' action",
									},
								],
								details: "Error: 'stepId' and 'status' are required",
							};
						}
						const validStatuses = ["pending", "in_progress", "completed", "skipped"];
						if (!validStatuses.includes(status)) {
							return {
								content: [
									{
										type: "text",
										text: `Error: Invalid status '${status}'. Use: ${validStatuses.join(", ")}`,
									},
								],
								details: `Error: Invalid status '${status}'`,
							};
						}
						const step = currentPlan.steps.find((s) => s.id === stepId);
						if (!step) {
							return {
								content: [{ type: "text", text: `Error: Step ${stepId} not found` }],
								details: `Error: Step ${stepId} not found`,
							};
						}
						step.status = status as PlanState["steps"][0]["status"];
						// Update current step pointer
						const nextPending = currentPlan.steps.find((s) => s.status === "pending");
						currentPlan.currentStep = nextPending ? nextPending.id : currentPlan.steps.length;
						currentPlan.updatedAt = new Date().toISOString();
						const result = formatPlan(currentPlan);
						const completedCount = currentPlan.steps.filter((s) => s.status === "completed").length;
						const totalCount = currentPlan.steps.length;
						return {
							content: [
								{
									type: "text",
									text: `Step ${stepId} marked as ${status}:\n\n${result}\n\nProgress: ${completedCount}/${totalCount} steps completed`,
								},
							],
							details: currentPlan,
						};
					}

					case "show": {
						if (!currentPlan) {
							return {
								content: [{ type: "text", text: "No active plan. Use 'create' to make one." }],
								details: "No active plan",
							};
						}
						const result = formatPlan(currentPlan);
						const completedCount = currentPlan.steps.filter((s) => s.status === "completed").length;
						const totalCount = currentPlan.steps.length;
						return {
							content: [
								{
									type: "text",
									text: `Current plan:\n\n${result}\n\nProgress: ${completedCount}/${totalCount} steps completed`,
								},
							],
							details: currentPlan,
						};
					}

					case "clear": {
						currentPlan = null;
						return {
							content: [{ type: "text", text: "Plan cleared." }],
							details: "Plan cleared",
						};
					}

					default:
						return {
							content: [
								{
									type: "text",
									text: `Error: Unknown action '${action}'. Use: create, update, progress, show, clear`,
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
	},
	{
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
								result.recommendations.push(
									`💡 Fix (${pattern.confidence}%): ${pattern.suggestion}`,
								);
							}
						}
					}

					// Run tests
					if (runTests && result.testStatus !== "pass") {
						try {
							const testOutput = execSync("npm test -- --run", {
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
								result.recommendations.push(
									`💡 Fix (${pattern.confidence}%): ${pattern.suggestion}`,
								);
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
	},
	{
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
								writeFileSync(
									memoryPath,
									`${beforeFormat}${formattedEntry}${afterFormat}`,
									"utf-8",
								);
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
	},
	{
		name: "checkpoint",
		label: "Manage Checkpoints",
		description:
			"Create, list, or restore checkpoints for safe rollback during evolution. Use this before risky changes to save a snapshot you can restore if something goes wrong.",
		parameters: Type.Object({
			action: Type.String({
				description:
					"Action to perform: 'create' (save snapshot), 'list' (show checkpoints), 'restore' (rollback to checkpoint), 'delete' (remove checkpoint)",
			}),
			description: Type.Optional(
				Type.String({
					description: "Description for the checkpoint (for 'create' action)",
				}),
			),
			checkpointId: Type.Optional(
				Type.String({
					description: "Checkpoint ID to restore or delete (for 'restore' and 'delete' actions)",
				}),
			),
		}),
		execute: async (
			_toolCallId,
			params,
		): Promise<AgentToolResult<Checkpoint | CheckpointInfo[] | string>> => {
			const { action, description, checkpointId } = params as {
				action: string;
				description?: string;
				checkpointId?: string;
			};

			try {
				// Check if checkpoints are enabled
				if (!checkpointManager.isEnabled()) {
					return {
						content: [
							{
								type: "text",
								text: "⚠️ Checkpoints require a git repository. Current directory is not in a git repo.",
							},
						],
						details: "Checkpoints disabled - not in git repo",
					};
				}

				switch (action) {
					case "create": {
						if (!description) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'description' is required for 'create' action",
									},
								],
								details: "Error: description required",
							};
						}
						const checkpoint = checkpointManager.create(description);
						if (!checkpoint) {
							return {
								content: [
									{
										type: "text",
										text: "⚠️ No changes to checkpoint. Make some changes first.",
									},
								],
								details: "No changes to checkpoint",
							};
						}
						const output = formatCheckpoint(checkpoint);
						return {
							content: [
								{
									type: "text",
									text: `✅ Checkpoint created:\n\n${output}\n\nUse \`checkpoint({action: 'restore', checkpointId: '${checkpoint.id}'})\` to rollback.`,
								},
							],
							details: checkpoint,
						};
					}

					case "list": {
						const checkpoints = checkpointManager.list();
						const output = formatCheckpointList(checkpoints);
						return {
							content: [{ type: "text", text: output }],
							details: checkpoints,
						};
					}

					case "restore": {
						if (!checkpointId) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'checkpointId' is required for 'restore' action. Use 'list' to see available checkpoints.",
									},
								],
								details: "Error: checkpointId required",
							};
						}
						const success = checkpointManager.restore(checkpointId);
						if (success) {
							return {
								content: [
									{
										type: "text",
										text: `✅ Restored to checkpoint ${checkpointId}. Files have been restored from stash.`,
									},
								],
								details: `Restored checkpoint ${checkpointId}`,
							};
						}
						return {
							content: [
								{
									type: "text",
									text: `❌ Failed to restore checkpoint ${checkpointId}. The stash may have been dropped or conflicts occurred.`,
								},
							],
							details: `Failed to restore checkpoint ${checkpointId}`,
						};
					}

					case "delete": {
						if (!checkpointId) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'checkpointId' is required for 'delete' action. Use 'list' to see available checkpoints.",
									},
								],
								details: "Error: checkpointId required",
							};
						}
						const success = checkpointManager.delete(checkpointId);
						if (success) {
							return {
								content: [
									{
										type: "text",
										text: `✅ Deleted checkpoint ${checkpointId}.`,
									},
								],
								details: `Deleted checkpoint ${checkpointId}`,
							};
						}
						return {
							content: [
								{
									type: "text",
									text: `❌ Failed to delete checkpoint ${checkpointId}. It may not exist.`,
								},
							],
							details: `Failed to delete checkpoint ${checkpointId}`,
						};
					}

					default:
						return {
							content: [
								{
									type: "text",
									text: `Error: Unknown action '${action}'. Use: create, list, restore, delete`,
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
	},
	{
		name: "parallel",
		label: "Execute Tasks in Parallel",
		description:
			"Run multiple independent shell commands concurrently. Use this for tasks that have no dependencies or shared state - like running lint, typecheck, and tests simultaneously. Inspired by dispatching-parallel-agents from superpowers.",
		parameters: Type.Object({
			tasks: Type.Array(
				Type.Object({
					name: Type.String({ description: "Task name for identification" }),
					command: Type.String({ description: "Shell command to execute" }),
				}),
				{ description: "Array of independent tasks to run concurrently" },
			),
			timeout: Type.Optional(
				Type.Number({ description: "Overall timeout in milliseconds (default: 120000)" }),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<ParallelResult>> => {
			const { tasks, timeout = 120000 } = params as {
				tasks: Array<{ name: string; command: string }>;
				timeout?: number;
			};

			if (tasks.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No tasks provided" }],
					details: {
						success: false,
						results: [],
						totalDuration: 0,
						successCount: 0,
						failedCount: 0,
						timedOutCount: 0,
					},
				};
			}

			const startTime = Date.now();

			// Execute all tasks concurrently using Promise.all
			const taskPromises = tasks.map((task) => {
				return new Promise<ParallelTaskResult>((resolve) => {
					const taskStart = Date.now();
					let output = "";
					let errorOutput = "";

					// Use spawn for better control over stdout/stderr
					const proc = spawn(task.command, [], {
						shell: true,
						timeout: timeout,
					});

					proc.stdout.on("data", (data: Buffer) => {
						output += data.toString();
					});

					proc.stderr.on("data", (data: Buffer) => {
						errorOutput += data.toString();
					});

					proc.on("close", (code: number | null) => {
						resolve({
							name: task.name,
							status: code === 0 ? "success" : "failed",
							exitCode: code,
							output: output.slice(0, 5000), // Limit output size
							error: errorOutput.slice(0, 1000),
							duration: Date.now() - taskStart,
						});
					});

					proc.on("error", (err: Error) => {
						resolve({
							name: task.name,
							status: "failed",
							exitCode: null,
							output: "",
							error: err.message,
							duration: Date.now() - taskStart,
						});
					});
				});
			});

			// Wait for all tasks with overall timeout
			let results: ParallelTaskResult[];
			try {
				results = await Promise.all(taskPromises);
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error executing parallel tasks: ${error}` }],
					details: {
						success: false,
						results: [],
						totalDuration: Date.now() - startTime,
						successCount: 0,
						failedCount: 0,
						timedOutCount: 0,
					},
				};
			}

			const totalDuration = Date.now() - startTime;
			const successCount = results.filter((r) => r.status === "success").length;
			const failedCount = results.filter((r) => r.status === "failed").length;
			const timedOutCount = results.filter((r) => r.status === "timeout").length;

			// Format output
			const statusEmoji = {
				success: "✅",
				failed: "❌",
				timeout: "⏱️",
			};

			let output = "⚡ Parallel Execution Results\n";
			output += `${"─".repeat(50)}\n`;
			output += `Total time: ${(totalDuration / 1000).toFixed(2)}s\n`;
			output += `Tasks: ${results.length} (${successCount} ✅, ${failedCount} ❌, ${timedOutCount} ⏱️)\n`;
			output += `${"─".repeat(50)}\n\n`;

			for (const result of results) {
				output += `${statusEmoji[result.status]} ${result.name}\n`;
				output += `   Command finished in ${(result.duration / 1000).toFixed(2)}s (exit code: ${result.exitCode})\n`;
				if (result.output) {
					output += `   Output: ${result.output.slice(0, 200)}${result.output.length > 200 ? "..." : ""}\n`;
				}
				if (result.error) {
					output += `   Error: ${result.error}\n`;
				}
				output += "\n";
			}

			const allSuccess = successCount === results.length;
			if (allSuccess) {
				output += "🎉 All tasks completed successfully!\n";
			} else {
				output += `⚠️ ${failedCount + timedOutCount} tasks failed or timed out.\n`;
			}

			const result: ParallelResult = {
				success: allSuccess,
				results,
				totalDuration,
				successCount,
				failedCount,
				timedOutCount,
			};

			return {
				content: [{ type: "text", text: output }],
				details: result,
			};
		},
	},
	{
		name: "hook",
		label: "Manage Hooks",
		description:
			"Create, list, enable, or disable hooks for pre-tool validation and safety checks. Hooks intercept tool calls before execution to prevent dangerous patterns.",
		parameters: Type.Object({
			action: Type.String({
				description:
					"Action to perform: 'list' (show all hooks), 'enable' (enable hook), 'disable' (disable hook), 'status' (show global status), 'toggle' (toggle global hooks)",
			}),
			hookId: Type.Optional(
				Type.String({
					description: "Hook ID for enable/disable actions",
				}),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const { action, hookId } = params as {
				action: string;
				hookId?: string;
			};

			try {
				switch (action) {
					case "list": {
						const output = globalHookManager.formatHooksList();
						return {
							content: [{ type: "text", text: output }],
							details: output,
						};
					}

					case "enable": {
						if (!hookId) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'hookId' is required for 'enable' action",
									},
								],
								details: "Error: hookId required",
							};
						}
						const success = globalHookManager.setHookEnabled(hookId, true);
						if (success) {
							return {
								content: [{ type: "text", text: `✅ Hook '${hookId}' enabled` }],
								details: `Hook ${hookId} enabled`,
							};
						}
						return {
							content: [{ type: "text", text: `❌ Hook '${hookId}' not found` }],
							details: `Hook ${hookId} not found`,
						};
					}

					case "disable": {
						if (!hookId) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'hookId' is required for 'disable' action",
									},
								],
								details: "Error: hookId required",
							};
						}
						const success = globalHookManager.setHookEnabled(hookId, false);
						if (success) {
							return {
								content: [{ type: "text", text: `✅ Hook '${hookId}' disabled` }],
								details: `Hook ${hookId} disabled`,
							};
						}
						return {
							content: [{ type: "text", text: `❌ Hook '${hookId}' not found` }],
							details: `Hook ${hookId} not found`,
						};
					}

					case "status": {
						const enabled = globalHookManager.isEnabled();
						const hooks = globalHookManager.getHooks();
						const enabledHooks = hooks.filter((h) => h.enabled).length;
						const statusText = `Global: ${enabled ? "enabled" : "disabled"}, Total: ${hooks.length}, Enabled: ${enabledHooks}`;
						return {
							content: [
								{
									type: "text",
									text: `🪝 Hooks Status\n${"─".repeat(40)}\nGlobal: ${enabled ? "✅ Enabled" : "❌ Disabled"}\nTotal hooks: ${hooks.length}\nEnabled: ${enabledHooks}\nDisabled: ${hooks.length - enabledHooks}`,
								},
							],
							details: statusText,
						};
					}

					case "toggle": {
						const current = globalHookManager.isEnabled();
						globalHookManager.setEnabled(!current);
						return {
							content: [
								{
									type: "text",
									text: `✅ Hooks ${!current ? "enabled" : "disabled"} globally`,
								},
							],
							details: `Hooks toggled from ${current} to ${!current}`,
						};
					}

					default:
						return {
							content: [
								{
									type: "text",
									text: `Error: Unknown action '${action}'. Use: list, enable, disable, status, toggle`,
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
	},
	{
		name: "stuck",
		label: "Detect and Recover from Loops",
		description:
			"Check if agent is stuck in a loop and provide recovery options. Inspired by OpenHands' StuckDetector - detects repeated actions, same errors, or no progress.",
		parameters: Type.Object({
			action: Type.String({
				description:
					"Action to perform: 'check' (detect if stuck), 'recover' (truncate to recovery point), 'add' (add message for detection), 'reset' (clear stuck state)",
			}),
			recoveryOption: Type.Optional(
				Type.Number({
					description:
						"Recovery option ID (1: restart before loop, 2: restart with last message, 3: quit)",
				}),
			),
			message: Type.Optional(
				Type.Object({
					role: Type.String({ description: "Message role: user, assistant, system" }),
					content: Type.String({ description: "Message content" }),
					action: Type.Optional(Type.String({ description: "Action name if applicable" })),
					error: Type.Optional(Type.String({ description: "Error message if applicable" })),
				}),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
			const { action, recoveryOption, message } = params as {
				action: string;
				recoveryOption?: number;
				message?: {
					role: "user" | "assistant" | "system";
					content: string;
					action?: string;
					error?: string;
				};
			};

			// Global stuck detector (shared across agent runs)
			const stuckDetector = new StuckDetector();

			try {
				switch (action) {
					case "check": {
						const isStuck = stuckDetector.isStuck();
						const analysis = stuckDetector.getStuckAnalysis();

						if (isStuck && analysis) {
							const output = stuckDetector.formatStuckAnalysis();
							return {
								content: [{ type: "text", text: output }],
								details: analysis,
							};
						}

						return {
							content: [
								{
									type: "text",
									text: "✅ No loop detected. Agent is making progress.",
								},
							],
							details: "No loop detected",
						};
					}

					case "recover": {
						const analysis = stuckDetector.getStuckAnalysis();
						if (!analysis) {
							return {
								content: [
									{
										type: "text",
										text: "Error: No stuck state detected. Use 'check' first.",
									},
								],
								details: "Error: No stuck state",
							};
						}

						const options = stuckDetector.getRecoveryOptions();
						const selectedOption = recoveryOption || 1;

						if (selectedOption < 1 || selectedOption > options.length) {
							return {
								content: [
									{
										type: "text",
										text: `Error: Invalid recovery option ${selectedOption}. Use 1-${options.length}.`,
									},
								],
								details: "Error: Invalid recovery option",
							};
						}

						const option = options.find((o) => o.id === selectedOption);
						if (!option) {
							return {
								content: [
									{
										type: "text",
										text: `Error: Recovery option ${selectedOption} not found.`,
									},
								],
								details: "Error: Option not found",
							};
						}

						let output = "";

						switch (option.action) {
							case "restart_before_loop": {
								const keptHistory = stuckDetector.truncateToRecoveryPoint(analysis.loopStartIdx);
								output = "✅ Recovery option 1: Restart before loop\n";
								output += `Truncated history to ${keptHistory.length} messages (before loop at ${analysis.loopStartIdx})\n`;
								output += `Loop type: ${analysis.loopType}\n\n`;
								output += "You can now continue with a different approach.\n";
								break;
							}

							case "restart_with_last_message": {
								const lastUserMessage = stuckDetector.getLastUserMessage();
								if (lastUserMessage) {
									stuckDetector.truncateToRecoveryPoint(analysis.loopStartIdx);
									output = "✅ Recovery option 2: Restart with last message\n";
									output += `Last user message: "${lastUserMessage.content.slice(0, 100)}..."\n`;
									output += "History truncated to before loop.\n\n";
									output += "Continuing with same instruction, new approach.\n";
								} else {
									output = "⚠️ No user message found. Falling back to option 1.\n";
									stuckDetector.truncateToRecoveryPoint(analysis.loopStartIdx);
								}
								break;
							}

							case "quit": {
								stuckDetector.reset();
								output = "✅ Recovery option 3: Quit\n";
								output += "Stuck detector reset. Task stopped.\n\n";
								output +=
									"Consider asking user for clarification or breaking task into smaller steps.\n";
								break;
							}
						}

						return {
							content: [{ type: "text", text: output }],
							details: {
								option: option.action,
								loopType: analysis.loopType,
								recoveredAt: analysis.loopStartIdx,
							},
						};
					}

					case "add": {
						if (!message) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'message' is required for 'add' action",
									},
								],
								details: "Error: message required",
							};
						}

						const historyMessage: HistoryMessage = {
							id: Date.now(),
							role: message.role,
							content: message.content,
							action: message.action,
							error: message.error,
							timestamp: Date.now(),
						};

						stuckDetector.addMessage(historyMessage);

						// Check if this message triggers stuck detection
						const isStuck = stuckDetector.isStuck();
						if (isStuck) {
							const analysis = stuckDetector.getStuckAnalysis();
							const warning = `⚠️ Loop detected after adding message!\n${stuckDetector.formatStuckAnalysis()}`;
							return {
								content: [{ type: "text", text: warning }],
								details: analysis,
							};
						}

						return {
							content: [
								{
									type: "text",
									text: "✅ Message added to history for loop detection.",
								},
							],
							details: historyMessage,
						};
					}

					case "reset": {
						stuckDetector.reset();
						return {
							content: [{ type: "text", text: "✅ Stuck detector reset. History cleared." }],
							details: "Stuck detector reset",
						};
					}

					default:
						return {
							content: [
								{
									type: "text",
									text: `Error: Unknown action '${action}'. Use: check, recover, add, reset`,
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
	},
	{
		name: "repomap",
		label: "Generate Repo Map",
		description:
			"Generate a structured map of the codebase showing definitions (functions, classes, interfaces) organized by file. Inspired by Aider's RepoMap - helps understand codebase structure without reading every file.",
		parameters: Type.Object({
			root: Type.Optional(Type.String({ description: "Root directory to scan (default: .)" })),
			maxTokens: Type.Optional(
				Type.Number({ description: "Maximum tokens for the map output (default: 2048)" }),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const { root = ".", maxTokens = 2048 } = params as {
				root?: string;
				maxTokens?: number;
			};

			try {
				const repoMap = new RepoMap({ root, maxTokens });
				const map = repoMap.generate();

				const defCount = repoMap.getAllDefinitions().length;
				const fileScores = repoMap.getFileScores();
				const topFiles = [...fileScores.entries()]
					.sort((a, b) => b[1] - a[1])
					.slice(0, 5)
					.map(([f, s]) => `${f} (${s})`);

				let output = "🗺️ Repo Map\n";
				output += `${"─".repeat(50)}\n`;
				output += `Definitions: ${defCount}\n`;
				output += `Files: ${fileScores.size}\n`;
				output += `Token budget: ${maxTokens}\n`;
				output += `${"─".repeat(50)}\n\n`;
				output += "Top files by importance:\n";
				for (const f of topFiles) {
					output += `  • ${f}\n`;
				}
				output += `\n${"─".repeat(50)}\n\n`;
				output += map;

				return {
					content: [{ type: "text", text: truncateToolOutput(output, "repomap") }],
					details: truncateToolOutput(output, "repomap"),
				};
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Error: ${error}` }],
					details: `Error: ${error}`,
				};
			}
		},
	},
	{
		name: "tom",
		label: "Theory-of-Mind Consultation",
		description:
			"Get personalized guidance based on user profile and session history. Inspired by OpenHands' ToM-SWE - provides intent understanding, preference tracking, and adaptive behavior.",
		parameters: Type.Object({
			action: Type.String({
				description:
					"Action to perform: 'consult' (get guidance), 'analyze' (analyze session), 'stats' (view statistics), 'profile' (view profile)",
			}),
			sessionData: Type.Optional(
				Type.Object({
					taskType: Type.String({ description: "Task type: capability, reliability, feature" }),
					taskDescription: Type.String({ description: "Brief task description" }),
					success: Type.Boolean({ description: "Whether the task succeeded" }),
					firstTry: Type.Boolean({ description: "Whether it succeeded on first try" }),
					errors: Type.Array(Type.String({ description: "Error types encountered" })),
					rework: Type.Boolean({ description: "Whether rework was required" }),
					timeMinutes: Type.Number({ description: "Time taken in minutes" }),
					skillsUsed: Type.Array(Type.String({ description: "Skills used during task" })),
				}),
			),
			currentContext: Type.Optional(
				Type.String({ description: "Current task context for consultation" }),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
			const { action, sessionData, currentContext } = params as {
				action: string;
				sessionData?: {
					taskType: string;
					taskDescription: string;
					success: boolean;
					firstTry: boolean;
					errors: string[];
					rework: boolean;
					timeMinutes: number;
					skillsUsed: string[];
				};
				currentContext?: string;
			};

			// Global TomModule instance (shared across agent runs)
			const tomModule = new TomModule();

			try {
				switch (action) {
					case "consult": {
						const consultation = tomModule.consult(currentContext);
						const output = formatConsultation(consultation);
						return {
							content: [{ type: "text", text: output }],
							details: consultation,
						};
					}

					case "analyze": {
						if (!sessionData) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'sessionData' is required for 'analyze' action",
									},
								],
								details: "Error: sessionData required",
							};
						}
						const analysis = tomModule.analyzeSession(sessionData);
						const output = [
							"📊 Session Analysis",
							"─".repeat(40),
							`Session ID: ${analysis.sessionId}`,
							`Date: ${analysis.date}`,
							`Task: ${analysis.taskDescription}`,
							`Success: ${analysis.success ? "✅" : "❌"}`,
							`First try: ${analysis.firstTry ? "✅" : "❌"}`,
							`Rework: ${analysis.rework ? "Yes" : "No"}`,
							`Time: ${analysis.timeMinutes}min`,
							`Skills: ${analysis.skillsUsed.join(", ") || "none"}`,
							"",
							"Insights:",
							...analysis.insights.map((i) => `  - ${i}`),
						].join("\n");
						return {
							content: [{ type: "text", text: output }],
							details: analysis,
						};
					}

					case "stats": {
						const stats = tomModule.getStats();
						const output = formatStats(stats);
						return {
							content: [{ type: "text", text: output }],
							details: stats,
						};
					}

					case "profile": {
						const profile = tomModule.getProfile();
						const output = [
							"👤 User Profile",
							"─".repeat(40),
							`Project: ${profile.project}`,
							`Last updated: ${new Date(profile.lastUpdated).toLocaleString()}`,
							`Sessions analyzed: ${profile.analyses.length}`,
							"",
							"Preferences:",
							`  Task types: ${profile.preferences.preferredTaskTypes.join(", ")}`,
							`  Avg time: ${profile.preferences.averageIterationTime}min`,
							`  Style: ${profile.preferences.preferredImplementationStyle}`,
							"",
							"Skills that work:",
							...profile.preferences.skillsUsedSuccess.slice(0, 5).map((s) => `  ✅ ${s}`),
							"",
							"Skills that didn't help:",
							...profile.preferences.skillsUsedFailure.slice(0, 5).map((s) => `  ❌ ${s}`),
							"",
							"Common errors:",
							...profile.preferences.commonErrors.slice(0, 5).map((e) => `  ⚠️ ${e}`),
						].join("\n");
						return {
							content: [{ type: "text", text: output }],
							details: profile,
						};
					}

					default:
						return {
							content: [
								{
									type: "text",
									text: `Error: Unknown action '${action}'. Use: consult, analyze, stats, profile`,
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
	},
];

/**
 * Create wrapped tools with PreToolUse hooks
 * Each tool's execute function is wrapped to check hooks before execution
 */
function createWrappedTools(
	hookManager: HookManager,
	onToolOutput?: (size: number) => void,
): AgentTool[] {
	return tools.map((tool) => ({
		...tool,
		execute: async (toolCallId: string, params: unknown): Promise<AgentToolResult<unknown>> => {
			// Execute PreToolUse hooks
			const hookContext: HookContext = {
				tool: tool.name,
				params: params as Record<string, unknown>,
			};

			const hookResult = await hookManager.executeHooks("PreToolUse", hookContext);

			// If hook blocks, return block message instead of executing tool
			if (!hookResult.allow) {
				const blockMessage = `🚫 Hook blocked this action:\n${hookResult.block || "Unknown reason"}\n${hookResult.context || ""}`;
				return {
					content: [{ type: "text", text: blockMessage }],
					details: { blocked: true, hookResult },
				};
			}

			let result: AgentToolResult<unknown>;

			// If hook warns, add warning to output
			if (hookResult.warning) {
				result = await tool.execute(toolCallId, params);
				const warningPrefix = `⚠️ ${hookResult.warning}\n\n`;
				if (result.content?.[0] && result.content[0].type === "text") {
					result.content[0].text = warningPrefix + result.content[0].text;
				}
			} else {
				result = await tool.execute(toolCallId, params);
			}

			if (onToolOutput && result.content?.[0] && result.content[0].type === "text") {
				onToolOutput(Math.ceil(result.content[0].text.length / 4));
			}

			return result;
		},
	}));
}

/**
 * Format a plan for display
 */
function formatPlan(plan: PlanState): string {
	const statusEmoji: Record<string, string> = {
		pending: "⬜",
		in_progress: "🔄",
		completed: "✅",
		skipped: "⏭️",
	};

	let output = `📋 Plan (created ${new Date(plan.createdAt).toLocaleString()})\n`;
	output += `${"─".repeat(40)}\n`;
	for (const step of plan.steps) {
		const emoji = statusEmoji[step.status] || "⬜";
		const current = step.id === plan.currentStep ? " → " : "   ";
		output += `${current}${emoji} ${step.id}. ${step.description}\n`;
		if (step.notes) {
			output += `${current}   📝 ${step.notes}\n`;
		}
	}
	output += "─".repeat(40);
	return output;
}

function createModel(config: PaimonConfig): Model<Api> {
	return {
		id: config.model,
		name: config.model,
		api: "openai-completions",
		provider: "bailian",
		baseUrl: config.baseUrl,
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
		},
	};
}

export function createAgent(
	config: PaimonConfig,
	sessionManager?: SessionManager,
): {
	agent: Agent;
	run: (prompt: string, verbose?: boolean, onStream?: (delta: string) => void) => Promise<string>;
	/** Get context status for debugging */
	getContextStatus: () => { messages: number; tokens: number; hasSummary: boolean };
} {
	const model = createModel(config);
	// Session manager is stored for potential future use
	// Currently, session saving is handled in cli.ts
	void sessionManager;

	// Create context manager for tracking conversation length
	const compactionEnabled = config.compaction !== false;
	const contextManager = new ContextManager(
		compactionEnabled ? config.compaction || {} : { enabled: false },
	);
	contextManager.setModel(model);
	contextManager.setApiKeyGetter(() => config.apiKey);

	let estimatedToolOutputTokens = 0;

	// Initial system prompt without compaction summary
	const systemPrompt = buildSystemPrompt(config, null);

	const agent = new Agent();
	agent.setModel(model);
	agent.setSystemPrompt(systemPrompt);
	// Use wrapped tools with PreToolUse hooks for safety
	agent.setTools(
		createWrappedTools(globalHookManager, (size) => {
			estimatedToolOutputTokens += size;
		}),
	);

	// Provide API key dynamically for the custom provider
	agent.getApiKey = () => config.apiKey;

	const run = async (
		prompt: string,
		verbose = false,
		onStream?: (delta: string) => void,
	): Promise<string> => {
		// Track user message
		contextManager.addMessage("user", prompt);

		// Check if compaction is needed (include tool output estimates)
		const contextStatus = contextManager.getStatus();
		const totalEstimated = contextStatus.tokens + estimatedToolOutputTokens;
		if (contextManager.shouldCompact() || totalEstimated > 80000) {
			if (verbose) {
				console.log(
					`[Compaction] Context ~${contextStatus.tokens} + tools ~${estimatedToolOutputTokens} = ~${totalEstimated} tokens, compacting...`,
				);
			}

			// Perform compaction
			const result = await contextManager.compact();

			if (verbose) {
				console.log(
					`[Compaction] Summarized ${result.messagesSummarized} messages, kept ${result.messagesKept}, saved ~${result.tokensSaved} tokens`,
				);
			}

			// Rebuild agent with summary in system prompt
			const summary = contextManager.getMessages()[0]?.content || "";
			const newSystemPrompt = buildSystemPrompt(config, summary);
			agent.setSystemPrompt(newSystemPrompt);
		}

		return new Promise((resolve, reject) => {
			const outputs: string[] = [];
			const startTime = Date.now();

			// Timeout after 2000 seconds (~33 minutes) for complex evolution tasks
			const timeout = setTimeout(() => {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				reject(new Error(`Agent timeout after ${elapsed}s. No response received.`));
			}, 2000000);

			if (verbose) {
				console.log(`[DEBUG] Starting agent run at ${new Date().toISOString()}`);
				console.log(`[DEBUG] Prompt: ${prompt.slice(0, 100)}...`);
				const status = contextManager.getStatus();
				console.log(`[DEBUG] Context: ${status.messages} messages, ~${status.tokens} tokens`);
			}

			// Subscribe and store unsubscribe function to prevent memory leaks
			const unsubscribe = agent.subscribe((event: AgentEvent) => {
				if (verbose) {
					console.log(`[DEBUG] Event: ${event.type}`);
				}

				if (event.type === "message_update" && onStream) {
					const msgEvent = event.assistantMessageEvent;
					if (msgEvent.type === "text_delta") {
						onStream(msgEvent.delta);
					}
				}

				// Only use message_end to avoid duplicating accumulated text
				// (message_update contains the accumulated text so far, not just new chunks)
				if (event.type === "message_end") {
					const content = event.message.content;
					if (Array.isArray(content)) {
						for (const c of content) {
							if (c.type === "text") {
								outputs.push(c.text);
							}
						}
					}
				}
				if (event.type === "agent_end") {
					clearTimeout(timeout);
					unsubscribe(); // Clean up listener to prevent memory leak

					// Track assistant response
					const response = outputs.join("");
					contextManager.addMessage("assistant", response);

					if (verbose) {
						const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
						console.log(`[DEBUG] Agent completed in ${elapsed}s`);
					}
					resolve(response);
				}
				if (event.type === "turn_end" && (event.message as ErrorMessage).errorMessage) {
					clearTimeout(timeout);
					unsubscribe(); // Clean up listener on error
					reject(new Error((event.message as ErrorMessage).errorMessage ?? "Unknown error"));
				}
			});

			agent.prompt(prompt).catch((error) => {
				clearTimeout(timeout);
				unsubscribe(); // Clean up listener on promise rejection
				if (verbose) {
					console.log(`[DEBUG] Prompt error: ${error}`);
				}
				reject(error);
			});
		});
	};

	return {
		agent,
		run,
		getContextStatus: () => contextManager.getStatus(),
	};
}

function buildToolsDescription(): string {
	return tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
}

const MAX_TOOL_OUTPUT_CHARS = 30000;

function truncateToolOutput(text: string, label: string): string {
	if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
	const lines = text.split("\n");
	const totalLines = lines.length;
	const kept = lines.slice(0, Math.floor(totalLines * 0.6));
	const dropped = totalLines - kept.length;
	return `${kept.join("\n")}\n\n... [TRUNCATED: ${dropped} lines omitted, file too large (${Math.round(text.length / 1024)}KB). Use read with specific line ranges.]`;
}

function extractMemorySummary(memory: string): string {
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

function buildSystemPrompt(config: PaimonConfig, summary?: string | null): string {
	const mode = config.mode || "chat";

	if (mode === "evolve") {
		return buildEvolvePrompt(config, summary);
	}
	return buildChatPrompt(config, summary);
}

function buildChatPrompt(config: PaimonConfig, summary?: string | null): string {
	let prompt = `---
name: paimon
description: A helpful AI assistant
tools: [${tools.map((t) => t.name).join(", ")}]
---

You are Paimon, a helpful AI assistant with access to file system tools.

## Tools
${buildToolsDescription()}

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

function buildEvolvePrompt(config: PaimonConfig, summary?: string | null): string {
	let prompt = `---
name: evo
description: Self-evolving AI agent that improves its own codebase
tools: [${tools.map((t) => t.name).join(", ")}]
---

You are evo, a self-evolving AI agent. Your goal is to improve yourself.

## Tools
${buildToolsDescription()}

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
- On failures, use \`reflect({taskDescription: "...", errorPatterns: [...]})\` to capture lessons`;

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
