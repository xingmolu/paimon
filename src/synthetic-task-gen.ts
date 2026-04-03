/**
 * Synthetic Task Generation Module (SWE-smith Pattern)
 *
 * Generates synthetic task instances from code repositories for:
 * - Training SWE-agents
 * - Self-evolution verification
 * - Benchmark task generation
 *
 * Inspired by SWE-smith: https://github.com/SWE-bench/SWE-smith
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Task types for synthetic generation
export type SyntheticTaskType =
	| "bug-fix"
	| "feature-add"
	| "refactor"
	| "test-add"
	| "security-fix";

// Difficulty levels
export type TaskDifficulty = "easy" | "medium" | "hard";

// Category for organization
export type TaskCategory =
	| "syntax"
	| "logic"
	| "integration"
	| "performance"
	| "security"
	| "testing";

// Synthetic task instance
export interface SyntheticTask {
	id: string;
	type: SyntheticTaskType;
	difficulty: TaskDifficulty;
	category: TaskCategory;
	problemStatement: string;
	hints?: string[];
	targetFiles: string[];
	expectedChanges?: string[];
	testRequirements?: string[];
	createdAt: string;
	validated: boolean;
	metadata: {
		repository?: string;
		baseCommit?: string;
		generatedFrom?: string;
		confidence: number;
	};
}

// Generation scenario
export interface GenerationScenario {
	name: string;
	description: string;
	taskType: SyntheticTaskType;
	difficultyRange: [TaskDifficulty, TaskDifficulty];
	filePatterns: string[];
	hintTemplates: string[];
	problemTemplates: string[];
}

// Validation result
export interface ValidationResult {
	taskId: string;
	passed: boolean;
	errors: string[];
	suggestions: string[];
	complexityScore: number;
}

// Training data format
export interface TrainingData {
	tasks: SyntheticTask[];
	format: "swe-bench" | "swe-smith" | "custom";
	metadata: {
		generatedAt: string;
		totalTasks: number;
		validatedTasks: number;
		avgDifficulty: string;
	};
}

// Configuration
export interface SyntheticTaskGenConfig {
	enabled: boolean;
	maxTasksPerGeneration: number;
	defaultDifficulty: TaskDifficulty;
	validateGenerated: boolean;
	outputDir: string;
	repositoryContext: boolean;
}

// Statistics
export interface SyntheticTaskGenStats {
	totalGenerated: number;
	byType: Record<SyntheticTaskType, number>;
	byDifficulty: Record<TaskDifficulty, number>;
	validatedTasks: number;
	validationPassRate: number;
	avgConfidence: number;
	lastGeneration: string | null;
}

// Default configuration
const DEFAULT_CONFIG: SyntheticTaskGenConfig = {
	enabled: true,
	maxTasksPerGeneration: 10,
	defaultDifficulty: "medium",
	validateGenerated: true,
	outputDir: "~/.paimon/synthetic-tasks",
	repositoryContext: true,
};

// Default scenarios
const DEFAULT_SCENARIOS: GenerationScenario[] = [
	{
		name: "simple-bug-fix",
		description: "Generate simple bug fix tasks from code patterns",
		taskType: "bug-fix",
		difficultyRange: ["easy", "medium"],
		filePatterns: ["src/**/*.ts", "src/**/*.js"],
		hintTemplates: [
			"Check the error handling in {function}",
			"Look for missing null checks in {file}",
			"Verify the return value of {method}",
		],
		problemTemplates: [
			"Fix the bug in {file} where {function} fails to handle {condition}",
			"The function {function} in {file} throws an error when {scenario}",
		],
	},
	{
		name: "feature-extension",
		description: "Generate feature addition tasks",
		taskType: "feature-add",
		difficultyRange: ["medium", "hard"],
		filePatterns: ["src/**/*.ts", "src/**/*.js"],
		hintTemplates: [
			"Extend {class} to support {feature}",
			"Add a new method to {interface}",
			"Implement {functionality} in {module}",
		],
		problemTemplates: [
			"Add support for {feature} in {file}",
			"Extend {class} to include {capability}",
		],
	},
	{
		name: "code-refactor",
		description: "Generate refactoring tasks",
		taskType: "refactor",
		difficultyRange: ["medium", "hard"],
		filePatterns: ["src/**/*.ts"],
		hintTemplates: [
			"Refactor {function} to reduce complexity",
			"Extract common logic from {methods}",
			"Simplify the conditional in {function}",
		],
		problemTemplates: [
			"Refactor {file} to improve code quality",
			"Reduce complexity of {function} in {file}",
		],
	},
	{
		name: "test-coverage",
		description: "Generate test addition tasks",
		taskType: "test-add",
		difficultyRange: ["easy", "medium"],
		filePatterns: ["src/**/*.ts", "tests/**/*.ts"],
		hintTemplates: [
			"Add tests for {function}",
			"Create test cases for {scenario}",
			"Improve coverage for {module}",
		],
		problemTemplates: [
			"Add unit tests for {function} in {file}",
			"Create test cases covering {scenario}",
		],
	},
	{
		name: "security-vulnerability",
		description: "Generate security fix tasks",
		taskType: "security-fix",
		difficultyRange: ["medium", "hard"],
		filePatterns: ["src/**/*.ts", "src/**/*.js"],
		hintTemplates: [
			"Fix potential injection in {function}",
			"Add input validation to {method}",
			"Sanitize user input in {handler}",
		],
		problemTemplates: [
			"Fix security vulnerability in {file}",
			"Add input validation to prevent {vulnerability}",
		],
	},
];

/**
 * Synthetic Task Generator Manager
 */
export class SyntheticTaskGenerator {
	private config: SyntheticTaskGenConfig;
	private stats: SyntheticTaskGenStats;
	private generatedTasks: Map<string, SyntheticTask> = new Map();
	private scenarios: GenerationScenario[] = DEFAULT_SCENARIOS;
	private configPath: string;
	private statsPath: string;
	private tasksPath: string;

	constructor(configPath?: string) {
		const baseDir = path.join(process.env.HOME || "~", ".paimon");
		this.configPath = configPath || path.join(baseDir, "synthetic-task-gen-config.json");
		this.statsPath = path.join(baseDir, "synthetic-task-gen-stats.json");
		this.tasksPath = path.join(baseDir, "synthetic-tasks.json");

		this.config = this.loadConfig();
		this.stats = this.loadStats();
		this.loadGeneratedTasks();
	}

	private loadConfig(): SyntheticTaskGenConfig {
		try {
			if (fs.existsSync(this.configPath)) {
				const data = fs.readFileSync(this.configPath, "utf-8");
				return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
			}
		} catch {
			// Use defaults
		}
		return DEFAULT_CONFIG;
	}

	private loadStats(): SyntheticTaskGenStats {
		try {
			if (fs.existsSync(this.statsPath)) {
				const data = fs.readFileSync(this.statsPath, "utf-8");
				return JSON.parse(data);
			}
		} catch {
			// Use defaults
		}
		return {
			totalGenerated: 0,
			byType: {
				"bug-fix": 0,
				"feature-add": 0,
				refactor: 0,
				"test-add": 0,
				"security-fix": 0,
			},
			byDifficulty: {
				easy: 0,
				medium: 0,
				hard: 0,
			},
			validatedTasks: 0,
			validationPassRate: 0,
			avgConfidence: 0,
			lastGeneration: null,
		};
	}

	private loadGeneratedTasks(): void {
		try {
			if (fs.existsSync(this.tasksPath)) {
				const data = fs.readFileSync(this.tasksPath, "utf-8");
				const tasks: SyntheticTask[] = JSON.parse(data);
				for (const task of tasks) {
					this.generatedTasks.set(task.id, task);
				}
			}
		} catch {
			// No tasks loaded
		}
	}

	private saveConfig(): void {
		try {
			const dir = path.dirname(this.configPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
		} catch (e) {
			console.error("Failed to save config:", e);
		}
	}

	private saveStats(): void {
		try {
			const dir = path.dirname(this.statsPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
		} catch (e) {
			console.error("Failed to save stats:", e);
		}
	}

	private saveTasks(): void {
		try {
			const dir = path.dirname(this.tasksPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			const tasks = Array.from(this.generatedTasks.values());
			fs.writeFileSync(this.tasksPath, JSON.stringify(tasks, null, 2));
		} catch (e) {
			console.error("Failed to save tasks:", e);
		}
	}

	private generateId(): string {
		return `synth-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	/**
	 * Generate synthetic tasks from code analysis
	 */
	generate(
		type?: SyntheticTaskType,
		difficulty?: TaskDifficulty,
		count?: number,
		repository?: string,
	): SyntheticTask[] {
		const tasks: SyntheticTask[] = [];
		const targetType = type || (this.config.defaultDifficulty as SyntheticTaskType); // Use 'bug-fix' as default
		const targetDifficulty = difficulty || this.config.defaultDifficulty;
		const targetCount = Math.min(
			count || this.config.maxTasksPerGeneration,
			this.config.maxTasksPerGeneration,
		);

		// Find matching scenarios
		const matchingScenarios = this.scenarios.filter((s) => !type || s.taskType === type);

		for (let i = 0; i < targetCount; i++) {
			const scenario = matchingScenarios[i % matchingScenarios.length];
			const task = this.generateFromScenario(scenario, targetDifficulty, repository);
			if (task) {
				tasks.push(task);
				this.generatedTasks.set(task.id, task);
			}
		}

		// Update stats
		this.stats.totalGenerated += tasks.length;
		this.stats.lastGeneration = new Date().toISOString();
		for (const task of tasks) {
			this.stats.byType[task.type]++;
			this.stats.byDifficulty[task.difficulty]++;
		}

		// Calculate average confidence
		const totalConfidence = tasks.reduce((sum, t) => sum + t.metadata.confidence, 0);
		this.stats.avgConfidence = totalConfidence / tasks.length;

		this.saveStats();
		this.saveTasks();

		return tasks;
	}

	private generateFromScenario(
		scenario: GenerationScenario,
		difficulty: TaskDifficulty,
		repository?: string,
	): SyntheticTask | null {
		const id = this.generateId();

		// Generate problem statement from template
		const templateIdx = Math.floor(Math.random() * scenario.problemTemplates.length);
		let problem = scenario.problemTemplates[templateIdx];

		// Fill in placeholders with realistic values
		const placeholders: Record<string, string> = {
			"{file}": this.pickRandomFile(scenario.filePatterns),
			"{function}": this.generateFunctionName(),
			"{class}": this.generateClassName(),
			"{method}": this.generateMethodName(),
			"{module}": this.generateModuleName(),
			"{interface}": this.generateInterfaceName(),
			"{condition}": this.generateCondition(),
			"{scenario}": this.generateScenario(scenario.taskType),
			"{feature}": this.generateFeatureName(),
			"{capability}": this.generateCapability(),
			"{functionality}": this.generateFunctionality(),
			"{vulnerability}": this.generateVulnerability(),
		};

		for (const [key, value] of Object.entries(placeholders)) {
			problem = problem.replace(key, value);
		}

		// Generate hints
		const hints = scenario.hintTemplates.slice(0, 2).map((h) => {
			let hint = h;
			for (const [key, value] of Object.entries(placeholders)) {
				hint = hint.replace(key, value);
			}
			return hint;
		});

		// Determine category based on task type
		const categoryMap: Record<SyntheticTaskType, TaskCategory> = {
			"bug-fix": "logic",
			"feature-add": "integration",
			refactor: "performance",
			"test-add": "testing",
			"security-fix": "security",
		};

		return {
			id,
			type: scenario.taskType,
			difficulty,
			category: categoryMap[scenario.taskType],
			problemStatement: problem,
			hints,
			targetFiles: [placeholders["{file}"]],
			createdAt: new Date().toISOString(),
			validated: false,
			metadata: {
				repository,
				generatedFrom: scenario.name,
				confidence: this.calculateConfidence(scenario, difficulty),
			},
		};
	}

	private pickRandomFile(patterns: string[]): string {
		const genericFiles = [
			"src/agent.ts",
			"src/tools/index.ts",
			"src/hooks.ts",
			"src/memory.ts",
			"src/truncate.ts",
			"src/wrap.ts",
			"src/prompt.ts",
		];
		return genericFiles[Math.floor(Math.random() * genericFiles.length)];
	}

	private generateFunctionName(): string {
		const names = [
			"processMessage",
			"executeTool",
			"handleError",
			"validateInput",
			"parseResponse",
			"formatOutput",
		];
		return names[Math.floor(Math.random() * names.length)];
	}

	private generateClassName(): string {
		const names = ["Agent", "ToolManager", "MemoryStore", "HookExecutor", "ContextHandler"];
		return names[Math.floor(Math.random() * names.length)];
	}

	private generateMethodName(): string {
		const names = ["run", "execute", "process", "validate", "transform", "load"];
		return names[Math.floor(Math.random() * names.length)];
	}

	private generateModuleName(): string {
		const names = ["tools", "hooks", "memory", "context", "validation"];
		return names[Math.floor(Math.random() * names.length)];
	}

	private generateInterfaceName(): string {
		const names = ["Tool", "Hook", "Memory", "Config", "Result", "Handler"];
		return names[Math.floor(Math.random() * names.length)];
	}

	private generateCondition(): string {
		const conditions = [
			"null input",
			"empty array",
			"invalid type",
			"missing property",
			"out of range",
		];
		return conditions[Math.floor(Math.random() * conditions.length)];
	}

	private generateScenario(type: SyntheticTaskType): string {
		const scenarios: Record<SyntheticTaskType, string[]> = {
			"bug-fix": [
				"edge cases are not handled",
				"error is silently ignored",
				"return value is incorrect",
			],
			"feature-add": [
				"new configuration options",
				"additional output formats",
				"extended API support",
			],
			refactor: ["complex conditional logic", "repeated code patterns", "deep nesting"],
			"test-add": ["boundary conditions", "error scenarios", "integration paths"],
			"security-fix": [
				"user input reaches sensitive function",
				"unvalidated data flows to output",
				"credentials in logs",
			],
		};
		return scenarios[type][Math.floor(Math.random() * scenarios[type].length)];
	}

	private generateFeatureName(): string {
		const features = [
			"async processing",
			"batch operations",
			"caching",
			"rate limiting",
			"logging",
		];
		return features[Math.floor(Math.random() * features.length)];
	}

	private generateCapability(): string {
		const caps = [
			"streaming",
			"progress tracking",
			"cancelation",
			"retry logic",
			"timeout handling",
		];
		return caps[Math.floor(Math.random() * caps.length)];
	}

	private generateFunctionality(): string {
		const funcs = [
			"configuration validation",
			"error aggregation",
			"output formatting",
			"state persistence",
		];
		return funcs[Math.floor(Math.random() * funcs.length)];
	}

	private generateVulnerability(): string {
		const vulns = [
			"command injection",
			"path traversal",
			"XSS",
			"SQL injection",
			"information disclosure",
		];
		return vulns[Math.floor(Math.random() * vulns.length)];
	}

	private calculateConfidence(scenario: GenerationScenario, difficulty: TaskDifficulty): number {
		// Base confidence from scenario quality
		let confidence = 70;

		// Adjust based on difficulty (easier tasks are more predictable)
		if (difficulty === "easy") confidence += 15;
		if (difficulty === "hard") confidence -= 10;

		// Adjust based on template quality (more templates = more variety)
		confidence += Math.min(scenario.problemTemplates.length * 2, 10);

		return Math.min(Math.max(confidence, 50), 95);
	}

	/**
	 * Validate a generated task
	 */
	validate(taskId: string): ValidationResult {
		const task = this.generatedTasks.get(taskId);
		if (!task) {
			return {
				taskId,
				passed: false,
				errors: ["Task not found"],
				suggestions: [],
				complexityScore: 0,
			};
		}

		const errors: string[] = [];
		const suggestions: string[] = [];
		let complexityScore = 0;

		// Check problem statement quality
		if (task.problemStatement.length < 20) {
			errors.push("Problem statement too short");
		}
		if (
			!task.problemStatement.includes("Fix") &&
			!task.problemStatement.includes("Add") &&
			!task.problemStatement.includes("Refactor") &&
			!task.problemStatement.includes("Create")
		) {
			suggestions.push("Consider making problem statement more actionable");
		}

		// Check target files
		if (task.targetFiles.length === 0) {
			errors.push("No target files specified");
		}

		// Check hints
		if (!task.hints || task.hints.length === 0) {
			suggestions.push("Add hints for better guidance");
		}

		// Calculate complexity based on task type and difficulty
		const complexityMap: Record<SyntheticTaskType, number> = {
			"bug-fix": 3,
			"feature-add": 5,
			refactor: 4,
			"test-add": 2,
			"security-fix": 6,
		};
		const difficultyMultiplier: Record<TaskDifficulty, number> = {
			easy: 1,
			medium: 2,
			hard: 3,
		};
		complexityScore = complexityMap[task.type] * difficultyMultiplier[task.difficulty];

		const passed = errors.length === 0;

		// Update task validation status
		task.validated = passed;

		// Update stats
		this.stats.validatedTasks++;
		if (passed) {
			const passedCount = this.stats.validatedTasks * this.stats.validationPassRate + 1;
			this.stats.validationPassRate = passedCount / this.stats.validatedTasks;
		} else {
			this.stats.validationPassRate =
				(this.stats.validatedTasks * this.stats.validationPassRate) / this.stats.validatedTasks;
		}

		this.saveStats();
		this.saveTasks();

		return {
			taskId,
			passed,
			errors,
			suggestions,
			complexityScore,
		};
	}

	/**
	 * Get available generation scenarios
	 */
	getScenarios(): GenerationScenario[] {
		return this.scenarios;
	}

	/**
	 * Add a custom scenario
	 */
	addScenario(scenario: GenerationScenario): void {
		this.scenarios.push(scenario);
	}

	/**
	 * Get generated tasks
	 */
	getTasks(type?: SyntheticTaskType, validated?: boolean): SyntheticTask[] {
		let tasks = Array.from(this.generatedTasks.values());

		if (type) {
			tasks = tasks.filter((t) => t.type === type);
		}

		if (validated !== undefined) {
			tasks = tasks.filter((t) => t.validated === validated);
		}

		return tasks;
	}

	/**
	 * Get specific task
	 */
	getTask(taskId: string): SyntheticTask | undefined {
		return this.generatedTasks.get(taskId);
	}

	/**
	 * Export training data in various formats
	 */
	exportTrainingData(format: "swe-bench" | "swe-smith" | "custom" = "swe-bench"): TrainingData {
		const tasks = Array.from(this.generatedTasks.values()).filter((t) => t.validated);

		return {
			tasks,
			format,
			metadata: {
				generatedAt: new Date().toISOString(),
				totalTasks: tasks.length,
				validatedTasks: tasks.filter((t) => t.validated).length,
				avgDifficulty: this.calculateAverageDifficulty(tasks),
			},
		};
	}

	private calculateAverageDifficulty(tasks: SyntheticTask[]): string {
		const counts: Record<TaskDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
		for (const t of tasks) {
			counts[t.difficulty]++;
		}

		const total = tasks.length;
		if (total === 0) return "unknown";

		const avg = (counts.easy * 1 + counts.medium * 2 + counts.hard * 3) / total;
		if (avg < 1.5) return "easy";
		if (avg < 2.5) return "medium";
		return "hard";
	}

	/**
	 * Get configuration
	 */
	getConfig(): SyntheticTaskGenConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<SyntheticTaskGenConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveConfig();
	}

	/**
	 * Get statistics
	 */
	getStats(): SyntheticTaskGenStats {
		return { ...this.stats };
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			totalGenerated: 0,
			byType: {
				"bug-fix": 0,
				"feature-add": 0,
				refactor: 0,
				"test-add": 0,
				"security-fix": 0,
			},
			byDifficulty: {
				easy: 0,
				medium: 0,
				hard: 0,
			},
			validatedTasks: 0,
			validationPassRate: 0,
			avgConfidence: 0,
			lastGeneration: null,
		};
		this.saveStats();
	}

	/**
	 * Clear generated tasks
	 */
	clearTasks(): void {
		this.generatedTasks.clear();
		this.saveTasks();
	}

	/**
	 * Remove specific task
	 */
	removeTask(taskId: string): boolean {
		const existed = this.generatedTasks.has(taskId);
		this.generatedTasks.delete(taskId);
		this.saveTasks();
		return existed;
	}
}

// Singleton instance
let generatorInstance: SyntheticTaskGenerator | null = null;

export function getSyntheticTaskGenerator(): SyntheticTaskGenerator {
	if (!generatorInstance) {
		generatorInstance = new SyntheticTaskGenerator();
	}
	return generatorInstance;
}

/**
 * Tool function for synthetic task generation
 */
export function syntheticTaskGenTool(args: {
	action:
		| "generate"
		| "validate"
		| "scenarios"
		| "tasks"
		| "task"
		| "export"
		| "config"
		| "stats"
		| "reset"
		| "clear"
		| "add-scenario"
		| "remove";
	type?: SyntheticTaskType;
	difficulty?: TaskDifficulty;
	count?: number;
	repository?: string;
	taskId?: string;
	format?: "swe-bench" | "swe-smith" | "custom";
	validated?: boolean;
	scenario?: GenerationScenario;
	config?: Partial<SyntheticTaskGenConfig>;
}): string {
	const generator = getSyntheticTaskGenerator();

	switch (args.action) {
		case "generate": {
			const tasks = generator.generate(args.type, args.difficulty, args.count, args.repository);
			return `Generated ${tasks.length} synthetic tasks:\n${tasks
				.map(
					(t) => `- ${t.id}: ${t.type} (${t.difficulty}) - ${t.problemStatement.slice(0, 50)}...`,
				)
				.join("\n")}`;
		}

		case "validate": {
			if (!args.taskId) return "Error: taskId required for validate action";
			const result = generator.validate(args.taskId);
			return `Validation result for ${args.taskId}:\n- Passed: ${result.passed}\n- Errors: ${result.errors.join(", ") || "none"}\n- Suggestions: ${result.suggestions.join(", ") || "none"}\n- Complexity Score: ${result.complexityScore}`;
		}

		case "scenarios": {
			const scenarios = generator.getScenarios();
			return `Available generation scenarios (${scenarios.length}):\n${scenarios
				.map((s) => `- ${s.name}: ${s.description} (${s.taskType}, ${s.difficultyRange.join("-")})`)
				.join("\n")}`;
		}

		case "tasks": {
			const allTasks = generator.getTasks(args.type, args.validated);
			return `Generated tasks (${allTasks.length}):\n${allTasks
				.slice(0, 20)
				.map(
					(t) =>
						`- ${t.id}: ${t.type} (${t.difficulty}) - ${t.validated ? "validated" : "unvalidated"}`,
				)
				.join("\n")}${allTasks.length > 20 ? `\n... and ${allTasks.length - 20} more` : ""}`;
		}

		case "task": {
			if (!args.taskId) return "Error: taskId required for task action";
			const task = generator.getTask(args.taskId);
			if (!task) return `Task ${args.taskId} not found`;
			return `Task ${args.taskId}:\n- Type: ${task.type}\n- Difficulty: ${task.difficulty}\n- Category: ${task.category}\n- Problem: ${task.problemStatement}\n- Hints: ${task.hints?.join(", ") || "none"}\n- Target Files: ${task.targetFiles.join(", ")}\n- Validated: ${task.validated}\n- Confidence: ${task.metadata.confidence}`;
		}

		case "export": {
			const trainingData = generator.exportTrainingData(args.format || "swe-bench");
			return `Training data exported (${trainingData.format}):\n- Total Tasks: ${trainingData.metadata.totalTasks}\n- Validated: ${trainingData.metadata.validatedTasks}\n- Avg Difficulty: ${trainingData.metadata.avgDifficulty}`;
		}

		case "config": {
			if (args.config) {
				generator.updateConfig(args.config);
				return `Configuration updated: ${JSON.stringify(args.config)}`;
			}
			return `Current configuration:\n${JSON.stringify(generator.getConfig(), null, 2)}`;
		}

		case "stats":
			return `Generation statistics:\n- Total Generated: ${generator.getStats().totalGenerated}\n- By Type: ${JSON.stringify(generator.getStats().byType)}\n- By Difficulty: ${JSON.stringify(generator.getStats().byDifficulty)}\n- Validated: ${generator.getStats().validatedTasks}\n- Pass Rate: ${(generator.getStats().validationPassRate * 100).toFixed(1)}%\n- Avg Confidence: ${generator.getStats().avgConfidence.toFixed(1)}\n- Last Generation: ${generator.getStats().lastGeneration || "never"}`;

		case "reset":
			generator.resetStats();
			return "Statistics reset to zero";

		case "clear":
			generator.clearTasks();
			return "All generated tasks cleared";

		case "add-scenario": {
			if (!args.scenario) return "Error: scenario required for add-scenario action";
			generator.addScenario(args.scenario);
			return `Scenario added: ${args.scenario.name}`;
		}

		case "remove": {
			if (!args.taskId) return "Error: taskId required for remove action";
			const removed = generator.removeTask(args.taskId);
			return removed ? `Task ${args.taskId} removed` : `Task ${args.taskId} not found`;
		}

		default:
			return `Unknown action: ${args.action}. Available actions: generate, validate, scenarios, tasks, task, export, config, stats, reset, clear, add-scenario, remove`;
	}
}
