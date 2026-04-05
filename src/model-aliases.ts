/**
 * Model Aliases Module (Aider Pattern)
 *
 * Allows defining shorthand names for models, making it easier to switch
 * between models during evolution sessions. Supports:
 * - Command-line alias definitions (--alias "fast:gpt-4o-mini")
 * - YAML config file aliases
 * - In-chat alias switching with /model command
 * - Team-shared alias configurations
 *
 * Inspired by Aider's model aliases feature:
 * https://aider.chat/docs/config/model-aliases.html
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Types
export interface ModelAlias {
	name: string;
	modelId: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ModelAliasConfig {
	enabled: boolean;
	aliases: Record<string, ModelAlias>;
	configPath?: string;
}

export interface ModelAliasStats {
	totalAliases: number;
	mostUsedAlias: string | null;
	totalResolutions: number;
	aliasUsage: Record<string, number>;
	configLoads: number;
}

export interface AliasResolutionResult {
	found: boolean;
	alias?: string;
	modelId?: string;
	description?: string;
}

// Default aliases for common models
const DEFAULT_ALIASES: Record<string, ModelAlias> = {
	fast: {
		name: "fast",
		modelId: "gpt-4o-mini",
		description: "Fast and cheap model for quick tasks",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	smart: {
		name: "smart",
		modelId: "claude-3-7-sonnet-20250219",
		description: "Smart model for complex reasoning",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	reasoner: {
		name: "reasoner",
		modelId: "o3-mini",
		description: "Reasoning model for deep analysis",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	deepseek: {
		name: "deepseek",
		modelId: "deepseek-reasoner",
		description: "DeepSeek R1 reasoning model",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
};

const DEFAULT_CONFIG: ModelAliasConfig = {
	enabled: true,
	aliases: DEFAULT_ALIASES,
};

let managerInstance: ModelAliasManager | null = null;

export class ModelAliasManager {
	private config: ModelAliasConfig;
	private stats: ModelAliasStats;
	private dataPath: string;

	constructor(configPath?: string) {
		this.config = { ...DEFAULT_CONFIG, configPath };
		this.dataPath = path.join(os.homedir(), ".paimon", "model-aliases.json");
		this.stats = {
			totalAliases: Object.keys(DEFAULT_ALIASES).length,
			mostUsedAlias: null,
			totalResolutions: 0,
			aliasUsage: {},
			configLoads: 0,
		};
		this.loadConfig();
		this.loadData();
	}

	/**
	 * Load configuration from .paimon-aliases.yml or .paimon/model-aliases.json
	 */
	private loadConfig(): void {
		try {
			// Try YAML config file in project directory
			const yamlPath = path.join(process.cwd(), ".paimon-aliases.yml");
			if (fs.existsSync(yamlPath)) {
				const content = fs.readFileSync(yamlPath, "utf-8");
				this.parseYamlConfig(content);
				this.stats.configLoads++;
				return;
			}

			// Try JSON config file
			const jsonPath = path.join(process.cwd(), ".paimon-aliases.json");
			if (fs.existsSync(jsonPath)) {
				const content = fs.readFileSync(jsonPath, "utf-8");
				const parsed = JSON.parse(content);
				this.mergeAliases(parsed.aliases || {});
				this.stats.configLoads++;
				return;
			}

			// Try .paimon directory config
			const paimonConfigPath = this.dataPath;
			if (fs.existsSync(paimonConfigPath)) {
				const content = fs.readFileSync(paimonConfigPath, "utf-8");
				const parsed = JSON.parse(content);
				this.mergeAliases(parsed.aliases || {});
				this.stats.configLoads++;
			}
		} catch (error) {
			// Use defaults on error
			console.error("Failed to load model alias config:", error);
		}
	}

	/**
	 * Parse YAML config file (simple implementation for alias format)
	 */
	private parseYamlConfig(content: string): void {
		// Simple YAML parsing for alias format:
		// alias:
		//   fast: gpt-4o-mini
		//   smart: o3-mini
		const lines = content.split("\n");
		let inAliasSection = false;

		for (const line of lines) {
			const trimmed = line.trim();

			if (trimmed === "alias:" || trimmed === "aliases:") {
				inAliasSection = true;
				continue;
			}

			if (inAliasSection && trimmed.includes(":")) {
				const [name, modelId] = trimmed.split(":").map((s) => s.trim());
				if (name && modelId) {
					this.addAlias(name, modelId.replace(/["']/g, ""));
				}
			}

			// Exit alias section when we hit another top-level key
			if (
				inAliasSection &&
				line.startsWith("  ") === false &&
				trimmed.length > 0 &&
				!trimmed.includes(":")
			) {
				inAliasSection = false;
			}
		}
	}

	/**
	 * Merge aliases from config
	 */
	private mergeAliases(aliases: Record<string, string | ModelAlias>): void {
		for (const [name, value] of Object.entries(aliases)) {
			if (typeof value === "string") {
				this.addAlias(name, value);
			} else {
				this.config.aliases[name] = value as ModelAlias;
			}
		}
	}

	/**
	 * Load persisted data (stats, usage)
	 */
	private loadData(): void {
		try {
			const statsPath = path.join(os.homedir(), ".paimon", "model-aliases-stats.json");
			if (fs.existsSync(statsPath)) {
				const content = fs.readFileSync(statsPath, "utf-8");
				this.stats = { ...this.stats, ...JSON.parse(content) };
			}
		} catch {
			// Use defaults
		}
	}

	/**
	 * Save persisted data
	 */
	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			// Save aliases
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify({ aliases: this.config.aliases }, null, 2),
				"utf-8",
			);

			// Save stats
			const statsPath = path.join(dir, "model-aliases-stats.json");
			fs.writeFileSync(statsPath, JSON.stringify(this.stats, null, 2), "utf-8");
		} catch (error) {
			console.error("Failed to save model alias data:", error);
		}
	}

	/**
	 * Check if manager is enabled
	 */
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable or disable the manager
	 */
	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): ModelAliasConfig {
		return { ...this.config };
	}

	/**
	 * Add a new alias
	 */
	public addAlias(name: string, modelId: string, description?: string): ModelAlias {
		const now = new Date().toISOString();
		const alias: ModelAlias = {
			name,
			modelId,
			description,
			createdAt: this.config.aliases[name]?.createdAt || now,
			updatedAt: now,
		};
		this.config.aliases[name] = alias;
		this.stats.totalAliases = Object.keys(this.config.aliases).length;
		this.saveData();
		return alias;
	}

	/**
	 * Remove an alias
	 */
	public removeAlias(name: string): boolean {
		if (this.config.aliases[name]) {
			delete this.config.aliases[name];
			this.stats.totalAliases = Object.keys(this.config.aliases).length;
			this.saveData();
			return true;
		}
		return false;
	}

	/**
	 * Get a specific alias
	 */
	public getAlias(name: string): ModelAlias | undefined {
		return this.config.aliases[name];
	}

	/**
	 * List all aliases
	 */
	public listAliases(): ModelAlias[] {
		return Object.values(this.config.aliases);
	}

	/**
	 * Resolve an alias to a model ID
	 * Returns the alias info if found, or the original string if not an alias
	 */
	public resolve(nameOrId: string): AliasResolutionResult {
		const alias = this.config.aliases[nameOrId];
		if (alias) {
			this.stats.totalResolutions++;
			this.stats.aliasUsage[nameOrId] = (this.stats.aliasUsage[nameOrId] || 0) + 1;

			// Update most used alias
			const entries = Object.entries(this.stats.aliasUsage);
			if (entries.length > 0) {
				const [mostUsed] = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
				this.stats.mostUsedAlias = mostUsed;
			}

			this.saveData();
			return {
				found: true,
				alias: nameOrId,
				modelId: alias.modelId,
				description: alias.description,
			};
		}

		// Not an alias, return as-is
		return { found: false };
	}

	/**
	 * Check if a string is a known alias
	 */
	public isAlias(name: string): boolean {
		return name in this.config.aliases;
	}

	/**
	 * Get statistics
	 */
	public getStats(): ModelAliasStats {
		return { ...this.stats };
	}

	/**
	 * Reset statistics
	 */
	public resetStats(): void {
		this.stats = {
			totalAliases: Object.keys(this.config.aliases).length,
			mostUsedAlias: null,
			totalResolutions: 0,
			aliasUsage: {},
			configLoads: 0,
		};
		this.saveData();
	}

	/**
	 * Clear all custom aliases (restore defaults)
	 */
	public clearAliases(): void {
		this.config.aliases = { ...DEFAULT_ALIASES };
		this.stats.totalAliases = Object.keys(this.config.aliases).length;
		this.saveData();
	}

	/**
	 * Import aliases from a configuration object
	 */
	public importAliases(config: Record<string, string | ModelAlias>): number {
		let imported = 0;
		for (const [name, value] of Object.entries(config)) {
			if (typeof value === "string") {
				this.addAlias(name, value);
				imported++;
			} else if (typeof value === "object" && value !== null) {
				const alias = value as ModelAlias;
				this.config.aliases[name] = alias;
				imported++;
			}
		}
		this.stats.totalAliases = Object.keys(this.config.aliases).length;
		this.saveData();
		return imported;
	}

	/**
	 * Export aliases to a configuration object
	 */
	public exportAliases(): Record<string, string> {
		const result: Record<string, string> = {};
		for (const [name, alias] of Object.entries(this.config.aliases)) {
			result[name] = alias.modelId;
		}
		return result;
	}

	/**
	 * Format aliases as YAML for config file
	 */
	public formatAsYaml(): string {
		const lines = ["# Model Aliases Configuration", "alias:"];
		for (const [name, alias] of Object.entries(this.config.aliases)) {
			lines.push(`  ${name}: ${alias.modelId}`);
		}
		return lines.join("\n");
	}

	/**
	 * Format aliases as JSON for config file
	 */
	public formatAsJson(): string {
		return JSON.stringify({ alias: this.exportAliases() }, null, 2);
	}

	/**
	 * Get help text for model aliases
	 */
	public getHelp(): string {
		return `Model Aliases (Aider Pattern)

Model aliases allow you to create shorthand names for models you frequently use.
This is particularly useful for models with long names or when you want to
standardize model usage across your team.

## Defining Aliases

### Command Line
Use the --alias option when launching:
  paimon --alias "fast:gpt-4o-mini" --alias "smart:o3-mini"

### Config File
Create .paimon-aliases.yml in your project:
  alias:
    fast: gpt-4o-mini
    smart: o3-mini

Or .paimon-aliases.json:
  {
    "alias": {
      "fast": "gpt-4o-mini",
      "smart": "o3-mini"
    }
  }

## Using Aliases

Once defined, you can use the alias instead of the full model name:

### Command Line
  paimon --model fast   # Uses gpt-4o-mini

### In-Chat
  /model smart   # Switches to o3-mini

## Available Commands

- modelAliases({action: 'list'}) - List all aliases
- modelAliases({action: 'add', name: 'alias', modelId: 'model-name'}) - Add new alias
- modelAliases({action: 'remove', name: 'alias'}) - Remove alias
- modelAliases({action: 'resolve', name: 'alias'}) - Resolve alias to model ID
- modelAliases({action: 'export', format: 'yaml'|'json'}) - Export aliases
- modelAliases({action: 'import', aliases: {...}}) - Import aliases

## Default Aliases

- fast: gpt-4o-mini (Fast and cheap model for quick tasks)
- smart: claude-3-7-sonnet-20250219 (Smart model for complex reasoning)
- reasoner: o3-mini (Reasoning model for deep analysis)
- deepseek: deepseek-reasoner (DeepSeek R1 reasoning model)

Inspired by Aider's model aliases:
https://aider.chat/docs/config/model-aliases.html`;
	}
}

/**
 * Get or create the singleton manager instance
 */
export function getModelAliasManager(): ModelAliasManager {
	if (!managerInstance) {
		managerInstance = new ModelAliasManager();
	}
	return managerInstance;
}

/**
 * Reset the manager instance (for testing)
 */
export function resetModelAliasManager(): void {
	managerInstance = null;
}
