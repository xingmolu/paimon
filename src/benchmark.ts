/**
 * Benchmark Integration Module
 *
 * SWE-bench inspired benchmark system for evaluating self-evolution capabilities.
 * Provides standardized task definitions, execution, and evaluation.
 *
 * Inspired by:
 * - SWE-bench (princeton-nlp/SWE-bench): Standardized benchmark format
 * - Mini-SWE-Agent: Benchmark evaluation mode
 * - OpenHands: Evaluation framework
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// Interfaces
// ============================================================================

/**
 * SWE-bench compatible task definition
 */
export interface BenchmarkTask {
	/** Unique task identifier */
	instance_id: string;
	/** Problem description/statement */
	problem_statement: string;
	/** Repository URL or path */
	repo: string;
	/** Base commit to start from */
	base_commit: string;
	/** Optional hints for the task */
	hints_text?: string;
	/** Creation timestamp */
	created_at?: string;
	/** Version identifier */
	version?: string;
	/** Optional gold patch for validation */
	patch?: string;
	/** Test file paths */
	test_patch?: string;
	/** Expected test outcomes */
	test_result?: string;
	/** Difficulty level */
	difficulty?: "easy" | "medium" | "hard";
	/** Category/tags */
	category?: string[];
}

/**
 * Result of running a benchmark task
 */
export interface BenchmarkResult {
	/** Task identifier */
	instance_id: string;
	/** Whether the task was completed successfully */
	success: boolean;
	/** Generated patch/solution */
	patch?: string;
	/** Test pass rate */
	test_pass_rate?: number;
	/** Time taken in minutes */
	time_minutes: number;
	/** Error messages if failed */
	errors?: string[];
	/** Files changed */
	files_changed?: string[];
	/** Solution quality score (0-100) */
	quality_score?: number;
	/** Timestamp */
	timestamp: string;
}

/**
 * Configuration for benchmark run
 */
export interface BenchmarkConfig {
	/** Tasks file path (JSON) */
	tasksFile?: string;
	/** Filter tasks by category */
	categoryFilter?: string[];
	/** Filter tasks by difficulty */
	difficultyFilter?: string[];
	/** Maximum tasks to run */
	maxTasks?: number;
	/** Timeout per task in minutes */
	timeoutMinutes?: number;
	/** Whether to run tests after solving */
	runTests?: boolean;
	/** Whether to validate against gold patch */
	validatePatch?: boolean;
	/** Output directory for results */
	outputDir?: string;
	/** Save intermediate results */
	saveIntermediate?: boolean;
	/** Stop on first failure */
	stopOnFailure?: boolean;
}

/**
 * Statistics from benchmark run
 */
export interface BenchmarkStats {
	/** Total tasks run */
	totalTasks: number;
	/** Successful completions */
	successful: number;
	/** Failed completions */
	failed: number;
	/** Pass rate percentage */
	passRate: number;
	/** Average time per task */
	averageTime: number;
	/** Average quality score */
	averageQuality: number;
	/** Error breakdown */
	errorsByType: Record<string, number>;
	/** Results by difficulty */
	byDifficulty: Record<string, { total: number; success: number }>;
	/** Results by category */
	byCategory: Record<string, { total: number; success: number }>;
}

// ============================================================================
// Benchmark Runner Class
// ============================================================================

/**
 * Benchmark runner for evaluating self-evolution capabilities
 */
export class BenchmarkRunner {
	private tasks: BenchmarkTask[] = [];
	private results: BenchmarkResult[] = [];
	private config: BenchmarkConfig = {};

	constructor(config: BenchmarkConfig = {}) {
		this.config = config;
	}

	/**
	 * Load tasks from a JSON file (SWE-bench format)
	 */
	loadTasks(filePath: string): number {
		try {
			const content = fs.readFileSync(filePath, "utf-8");
			const tasks = JSON.parse(content);

			// Handle both array and object formats
			if (Array.isArray(tasks)) {
				this.tasks = tasks;
			} else if (tasks.tasks && Array.isArray(tasks.tasks)) {
				this.tasks = tasks.tasks;
			} else {
				this.tasks = [tasks];
			}

			// Apply filters
			this.applyFilters();

			return this.tasks.length;
		} catch (error) {
			throw new Error(
				`Failed to load tasks from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Load tasks from directory (multiple JSON files)
	 */
	loadTasksFromDir(dirPath: string): number {
		try {
			const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
			let total = 0;

			for (const file of files) {
				const filePath = path.join(dirPath, file);
				total += this.loadTasks(filePath);
			}

			return total;
		} catch (error) {
			throw new Error(
				`Failed to load tasks from directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Add a single task programmatically
	 */
	addTask(task: BenchmarkTask): void {
		this.tasks.push(task);
	}

	/**
	 * Apply category and difficulty filters
	 */
	private applyFilters(): void {
		const categoryFilter = this.config.categoryFilter;
		if (categoryFilter && categoryFilter.length > 0) {
			this.tasks = this.tasks.filter((t) => t.category?.some((c) => categoryFilter.includes(c)));
		}

		const difficultyFilter = this.config.difficultyFilter;
		if (difficultyFilter && difficultyFilter.length > 0) {
			this.tasks = this.tasks.filter(
				(t) => t.difficulty && difficultyFilter.includes(t.difficulty),
			);
		}

		if (this.config.maxTasks && this.tasks.length > this.config.maxTasks) {
			this.tasks = this.tasks.slice(0, this.config.maxTasks);
		}
	}

	/**
	 * Get loaded tasks
	 */
	getTasks(): BenchmarkTask[] {
		return this.tasks;
	}

	/**
	 * Simulate running a benchmark task
	 * (In real implementation, this would call the evolution SDK)
	 */
	async runTask(task: BenchmarkTask): Promise<BenchmarkResult> {
		const startTime = Date.now();

		// Placeholder implementation
		// In production, this would:
		// 1. Clone/set up the repository at base_commit
		// 2. Run evolution to solve the problem_statement
		// 3. Validate the solution against patch or tests

		const result: BenchmarkResult = {
			instance_id: task.instance_id,
			success: false,
			time_minutes: 0,
			timestamp: new Date().toISOString(),
			errors: [],
		};

		// Simulate task execution
		const elapsedMs = Date.now() - startTime;
		result.time_minutes = elapsedMs / 60000;

		this.results.push(result);
		return result;
	}

	/**
	 * Run all loaded tasks
	 */
	async runAll(): Promise<BenchmarkStats> {
		const startTime = Date.now();
		let failed = 0;

		for (const task of this.tasks) {
			try {
				const result = await this.runTask(task);

				if (!result.success) {
					failed++;
					if (this.config.stopOnFailure) {
						break;
					}
				}

				if (this.config.saveIntermediate) {
					this.saveResult(result);
				}
			} catch (error) {
				failed++;
				const errorResult: BenchmarkResult = {
					instance_id: task.instance_id,
					success: false,
					time_minutes: (Date.now() - startTime) / 60000,
					timestamp: new Date().toISOString(),
					errors: [error instanceof Error ? error.message : String(error)],
				};
				this.results.push(errorResult);

				if (this.config.stopOnFailure) {
					break;
				}
			}
		}

		return this.calculateStats();
	}

	/**
	 * Validate a patch against gold patch
	 */
	validatePatch(generated: string, gold: string): boolean {
		// Simple comparison - in production would use proper diff comparison
		const normalizePatch = (patch: string): string => {
			return patch
				.replace(/\s+/g, " ")
				.replace(/@@[^@]+@@/g, "")
				.trim();
		};

		return normalizePatch(generated) === normalizePatch(gold);
	}

	/**
	 * Calculate statistics from results
	 */
	calculateStats(): BenchmarkStats {
		const successful = this.results.filter((r) => r.success).length;
		const failed = this.results.filter((r) => !r.success).length;

		const totalTime = this.results.reduce((sum, r) => sum + r.time_minutes, 0);
		const averageTime = this.results.length > 0 ? totalTime / this.results.length : 0;

		const totalQuality = this.results.reduce((sum, r) => sum + (r.quality_score || 0), 0);
		const averageQuality = this.results.length > 0 ? totalQuality / this.results.length : 0;

		const errorsByType: Record<string, number> = {};
		for (const result of this.results) {
			if (result.errors) {
				for (const error of result.errors) {
					const errorType = this.classifyError(error);
					errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
				}
			}
		}

		const byDifficulty: Record<string, { total: number; success: number }> = {};
		const byCategory: Record<string, { total: number; success: number }> = {};

		for (const result of this.results) {
			const task = this.tasks.find((t) => t.instance_id === result.instance_id);

			if (task) {
				if (task.difficulty) {
					if (!byDifficulty[task.difficulty]) {
						byDifficulty[task.difficulty] = { total: 0, success: 0 };
					}
					byDifficulty[task.difficulty].total++;
					if (result.success) {
						byDifficulty[task.difficulty].success++;
					}
				}

				if (task.category) {
					for (const cat of task.category) {
						if (!byCategory[cat]) {
							byCategory[cat] = { total: 0, success: 0 };
						}
						byCategory[cat].total++;
						if (result.success) {
							byCategory[cat].success++;
						}
					}
				}
			}
		}

		return {
			totalTasks: this.results.length,
			successful,
			failed,
			passRate: this.results.length > 0 ? (successful / this.results.length) * 100 : 0,
			averageTime,
			averageQuality,
			errorsByType,
			byDifficulty,
			byCategory,
		};
	}

	/**
	 * Classify error by type
	 */
	private classifyError(error: string): string {
		if (error.includes("Cannot find") || error.includes("Type error")) {
			return "typescript";
		}
		if (error.includes("test") || error.includes("assertion")) {
			return "test";
		}
		if (error.includes("lint") || error.includes("style")) {
			return "lint";
		}
		if (error.includes("timeout") || error.includes("hang")) {
			return "timeout";
		}
		return "runtime";
	}

	/**
	 * Save result to file
	 */
	saveResult(result: BenchmarkResult): void {
		const outputDir = this.config.outputDir || "data/benchmark-results";
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const filename = `result-${result.instance_id}-${result.timestamp.replace(/[:.]/g, "-")}.json`;
		const filePath = path.join(outputDir, filename);

		fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
	}

	/**
	 * Save all results
	 */
	saveResults(): void {
		const outputDir = this.config.outputDir || "data/benchmark-results";
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const stats = this.calculateStats();
		const summary = {
			stats,
			results: this.results,
			timestamp: new Date().toISOString(),
		};

		const filePath = path.join(outputDir, "benchmark-summary.json");
		fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
	}

	/**
	 * Get all results
	 */
	getResults(): BenchmarkResult[] {
		return this.results;
	}

	/**
	 * Load previous results
	 */
	loadResults(filePath: string): BenchmarkResult[] {
		try {
			const content = fs.readFileSync(filePath, "utf-8");
			const data = JSON.parse(content);

			if (Array.isArray(data)) {
				this.results = data;
			} else if (data.results && Array.isArray(data.results)) {
				this.results = data.results;
			}

			return this.results;
		} catch (error) {
			throw new Error(
				`Failed to load results from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Clear results
	 */
	clearResults(): void {
		this.results = [];
	}

	/**
	 * Clear tasks
	 */
	clearTasks(): void {
		this.tasks = [];
	}

	/**
	 * Format stats as markdown
	 */
	formatStats(stats: BenchmarkStats): string {
		const lines: string[] = [
			"## Benchmark Statistics",
			"",
			`**Total Tasks:** ${stats.totalTasks}`,
			`**Pass Rate:** ${stats.passRate.toFixed(1)}%`,
			`**Successful:** ${stats.successful}`,
			`**Failed:** ${stats.failed}`,
			"",
			"**Time Metrics:**",
			`- Average: ${stats.averageTime.toFixed(1)} minutes`,
			"",
			"**Quality:**",
			`- Average Score: ${stats.averageQuality.toFixed(1)}`,
			"",
		];

		if (Object.keys(stats.byDifficulty).length > 0) {
			lines.push("**By Difficulty:**");
			for (const [diff, data] of Object.entries(stats.byDifficulty)) {
				const rate = data.total > 0 ? ((data.success / data.total) * 100).toFixed(1) : "0";
				lines.push(`- ${diff}: ${data.success}/${data.total} (${rate}% pass)`);
			}
			lines.push("");
		}

		if (Object.keys(stats.byCategory).length > 0) {
			lines.push("**By Category:**");
			for (const [cat, data] of Object.entries(stats.byCategory)) {
				const rate = data.total > 0 ? ((data.success / data.total) * 100).toFixed(1) : "0";
				lines.push(`- ${cat}: ${data.success}/${data.total} (${rate}% pass)`);
			}
			lines.push("");
		}

		if (Object.keys(stats.errorsByType).length > 0) {
			lines.push("**Errors by Type:**");
			for (const [type, count] of Object.entries(stats.errorsByType)) {
				lines.push(`- ${type}: ${count}`);
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	/**
	 * Format task as markdown
	 */
	formatTask(task: BenchmarkTask): string {
		const lines: string[] = [
			"## Benchmark Task",
			"",
			`**ID:** ${task.instance_id}`,
			`**Repository:** ${task.repo}`,
			`**Base Commit:** ${task.base_commit}`,
			"",
			"**Problem Statement:**",
			task.problem_statement,
			"",
		];

		if (task.difficulty) {
			lines.push(`**Difficulty:** ${task.difficulty}`);
		}

		if (task.category && task.category.length > 0) {
			lines.push(`**Categories:** ${task.category.join(", ")}`);
		}

		if (task.hints_text) {
			lines.push("", "**Hints:**", task.hints_text);
		}

		return lines.join("\n");
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let benchmarkInstance: BenchmarkRunner | null = null;

/**
 * Get or create benchmark runner instance
 */
export function getBenchmarkRunner(config: BenchmarkConfig = {}): BenchmarkRunner {
	if (!benchmarkInstance) {
		benchmarkInstance = new BenchmarkRunner(config);
	}
	return benchmarkInstance;
}

/**
 * Create sample benchmark tasks for testing
 */
export function createSampleTasks(): BenchmarkTask[] {
	return [
		{
			instance_id: "sample-001",
			problem_statement: "Fix TypeScript error in agent.ts",
			repo: "paimon/paimon",
			base_commit: "main",
			difficulty: "easy",
			category: ["typescript", "bug-fix"],
		},
		{
			instance_id: "sample-002",
			problem_statement: "Add new tool for code analysis",
			repo: "paimon/paimon",
			base_commit: "main",
			difficulty: "medium",
			category: ["capability", "tool"],
		},
		{
			instance_id: "sample-003",
			problem_statement: "Implement benchmark integration",
			repo: "paimon/paimon",
			base_commit: "main",
			difficulty: "hard",
			category: ["capability", "benchmark"],
		},
	];
}
