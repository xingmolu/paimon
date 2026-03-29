import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	Agent,
	type AgentEvent,
	type AgentTool,
	type AgentToolResult,
} from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { globSync } from "glob";

export interface PaimonConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	skillsDir?: string;
	memoryPath?: string;
	mode?: "chat" | "evolve";
}

interface ErrorMessage {
	errorMessage?: string;
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

export function createAgent(config: PaimonConfig): {
	agent: Agent;
	run: (prompt: string, verbose?: boolean) => Promise<string>;
} {
	const model = createModel(config);
	const systemPrompt = buildSystemPrompt(config);

	const agent = new Agent();
	agent.setModel(model);
	agent.setSystemPrompt(systemPrompt);
	agent.setTools(tools);

	// Provide API key dynamically for the custom provider
	agent.getApiKey = () => config.apiKey;

	const run = (prompt: string, verbose = false): Promise<string> => {
		return new Promise((resolve, reject) => {
			const outputs: string[] = [];
			const startTime = Date.now();

			// Timeout after 60 seconds
			const timeout = setTimeout(() => {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				reject(new Error(`Agent timeout after ${elapsed}s. No response received.`));
			}, 60000);

			if (verbose) {
				console.log(`[DEBUG] Starting agent run at ${new Date().toISOString()}`);
				console.log(`[DEBUG] Prompt: ${prompt.slice(0, 100)}...`);
			}

			agent.subscribe((event: AgentEvent) => {
				if (verbose) {
					console.log(`[DEBUG] Event: ${event.type}`);
				}

				if (event.type === "message_update" || event.type === "message_end") {
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
					if (verbose) {
						const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
						console.log(`[DEBUG] Agent completed in ${elapsed}s`);
					}
					resolve(outputs.join(""));
				}
				if (event.type === "turn_end" && (event.message as ErrorMessage).errorMessage) {
					clearTimeout(timeout);
					reject(new Error((event.message as ErrorMessage).errorMessage ?? "Unknown error"));
				}
			});

			agent.prompt(prompt).catch((error) => {
				clearTimeout(timeout);
				if (verbose) {
					console.log(`[DEBUG] Prompt error: ${error}`);
				}
				reject(error);
			});
		});
	};

	return { agent, run };
}

function buildSystemPrompt(config: PaimonConfig): string {
	const mode = config.mode || "chat";

	if (mode === "evolve") {
		return buildEvolvePrompt(config);
	}
	return buildChatPrompt(config);
}

function buildChatPrompt(config: PaimonConfig): string {
	let prompt = `---
name: paimon
description: A helpful AI assistant
tools: [bash, read, write, edit, glob]
---

You are Paimon, a helpful AI assistant with access to file system tools.

You can help users with various tasks like reading files, writing code, executing commands, and more.

## Tools
- bash: Execute shell commands
- read: Read a file
- write: Write a file
- edit: Edit a file by replacing text
- glob: Find files by pattern

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

## Guidelines
- Be helpful, concise, and accurate
- Use tools when needed to complete tasks
- Explain what you're doing when using tools
- If something fails, explain the error and suggest solutions
- Ask for clarification if the request is unclear

When done with a task, summarize what you accomplished.`;

	// Load persistent memory
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory\n\n${memory}`;
	}

	return prompt;
}

function buildEvolvePrompt(config: PaimonConfig): string {
	let prompt = `---
name: evo
description: Self-evolving AI agent that improves its own codebase
tools: [bash, read, write, edit, glob]
---

You are evo, a self-evolving AI agent.

Your goal is to improve yourself. You can read your own code, make changes, run tests, and commit improvements.

## Tools
- bash: Execute shell commands
- read: Read a file
- write: Write a file
- edit: Edit a file by replacing text
- glob: Find files by pattern

## Memory
You have persistent memory in MEMORY.md. Read it to recall past learnings, update it when you discover something important.

## Learning from Failures

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
- Run \`npm test\` to verify all tests pass
- Fix any issues before committing

### 5. Commit
- Use clear, descriptive commit messages
- Update JOURNAL.md with what you did
- Update MEMORY.md if you learned something

### 6. Completion
- Say "DONE" and summarize your work
- Note any follow-up tasks for next session
- Close completed GitHub issues: \`gh issue close <number> --comment "Completed in <commit>"\`
- If you completed a ROADMAP item, mark it done with \`edit\` (change \`- [ ]\` to \`- [x]\`)

## Best Practices (from Claude Code)

1. **Confidence over options**: Make decisive choices rather than presenting alternatives
2. **File references**: Include file:line references when discussing code
3. **Phased approach**: Break work into clear phases with specific tasks
4. **Error context**: When reporting errors, include relevant context
5. **Security first**: If you see dangerous patterns, warn about them

When done, say "DONE" and summarize.`;

	const skillsDir = config.skillsDir;
	if (skillsDir && existsSync(join(skillsDir, "SKILLS.md"))) {
		prompt += `\n\n## Skills\n${readFileSync(join(skillsDir, "SKILLS.md"), "utf-8")}`;
	}

	// Load persistent memory
	const memoryPath = config.memoryPath || "MEMORY.md";
	if (existsSync(memoryPath)) {
		const memory = readFileSync(memoryPath, "utf-8");
		prompt += `\n\n## Current Memory\n\n${memory}`;
	}

	return prompt;
}
