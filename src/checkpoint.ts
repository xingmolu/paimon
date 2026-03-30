/**
 * Checkpoint system for safe rollback during evolution.
 *
 * Checkpoints use git stash to save snapshots of the current state.
 * Metadata is stored in ~/.paimon/checkpoints/ organized by project.
 *
 * This allows the agent to:
 * - Create checkpoints before risky changes
 * - Rollback if something goes wrong
 * - Track progress through multiple checkpoints
 */

import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * A checkpoint representing a saved snapshot.
 */
export interface Checkpoint {
	id: string;
	timestamp: number;
	description: string;
	stashRef: string; // git stash reference (e.g., "stash@{0}")
	files: string[]; // list of files changed at checkpoint
	project: string;
}

/**
 * Checkpoint info for listing (lighter format).
 */
export interface CheckpointInfo {
	id: string;
	timestamp: number;
	description: string;
	fileCount: number;
	project: string;
}

/**
 * Generate a unique checkpoint ID.
 */
function generateId(): string {
	return `ckpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Find the git root directory for the current project.
 * Returns null if not in a git repository.
 */
function findGitRoot(dir: string = process.cwd()): string | null {
	try {
		const gitDir = execSync("git rev-parse --show-toplevel", {
			cwd: dir,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return gitDir || null;
	} catch {
		return null;
	}
}

/**
 * Get the project name for checkpoint storage.
 * Uses the git repository name, or the current directory name.
 */
function getProjectName(): string {
	const gitRoot = findGitRoot();
	if (gitRoot) {
		return basename(gitRoot);
	}
	return basename(process.cwd());
}

/**
 * Check if we're in a git repository.
 */
function isInGitRepo(): boolean {
	return findGitRoot() !== null;
}

/**
 * Get list of currently modified files (from git status).
 */
function getModifiedFiles(): string[] {
	try {
		const output = execSync("git status --porcelain", {
			encoding: "utf-8",
			timeout: 10000,
		});
		return output
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => line.slice(3)); // Remove status prefix
	} catch {
		return [];
	}
}

/**
 * Checkpoint manager handles creating, listing, and restoring checkpoints.
 */
export class CheckpointManager {
	private checkpointDir: string;
	private projectDir: string;
	private projectName: string;
	private enabled: boolean;

	constructor(baseDir: string = join(homedir(), ".paimon", "checkpoints"), enabled = true) {
		this.checkpointDir = baseDir;
		this.projectName = getProjectName();
		this.projectDir = join(baseDir, "projects", this.projectName);
		this.enabled = enabled && isInGitRepo();
	}

	/**
	 * Create a checkpoint from the current state.
	 * Returns the checkpoint if successful, null if failed.
	 */
	create(description: string): Checkpoint | null {
		if (!this.enabled) {
			console.warn("Checkpoints disabled: not in a git repository");
			return null;
		}

		const files = getModifiedFiles();
		if (files.length === 0) {
			console.warn("No changes to checkpoint");
			return null;
		}

		// Create git stash with description
		const stashMessage = `paimon-checkpoint: ${description}`;
		try {
			execSync(`git stash push -m "${stashMessage}"`, {
				encoding: "utf-8",
				timeout: 30000,
			});
		} catch (e) {
			console.error("Failed to create stash:", e);
			return null;
		}

		// Get the stash reference (should be stash@{0} after push)
		let stashRef = "stash@{0}";
		try {
			const stashList = execSync("git stash list", {
				encoding: "utf-8",
				timeout: 10000,
			});
			const lines = stashList.trim().split("\n");
			if (lines.length > 0 && lines[0].includes(stashMessage)) {
				stashRef = lines[0].split(":")[0]; // e.g., "stash@{0}"
			}
		} catch {
			// Use default reference
		}

		const checkpoint: Checkpoint = {
			id: generateId(),
			timestamp: Date.now(),
			description,
			stashRef,
			files,
			project: this.projectName,
		};

		// Save metadata
		this.ensureDir(this.projectDir);
		const metaFile = join(this.projectDir, `${checkpoint.id}.json`);
		writeFileSync(metaFile, JSON.stringify(checkpoint, null, 2), "utf-8");

		return checkpoint;
	}

	/**
	 * Get list of checkpoints for the current project.
	 */
	list(): CheckpointInfo[] {
		if (!existsSync(this.projectDir)) return [];

		const files = readdirSync(this.projectDir)
			.filter((f) => f.endsWith(".json"))
			.sort()
			.reverse();

		const checkpoints: CheckpointInfo[] = [];
		for (const file of files) {
			try {
				const content = readFileSync(join(this.projectDir, file), "utf-8");
				const checkpoint = JSON.parse(content) as Checkpoint;
				checkpoints.push({
					id: checkpoint.id,
					timestamp: checkpoint.timestamp,
					description: checkpoint.description,
					fileCount: checkpoint.files.length,
					project: checkpoint.project,
				});
			} catch {
				// Skip invalid checkpoint files
			}
		}

		return checkpoints;
	}

	/**
	 * Restore to a specific checkpoint.
	 * Returns true if successful, false if failed.
	 */
	restore(checkpointId: string): boolean {
		if (!this.enabled) {
			console.warn("Checkpoints disabled: not in a git repository");
			return false;
		}

		const metaFile = join(this.projectDir, `${checkpointId}.json`);
		if (!existsSync(metaFile)) {
			console.error(`Checkpoint ${checkpointId} not found`);
			return false;
		}

		try {
			const content = readFileSync(metaFile, "utf-8");
			const checkpoint = JSON.parse(content) as Checkpoint;

			// Restore from stash
			execSync(`git stash apply "${checkpoint.stashRef}"`, {
				encoding: "utf-8",
				timeout: 30000,
			});

			return true;
		} catch (e) {
			console.error("Failed to restore checkpoint:", e);
			return false;
		}
	}

	/**
	 * Delete a checkpoint (removes metadata and optionally drops stash).
	 * Returns true if successful.
	 */
	delete(checkpointId: string, dropStash = false): boolean {
		const metaFile = join(this.projectDir, `${checkpointId}.json`);
		if (!existsSync(metaFile)) {
			return false;
		}

		try {
			if (dropStash) {
				const content = readFileSync(metaFile, "utf-8");
				const checkpoint = JSON.parse(content) as Checkpoint;
				execSync(`git stash drop "${checkpoint.stashRef}"`, {
					encoding: "utf-8",
					timeout: 10000,
				});
			}

			unlinkSync(metaFile);
			return true;
		} catch (e) {
			console.error("Failed to delete checkpoint:", e);
			return false;
		}
	}

	/**
	 * Get a specific checkpoint by ID.
	 */
	get(checkpointId: string): Checkpoint | null {
		const metaFile = join(this.projectDir, `${checkpointId}.json`);
		if (!existsSync(metaFile)) {
			return null;
		}

		try {
			const content = readFileSync(metaFile, "utf-8");
			return JSON.parse(content) as Checkpoint;
		} catch {
			return null;
		}
	}

	/**
	 * Check if checkpoints are enabled.
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Get the checkpoints directory path.
	 */
	getCheckpointsDir(): string {
		return this.checkpointDir;
	}

	/**
	 * Ensure a directory exists.
	 */
	private ensureDir(dir: string): void {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	/**
	 * Clear all checkpoints for testing.
	 */
	clear(): void {
		if (existsSync(this.projectDir)) {
			const files = readdirSync(this.projectDir).filter((f) => f.endsWith(".json"));
			for (const file of files) {
				unlinkSync(join(this.projectDir, file));
			}
		}
	}
}

/**
 * Format checkpoint list for display.
 */
export function formatCheckpointList(checkpoints: CheckpointInfo[]): string {
	if (checkpoints.length === 0) {
		return "No checkpoints found.";
	}

	const lines = checkpoints.map((c, i) => {
		const date = new Date(c.timestamp).toLocaleString();
		const files = `${c.fileCount} files`;
		return `  ${i + 1}. [${c.id}] ${date} - ${c.description} (${files})`;
	});

	return `Checkpoints for ${checkpoints[0]?.project || "project"}:\n${lines.join("\n")}`;
}

/**
 * Format a single checkpoint for display.
 */
export function formatCheckpoint(checkpoint: Checkpoint): string {
	const date = new Date(checkpoint.timestamp).toLocaleString();
	let output = `📦 Checkpoint: ${checkpoint.id}\n`;
	output += `Created: ${date}\n`;
	output += `Description: ${checkpoint.description}\n`;
	output += `Stash: ${checkpoint.stashRef}\n`;
	output += `Files (${checkpoint.files.length}):\n`;
	for (const file of checkpoint.files.slice(0, 10)) {
		output += `  - ${file}\n`;
	}
	if (checkpoint.files.length > 10) {
		output += `  ... and ${checkpoint.files.length - 10} more\n`;
	}
	return output;
}
