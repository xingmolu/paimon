/**
 * Diff-Aware Planning (Devin Pattern)
 *
 * Analyzes git diffs before making changes to predict impact,
 * detect potential conflicts, and suggest safer implementation approaches.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface DiffAnalysis {
	files: FileChange[];
	additions: number;
	deletions: number;
	impactScore: number;
	riskLevel: "low" | "medium" | "high" | "critical";
	affectedModules: string[];
	potentialConflicts: Conflict[];
	recommendations: string[];
}

export interface FileChange {
	path: string;
	status: "added" | "modified" | "deleted" | "renamed";
	additions: number;
	deletions: number;
	hunks: Hunk[];
	imports: string[];
	exports: string[];
}

export interface Hunk {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	content: string;
}

export interface Conflict {
	type: "import" | "export" | "function" | "type" | "dependency";
	file: string;
	description: string;
	severity: "warning" | "error";
	suggestion: string;
}

export interface ImpactPrediction {
	affectedFiles: string[];
	affectedTests: string[];
	breakingChanges: string[];
	suggestedTests: string[];
	estimatedEffort: "minimal" | "low" | "medium" | "high";
}

export interface DiffAwarePlanningStats {
	analysesRun: number;
	conflictsDetected: number;
	recommendationsProvided: number;
	averageImpactScore: number;
	filesAnalyzed: number;
	lastAnalysis: string | null;
}

export interface DiffAwarePlanningConfig {
	enabled: boolean;
	autoAnalyzeBeforeEdit: boolean;
	maxFilesToAnalyze: number;
	riskThreshold: "low" | "medium" | "high" | "critical";
}

const DEFAULT_CONFIG: DiffAwarePlanningConfig = {
	enabled: true,
	autoAnalyzeBeforeEdit: false,
	maxFilesToAnalyze: 50,
	riskThreshold: "medium",
};

const DATA_DIR = path.join(process.env.HOME || "~", ".paimon");
const STATE_FILE = path.join(DATA_DIR, "diff-aware-planning.json");

class DiffAwarePlanningManager {
	private stats: DiffAwarePlanningStats = {
		analysesRun: 0,
		conflictsDetected: 0,
		recommendationsProvided: 0,
		averageImpactScore: 0,
		filesAnalyzed: 0,
		lastAnalysis: null,
	};

	private config: DiffAwarePlanningConfig = { ...DEFAULT_CONFIG };

	constructor() {
		this.loadState();
	}

	analyzeDiff(targetFiles?: string[]): DiffAnalysis {
		const files = this.getGitDiff(targetFiles);
		const additions = files.reduce((sum, f) => sum + f.additions, 0);
		const deletions = files.reduce((sum, f) => sum + f.deletions, 0);

		const affectedModules = this.detectAffectedModules(files);
		const potentialConflicts = this.detectConflicts(files);
		const impactScore = this.calculateImpactScore(files, potentialConflicts);
		const riskLevel = this.determineRiskLevel(impactScore, potentialConflicts);
		const recommendations = this.generateRecommendations(files, potentialConflicts, riskLevel);

		this.stats.analysesRun++;
		this.stats.conflictsDetected += potentialConflicts.length;
		this.stats.recommendationsProvided += recommendations.length;
		this.stats.filesAnalyzed += files.length;
		this.stats.averageImpactScore =
			(this.stats.averageImpactScore * (this.stats.analysesRun - 1) + impactScore) /
			this.stats.analysesRun;
		this.stats.lastAnalysis = new Date().toISOString();
		this.saveState();

		return {
			files,
			additions,
			deletions,
			impactScore,
			riskLevel,
			affectedModules,
			potentialConflicts,
			recommendations,
		};
	}

	predictImpact(files: string[], changes: string[]): ImpactPrediction {
		const affectedFiles = this.findAffectedFiles(files);
		const affectedTests = this.findAffectedTests(files);
		const breakingChanges = this.detectBreakingChanges(files, changes);
		const suggestedTests = this.suggestTests(files, changes);
		const estimatedEffort = this.estimateEffort(files, breakingChanges);
		return { affectedFiles, affectedTests, breakingChanges, suggestedTests, estimatedEffort };
	}

	getSafeImplementationPlan(files: string[]): {
		phases: { name: string; files: string[]; risks: string[] }[];
		totalRisk: "low" | "medium" | "high" | "critical";
		preChecks: string[];
		postChecks: string[];
	} {
		const analysis = this.analyzeDiff(files);
		const phases = this.createImplementationPhases(analysis);
		const preChecks = this.generatePreChecks(analysis);
		const postChecks = this.generatePostChecks(analysis);
		return { phases, totalRisk: analysis.riskLevel, preChecks, postChecks };
	}

	areChangesSafe(files: string[]): { safe: boolean; warnings: string[]; blockers: string[] } {
		const analysis = this.analyzeDiff(files);
		const warnings: string[] = [];
		const blockers: string[] = [];

		for (const conflict of analysis.potentialConflicts) {
			if (conflict.severity === "error") {
				blockers.push(`${conflict.file}: ${conflict.description}`);
			} else {
				warnings.push(`${conflict.file}: ${conflict.description}`);
			}
		}

		if (analysis.riskLevel === "critical")
			blockers.push("Overall risk level is critical - manual review required");
		else if (analysis.riskLevel === "high")
			warnings.push("High risk changes detected - proceed with caution");
		if (analysis.files.length > this.config.maxFilesToAnalyze)
			warnings.push(
				`Large change set (${analysis.files.length} files) - consider breaking into smaller changes`,
			);

		return { safe: blockers.length === 0, warnings, blockers };
	}

	private getGitDiff(targetFiles?: string[]): FileChange[] {
		try {
			const files: FileChange[] = [];
			let diffCommand = "git diff --name-status HEAD";
			if (targetFiles && targetFiles.length > 0)
				diffCommand = `${diffCommand} -- ${targetFiles.join(" ")}`;

			const nameStatusOutput = execSync(diffCommand, {
				encoding: "utf-8",
				cwd: process.cwd(),
			}).trim();
			if (!nameStatusOutput) return files;

			const changedFiles = nameStatusOutput.split("\n").filter(Boolean);
			for (const line of changedFiles) {
				const [status, ...pathParts] = line.split("\t");
				const filePath = pathParts.join("\t");
				const fileDiff = this.getFileDiff(filePath);
				if (fileDiff) {
					files.push({ path: filePath, status: this.parseStatus(status), ...fileDiff });
				}
			}
			return files;
		} catch {
			return [];
		}
	}

	private getFileDiff(filePath: string): {
		additions: number;
		deletions: number;
		hunks: Hunk[];
		imports: string[];
		exports: string[];
	} | null {
		try {
			const diffOutput = execSync(`git diff HEAD -- "${filePath}"`, {
				encoding: "utf-8",
				cwd: process.cwd(),
			}).trim();
			if (!diffOutput) return null;

			const lines = diffOutput.split("\n");
			let additions = 0;
			let deletions = 0;
			const hunks: Hunk[] = [];
			const imports: string[] = [];
			const exports: string[] = [];
			let currentHunk: Hunk | null = null;
			const hunkContent: string[] = [];

			for (const line of lines) {
				if (line.startsWith("+") && !line.startsWith("+++")) {
					additions++;
					const importMatch = line.match(/^import\s+.*from\s+['"](.+)['"]/);
					if (importMatch) imports.push(importMatch[1]);
				} else if (line.startsWith("-") && !line.startsWith("---")) {
					deletions++;
				}

				const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
				if (hunkMatch) {
					if (currentHunk) {
						currentHunk.content = hunkContent.join("\n");
						hunks.push(currentHunk);
					}
					currentHunk = {
						oldStart: Number.parseInt(hunkMatch[1]),
						oldLines: Number.parseInt(hunkMatch[2] || "1"),
						newStart: Number.parseInt(hunkMatch[3]),
						newLines: Number.parseInt(hunkMatch[4] || "1"),
						content: "",
					};
					hunkContent.length = 0;
				} else if (currentHunk) {
					hunkContent.push(line);
				}

				const exportMatch = line.match(
					/^export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/,
				);
				if (exportMatch) exports.push(exportMatch[1]);
			}

			if (currentHunk) {
				currentHunk.content = hunkContent.join("\n");
				hunks.push(currentHunk);
			}
			return { additions, deletions, hunks, imports, exports };
		} catch {
			return null;
		}
	}

	private parseStatus(status: string): FileChange["status"] {
		switch (status) {
			case "A":
				return "added";
			case "M":
				return "modified";
			case "D":
				return "deleted";
			case "R":
				return "renamed";
			default:
				return "modified";
		}
	}

	private detectAffectedModules(files: FileChange[]): string[] {
		const modules = new Set<string>();
		for (const file of files) {
			const parts = file.path.split("/");
			if (parts.length > 1) modules.add(parts[0]);
			for (const imp of file.imports) {
				if (!imp.startsWith(".") && !imp.startsWith("src/")) modules.add(imp.split("/")[0]);
			}
		}
		return Array.from(modules);
	}

	private detectConflicts(files: FileChange[]): Conflict[] {
		const conflicts: Conflict[] = [];
		for (const file of files) {
			if (file.status === "deleted") {
				conflicts.push({
					type: "dependency",
					file: file.path,
					description: "File is deleted but may be imported by other files",
					severity: "warning",
					suggestion: "Search for imports of this file and update them",
				});
			}
			if (file.exports.length > 0 && file.imports.length === 0 && file.status === "added") {
				conflicts.push({
					type: "export",
					file: file.path,
					description: "New file with exports but no imports - may be isolated",
					severity: "warning",
					suggestion: "Verify this module is properly connected to the codebase",
				});
			}
			const totalChanges = file.additions + file.deletions;
			if (totalChanges > 100) {
				conflicts.push({
					type: "function",
					file: file.path,
					description: `Large change (${totalChanges} lines) - higher risk`,
					severity: "warning",
					suggestion: "Consider breaking into smaller changes",
				});
			}
		}
		return conflicts;
	}

	private calculateImpactScore(files: FileChange[], conflicts: Conflict[]): number {
		let score = 0;
		score += Math.min(files.length * 2, 20);
		const totalLines = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
		score += Math.min(totalLines / 10, 30);
		const errorCount = conflicts.filter((c) => c.severity === "error").length;
		const warnCount = conflicts.filter((c) => c.severity === "warning").length;
		score += errorCount * 15 + warnCount * 5;
		score += Math.min(this.detectAffectedModules(files).length * 3, 15);
		return Math.min(score, 100);
	}

	private determineRiskLevel(score: number, conflicts: Conflict[]): DiffAnalysis["riskLevel"] {
		if (score >= 75 || conflicts.some((c) => c.severity === "error")) return "critical";
		if (score >= 50) return "high";
		if (score >= 25) return "medium";
		return "low";
	}

	private generateRecommendations(
		files: FileChange[],
		conflicts: Conflict[],
		riskLevel: DiffAnalysis["riskLevel"],
	): string[] {
		const recommendations: string[] = [];
		if (riskLevel === "critical") {
			recommendations.push("Consider breaking changes into smaller, focused commits");
			recommendations.push("Run full test suite before and after changes");
		} else if (riskLevel === "high") {
			recommendations.push("Review changes carefully before committing");
			recommendations.push("Run affected tests to verify functionality");
		}
		const deletedFiles = files.filter((f) => f.status === "deleted");
		if (deletedFiles.length > 0)
			recommendations.push(
				`Verify no imports reference deleted files: ${deletedFiles.map((f) => f.path).join(", ")}`,
			);
		for (const c of conflicts) recommendations.push(c.suggestion);
		const hasTests = files.some((f) => f.path.includes(".test.") || f.path.includes(".spec."));
		if (!hasTests && files.some((f) => f.path.startsWith("src/")))
			recommendations.push("Consider adding tests for source file changes");
		return recommendations;
	}

	private findAffectedFiles(files: string[]): string[] {
		const affected: Set<string> = new Set(files);
		for (const file of files) {
			try {
				const baseName = path.basename(file, ".ts");
				const result = execSync(
					`grep -rl "from ['\\"].*${baseName}" src/ --include="*.ts" 2>/dev/null || true`,
					{ encoding: "utf-8", cwd: process.cwd() },
				).trim();
				if (result) {
					for (const f of result.split("\n")) {
						affected.add(f);
					}
				}
			} catch {
				/* ignore */
			}
		}
		return Array.from(affected);
	}

	private findAffectedTests(files: string[]): string[] {
		const tests: string[] = [];
		for (const file of files) {
			if (file.includes(".test.") || file.includes(".spec.")) {
				tests.push(file);
				continue;
			}
			const testFile = file.replace(".ts", ".test.ts");
			const specFile = file.replace(".ts", ".spec.ts");
			try {
				if (fs.existsSync(testFile)) tests.push(testFile);
				if (fs.existsSync(specFile)) tests.push(specFile);
			} catch {
				/* ignore */
			}
		}
		return tests;
	}

	private detectBreakingChanges(_files: string[], changes: string[]): string[] {
		const breaking: string[] = [];
		for (const change of changes) {
			if (change.includes("-export "))
				breaking.push("Export removal detected - may break dependent modules");
			if (change.includes("-interface ") || change.includes("-type "))
				breaking.push("Type definition change - may cause TypeScript errors");
		}
		return breaking;
	}

	private suggestTests(files: string[], _changes: string[]): string[] {
		const suggested = files
			.filter((f) => f.startsWith("src/"))
			.map((f) => f.replace(".ts", ".test.ts"));
		return [...new Set(suggested)];
	}

	private estimateEffort(
		files: string[],
		breakingChanges: string[],
	): ImpactPrediction["estimatedEffort"] {
		if (files.length > 20 || breakingChanges.length > 3) return "high";
		if (files.length > 10 || breakingChanges.length > 1) return "medium";
		if (files.length > 3) return "low";
		return "minimal";
	}

	private createImplementationPhases(
		analysis: DiffAnalysis,
	): { name: string; files: string[]; risks: string[] }[] {
		const phases: { name: string; files: string[]; risks: string[] }[] = [];
		const byModule: Map<string, string[]> = new Map();
		for (const file of analysis.files) {
			const module = file.path.split("/")[0] || "root";
			if (!byModule.has(module)) byModule.set(module, []);
			const modList = byModule.get(module);
			if (modList) {
				modList.push(file.path);
			}
		}
		let phaseNum = 1;
		for (const [module, moduleFiles] of byModule) {
			const risks = analysis.potentialConflicts
				.filter((c) => moduleFiles.some((f) => c.file.startsWith(module)))
				.map((c) => c.description);
			phases.push({ name: `Phase ${phaseNum}: ${module} module`, files: moduleFiles, risks });
			phaseNum++;
		}
		return phases;
	}

	private generatePreChecks(analysis: DiffAnalysis): string[] {
		return [
			"Run `npm run build` to ensure no TypeScript errors",
			"Run `npm test -- --run` to verify current state",
			"Review conflict warnings before proceeding",
			analysis.riskLevel === "critical"
				? "Consider creating a checkpoint"
				: "Proceed with normal workflow",
		];
	}

	private generatePostChecks(_analysis: DiffAnalysis): string[] {
		return [
			"Run `npm run build` to verify compilation",
			"Run `npm test -- --run` to verify tests pass",
			"Run `npm run lint` to check code quality",
			"Review changed files for any unintended modifications",
		];
	}

	private loadState(): void {
		try {
			if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
			if (fs.existsSync(STATE_FILE)) {
				const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
				this.stats = { ...this.stats, ...data.stats };
				this.config = { ...this.config, ...data.config };
			}
		} catch {
			/* use defaults */
		}
	}

	private saveState(): void {
		try {
			if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
			fs.writeFileSync(
				STATE_FILE,
				JSON.stringify({ stats: this.stats, config: this.config }, null, 2),
			);
		} catch {
			/* ignore */
		}
	}

	getStats(): DiffAwarePlanningStats {
		return { ...this.stats };
	}
	getConfig(): DiffAwarePlanningConfig {
		return { ...this.config };
	}
	updateConfig(updates: Partial<DiffAwarePlanningConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}
	reset(): void {
		this.stats = {
			analysesRun: 0,
			conflictsDetected: 0,
			recommendationsProvided: 0,
			averageImpactScore: 0,
			filesAnalyzed: 0,
			lastAnalysis: null,
		};
		this.config = { ...DEFAULT_CONFIG };
		this.saveState();
	}
	formatStats(): string {
		return `## Diff-Aware Planning Statistics\n\n**Analyses Run:** ${this.stats.analysesRun}\n**Conflicts Detected:** ${this.stats.conflictsDetected}\n**Recommendations Provided:** ${this.stats.recommendationsProvided}\n**Average Impact Score:** ${this.stats.averageImpactScore.toFixed(1)}\n**Files Analyzed:** ${this.stats.filesAnalyzed}\n**Last Analysis:** ${this.stats.lastAnalysis || "Never"}`;
	}
}

let instance: DiffAwarePlanningManager | null = null;
export function getDiffAwarePlanningManager(): DiffAwarePlanningManager {
	if (!instance) instance = new DiffAwarePlanningManager();
	return instance;
}

export const diffAwarePlanningToolDef = {
	name: "diffAwarePlan",
	description:
		"Analyze git diffs for impact prediction and safer implementation planning (Devin Pattern)",
	parameters: {
		type: "object",
		properties: {
			action: {
				type: "string",
				enum: ["analyze", "predict", "plan", "check", "stats", "config", "reset", "help"],
				description: "Action to perform",
			},
			files: {
				type: "array",
				items: { type: "string" },
				description: "Files to analyze (optional)",
			},
			changes: {
				type: "array",
				items: { type: "string" },
				description: "Proposed changes for impact prediction",
			},
		},
		required: ["action"],
	},
};
