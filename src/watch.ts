/**
 * Watch Mode/FileWatcher Module (Aider Pattern)
 *
 * Watches source files for changes and AI comment markers.
 * Enables continuous evolution from IDE by detecting comments like:
 * - `# ai! fix this bug` (action request)
 * - `// ai? explain this` (question request)
 * - `/* ai review this *` / (review request)
 *
 * Inspired by Aider's watch.py FileWatcher class.
 */

import { EventEmitter } from "node:events";
import { type FSWatcher, watch } from "node:fs";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

// Types
export type WatchActionType =
	| "execute"
	| "question"
	| "review"
	| "explain"
	| "refactor"
	| "test"
	| "none";

export interface AIComment {
	lineNumber: number;
	content: string;
	actionType: WatchActionType;
	marker: string;
}

export interface FileChange {
	path: string;
	relativePath: string;
	comments: AIComment[];
	actionType: WatchActionType;
	timestamp: number;
}

export interface WatchConfig {
	/** Root directory to watch */
	root: string;
	/** Gitignore patterns to exclude */
	gitignorePatterns?: string[];
	/** File extensions to watch */
	extensions?: string[];
	/** Debounce interval in ms (default: 100) */
	debounceInterval?: number;
	/** Maximum file size to process in bytes (default: 1MB) */
	maxFileSize?: number;
	/** Verbose logging */
	verbose?: boolean;
	/** Auto-add files with AI comments to tracking */
	autoAddFiles?: boolean;
}

export interface WatchStats {
	filesWatched: number;
	changesDetected: number;
	commentsProcessed: number;
	actionsTriggered: number;
	byActionType: Record<WatchActionType, number>;
	byExtension: Record<string, number>;
	startTime: number;
}

// Default configuration
const DEFAULT_CONFIG: Required<Omit<WatchConfig, "root">> = {
	gitignorePatterns: [
		".git",
		"node_modules",
		"dist",
		"build",
		".cache",
		"coverage",
		".pytest_cache",
		"__pycache__",
		"*.log",
		".env",
		".venv",
		"vendor",
		".idea",
		".vscode",
		"*.sublime-*",
		".project",
		".settings",
		"*.code-workspace",
		"*.pyc",
		"*.swp",
		"*.swo",
		"*~",
		"*.bak",
		"*.tmp",
		"*.temp",
		"*.orig",
		".DS_Store",
		"Thumbs.db",
		"*.svg",
		"*.pdf",
	],
	extensions: [
		".ts",
		".tsx",
		".js",
		".jsx",
		".py",
		".rb",
		".go",
		".rs",
		".java",
		".kt",
		".cs",
		".cpp",
		".c",
		".h",
		".hpp",
		".php",
		".swift",
		".scala",
		".clj",
		".ex",
		".exs",
		".erl",
		".hs",
		".ml",
		".mli",
		".lua",
		".r",
		".sql",
		".sh",
		".bash",
		".zsh",
		".ps1",
		".psm1",
		".vue",
		".svelte",
		".html",
		".css",
		".scss",
		".sass",
		".less",
		".json",
		".yaml",
		".yml",
		".toml",
		".md",
		".txt",
	],
	debounceInterval: 100,
	maxFileSize: 1024 * 1024, // 1MB
	verbose: false,
	autoAddFiles: true,
};

// AI comment pattern - supports multiple comment styles
// Matches: # ai, // ai, /* ai, -- ai, ; ai, ;; ai, * ai (in block comments)
const AI_COMMENT_PATTERN = /^(?:#|\/\/|\/\*|\*|--|;;|;)\s*(ai[!?]?|.*\bai[!?]?)\s*$/i;

// Action type patterns
const ACTION_PATTERNS: Record<WatchActionType, RegExp> = {
	execute: /\bai[!!]\b/i, // ai! triggers execution
	question: /\bai[??]\b/i, // ai? triggers question
	review: /\breview\b/i, // ai review
	explain: /\bexplain\b/i, // ai explain
	refactor: /\brefactor\b/i, // ai refactor
	test: /\btest\b/i, // ai test
	none: /^$/, // no action
};

// Comment markers by file extension
const COMMENT_MARKERS: Record<string, string[]> = {
	// Hash-style
	".py": ["#"],
	".rb": ["#"],
	".sh": ["#"],
	".bash": ["#"],
	".zsh": ["#"],
	".ps1": ["#"],
	".psm1": ["#"],
	".yaml": ["#"],
	".yml": ["#"],
	".toml": ["#"],
	".r": ["#"],
	".lua": ["#", "--"],
	".hs": ["#"],
	".ml": ["#", "(*"],
	".mli": ["#", "(*"],
	".clj": [";;"],
	".erl": ["%", "%%"],
	".ex": ["#"],
	".exs": ["#"],
	// Double-slash style
	".ts": ["//", "/*", "*"],
	".tsx": ["//", "/*", "*"],
	".js": ["//", "/*", "*"],
	".jsx": ["//", "/*", "*"],
	".go": ["//", "/*", "*"],
	".java": ["//", "/*", "*"],
	".kt": ["//", "/*", "*"],
	".cs": ["//", "/*", "*"],
	".cpp": ["//", "/*", "*"],
	".c": ["//", "/*", "*"],
	".h": ["//", "/*", "*"],
	".hpp": ["//", "/*", "*"],
	".php": ["//", "#", "/*", "*"],
	".swift": ["//", "/*", "*"],
	".scala": ["//", "/*", "*"],
	".rs": ["//", "/*", "*"],
	".vue": ["//", "/*", "*"],
	".svelte": ["//", "/*", "*"],
	".sql": ["--", "#"],
	// HTML/style
	".html": ["/*", "*"],
	".css": ["/*", "*"],
	".scss": ["/*", "*", "//"],
	".sass": ["/*", "*", "//"],
	".less": ["/*", "*", "//"],
	// Config/data files
	".json": [], // No comments in JSON
	".md": ["#", "//"],
	".txt": ["#", "//"],
};

/**
 * FileWatcher class for watching source files for AI comment changes
 */
export class FileWatcher extends EventEmitter {
	private config: Required<WatchConfig>;
	private watchers: Map<string, FSWatcher> = new Map();
	private trackedFiles: Set<string> = new Set();
	private pendingChanges: Map<string, FileChange> = new Map();
	private debounceTimer: NodeJS.Timeout | null = null;
	private stats: WatchStats;
	private stopped = false;

	constructor(config: WatchConfig) {
		super();
		this.config = { ...DEFAULT_CONFIG, ...config } as Required<WatchConfig>;
		this.stats = this.initStats();
	}

	/**
	 * Initialize statistics
	 */
	private initStats(): WatchStats {
		return {
			filesWatched: 0,
			changesDetected: 0,
			commentsProcessed: 0,
			actionsTriggered: 0,
			byActionType: {
				execute: 0,
				question: 0,
				review: 0,
				explain: 0,
				refactor: 0,
				test: 0,
				none: 0,
			},
			byExtension: {},
			startTime: Date.now(),
		};
	}

	/**
	 * Start watching for file changes
	 */
	async start(): Promise<void> {
		this.stopped = false;
		const root = this.config.root;

		if (!existsSync(root)) {
			throw new Error(`Root directory does not exist: ${root}`);
		}

		// Scan initial files
		await this.scanDirectory(root);

		// Watch root directory recursively
		this.watchDirectory(root);

		if (this.config.verbose) {
			console.log(`[Watch] Started watching ${root}`);
			console.log(`[Watch] Tracking ${this.trackedFiles.size} files`);
		}
	}

	/**
	 * Stop watching for file changes
	 */
	stop(): void {
		this.stopped = true;

		// Clear debounce timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Close all watchers
		for (const [path, watcher] of this.watchers) {
			watcher.close();
			if (this.config.verbose) {
				console.log(`[Watch] Closed watcher for ${path}`);
			}
		}
		this.watchers.clear();

		this.emit("stop");
	}

	/**
	 * Scan a directory for files to track
	 */
	private async scanDirectory(dir: string): Promise<void> {
		try {
			const entries = await readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(dir, entry.name);

				if (entry.isDirectory()) {
					// Skip gitignore patterns
					if (this.shouldIgnore(fullPath)) {
						continue;
					}
					await this.scanDirectory(fullPath);
				} else if (entry.isFile()) {
					if (this.shouldWatchFile(fullPath)) {
						this.trackedFiles.add(fullPath);
						this.stats.filesWatched++;
					}
				}
			}
		} catch (error) {
			if (this.config.verbose) {
				console.log(`[Watch] Error scanning ${dir}: ${error}`);
			}
		}
	}

	/**
	 * Watch a directory recursively
	 */
	private watchDirectory(dir: string): void {
		try {
			const watcher = watch(dir, (eventType, filename) => {
				if (this.stopped || !filename) return;

				const fullPath = join(dir, filename);
				this.handleFileEvent(eventType, fullPath);
			});

			this.watchers.set(dir, watcher);

			// Also watch subdirectories
			const entries = existsSync(dir) ? this.readdirSync(dir) : [];
			for (const entry of entries) {
				const subDir = join(dir, entry);
				try {
					const stats = this.statSync(subDir);
					if (stats.isDirectory() && !this.shouldIgnore(subDir)) {
						this.watchDirectory(subDir);
					}
				} catch {}
			}
		} catch (error) {
			if (this.config.verbose) {
				console.log(`[Watch] Error watching ${dir}: ${error}`);
			}
		}
	}

	// Helper to readdir synchronously
	private readdirSync(dir: string): string[] {
		try {
			const { readdirSync } = require("node:fs");
			return readdirSync(dir);
		} catch {
			return [];
		}
	}

	// Helper to stat synchronously
	private statSync(path: string): { isDirectory(): boolean } {
		try {
			const { statSync } = require("node:fs");
			return statSync(path);
		} catch {
			return { isDirectory: () => false };
		}
	}

	/**
	 * Handle a file change event
	 */
	private async handleFileEvent(eventType: string, path: string): Promise<void> {
		// Check if file should be watched
		if (!this.shouldWatchFile(path)) return;

		try {
			// Check file size
			const stats = await stat(path);
			if (stats.size > this.config.maxFileSize) {
				if (this.config.verbose) {
					console.log(`[Watch] Skipping large file ${path} (${stats.size} bytes)`);
				}
				return;
			}

			// Auto-add file if configured
			if (this.config.autoAddFiles && !this.trackedFiles.has(path)) {
				this.trackedFiles.add(path);
				this.emit("file_added", { path, relativePath: relative(this.config.root, path) });
			}

			// Extract AI comments
			const content = await readFile(path, "utf-8");
			const comments = this.extractAIComments(content, path);

			if (comments.length === 0) {
				// File changed but no AI comments
				return;
			}

			// Determine action type
			const actionType = this.determineActionType(comments);

			// Create change record
			const change: FileChange = {
				path,
				relativePath: relative(this.config.root, path),
				comments,
				actionType,
				timestamp: Date.now(),
			};

			// Update stats
			this.stats.changesDetected++;
			this.stats.commentsProcessed += comments.length;
			const ext = extname(path);
			this.stats.byExtension[ext] = (this.stats.byExtension[ext] || 0) + 1;

			// Debounce and emit
			this.pendingChanges.set(path, change);
			this.debounceEmit();
		} catch (error) {
			if (this.config.verbose) {
				console.log(`[Watch] Error processing ${path}: ${error}`);
			}
		}
	}

	/**
	 * Debounce change emissions
	 */
	private debounceEmit(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.emitPendingChanges();
		}, this.config.debounceInterval);
	}

	/**
	 * Emit all pending changes
	 */
	private emitPendingChanges(): void {
		if (this.pendingChanges.size === 0) return;

		const changes = Array.from(this.pendingChanges.values());
		this.pendingChanges.clear();

		// Find highest priority action
		const highestAction = this.getHighestPriorityAction(changes);

		if (highestAction !== "none") {
			this.stats.actionsTriggered++;
			this.stats.byActionType[highestAction]++;
		}

		// Emit changes event
		this.emit("changes", {
			changes,
			actionType: highestAction,
			prompt: this.buildPrompt(changes, highestAction),
		});
	}

	/**
	 * Extract AI comments from file content
	 */
	private extractAIComments(content: string, path: string): AIComment[] {
		const comments: AIComment[] = [];
		const lines = content.split("\n");
		const ext = extname(path);
		const markers = COMMENT_MARKERS[ext] || ["#", "//"];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			// Check if line is a comment
			const isComment = markers.some((m) => trimmed.startsWith(m));
			if (!isComment) continue;

			// Check for AI marker
			const match = trimmed.match(AI_COMMENT_PATTERN);
			if (!match) continue;

			const commentText = match[1] || trimmed;
			const actionType = this.classifyAction(commentText);

			comments.push({
				lineNumber: i + 1,
				content: trimmed,
				actionType,
				marker: markers.find((m) => trimmed.startsWith(m)) || "",
			});
		}

		return comments;
	}

	/**
	 * Classify action type from comment content
	 */
	private classifyAction(comment: string): WatchActionType {
		const lowerComment = comment.toLowerCase();

		// Check for explicit action markers (!, ?)
		if (lowerComment.includes("ai!")) return "execute";
		if (lowerComment.includes("ai?")) return "question";

		// Check for action keywords
		for (const [type, pattern] of Object.entries(ACTION_PATTERNS)) {
			if (type !== "none" && pattern.test(lowerComment)) {
				return type as WatchActionType;
			}
		}

		return "none";
	}

	/**
	 * Determine overall action type from multiple comments
	 */
	private determineActionType(comments: AIComment[]): WatchActionType {
		// Priority order: execute > question > review > explain > refactor > test > none
		const priority: WatchActionType[] = [
			"execute",
			"question",
			"review",
			"explain",
			"refactor",
			"test",
			"none",
		];

		for (const p of priority) {
			if (comments.some((c) => c.actionType === p)) {
				return p;
			}
		}

		return "none";
	}

	/**
	 * Get highest priority action from multiple changes
	 */
	private getHighestPriorityAction(changes: FileChange[]): WatchActionType {
		const priority: WatchActionType[] = [
			"execute",
			"question",
			"review",
			"explain",
			"refactor",
			"test",
			"none",
		];

		for (const p of priority) {
			if (changes.some((c) => c.actionType === p)) {
				return p;
			}
		}

		return "none";
	}

	/**
	 * Build prompt from changes
	 */
	private buildPrompt(changes: FileChange[], actionType: WatchActionType): string {
		const parts: string[] = [];

		if (actionType === "execute") {
			parts.push("Please process the following AI action requests:");
		} else if (actionType === "question") {
			parts.push("Please answer the following questions:");
		} else {
			parts.push(`Please ${actionType} the following:`);
		}

		for (const change of changes) {
			parts.push(`\nFile: ${change.relativePath}`);
			for (const comment of change.comments) {
				parts.push(`  Line ${comment.lineNumber}: ${comment.content}`);
			}
		}

		return parts.join("\n");
	}

	/**
	 * Check if file should be watched based on extension
	 */
	private shouldWatchFile(path: string): boolean {
		const ext = extname(path);
		return this.config.extensions.includes(ext);
	}

	/**
	 * Check if path should be ignored based on gitignore patterns
	 */
	private shouldIgnore(path: string): boolean {
		const relativePath = relative(this.config.root, path);

		for (const pattern of this.config.gitignorePatterns) {
			// Simple pattern matching
			if (pattern.startsWith("*")) {
				// Extension pattern like "*.log"
				if (relativePath.endsWith(pattern.slice(1))) return true;
			} else if (pattern.endsWith("/")) {
				// Directory pattern like "node_modules/"
				if (relativePath.startsWith(pattern.slice(0, -1))) return true;
			} else {
				// Exact match
				if (relativePath === pattern || relativePath.startsWith(`${pattern}/`)) return true;
			}
		}

		return false;
	}

	/**
	 * Get current statistics
	 */
	getStats(): WatchStats {
		return { ...this.stats };
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = this.initStats();
	}

	/**
	 * Get tracked files
	 */
	getTrackedFiles(): string[] {
		return Array.from(this.trackedFiles);
	}

	/**
	 * Add file to tracking
	 */
	addFile(path: string): void {
		if (existsSync(path) && this.shouldWatchFile(path)) {
			this.trackedFiles.add(path);
			this.stats.filesWatched++;
		}
	}

	/**
	 * Remove file from tracking
	 */
	removeFile(path: string): void {
		this.trackedFiles.delete(path);
	}

	/**
	 * Check if file is tracked
	 */
	isTracked(path: string): boolean {
		return this.trackedFiles.has(path);
	}

	/**
	 * Get AI comments from a specific file
	 */
	async getAIComments(path: string): Promise<AIComment[]> {
		if (!existsSync(path)) return [];

		try {
			const content = await readFile(path, "utf-8");
			return this.extractAIComments(content, path);
		} catch {
			return [];
		}
	}

	/**
	 * Get all pending changes
	 */
	getPendingChanges(): FileChange[] {
		return Array.from(this.pendingChanges.values());
	}

	/**
	 * Clear pending changes
	 */
	clearPendingChanges(): void {
		this.pendingChanges.clear();
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<WatchConfig>): void {
		this.config = { ...this.config, ...updates } as Required<WatchConfig>;
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Required<WatchConfig> {
		return { ...this.config };
	}

	/**
	 * Check if watcher is running
	 */
	isRunning(): boolean {
		return !this.stopped && this.watchers.size > 0;
	}
}

// Global file watcher instance
let globalFileWatcher: FileWatcher | null = null;

/**
 * Get or create global file watcher instance
 */
export function getFileWatcher(config?: WatchConfig): FileWatcher | null {
	if (!globalFileWatcher && config) {
		globalFileWatcher = new FileWatcher(config);
	}
	return globalFileWatcher;
}

/**
 * Initialize global file watcher
 */
export function initFileWatcher(config: WatchConfig): FileWatcher {
	globalFileWatcher = new FileWatcher(config);
	return globalFileWatcher;
}

/**
 * Stop and clear global file watcher
 */
export function stopFileWatcher(): void {
	if (globalFileWatcher) {
		globalFileWatcher.stop();
		globalFileWatcher = null;
	}
}

/**
 * Get watch statistics
 */
export function getWatchStats(): WatchStats | null {
	return globalFileWatcher?.getStats() || null;
}
