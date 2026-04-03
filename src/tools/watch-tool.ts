/**
 * Watch Tool - Tool interface for FileWatcher module
 *
 * Provides tool access to the Watch Mode/FileWatcher functionality.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type FileChange,
	type FileWatcher,
	type WatchActionType,
	type WatchConfig,
	type WatchStats,
	getFileWatcher,
	getWatchStats,
	initFileWatcher,
	stopFileWatcher,
} from "../watch.js";

// Tool definition
export const watchToolDef: AgentTool = {
	name: "watch",
	label: "Watch Files",
	description: `Watch source files for changes and AI comment markers (Aider Pattern).
	
Actions:
- start: Start watching a directory for AI comments (requires root path)
- stop: Stop watching files
- status: Get current watcher status
- files: List tracked files
- comments: Get AI comments from a specific file (requires path)
- pending: Get pending changes not yet processed
- stats: View watch statistics
- config: View or update configuration
- clear: Clear pending changes
- reset: Reset statistics

AI Comment Markers:
- "ai!" or "ai!!" - Execute action request (e.g., "# ai! fix this bug")
- "ai?" or "ai??" - Question request (e.g., "// ai? why is this here?")
- Keywords: review, explain, refactor, test

Example usage:
watch({action: 'start', root: '/path/to/project'})
watch({action: 'status'})
watch({action: 'comments', path: 'src/agent.ts'})
watch({action: 'stats'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: start, stop, status, files, comments, pending, stats, config, clear, reset",
		}),
		root: Type.Optional(Type.String({ description: "Root directory to watch (for start action)" })),
		path: Type.Optional(
			Type.String({ description: "File path to get comments from (for comments action)" }),
		),
		extensions: Type.Optional(
			Type.Array(Type.String(), { description: "File extensions to watch (for config action)" }),
		),
		gitignorePatterns: Type.Optional(
			Type.Array(Type.String(), { description: "Patterns to ignore (for config action)" }),
		),
		verbose: Type.Optional(Type.Boolean({ description: "Enable verbose logging" })),
		debounceInterval: Type.Optional(Type.Number({ description: "Debounce interval in ms" })),
		maxFileSize: Type.Optional(
			Type.Number({ description: "Maximum file size to process in bytes" }),
		),
		autoAddFiles: Type.Optional(Type.Boolean({ description: "Auto-add files with AI comments" })),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = await executeWatchTool({
			action: String(p.action),
			root: p.root as string | undefined,
			path: p.path as string | undefined,
			extensions: p.extensions as string[] | undefined,
			gitignorePatterns: p.gitignorePatterns as string[] | undefined,
			verbose: p.verbose as boolean | undefined,
			debounceInterval: p.debounceInterval as number | undefined,
			maxFileSize: p.maxFileSize as number | undefined,
			autoAddFiles: p.autoAddFiles as boolean | undefined,
		});
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

// In-memory storage for watch sessions
interface WatchSession {
	id: string;
	watcher: FileWatcher;
	root: string;
	startTime: number;
}

const watchSessions: Map<string, WatchSession> = new Map();

/**
 * Execute watch tool action
 */
export async function executeWatchTool(args: {
	action: string;
	root?: string;
	path?: string;
	extensions?: string[];
	gitignorePatterns?: string[];
	verbose?: boolean;
	debounceInterval?: number;
	maxFileSize?: number;
	autoAddFiles?: boolean;
}): Promise<string> {
	const {
		action,
		root,
		path,
		extensions,
		gitignorePatterns,
		verbose,
		debounceInterval,
		maxFileSize,
		autoAddFiles,
	} = args;

	switch (action) {
		case "start":
			return await handleStart(root, {
				extensions,
				gitignorePatterns,
				verbose,
				debounceInterval,
				maxFileSize,
				autoAddFiles,
			});

		case "stop":
			return handleStop();

		case "status":
			return handleStatus();

		case "files":
			return handleFiles();

		case "comments":
			return await handleComments(path);

		case "pending":
			return handlePending();

		case "stats":
			return handleStats();

		case "config":
			return handleConfig({
				extensions,
				gitignorePatterns,
				verbose,
				debounceInterval,
				maxFileSize,
				autoAddFiles,
			});

		case "clear":
			return handleClear();

		case "reset":
			return handleReset();

		default:
			return `Unknown action: ${action}. Valid actions: start, stop, status, files, comments, pending, stats, config, clear, reset`;
	}
}

/**
 * Handle start action
 */
async function handleStart(
	rootPath?: string,
	config?: {
		extensions?: string[];
		gitignorePatterns?: string[];
		verbose?: boolean;
		debounceInterval?: number;
		maxFileSize?: number;
		autoAddFiles?: boolean;
	},
): Promise<string> {
	// Default to current working directory if not provided
	const watchRoot = rootPath || process.cwd();

	const watchConfig: WatchConfig = {
		root: watchRoot,
		...config,
	};

	try {
		const watcher = initFileWatcher(watchConfig);

		// Set up event listeners
		watcher.on(
			"changes",
			(data: { changes: FileChange[]; actionType: WatchActionType; prompt: string }) => {
				console.log(
					`[Watch] Changes detected: ${data.changes.length} files, action: ${data.actionType}`,
				);
				console.log(`[Watch] Prompt: ${data.prompt.slice(0, 200)}...`);
			},
		);

		watcher.on("file_added", (data: { path: string; relativePath: string }) => {
			if (watcher.getConfig().verbose) {
				console.log(`[Watch] Added file: ${data.relativePath}`);
			}
		});

		await watcher.start();

		// Store session
		const sessionId = `watch-${Date.now()}`;
		watchSessions.set(sessionId, {
			id: sessionId,
			watcher,
			root: watchRoot,
			startTime: Date.now(),
		});

		const stats = watcher.getStats();

		return `Started watching ${watchRoot}
Session ID: ${sessionId}
Files tracked: ${stats.filesWatched}
Extensions: ${watcher.getConfig().extensions.slice(0, 10).join(", ")}...

AI Comment Markers:
  # ai! or // ai! - Execute action
  # ai? or // ai? - Ask question
  Keywords: review, explain, refactor, test

Use 'status' to check current state, 'stats' for statistics.`;
	} catch (error) {
		return `Failed to start watcher: ${error}`;
	}
}

/**
 * Handle stop action
 */
function handleStop(): string {
	try {
		const stats = getWatchStats();
		const filesWatched = stats?.filesWatched || 0;
		const changesDetected = stats?.changesDetected || 0;
		const runtime = stats ? Math.round((Date.now() - stats.startTime) / 1000) : 0;

		stopFileWatcher();

		// Clear sessions
		const sessionCount = watchSessions.size;
		watchSessions.clear();

		return `Stopped file watcher
  Files watched: ${filesWatched}
  Changes detected: ${changesDetected}
  Runtime: ${runtime}s
  Sessions closed: ${sessionCount}`;
	} catch (error) {
		return `Failed to stop watcher: ${error}`;
	}
}

/**
 * Handle status action
 */
function handleStatus(): string {
	const watcher = getFileWatcher();

	if (!watcher || !watcher.isRunning()) {
		return `File watcher is not running.

Start with: watch({action: 'start', root: '/path/to/project'})`;
	}

	const stats = watcher.getStats();
	const config = watcher.getConfig();
	const runtime = Math.round((Date.now() - stats.startTime) / 1000);

	return `File Watcher Status: RUNNING

Configuration:
  Root: ${config.root}
  Extensions: ${config.extensions.length} types
  Ignore patterns: ${config.gitignorePatterns.length}
  Max file size: ${config.maxFileSize} bytes
  Debounce: ${config.debounceInterval}ms
  Verbose: ${config.verbose}
  Auto-add: ${config.autoAddFiles}

Statistics:
  Files tracked: ${stats.filesWatched}
  Changes detected: ${stats.changesDetected}
  Comments processed: ${stats.commentsProcessed}
  Actions triggered: ${stats.actionsTriggered}
  Runtime: ${runtime}s

Actions by Type:
${formatActionStats(stats.byActionType)}`;
}

/**
 * Handle files action
 */
function handleFiles(): string {
	const watcher = getFileWatcher();

	if (!watcher) {
		return "File watcher not initialized. Start with 'start' action.";
	}

	const files = watcher.getTrackedFiles();

	if (files.length === 0) {
		return "No files currently tracked.";
	}

	// Group by extension
	const byExtension: Record<string, string[]> = {};
	for (const file of files) {
		const ext = file.split(".").pop() || "unknown";
		if (!byExtension[ext]) byExtension[ext] = [];
		byExtension[ext].push(file);
	}

	const parts: string[] = [`Tracked Files: ${files.length} total`];

	for (const [ext, fileList] of Object.entries(byExtension)) {
		parts.push(`\n.${ext} (${fileList.length} files)`);
		// Show first 5 files per extension
		const shown = fileList.slice(0, 5).map((f) => `  ${f}`);
		parts.push(...shown);
		if (fileList.length > 5) {
			parts.push(`  ... and ${fileList.length - 5} more`);
		}
	}

	return parts.join("\n");
}

/**
 * Handle comments action
 */
async function handleComments(filePath?: string): Promise<string> {
	if (!filePath) {
		return "Please provide a file path to get AI comments from.\nExample: watch({action: 'comments', path: 'src/agent.ts'})";
	}

	const watcher = getFileWatcher();

	if (!watcher) {
		return "File watcher not initialized. Start with 'start' action.";
	}

	const comments = await watcher.getAIComments(filePath);

	if (comments.length === 0) {
		return `No AI comments found in ${filePath}

AI comment examples:
  # ai! fix this bug
  // ai? explain this function
  /* ai review this * /`;
	}

	const parts = [`AI Comments in ${filePath}:`, ""];

	for (const comment of comments) {
		parts.push(`Line ${comment.lineNumber} [${comment.actionType}]:`);
		parts.push(`  ${comment.content}`);
	}

	return parts.join("\n");
}

/**
 * Handle pending action
 */
function handlePending(): string {
	const watcher = getFileWatcher();

	if (!watcher) {
		return "File watcher not initialized.";
	}

	const pending = watcher.getPendingChanges();

	if (pending.length === 0) {
		return "No pending changes.";
	}

	const parts = [`Pending Changes: ${pending.length} files`, ""];

	for (const change of pending) {
		parts.push(`${change.relativePath} (${change.actionType}):`);
		for (const comment of change.comments) {
			parts.push(`  Line ${comment.lineNumber}: ${comment.content}`);
		}
		parts.push("");
	}

	return parts.join("\n");
}

/**
 * Handle stats action
 */
function handleStats(): string {
	const stats = getWatchStats();

	if (!stats) {
		return "File watcher not initialized. Start with 'start' action.";
	}

	const runtime = Math.round((Date.now() - stats.startTime) / 1000);

	return `Watch Statistics

General:
  Files watched: ${stats.filesWatched}
  Changes detected: ${stats.changesDetected}
  Comments processed: ${stats.commentsProcessed}
  Actions triggered: ${stats.actionsTriggered}
  Runtime: ${runtime}s

By Action Type:
${formatActionStats(stats.byActionType)}

By Extension:
${formatExtensionStats(stats.byExtension)}`;
}

/**
 * Handle config action
 */
function handleConfig(config?: {
	extensions?: string[];
	gitignorePatterns?: string[];
	verbose?: boolean;
	debounceInterval?: number;
	maxFileSize?: number;
	autoAddFiles?: boolean;
}): string {
	const watcher = getFileWatcher();

	if (!watcher) {
		return "File watcher not initialized. Start with 'start' action.";
	}

	// Update config if provided
	if (config) {
		watcher.updateConfig(config);
	}

	const currentConfig = watcher.getConfig();

	return `Watch Configuration

  Root: ${currentConfig.root}
  Extensions: ${currentConfig.extensions.length} types
  Ignore patterns: ${currentConfig.gitignorePatterns.length}
  Max file size: ${currentConfig.maxFileSize} bytes (${Math.round(currentConfig.maxFileSize / 1024)}KB)
  Debounce interval: ${currentConfig.debounceInterval}ms
  Verbose: ${currentConfig.verbose}
  Auto-add files: ${currentConfig.autoAddFiles}`;
}

/**
 * Handle clear action
 */
function handleClear(): string {
	const watcher = getFileWatcher();

	if (!watcher) {
		return "File watcher not initialized.";
	}

	watcher.clearPendingChanges();

	return "Cleared all pending changes.";
}

/**
 * Handle reset action
 */
function handleReset(): string {
	const watcher = getFileWatcher();

	if (!watcher) {
		return "File watcher not initialized.";
	}

	watcher.resetStats();

	return "Reset watch statistics.";
}

/**
 * Format action type statistics
 */
function formatActionStats(byActionType: Record<WatchActionType, number>): string {
	const lines: string[] = [];
	const total = Object.values(byActionType).reduce((a, b) => a + b, 0);

	for (const [type, count] of Object.entries(byActionType)) {
		const pct = total > 0 ? Math.round((count / total) * 100) : 0;
		lines.push(`  ${type}: ${count} (${pct}%)`);
	}

	return lines.join("\n");
}

/**
 * Format extension statistics
 */
function formatExtensionStats(byExtension: Record<string, number>): string {
	const entries = Object.entries(byExtension)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);

	if (entries.length === 0) {
		return "  No data";
	}

	return entries.map(([ext, count]) => `  ${ext}: ${count}`).join("\n");
}

// Export tool
export const watchTool = {
	definition: watchToolDef,
	execute: executeWatchTool,
};
