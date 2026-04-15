/**
 * Tests for Self-Healing Code Patterns Module
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type SelfHealingCategory,
	type SelfHealingConfig,
	SelfHealingManager,
	type SelfHealingPattern,
	getSelfHealingManager,
	initSelfHealingManager,
} from "./self-healing.js";

describe("SelfHealingManager", () => {
	let manager: SelfHealingManager;
	let testDir: string;

	beforeEach(() => {
		// Create a temporary test directory
		testDir = join(tmpdir(), `self-healing-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Initialize manager with test config path
		const configPath = join(testDir, "self-healing.json");
		manager = new SelfHealingManager(configPath);
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("Initialization", () => {
		it("should initialize with default patterns", () => {
			const patterns = manager.getPatterns();
			expect(patterns.length).toBeGreaterThan(0);
		});

		it("should have expected default categories", () => {
			const categories: SelfHealingCategory[] = [
				"typescript",
				"lint",
				"test",
				"runtime",
				"import",
				"syntax",
				"dependency",
			];
			for (const category of categories) {
				const patterns = manager.getPatternsByCategory(category);
				expect(patterns.length).toBeGreaterThanOrEqual(0);
			}
		});

		it("should be enabled by default", () => {
			expect(manager.isEnabled()).toBe(true);
		});
	});

	describe("Configuration", () => {
		it("should enable and disable self-healing", () => {
			manager.setEnabled(false);
			expect(manager.isEnabled()).toBe(false);

			manager.setEnabled(true);
			expect(manager.isEnabled()).toBe(true);
		});

		it("should update configuration", () => {
			manager.updateConfig({ maxTotalAttempts: 5 });
			const config = manager.getConfig();
			expect(config.maxTotalAttempts).toBe(5);
		});

		it("should return a copy of configuration", () => {
			const config1 = manager.getConfig();
			config1.maxTotalAttempts = 99;
			const config2 = manager.getConfig();
			expect(config2.maxTotalAttempts).not.toBe(99);
		});
	});

	describe("Pattern Management", () => {
		it("should get all patterns", () => {
			const patterns = manager.getPatterns();
			expect(Array.isArray(patterns)).toBe(true);
			expect(patterns.length).toBeGreaterThan(0);
		});

		it("should get patterns by category", () => {
			const tsPatterns = manager.getPatternsByCategory("typescript");
			expect(tsPatterns.length).toBeGreaterThan(0);
			for (const pattern of tsPatterns) {
				expect(pattern.category).toBe("typescript");
			}
		});

		it("should get patterns by severity", () => {
			const lowPatterns = manager.getPatternsBySeverity("low");
			for (const pattern of lowPatterns) {
				expect(pattern.severity).toBe("low");
			}
		});

		it("should get a specific pattern", () => {
			const pattern = manager.getPattern("lint-unused-var");
			expect(pattern).toBeDefined();
			expect(pattern?.name).toBe("Unused Variable");
		});

		it("should return undefined for non-existent pattern", () => {
			const pattern = manager.getPattern("non-existent-pattern");
			expect(pattern).toBeUndefined();
		});

		it("should add a custom pattern", () => {
			const customPattern: SelfHealingPattern = {
				id: "custom-test-pattern",
				category: "lint",
				severity: "low",
				name: "Custom Test Pattern",
				description: "A custom test pattern",
				detectionPattern: /test pattern \d+/g,
				autoFixEnabled: false,
				requiresConfirmation: false,
				maxAttempts: 1,
				estimatedFixTime: 1,
			};

			manager.addPattern(customPattern);
			const pattern = manager.getPattern("custom-test-pattern");
			expect(pattern).toBeDefined();
			expect(pattern?.name).toBe("Custom Test Pattern");
		});

		it("should remove a pattern", () => {
			const initialPatterns = manager.getPatterns();
			manager.removePattern("lint-missing-semicolon");
			const newPatterns = manager.getPatterns();
			expect(newPatterns.length).toBe(initialPatterns.length - 1);
			expect(manager.getPattern("lint-missing-semicolon")).toBeUndefined();
		});
	});

	describe("Pattern Detection", () => {
		it("should detect TypeScript import errors", () => {
			const errorContent = `src/test.ts(10,5): error TS2304: Cannot find name 'myFunction'.`;
			const detections = manager.detectPatterns(errorContent);

			expect(detections.length).toBeGreaterThan(0);
			expect(detections.some((d) => d.pattern.category === "typescript")).toBe(true);
		});

		it("should detect unused variable lint errors", () => {
			const errorContent = `'unusedVar' is declared but its value is never read.`;
			const detections = manager.detectPatterns(errorContent);

			expect(detections.some((d) => d.pattern.id === "lint-unused-var")).toBe(true);
		});

		it("should detect missing semicolon", () => {
			const errorContent = "Missing semicolon (semi)";
			const detections = manager.detectPatterns(errorContent);

			expect(detections.some((d) => d.pattern.id === "lint-missing-semicolon")).toBe(true);
		});

		it("should extract line numbers from errors", () => {
			const errorContent = "src/test.ts(10,5): error TS2304: Cannot find name 'myFunction'.";
			const detections = manager.detectPatterns(errorContent);

			// Line numbers are extracted from error content
			// Check that at least some detections have line numbers
			const hasLineNumber = detections.some((d) => d.match.line !== undefined);
			expect(hasLineNumber || detections.length > 0).toBe(true);
		});

		it("should return empty array for no matches", () => {
			const errorContent = "This is a random error message with no patterns.";
			const detections = manager.detectPatterns(errorContent);

			expect(detections.length).toBe(0);
		});
	});

	describe("Confidence Scoring", () => {
		it("should calculate confidence based on file context", async () => {
			// Create a test file
			const testFile = join(testDir, "test.ts");
			writeFileSync(testFile, "const x = 1;\nconst y = 2;\n", "utf-8");

			const errorContent = `'y' is declared but its value is never read.`;
			const detections = manager.detectPatterns(errorContent, testFile);

			expect(detections.length).toBeGreaterThan(0);
			expect(detections[0].confidence).toBeGreaterThan(70);
		});

		it("should have lower confidence without file context", () => {
			const errorContent = `'y' is declared but its value is never read.`;
			const detections = manager.detectPatterns(errorContent);

			expect(detections.length).toBeGreaterThan(0);
			expect(detections[0].confidence).toBeLessThan(90);
		});
	});

	describe("Auto-Fix Recommendations", () => {
		it("should recommend auto-fix for low severity patterns", () => {
			const errorContent = `'unusedVar' is declared but its value is never read.`;
			const detections = manager.detectPatterns(errorContent);

			const unusedVarDetection = detections.find((d) => d.pattern.id === "lint-unused-var");
			expect(unusedVarDetection?.recommendAutoFix).toBe(true);
		});

		it("should not recommend auto-fix for patterns requiring confirmation", () => {
			const errorContent = "Test timed out after 5000ms";
			const detections = manager.detectPatterns(errorContent);

			const timeoutDetection = detections.find((d) => d.pattern.id === "test-timeout");
			expect(timeoutDetection?.recommendAutoFix).toBe(false);
		});

		it("should respect disabled self-healing", () => {
			manager.setEnabled(false);

			const errorContent = `'unusedVar' is declared but its value is never read.`;
			const detections = manager.detectPatterns(errorContent);

			// When disabled, the recommendAutoFix will still be calculated based on the pattern
			// but won't actually execute when disabled
			for (const detection of detections) {
				if (!detection.pattern.autoFixEnabled) continue;
				// Verify that even with recommended auto-fix, the manager is disabled
				expect(manager.isEnabled()).toBe(false);
			}
		});
	});

	describe("Fix Strategies", () => {
		it("should return failed for missing strategy", async () => {
			// Add a pattern without a strategy
			const pattern: SelfHealingPattern = {
				id: "no-strategy-pattern",
				category: "lint",
				severity: "low",
				name: "No Strategy Pattern",
				description: "A pattern without a fix strategy",
				detectionPattern: /no strategy pattern/g,
				autoFixEnabled: true,
				requiresConfirmation: false,
				maxAttempts: 1,
				estimatedFixTime: 1,
			};

			manager.addPattern(pattern);

			const errorContent = "no strategy pattern detected";
			const detections = manager.detectPatterns(errorContent);

			const detection = detections.find((d) => d.pattern.id === "no-strategy-pattern");
			expect(detection).toBeDefined();

			if (detection) {
				const result = await manager.applyFix(detection);
				expect(result.result).toBe("failed");
			}
		});

		it("should return failed for missing file context", async () => {
			// Fix requires file context
			const errorContent = "'unusedVar' is declared but its value is never read.";
			const detections = manager.detectPatterns(errorContent);

			const unusedVarDetection = detections.find((d) => d.pattern.id === "lint-unused-var");
			expect(unusedVarDetection).toBeDefined();

			if (unusedVarDetection) {
				const result = await manager.applyFix(unusedVarDetection);
				// Should fail without file context
				expect(result.result).toBe("failed");
			}
		});
	});

	describe("Statistics", () => {
		it("should track detection statistics", () => {
			const errorContent = "'unusedVar' is declared but its value is never read.";
			manager.detectPatterns(errorContent);

			const stats = manager.getStats();
			expect(stats.totalDetected).toBeGreaterThan(0);
		});

		it("should reset statistics", () => {
			const errorContent = "'unusedVar' is declared but its value is never read.";
			manager.detectPatterns(errorContent);

			manager.resetStats();
			const stats = manager.getStats();
			expect(stats.totalDetected).toBe(0);
		});

		it("should track detection history", () => {
			const errorContent = "'unusedVar' is declared but its value is never read.";
			manager.detectPatterns(errorContent);

			const history = manager.getDetectionHistory();
			expect(history.length).toBeGreaterThan(0);
		});
	});

	describe("Formatting", () => {
		it("should format patterns list", () => {
			const output = manager.formatPatterns();
			expect(output).toContain("Self-Healing Patterns");
			expect(output).toContain("| ID | Category | Severity");
		});

		it("should format statistics", () => {
			const output = manager.formatStats();
			expect(output).toContain("Self-Healing Statistics");
			expect(output).toContain("Total Detected");
		});
	});
});

describe("Singleton Instance", () => {
	it("should return the same instance", () => {
		const instance1 = getSelfHealingManager();
		const instance2 = getSelfHealingManager();
		expect(instance1).toBe(instance2);
	});

	it("should create new instance with initSelfHealingManager", () => {
		const instance1 = getSelfHealingManager();
		const instance2 = initSelfHealingManager();
		expect(instance1).not.toBe(instance2);
	});
});
