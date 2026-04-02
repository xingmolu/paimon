/**
 * Interactive Approval Mode (SWE-agent/Aider Pattern)
 *
 * Provides interactive approval workflow for risky operations.
 * Before executing dangerous actions (file deletion, workflow modification,
 * large refactoring), the agent requests human approval.
 *
 * This enables safer self-modification by requiring explicit confirmation
 * for operations that could have significant impact.
 *
 * Inspired by:
 * - SWE-agent interactive commands
 * - Aider confirmation workflow
 * - OpenHands human-in-the-loop pattern
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DetectedPattern, RiskLevel, ScanResult } from "./safety-gates.js";
import { getSafetyGateManager } from "./safety-gates.js";

/**
 * Approval status for pending operations
 */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "auto-approved";

/**
 * Category of operation requiring approval
 */
export type ApprovalCategory =
	| "file-delete" // File/directory deletion
	| "file-modify" // File modification (especially important files)
	| "workflow" // CI/CD workflow changes
	| "self-modification" // Modifying agent's own code
	| "security" // Security-related changes
	| "breaking" // Breaking API changes
	| "data-loss" // Operations that could lose data
	| "large-refactor" // Large-scale refactoring
	| "external-command" // External shell commands
	| "custom"; // Custom approval requests

/**
 * Pending approval request
 */
export interface ApprovalRequest {
	/** Unique request ID */
	id: string;
	/** Operation category */
	category: ApprovalCategory;
	/** Risk level */
	risk: RiskLevel;
	/** Operation description */
	description: string;
	/** File path (if applicable) */
	file?: string;
	/** Operation content/command (if applicable) */
	content?: string;
	/** Tool that triggered the request */
	tool: string;
	/** Tool parameters */
	toolParams: Record<string, unknown>;
	/** Detected patterns that triggered approval */
	patterns: DetectedPattern[];
	/** Approval status */
	status: ApprovalStatus;
	/** Timestamp when request was created */
	timestamp: string;
	/** Expiration time (for auto-expire) */
	expiresAt?: string;
	/** Reason for approval/rejection (if processed) */
	reason?: string;
	/** Who approved/rejected (if applicable) */
	approvedBy?: string;
	/** Timestamp when processed */
	processedAt?: string;
	/** Whether this can be auto-approved based on confidence */
	autoApprovable: boolean;
	/** Suggested alternative action */
	suggestion?: string;
}

/**
 * Interactive approval configuration
 */
export interface InteractiveApprovalConfig {
	/** Enable/disable interactive approval mode */
	enabled: boolean;
	/** Auto-approve operations below this risk level */
	autoApproveBelow: RiskLevel;
	/** Minimum risk level to require approval */
	requireApprovalAbove: RiskLevel;
	/** Operations that ALWAYS require approval */
	alwaysRequireApproval: ApprovalCategory[];
	/** Operations that can be auto-approved */
	autoApprovableCategories: ApprovalCategory[];
	/** Approval expiration time (seconds) */
	expirationSeconds: number;
	/** Maximum pending approvals before blocking */
	maxPendingApprovals: number;
	/** Allow batch approval */
	allowBatchApproval: boolean;
	/** Track approval history */
	trackHistory: boolean;
}

/**
 * Statistics for interactive approval operations
 */
export interface InteractiveApprovalStats {
	/** Total approval requests */
	totalRequests: number;
	/** Approved requests */
	approved: number;
	/** Rejected requests */
	rejected: number;
	/** Auto-approved requests */
	autoApproved: number;
	/** Expired requests */
	expired: number;
	/** Requests by category */
	byCategory: Record<ApprovalCategory, number>;
	/** Requests by risk level */
	byRisk: Record<RiskLevel, number>;
	/** Most common approval requests */
	commonRequests: { category: ApprovalCategory; description: string; count: number }[];
	/** Approval rate by category */
	approvalRateByCategory: Record<ApprovalCategory, { approved: number; rejected: number }>;
	/** Average approval time (seconds) */
	avgApprovalTime: number;
	/** Last request timestamp */
	lastRequest?: string;
}

/**
 * Approval result after processing
 */
export interface ApprovalResult {
	/** Whether the operation is approved */
	approved: boolean;
	/** Request ID */
	requestId: string;
	/** Approval status */
	status: ApprovalStatus;
	/** Reason (if rejected) */
	reason?: string;
	/** Suggested alternative (if rejected) */
	suggestion?: string;
	/** Whether auto-approved */
	autoApproved: boolean;
}

/**
 * Default interactive approval configuration
 */
const DEFAULT_CONFIG: InteractiveApprovalConfig = {
	enabled: true,
	autoApproveBelow: "low",
	requireApprovalAbove: "high",
	alwaysRequireApproval: ["workflow", "self-modification", "file-delete", "security"],
	autoApprovableCategories: ["custom", "large-refactor"],
	expirationSeconds: 300, // 5 minutes
	maxPendingApprovals: 10,
	allowBatchApproval: true,
	trackHistory: true,
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
	return `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Protected file patterns - files that always require extra care
 */
const PROTECTED_FILE_PATTERNS = [
	/workflows/, // CI/CD workflows
	/safety[-]gates/, // Safety system
	/hooks[.]ts$/, // Hook system
	/interactive[-]approval/, // This file
	/SKILL[.]md$/, // Skill files
	/MEMORY[.]md$/, // Memory
	/ROADMAP[.]md$/, // Roadmap
	/IDENTITY[.]md$/, // Identity
];

/**
 * Interactive Approval Manager - handles approval workflow for risky operations
 */
export class InteractiveApprovalManager {
	private configPath: string;
	private statsPath: string;
	private pendingPath: string;
	private historyPath: string;
	private config: InteractiveApprovalConfig;
	private stats: InteractiveApprovalStats;
	private pendingApprovals: Map<string, ApprovalRequest>;
	private approvalHistory: ApprovalRequest[];

	constructor(configPath?: string) {
		this.configPath = configPath || join(homedir(), ".paimon", "interactive-approval.json");
		this.statsPath = join(homedir(), ".paimon", "approval-stats.json");
		this.pendingPath = join(homedir(), ".paimon", "pending-approvals.json");
		this.historyPath = join(homedir(), ".paimon", "approval-history.json");
		this.config = this.loadConfig();
		this.stats = this.loadStats();
		this.pendingApprovals = new Map();
		this.approvalHistory = this.loadHistory();
		this.loadPendingApprovals();
	}

	/**
	 * Load configuration
	 */
	private loadConfig(): InteractiveApprovalConfig {
		if (existsSync(this.configPath)) {
			try {
				const content = readFileSync(this.configPath, "utf-8");
				return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
			} catch {
				// Invalid config, use defaults
			}
		}
		return DEFAULT_CONFIG;
	}

	/**
	 * Load statistics
	 */
	private loadStats(): InteractiveApprovalStats {
		if (existsSync(this.statsPath)) {
			try {
				const content = readFileSync(this.statsPath, "utf-8");
				return JSON.parse(content);
			} catch {
				// Invalid stats, use defaults
			}
		}

		const categories: ApprovalCategory[] = [
			"file-delete",
			"file-modify",
			"workflow",
			"self-modification",
			"security",
			"breaking",
			"data-loss",
			"large-refactor",
			"external-command",
			"custom",
		];

		const risks: RiskLevel[] = ["critical", "high", "medium", "low"];

		return {
			totalRequests: 0,
			approved: 0,
			rejected: 0,
			autoApproved: 0,
			expired: 0,
			byCategory: Object.fromEntries(categories.map((c) => [c, 0])) as Record<
				ApprovalCategory,
				number
			>,
			byRisk: Object.fromEntries(risks.map((r) => [r, 0])) as Record<RiskLevel, number>,
			commonRequests: [],
			approvalRateByCategory: Object.fromEntries(
				categories.map((c) => [c, { approved: 0, rejected: 0 }]),
			) as Record<ApprovalCategory, { approved: number; rejected: number }>,
			avgApprovalTime: 0,
		};
	}

	/**
	 * Load pending approvals from disk
	 */
	private loadPendingApprovals(): void {
		if (existsSync(this.pendingPath)) {
			try {
				const content = readFileSync(this.pendingPath, "utf-8");
				const pending = JSON.parse(content) as ApprovalRequest[];
				for (const request of pending) {
					// Check if expired
					if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
						request.status = "expired";
						this.stats.expired++;
						this.addToHistory(request);
					} else {
						this.pendingApprovals.set(request.id, request);
					}
				}
				this.saveStats();
			} catch {
				// Invalid pending file, start fresh
			}
		}
	}

	/**
	 * Load approval history
	 */
	private loadHistory(): ApprovalRequest[] {
		if (existsSync(this.historyPath)) {
			try {
				const content = readFileSync(this.historyPath, "utf-8");
				return JSON.parse(content) as ApprovalRequest[];
			} catch {
				// Invalid history, start fresh
			}
		}
		return [];
	}

	/**
	 * Save configuration
	 */
	private saveConfig(): void {
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
	}

	/**
	 * Save statistics
	 */
	private saveStats(): void {
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2), "utf-8");
	}

	/**
	 * Save pending approvals
	 */
	private savePending(): void {
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		const pending = Array.from(this.pendingApprovals.values());
		writeFileSync(this.pendingPath, JSON.stringify(pending, null, 2), "utf-8");
	}

	/**
	 * Save history
	 */
	private saveHistory(): void {
		if (!this.config.trackHistory) return;
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		// Keep last 100 history entries
		const history = this.approvalHistory.slice(-100);
		writeFileSync(this.historyPath, JSON.stringify(history, null, 2), "utf-8");
	}

	/**
	 * Add request to history
	 */
	private addToHistory(request: ApprovalRequest): void {
		this.approvalHistory.push(request);
		this.saveHistory();
	}

	/**
	 * Check if approval mode is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable/disable approval mode
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveConfig();
	}

	/**
	 * Get configuration
	 */
	getConfig(): InteractiveApprovalConfig {
		return this.config;
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<InteractiveApprovalConfig>): void {
		Object.assign(this.config, updates);
		this.saveConfig();
	}

	/**
	 * Determine if an operation requires approval
	 */
	requiresApproval(
		tool: string,
		toolParams: Record<string, unknown>,
		scanResult?: ScanResult,
	): boolean {
		if (!this.config.enabled) return false;

		// Check if max pending approvals reached
		if (this.pendingApprovals.size >= this.config.maxPendingApprovals) {
			return true; // Block until pending are processed
		}

		// Determine category from tool and params
		const category = this.determineCategory(tool, toolParams);

		// Always require approval for certain categories
		if (this.config.alwaysRequireApproval.includes(category)) {
			return true;
		}

		// Check scan result for risk patterns
		if (scanResult) {
			// Has critical patterns
			if (scanResult.critical.length > 0) {
				return true;
			}

			// Has high risk patterns
			if (scanResult.highRisk.length > 0) {
				return true;
			}

			// Check risk level threshold
			const riskLevels: RiskLevel[] = ["critical", "high", "medium", "low"];
			const highestRisk = this.getHighestRisk(scanResult.patterns);
			const thresholdIndex = riskLevels.indexOf(this.config.requireApprovalAbove);
			const riskIndex = riskLevels.indexOf(highestRisk);

			if (riskIndex <= thresholdIndex) {
				return true;
			}
		}

		// Check file path for protected files
		const file = toolParams.path as string | undefined;
		if (file && this.isProtectedFile(file)) {
			return true;
		}

		return false;
	}

	/**
	 * Determine approval category from tool and params
	 */
	private determineCategory(tool: string, params: Record<string, unknown>): ApprovalCategory {
		// File deletion
		if (tool === "bash") {
			const command = params.command as string;
			if (command?.match(/rm\s+-rf|unlink|rmdir|delete/i)) {
				return "file-delete";
			}
			if (command?.match(/curl\s+\||wget\s+\||eval|exec/i)) {
				return "external-command";
			}
			return "external-command";
		}

		// File modification
		if (tool === "write" || tool === "edit") {
			const path = params.path as string;

			// Check for workflow modification
			if (path?.includes("workflows")) {
				return "workflow";
			}

			// Check for self-modification
			if (
				path?.includes("safety-gates") ||
				path?.includes("hooks") ||
				path?.includes("interactive-approval") ||
				path?.includes("SKILL.md")
			) {
				return "self-modification";
			}

			// Check for important files
			if (
				path?.includes("MEMORY.md") ||
				path?.includes("ROADMAP.md") ||
				path?.includes("IDENTITY.md")
			) {
				return "data-loss";
			}

			return "file-modify";
		}

		return "custom";
	}

	/**
	 * Check if file is protected
	 */
	isProtectedFile(file: string): boolean {
		return PROTECTED_FILE_PATTERNS.some((pattern) => pattern.test(file));
	}

	/**
	 * Get highest risk level from patterns
	 */
	private getHighestRisk(patterns: DetectedPattern[]): RiskLevel {
		const riskLevels: RiskLevel[] = ["critical", "high", "medium", "low"];
		for (const risk of riskLevels) {
			if (patterns.some((p) => p.risk === risk)) {
				return risk;
			}
		}
		return "low";
	}

	/**
	 * Check if request can be auto-approved
	 */
	canAutoApprove(request: ApprovalRequest): boolean {
		// Never auto-approve always-require categories
		if (this.config.alwaysRequireApproval.includes(request.category)) {
			return false;
		}

		// Check risk level
		const riskLevels: RiskLevel[] = ["critical", "high", "medium", "low"];
		const autoIndex = riskLevels.indexOf(this.config.autoApproveBelow);
		const riskIndex = riskLevels.indexOf(request.risk);

		// Auto-approve if risk is below threshold
		if (riskIndex > autoIndex) {
			return true;
		}

		// Check auto-approvable categories
		if (this.config.autoApprovableCategories.includes(request.category)) {
			// Only if no critical/high patterns
			if (!request.patterns.some((p) => p.risk === "critical" || p.risk === "high")) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Create approval request for an operation
	 */
	createRequest(
		tool: string,
		toolParams: Record<string, unknown>,
		description: string,
		scanResult?: ScanResult,
	): ApprovalRequest {
		const category = this.determineCategory(tool, toolParams);
		const risk = scanResult ? this.getHighestRisk(scanResult.patterns) : "low";

		const request: ApprovalRequest = {
			id: generateRequestId(),
			category,
			risk,
			description,
			file: toolParams.path as string | undefined,
			content: toolParams.content as string | undefined,
			tool,
			toolParams,
			patterns: scanResult?.patterns || [],
			status: "pending",
			timestamp: new Date().toISOString(),
			expiresAt: new Date(Date.now() + this.config.expirationSeconds * 1000).toISOString(),
			autoApprovable: false,
			suggestion: scanResult?.patterns[0]?.suggestion,
		};

		// Check if auto-approvable
		request.autoApprovable = this.canAutoApprove(request);

		// Update statistics
		this.stats.totalRequests++;
		this.stats.byCategory[category]++;
		this.stats.byRisk[risk]++;
		this.stats.lastRequest = request.timestamp;

		// Update common requests
		const existing = this.stats.commonRequests.find(
			(r) => r.category === category && r.description === description,
		);
		if (existing) {
			existing.count++;
		} else {
			this.stats.commonRequests.push({ category, description, count: 1 });
		}
		this.stats.commonRequests.sort((a, b) => b.count - a.count);
		this.stats.commonRequests = this.stats.commonRequests.slice(0, 10);

		this.saveStats();

		// Add to pending
		this.pendingApprovals.set(request.id, request);
		this.savePending();

		return request;
	}

	/**
	 * Auto-approve a request if possible
	 */
	tryAutoApprove(requestId: string): ApprovalResult | null {
		const request = this.pendingApprovals.get(requestId);
		if (!request || request.status !== "pending") {
			return null;
		}

		if (!request.autoApprovable) {
			return null;
		}

		// Auto-approve
		request.status = "auto-approved";
		request.processedAt = new Date().toISOString();
		request.reason = "Auto-approved: low risk and auto-approvable category";

		this.stats.autoApproved++;
		this.stats.approved++;
		this.stats.approvalRateByCategory[request.category].approved++;

		this.pendingApprovals.delete(requestId);
		this.addToHistory(request);
		this.savePending();
		this.saveStats();

		return {
			approved: true,
			requestId,
			status: "auto-approved",
			reason: request.reason,
			autoApproved: true,
		};
	}

	/**
	 * Approve a pending request
	 */
	approve(requestId: string, reason?: string, approvedBy?: string): ApprovalResult {
		const request = this.pendingApprovals.get(requestId);
		if (!request) {
			return {
				approved: false,
				requestId,
				status: "rejected",
				reason: "Request not found or already processed",
				autoApproved: false,
			};
		}

		if (request.status !== "pending") {
			return {
				approved: request.status === "approved" || request.status === "auto-approved",
				requestId,
				status: request.status,
				reason: `Already ${request.status}`,
				autoApproved: request.status === "auto-approved",
			};
		}

		// Approve
		request.status = "approved";
		request.processedAt = new Date().toISOString();
		request.reason = reason || "Approved by user";
		request.approvedBy = approvedBy || "user";

		this.stats.approved++;
		this.stats.approvalRateByCategory[request.category].approved++;

		// Calculate approval time
		const approvalTime =
			(new Date(request.processedAt).getTime() - new Date(request.timestamp).getTime()) / 1000;
		this.updateAvgApprovalTime(approvalTime);

		this.pendingApprovals.delete(requestId);
		this.addToHistory(request);
		this.savePending();
		this.saveStats();

		return {
			approved: true,
			requestId,
			status: "approved",
			reason: request.reason,
			autoApproved: false,
		};
	}

	/**
	 * Reject a pending request
	 */
	reject(requestId: string, reason?: string, suggestion?: string): ApprovalResult {
		const request = this.pendingApprovals.get(requestId);
		if (!request) {
			return {
				approved: false,
				requestId,
				status: "rejected",
				reason: "Request not found or already processed",
				autoApproved: false,
			};
		}

		if (request.status !== "pending") {
			return {
				approved: request.status === "approved" || request.status === "auto-approved",
				requestId,
				status: request.status,
				reason: `Already ${request.status}`,
				autoApproved: request.status === "auto-approved",
			};
		}

		// Reject
		request.status = "rejected";
		request.processedAt = new Date().toISOString();
		request.reason = reason || "Rejected by user";
		if (suggestion) request.suggestion = suggestion;

		this.stats.rejected++;
		this.stats.approvalRateByCategory[request.category].rejected++;

		this.pendingApprovals.delete(requestId);
		this.addToHistory(request);
		this.savePending();
		this.saveStats();

		return {
			approved: false,
			requestId,
			status: "rejected",
			reason: request.reason,
			suggestion: request.suggestion,
			autoApproved: false,
		};
	}

	/**
	 * Update average approval time
	 */
	private updateAvgApprovalTime(newTime: number): void {
		if (this.stats.avgApprovalTime === 0) {
			this.stats.avgApprovalTime = newTime;
		} else {
			// Moving average
			this.stats.avgApprovalTime = this.stats.avgApprovalTime * 0.9 + newTime * 0.1;
		}
	}

	/**
	 * Get pending approvals
	 */
	getPendingApprovals(): ApprovalRequest[] {
		return Array.from(this.pendingApprovals.values()).sort(
			(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);
	}

	/**
	 * Get a specific pending request
	 */
	getRequest(requestId: string): ApprovalRequest | undefined {
		return this.pendingApprovals.get(requestId);
	}

	/**
	 * Get approval history
	 */
	getHistory(limit?: number): ApprovalRequest[] {
		const history = this.approvalHistory.sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);
		return limit ? history.slice(0, limit) : history;
	}

	/**
	 * Get statistics
	 */
	getStats(): InteractiveApprovalStats {
		return this.stats;
	}

	/**
	 * Clear pending approvals
	 */
	clearPending(): void {
		// Mark all as expired
		for (const request of this.pendingApprovals.values()) {
			request.status = "expired";
			request.processedAt = new Date().toISOString();
			this.stats.expired++;
			this.addToHistory(request);
		}
		this.pendingApprovals.clear();
		this.savePending();
		this.saveStats();
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = this.loadStats();
		this.saveStats();
	}

	/**
	 * Clear history
	 */
	clearHistory(): void {
		this.approvalHistory = [];
		this.saveHistory();
	}

	/**
	 * Batch approve multiple requests
	 */
	batchApprove(requestIds: string[], reason?: string): ApprovalResult[] {
		if (!this.config.allowBatchApproval) {
			return requestIds.map((id) => ({
				approved: false,
				requestId: id,
				status: "rejected",
				reason: "Batch approval not enabled",
				autoApproved: false,
			}));
		}

		return requestIds.map((id) => this.approve(id, reason, "batch-approval"));
	}

	/**
	 * Batch reject multiple requests
	 */
	batchReject(requestIds: string[], reason?: string): ApprovalResult[] {
		return requestIds.map((id) => this.reject(id, reason));
	}

	/**
	 * Format pending approvals for display
	 */
	formatPendingApprovals(): string {
		const pending = this.getPendingApprovals();

		if (pending.length === 0) {
			return "## Pending Approvals\n\n✅ No pending approvals\n";
		}

		let output = "## Pending Approvals\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total: ${pending.length} pending\n`;
		output += `${"─".repeat(50)}\n\n`;

		for (const request of pending) {
			const riskEmoji =
				request.risk === "critical"
					? "🔴"
					: request.risk === "high"
						? "🟠"
						: request.risk === "medium"
							? "🟡"
							: "🟢";

			const autoIcon = request.autoApprovable ? "⚡" : "🔒";

			output += `${riskEmoji} ${autoIcon} [${request.id}] ${request.category}\n`;
			output += `   ${request.description}\n`;
			if (request.file) {
				output += `   File: ${request.file}\n`;
			}
			output += `   Tool: ${request.tool}\n`;
			output += `   Risk: ${request.risk}\n`;
			output += `   Auto-approvable: ${request.autoApprovable ? "Yes" : "No"}\n`;
			if (request.patterns.length > 0) {
				output += `   Patterns: ${request.patterns.length} detected\n`;
			}
			if (request.expiresAt) {
				const expires = new Date(request.expiresAt);
				const now = new Date();
				const remaining = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
				output += `   Expires in: ${remaining}s\n`;
			}
			output += "\n";
		}

		return output;
	}

	/**
	 * Format statistics for display
	 */
	formatStats(): string {
		let output = "## Interactive Approval Statistics\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total Requests: ${this.stats.totalRequests}\n`;
		output += `Approved: ${this.stats.approved} (${this.percent(this.stats.approved, this.stats.totalRequests)}%)\n`;
		output += `Rejected: ${this.stats.rejected} (${this.percent(this.stats.rejected, this.stats.totalRequests)}%)\n`;
		output += `Auto-approved: ${this.stats.autoApproved}\n`;
		output += `Expired: ${this.stats.expired}\n`;
		output += `Avg Approval Time: ${this.stats.avgApprovalTime.toFixed(1)}s\n`;
		if (this.stats.lastRequest) {
			output += `Last Request: ${this.stats.lastRequest}\n`;
		}
		output += `${"─".repeat(50)}\n\n`;

		if (this.stats.commonRequests.length > 0) {
			output += "### Most Common Requests\n";
			for (const r of this.stats.commonRequests) {
				output += `- [${r.category}] ${r.description}: ${r.count}\n`;
			}
			output += "\n";
		}

		if (
			Object.values(this.stats.approvalRateByCategory).some((v) => v.approved > 0 || v.rejected > 0)
		) {
			output += "### Approval Rate by Category\n";
			for (const [category, rates] of Object.entries(this.stats.approvalRateByCategory)) {
				if (rates.approved > 0 || rates.rejected > 0) {
					const total = rates.approved + rates.rejected;
					const rate = this.percent(rates.approved, total);
					output += `- ${category}: ${rates.approved}/${total} (${rate}%)\n`;
				}
			}
		}

		return output;
	}

	/**
	 * Format request details for display
	 */
	formatRequest(requestId: string): string {
		const request = this.getRequest(requestId);
		if (!request) {
			return `## Request ${requestId}\n\n❌ Request not found\n`;
		}

		let output = `## Approval Request: ${requestId}\n`;
		output += `${"─".repeat(50)}\n`;
		output += `Category: ${request.category}\n`;
		output += `Risk: ${request.risk}\n`;
		output += `Status: ${request.status}\n`;
		output += `Tool: ${request.tool}\n`;
		output += `Description: ${request.description}\n`;
		if (request.file) {
			output += `File: ${request.file}\n`;
		}
		output += `Timestamp: ${request.timestamp}\n`;
		if (request.expiresAt) {
			output += `Expires: ${request.expiresAt}\n`;
		}
		output += `Auto-approvable: ${request.autoApprovable}\n`;
		output += `${"─".repeat(50)}\n\n`;

		if (request.patterns.length > 0) {
			output += "### Detected Patterns\n";
			for (const pattern of request.patterns) {
				output += `- [${pattern.risk}] ${pattern.name}\n`;
				output += `  ${pattern.description}\n`;
				output += `  Suggestion: ${pattern.suggestion}\n`;
			}
			output += "\n";
		}

		if (request.status !== "pending") {
			output += "### Processing Result\n";
			output += `Processed: ${request.processedAt}\n`;
			output += `Reason: ${request.reason}\n`;
			if (request.approvedBy) {
				output += `By: ${request.approvedBy}\n`;
			}
			if (request.suggestion) {
				output += `Suggestion: ${request.suggestion}\n`;
			}
		}

		return output;
	}

	/**
	 * Calculate percentage
	 */
	private percent(value: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((value / total) * 100);
	}
}

// Singleton instance
let approvalManagerInstance: InteractiveApprovalManager | null = null;

/**
 * Get the interactive approval manager instance
 */
export function getApprovalManager(): InteractiveApprovalManager {
	if (!approvalManagerInstance) {
		approvalManagerInstance = new InteractiveApprovalManager();
	}
	return approvalManagerInstance;
}

/**
 * Interactive Approval Tool
 *
 * Provides tool interface for managing approval workflow.
 */
export function interactiveApprovalTool(args: {
	action:
		| "request"
		| "approve"
		| "reject"
		| "pending"
		| "stats"
		| "config"
		| "history"
		| "clear"
		| "batch"
		| "auto"
		| "get";
	requestId?: string;
	tool?: string;
	toolParams?: Record<string, unknown>;
	description?: string;
	reason?: string;
	suggestion?: string;
	requestIds?: string[];
}): string {
	const manager = getApprovalManager();
	const safetyManager = getSafetyGateManager();

	switch (args.action) {
		case "request": {
			if (!args.tool || !args.toolParams || !args.description) {
				return "❌ Missing required parameters: tool, toolParams, description";
			}

			// Scan for dangerous patterns if content provided
			let scanResult: ScanResult | undefined;
			if (args.toolParams.content) {
				scanResult = safetyManager.scan(
					args.toolParams.content as string,
					args.toolParams.path as string,
				);
			}

			// Check if approval required
			if (!manager.requiresApproval(args.tool, args.toolParams, scanResult)) {
				return "✅ Operation does not require approval";
			}

			// Create request
			const request = manager.createRequest(
				args.tool,
				args.toolParams,
				args.description,
				scanResult,
			);

			// Try auto-approve
			if (request.autoApprovable) {
				const result = manager.tryAutoApprove(request.id);
				if (result?.approved) {
					return `✅ Auto-approved: ${request.id}\nReason: ${result.reason}`;
				}
			}

			return manager.formatRequest(request.id);
		}

		case "approve": {
			if (!args.requestId) {
				return "❌ Missing requestId";
			}
			const approveResult = manager.approve(args.requestId, args.reason);
			if (approveResult.approved) {
				return `✅ Approved: ${args.requestId}\nReason: ${approveResult.reason}`;
			}
			return `❌ Approval failed: ${approveResult.reason}`;
		}

		case "reject": {
			if (!args.requestId) {
				return "❌ Missing requestId";
			}
			const rejectResult = manager.reject(args.requestId, args.reason, args.suggestion);
			if (!rejectResult.approved) {
				let output = `✅ Rejected: ${args.requestId}\nReason: ${rejectResult.reason}`;
				if (rejectResult.suggestion) {
					output += `\nSuggestion: ${rejectResult.suggestion}`;
				}
				return output;
			}
			return `❌ Rejection failed: ${rejectResult.reason}`;
		}

		case "pending":
			return manager.formatPendingApprovals();

		case "stats":
			return manager.formatStats();

		case "config": {
			const config = manager.getConfig();
			let configOutput = "## Interactive Approval Configuration\n";
			configOutput += `${"─".repeat(50)}\n`;
			configOutput += `Enabled: ${config.enabled ? "✅" : "❌"}\n`;
			configOutput += `Auto-approve Below: ${config.autoApproveBelow}\n`;
			configOutput += `Require Approval Above: ${config.requireApprovalAbove}\n`;
			configOutput += `Always Require: ${config.alwaysRequireApproval.join(", ")}\n`;
			configOutput += `Auto-approvable Categories: ${config.autoApprovableCategories.join(", ")}\n`;
			configOutput += `Expiration: ${config.expirationSeconds}s\n`;
			configOutput += `Max Pending: ${config.maxPendingApprovals}\n`;
			configOutput += `Batch Approval: ${config.allowBatchApproval ? "✅" : "❌"}\n`;
			configOutput += `Track History: ${config.trackHistory ? "✅" : "❌"}\n`;
			return configOutput;
		}

		case "history": {
			const limit = args.requestId ? undefined : 20;
			const history = manager.getHistory(limit);
			if (history.length === 0) {
				return "## Approval History\n\nNo history entries\n";
			}
			let historyOutput = "## Approval History\n";
			historyOutput += `${"─".repeat(50)}\n`;
			historyOutput += `Total: ${history.length} entries\n\n`;
			for (const req of history) {
				const statusIcon =
					req.status === "approved" || req.status === "auto-approved"
						? "✅"
						: req.status === "rejected"
							? "❌"
							: "⏱️";
				historyOutput += `${statusIcon} [${req.id}] ${req.category}: ${req.status}\n`;
				historyOutput += `   ${req.description}\n`;
				if (req.reason) {
					historyOutput += `   Reason: ${req.reason}\n`;
				}
			}
			return historyOutput;
		}

		case "clear":
			if (args.requestId === "pending") {
				manager.clearPending();
				return "✅ Pending approvals cleared";
			}
			if (args.requestId === "stats") {
				manager.resetStats();
				return "✅ Statistics reset";
			}
			if (args.requestId === "history") {
				manager.clearHistory();
				return "✅ History cleared";
			}
			return "❌ Specify what to clear: pending, stats, or history";

		case "batch": {
			if (!args.requestIds || args.requestIds.length === 0) {
				return "❌ Missing requestIds for batch operation";
			}
			const batchReason = args.reason;
			const batchResults = args.reason?.includes("reject")
				? manager.batchReject(args.requestIds, batchReason)
				: manager.batchApprove(args.requestIds, batchReason);
			let batchOutput = "## Batch Approval Results\n";
			batchOutput += `${"─".repeat(50)}\n`;
			batchOutput += `Total: ${args.requestIds.length}\n`;
			batchOutput += `Approved: ${batchResults.filter((r) => r.approved).length}\n`;
			batchOutput += `Rejected: ${batchResults.filter((r) => !r.approved).length}\n\n`;
			for (const result of batchResults) {
				batchOutput += `${result.approved ? "✅" : "❌"} ${result.requestId}: ${result.status}\n`;
			}
			return batchOutput;
		}

		case "auto": {
			if (!args.requestId) {
				return "❌ Missing requestId for auto-approve attempt";
			}
			const autoResult = manager.tryAutoApprove(args.requestId);
			if (autoResult?.approved) {
				return `✅ Auto-approved: ${args.requestId}\nReason: ${autoResult.reason}`;
			}
			return `❌ Cannot auto-approve: ${args.requestId}\nNot eligible for auto-approval`;
		}

		case "get":
			if (!args.requestId) {
				return "❌ Missing requestId";
			}
			return manager.formatRequest(args.requestId);

		default:
			return `❌ Unknown action: ${args.action}`;
	}
}
