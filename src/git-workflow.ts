/**
 * Git Workflow Automation (Claude Code commit-commands Pattern).
 *
 * Streamlines git operations with commands for committing, pushing,
 * creating pull requests, and cleaning up stale branches.
 *
 * Based on Claude Code's commit-commands plugin.
 */

import { execSync } from "node:child_process";
import type { Api, Model } from "@mariozechner/pi-ai";
import { getCommitMessageGenerator } from "./commit-msg.js";

/**
 * Branch status information.
 */
export interface BranchStatus {
	name: string;
	isCurrent: boolean;
	upstream: string | null;
	ahead: number;
	behind: number;
	gone: boolean;
	hasWorktree: boolean;
	worktreePath?: string;
	lastCommit: string;
	lastCommitDate: string;
}

/**
 * Pull request information.
 */
export interface PullRequestInfo {
	number: number;
	title: string;
	state: "open" | "closed" | "merged";
	url: string;
	author: string;
	createdAt: string;
	mergeable: boolean | null;
	reviewStatus: "approved" | "changes_requested" | "review_required" | null;
}

/**
 * Workflow result.
 */
export interface WorkflowResult {
	success: boolean;
	message: string;
	details?: {
		branch?: string;
		commit?: string;
		pr?: PullRequestInfo;
		branchesDeleted?: string[];
		branchesSkipped?: string[];
	};
}

/**
 * Configuration for git workflow.
 */
export interface GitWorkflowConfig {
	/** Default branch name (default: "main") */
	defaultBranch: string;
	/** Remote name (default: "origin") */
	remoteName: string;
	/** Auto-create branch from default if on default (default: true) */
	autoCreateBranch: boolean;
	/** Branch name prefix for auto-created branches (default: "feature/") */
	branchPrefix: string;
	/** Model for LLM-based commit message generation */
	model?: Model<Api>;
	/** API key getter for LLM calls */
	getApiKey?: () => string | null;
	/** Include Claude Code attribution in commits */
	includeAttribution: boolean;
}

/**
 * Default configuration.
 */
export const DEFAULT_GIT_WORKFLOW_CONFIG: GitWorkflowConfig = {
	defaultBranch: "main",
	remoteName: "origin",
	autoCreateBranch: true,
	branchPrefix: "feature/",
	includeAttribution: true,
};

/**
 * Git workflow automation manager.
 */
export class GitWorkflowManager {
	private config: GitWorkflowConfig;

	constructor(config: Partial<GitWorkflowConfig> = {}) {
		this.config = { ...DEFAULT_GIT_WORKFLOW_CONFIG, ...config };
	}

	/**
	 * Set the model for LLM-based generation.
	 */
	setModel(model: Model<Api>): void {
		this.config.model = model;
	}

	/**
	 * Set the API key getter.
	 */
	setApiKeyGetter(getter: () => string | null): void {
		this.config.getApiKey = getter;
	}

	/**
	 * Check if we're in a git repository.
	 */
	isGitRepo(): boolean {
		try {
			execSync("git rev-parse --is-inside-work-tree", { encoding: "utf-8" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get current branch name.
	 */
	getCurrentBranch(): string {
		try {
			return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
		} catch {
			return "";
		}
	}

	/**
	 * Check if branch has a remote tracking branch.
	 */
	hasUpstream(): boolean {
		try {
			const upstream = execSync("git rev-parse --abbrev-ref @{upstream} 2>/dev/null", {
				encoding: "utf-8",
			}).trim();
			return upstream !== "";
		} catch {
			return false;
		}
	}

	/**
	 * Check if we're on the default branch.
	 */
	isOnDefaultBranch(): boolean {
		return this.getCurrentBranch() === this.config.defaultBranch;
	}

	/**
	 * Check if there are uncommitted changes.
	 */
	hasUncommittedChanges(): boolean {
		try {
			const status = execSync("git status --porcelain", { encoding: "utf-8" });
			return status.trim().length > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Check if there are staged changes.
	 */
	hasStagedChanges(): boolean {
		try {
			execSync("git diff --cached --quiet", { encoding: "utf-8" });
			return false;
		} catch {
			return true;
		}
	}

	/**
	 * Stage all changes.
	 */
	stageAllChanges(): boolean {
		try {
			execSync("git add -A", { encoding: "utf-8" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Create a new branch.
	 */
	createBranch(branchName: string): boolean {
		try {
			execSync(`git checkout -b ${branchName}`, { encoding: "utf-8" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Switch to a branch.
	 */
	switchToBranch(branchName: string): boolean {
		try {
			execSync(`git checkout ${branchName}`, { encoding: "utf-8" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Push branch to remote.
	 */
	pushBranch(branchName?: string, setUpstream = true): boolean {
		try {
			const branch = branchName || this.getCurrentBranch();
			const upstreamFlag = setUpstream ? `-u ${this.config.remoteName}` : "";
			execSync(`git push ${upstreamFlag} ${this.config.remoteName} ${branch}`, {
				encoding: "utf-8",
			});
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get branch status information.
	 */
	getBranchStatus(branchName?: string): BranchStatus | null {
		const branch = branchName || this.getCurrentBranch();

		try {
			const currentBranch = this.getCurrentBranch();
			const isCurrent = branch === currentBranch;

			let upstream: string | null = null;
			try {
				upstream = execSync(`git rev-parse --abbrev-ref ${branch}@{upstream} 2>/dev/null`, {
					encoding: "utf-8",
				}).trim();
				if (upstream === branch || upstream.includes("fatal")) {
					upstream = null;
				}
			} catch {
				upstream = null;
			}

			let ahead = 0;
			let behind = 0;
			if (upstream) {
				try {
					const counts = execSync(`git rev-list --left-right --count ${branch}...${upstream}`, {
						encoding: "utf-8",
					}).trim();
					[ahead, behind] = counts.split("\t").map(Number);
				} catch {
					// Ignore errors
				}
			}

			let gone = false;
			if (upstream) {
				try {
					execSync(`git rev-parse --verify ${upstream}`, { encoding: "utf-8" });
				} catch {
					gone = true;
				}
			}

			let hasWorktree = false;
			let worktreePath: string | undefined;
			try {
				const worktrees = execSync("git worktree list", { encoding: "utf-8" });
				const lines = worktrees.split("\n");
				for (const line of lines) {
					if (line.includes(`[${branch}]`)) {
						hasWorktree = true;
						worktreePath = line.split(/\s+/)[0];
						break;
					}
				}
			} catch {
				// Ignore errors
			}

			let lastCommit = "";
			let lastCommitDate = "";
			try {
				lastCommit = execSync(`git log -1 --format="%h" ${branch}`, {
					encoding: "utf-8",
				}).trim();
				lastCommitDate = execSync(`git log -1 --format="%ci" ${branch}`, {
					encoding: "utf-8",
				}).trim();
			} catch {
				// Ignore errors
			}

			return {
				name: branch,
				isCurrent,
				upstream,
				ahead,
				behind,
				gone,
				hasWorktree,
				worktreePath,
				lastCommit,
				lastCommitDate,
			};
		} catch {
			return null;
		}
	}

	/**
	 * Get all local branches with their status.
	 */
	getAllBranches(): BranchStatus[] {
		try {
			const branches = execSync("git branch --format='%(refname:short)'", {
				encoding: "utf-8",
			})
				.split("\n")
				.map((b) => b.trim())
				.filter(Boolean);

			return branches
				.map((b) => this.getBranchStatus(b))
				.filter((b): b is BranchStatus => b !== null);
		} catch {
			return [];
		}
	}

	/**
	 * Get branches that are "gone" (remote deleted).
	 */
	getGoneBranches(): BranchStatus[] {
		try {
			execSync(`git fetch ${this.config.remoteName} --prune`, { encoding: "utf-8" });
		} catch {
			// Ignore fetch errors
		}

		return this.getAllBranches().filter((b) => b.gone && b.name !== this.config.defaultBranch);
	}

	/**
	 * Delete a local branch.
	 */
	deleteBranch(branchName: string, force = false): boolean {
		try {
			const forceFlag = force ? "-D" : "-d";
			execSync(`git branch ${forceFlag} ${branchName}`, { encoding: "utf-8" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Remove a worktree.
	 */
	removeWorktree(worktreePath: string): boolean {
		try {
			execSync(`git worktree remove ${worktreePath}`, { encoding: "utf-8" });
			return true;
		} catch {
			try {
				execSync(`git worktree remove --force ${worktreePath}`, { encoding: "utf-8" });
				return true;
			} catch {
				return false;
			}
		}
	}

	/**
	 * Check if GitHub CLI is available.
	 */
	isGhAvailable(): boolean {
		try {
			execSync("gh --version", { encoding: "utf-8" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get PR for current branch.
	 */
	getPrForBranch(branchName?: string): PullRequestInfo | null {
		if (!this.isGhAvailable()) {
			return null;
		}

		const branch = branchName || this.getCurrentBranch();

		try {
			const headFlag = branch === this.getCurrentBranch() ? "" : `--head ${branch}`;
			const prJson = execSync(
				`gh pr view --json number,title,state,url,author,createdAt,mergeable,reviewDecision ${headFlag}`,
				{ encoding: "utf-8" },
			);

			const pr = JSON.parse(prJson);

			return {
				number: pr.number,
				title: pr.title,
				state: pr.state,
				url: pr.url,
				author: pr.author?.login || "unknown",
				createdAt: pr.createdAt,
				mergeable: pr.mergeable,
				reviewStatus: pr.reviewDecision?.toLowerCase() as PullRequestInfo["reviewStatus"],
			};
		} catch {
			return null;
		}
	}

	/**
	 * Create a pull request.
	 */
	createPullRequest(title: string, body?: string, draft = false): PullRequestInfo | null {
		if (!this.isGhAvailable()) {
			return null;
		}

		try {
			const draftFlag = draft ? "--draft" : "";
			const bodyArg = body ? `--body "${body.replace(/"/g, '\\"')}"` : "";
			const escapedTitle = title.replace(/"/g, '\\"');

			const prJson = execSync(
				`gh pr create --title "${escapedTitle}" ${bodyArg} ${draftFlag} --json number,title,state,url,author,createdAt`,
				{ encoding: "utf-8" },
			);

			const pr = JSON.parse(prJson);

			return {
				number: pr.number,
				title: pr.title,
				state: pr.state,
				url: pr.url,
				author: pr.author?.login || "unknown",
				createdAt: pr.createdAt,
				mergeable: null,
				reviewStatus: null,
			};
		} catch {
			return null;
		}
	}

	/**
	 * Get commit history for PR description.
	 */
	getBranchCommitHistory(baseBranch?: string): string[] {
		const base = baseBranch || this.config.defaultBranch;
		const current = this.getCurrentBranch();

		try {
			const commits = execSync(`git log ${base}..${current} --oneline`, {
				encoding: "utf-8",
			})
				.split("\n")
				.map((c) => c.trim())
				.filter(Boolean);

			return commits;
		} catch {
			return [];
		}
	}

	/**
	 * Generate PR description from commits.
	 */
	generatePrDescription(commits: string[]): string {
		if (commits.length === 0) {
			return "No changes to describe.";
		}

		const summaries = commits.slice(0, 3).map((c) => {
			const message = c.replace(/^[a-f0-9]+\s+/, "");
			return `- ${message}`;
		});

		const body = [
			"## Summary",
			"",
			...summaries,
			"",
			"## Test Plan",
			"",
			"- [ ] Manual testing completed",
			"- [ ] Unit tests pass",
			"- [ ] Integration tests pass",
		];

		if (this.config.includeAttribution) {
			body.push("", "---", "*Created with Paimon self-evolution agent*");
		}

		return body.join("\n");
	}

	/**
	 * Commit workflow: generate message and commit.
	 */
	async commit(stagedOnly = false): Promise<WorkflowResult> {
		if (!this.isGitRepo()) {
			return { success: false, message: "Not a git repository." };
		}

		if (!this.hasUncommittedChanges() && !this.hasStagedChanges()) {
			return { success: false, message: "No changes to commit." };
		}

		if (!stagedOnly && this.hasUncommittedChanges()) {
			if (!this.stageAllChanges()) {
				return { success: false, message: "Failed to stage changes." };
			}
		}

		const gen = getCommitMessageGenerator();
		if (this.config.model) {
			gen.setModel(this.config.model);
		}
		if (this.config.getApiKey) {
			gen.setApiKeyGetter(this.config.getApiKey);
		}

		const msg = await gen.generate();
		if (!msg) {
			return { success: false, message: "Failed to generate commit message." };
		}

		try {
			let commitMsg = msg.fullMessage;
			if (this.config.includeAttribution) {
				commitMsg += "\n\nCo-authored-by: Paimon <paimon@evolution.ai>";
			}

			execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { encoding: "utf-8" });

			return {
				success: true,
				message: `Committed: ${msg.fullMessage}`,
				details: { commit: msg.fullMessage },
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			return { success: false, message: `Failed to commit: ${errorMsg}` };
		}
	}

	/**
	 * Commit, push, and create PR workflow.
	 */
	async commitPushPr(draft = false): Promise<WorkflowResult> {
		if (!this.isGitRepo()) {
			return { success: false, message: "Not a git repository." };
		}

		if (!this.isGhAvailable()) {
			return {
				success: false,
				message: "GitHub CLI (gh) is required for PR creation. Install it first.",
			};
		}

		const currentBranch = this.getCurrentBranch();
		let createdBranch = false;

		if (this.isOnDefaultBranch() && this.config.autoCreateBranch) {
			const timestamp = Date.now();
			const newBranch = `${this.config.branchPrefix}auto-${timestamp}`;
			if (!this.createBranch(newBranch)) {
				return { success: false, message: "Failed to create feature branch." };
			}
			createdBranch = true;
		}

		if (this.hasUncommittedChanges() || this.hasStagedChanges()) {
			const commitResult = await this.commit();
			if (!commitResult.success) {
				if (createdBranch) {
					this.switchToBranch(this.config.defaultBranch);
					this.deleteBranch(this.getCurrentBranch());
				}
				return commitResult;
			}
		}

		const branchToPush = this.getCurrentBranch();
		if (!this.pushBranch(branchToPush, !this.hasUpstream())) {
			return { success: false, message: "Failed to push branch to remote." };
		}

		let pr = this.getPrForBranch(branchToPush);

		if (!pr) {
			const commits = this.getBranchCommitHistory();
			const title =
				commits.length > 0 ? commits[0].replace(/^[a-f0-9]+\s+/, "") : `Feature: ${branchToPush}`;
			const body = this.generatePrDescription(commits);

			pr = this.createPullRequest(title, body, draft);
		}

		if (!pr) {
			return {
				success: true,
				message: `Pushed to ${branchToPush}, but failed to create PR. Create manually with: gh pr create`,
				details: { branch: branchToPush },
			};
		}

		return {
			success: true,
			message: `Created PR #${pr.number}: ${pr.title}`,
			details: { branch: branchToPush, pr },
		};
	}

	/**
	 * Clean up gone branches (branches whose remote has been deleted).
	 */
	cleanGoneBranches(): WorkflowResult {
		if (!this.isGitRepo()) {
			return { success: false, message: "Not a git repository." };
		}

		const goneBranches = this.getGoneBranches();

		if (goneBranches.length === 0) {
			return { success: true, message: "No stale branches to clean up." };
		}

		const deleted: string[] = [];
		const skipped: string[] = [];

		for (const branch of goneBranches) {
			if (branch.isCurrent) {
				skipped.push(branch.name);
				continue;
			}

			if (branch.hasWorktree && branch.worktreePath) {
				if (!this.removeWorktree(branch.worktreePath)) {
					skipped.push(branch.name);
					continue;
				}
			}

			if (this.deleteBranch(branch.name, true)) {
				deleted.push(branch.name);
			} else {
				skipped.push(branch.name);
			}
		}

		return {
			success: true,
			message: `Cleaned up ${deleted.length} stale branches.`,
			details: { branchesDeleted: deleted, branchesSkipped: skipped },
		};
	}

	/**
	 * Get overall git status summary.
	 */
	getStatusSummary(): string {
		if (!this.isGitRepo()) {
			return "Not a git repository.";
		}

		const lines: string[] = [];
		const branch = this.getCurrentBranch();
		const status = this.getBranchStatus(branch);
		const pr = this.getPrForBranch(branch);
		const hasUncommitted = this.hasUncommittedChanges();
		const hasStaged = this.hasStagedChanges();

		lines.push("## Git Status Summary");
		lines.push("");
		lines.push(`**Current Branch:** ${branch}`);

		if (status) {
			if (status.upstream) {
				lines.push(`**Upstream:** ${status.upstream}`);
				if (status.ahead > 0 || status.behind > 0) {
					lines.push(`**Sync Status:** ${status.ahead} ahead, ${status.behind} behind`);
				} else {
					lines.push("**Sync Status:** Up to date");
				}
			} else {
				lines.push("**Upstream:** No upstream set");
			}
		}

		if (pr) {
			lines.push(`**PR:** #${pr.number} [${pr.state}] - ${pr.title}`);
			lines.push(`**PR URL:** ${pr.url}`);
		}

		lines.push("");
		lines.push(`**Working Directory:** ${hasUncommitted || hasStaged ? "Has changes" : "Clean"}`);

		if (hasStaged) {
			lines.push("- Staged changes ready to commit");
		}
		if (hasUncommitted && !hasStaged) {
			lines.push("- Unstaged changes");
		}

		return lines.join("\n");
	}
}

// Global instance
let manager: GitWorkflowManager | null = null;

/**
 * Get the global git workflow manager.
 */
export function getGitWorkflowManager(config?: Partial<GitWorkflowConfig>): GitWorkflowManager {
	if (!manager) {
		manager = new GitWorkflowManager(config);
	}
	return manager;
}

/**
 * Format branch status for display.
 */
export function formatBranchStatus(status: BranchStatus): string {
	const lines: string[] = [];
	const current = status.isCurrent ? "* " : "  ";

	lines.push(`${current}${status.name}`);

	if (status.upstream) {
		if (status.gone) {
			lines.push("    ⚠️ Remote branch deleted (gone)");
		} else if (status.ahead > 0 || status.behind > 0) {
			lines.push(`    ↕️ ${status.ahead} ahead, ${status.behind} behind ${status.upstream}`);
		} else {
			lines.push(`    ✓ Up to date with ${status.upstream}`);
		}
	} else {
		lines.push("    ⚠️ No upstream set");
	}

	if (status.hasWorktree) {
		lines.push(`    📁 Worktree: ${status.worktreePath}`);
	}

	lines.push(`    Last: ${status.lastCommit} (${status.lastCommitDate.split(" ")[0]})`);

	return lines.join("\n");
}

/**
 * Format PR info for display.
 */
export function formatPrInfo(pr: PullRequestInfo): string {
	const lines = [
		`## Pull Request #${pr.number}`,
		`**Title:** ${pr.title}`,
		`**State:** ${pr.state}`,
		`**Author:** ${pr.author}`,
		`**URL:** ${pr.url}`,
		`**Created:** ${pr.createdAt}`,
	];

	if (pr.mergeable !== null) {
		lines.push(`**Mergeable:** ${pr.mergeable ? "Yes" : "No"}`);
	}

	if (pr.reviewStatus) {
		const reviewLabels: Record<string, string> = {
			approved: "✓ Approved",
			changes_requested: "⚠️ Changes Requested",
			review_required: "⏳ Review Required",
		};
		lines.push(`**Review:** ${reviewLabels[pr.reviewStatus] || pr.reviewStatus}`);
	}

	return lines.join("\n");
}

/**
 * Tool implementation for git workflow.
 */
export async function gitWorkflowTool(args: {
	action:
		| "commit"
		| "commit-push-pr"
		| "clean-gone"
		| "status"
		| "branch-status"
		| "branches"
		| "pr-status"
		| "push"
		| "create-branch";
	branch?: string;
	draft?: boolean;
	stagedOnly?: boolean;
}): Promise<string> {
	const mgr = getGitWorkflowManager();

	switch (args.action) {
		case "commit": {
			const result = await mgr.commit(args.stagedOnly);
			return result.message;
		}

		case "commit-push-pr": {
			const result = await mgr.commitPushPr(args.draft);
			return result.message;
		}

		case "clean-gone": {
			const result = mgr.cleanGoneBranches();
			if (result.details?.branchesDeleted?.length) {
				const branchList = result.details.branchesDeleted.map((b) => `  - ${b}`).join("\n");
				return `Cleaned up ${result.details.branchesDeleted.length} stale branches:\n${branchList}`;
			}
			return result.message;
		}

		case "status": {
			return mgr.getStatusSummary();
		}

		case "branch-status": {
			const status = mgr.getBranchStatus(args.branch);
			if (!status) {
				return `Branch '${args.branch || "current"}' not found.`;
			}
			return formatBranchStatus(status);
		}

		case "branches": {
			const branches = mgr.getAllBranches();
			if (branches.length === 0) {
				return "No branches found.";
			}
			return `## All Branches (${branches.length})\n\n${branches.map(formatBranchStatus).join("\n\n")}`;
		}

		case "pr-status": {
			const pr = mgr.getPrForBranch(args.branch);
			if (!pr) {
				return args.branch
					? `No PR found for branch '${args.branch}'.`
					: "No PR found for current branch.";
			}
			return formatPrInfo(pr);
		}

		case "push": {
			const branch = args.branch || mgr.getCurrentBranch();
			if (mgr.pushBranch(branch, !mgr.hasUpstream())) {
				return `Successfully pushed ${branch} to remote.`;
			}
			return `Failed to push ${branch} to remote.`;
		}

		case "create-branch": {
			if (!args.branch) {
				return "Branch name required for create-branch action.";
			}
			if (mgr.createBranch(args.branch)) {
				return `Created and switched to branch '${args.branch}'.`;
			}
			return `Failed to create branch '${args.branch}'.`;
		}

		default:
			return "Unknown action. Use: commit, commit-push-pr, clean-gone, status, branch-status, branches, pr-status, push, create-branch";
	}
}
