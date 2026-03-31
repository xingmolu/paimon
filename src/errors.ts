/**
 * Error pattern extraction and analysis.
 * Provides confidence-based scoring for error detection.
 */

import type { ErrorPattern } from "./types.js";

/**
 * Extract common error patterns from build/test output
 * Each pattern includes a confidence score (0-100):
 * - 100: Absolutely certain, definitely real
 * - 75-99: Highly confident, real and important
 * - 50-74: Moderately confident, real but minor
 * - 25-49: Somewhat confident, might be real
 * - 0-24: Not confident, likely false positive
 */
export function extractErrorPatterns(output: string): ErrorPattern[] {
	const patterns: ErrorPattern[] = [];

	// TypeScript errors: "src/file.ts(10,5): error TS1234: message"
	// High confidence (90-100) because error codes are definitive
	const tsErrorRegex = /([^\s(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g;
	for (const match of output.matchAll(tsErrorRegex)) {
		const tsCode = match[4];
		// Known error codes get higher confidence
		const knownCodes = [
			"TS2304",
			"TS2322",
			"TS2339",
			"TS2345",
			"TS2769",
			"TS18048",
			"TS2531",
			"TS2341",
			"TS2307",
		];
		const confidence = knownCodes.includes(tsCode) ? 95 : 90;
		patterns.push({
			type: "typescript",
			file: match[1],
			line: Number.parseInt(match[2], 10),
			message: `TS${tsCode}: ${match[5]}`,
			suggestion: getSuggestionForTsError(tsCode, match[5]),
			confidence,
		});
	}

	// Test failures: "FAIL src/file.test.ts > test name"
	// Medium-high confidence (80) - test names might be misleading
	const testFailRegex = /FAIL\s+([^\s>]+)\s*>\s*(.+)/g;
	for (const match of output.matchAll(testFailRegex)) {
		patterns.push({
			type: "test",
			file: match[1],
			message: `Test failed: ${match[2]}`,
			suggestion: "Check test assertions and ensure the code matches expected behavior",
			confidence: 80,
		});
	}

	// Assertion errors: "AssertionError: expected X to equal Y"
	// High confidence (85) because assertion failures are definitive
	const assertRegex = /AssertionError:\s*(.+)/g;
	for (const match of output.matchAll(assertRegex)) {
		patterns.push({
			type: "test",
			message: match[1],
			suggestion: "Review the assertion and fix the expected or actual value",
			confidence: 85,
		});
	}

	// Lint errors: "src/file.ts:10:5: error message"
	// High confidence (85-95) - lint rules are deterministic
	const lintErrorRegex = /([^\s:]+):(\d+):(\d+):\s*(.+)/g;
	for (const match of output.matchAll(lintErrorRegex)) {
		if (match[1].endsWith(".ts") || match[1].endsWith(".js")) {
			// Severity-based confidence: "error" is higher than "warning"
			const severity = match[4].toLowerCase().includes("error") ? 95 : 85;
			patterns.push({
				type: "lint",
				file: match[1],
				line: Number.parseInt(match[2], 10),
				message: match[4],
				suggestion: "Run `npm run lint -- --fix` to auto-fix or manually correct the issue",
				confidence: severity,
			});
		}
	}

	// Cannot find module errors
	// Very high confidence (95) - module resolution is definitive
	const moduleRegex = /Cannot find module ['"]([^'"]+)['"]/g;
	for (const match of output.matchAll(moduleRegex)) {
		patterns.push({
			type: "typescript",
			message: `Cannot find module '${match[1]}'`,
			suggestion: `Install the module with 'npm install ${match[1]}' or check the import path`,
			confidence: 95,
		});
	}

	// Type 'X' is not assignable to type 'Y'
	// High confidence (80) - type mismatches are usually real issues
	const typeRegex = /Type '([^']+)' is not assignable to type '([^']+)'/g;
	for (const match of output.matchAll(typeRegex)) {
		patterns.push({
			type: "typescript",
			message: `Type '${match[1]}' is not assignable to type '${match[2]}'`,
			suggestion: "Add type conversion or fix the type definition",
			confidence: 80,
		});
	}

	return patterns;
}

/**
 * Get suggestion for TypeScript error code
 */
export function getSuggestionForTsError(code: string, _message: string): string {
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
