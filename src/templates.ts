/**
 * Template System - Inspired by Mini-SWE-Agent Jinja-style templates
 *
 * Simple template engine for prompt customization with variable substitution.
 * Uses {{ variable }} syntax for placeholders, keeping it minimal and efficient.
 *
 * Key features:
 * 1. Template files with {{ variable }} placeholders
 * 2. Variable substitution with default values
 * 3. Template loading from files or strings
 * 4. Works with minimal and full agent modes
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Template variable definition
 */
export interface TemplateVariable {
	/** Variable name (used as {{ name }} in template) */
	name: string;
	/** Default value if not provided */
	default?: string;
	/** Description for documentation */
	description?: string;
}

/**
 * Template configuration
 */
export interface TemplateConfig {
	/** Template path (file) or template string */
	template: string;
	/** Variables to substitute */
	variables?: Record<string, string>;
	/** Use file template (true) or inline template (false) */
	isFile?: boolean;
}

/**
 * Default template variables for minimal agent
 */
export const DEFAULT_MINIMAL_VARS: TemplateVariable[] = [
	{ name: "agent_name", default: "minimal-agent", description: "Agent name in frontmatter" },
	{
		name: "agent_description",
		default: "A simple AI agent that solves problems using only shell commands",
		description: "Agent description",
	},
	{ name: "max_iterations", default: "50", description: "Maximum iterations allowed" },
	{ name: "timeout", default: "120000", description: "Timeout in milliseconds" },
	{ name: "model", default: "unknown", description: "Model being used" },
];

/**
 * Default template variables for baseline agent
 */
export const DEFAULT_BASELINE_VARS: TemplateVariable[] = [
	{ name: "agent_name", default: "baseline-agent", description: "Agent name for RL experiments" },
	{ name: "model", default: "unknown", description: "Model being used" },
];

/**
 * Render a template with variable substitution
 *
 * Supports:
 * - {{ variable }} - Required variable (error if missing)
 * - {{ variable|default }} - Variable with default value
 * - {{ variable:default }} - Alternative syntax for default
 */
export function renderTemplate(template: string, variables: Record<string, string> = {}): string {
	// Pattern matches: {{ name }}, {{ name|default }}, {{ name:default }}
	const pattern = /\{\{\s*(\w+)(?:\|([^}]+)|:([^}]+))?\s*\}\}/g;

	return template.replace(pattern, (match, name, pipeDefault, colonDefault) => {
		// Check if variable is provided
		if (variables[name] !== undefined) {
			return variables[name];
		}

		// Check for default value (pipe or colon syntax)
		const defaultVal = pipeDefault || colonDefault;
		if (defaultVal !== undefined) {
			return defaultVal.trim();
		}

		// No value and no default - keep placeholder for visibility
		return match;
	});
}

/**
 * Load template from file
 *
 * @param path Template file path (relative or absolute)
 * @param baseDir Base directory for relative paths (defaults to cwd)
 */
export function loadTemplateFile(path: string, baseDir?: string): string {
	const fullPath = baseDir ? resolve(baseDir, path) : resolve(path);

	if (!existsSync(fullPath)) {
		throw new Error(`Template file not found: ${fullPath}`);
	}

	return readFileSync(fullPath, "utf-8");
}

/**
 * Load and render template from file
 */
export function renderTemplateFile(
	path: string,
	variables: Record<string, string> = {},
	baseDir?: string,
): string {
	const template = loadTemplateFile(path, baseDir);
	return renderTemplate(template, variables);
}

/**
 * Get default minimal agent template
 */
export function getDefaultMinimalTemplate(): string {
	return `---
name: {{ agent_name }}
description: {{ agent_description }}
tools: [bash]
---

You are a minimal AI agent that solves problems using only bash commands.

## Available Commands
You have access to a single tool: bash. Use it for ALL operations:
- Read files: \`cat filename\` or \`head -n filename\`
- Write files: \`echo 'content' > filename\` or \`cat > filename << 'EOF'\ncontent\nEOF\`
- Edit files: \`sed -i 's/old/new/g' filename\`
- Search files: \`grep -r 'pattern' .\` or \`find . -name '*.ts'\`
- List files: \`ls -la\` or \`find . -type f\`
- Run tests: \`npm test\` or \`npm run build\`
- Check git: \`git status\` or \`git log\`

## Configuration
- Max iterations: {{ max_iterations }}
- Timeout: {{ timeout }}ms
- Model: {{ model }}

## Workflow
1. Understand the task
2. Explore the codebase with shell commands
3. Make changes using sed/echo/cat
4. Verify with npm run build && npm test
5. Report results

## Rules
- One command at a time
- Always verify changes before claiming completion
- Report errors clearly
- Keep changes minimal

When done, say "DONE" and summarize what you accomplished.`;
}

/**
 * Get baseline agent template for RL/fine-tuning experiments
 */
export function getBaselineTemplate(): string {
	return `---
name: {{ agent_name }}
description: Minimal agent for RL experiments
tools: [bash]
---

You are a baseline AI agent. Solve problems using bash commands.

## Tool
Use bash for: cat (read), echo (write), sed (edit), grep (search), ls (list).

## Model
Running on: {{ model }}

## Rules
1. Explore first
2. Make minimal changes
3. Verify with npm run build && npm test

When complete, say "DONE".`;
}

/**
 * Get full agent template (for createAgent)
 */
export function getFullAgentTemplate(): string {
	return `---
name: {{ agent_name }}
description: {{ agent_description }}
tools: [bash, read, write, edit, glob, grep, find, ls, http, plan, assess, reflect, checkpoint, parallel, hook, stuck, repomap, tom]
---

You are {{ agent_name }}.

## Tools
- bash: Execute shell commands
- read: Read files
- write: Write/create files
- edit: Edit files by replacing text
- glob: Find files matching patterns
- grep: Search file contents
- find: Find files by name/type
- ls: List directory contents
- http: Make HTTP requests
- plan: Create step-by-step plans
- assess: Self-assessment before completion
- reflect: Learn from failures
- checkpoint: Save/restore snapshots
- parallel: Run tasks concurrently
- hook: Safety checks before tool execution
- stuck: Detect loops and recover
- repomap: Generate codebase maps
- tom: Get personalized guidance

## Configuration
- Model: {{ model }}

## Workflow
1. Gather context (read memory, roadmap, journal)
2. Plan approach
3. Implement minimal changes
4. Verify with assess
5. Update memory and journal

When done, say "DONE".`;
}

/**
 * Template manager class for managing multiple templates
 */
export class TemplateManager {
	private templates: Map<string, string> = new Map();
	private baseDir?: string;

	constructor(baseDir?: string) {
		this.baseDir = baseDir;

		// Register default templates
		this.register("minimal", getDefaultMinimalTemplate());
		this.register("baseline", getBaselineTemplate());
		this.register("full", getFullAgentTemplate());
	}

	/**
	 * Register a template by name
	 */
	register(name: string, template: string): void {
		this.templates.set(name, template);
	}

	/**
	 * Register a template from file
	 */
	registerFile(name: string, path: string): void {
		const template = loadTemplateFile(path, this.baseDir);
		this.templates.set(name, template);
	}

	/**
	 * Get template by name
	 */
	get(name: string): string | undefined {
		return this.templates.get(name);
	}

	/**
	 * Render a registered template
	 */
	render(name: string, variables: Record<string, string> = {}): string {
		const template = this.templates.get(name);
		if (!template) {
			throw new Error(`Template not found: ${name}`);
		}
		return renderTemplate(template, variables);
	}

	/**
	 * List registered templates
	 */
	list(): string[] {
		return Array.from(this.templates.keys());
	}
}
