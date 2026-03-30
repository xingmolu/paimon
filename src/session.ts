/**
 * Session persistence and resume capability.
 *
 * Sessions are stored as JSONL files in ~/.paimon/sessions/
 * organized by project directory. Each message is stored with
 * a unique ID and optional parentId for branching.
 */

import { execSync } from "node:child_process";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

/**
 * A message in the session history.
 */
export interface SessionMessage {
	id: string;
	role: "user" | "assistant" | "toolResult";
	content: string;
	parentId?: string;
	timestamp: number;
}

/**
 * Session metadata for listing.
 */
export interface SessionInfo {
	path: string;
	project: string;
	date: string;
	messageCount: number;
	lastModified: Date;
}

/**
 * Generate a unique message ID.
 */
function generateId(): string {
	return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
 * Get the project name for session storage.
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
 * Session manager handles persistence and resume of conversations.
 */
export class SessionManager {
	private sessionDir: string;
	private currentFile: string | null = null;
	private messages: SessionMessage[] = [];
	private projectName: string;
	private enabled: boolean;

	constructor(baseDir: string = join(homedir(), ".paimon", "sessions"), enabled = true) {
		this.sessionDir = baseDir;
		this.projectName = getProjectName();
		this.enabled = enabled;
	}

	/**
	 * Start a new session.
	 */
	new(): void {
		if (!this.enabled) return;

		const date = new Date().toISOString().split("T")[0];
		const timestamp = Date.now();
		const projectDir = join(this.sessionDir, "projects", this.projectName);

		this.ensureDir(projectDir);
		this.currentFile = join(projectDir, `${date}-session-${timestamp}.jsonl`);
		this.messages = [];

		// Write empty file to create session
		writeFileSync(this.currentFile, "", "utf-8");
	}

	/**
	 * Continue the latest session for the current project.
	 * Returns true if a session was found and loaded.
	 */
	continue(): boolean {
		if (!this.enabled) return false;

		const projectDir = join(this.sessionDir, "projects", this.projectName);
		if (!existsSync(projectDir)) return false;

		const files = readdirSync(projectDir)
			.filter((f) => f.endsWith(".jsonl"))
			.sort()
			.reverse();

		if (files.length === 0) return false;

		this.currentFile = join(projectDir, files[0]);
		this.messages = this.load(this.currentFile);
		return true;
	}

	/**
	 * Get list of available sessions for the current project.
	 */
	list(): SessionInfo[] {
		const projectDir = join(this.sessionDir, "projects", this.projectName);
		if (!existsSync(projectDir)) return [];

		const files = readdirSync(projectDir)
			.filter((f) => f.endsWith(".jsonl"))
			.sort()
			.reverse();

		return files.map((file) => {
			const path = join(projectDir, file);
			const content = readFileSync(path, "utf-8");
			const lines = content.trim().split("\n").filter(Boolean);
			const stats = existsSync(path) ? new Date() : new Date();

			return {
				path,
				project: this.projectName,
				date: file.replace(/-session-\d+\.jsonl$/, ""),
				messageCount: lines.length,
				lastModified: stats,
			};
		});
	}

	/**
	 * Resume a specific session by path.
	 */
	resume(path: string): boolean {
		if (!this.enabled) return false;
		if (!existsSync(path)) return false;

		this.currentFile = path;
		this.messages = this.load(path);
		return true;
	}

	/**
	 * Save a message to the current session.
	 */
	save(
		role: "user" | "assistant" | "toolResult",
		content: string,
		parentId?: string,
	): SessionMessage {
		const message: SessionMessage = {
			id: generateId(),
			role,
			content,
			parentId,
			timestamp: Date.now(),
		};

		this.messages.push(message);

		if (this.currentFile && this.enabled) {
			this.ensureDir(dirname(this.currentFile));
			appendFileSync(this.currentFile, `${JSON.stringify(message)}\n`, "utf-8");
		}

		return message;
	}

	/**
	 * Get all messages in the current session.
	 */
	getMessages(): SessionMessage[] {
		return [...this.messages];
	}

	/**
	 * Get the last message in the session.
	 */
	getLastMessage(): SessionMessage | undefined {
		return this.messages[this.messages.length - 1];
	}

	/**
	 * Get the session file path.
	 */
	getSessionFile(): string | null {
		return this.currentFile;
	}

	/**
	 * Check if a session is active.
	 */
	hasActiveSession(): boolean {
		return this.currentFile !== null;
	}

	/**
	 * Load messages from a session file.
	 */
	private load(file: string): SessionMessage[] {
		if (!existsSync(file)) return [];

		const content = readFileSync(file, "utf-8");
		return content
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as SessionMessage);
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
	 * Clear the current session (for testing).
	 */
	clear(): void {
		this.currentFile = null;
		this.messages = [];
	}

	/**
	 * Get the sessions directory path.
	 */
	getSessionsDir(): string {
		return this.sessionDir;
	}
}

/**
 * Format session info for display.
 */
export function formatSessionList(sessions: SessionInfo[]): string {
	if (sessions.length === 0) {
		return "No sessions found.";
	}

	const lines = sessions.map((s, i) => {
		const msgCount = `${s.messageCount} messages`;
		return `  ${i + 1}. ${s.date} (${msgCount})`;
	});

	return `Sessions for ${sessions[0]?.project || "project"}:\n${lines.join("\n")}`;
}
