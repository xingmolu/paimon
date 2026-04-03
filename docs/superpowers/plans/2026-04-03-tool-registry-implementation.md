# Tool Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 39 boilerplate tool wrapper files with a declarative `createTool()` factory, merging manager + tool into single files.

**Architecture:** Create `src/tools/registry.ts` with a `createTool()` factory that generates `AgentTool` objects from declarative configs. Migrate tools in 3 batches, verifying build after each.

**Tech Stack:** TypeScript, TypeBox, @mariozechner/pi-agent-core

---

### Task 1: Create ToolRegistry Factory

**Files:**
- Create: `src/tools/registry.ts`

- [ ] **Step 1: Create registry.ts**

```typescript
/**
 * Tool Registry — Declarative tool factory.
 *
 * Generates AgentTool objects from declarative configs,
 * eliminating boilerplate across all tool modules.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, TSchema } from "@sinclair/typebox";

export interface ToolAction {
	description: string;
	parameters?: TSchema;
	handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolConfig {
	name: string;
	label: string;
	description: string;
	actions: Record<string, ToolAction>;
}

export function createTool(config: ToolConfig): AgentTool {
	const actionNames = Object.keys(config.actions);

	// Collect all parameter keys from all action schemas
	const allParams = new Set<string>();
	for (const action of Object.values(config.actions)) {
		if (action.parameters) {
			const props = (action.parameters as any).properties || {};
			Object.keys(props).forEach((k: string) => allParams.add(k));
		}
	}

	// Build merged parameter schema
	const paramProperties: Record<string, TSchema> = {};
	for (const key of allParams) {
		paramProperties[key] = Type.Optional(Type.Unknown());
	}

	const parameters = Type.Object({
		action: Type.String({
			enum: actionNames,
			description: `Action to perform: ${actionNames.join(", ")}`,
		}),
		...paramProperties,
	});

	// Build description with action list
	const actionList = Object.entries(config.actions)
		.map(([name, def]) => `- ${name}: ${def.description}`)
		.join("\n");
	const fullDescription = `${config.description}\n\nActions:\n${actionList}`;

	// Build execute function
	const execute = async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<unknown>> => {
		const { action, ...rest } = params as { action: string };
		const actionDef = config.actions[action];

		if (!actionDef) {
			return {
				content: [{ type: "text", text: `Unknown action: ${action}` }],
				details: `Unknown action: ${action}`,
			};
		}

		try {
			const result = await actionDef.handler(rest);
			// If result is already AgentToolResult format, return as-is
			if (result && typeof result === "object" && "content" in result) {
				return result as AgentToolResult<unknown>;
			}
			// Otherwise wrap in standard format
			const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
			return {
				content: [{ type: "text", text }],
				details: result,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: `Error: ${message}` }],
				details: `Error: ${message}`,
			};
		}
	};

	return {
		name: config.name,
		label: config.label,
		description: fullDescription,
		parameters,
		execute,
	};
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tools/registry.ts
git commit -m "feat: add ToolRegistry declarative tool factory"
```

---

### Task 2: Migrate context-budget Tool (Batch 1 — Reference Implementation)

This is the reference migration. All Batch 1 tools follow this exact pattern.

**Files:**
- Modify: `src/context-budget.ts` (append tool definition)
- Delete: `src/tools/context-budget-tool.ts`
- Modify: `src/tools/index.ts` (update imports)

- [ ] **Step 1: Append tool definition to src/context-budget.ts**

Add this at the END of `src/context-budget.ts`:

```typescript
// --- Tool Definition ---

import { createTool } from "./tools/registry.js";

export function createContextBudgetTool(): AgentTool {
	const manager = getGlobalContextBudgetManager();

	return createTool({
		name: "contextBudget",
		label: "Context Budget Monitoring",
		description: "Monitor and manage context window usage proactively. Prevents context overflow by tracking token usage and providing warnings before hitting limits.",
		actions: {
			check: {
				description: "Get current context usage status (tokens, percentage, health)",
				handler: () => manager.checkBudget("tool_call"),
			},
			stats: {
				description: "Get comprehensive statistics including history and trends",
				handler: () => manager.getStats(),
			},
			suggestions: {
				description: "Get optimization suggestions for reducing context usage",
				handler: () => manager.getOptimizationSuggestions(),
			},
			config: {
				description: "View or update configuration",
				parameters: Type.Object({
					maxContextWindow: Type.Optional(Type.Number()),
					warningThresholdPercent: Type.Optional(Type.Number()),
					criticalThresholdPercent: Type.Optional(Type.Number()),
					responseBufferTokens: Type.Optional(Type.Number()),
					enabled: Type.Optional(Type.Boolean()),
				}),
				handler: (p) => {
					if (p.maxContextWindow || p.warningThresholdPercent || p.criticalThresholdPercent || p.responseBufferTokens || p.enabled !== undefined) {
						const newConfig: Partial<ContextBudgetConfig> = {};
						if (p.maxContextWindow !== undefined) newConfig.maxContextWindow = p.maxContextWindow as number;
						if (p.warningThresholdPercent !== undefined) newConfig.warningThresholdPercent = p.warningThresholdPercent as number;
						if (p.criticalThresholdPercent !== undefined) newConfig.criticalThresholdPercent = p.criticalThresholdPercent as number;
						if (p.responseBufferTokens !== undefined) newConfig.responseBufferTokens = p.responseBufferTokens as number;
						if (p.enabled !== undefined) newConfig.enabled = p.enabled as boolean;
						manager.updateConfig(newConfig);
						return `Configuration updated: ${JSON.stringify(newConfig)}`;
					}
					return manager.getConfig();
				},
			},
			update: {
				description: "Update current token estimate manually",
				parameters: Type.Object({
					tokens: Type.Number({ description: "Token count" }),
				}),
				handler: (p) => {
					if (p.tokens === undefined) return "Error: tokens parameter required";
					manager.updateTokenEstimate(p.tokens as number);
					return `Token estimate updated to ${p.tokens}`;
				},
			},
			add: {
				description: "Add tokens to current estimate",
				parameters: Type.Object({
					tokens: Type.Number({ description: "Token count to add" }),
				}),
				handler: (p) => {
					if (p.tokens === undefined) return "Error: tokens parameter required";
					manager.addTokens(p.tokens as number);
					return `Added ${p.tokens} tokens, current estimate: ${manager.getTokenEstimate()}`;
				},
			},
			reset: {
				description: "Reset statistics (keep configuration)",
				handler: () => {
					manager.reset();
					return "Context budget statistics reset";
				},
			},
			history: {
				description: "View recent context usage history",
				parameters: Type.Object({
					limit: Type.Optional(Type.Number({ description: "Limit for history entries" })),
				}),
				handler: (p) => {
					const limit = (p.limit as number) || 20;
					const stats = manager.getStats();
					return stats.history.slice(-limit);
				},
			},
		},
	});
}

// Backward-compatible export
export const contextBudgetTool = createContextBudgetTool();
```

Also add these imports at the top of `src/context-budget.ts`:

```typescript
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
```

- [ ] **Step 2: Update src/tools/index.ts**

Change:
```typescript
import { contextBudgetTool } from "./context-budget-tool.js";
```
To:
```typescript
import { contextBudgetTool } from "../context-budget.js";
```

Change:
```typescript
export { contextBudgetTool, createContextBudgetTool } from "./context-budget-tool.js";
```
To:
```typescript
export { contextBudgetTool, createContextBudgetTool } from "../context-budget.js";
```

- [ ] **Step 3: Delete old tool file**

```bash
rm src/tools/context-budget-tool.ts
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate context-budget tool to registry"
```

---

### Task 3: Migrate Batch 1 Remaining Tools (13 tools)

**Files:**
- Modify: `src/pattern-miner.ts`, `src/plugins.ts`, `src/metrics.ts`, `src/task-predictor.ts`, `src/intelligence.ts`, `src/safety-gates.ts`, `src/token-tracking.ts`, `src/interactive-approval.ts`, `src/ralph-loop.ts`, `src/hookify.ts`, `src/auto-invoke.ts`, `src/explanatory-output-style.ts`, `src/security-guidance.ts`
- Delete: 13 `*-tool.ts` files in `src/tools/`
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Migrate each tool following the context-budget pattern**

For EACH of these 13 tools, do the following:

1. Read the existing `src/tools/XXX-tool.ts` file
2. Read the manager file `src/XXX.ts`
3. Append tool definition to `src/XXX.ts` using this template:

```typescript
// --- Tool Definition ---

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { createTool } from "./tools/registry.js";

export function createXXXTool(): AgentTool {
	const manager = getXXX(); // or new XXXManager(), matching existing pattern

	return createTool({
		name: "toolName",
		label: "Tool Label",
		description: "Tool description",
		actions: {
			actionName: {
				description: "Action description",
			 // parameters: Type.Object({...}) if action has specific params,
				handler: (p) => manager.actionName(...),
			},
		 // ... repeat for all actions
		},
	});
}

// Backward-compatible export
export const xxxTool = createXXXTool();
```

4. Update `src/tools/index.ts`:
   - Change import from `"./xxx-tool.js"` to `"../xxx.js"`
   - Change re-export from `"./xxx-tool.js"` to `"../xxx.js"`

5. Delete `src/tools/xxx-tool.ts`

**Specific tools to migrate (in this order):**

| # | Manager File | Tool File | Actions Count |
|---|-------------|-----------|---------------|
| 1 | `src/pattern-miner.ts` | `src/tools/pattern-miner-tool.ts` | 5 |
| 2 | `src/plugins.ts` | `src/tools/plugins-tool.ts` | 7 |
| 3 | `src/metrics.ts` | `src/tools/metrics-tool.ts` | 9 |
| 4 | `src/task-predictor.ts` | `src/tools/task-predictor-tool.ts` | 4 |
| 5 | `src/intelligence.ts` | `src/tools/intelligence-tool.ts` | 5 |
| 6 | `src/safety-gates.ts` | `src/tools/safety-gates-tool.ts` | 11 |
| 7 | `src/token-tracking.ts` | `src/tools/token-tracking-tool.ts` | 10 |
| 8 | `src/interactive-approval.ts` | `src/tools/interactive-approval-tool.ts` | 11 |
| 9 | `src/ralph-loop.ts` | `src/tools/ralph-loop-tool.ts` | 10 |
| 10 | `src/hookify.ts` | `src/tools/hookify-tool.ts` | 10 |
| 11 | `src/auto-invoke.ts` | `src/tools/auto-invoke-tool.ts` | 12 |
| 12 | `src/explanatory-output-style.ts` | `src/tools/explanatory-output-style-tool.ts` | 11 |
| 13 | `src/security-guidance.ts` | `src/tools/security-guidance-tool.ts` | 12 |

**IMPORTANT:** When copying action handlers from the old tool file:
- Remove the `switch (action)` wrapper — each action becomes a separate entry
- Remove the `try/catch` — the registry handles it
- Remove the result formatting — the registry wraps it
- Keep the manager method calls exactly as they are
- For actions that need specific parameters, add `parameters: Type.Object({...})` to the action definition

- [ ] **Step 2: Update all imports in src/tools/index.ts**

Replace all imports from `./xxx-tool.js` to `../xxx.js` for the 13 migrated tools.

- [ ] **Step 3: Delete all old tool files**

```bash
rm src/tools/pattern-miner-tool.ts \
   src/tools/plugins-tool.ts \
   src/tools/metrics-tool.ts \
   src/tools/task-predictor-tool.ts \
   src/tools/intelligence-tool.ts \
   src/tools/safety-gates-tool.ts \
   src/tools/token-tracking-tool.ts \
   src/tools/interactive-approval-tool.ts \
   src/tools/ralph-loop-tool.ts \
   src/tools/hookify-tool.ts \
   src/tools/auto-invoke-tool.ts \
   src/tools/explanatory-output-style-tool.ts \
   src/tools/security-guidance-tool.ts
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Run tests**

Run: `npm test -- --run`
Expected: PASS (or same failures as before migration)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: migrate batch 1 tools to registry (13 tools)"
```

---

### Task 4: Migrate Batch 2 — Near Template Matches (7 tools)

**Files:**
- Modify: `src/checkpoint.ts`, `src/hooks.ts`, `src/stuck.ts`, `src/tom.ts`, `src/error-patterns.ts`, `src/bug-report.ts`
- Create: `src/plan.ts` (new file for plan manager + tool)
- Delete: 7 `*-tool.ts` files in `src/tools/`
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Migrate each tool**

These tools use `new Manager()` at module scope instead of `getXXX()`. The migration pattern is the same, but the manager instance is created inline:

```typescript
const manager = new XXXManager(); // or existing module-level state

export function createXXXTool(): AgentTool {
	return createTool({
		name: "...",
		label: "...",
		description: "...",
		actions: { ... },
	});
}

export const xxxTool = createXXXTool();
```

**Specific tools:**

| # | Manager File | Tool File | Notes |
|---|-------------|-----------|-------|
| 1 | `src/checkpoint.ts` | `src/tools/checkpoint-tool.ts` | `new CheckpointManager()` |
| 2 | `src/hooks.ts` | `src/tools/hook-tool.ts` | Uses `globalHookManager` |
| 3 | `src/stuck.ts` | `src/tools/stuck-tool.ts` | `new StuckDetector()` |
| 4 | `src/tom.ts` | `src/tools/tom-tool.ts` | `new TomModule()` |
| 5 | `src/error-patterns.ts` | `src/tools/error-patterns-tool.ts` | `new ErrorPatternLearner()` |
| 6 | `src/bug-report.ts` | `src/tools/bug-report-tool.ts` | `new BugReportGenerator()` |
| 7 | Plan state | `src/tools/plan-tool.ts` | Create `src/plan.ts` with module-level `currentPlan` state |

For the plan tool, create `src/plan.ts`:

```typescript
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { createTool } from "./tools/registry.js";
import type { PlanState } from "./types.js";

let currentPlan: PlanState | null = null;

export function getCurrentPlan(): PlanState | null {
	return currentPlan;
}

export function setCurrentPlan(plan: PlanState | null): void {
	currentPlan = plan;
}

export function createPlanTool(): AgentTool {
	return createTool({
		name: "plan",
		label: "Task Planning",
		description: "Create and manage multi-step task plans",
		actions: {
			create: {
				description: "Create a new plan",
				parameters: Type.Object({
					title: Type.String(),
					steps: Type.Array(Type.Object({
						number: Type.Number(),
						description: Type.String(),
						status: Type.Optional(Type.String()),
					})),
				}),
				handler: (p) => {
					currentPlan = {
						title: p.title as string,
						steps: p.steps as any[],
						currentStep: 0,
						createdAt: new Date().toISOString(),
					};
					return `Plan created: ${currentPlan.title}`;
				},
			},
			update: {
				description: "Update an existing plan",
				parameters: Type.Object({
					steps: Type.Array(Type.Object({
						number: Type.Number(),
						description: Type.String(),
						status: Type.String(),
					})),
				}),
				handler: (p) => {
					if (!currentPlan) return "Error: No active plan";
					currentPlan.steps = p.steps as any[];
					return "Plan updated";
				},
			},
			progress: {
				description: "Mark current step as complete and move to next",
				handler: () => {
					if (!currentPlan) return "Error: No active plan";
					currentPlan.currentStep = Math.min(
						currentPlan.currentStep + 1,
						currentPlan.steps.length - 1,
					);
					return `Moved to step ${currentPlan.currentStep + 1}: ${currentPlan.steps[currentPlan.currentStep]?.description}`;
				},
			},
			show: {
				description: "Show the current plan",
				handler: () => {
					if (!currentPlan) return "No active plan";
					const lines = [`## ${currentPlan.title}`, ""];
					for (const step of currentPlan.steps) {
						const marker = step.number === currentPlan.currentStep + 1 ? "→" : " ";
						const status = step.status || "pending";
						lines.push(`${marker} ${step.number}. [${status}] ${step.description}`);
					}
					return lines.join("\n");
				},
			},
			clear: {
				description: "Clear the current plan",
				handler: () => {
					currentPlan = null;
					return "Plan cleared";
				},
			},
		},
	});
}

export const planTool = createPlanTool();
```

- [ ] **Step 2: Update src/tools/index.ts**

Replace all imports from `./xxx-tool.js` to `../xxx.js` for the 7 migrated tools.
For plan tool, import from `../plan.js` instead of `./plan-tool.js`.

- [ ] **Step 3: Delete old tool files**

```bash
rm src/tools/checkpoint-tool.ts \
   src/tools/hook-tool.ts \
   src/tools/stuck-tool.ts \
   src/tools/tom-tool.ts \
   src/tools/error-patterns-tool.ts \
   src/tools/bug-report-tool.ts \
   src/tools/plan-tool.ts
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate batch 2 tools to registry (7 tools)"
```

---

### Task 5: Migrate Batch 3 — Special Patterns (9 tools)

**Files:**
- Modify: `src/singularity.ts`, `src/model-roulette.ts`, `src/multi-agent.ts`, `src/sdk.ts`, `src/benchmark.ts`, `src/tool-cache.ts`, `src/journal-manager.ts`, `src/commit-msg.ts`
- Modify: `src/rag.ts` (add lazy-init support)
- Modify: `src/trajectory.ts` (add factory support)
- Delete: 9 `*-tool.ts` files in `src/tools/`
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Migrate each tool**

These have unique patterns. Handle each individually:

| # | Manager File | Tool File | Special Handling |
|---|-------------|-----------|-----------------|
| 1 | `src/rag.ts` | `src/tools/rag-tool.ts` | Lazy init — use `getRagModule()` pattern inside handler |
| 2 | `src/singularity.ts` | `src/tools/singularity-tool.ts` | Module-level const — `new SingularityTracker()` at top |
| 3 | `src/trajectory.ts` | `src/tools/trajectory-tool.ts` | Factory — `createTrajectoryViewer()` inside tool |
| 4 | `src/model-roulette.ts` | `src/tools/roulette-tool.ts` | Has `executeRouletteAction()` helper — inline handlers |
| 5 | `src/multi-agent.ts` | `src/tools/multi-agent-tool.ts` | `getMultiAgentOrchestrator()` |
| 6 | `src/sdk.ts` | `src/tools/sdk-tool.ts` | `getSDK()` |
| 7 | `src/benchmark.ts` | `src/tools/benchmark-tool.ts` | `getBenchmarkRunner()` |
| 8 | `src/tool-cache.ts` | `src/tools/tool-cache-tool.ts` | `getToolCache()` |
| 9 | `src/journal-manager.ts` | `src/tools/journal-tool.ts` | `journalManager` object |
| 10 | `src/commit-msg.ts` | `src/tools/commit-msg-tool.ts` | Thin wrapper — inline the logic |

For each, follow the same pattern:
1. Read the existing tool file
2. Append tool definition to the manager file
3. Update `src/tools/index.ts`
4. Delete the tool file

- [ ] **Step 2: Update src/tools/index.ts**

Replace all remaining imports from `./xxx-tool.js` to `../xxx.js`.

- [ ] **Step 3: Delete old tool files**

```bash
rm src/tools/rag-tool.ts \
   src/tools/singularity-tool.ts \
   src/tools/trajectory-tool.ts \
   src/tools/roulette-tool.ts \
   src/tools/multi-agent-tool.ts \
   src/tools/sdk-tool.ts \
   src/tools/benchmark-tool.ts \
   src/tools/tool-cache-tool.ts \
   src/tools/journal-tool.ts \
   src/tools/commit-msg-tool.ts
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate batch 3 tools to registry (10 tools)"
```

---

### Task 6: Clean Up src/tools/index.ts and Final Verification

**Files:**
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Clean up index.ts**

After all migrations, `src/tools/index.ts` should look like:

```typescript
/**
 * Tool registry for Paimon agent
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";

// Core tools (not migrated — different architecture)
export { fileTools, searchTools, httpTool } from "./file-tools.js";
export { assessTool } from "./assess-tool.js";
export { reflectTool } from "./reflect-tool.js";
export { parallelTool } from "./parallel-tool.js";
export { repomapTool } from "./repomap-tool.js";

// Migrated tools — imported from manager files
import { contextBudgetTool } from "../context-budget.js";
import { patternMinerTool } from "../pattern-miner.js";
import { pluginsTool } from "../plugins.js";
import { metricsTool } from "../metrics.js";
import { taskPredictorTool } from "../task-predictor.js";
import { intelligenceTool } from "../intelligence.js";
import { safetyGatesTool } from "../safety-gates.js";
import { tokenTrackingTool } from "../token-tracking.js";
import { interactiveApprovalTool } from "../interactive-approval.js";
import { ralphLoopTool } from "../ralph-loop.js";
import { hookifyTool } from "../hookify.js";
import { autoInvokeTool } from "../auto-invoke.js";
import { explanatoryOutputStyleTool } from "../explanatory-output-style.js";
import { securityGuidanceTool } from "../security-guidance.js";
import { checkpointTool } from "../checkpoint.js";
import { hookTool } from "../hooks.js";
import { stuckTool } from "../stuck.js";
import { tomTool } from "../tom.js";
import { errorPatternsTool } from "../error-patterns.js";
import { bugReportTool } from "../bug-report.js";
import { planTool, getCurrentPlan, setCurrentPlan } from "../plan.js";
import { ragTool } from "../rag.js";
import { singularityTool } from "../singularity.js";
import { trajectoryTool } from "../trajectory.js";
import { rouletteTool, initRoulette } from "../model-roulette.js";
import { multiAgentTool } from "../multi-agent.js";
import { sdkTool } from "../sdk.js";
import { benchmarkTool } from "../benchmark.js";
import { toolCacheTool } from "../tool-cache.js";
import { journalTool } from "../journal-manager.js";
import { commitMsgTool } from "../commit-msg.js";

export const metaTools: AgentTool[] = [
	planTool,
	assessTool,
	reflectTool,
	checkpointTool,
	parallelTool,
	hookTool,
	stuckTool,
	repomapTool,
	tomTool,
	singularityTool,
	ragTool,
	trajectoryTool,
	errorPatternsTool,
	patternMinerTool,
	bugReportTool,
	commitMsgTool,
	rouletteTool,
	pluginsTool,
	metricsTool,
	taskPredictorTool,
	intelligenceTool,
	sdkTool,
	benchmarkTool,
	safetyGatesTool,
	multiAgentTool,
	tokenTrackingTool,
	toolCacheTool,
	journalTool,
	contextBudgetTool,
	interactiveApprovalTool,
	ralphLoopTool,
	hookifyTool,
	autoInvokeTool,
	explanatoryOutputStyleTool,
	securityGuidanceTool,
];

export function buildTools(): AgentTool[] {
	return [...fileTools, ...searchTools, httpTool, ...metaTools];
}

export function buildToolsDescription(tools: AgentTool[]): string {
	const lines: string[] = [];
	for (const tool of tools) {
		lines.push(`- ${tool.name}: ${tool.description}`);
	}
	return lines.join("\n");
}

// Re-exports
export { fileTools, searchTools, httpTool };
export { bashTool, readTool, writeTool, editTool } from "./file-tools.js";
export { globTool, grepTool, findTool, lsTool } from "./search-tools.js";
export { planTool, getCurrentPlan, setCurrentPlan } from "../plan.js";
export { rouletteTool, initRoulette } from "../model-roulette.js";
export { pluginsTool, getPluginTools } from "../plugins.js";
export { sdkTool, createSDKTool } from "../sdk.js";
export { safetyGatesTool, getSafetyGatesForHook } from "../safety-gates.js";
export { tokenTrackingTool, getTokenTracker, resetTokenTracker } from "../token-tracking.js";
export { toolCacheTool, getToolCache, resetToolCache, ToolCache, generateCacheKey } from "../tool-cache.js";
export {
	journalManager,
	parseJournal,
	getJournalStats,
	truncateJournal,
	listArchives,
	readArchivedEntry,
} from "../journal-manager.js";
export type { JournalEntry, JournalStats, TruncateResult } from "../journal-manager.js";
export {
	getBenchmarkRunner,
	createSampleTasks,
	BenchmarkRunner,
} from "../benchmark.js";
export {
	ContextBudgetManager,
	getGlobalContextBudgetManager,
	initGlobalContextBudgetManager,
	DEFAULT_CONTEXT_BUDGET_CONFIG,
	contextBudgetTool,
	createContextBudgetTool,
} from "../context-budget.js";
export type {
	ContextBudgetConfig,
	ContextUsageStats,
	ContextBudgetStats,
	OptimizationSuggestion,
} from "../context-budget.js";
export {
	getSDK,
	initSDK,
	EvolutionSDK,
	formatSDKStats,
	formatSession,
	formatEvolutionResult,
	formatBatchResult,
} from "../sdk.js";
export {
	getApprovalManager,
	InteractiveApprovalManager,
} from "../interactive-approval.js";
export type {
	ApprovalCategory,
	ApprovalRequest,
	ApprovalStatus,
	InteractiveApprovalConfig,
	InteractiveApprovalStats,
} from "../interactive-approval.js";
export {
	getRalphLoopManager,
	RalphLoopManager,
	resetRalphLoopManager,
} from "../ralph-loop.js";
export type {
	RalphLoopState,
	RalphLoopConfig,
	RalphLoopStats,
} from "../ralph-loop.js";
export {
	getHookifyManager,
	HookifyManager,
} from "../hookify.js";
export type {
	HookifyRuleConfig,
	HookifyRule,
	HookifyStats,
	ConversationMessage,
	ConversationAnalysis,
} from "../hookify.js";
export {
	getAutoInvokeManager,
	AutoInvokeManager,
} from "../auto-invoke.js";
export type {
	AutoInvokeRule,
	AutoInvokeTrigger,
	AutoInvokeConfig,
	AutoInvokeStats,
	AutoInvokeSuggestion,
	TriggerType,
	ContextType,
} from "../auto-invoke.js";
export {
	getExplanatoryOutputStyleManager,
	ExplanatoryOutputStyleManager,
} from "../explanatory-output-style.js";
export type {
	InsightCategory,
	EducationalInsight,
	ExplanatoryOutputStyleConfig,
	ExplanatoryOutputStyleStats,
} from "../explanatory-output-style.js";
export {
	getSecurityGuidanceManager,
	SecurityGuidanceManager,
	resetSecurityGuidanceManager,
} from "../security-guidance.js";
export type {
	SecurityCategory,
	RiskLevel,
	SecurityPattern,
	SecurityWarning,
	SecurityScanResult,
	SecurityGuidanceStats,
	SecurityGuidanceConfig,
} from "../security-guidance.js";
```

- [ ] **Step 2: Verify no *-tool.ts files remain**

Run: `ls src/tools/*-tool.ts 2>/dev/null`
Expected: Only `file-tools.ts` should remain (it's a multi-tool file, not following the pattern)

- [ ] **Step 3: Final build verification**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Run tests**

Run: `npm test -- --run`
Expected: PASS (or same failures as before)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "refactor: complete tool registry migration, remove all *-tool.ts files"
```

---

### Task 7: Update ROADMAP and MEMORY.md

**Files:**
- Modify: `ROADMAP.md`
- Modify: `MEMORY.md`

- [ ] **Step 1: Add Phase 38 to ROADMAP.md**

Add to ROADMAP.md:

```markdown
- [x] Phase 38: Tool Registry & Code Quality
  - [x] Create ToolRegistry factory (registry.ts)
  - [x] Migrate all 30+ tools to declarative pattern
  - [x] Delete all *-tool.ts wrapper files
  - [x] Update tool index (src/tools/index.ts)
  - [x] Verify build + tests pass
```

- [ ] **Step 2: Update MEMORY.md scorecard**

Add a row to the Evolution Scorecard:

```
| 2026-04-03 | capability | Tool Registry — declarative tool factory replacing 39 boilerplate tool files | ~60m | ✅ | TS | High | brainstorming, writing-plans | enables-future-evolution |
```

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md MEMORY.md
git commit -m "docs: update ROADMAP and MEMORY.md with tool registry completion"
```
