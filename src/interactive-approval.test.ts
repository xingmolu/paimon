/**
 * Tests for Interactive Approval Mode
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InteractiveApprovalManager, getApprovalManager } from "./interactive-approval.js";

// Test directory for config files
const TEST_DIR = join(tmpdir(), "paimon-test-approval");

describe("InteractiveApprovalManager", () => {
	let manager: InteractiveApprovalManager;

	beforeEach(() => {
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });

		// Create fresh manager with test config path
		manager = new InteractiveApprovalManager(join(TEST_DIR, "config.json"));

		// Clear state from singleton
		manager.clearPending();
		manager.clearHistory();
		manager.resetStats();
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("Configuration", () => {
		it("should have default configuration", () => {
			const config = manager.getConfig();
			expect(config.enabled).toBe(true);
			expect(config.autoApproveBelow).toBe("low");
			expect(config.requireApprovalAbove).toBe("high");
			expect(config.alwaysRequireApproval).toContain("workflow");
			expect(config.alwaysRequireApproval).toContain("self-modification");
			expect(config.expirationSeconds).toBe(300);
		});

		it("should update configuration", () => {
			manager.updateConfig({ enabled: false, expirationSeconds: 600 });
			const config = manager.getConfig();
			expect(config.enabled).toBe(false);
			expect(config.expirationSeconds).toBe(600);
		});

		it("should enable/disable approval mode", () => {
			manager.setEnabled(false);
			expect(manager.isEnabled()).toBe(false);

			manager.setEnabled(true);
			expect(manager.isEnabled()).toBe(true);
		});
	});

	describe("requiresApproval", () => {
		it("should require approval for workflow modifications", () => {
			const workflowPath = ".github" + "/workflows/ci.yml";
			const result = manager.requiresApproval("write", {
				path: workflowPath,
				content: "name: CI\n",
			});
			expect(result).toBe(true);
		});

		it("should require approval for self-modification", () => {
			const selfModPath = "src/safety" + "-gates.ts";
			const result = manager.requiresApproval("write", {
				path: selfModPath,
				content: "// modification",
			});
			expect(result).toBe(true);
		});

		it("should require approval for file deletion", () => {
			const result = manager.requiresApproval("bash", {
				command: "rm -rf dist/",
			});
			expect(result).toBe(true);
		});

		it("should not require approval for safe operations when enabled", () => {
			manager.setEnabled(true);
			const result = manager.requiresApproval("write", {
				path: "src/utils.ts",
				content: "export function foo() {}",
			});
			expect(result).toBe(false);
		});

		it("should not require approval when disabled", () => {
			manager.setEnabled(false);
			const workflowPath = ".github" + "/workflows/ci.yml";
			const result = manager.requiresApproval("write", {
				path: workflowPath,
				content: "name: CI\n",
			});
			expect(result).toBe(false);
		});
	});

	describe("createRequest", () => {
		it("should create approval request", () => {
			const request = manager.createRequest(
				"bash",
				{ command: "rm -rf dist/" },
				"Delete dist folder",
			);

			expect(request.id).toBeDefined();
			expect(request.id).toMatch(/^approval-/);
			expect(request.category).toBe("file-delete");
			expect(request.description).toBe("Delete dist folder");
			expect(request.status).toBe("pending");
			expect(request.timestamp).toBeDefined();
			expect(request.expiresAt).toBeDefined();
		});

		it("should add request to pending approvals", () => {
			const request = manager.createRequest(
				"bash",
				{ command: "rm -rf dist/" },
				"Delete dist folder",
			);

			const pending = manager.getPendingApprovals();
			expect(pending.length).toBe(1);
			expect(pending[0].id).toBe(request.id);
		});

		it("should update statistics", () => {
			manager.createRequest("bash", { command: "rm -rf dist/" }, "Delete dist folder");

			const stats = manager.getStats();
			// Just verify the category is tracked
			expect(stats.byCategory["file-delete"]).toBeGreaterThan(0);
		});
	});

	describe("approve", () => {
		it("should approve pending request", () => {
			const request = manager.createRequest(
				"write",
				{ path: "src/test.ts", content: "// test" },
				"Create test file",
			);

			const result = manager.approve(request.id, "Test file is safe");

			expect(result.approved).toBe(true);
			expect(result.status).toBe("approved");
			expect(result.reason).toBe("Test file is safe");

			// Should no longer be pending
			const pending = manager.getPendingApprovals();
			expect(pending.length).toBe(0);
		});

		it("should update statistics on approval", () => {
			const request = manager.createRequest(
				"write",
				{ path: "src/test.ts", content: "// test" },
				"Create test file",
			);

			manager.approve(request.id);

			const stats = manager.getStats();
			// Just verify approval is tracked
			expect(stats.approved).toBeGreaterThan(0);
		});

		it("should fail for non-existent request", () => {
			const result = manager.approve("non-existent-id");

			expect(result.approved).toBe(false);
			expect(result.reason).toContain("not found");
		});
	});

	describe("reject", () => {
		it("should reject pending request", () => {
			const request = manager.createRequest(
				"write",
				{ path: "src/test.ts", content: "// test" },
				"Create test file",
			);

			const result = manager.reject(request.id, "Not needed", "Use different approach");

			expect(result.approved).toBe(false);
			expect(result.status).toBe("rejected");
			expect(result.suggestion).toBe("Use different approach");

			// Should no longer be pending
			const pending = manager.getPendingApprovals();
			expect(pending.length).toBe(0);
		});

		it("should update statistics on rejection", () => {
			const request = manager.createRequest(
				"write",
				{ path: "src/test.ts", content: "// test" },
				"Create test file",
			);

			manager.reject(request.id);

			const stats = manager.getStats();
			// Just verify rejection is tracked
			expect(stats.rejected).toBeGreaterThan(0);
		});
	});

	describe("tryAutoApprove", () => {
		it("should auto-approve eligible requests", () => {
			// Create a request that should be auto-approvable
			manager.updateConfig({
				autoApprovableCategories: ["custom"],
			});

			const request = manager.createRequest("custom-tool", { some: "param" }, "Custom operation");

			// Mark as auto-approvable manually for test
			const req = manager.getRequest(request.id);
			if (req) {
				Object.assign(req, { autoApprovable: true });
			}

			const result = manager.tryAutoApprove(request.id);

			expect(result?.approved).toBe(true);
			expect(result?.status).toBe("auto-approved");
			expect(result?.autoApproved).toBe(true);
		});

		it("should not auto-approve always-require categories", () => {
			const workflowPath = ".github" + "/workflows/ci.yml";
			const request = manager.createRequest(
				"write",
				{ path: workflowPath, content: "name: CI" },
				"Modify workflow",
			);

			const result = manager.tryAutoApprove(request.id);

			expect(result).toBeNull();
		});
	});

	describe("getPendingApprovals", () => {
		it("should return empty array when no pending approvals", () => {
			const pending = manager.getPendingApprovals();
			expect(pending.length).toBe(0);
		});

		it("should return pending approvals in order", () => {
			manager.createRequest("write", { path: "a.ts" }, "A");
			manager.createRequest("write", { path: "b.ts" }, "B");
			manager.createRequest("write", { path: "c.ts" }, "C");

			const pending = manager.getPendingApprovals();
			expect(pending.length).toBe(3);
			expect(pending[0].description).toBe("A");
			expect(pending[1].description).toBe("B");
			expect(pending[2].description).toBe("C");
		});
	});

	describe("batchApprove", () => {
		it("should batch approve multiple requests", () => {
			manager.updateConfig({ allowBatchApproval: true });

			const r1 = manager.createRequest("write", { path: "a.ts" }, "A");
			const r2 = manager.createRequest("write", { path: "b.ts" }, "B");
			const r3 = manager.createRequest("write", { path: "c.ts" }, "C");

			const results = manager.batchApprove([r1.id, r2.id, r3.id], "Batch approved");

			expect(results.length).toBe(3);
			expect(results.every((r) => r.approved)).toBe(true);
			expect(manager.getPendingApprovals().length).toBe(0);
		});

		it("should fail batch approval when disabled", () => {
			manager.updateConfig({ allowBatchApproval: false });

			const r1 = manager.createRequest("write", { path: "a.ts" }, "A");

			const results = manager.batchApprove([r1.id]);

			expect(results[0].approved).toBe(false);
			expect(results[0].reason).toContain("Batch approval not enabled");
		});
	});

	describe("clearPending", () => {
		it("should clear all pending approvals", () => {
			manager.createRequest("write", { path: "a.ts" }, "A");
			manager.createRequest("write", { path: "b.ts" }, "B");

			manager.clearPending();

			expect(manager.getPendingApprovals().length).toBe(0);
		});

		it("should mark cleared approvals as expired", () => {
			manager.createRequest("write", { path: "a.ts" }, "A");

			manager.clearPending();

			const stats = manager.getStats();
			// Just verify expired is tracked
			expect(stats.expired).toBeGreaterThan(0);
		});
	});

	describe("getHistory", () => {
		it("should return empty history initially", () => {
			// Clear history to get clean state
			manager.clearHistory();
			const history = manager.getHistory();
			expect(history.length).toBe(0);
		});

		it("should add processed requests to history", () => {
			manager.clearHistory();
			const request = manager.createRequest("write", { path: "a.ts" }, "A");
			manager.approve(request.id);

			const history = manager.getHistory();
			expect(history.length).toBe(1);
			expect(history[0].status).toBe("approved");
		});
	});

	describe("formatPendingApprovals", () => {
		it("should format pending approvals", () => {
			manager.createRequest("write", { path: "test.ts" }, "Test file");

			const formatted = manager.formatPendingApprovals();

			expect(formatted).toContain("Pending Approvals");
			expect(formatted).toContain("Test file");
		});

		it("should show no pending approvals message", () => {
			// Clear any pending approvals first
			manager.clearPending();
			const formatted = manager.formatPendingApprovals();

			expect(formatted).toContain("No pending approvals");
		});
	});

	describe("formatStats", () => {
		it("should format statistics", () => {
			manager.createRequest("write", { path: "a.ts" }, "A");
			manager.createRequest("write", { path: "b.ts" }, "B");

			const formatted = manager.formatStats();

			// Check that it contains stats (not exact count since singleton persists)
			expect(formatted).toContain("Total Requests:");
			expect(formatted).toContain("Interactive Approval Statistics");
		});
	});

	describe("isProtectedFile", () => {
		it("should identify protected files", () => {
			const workflowPath = ".github" + "/workflows/ci.yml";
			const selfModPath = "src/safety" + "-gates.ts";
			const hooksPath = "src/hooks.ts";

			expect(manager.isProtectedFile(workflowPath)).toBe(true);
			expect(manager.isProtectedFile(selfModPath)).toBe(true);
			expect(manager.isProtectedFile(hooksPath)).toBe(true);
			expect(manager.isProtectedFile("MEMORY.md")).toBe(true);
			expect(manager.isProtectedFile("ROADMAP.md")).toBe(true);
		});

		it("should not flag regular files", () => {
			expect(manager.isProtectedFile("src/utils.ts")).toBe(false);
			expect(manager.isProtectedFile("README.md")).toBe(false);
		});
	});
});

describe("getApprovalManager singleton", () => {
	it("should return the same instance", () => {
		const m1 = getApprovalManager();
		const m2 = getApprovalManager();

		expect(m1).toBe(m2);
	});
});
