/**
 * Tests for Feature Dev 7-Phase Workflow
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureDevManager, getFeatureDevManager } from "./feature-dev.js";
import type {
	AgentTask,
	ArchitectureApproach,
	ClarifyingQuestion,
	FeaturePhase,
	ReviewFinding,
} from "./feature-dev.js";

// Mock fs module
vi.mock("fs", () => ({
	existsSync: vi.fn(() => false),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
	readFileSync: vi.fn(() => "{}"),
}));

describe("FeatureDevManager", () => {
	let manager: FeatureDevManager;

	beforeEach(() => {
		manager = new FeatureDevManager("/tmp/test-feature-dev.json");
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Session Management", () => {
		it("should start a new session", () => {
			const session = manager.startSession("Add OAuth authentication");

			expect(session).toBeDefined();
			expect(session.id).toMatch(/^fd-/);
			expect(session.featureRequest).toBe("Add OAuth authentication");
			expect(session.currentPhase).toBe("discovery");
			expect(session.completedPhases).toEqual([]);
		});

		it("should get current session", () => {
			const session = manager.startSession("Test feature");
			const current = manager.getCurrentSession();

			expect(current).toBeDefined();
			expect(current?.id).toBe(session.id);
		});

		it("should get session by ID", () => {
			const session = manager.startSession("Test feature");
			const found = manager.getSession(session.id);

			expect(found).toBeDefined();
			expect(found?.id).toBe(session.id);
		});

		it("should list sessions", () => {
			manager.startSession("Feature 1");
			manager.startSession("Feature 2");

			const sessions = manager.listSessions();

			expect(sessions.length).toBeGreaterThanOrEqual(2);
		});

		it("should cancel session", () => {
			manager.startSession("Test feature");
			const success = manager.cancelSession("User cancelled");

			expect(success).toBe(true);
			expect(manager.getCurrentSession()).toBeNull();
		});
	});

	describe("Phase Navigation", () => {
		it("should get phase order", () => {
			const order = manager.getPhaseOrder();

			expect(order).toEqual([
				"discovery",
				"exploration",
				"questions",
				"architecture",
				"implementation",
				"review",
				"summary",
			]);
		});

		it("should get next phase", () => {
			expect(manager.getNextPhase("discovery")).toBe("exploration");
			expect(manager.getNextPhase("exploration")).toBe("questions");
			expect(manager.getNextPhase("summary")).toBeNull();
		});

		it("should get phase info", () => {
			const info = manager.getPhaseInfo("discovery");

			expect(info).toBeDefined();
			expect(info?.name).toBe("Phase 1: Discovery");
			expect(info?.description).toBe("Understand what needs to be built");
			expect(info?.actions.length).toBeGreaterThan(0);
			expect(info?.outputs.length).toBeGreaterThan(0);
		});

		it("should progress to next phase", () => {
			manager.startSession("Test feature");
			const session = manager.progressToNextPhase();

			expect(session).toBeDefined();
			expect(session?.currentPhase).toBe("exploration");
			expect(session?.completedPhases).toContain("discovery");
		});

		it("should skip phase", () => {
			manager.startSession("Test feature");
			const success = manager.skipPhase("discovery");

			expect(success).toBe(true);
			expect(manager.getCurrentSession()?.currentPhase).toBe("exploration");
		});
	});

	describe("Phase 1: Discovery", () => {
		it("should generate discovery guidance", () => {
			const guidance = manager.generateDiscoveryGuidance("Add caching");

			expect(guidance).toContain("Phase 1: Discovery");
			expect(guidance).toContain("Add caching");
			expect(guidance).toContain("Understanding");
			expect(guidance).toContain("Problem Statement");
			expect(guidance).toContain("Constraints");
		});

		it("should update discovery", () => {
			manager.startSession("Test feature");
			const session = manager.updateDiscovery("Understanding text", "Problem statement text", [
				"constraint1",
				"constraint2",
			]);

			expect(session?.understanding).toBe("Understanding text");
			expect(session?.problemStatement).toBe("Problem statement text");
			expect(session?.constraints).toEqual(["constraint1", "constraint2"]);
		});
	});

	describe("Phase 2: Exploration", () => {
		it("should generate exploration agents", () => {
			manager.startSession("Test feature");
			manager.updateDiscovery("Test understanding", "Test problem", []);
			const agents = manager.generateExplorationAgents("Test feature", "Test understanding");

			expect(agents.length).toBeGreaterThan(0);
			expect(agents.length).toBeLessThanOrEqual(3);
			expect(agents[0].type).toBe("code-explorer");
			expect(agents[0].status).toBe("pending");
		});
	});

	describe("Phase 3: Questions", () => {
		it("should generate clarifying questions", () => {
			manager.startSession("Test feature");
			const questions = manager.generateClarifyingQuestions();

			expect(questions.length).toBeGreaterThan(0);
			expect(questions.length).toBeLessThanOrEqual(10);
			expect(questions[0].answered).toBe(false);
		});

		it("should answer question", () => {
			manager.startSession("Test feature");
			const questions = manager.generateClarifyingQuestions();
			const questionId = questions[0].id;

			const answered = manager.answerQuestion(questionId, "Test answer");

			expect(answered?.answered).toBe(true);
			expect(answered?.answer).toBe("Test answer");
		});

		it("should track questions resolved", () => {
			manager.startSession("Test feature");
			const questions = manager.generateClarifyingQuestions();

			// Answer all questions
			for (const q of questions) {
				manager.answerQuestion(q.id, "Answer");
			}

			const session = manager.getCurrentSession();
			expect(session?.questionsResolved).toBe(true);
		});
	});

	describe("Phase 4: Architecture", () => {
		it("should generate architecture approaches", () => {
			manager.startSession("Test feature");
			const approaches = manager.generateArchitectureApproaches();

			expect(approaches.length).toBe(3);
			expect(approaches[0].name).toContain("Minimal");
			expect(approaches[1].name).toContain("Clean");
			expect(approaches[2].name).toContain("Pragmatic");
		});

		it("should select approach", () => {
			manager.startSession("Test feature");
			manager.generateArchitectureApproaches();

			const approach = manager.selectApproach("approach-minimal");

			expect(approach?.id).toBe("approach-minimal");
			expect(manager.getCurrentSession()?.selectedApproach).toBe("approach-minimal");
		});

		it("should approve architecture", () => {
			manager.startSession("Test feature");
			manager.generateArchitectureApproaches();
			manager.selectApproach("approach-minimal");

			const success = manager.approveArchitecture();

			expect(success).toBe(true);
			expect(manager.getCurrentSession()?.architectureApproved).toBe(true);
		});
	});

	describe("Phase 5: Implementation", () => {
		it("should generate implementation guidance", () => {
			manager.startSession("Test feature");
			manager.updateDiscovery("Understanding", "Problem", []);

			const guidance = manager.generateImplementationGuidance();

			expect(guidance).toContain("Phase 5: Implementation");
		});

		it("should start implementation after approval", () => {
			manager.startSession("Test feature");
			manager.generateArchitectureApproaches();
			manager.selectApproach("approach-minimal");
			manager.approveArchitecture();

			const success = manager.startImplementation();

			expect(success).toBe(true);
			expect(manager.getCurrentSession()?.implementationStarted).toBe(true);
		});

		it("should not start implementation without approval", () => {
			manager.startSession("Test feature");

			const success = manager.startImplementation();

			expect(success).toBe(false);
		});

		it("should update implementation progress", () => {
			manager.startSession("Test feature");

			const session = manager.updateImplementation(["file1.ts", "file2.ts"], ["todo1", "todo2"]);

			expect(session?.filesModified).toEqual(["file1.ts", "file2.ts"]);
			expect(session?.todosCompleted).toEqual(["todo1", "todo2"]);
		});

		it("should complete implementation", () => {
			manager.startSession("Test feature");

			const success = manager.completeImplementation();

			expect(success).toBe(true);
			expect(manager.getCurrentSession()?.implementationComplete).toBe(true);
		});
	});

	describe("Phase 6: Review", () => {
		it("should generate review agents", () => {
			manager.startSession("Test feature");
			const agents = manager.generateReviewAgents();

			expect(agents.length).toBe(3);
			expect(agents.every((a) => a.type === "code-reviewer")).toBe(true);
		});

		it("should add review finding", () => {
			manager.startSession("Test feature");

			const finding: ReviewFinding = {
				id: "finding-1",
				severity: "high",
				category: "bug",
				description: "Test bug",
				confidence: 90,
			};

			manager.addReviewFinding(finding);

			const session = manager.getCurrentSession();
			expect(session?.reviewFindings.length).toBe(1);
		});

		it("should filter findings by confidence", () => {
			manager.startSession("Test feature");

			const lowConfidenceFinding: ReviewFinding = {
				id: "finding-low",
				severity: "low",
				category: "quality",
				description: "Low confidence finding",
				confidence: 50,
			};

			manager.addReviewFinding(lowConfidenceFinding);

			const session = manager.getCurrentSession();
			// Default min confidence is 80, so this should be filtered out
			expect(session?.reviewFindings.length).toBe(0);
		});

		it("should address finding", () => {
			manager.startSession("Test feature");

			const finding: ReviewFinding = {
				id: "finding-1",
				severity: "high",
				category: "bug",
				description: "Test bug",
				confidence: 90,
			};

			manager.addReviewFinding(finding);
			const success = manager.addressFinding("finding-1");

			expect(success).toBe(true);
			expect(manager.getCurrentSession()?.issuesAddressed).toContain("finding-1");
		});

		it("should complete review", () => {
			manager.startSession("Test feature");

			const success = manager.completeReview();

			expect(success).toBe(true);
			expect(manager.getCurrentSession()?.reviewComplete).toBe(true);
		});
	});

	describe("Phase 7: Summary", () => {
		it("should generate summary", () => {
			manager.startSession("Test feature");
			manager.updateDiscovery("Understanding", "Problem", []);
			manager.completeImplementation();

			const summary = manager.generateSummary();

			expect(summary).toContain("Phase 7: Summary");
			expect(summary).toContain("Feature Complete");
		});

		it("should add key decision", () => {
			manager.startSession("Test feature");

			manager.addKeyDecision("Used pragmatic approach");

			const session = manager.getCurrentSession();
			expect(session?.keyDecisions).toContain("Used pragmatic approach");
		});

		it("should add next step", () => {
			manager.startSession("Test feature");

			manager.addNextStep("Add tests");

			const session = manager.getCurrentSession();
			expect(session?.suggestedNextSteps).toContain("Add tests");
		});
	});

	describe("Configuration", () => {
		it("should get config", () => {
			const config = manager.getConfig();

			expect(config).toBeDefined();
			expect(config.enabled).toBe(true);
		});

		it("should update config", () => {
			manager.updateConfig({ verbosity: "detailed" });

			const config = manager.getConfig();
			expect(config.verbosity).toBe("detailed");
		});

		it("should enable/disable", () => {
			manager.disable();
			expect(manager.getConfig().enabled).toBe(false);

			manager.enable();
			expect(manager.getConfig().enabled).toBe(true);
		});
	});

	describe("Statistics", () => {
		it("should get stats", () => {
			const stats = manager.getStats();

			expect(stats).toBeDefined();
			expect(stats.sessionsStarted).toBeGreaterThanOrEqual(0);
		});

		it("should update stats on session start", () => {
			const initialStats = manager.getStats();
			manager.startSession("Test feature");
			const stats = manager.getStats();

			expect(stats.sessionsStarted).toBe(initialStats.sessionsStarted + 1);
		});

		it("should reset stats", () => {
			manager.startSession("Test feature");
			manager.resetStats();

			const stats = manager.getStats();
			expect(stats.sessionsStarted).toBe(0);
		});
	});
});

describe("getFeatureDevManager", () => {
	it("should return singleton instance", () => {
		const manager1 = getFeatureDevManager();
		const manager2 = getFeatureDevManager();

		expect(manager1).toBe(manager2);
	});
});
