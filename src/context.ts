import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Expand tilde (~) in file paths to the user's home directory
 */
function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

/**
 * Find the git root directory by walking up from the given directory
 */
function findGitRoot(startDir: string): string | null {
	let dir = startDir;
	while (dir !== "/") {
		if (existsSync(join(dir, ".git"))) {
			return dir;
		}
		dir = dirname(dir);
	}
	return null;
}

/**
 * Load context from a single file if it exists
 */
function loadContextFile(path: string): string | null {
	const expandedPath = expandTilde(path);
	if (existsSync(expandedPath)) {
		try {
			return readFileSync(expandedPath, "utf-8");
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Load context files from:
 * 1. Global ~/.paimon/AGENTS.md
 * 2. All AGENTS.md files from current directory up to git root
 * 3. All CLAUDE.md files from current directory up to git root (Claude Code compatibility)
 *
 * Files are loaded in order of specificity (global first, then walking up to root)
 * and concatenated with clear separators.
 */
export function loadContextFiles(cwd: string): string {
	const contexts: string[] = [];

	// 1. Load global context
	const globalContent = loadContextFile("~/.paimon/AGENTS.md");
	if (globalContent) {
		contexts.push(`### Global Context (~/.paimon/AGENTS.md)\n\n${globalContent}`);
	}

	// 2. Find git root (or use cwd if no git repo)
	const gitRoot = findGitRoot(cwd) || cwd;

	// 3. Walk up from cwd to git root, collecting AGENTS.md and CLAUDE.md files
	// Earlier files (closer to root) = higher priority, so we unshift
	const contextFiles = ["AGENTS.md", "CLAUDE.md"];
	const loadedPaths = new Set<string>();

	let dir = cwd;
	while (true) {
		for (const filename of contextFiles) {
			const filepath = join(dir, filename);
			if (!loadedPaths.has(filepath)) {
				const content = loadContextFile(filepath);
				if (content) {
					const relativePath = dir === cwd ? filename : `${filename} (in ${dir})`;
					contexts.unshift(`### ${relativePath}\n\n${content}`);
					loadedPaths.add(filepath);
				}
			}
		}

		// Stop if we've reached the git root
		if (dir === gitRoot) break;

		// Move up one directory
		const parent = dirname(dir);
		if (parent === dir) break; // Reached filesystem root
		dir = parent;
	}

	return contexts.length > 0 ? contexts.join("\n\n---\n\n") : "";
}

/**
 * Get context info for debugging
 */
export function getContextInfo(cwd: string): {
	gitRoot: string | null;
	contextFiles: string[];
} {
	const gitRoot = findGitRoot(cwd);
	const contextFiles: string[] = [];

	// Check global
	const globalPath = expandTilde("~/.paimon/AGENTS.md");
	if (existsSync(globalPath)) {
		contextFiles.push(globalPath);
	}

	// Check local files
	let dir = cwd;
	const checkRoot = gitRoot || cwd;
	while (true) {
		for (const filename of ["AGENTS.md", "CLAUDE.md"]) {
			const filepath = join(dir, filename);
			if (existsSync(filepath)) {
				contextFiles.push(filepath);
			}
		}
		if (dir === checkRoot) break;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return { gitRoot, contextFiles };
}