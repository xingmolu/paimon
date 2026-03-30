import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setMaxListeners } from "node:events";
import https from "node:https";
import http from "node:http";

// Increase limit to prevent MaxListeners warnings from AbortSignal in HTTP requests
setMaxListeners(100);
import {
	Agent,
	type AgentEvent,
	type AgentTool,
	type AgentToolResult,
} from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { globSync } from "glob";
import { type CompactionConfig, ContextManager } from "./compaction.js";
import { loadContextFiles } from "./context.js";
import type { SessionManager } from "./session.js";

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
			method: Type.Optional(Type.String({ description: "HTTP method (GET, POST, etc). Default: GET" })),
			headers: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "HTTP headers as key-value pairs" })),
			body: Type.Optional(Type.String({ description: "Request body (for POST, PUT, PATCH)" })),
			timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds. Default: 30000" })),
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
];

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

export function createAgent(config: PaimonConfig, sessionManager?: SessionManager): {
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
tools: [bash, read, write, edit, glob, grep, find, ls, http]
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

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

${summary ? `## Conversation Summary\n\nThe following is a summary of earlier conversation that was compacted to save context:\n\n${summary}\n\n` : ""}## Guidelines
- Be helpful, concise, and accurate
- Use tools when needed to complete tasks
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
tools: [bash, read, write, edit, glob, grep, find, ls, http]
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

### 5. Completion
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
