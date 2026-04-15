/**
 * Clipboard Manager Module
 *
 * Enables working with LLM web chats when API access isn't available or is cost-prohibitive.
 * Provides clipboard context generation for copying to web LLM and paste parsing for
 * applying web LLM responses to files.
 *
 * Inspired by Aider's copy/paste with web chat pattern:
 * https://aider.chat/docs/usage/copypaste.html
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface ClipboardContext {
	files: string[];
	readOnlyFiles: string[];
	repoMap?: string;
	instructions?: string;
	timestamp: string;
}

export interface ParsedEdit {
	filePath: string;
	action: "create" | "edit" | "delete";
	content?: string;
	oldContent?: string;
	newContent?: string;
}

export interface ClipboardConfig {
	enabled: boolean;
	copyPasteMode: boolean;
	editFormat: "editor-diff" | "editor-whole" | "auto";
	includeRepoMap: boolean;
	includeInstructions: boolean;
	autoCopyOnAdd: boolean;
	autoPasteOnClipboardChange: boolean;
	instructionTemplate: string;
}

export interface ClipboardStats {
	copyContextCount: number;
	pasteCount: number;
	filesCopied: number;
	editsApplied: number;
	clipboardWatchHits: number;
	lastCopyTime: string;
	lastPasteTime: string;
}

export interface ClipboardWatchState {
	isWatching: boolean;
	lastClipboardContent: string;
	lastCheckTime: string;
}

const DEFAULT_CONFIG: ClipboardConfig = {
	enabled: true,
	copyPasteMode: false,
	editFormat: "auto",
	includeRepoMap: true,
	includeInstructions: true,
	autoCopyOnAdd: false,
	autoPasteOnClipboardChange: false,
	instructionTemplate: `I need you to suggest code changes concisely.
For each change, specify:
1. The file path
2. What to change (the original code block)
3. What to replace it with (the new code block)

Use this format:
\`\`\`filepath
// original code
\`\`\`
→
\`\`\`filepath
// new code
\`\`\`

Or for new files:
CREATE: filepath
\`\`\`
// new file content
\`\`\`

Or for deleted files:
DELETE: filepath`,
};

let managerInstance: ClipboardManager | null = null;

export class ClipboardManager {
	private config: ClipboardConfig;
	private stats: ClipboardStats;
	private dataPath: string;
	private watchState: ClipboardWatchState;
	private currentContext: ClipboardContext | null = null;
	private addedFiles: Set<string> = new Set();
	private readOnlyFiles: Set<string> = new Set();

	constructor() {
		this.config = DEFAULT_CONFIG;
		this.dataPath = this.getDataPath();
		this.stats = {
			copyContextCount: 0,
			pasteCount: 0,
			filesCopied: 0,
			editsApplied: 0,
			clipboardWatchHits: 0,
			lastCopyTime: "",
			lastPasteTime: "",
		};
		this.watchState = {
			isWatching: false,
			lastClipboardContent: "",
			lastCheckTime: "",
		};
		this.loadData();
	}

	private getDataPath(): string {
		const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
		return path.join(homeDir, ".paimon", "clipboard-manager.json");
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.stats, ...data.stats };
			}
		} catch {
			// Use defaults
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
						config: this.config,
						stats: this.stats,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save clipboard manager data:", error);
		}
	}

	// File tracking
	public addFile(filePath: string, readOnly = false): void {
		const resolved = path.resolve(filePath);
		if (readOnly) {
			this.readOnlyFiles.add(resolved);
		} else {
			this.addedFiles.add(resolved);
		}

		if (this.config.autoCopyOnAdd && this.config.copyPasteMode) {
			this.copyContext();
		}
	}

	public removeFile(filePath: string): void {
		const resolved = path.resolve(filePath);
		this.addedFiles.delete(resolved);
		this.readOnlyFiles.delete(resolved);

		if (this.config.autoCopyOnAdd && this.config.copyPasteMode) {
			this.copyContext();
		}
	}

	public clearFiles(): void {
		this.addedFiles.clear();
		this.readOnlyFiles.clear();

		if (this.config.autoCopyOnAdd && this.config.copyPasteMode) {
			this.copyContext();
		}
	}

	public getAddedFiles(): string[] {
		return Array.from(this.addedFiles);
	}

	public getReadOnlyFiles(): string[] {
		return Array.from(this.readOnlyFiles);
	}

	// Clipboard operations
	private getClipboardContent(): string {
		try {
			if (process.platform === "darwin") {
				return execSync("pbpaste", { encoding: "utf-8" });
			}
			if (process.platform === "linux") {
				// Try xclip first, then xsel
				try {
					return execSync("xclip -selection clipboard -o", { encoding: "utf-8" });
				} catch {
					return execSync("xsel --clipboard --output", { encoding: "utf-8" });
				}
			}
			if (process.platform === "win32") {
				return execSync("powershell -command Get-Clipboard", { encoding: "utf-8" });
			}
		} catch (error) {
			console.error("Failed to get clipboard content:", error);
		}
		return "";
	}

	private setClipboardContent(content: string): boolean {
		try {
			if (process.platform === "darwin") {
				execSync("pbcopy", { input: content, encoding: "utf-8" });
				return true;
			}
			if (process.platform === "linux") {
				// Try xclip first, then xsel
				try {
					execSync("xclip -selection clipboard", { input: content, encoding: "utf-8" });
					return true;
				} catch {
					execSync("xsel --clipboard --input", { input: content, encoding: "utf-8" });
					return true;
				}
			}
			if (process.platform === "win32") {
				const escaped = content.replace(/"/g, '""').replace(/\n/g, "`n");
				execSync(`powershell -command Set-Clipboard -Value "${escaped}"`, {
					encoding: "utf-8",
				});
				return true;
			}
		} catch (error) {
			console.error("Failed to set clipboard content:", error);
		}
		return false;
	}

	// Context generation
	private generateRepoMap(): string {
		try {
			// Simple repo map generation - list files and key definitions
			const cwd = process.cwd();
			const files = this.listFilesRecursively(cwd, 3); // Max depth 3
			const relevantFiles = files.filter(
				(f) =>
					(f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".py")) &&
					!f.includes("node_modules") &&
					!f.includes(".git"),
			);

			const repoMap = `## Repository Structure\n\n${relevantFiles
				.slice(0, 50) // Limit to 50 files
				.map((f) => `- ${path.relative(cwd, f)}`)
				.join("\n")}`;

			return repoMap;
		} catch {
			return "";
		}
	}

	private listFilesRecursively(dir: string, maxDepth: number): string[] {
		const files: string[] = [];
		if (maxDepth <= 0) return files;

		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					files.push(...this.listFilesRecursively(fullPath, maxDepth - 1));
				} else {
					files.push(fullPath);
				}
			}
		} catch {
			// Ignore errors
		}

		return files;
	}

	private readFileContent(filePath: string): string {
		try {
			return fs.readFileSync(filePath, "utf-8");
		} catch {
			return `# Error reading file: ${filePath}`;
		}
	}

	public copyContext(instructions?: string): ClipboardContext {
		const context: ClipboardContext = {
			files: Array.from(this.addedFiles),
			readOnlyFiles: Array.from(this.readOnlyFiles),
			timestamp: new Date().toISOString(),
		};

		if (instructions) {
			context.instructions = instructions;
		}

		// Build the context string
		let contextStr = "";

		// Add instructions template
		if (this.config.includeInstructions) {
			contextStr += `${this.config.instructionTemplate}\n\n`;
		}

		// Add user instructions if provided
		if (instructions) {
			contextStr += `## Task\n\n${instructions}\n\n`;
		}

		// Add repo map
		if (this.config.includeRepoMap) {
			const repoMap = this.generateRepoMap();
			if (repoMap) {
				contextStr += `${repoMap}\n\n`;
			}
		}

		// Add file contents
		const allFiles = [...context.files, ...context.readOnlyFiles];
		if (allFiles.length > 0) {
			contextStr += "## Files\n\n";
			for (const filePath of allFiles) {
				const content = this.readFileContent(filePath);
				const relativePath = path.relative(process.cwd(), filePath);
				const readOnlyMarker = this.readOnlyFiles.has(filePath) ? " (read-only)" : "";
				contextStr += `### ${relativePath}${readOnlyMarker}\n\n\`\`\`\n${content}\n\`\`\`\n\n`;
			}
		}

		// Copy to clipboard
		if (this.setClipboardContent(contextStr)) {
			this.stats.copyContextCount++;
			this.stats.filesCopied += allFiles.length;
			this.stats.lastCopyTime = context.timestamp;
			this.saveData();
		}

		this.currentContext = context;
		return context;
	}

	// Paste parsing
	public parsePasteContent(content?: string): ParsedEdit[] {
		const clipboardContent = content || this.getClipboardContent();
		const edits: ParsedEdit[] = [];

		if (!clipboardContent.trim()) {
			return edits;
		}

		// Pattern for file blocks with filepath
		const fileBlockPattern = /```(\S+)\n([\s\S]*?)```/g;

		// Pattern for CREATE statements
		const createPattern = /CREATE:\s*(\S+)\n```[\w]*\n([\s\S]*?)```/g;

		// Pattern for DELETE statements
		const deletePattern = /DELETE:\s*(\S+)/g;

		// Try parsing CREATE statements
		let match: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
		while ((match = createPattern.exec(clipboardContent)) !== null) {
			edits.push({
				filePath: match[1],
				action: "create",
				content: match[2],
			});
		}

		// Try parsing DELETE statements
		// biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
		while ((match = deletePattern.exec(clipboardContent)) !== null) {
			edits.push({
				filePath: match[1],
				action: "delete",
			});
		}

		// Try parsing simple file blocks with arrow notation
		const simpleEditPattern = /```(\S+)\n([\s\S]*?)```\n→\n```\1\n([\s\S]*?)```/g;
		// biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
		while ((match = simpleEditPattern.exec(clipboardContent)) !== null) {
			edits.push({
				filePath: match[1],
				action: "edit",
				oldContent: match[2],
				newContent: match[3],
			});
		}

		// Fallback: parse as whole file replacement for single file context
		if (edits.length === 0 && this.currentContext && this.currentContext.files.length === 1) {
			// biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
			while ((match = fileBlockPattern.exec(clipboardContent)) !== null) {
				const filePath = match[1];
				const fileContent = match[2];

				// Check if this is an edit or create
				const absolutePath = path.resolve(filePath);
				if (fs.existsSync(absolutePath)) {
					edits.push({
						filePath,
						action: "edit",
						content: fileContent,
					});
				} else {
					edits.push({
						filePath,
						action: "create",
						content: fileContent,
					});
				}
			}
		}

		return edits;
	}

	public paste(content?: string): ParsedEdit[] {
		const edits = this.parsePasteContent(content);

		this.stats.pasteCount++;
		this.stats.editsApplied += edits.length;
		this.stats.lastPasteTime = new Date().toISOString();
		this.saveData();

		return edits;
	}

	// Apply edits to files
	public applyEdits(edits: ParsedEdit[]): { success: boolean; message: string }[] {
		const results: { success: boolean; message: string }[] = [];

		for (const edit of edits) {
			try {
				const absolutePath = path.resolve(edit.filePath);

				switch (edit.action) {
					case "create":
						if (edit.content !== undefined) {
							const dir = path.dirname(absolutePath);
							if (!fs.existsSync(dir)) {
								fs.mkdirSync(dir, { recursive: true });
							}
							fs.writeFileSync(absolutePath, edit.content, "utf-8");
							results.push({
								success: true,
								message: `Created file: ${edit.filePath}`,
							});
						}
						break;

					case "edit":
						if (edit.content !== undefined) {
							// Whole file replacement
							fs.writeFileSync(absolutePath, edit.content, "utf-8");
							results.push({
								success: true,
								message: `Edited file: ${edit.filePath}`,
							});
						} else if (edit.oldContent !== undefined && edit.newContent !== undefined) {
							// Search and replace
							const currentContent = fs.readFileSync(absolutePath, "utf-8");
							if (currentContent.includes(edit.oldContent)) {
								const newContent = currentContent.replace(edit.oldContent, edit.newContent);
								fs.writeFileSync(absolutePath, newContent, "utf-8");
								results.push({
									success: true,
									message: `Applied edit to: ${edit.filePath}`,
								});
							} else {
								results.push({
									success: false,
									message: `Old content not found in: ${edit.filePath}`,
								});
							}
						}
						break;

					case "delete":
						if (fs.existsSync(absolutePath)) {
							fs.unlinkSync(absolutePath);
							results.push({
								success: true,
								message: `Deleted file: ${edit.filePath}`,
							});
						} else {
							results.push({
								success: false,
								message: `File not found: ${edit.filePath}`,
							});
						}
						break;
				}
			} catch (error) {
				results.push({
					success: false,
					message: `Error processing ${edit.filePath}: ${error}`,
				});
			}
		}

		return results;
	}

	// Copy/paste mode
	public enableCopyPasteMode(): void {
		this.config.copyPasteMode = true;
		this.config.autoCopyOnAdd = true;
		this.saveData();
	}

	public disableCopyPasteMode(): void {
		this.config.copyPasteMode = false;
		this.config.autoCopyOnAdd = false;
		this.saveData();
	}

	public isCopyPasteMode(): boolean {
		return this.config.copyPasteMode;
	}

	// Clipboard watching (for copy/paste mode)
	public checkClipboardChange(): string | null {
		if (!this.config.copyPasteMode) {
			return null;
		}

		const currentContent = this.getClipboardContent();
		if (currentContent && currentContent !== this.watchState.lastClipboardContent) {
			this.watchState.lastClipboardContent = currentContent;
			this.watchState.lastCheckTime = new Date().toISOString();
			this.stats.clipboardWatchHits++;
			this.saveData();
			return currentContent;
		}

		return null;
	}

	// Configuration
	public getConfig(): ClipboardConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<ClipboardConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	// Statistics
	public getStats(): ClipboardStats {
		return { ...this.stats };
	}

	public resetStats(): void {
		this.stats = {
			copyContextCount: 0,
			pasteCount: 0,
			filesCopied: 0,
			editsApplied: 0,
			clipboardWatchHits: 0,
			lastCopyTime: "",
			lastPasteTime: "",
		};
		this.saveData();
	}

	// Enable/disable
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}
}

// Singleton instance
export function getClipboardManager(): ClipboardManager {
	if (!managerInstance) {
		managerInstance = new ClipboardManager();
	}
	return managerInstance;
}

// Reset for testing
export function resetClipboardManager(): void {
	managerInstance = null;
}
