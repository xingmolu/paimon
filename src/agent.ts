import { execSync } from "node:child_process";
import { setMaxListeners } from "node:events";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { join } from "node:path";

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
import { type CompactionConfig, ContextManager } from "./compaction.js";
import { loadContextFiles } from "./context.js";
import type { SessionManager } from "./session.js";

/**
 * Plan state for multi-step reasoning
 */
interface PlanState {
	steps: Array<{
		id: number;
		description: string;
		status: "pending" | "in_progress" | "completed" | "skipped";
		notes?: string;
	}>;
	currentStep: number;
	createdAt: string;
	updatedAt: string;
}

// Global plan state (shared across agent runs)
let currentPlan: PlanState | null = null;

/**
 * Assessment result for self-review
 */
interface AssessmentResult {
	buildStatus: "pass" | "fail" | "unknown";
	testStatus: "pass" | "fail" | "unknown";
	lintStatus: "pass" | "fail" | "unknown";
	changedFiles: string[];
	timestamp: string;
	recommendations: string[];
	attempts: number;
	errorPatterns?: ErrorPattern[];
}

/**
 * Reflection result for learning from failures
 */
interface ReflectionResult {
	context: string;
	insight: string;
	action: string;
	formattedEntry: string;
	writtenToMemory: boolean;
}

/**
 * Extracted error pattern from build/test output
 */
interface ErrorPattern {
	type: "typescript" | "test" | "lint" | "runtime";
	file?: string;
	line?: number;
	message: string;
	suggestion: string;
}

/**
 * Extract common error patterns from build/test output
 */
function extractErrorPatterns(output: string): ErrorPattern[] {
	const patterns: ErrorPattern[] = [];

	// TypeScript errors: "src/file.ts(10,5): error TS1234: message"
	const tsErrorRegex = /([^\s(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g;
	for (const match of output.matchAll(tsErrorRegex)) {
		patterns.push({
			type: "typescript",
			file: match[1],
			line: Number.parseInt(match[2], 10),
			message: `TS${match[4]}: ${match[5]}`,
			suggestion: getSuggestionForTsError(match[4], match[5]),
		});
	}

	// Test failures: "FAIL src/file.test.ts > test name"
	const testFailRegex = /FAIL\s+([^\s>]+)\s*>\s*(.+)/g;
	for (const match of output.matchAll(testFailRegex)) {
		patterns.push({
			type: "test",
			file: match[1],
			message: `Test failed: ${match[2]}`,
			suggestion: "Check test assertions and ensure the code matches expected behavior",
		});
	}

	// Assertion errors: "AssertionError: expected X to equal Y"
	const assertRegex = /AssertionError:\s*(.+)/g;
	for (const match of output.matchAll(assertRegex)) {
		patterns.push({
			type: "test",
			message: match[1],
			suggestion: "Review the assertion and fix the expected or actual value",
		});
	}

	// Lint errors: "src/file.ts:10:5: error message"
	const lintErrorRegex = /([^\s:]+):(\d+):(\d+):\s*(.+)/g;
	for (const match of output.matchAll(lintErrorRegex)) {
		if (match[1].endsWith(".ts") || match[1].endsWith(".js")) {
			patterns.push({
				type: "lint",
				file: match[1],
				line: Number.parseInt(match[2], 10),
				message: match[4],
				suggestion: "Run `npm run lint -- --fix` to auto-fix or manually correct the issue",
			});
		}
	}

	// Cannot find module errors
	const moduleRegex = /Cannot find module ['"]([^'"]+)['"]/g;
	for (const match of output.matchAll(moduleRegex)) {
		patterns.push({
			type: "typescript",
			message: `Cannot find module '${match[1]}'`,
			suggestion: `Install the module with 'npm install ${match[1]}' or check the import path`,
		});
	}

	// Type 'X' is not assignable to type 'Y'
	const typeRegex = /Type '([^']+)' is not assignable to type '([^']+)'/g;
	for (const match of output.matchAll(typeRegex)) {
		patterns.push({
			type: "typescript",
			message: `Type '${match[1]}' is not assignable to type '${match[2]}'`,
			suggestion: "Add type conversion or fix the type definition",
		});
	}

	return patterns;
}

/**
 * Get suggestion for TypeScript error code
 */
function getSuggestionForTsError(code: string, _message: string): string {
	const suggestions: Record<string, string> = {
		TS2304: "The variable or module is not defined. Check imports and spelling.",
		TS2322: "Type mismatch. Check the expected type and provide the correct value.",
		TS2339:
			"Property does not exist on type. Check if the property name is correct or add type declaration.",
		TS2345: "Argument type is incorrect. Check function signature and argument types.",
		TS2769: "No overload matches this call. Check function arguments and types.",
		TS18048: "Variable may be undefined. Add null check or type guard.",
		TS2531: "Object is possibly null. Add null check before accessing property.",
		TS2341: "Property is private. Use a public accessor or change visibility.",
		TS2307: "Cannot find module. Check if the module is installed and import path is correct.",
	};
	return suggestions[code] || "Review the TypeScript error and fix accordingly.";
}

export interface PaimonConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	skillsDir?: string;
	memoryPath?: string;
	mode?: "chat" | "evolve";
	/** Enable context compaction for long sessions */
	compaction?: Partial<CompactionConfig> | false;
}

interface ErrorMessage {
	errorMessage?: string;
}

/**
 * Parse YAML frontmatter from a SKILL.md file
 */
function parseFrontmatter(content: string): { name?: string; description?: string } {
	let name: string | undefined;
	let description: string | undefined;

	let inFrontmatter = false;
	for (const line of content.split("\n")) {
		if (line === "---") {
			inFrontmatter = !inFrontmatter;
			continue;
		}
		if (inFrontmatter) {
			if (line.startsWith("name:")) {
				name = line.slice(5).trim();
			} else if (line.startsWith("description:")) {
				description = line.slice(12).trim();
			}
		}
	}

	return { name, description };
}

/**
 * Build a skills index from the skills directory.
 * Uses progressive disclosure: only includes name and description,
 * not full skill content. Agent loads full skill on-demand.
 */
function buildSkillsIndex(skillsDir: string): string {
	if (!existsSync(skillsDir)) return "";

	const entries = readdirSync(skillsDir, { withFileTypes: true });
	const skills: Array<{ name: string; description: string; dir: string }> = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const skillFile = join(skillsDir, entry.name, "SKILL.md");
			if (existsSync(skillFile)) {
				const content = readFileSync(skillFile, "utf-8");
				const { name, description } = parseFrontmatter(content);
				skills.push({
					name: name || entry.name,
					description: description || "No description",
					dir: entry.name,
				});
			}
		}
	}

	if (skills.length === 0) return "";

	// Generate XML format per Agent Skills standard
	let xml = "<skills>\n";
	for (const skill of skills) {
		xml += "<skill>\n";
		xml += `<name>${skill.name}</name>\n`;
		xml += `<description>${skill.description}</description>\n`;
		xml += `<path>skills/${skill.dir}/SKILL.md</path>\n`;
		xml += "</skill>\n";
	}
	xml += "</skills>";

	return xml;
}

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
				return {
					content: [{ type: "text", text: output || "(empty)" }],
					details: output || "(empty)",
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
					content: [{ type: "text", text: numbered }],
					details: numbered,
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
				return {
					content: [{ type: "text", text: output || "(no matches)" }],
					details: output || "(no matches)",
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
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<AssessmentResult>> => {
			const {
				runBuild = true,
				runTests = true,
				runLint = true,
				maxAttempts = 1,
			} = params as {
				runBuild?: boolean;
				runTests?: boolean;
				runLint?: boolean;
				maxAttempts?: number;
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
							for (const pattern of patterns.slice(0, 5)) {
								result.recommendations.push(`💡 Fix: ${pattern.suggestion}`);
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
							for (const pattern of patterns.slice(0, 5)) {
								if (pattern.type === "test") {
									result.recommendations.push(`💡 Fix: ${pattern.suggestion}`);
								}
							}
							// Merge error patterns
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
									for (const pattern of patterns.slice(0, 3)) {
										result.recommendations.push(`💡 Fix: ${pattern.suggestion}`);
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

			// Show error patterns if available
			if (result.errorPatterns && result.errorPatterns.length > 0) {
				output += "\n📋 Error Patterns Detected:\n";
				for (const pattern of result.errorPatterns.slice(0, 5)) {
					output += `  • [${pattern.type}] ${pattern.message}\n`;
					if (pattern.file) {
						output += `    File: ${pattern.file}:${pattern.line || "?"}\n`;
					}
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
];

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
	run: (prompt: string, verbose?: boolean) => Promise<string>;
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

	// Initial system prompt without compaction summary
	const systemPrompt = buildSystemPrompt(config, null);

	const agent = new Agent();
	agent.setModel(model);
	agent.setSystemPrompt(systemPrompt);
	agent.setTools(tools);

	// Provide API key dynamically for the custom provider
	agent.getApiKey = () => config.apiKey;

	const run = async (prompt: string, verbose = false): Promise<string> => {
		// Track user message
		contextManager.addMessage("user", prompt);

		// Check if compaction is needed
		if (contextManager.shouldCompact()) {
			if (verbose) {
				const status = contextManager.getStatus();
				console.log(`[Compaction] Context at ~${status.tokens} tokens, compacting...`);
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
tools: [bash, read, write, edit, glob, grep, find, ls, http, plan, assess, reflect]
---

You are Paimon, a helpful AI assistant with access to file system tools.

You can help users with various tasks like reading files, writing code, executing commands, and more.

## Tools
- bash: Execute shell commands
- read: Read a file
- write: Write a file
- edit: Edit a file by replacing text
- glob: Find files by glob pattern
- grep: Search file contents by regex pattern
- find: Find files by name, type, or modification time
- ls: List directory contents
- http: Make HTTP requests to fetch web content or call APIs
- plan: Create and manage step-by-step plans for complex tasks
- assess: Run self-assessment checks (build, tests, lint) - use before completion. Supports \`maxAttempts\` for error recovery loops.
- reflect: Analyze failures and extract lessons for MEMORY.md - use after failed assessments.

## Multi-Step Reasoning

For complex tasks, use the plan tool to:
1. **Create a plan** - Break down the task into numbered steps
2. **Work through steps** - Mark each step as 'in_progress' then 'completed'
3. **Track progress** - Use 'show' to see current status
4. **Adjust if needed** - Update or skip steps as circumstances change

Example workflow:
- \`plan({action: 'create', steps: ['Analyze requirements', 'Implement feature', 'Test changes']})\`
- \`plan({action: 'progress', stepId: 1, status: 'in_progress'})\`
- After completing: \`plan({action: 'progress', stepId: 1, status: 'completed'})\`

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

${summary ? `## Conversation Summary\n\nThe following is a summary of earlier conversation that was compacted to save context:\n\n${summary}\n\n` : ""}## Guidelines
- Be helpful, concise, and accurate
- Use tools when needed to complete tasks
- For complex tasks, create a plan first using the plan tool
- Explain what you're doing when using tools
- If something fails, explain the error and suggest solutions
- Ask for clarification if the request is unclear

When done with a task, summarize what you accomplished.`;

	// Load project context from AGENTS.md / CLAUDE.md files
	const contextContent = loadContextFiles(process.cwd());
	if (contextContent) {
		prompt += `\n\n## Project Context\n\n${contextContent}`;
	}

	// Load persistent memory
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory\n\n${memory}`;
	}

	return prompt;
}

function buildEvolvePrompt(config: PaimonConfig, summary?: string | null): string {
	let prompt = `---
name: evo
description: Self-evolving AI agent that improves its own codebase
tools: [bash, read, write, edit, glob, grep, find, ls, http, plan, assess, reflect]
---

You are evo, a self-evolving AI agent.

Your goal is to improve yourself. You can read your own code, make changes, run tests, and commit improvements.

## Tools
- bash: Execute shell commands
- read: Read a file
- write: Write a file
- edit: Edit a file by replacing text
- glob: Find files by glob pattern
- grep: Search file contents by regex pattern
- find: Find files by name, type, or modification time
- ls: List directory contents
- http: Make HTTP requests to fetch web content or call APIs
- plan: Create and manage step-by-step plans for complex tasks
- assess: Run self-assessment checks before completion. Use \`maxAttempts\` for error recovery.
- reflect: Extract lessons from failures and update MEMORY.md automatically.

## Multi-Step Reasoning

For complex evolution tasks, use the plan tool to:
1. **Create a plan** - Break down the evolution task into numbered steps
2. **Work through steps** - Mark each step as 'in_progress' then 'completed'
3. **Track progress** - Use 'show' to see current status
4. **Adjust if needed** - Update or skip steps based on verification results

Example evolution workflow:
- \`plan({action: 'create', steps: ['Read ROADMAP', 'Check issues', 'Implement feature', 'Run tests', 'Update JOURNAL']})\`
- \`plan({action: 'progress', stepId: 3, status: 'in_progress'})\`
- After tests pass: \`plan({action: 'progress', stepId: 4, status: 'completed'})\`

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

${summary ? `## Conversation Summary\n\nThe following is a summary of earlier conversation that was compacted to save context:\n\n${summary}\n\n` : ""}## Learning from Failures

When something fails (build errors, test failures, runtime errors), follow this process:

### 1. Capture the Error
- Copy the exact error message
- Note what you were trying to do
- Save the relevant context (file, line number, operation)

### 2. Root Cause Analysis
- Ask: "Why did this fail?"
- Check dependencies, types, imports, logic
- Consider edge cases you might have missed

### 3. Extract the Lesson
- What pattern does this failure reveal?
- How can you prevent this in the future?
- Is this a general principle or specific case?

### 4. Update MEMORY.md
Add a learning entry with the standard format: Date, Context, Insight, Action.

See MEMORY.md for the exact format of existing learnings.

### Common Failure Patterns to Watch For
- **TypeScript errors**: Usually missing imports, wrong types, or incorrect property access
- **Test failures**: Often edge cases or assumptions about behavior
- **Runtime hangs**: Missing timeout, infinite loop, or unresolved promise
- **API errors**: Invalid credentials, wrong endpoint, or missing error handling

## Security Awareness
Before making changes, consider:
- **Protected paths**: Never modify files in .github/workflows/ without explicit permission
- **Dangerous patterns**: Avoid eval(), exec() with user input, unescaped shell commands
- **Always test**: Run \`npm run build && npm test\` before committing
- **Minimal changes**: Make the smallest change that accomplishes the goal

## Workflow Stages

### 1. Context Gathering
- Read IDENTITY.md to understand your purpose
- Read JOURNAL.md to see what you've done
- Read MEMORY.md to recall learnings
- Read ROADMAP.md to see what's planned
- Use \`git status\` and \`git log --oneline -5\` to understand current state

### 2. Task Selection
- Check GitHub issues: \`gh issue list --state open\`
- **If issues exist**: Pick the highest priority issue
- **If no issues**: Use ROADMAP.md to pick next incomplete item from current phase
  - Phase 1: Foundation (completed)
  - Phase 2: Self-Improvement (completed)
  - Phase 3: Intelligence (current) - Better planning, Learning from failures, Code quality
  - Phase 4: Growth (future) - More tools, Multi-step reasoning, Context management
- Document your plan before implementing

### 3. Implementation
- Use \`edit\` for surgical changes (preferred)
- Use \`write\` for new files only
- Keep changes minimal and focused

### 4. Verification
- Run \`npm run build\` to check TypeScript compilation
- Run \`npm test -- --run\` to verify all tests pass
- Fix any issues

### 5. Self-Assessment (REQUIRED)
Before saying DONE, use the assess tool to evaluate your changes:
\`\`\`
assess({})
\`\`\`
This will check:
- Build passes
- Tests pass  
- Lint passes
- No security issues in changed files
- Lists changed files

**Only proceed to Completion if all checks pass.**

### 5.1 Error Recovery Loop
For complex changes, enable automatic retry loops:
\`\`\`
assess({maxAttempts: 5})  // Retry up to 5 times with error recovery
\`\`\`

The tool will:
- Extract error patterns from failures (TypeScript errors, test failures, lint issues)
- Provide actionable suggestions for each error
- Auto-fix lint issues on retry attempts
- Track attempts and progress

**Maximum 5 attempts recommended.** If still failing after retries:
1. Read the specific error patterns
2. Fix issues manually
3. Run assess again or increase maxAttempts

### 5.2 Reflection on Failures
If assessment fails after exhausting retry attempts, capture the lesson:
\`\`\`
reflect({
  taskDescription: "What you were trying to accomplish",
  errorPatterns: assessmentResult.errorPatterns  // optional, uses last assessment
})
\`\`\`

This will:
- Analyze the error patterns
- Generate a structured learning entry (Context, Insight, Action)
- Automatically append to MEMORY.md
- Help prevent similar failures in future sessions

**Always reflect after failures** - every error is a learning opportunity.

### 6. Completion
- Say "DONE" and summarize your work
- Update JOURNAL.md with what you did
- Update MEMORY.md if you learned something
- Close completed GitHub issues: \`gh issue close <number> --comment "Completed"\`
- If you completed a ROADMAP item, mark it done with \`edit\` (change \`- [ ]\` to \`- [x]\`)

## IMPORTANT
- Do NOT run git commit or git push - the evolution script handles this
- Just say "DONE" when your work is complete

## Best Practices (from Claude Code)

1. **Confidence over options**: Make decisive choices rather than presenting alternatives
2. **File references**: Include file:line references when discussing code
3. **Phased approach**: Break work into clear phases with specific tasks
4. **Error context**: When reporting errors, include relevant context
5. **Security first**: If you see dangerous patterns, warn about them

When done, say "DONE" and summarize.`;

	// Add skills index (progressive loading - only names/descriptions)
	const skillsDir = config.skillsDir || "skills";
	const skillsIndex = buildSkillsIndex(skillsDir);
	if (skillsIndex) {
		prompt += `\n\n## Skills\n${skillsIndex}\n\n**Important**: When a task matches a skill above, read it first:\n\n\`\`\`\nread skills/<name>/SKILL.md\n\`\`\`\n`;
	}

	// Load project context from AGENTS.md / CLAUDE.md files
	const contextContent = loadContextFiles(process.cwd());
	if (contextContent) {
		prompt += `\n\n## Project Context\n\n${contextContent}`;
	}

	// Load persistent memory
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory\n\n${memory}`;
	}

	return prompt;
}
