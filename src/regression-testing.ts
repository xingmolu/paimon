/**
 * Evolution Regression Testing Module
 *
 * Ensures new capabilities don't break existing ones by running regression tests
 * after each evolution iteration. Tracks capability health, test results, and
 * provides snapshot comparison to identify what changed between iterations.
 *
 * Benefits:
 * - Catch breakages early after implementing new capabilities
 * - Track capability health (pass rate, last tested, dependencies)
 * - Compare snapshots before/after changes to identify regressions
 * - Reduce rework by ensuring all tests pass before marking task complete
 * - Improve evolution velocity by maintaining capability stability
 *
 * Inspired by:
 * - Aider's test-after-change workflow
 * - OpenHands' verify-before-complete pattern
 * - Claude Code's confidence-based quality checks
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Result of a single test run.
 */
export interface RegressionTestResult {
	testFile: string;
	passed: boolean;
	duration: number; // milliseconds
	errorMessage?: string;
	testCount: number;
	failureCount: number;
	skipCount: number;
	timestamp: string;
}

/**
 * Health status of a capability.
 */
export interface CapabilityHealth {
	capabilityId: string;
	capabilityName: string;
	description: string;
	lastTested: string;
	lastPassed: boolean;
	passRate: number; // 0-1
	totalRuns: number;
	successfulRuns: number;
	relatedTests: string[];
	dependencies: string[];
	status: "healthy" | "degraded" | "broken" | "unknown";
}

/**
 * Snapshot of test results at a point in time.
 */
export interface RegressionSnapshot {
	id: string;
	timestamp: string;
	iterationId?: string;
	taskDescription?: string;
	testResults: RegressionTestResult[];
	totalTests: number;
	passedTests: number;
	failedTests: number;
	skippedTests: number;
	totalDuration: number;
	passRate: number;
	changes?: string[]; // Files changed since last snapshot
}

/**
 * Comparison between two snapshots.
 */
export interface SnapshotComparison {
	beforeSnapshot: RegressionSnapshot;
	afterSnapshot: RegressionSnapshot;
	newFailures: RegressionTestResult[];
	newPasses: RegressionTestResult[];
	fixedTests: RegressionTestResult[];
	regressedTests: RegressionTestResult[];
	unchangedTests: RegressionTestResult[];
	overallChange: "improved" | "degraded" | "unchanged" | "mixed";
	changeSummary: string;
}

/**
 * Statistics for regression testing.
 */
export interface RegressionTestingStats {
	totalRuns: number;
	totalSnapshots: number;
	averagePassRate: number;
	capabilityHealthCount: number;
	healthyCapabilities: number;
	degradedCapabilities: number;
	brokenCapabilities: number;
	recentSnapshots: RegressionSnapshot[];
	commonFailures: { testFile: string; count: number }[];
}

/**
 * Configuration for regression testing.
 */
export interface RegressionTestingConfig {
	enabled: boolean;
	autoRunAfterEvolution: boolean;
	snapshotRetentionDays: number;
	maxSnapshots: number;
	testTimeout: number; // milliseconds
	trackCapabilityHealth: boolean;
	dataPath: string;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: RegressionTestingConfig = {
	enabled: true,
	autoRunAfterEvolution: true,
	snapshotRetentionDays: 30,
	maxSnapshots: 100,
	testTimeout: 120000, // 2 minutes
	trackCapabilityHealth: true,
	dataPath: path.join(process.env.HOME || ".", ".paimon", "regression-testing.json"),
};

/**
 * Evolution Regression Tester - Run regression tests and track capability health.
 */
export class EvolutionRegressionTester {
	private config: RegressionTestingConfig;
	private snapshots: RegressionSnapshot[] = [];
	private capabilityHealth: Map<string, CapabilityHealth> = new Map();
	private stats: RegressionTestingStats;
	private currentSnapshotId: string | null = null;

	constructor(configPath?: string) {
		this.config = { ...DEFAULT_CONFIG };
		this.stats = {
			totalRuns: 0,
			totalSnapshots: 0,
			averagePassRate: 0,
			capabilityHealthCount: 0,
			healthyCapabilities: 0,
			degradedCapabilities: 0,
			brokenCapabilities: 0,
			recentSnapshots: [],
			commonFailures: [],
		};
		this.loadState(configPath);
		this.initializeCapabilityHealth();
	}

	/**
	 * Load state from persistence file.
	 */
	private loadState(configPath?: string): void {
		if (configPath) {
			this.config.dataPath = configPath;
		}

		try {
			if (fs.existsSync(this.config.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.config.dataPath, "utf-8"));
				this.snapshots = data.snapshots || [];
				this.capabilityHealth = new Map(Object.entries(data.capabilityHealth || {}));
				this.stats = data.stats || this.stats;
				this.config = { ...DEFAULT_CONFIG, ...data.config };
			}
		} catch {
			// Ignore errors, use defaults
		}
	}

	/**
	 * Save state to persistence file.
	 */
	private saveState(): void {
		try {
			const dir = path.dirname(this.config.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const data = {
				snapshots: this.snapshots.slice(-this.config.maxSnapshots),
				capabilityHealth: Object.fromEntries(this.capabilityHealth),
				stats: this.stats,
				config: this.config,
			};

			fs.writeFileSync(this.config.dataPath, JSON.stringify(data, null, 2));
		} catch {
			// Ignore save errors
		}
	}

	/**
	 * Initialize capability health from ROADMAP and existing tests.
	 */
	private initializeCapabilityHealth(): void {
		// Load capabilities from ROADMAP.md
		try {
			const roadmapPath = "ROADMAP.md";
			if (fs.existsSync(roadmapPath)) {
				const content = fs.readFileSync(roadmapPath, "utf-8");
				const lines = content.split("\n");

				// Extract phases
				for (const line of lines) {
					const phaseMatch = line.match(/## Phase (\d+): (.+)/);
					if (phaseMatch) {
						const phaseId = `phase-${phaseMatch[1]}`;
						const phaseName = phaseMatch[2];

						// Check if completed
						const isCompleted = this.checkPhaseCompleted(phaseId, content);

						if (!this.capabilityHealth.has(phaseId)) {
							this.capabilityHealth.set(phaseId, {
								capabilityId: phaseId,
								capabilityName: phaseName,
								description: `Phase ${phaseMatch[1]}: ${phaseName}`,
								lastTested: "never",
								lastPassed: false,
								passRate: isCompleted ? 1.0 : 0,
								totalRuns: 0,
								successfulRuns: isCompleted ? 1 : 0,
								relatedTests: this.findRelatedTests(phaseName),
								dependencies: [],
								status: isCompleted ? "healthy" : "unknown",
							});
						}
					}
				}
			}
		} catch {
			// Ignore roadmap parsing errors
		}

		this.updateStats();
	}

	/**
	 * Check if a phase is completed in ROADMAP.
	 */
	private checkPhaseCompleted(phaseId: string, content: string): boolean {
		// Look for [x] markers after the phase header
		const phaseMatch = content.match(
			new RegExp(`## Phase ${phaseId.replace("phase-", "")}.*\\n[-\\n]*`, "s"),
		);
		if (phaseMatch) {
			const section = phaseMatch[0];
			return section.includes("- [x]");
		}
		return false;
	}

	/**
	 * Find related test files for a capability.
	 */
	private findRelatedTests(capabilityName: string): string[] {
		const keywords = capabilityName.toLowerCase().split(/\s+/);
		const testFiles: string[] = [];

		try {
			// Find test files matching capability keywords
			const testDir = "src";
			if (fs.existsSync(testDir)) {
				const files = fs.readdirSync(testDir);
				for (const file of files) {
					if (file.endsWith(".test.ts")) {
						const testName = file.replace(".test.ts", "").toLowerCase();
						for (const keyword of keywords) {
							if (testName.includes(keyword) && keyword.length > 3) {
								testFiles.push(file);
								break;
							}
						}
					}
				}
			}
		} catch {
			// Ignore errors
		}

		return testFiles.slice(0, 3);
	}

	/**
	 * Run all tests and capture results.
	 */
	runTests(timeout?: number): RegressionSnapshot {
		const startTime = Date.now();
		const testResults: RegressionTestResult[] = [];
		const timestamp = new Date().toISOString();

		const effectiveTimeout = timeout || this.config.testTimeout;

		try {
			// Run vitest
			const result = execSync("npm test -- --run --reporter=json 2>&1 || true", {
				timeout: effectiveTimeout,
				encoding: "utf-8",
				maxBuffer: 50 * 1024 * 1024,
			});

			// Parse JSON output
			const jsonMatch = result.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
			if (jsonMatch) {
				try {
					const json = JSON.parse(jsonMatch[0]);
					for (const testResult of json.testResults || []) {
						testResults.push({
							testFile: path.basename(testResult.name || "unknown"),
							passed: testResult.status === "passed",
							duration: testResult.duration || 0,
							errorMessage: testResult.message || undefined,
							testCount: testResult.assertionResults?.length || 0,
							failureCount:
								testResult.assertionResults?.filter(
									(a: { status: string }) => a.status === "failed",
								).length || 0,
							skipCount:
								testResult.assertionResults?.filter(
									(a: { status: string }) => a.status === "skipped",
								).length || 0,
							timestamp,
						});
					}
				} catch {
					// Fall back to simple parsing
				}
			}

			// Fallback: parse output lines
			if (testResults.length === 0) {
				const lines = result.split("\n");
				for (const line of lines) {
					const passMatch = line.match(/✓ (\S+)/);
					if (passMatch) {
						testResults.push({
							testFile: passMatch[1],
							passed: true,
							duration: 0,
							testCount: 1,
							failureCount: 0,
							skipCount: 0,
							timestamp,
						});
					}
					const failMatch = line.match(/✗ (\S+)/);
					if (failMatch) {
						testResults.push({
							testFile: failMatch[1],
							passed: false,
							duration: 0,
							errorMessage: line.slice(line.indexOf("Error:")),
							testCount: 1,
							failureCount: 1,
							skipCount: 0,
							timestamp,
						});
					}
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			testResults.push({
				testFile: "all",
				passed: false,
				duration: Date.now() - startTime,
				errorMessage: errorMessage.includes("timeout") ? "Test timeout" : errorMessage,
				testCount: 0,
				failureCount: 1,
				skipCount: 0,
				timestamp,
			});
		}

		// Calculate totals
		const totalTests = testResults.length;
		const passedTests = testResults.filter((r) => r.passed).length;
		const failedTests = testResults.filter((r) => !r.passed).length;
		const skippedTests = testResults.reduce((sum, r) => sum + r.skipCount, 0);
		const totalDuration = Date.now() - startTime;
		const passRate = totalTests > 0 ? passedTests / totalTests : 0;

		// Create snapshot
		const snapshot: RegressionSnapshot = {
			id: `snapshot-${timestamp.replace(/[:.]/g, "-")}`,
			timestamp,
			testResults,
			totalTests,
			passedTests,
			failedTests,
			skippedTests,
			totalDuration,
			passRate,
		};

		// Track snapshot
		this.snapshots.push(snapshot);
		this.currentSnapshotId = snapshot.id;
		this.stats.totalRuns++;
		this.stats.totalSnapshots = this.snapshots.length;

		// Update capability health
		this.updateCapabilityHealth(snapshot);

		// Cleanup old snapshots
		this.cleanupSnapshots();

		// Save state
		this.saveState();

		return snapshot;
	}

	/**
	 * Run tests after evolution iteration.
	 */
	runAfterEvolution(
		iterationId: string,
		taskDescription: string,
		changes?: string[],
	): RegressionSnapshot {
		// Take before snapshot if we have previous
		const beforeSnapshot =
			this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;

		// Run tests
		const snapshot = this.runTests();
		snapshot.iterationId = iterationId;
		snapshot.taskDescription = taskDescription;
		snapshot.changes = changes;

		// Compare with before snapshot
		if (beforeSnapshot) {
			const comparison = this.compareSnapshots(beforeSnapshot.id, snapshot.id);
			if (comparison && comparison.overallChange === "degraded") {
				// Log warning about regression
				console.warn(`⚠️ Regression detected: ${comparison.newFailures.length} new failures`);
			}
		}

		return snapshot;
	}

	/**
	 * Get health status for a specific capability.
	 */
	getCapabilityHealth(capabilityId: string): CapabilityHealth | null {
		return this.capabilityHealth.get(capabilityId) || null;
	}

	/**
	 * Get all capability health statuses.
	 */
	getAllCapabilitiesHealth(): CapabilityHealth[] {
		return Array.from(this.capabilityHealth.values());
	}

	/**
	 * Get capabilities by status.
	 */
	getCapabilitiesByStatus(status: CapabilityHealth["status"]): CapabilityHealth[] {
		return this.getAllCapabilitiesHealth().filter((c) => c.status === status);
	}

	/**
	 * Update capability health from test results.
	 */
	private updateCapabilityHealth(snapshot: RegressionSnapshot): void {
		// Update based on test file mapping
		for (const result of snapshot.testResults) {
			// Find capabilities related to this test
			for (const [id, health] of this.capabilityHealth) {
				if (health.relatedTests.some((t) => result.testFile.includes(t.replace(".test.ts", "")))) {
					health.lastTested = snapshot.timestamp;
					health.lastPassed = result.passed;
					health.totalRuns++;
					if (result.passed) {
						health.successfulRuns++;
					}
					health.passRate = health.successfulRuns / health.totalRuns;

					// Update status
					if (health.passRate >= 0.9) {
						health.status = "healthy";
					} else if (health.passRate >= 0.7) {
						health.status = "degraded";
					} else {
						health.status = "broken";
					}
				}
			}
		}

		this.updateStats();
	}

	/**
	 * Get snapshot by ID.
	 */
	getSnapshot(snapshotId: string): RegressionSnapshot | null {
		return this.snapshots.find((s) => s.id === snapshotId) || null;
	}

	/**
	 * Get recent snapshots.
	 */
	getRecentSnapshots(limit = 10): RegressionSnapshot[] {
		return this.snapshots.slice(-limit);
	}

	/**
	 * Compare two snapshots.
	 */
	compareSnapshots(beforeId: string, afterId: string): SnapshotComparison | null {
		const before = this.getSnapshot(beforeId);
		const after = this.getSnapshot(afterId);

		if (!before || !after) {
			return null;
		}

		// Compare test results
		const newFailures: RegressionTestResult[] = [];
		const newPasses: RegressionTestResult[] = [];
		const fixedTests: RegressionTestResult[] = [];
		const regressedTests: RegressionTestResult[] = [];
		const unchangedTests: RegressionTestResult[] = [];

		// Build map of before results
		const beforeMap = new Map<string, RegressionTestResult>();
		for (const result of before.testResults) {
			beforeMap.set(result.testFile, result);
		}

		// Compare with after results
		for (const afterResult of after.testResults) {
			const beforeResult = beforeMap.get(afterResult.testFile);

			if (!beforeResult) {
				// New test
				if (afterResult.passed) {
					newPasses.push(afterResult);
				} else {
					newFailures.push(afterResult);
				}
			} else if (beforeResult.passed && !afterResult.passed) {
				// Regression
				regressedTests.push(afterResult);
			} else if (!beforeResult.passed && afterResult.passed) {
				// Fixed
				fixedTests.push(afterResult);
			} else {
				// Unchanged
				unchangedTests.push(afterResult);
			}
		}

		// Determine overall change
		let overallChange: SnapshotComparison["overallChange"] = "unchanged";
		if (regressedTests.length > 0 || newFailures.length > 0) {
			if (fixedTests.length > 0 || newPasses.length > 0) {
				overallChange = "mixed";
			} else {
				overallChange = "degraded";
			}
		} else if (fixedTests.length > 0 || newPasses.length > 0) {
			overallChange = "improved";
		}

		// Generate summary
		const changeSummary = this.generateChangeSummary(overallChange, {
			newFailures,
			newPasses,
			fixedTests,
			regressedTests,
		});

		return {
			beforeSnapshot: before,
			afterSnapshot: after,
			newFailures,
			newPasses,
			fixedTests,
			regressedTests,
			unchangedTests,
			overallChange,
			changeSummary,
		};
	}

	/**
	 * Generate summary of changes.
	 */
	private generateChangeSummary(
		overallChange: SnapshotComparison["overallChange"],
		details: {
			newFailures: RegressionTestResult[];
			newPasses: RegressionTestResult[];
			fixedTests: RegressionTestResult[];
			regressedTests: RegressionTestResult[];
		},
	): string {
		const lines: string[] = [];

		switch (overallChange) {
			case "improved":
				lines.push("✅ Tests improved!");
				break;
			case "degraded":
				lines.push("⚠️ Tests degraded - regressions detected!");
				break;
			case "mixed":
				lines.push("🔄 Mixed results - some improvements, some regressions");
				break;
			default:
				lines.push("✓ Tests unchanged - all passing");
		}

		if (details.regressedTests.length > 0) {
			lines.push(`Regressed: ${details.regressedTests.length} tests`);
			for (const test of details.regressedTests.slice(0, 3)) {
				lines.push(`  - ${test.testFile}`);
			}
		}

		if (details.newFailures.length > 0) {
			lines.push(`New failures: ${details.newFailures.length} tests`);
		}

		if (details.fixedTests.length > 0) {
			lines.push(`Fixed: ${details.fixedTests.length} tests`);
		}

		if (details.newPasses.length > 0) {
			lines.push(`New tests passing: ${details.newPasses.length}`);
		}

		return lines.join("\n");
	}

	/**
	 * Get statistics.
	 */
	getStats(): RegressionTestingStats {
		this.updateStats();
		return this.stats;
	}

	/**
	 * Update internal statistics.
	 */
	private updateStats(): void {
		const capabilities = this.getAllCapabilitiesHealth();
		this.stats.capabilityHealthCount = capabilities.length;
		this.stats.healthyCapabilities = capabilities.filter((c) => c.status === "healthy").length;
		this.stats.degradedCapabilities = capabilities.filter((c) => c.status === "degraded").length;
		this.stats.brokenCapabilities = capabilities.filter((c) => c.status === "broken").length;

		if (this.snapshots.length > 0) {
			this.stats.averagePassRate =
				this.snapshots.reduce((sum, s) => sum + s.passRate, 0) / this.snapshots.length;
		}

		this.stats.recentSnapshots = this.getRecentSnapshots(5);

		// Calculate common failures
		const failureCounts = new Map<string, number>();
		for (const snapshot of this.snapshots.slice(-20)) {
			for (const result of snapshot.testResults) {
				if (!result.passed) {
					failureCounts.set(result.testFile, (failureCounts.get(result.testFile) || 0) + 1);
				}
			}
		}

		this.stats.commonFailures = Array.from(failureCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([testFile, count]) => ({ testFile, count }));
	}

	/**
	 * Cleanup old snapshots.
	 */
	private cleanupSnapshots(): void {
		// Keep only maxSnapshots
		if (this.snapshots.length > this.config.maxSnapshots) {
			this.snapshots = this.snapshots.slice(-this.config.maxSnapshots);
		}

		// Also cleanup by age
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.config.snapshotRetentionDays);
		const cutoffStr = cutoffDate.toISOString();

		this.snapshots = this.snapshots.filter((s) => s.timestamp >= cutoffStr);
	}

	/**
	 * Get configuration.
	 */
	getConfig(): RegressionTestingConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration.
	 */
	updateConfig(updates: Partial<RegressionTestingConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	/**
	 * Clear all data.
	 */
	clear(): void {
		this.snapshots = [];
		this.capabilityHealth.clear();
		this.stats = {
			totalRuns: 0,
			totalSnapshots: 0,
			averagePassRate: 0,
			capabilityHealthCount: 0,
			healthyCapabilities: 0,
			degradedCapabilities: 0,
			brokenCapabilities: 0,
			recentSnapshots: [],
			commonFailures: [],
		};
		this.saveState();
	}

	/**
	 * Check if regression testing is enabled.
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable or disable regression testing.
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveState();
	}

	/**
	 * Format snapshot as markdown.
	 */
	formatSnapshot(snapshot: RegressionSnapshot): string {
		const lines: string[] = [
			`## Regression Test Snapshot: ${snapshot.id}`,
			"",
			`**Timestamp:** ${snapshot.timestamp}`,
			`**Pass Rate:** ${Math.round(snapshot.passRate * 100)}%`,
			`**Total Tests:** ${snapshot.totalTests}`,
			`**Passed:** ${snapshot.passedTests}`,
			`**Failed:** ${snapshot.failedTests}`,
			`**Skipped:** ${snapshot.skippedTests}`,
			`**Duration:** ${snapshot.totalDuration}ms`,
		];

		if (snapshot.iterationId) {
			lines.push(`**Iteration:** ${snapshot.iterationId}`);
		}

		if (snapshot.taskDescription) {
			lines.push(`**Task:** ${snapshot.taskDescription}`);
		}

		if (snapshot.changes && snapshot.changes.length > 0) {
			lines.push("", "### Changed Files");
			for (const change of snapshot.changes.slice(0, 5)) {
				lines.push(`- ${change}`);
			}
		}

		if (snapshot.testResults.length > 0) {
			lines.push("", "### Test Results");
			for (const result of snapshot.testResults.slice(0, 10)) {
				const status = result.passed ? "✅" : "❌";
				lines.push(`${status} ${result.testFile} (${result.duration}ms)`);
				if (!result.passed && result.errorMessage) {
					lines.push(`  > ${result.errorMessage.slice(0, 100)}...`);
				}
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format comparison as markdown.
	 */
	formatComparison(comparison: SnapshotComparison): string {
		const lines: string[] = [
			"## Regression Comparison",
			"",
			`**Overall Change:** ${comparison.overallChange}`,
			"",
			comparison.changeSummary,
			"",
			"### Statistics",
			"| Metric | Before | After |",
			"|--------|--------|-------|",
			`| Pass Rate | ${Math.round(comparison.beforeSnapshot.passRate * 100)}% | ${Math.round(comparison.afterSnapshot.passRate * 100)}% |`,
			`| Total Tests | ${comparison.beforeSnapshot.totalTests} | ${comparison.afterSnapshot.totalTests} |`,
			`| Passed | ${comparison.beforeSnapshot.passedTests} | ${comparison.afterSnapshot.passedTests} |`,
			`| Failed | ${comparison.beforeSnapshot.failedTests} | ${comparison.afterSnapshot.failedTests} |`,
		];

		if (comparison.regressedTests.length > 0) {
			lines.push("", "### ❌ Regressed Tests");
			for (const test of comparison.regressedTests) {
				lines.push(`- ${test.testFile}`);
			}
		}

		if (comparison.newFailures.length > 0) {
			lines.push("", "### ⚠️ New Failures");
			for (const test of comparison.newFailures) {
				lines.push(`- ${test.testFile}`);
			}
		}

		if (comparison.fixedTests.length > 0) {
			lines.push("", "### ✅ Fixed Tests");
			for (const test of comparison.fixedTests) {
				lines.push(`- ${test.testFile}`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format capability health as markdown.
	 */
	formatCapabilityHealth(health: CapabilityHealth): string {
		const statusEmoji = {
			healthy: "✅",
			degraded: "⚠️",
			broken: "❌",
			unknown: "❓",
		};

		const lines: string[] = [
			`## Capability Health: ${health.capabilityName}`,
			"",
			`**Status:** ${statusEmoji[health.status]} ${health.status}`,
			`**Pass Rate:** ${Math.round(health.passRate * 100)}%`,
			`**Last Tested:** ${health.lastTested}`,
			`**Total Runs:** ${health.totalRuns}`,
			`**Successful Runs:** ${health.successfulRuns}`,
		];

		if (health.relatedTests.length > 0) {
			lines.push("", "**Related Tests:**");
			for (const test of health.relatedTests) {
				lines.push(`- ${test}`);
			}
		}

		if (health.dependencies.length > 0) {
			lines.push("", "**Dependencies:**");
			for (const dep of health.dependencies) {
				lines.push(`- ${dep}`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format stats as markdown.
	 */
	formatStats(stats: RegressionTestingStats): string {
		const lines: string[] = [
			"## Regression Testing Statistics",
			"",
			`**Total Runs:** ${stats.totalRuns}`,
			`**Total Snapshots:** ${stats.totalSnapshots}`,
			`**Average Pass Rate:** ${Math.round(stats.averagePassRate * 100)}%`,
			"",
			"### Capability Health Overview",
			"| Status | Count |",
			"|--------|-------|",
			`| ✅ Healthy | ${stats.healthyCapabilities} |`,
			`| ⚠️ Degraded | ${stats.degradedCapabilities} |`,
			`| ❌ Broken | ${stats.brokenCapabilities} |`,
		];

		if (stats.commonFailures.length > 0) {
			lines.push("", "### Common Failures");
			for (const failure of stats.commonFailures.slice(0, 5)) {
				lines.push(`- ${failure.testFile} (${failure.count} occurrences)`);
			}
		}

		return lines.join("\n");
	}
}

// Singleton instance
let regressionTesterInstance: EvolutionRegressionTester | null = null;

/**
 * Get singleton regression tester instance.
 */
export function getRegressionTester(): EvolutionRegressionTester {
	if (!regressionTesterInstance) {
		regressionTesterInstance = new EvolutionRegressionTester();
	}
	return regressionTesterInstance;
}

/**
 * Initialize regression tester with custom config path.
 */
export function initRegressionTester(configPath?: string): EvolutionRegressionTester {
	regressionTesterInstance = new EvolutionRegressionTester(configPath);
	return regressionTesterInstance;
}
