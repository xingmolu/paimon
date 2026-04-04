/**
 * Model Migration Module (Claude Code Pattern)
 *
 * Helps migrate code and prompts between LLM model versions.
 * Inspired by Claude Code's claude-opus-4-5-migration plugin.
 *
 * Handles:
 * - Model string updates (e.g., "claude-3-sonnet" → "claude-sonnet-4")
 * - Beta header adjustments
 * - Prompt adjustments for new model capabilities
 * - API endpoint changes
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface ModelMigration {
	id: string;
	fromModel: string;
	toModel: string;
	fromVersion: string;
	toVersion: string;
	changes: ModelChange[];
	status: "pending" | "in_progress" | "completed" | "failed";
	createdAt: string;
	completedAt?: string;
	errors?: string[];
}

export interface ModelChange {
	type: "model_string" | "beta_header" | "api_endpoint" | "prompt_adjustment" | "config";
	file: string;
	line: number;
	oldValue: string;
	newValue: string;
	description: string;
	applied: boolean;
}

export interface MigrationRule {
	fromPattern: RegExp;
	toReplacement: string;
	description: string;
	filePatterns: string[];
	priority: number;
}

export interface ModelMigrationConfig {
	enabled: boolean;
	migrationsDir: string;
	autoApply: boolean;
	backupFiles: boolean;
	dryRun: boolean;
	supportedMigrations: string[];
}

export interface ModelMigrationStats {
	totalMigrations: number;
	successfulMigrations: number;
	failedMigrations: number;
	filesModified: number;
	changesApplied: number;
	lastMigration?: string;
	commonPatterns: { pattern: string; count: number }[];
}

// Default migration rules for common model transitions
const DEFAULT_MIGRATION_RULES: MigrationRule[] = [
	{
		fromPattern: /claude-3-5-sonnet|claude-3\.5-sonnet/gi,
		toReplacement: "claude-sonnet-4",
		description: "Migrate Claude 3.5 Sonnet to Sonnet 4",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /claude-3-opus|claude-3\.0-opus/gi,
		toReplacement: "claude-opus-4",
		description: "Migrate Claude 3 Opus to Opus 4",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /claude-3-sonnet|claude-3\.0-sonnet/gi,
		toReplacement: "claude-sonnet-4",
		description: "Migrate Claude 3 Sonnet to Sonnet 4",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /claude-3-haiku|claude-3\.0-haiku/gi,
		toReplacement: "claude-haiku-3.5",
		description: "Migrate Claude 3 Haiku to Haiku 3.5",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /claude-2\.[01]|claude-2/gi,
		toReplacement: "claude-sonnet-4",
		description: "Migrate Claude 2.x to Sonnet 4",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 2,
	},
	{
		fromPattern: /anthropic-beta:\s*max-tokens-3-5-sonnet/gi,
		toReplacement: "anthropic-beta: max-tokens-4-sonnet",
		description: "Update beta header for Sonnet 4",
		filePatterns: ["*.ts", "*.js", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /anthropic-beta:\s*messages-2023-12-15/gi,
		toReplacement: "anthropic-beta: messages-2024-01-01",
		description: "Update beta header to latest version",
		filePatterns: ["*.ts", "*.js", "*.py"],
		priority: 2,
	},
	{
		fromPattern: /api\.anthropic\.com\/v1\/complete/gi,
		toReplacement: "api.anthropic.com/v1/messages",
		description: "Migrate from legacy complete to messages endpoint",
		filePatterns: ["*.ts", "*.js", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /gpt-4-32k/gi,
		toReplacement: "gpt-4-turbo",
		description: "Migrate GPT-4-32k to GPT-4-Turbo",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /gpt-3\.5-turbo-16k/gi,
		toReplacement: "gpt-4o-mini",
		description: "Migrate GPT-3.5-Turbo-16k to GPT-4o-Mini",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 1,
	},
	{
		fromPattern: /gpt-3\.5-turbo/gi,
		toReplacement: "gpt-4o-mini",
		description: "Migrate GPT-3.5-Turbo to GPT-4o-Mini",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 2,
	},
	{
		fromPattern: /deepseek-coder/gi,
		toReplacement: "deepseek-chat",
		description: "Migrate DeepSeek Coder to DeepSeek Chat",
		filePatterns: ["*.ts", "*.js", "*.json", "*.md", "*.py"],
		priority: 1,
	},
];

const DEFAULT_CONFIG: ModelMigrationConfig = {
	enabled: true,
	migrationsDir: ".paimon/migrations",
	autoApply: false,
	backupFiles: true,
	dryRun: false,
	supportedMigrations: [
		"claude-3-to-4",
		"claude-3.5-to-4",
		"openai-gpt3.5-to-4o",
		"openai-gpt4-to-turbo",
		"deepseek-coder-to-chat",
	],
};

let migrationManagerInstance: ModelMigrationManager | null = null;

export class ModelMigrationManager {
	private config: ModelMigrationConfig;
	private migrations: ModelMigration[] = [];
	private rules: MigrationRule[];
	private stats: ModelMigrationStats;
	private dataPath: string;

	constructor(configPath?: string) {
		this.config = { ...DEFAULT_CONFIG };
		this.rules = [...DEFAULT_MIGRATION_RULES];
		this.dataPath = path.join(process.env.HOME || ".", ".paimon", "model-migrations.json");
		this.stats = {
			totalMigrations: 0,
			successfulMigrations: 0,
			failedMigrations: 0,
			filesModified: 0,
			changesApplied: 0,
			commonPatterns: [],
		};
		this.loadConfig();
		this.loadData();
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || ".";
			const configPath = path.join(homeDir, ".paimon", "model-migration-config.json");
			if (fs.existsSync(configPath)) {
				const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...loaded };
			}
		} catch {
			// Use defaults
		}
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.migrations = data.migrations || [];
				this.stats = data.stats || this.stats;
			}
		} catch {
			// Start fresh
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						migrations: this.migrations,
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save model migration data:", error);
		}
	}

	private updateStats(pattern: string): void {
		const existing = this.stats.commonPatterns.find((p) => p.pattern === pattern);
		if (existing) {
			existing.count++;
		} else {
			this.stats.commonPatterns.push({ pattern, count: 1 });
		}
		this.stats.commonPatterns.sort((a, b) => b.count - a.count);
		this.stats.commonPatterns = this.stats.commonPatterns.slice(0, 10);
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public getConfig(): ModelMigrationConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<ModelMigrationConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public getRules(): MigrationRule[] {
		return [...this.rules];
	}

	public addRule(rule: MigrationRule): void {
		this.rules.push(rule);
		this.rules.sort((a, b) => a.priority - b.priority);
	}

	public removeRule(pattern: string): boolean {
		const index = this.rules.findIndex((r) => r.fromPattern.source === pattern);
		if (index !== -1) {
			this.rules.splice(index, 1);
			return true;
		}
		return false;
	}

	public getSupportedMigrations(): string[] {
		return [...this.config.supportedMigrations];
	}

	public scanFile(filePath: string): ModelChange[] {
		const changes: ModelChange[] = [];

		if (!fs.existsSync(filePath)) {
			return changes;
		}

		const ext = path.extname(filePath);
		const content = fs.readFileSync(filePath, "utf-8");
		const lines = content.split("\n");

		for (const rule of this.rules) {
			const applies = rule.filePatterns.some((p) => p.endsWith(ext) || p === "*");
			if (!applies) {
				continue;
			}

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const matches = line.matchAll(rule.fromPattern);

				for (const match of matches) {
					changes.push({
						type: this.getChangeType(rule),
						file: filePath,
						line: i + 1,
						oldValue: match[0],
						newValue: rule.toReplacement,
						description: rule.description,
						applied: false,
					});
				}
			}
		}

		return changes;
	}

	private getChangeType(rule: MigrationRule): ModelChange["type"] {
		const source = rule.fromPattern.source;
		if (source.includes("claude") || source.includes("gpt")) {
			if (source.includes("beta")) {
				return "beta_header";
			}
			if (source.includes("api")) {
				return "api_endpoint";
			}
			return "model_string";
		}
		return "config";
	}

	public scanDirectory(dir: string, recursive = true): ModelChange[] {
		const changes: ModelChange[] = [];

		if (!fs.existsSync(dir)) {
			return changes;
		}

		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.name.startsWith(".") || entry.name === "node_modules") {
				continue;
			}

			if (entry.isDirectory() && recursive) {
				changes.push(...this.scanDirectory(fullPath, recursive));
			} else if (entry.isFile()) {
				changes.push(...this.scanFile(fullPath));
			}
		}

		return changes;
	}

	public applyChange(change: ModelChange, dryRun = false): boolean {
		if (!fs.existsSync(change.file)) {
			return false;
		}

		if (dryRun || this.config.dryRun) {
			return true;
		}

		try {
			const content = fs.readFileSync(change.file, "utf-8");
			const lines = content.split("\n");

			if (change.line <= 0 || change.line > lines.length) {
				return false;
			}

			const lineIndex = change.line - 1;
			const line = lines[lineIndex];

			if (!line.includes(change.oldValue)) {
				return false;
			}

			if (this.config.backupFiles) {
				const backupPath = `${change.file}.migration-backup`;
				if (!fs.existsSync(backupPath)) {
					fs.copyFileSync(change.file, backupPath);
				}
			}

			lines[lineIndex] = line.replace(change.oldValue, change.newValue);
			fs.writeFileSync(change.file, lines.join("\n"));

			change.applied = true;
			this.stats.changesApplied++;
			this.updateStats(change.oldValue);

			return true;
		} catch {
			return false;
		}
	}

	public applyChanges(
		changes: ModelChange[],
		dryRun = false,
	): {
		applied: number;
		failed: number;
		errors: string[];
	} {
		const result = { applied: 0, failed: 0, errors: [] as string[] };
		const modifiedFiles = new Set<string>();

		for (const change of changes) {
			if (this.applyChange(change, dryRun)) {
				result.applied++;
				change.applied = true;
				modifiedFiles.add(change.file);
			} else {
				result.failed++;
				result.errors.push(`Failed at ${change.file}:${change.line}`);
			}
		}

		this.stats.filesModified += modifiedFiles.size;

		return result;
	}

	public createMigration(fromModel: string, toModel: string, targetPath: string): ModelMigration {
		const changes = this.scanDirectory(targetPath);

		const migration: ModelMigration = {
			id: `migration-${Date.now()}`,
			fromModel,
			toModel,
			fromVersion: this.extractVersion(fromModel),
			toVersion: this.extractVersion(toModel),
			changes: changes.filter(
				(c) =>
					c.oldValue.toLowerCase().includes(fromModel.toLowerCase()) ||
					c.newValue.toLowerCase().includes(toModel.toLowerCase()),
			),
			status: "pending",
			createdAt: new Date().toISOString(),
		};

		this.migrations.push(migration);
		this.stats.totalMigrations++;
		this.saveData();

		return migration;
	}

	private extractVersion(model: string): string {
		const match = model.match(/\d+(\.\d+)?/);
		return match ? match[0] : "unknown";
	}

	public executeMigration(
		migrationId: string,
		dryRun = false,
	): {
		success: boolean;
		applied: number;
		failed: number;
		errors: string[];
	} {
		const migration = this.migrations.find((m) => m.id === migrationId);
		if (!migration) {
			return { success: false, applied: 0, failed: 0, errors: ["Migration not found"] };
		}

		migration.status = "in_progress";
		this.saveData();

		const result = this.applyChanges(migration.changes, dryRun);

		if (result.failed === 0) {
			migration.status = "completed";
			migration.completedAt = new Date().toISOString();
			this.stats.successfulMigrations++;
		} else {
			migration.status = "failed";
			migration.errors = result.errors;
			this.stats.failedMigrations++;
		}

		this.stats.lastMigration = migration.id;
		this.saveData();

		return { success: result.failed === 0, ...result };
	}

	public getMigration(migrationId: string): ModelMigration | undefined {
		return this.migrations.find((m) => m.id === migrationId);
	}

	public listMigrations(
		status?: "pending" | "in_progress" | "completed" | "failed",
	): ModelMigration[] {
		if (status) {
			return this.migrations.filter((m) => m.status === status);
		}
		return [...this.migrations];
	}

	public rollbackMigration(migrationId: string): boolean {
		const migration = this.migrations.find((m) => m.id === migrationId);
		if (!migration || migration.status !== "completed") {
			return false;
		}

		let rolledBack = 0;
		for (const change of migration.changes) {
			const backupPath = `${change.file}.migration-backup`;
			if (fs.existsSync(backupPath)) {
				fs.copyFileSync(backupPath, change.file);
				fs.unlinkSync(backupPath);
				rolledBack++;
			}
		}

		if (rolledBack > 0) {
			migration.status = "pending";
			migration.completedAt = undefined;
			this.stats.successfulMigrations--;
			this.saveData();
		}

		return rolledBack > 0;
	}

	public getStats(): ModelMigrationStats {
		return { ...this.stats };
	}

	public resetStats(): void {
		this.stats = {
			totalMigrations: 0,
			successfulMigrations: 0,
			failedMigrations: 0,
			filesModified: 0,
			changesApplied: 0,
			commonPatterns: [],
		};
		this.saveData();
	}

	public formatMigration(migration: ModelMigration): string {
		const lines: string[] = [
			`## Migration: ${migration.id}`,
			"",
			`**From:** ${migration.fromModel} (v${migration.fromVersion})`,
			`**To:** ${migration.toModel} (v${migration.toVersion})`,
			`**Status:** ${migration.status}`,
			`**Created:** ${migration.createdAt}`,
			"",
			`**Changes:** ${migration.changes.length} potential changes`,
		];

		if (migration.completedAt) {
			lines.push(`**Completed:** ${migration.completedAt}`);
		}

		if (migration.errors && migration.errors.length > 0) {
			lines.push("", "**Errors:**");
			for (const error of migration.errors) {
				lines.push(`- ${error}`);
			}
		}

		const preview = migration.changes.slice(0, 5);
		if (preview.length > 0) {
			lines.push("", "### Changes Preview", "");
			for (const change of preview) {
				lines.push(
					`- ${change.file}:${change.line}`,
					`  \`${change.oldValue}\` -> \`${change.newValue}\``,
					`  ${change.description}`,
				);
			}
			if (migration.changes.length > 5) {
				lines.push(`  ... and ${migration.changes.length - 5} more`);
			}
		}

		return lines.join("\n");
	}

	public formatStats(): string {
		const lines: string[] = [
			"## Model Migration Statistics",
			"",
			`Total Migrations: ${this.stats.totalMigrations}`,
			`Successful: ${this.stats.successfulMigrations}`,
			`Failed: ${this.stats.failedMigrations}`,
			`Files Modified: ${this.stats.filesModified}`,
			`Changes Applied: ${this.stats.changesApplied}`,
		];

		if (this.stats.lastMigration) {
			lines.push(`Last Migration: ${this.stats.lastMigration}`);
		}

		if (this.stats.commonPatterns.length > 0) {
			lines.push("", "### Common Patterns", "");
			const patterns = this.stats.commonPatterns.slice(0, 5);
			for (const item of patterns) {
				lines.push(`- ${item.pattern}: ${item.count} occurrences`);
			}
		}

		return lines.join("\n");
	}

	public getHelp(): string {
		const migrations = this.config.supportedMigrations.map((m) => `- ${m}`).join("\n");
		return `
## Model Migration Tool

Migrate code and prompts between LLM model versions.

### Supported Migrations
${migrations}

### Actions
- **scan**: Scan a file or directory for migration opportunities
- **create**: Create a new migration plan
- **execute**: Execute a migration
- **list**: List all migrations
- **status**: Get migration status
- **rollback**: Rollback a completed migration
- **rules**: View or manage migration rules
- **stats**: View migration statistics

### Examples
\`\`\`
modelMigration({action: 'scan', path: 'src/'})
modelMigration({action: 'create', fromModel: 'claude-3', toModel: 'claude-4', path: '.'})
modelMigration({action: 'execute', migrationId: 'migration-123'})
modelMigration({action: 'rollback', migrationId: 'migration-123'})
\`\`\`
`.trim();
	}
}

export function getModelMigrationManager(): ModelMigrationManager {
	if (!migrationManagerInstance) {
		migrationManagerInstance = new ModelMigrationManager();
	}
	return migrationManagerInstance;
}

export function initModelMigrationManager(configPath?: string): ModelMigrationManager {
	migrationManagerInstance = new ModelMigrationManager(configPath);
	return migrationManagerInstance;
}

export function modelMigrationTool(args: {
	action: string;
	path?: string;
	fromModel?: string;
	toModel?: string;
	migrationId?: string;
	recursive?: boolean;
	dryRun?: boolean;
	rule?: MigrationRule;
	pattern?: string;
}): string {
	const manager = getModelMigrationManager();

	switch (args.action) {
		case "scan": {
			if (!args.path) {
				return "Error: path required for scan action";
			}
			const targetPath = path.resolve(args.path);
			const isDir = fs.statSync(targetPath).isDirectory();
			const changes = isDir
				? manager.scanDirectory(targetPath, args.recursive !== false)
				: manager.scanFile(targetPath);

			if (changes.length === 0) {
				return `No migration opportunities found in ${targetPath}`;
			}

			const lines = [
				"## Migration Scan Results",
				"",
				`Found ${changes.length} potential changes:`,
				"",
			];

			const byFile = new Map<string, ModelChange[]>();
			for (const change of changes) {
				const existing = byFile.get(change.file) || [];
				existing.push(change);
				byFile.set(change.file, existing);
			}

			for (const [file, fileChanges] of byFile) {
				lines.push(`### ${file}`);
				for (const change of fileChanges) {
					lines.push(
						`- L${change.line}: \`${change.oldValue}\` -> \`${change.newValue}\``,
						`  ${change.description}`,
					);
				}
				lines.push("");
			}

			return lines.join("\n");
		}

		case "create": {
			if (!args.fromModel || !args.toModel || !args.path) {
				return "Error: fromModel, toModel, and path required for create action";
			}
			const migration = manager.createMigration(
				args.fromModel,
				args.toModel,
				path.resolve(args.path),
			);
			return manager.formatMigration(migration);
		}

		case "execute": {
			if (!args.migrationId) {
				return "Error: migrationId required for execute action";
			}
			const result = manager.executeMigration(args.migrationId, args.dryRun);
			if (result.success) {
				return `Migration completed successfully. Applied ${result.applied} changes.`;
			}
			return `Migration failed. Applied ${result.applied}, failed ${result.failed}.\nErrors:\n${result.errors.join("\n")}`;
		}

		case "list": {
			const migrations = manager.listMigrations();
			if (migrations.length === 0) {
				return "No migrations found.";
			}
			const lines = ["## Migrations", ""];
			for (const m of migrations) {
				lines.push(
					`- ${m.id}: ${m.fromModel} -> ${m.toModel} (${m.status})`,
					`  Changes: ${m.changes.length}, Created: ${m.createdAt}`,
				);
			}
			return lines.join("\n");
		}

		case "status": {
			if (!args.migrationId) {
				return manager.formatStats();
			}
			const migration = manager.getMigration(args.migrationId);
			if (!migration) {
				return `Migration ${args.migrationId} not found.`;
			}
			return manager.formatMigration(migration);
		}

		case "rollback": {
			if (!args.migrationId) {
				return "Error: migrationId required for rollback action";
			}
			if (manager.rollbackMigration(args.migrationId)) {
				return `Migration ${args.migrationId} rolled back successfully.`;
			}
			return `Failed to rollback migration ${args.migrationId}.`;
		}

		case "rules": {
			const rules = manager.getRules();
			const lines = ["## Migration Rules", ""];
			for (const rule of rules) {
				lines.push(
					`- Pattern: \`${rule.fromPattern}\` -> \`${rule.toReplacement}\``,
					`  ${rule.description}`,
					`  Files: ${rule.filePatterns.join(", ")}`,
					`  Priority: ${rule.priority}`,
					"",
				);
			}
			return lines.join("\n");
		}

		case "add-rule": {
			if (!args.rule) {
				return "Error: rule object required for add-rule action";
			}
			manager.addRule(args.rule);
			return `Rule added: ${args.rule.description}`;
		}

		case "remove-rule": {
			if (!args.pattern) {
				return "Error: pattern required for remove-rule action";
			}
			if (manager.removeRule(args.pattern)) {
				return `Rule removed: ${args.pattern}`;
			}
			return `Rule not found: ${args.pattern}`;
		}

		case "stats":
			return manager.formatStats();

		case "config":
			return JSON.stringify(manager.getConfig(), null, 2);

		case "migrations":
			return JSON.stringify(manager.getSupportedMigrations(), null, 2);

		case "help":
			return manager.getHelp();

		default:
			return `Unknown action: ${args.action}. Use 'help' for available actions.`;
	}
}
