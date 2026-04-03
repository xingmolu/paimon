# Tool Registry Design — 声明式 Tool 重构

**Date:** 2026-04-03
**Author:** Paimon (via brainstorming session)
**Status:** Draft — awaiting review

---

## Problem Statement

Paimon has 39 tool modules in `src/tools/`, each following nearly identical boilerplate:
- Import `AgentTool`, `AgentToolResult`, `Type`
- Define `name`, `label`, `description`
- Define `Type.Object` with `action` field + action-specific params
- `execute` function with `try/catch`, `switch (action)`, uniform error formatting

This creates:
- **78 files** (39 manager + 39 tool wrappers) for ~30 distinct capabilities
- **~1,500 lines** of near-identical boilerplate
- **High maintenance cost** — adding a new action means editing 2 files
- **Context window waste** — 39 tool descriptions loaded into every agent prompt

## Goals

1. **Reduce boilerplate** — eliminate repetitive code patterns
2. **Merge manager + tool** — each capability lives in one file
3. **Make adding tools easier** — declare actions, not boilerplate
4. **Maintain backward compatibility** — agent behavior unchanged
5. **Enable future evolution** — new tools follow the pattern naturally

## Non-Goals

- Restructuring `file-tools.ts`, `search-tools.ts`, `http-tool.ts` (they don't follow the action-switch pattern)
- Changing the agent's event loop or tool execution model
- Modifying any manager business logic

---

## Architecture

### Core: `ToolRegistry` (`src/tools/registry.ts`)

```typescript
interface ToolAction {
  description: string;
  parameters?: TSchema;          // TypeBox schema for action-specific params
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

interface ToolConfig {
  name: string;
  label: string;
  description: string;
  actions: Record<string, ToolAction>;
}

function createTool(config: ToolConfig): AgentTool;
```

**Responsibilities:**
- Merge all action parameters into a single `Type.Object` with `action` discriminator
- Generate `execute` function with action dispatch, try/catch, error formatting
- Auto-append action list to description for agent visibility
- Return a valid `AgentTool` compatible with existing agent

### Transformed Tool File Pattern

**Before** (`src/tools/context-budget-tool.ts`, ~80 lines):
```typescript
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { getGlobalContextBudgetManager } from "../context-budget.js";

export const contextBudgetTool: AgentTool = {
  name: "contextBudget",
  label: "Context Budget",
  description: "Monitor and manage context window usage...",
  parameters: Type.Object({
    action: Type.String({ enum: ["check", "stats", "config", ...] }),
    // ... per-action params
  }),
  execute: async (_toolCallId, params) => {
    const { action, ...rest } = params as any;
    try {
      switch (action) {
        case "check": return { content: [...] };
        // ... 15 cases
      }
    } catch (e) { return { content: [...] }; }
  },
};
```

**After** (`src/tools/context-budget.ts`, ~25 lines):
```typescript
import { createTool } from "./registry.js";
import { getGlobalContextBudgetManager } from "../context-budget.js";

const manager = getGlobalContextBudgetManager();

export const createContextBudgetTool = () => createTool({
  name: "contextBudget",
  label: "Context Budget",
  description: "Monitor and manage context window usage",
  actions: {
    check: {
      description: "Check current context usage",
      handler: () => manager.check(),
    },
    stats: {
      description: "Get usage statistics",
      handler: () => manager.getStats(),
    },
    // ... other actions
  },
});
```

### File Structure Changes

**Before:**
```
src/
  context-budget.ts          (manager)
  tools/
    context-budget-tool.ts   (tool wrapper)
```

**After:**
```
src/
  context-budget.ts          (manager + tool definition)
  tools/
    registry.ts              (createTool factory)
```

No more `*-tool.ts` files in `src/tools/`. Tool definitions live alongside their managers.

---

## Migration Plan

### Batch 1: Exact Template Matches (14 tools)

These tools follow the exact `getXXX()` + action switch + try/catch pattern:

| Current Files | Merged To |
|---|---|
| `src/tools/pattern-miner-tool.ts` + `src/pattern-miner.ts` | `src/pattern-miner.ts` |
| `src/tools/plugins-tool.ts` + `src/plugins.ts` | `src/plugins.ts` |
| `src/tools/metrics-tool.ts` + `src/metrics.ts` | `src/metrics.ts` |
| `src/tools/task-predictor-tool.ts` + `src/task-predictor.ts` | `src/task-predictor.ts` |
| `src/tools/intelligence-tool.ts` + `src/intelligence.ts` | `src/intelligence.ts` |
| `src/tools/safety-gates-tool.ts` + `src/safety-gates.ts` | `src/safety-gates.ts` |
| `src/tools/token-tracking-tool.ts` + `src/token-tracking.ts` | `src/token-tracking.ts` |
| `src/tools/context-budget-tool.ts` + `src/context-budget.ts` | `src/context-budget.ts` |
| `src/tools/interactive-approval-tool.ts` + `src/interactive-approval.ts` | `src/interactive-approval.ts` |
| `src/tools/ralph-loop-tool.ts` + `src/ralph-loop.ts` | `src/ralph-loop.ts` |
| `src/tools/hookify-tool.ts` + `src/hookify.ts` | `src/hookify.ts` |
| `src/tools/auto-invoke-tool.ts` + `src/auto-invoke.ts` | `src/auto-invoke.ts` |
| `src/tools/explanatory-output-style-tool.ts` + `src/explanatory-output-style.ts` | `src/explanatory-output-style.ts` |
| `src/tools/security-guidance-tool.ts` + `src/security-guidance.ts` | `src/security-guidance.ts` |

**Result:** 28 files → 14 files

### Batch 2: Near Template Matches (7 tools)

These use `new Manager()` at module scope instead of `getXXX()`:

| Current Files | Merged To |
|---|---|
| `src/tools/plan-tool.ts` + `src/prompt.ts` (plan state) | `src/plan.ts` (new file for plan manager + tool) |
| `src/tools/checkpoint-tool.ts` + `src/checkpoint.ts` | `src/checkpoint.ts` |
| `src/tools/hook-tool.ts` + `src/hooks.ts` | `src/hooks.ts` |
| `src/tools/stuck-tool.ts` + `src/stuck.ts` | `src/stuck.ts` |
| `src/tools/tom-tool.ts` + `src/tom.ts` | `src/tom.ts` |
| `src/tools/error-patterns-tool.ts` + `src/error-patterns.ts` | `src/error-patterns.ts` |
| `src/tools/bug-report-tool.ts` + `src/bug-report.ts` | `src/bug-report.ts` |

**Result:** 14 files → 7 files

### Batch 3: Special Patterns (9 tools)

These have unique patterns requiring custom handling:

| Tool | Approach |
|------|----------|
| `rag-tool.ts` | Lazy init — adapt registry to support lazy manager creation |
| `singularity-tool.ts` | Module-level const — merge into `src/singularity.ts` |
| `trajectory-tool.ts` | Factory function — adapt registry to accept factory |
| `roulette-tool.ts` | Inline helper — merge into `src/model-roulette.ts` |
| `multi-agent-tool.ts` | Merge into `src/multi-agent.ts` |
| `sdk-tool.ts` | Merge into `src/sdk.ts` |
| `benchmark-tool.ts` | Merge into `src/benchmark.ts` |
| `tool-cache-tool.ts` | Merge into `src/tool-cache.ts` |
| `journal-tool.ts` | Merge into `src/journal-manager.ts` |
| `commit-msg-tool.ts` | Thin wrapper — merge into `src/commit-msg.ts` |

**Result:** ~18 files → ~10 files

### Files NOT Changed

These don't follow the action-switch pattern and have different architecture:

- `src/tools/file-tools.ts` — direct shell/FS calls, multi-export
- `src/tools/search-tools.ts` — direct shell/FS calls, multi-export
- `src/tools/http-tool.ts` — single operation, Promise-based
- `src/tools/assess-tool.ts` — single operation, no manager
- `src/tools/reflect-tool.ts` — single operation, self-contained
- `src/tools/parallel-tool.ts` — single operation, spawn-based
- `src/tools/repomap-tool.ts` — single operation, no action switch

### Updated `src/tools/index.ts`

```typescript
// Before: 39 imports from *-tool.ts files
// After: ~22 imports from manager files + registry

import { createTool } from "./registry.js";
import { createContextBudgetTool } from "../context-budget.js";
import { createJournalTool } from "../journal-manager.js";
// ... etc

export function buildTools(): AgentTool[] {
  return [
    ...fileTools,
    ...searchTools,
    httpTool,
    assessTool,
    reflectTool,
    parallelTool,
    repomapTool,
    // ... all merged tools via createTool
  ];
}
```

---

## Registry Implementation Details

### Parameter Schema Generation

The registry collects all unique parameter keys across actions and makes them optional (since each action only uses a subset):

```typescript
function buildParameters(actions: Record<string, ToolAction>): TSchema {
  const actionNames = Object.keys(actions);
  const allParams = new Set<string>();

  // Collect all parameter keys from all action schemas
  for (const action of Object.values(actions)) {
    if (action.parameters) {
      // Extract keys from TypeBox schema properties
      const keys = Object.keys((action.parameters as any).properties || {});
      keys.forEach((k) => allParams.add(k));
    }
  }

  // Build merged schema with all params optional
  const paramProperties: Record<string, TSchema> = {};
  for (const key of allParams) {
    paramProperties[key] = Type.Optional(Type.Unknown());
  }

  return Type.Object({
    action: Type.String({
      enum: actionNames,
      description: `Action to perform: ${actionNames.join(", ")}`,
    }),
    ...paramProperties,
  });
}
```

**Design decision:** All non-action params are `Type.Optional(Type.Unknown())` because:
- Different actions need different params
- Making them all optional avoids schema validation failures
- The handler receives the raw params and can validate as needed
- This matches the current behavior where `params as { ... }` casts bypass strict validation

**Design decision:** All non-action params are `Type.Optional(Type.Unknown())` because:
- Different actions need different params
- Making them all optional avoids schema validation failures
- The handler receives the raw params and can validate as needed
- This matches the current behavior where `params as { ... }` casts bypass strict validation

### Execute Function Generation

```typescript
function buildExecute(actions: Record<string, ToolAction>) {
  return async (_toolCallId: string, params: unknown): Promise<AgentToolResult> => {
    const { action, ...rest } = params as { action: string };
    const actionDef = actions[action];
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
        return result as AgentToolResult;
      }
      // Otherwise wrap in standard format
      return {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        details: typeof result === "string" ? result : JSON.stringify(result),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        details: `Error: ${message}`,
      };
    }
  };
}
```

### Description Enhancement

Auto-append action list to description for agent visibility:

```typescript
function buildDescription(base: string, actions: Record<string, ToolAction>): string {
  const actionList = Object.entries(actions)
    .map(([name, def]) => `  - ${name}: ${def.description}`)
    .join("\n");
  return `${base}\n\nActions:\n${actionList}`;
}
```

---

## Evolution Script Updates

### ROADMAP.md — New Phase

Add Phase 38: **Tool Registry & Code Quality**

```
- [ ] Phase 38: Tool Registry & Code Quality
  - [ ] Create ToolRegistry factory
  - [ ] Migrate Batch 1 (14 exact-match tools)
  - [ ] Migrate batch 2 (7 near-match tools)
  - [ ] Migrate batch 3 (9 special-pattern tools)
  - [ ] Delete all *-tool.ts files
  - [ ] Update src/tools/index.ts
  - [ ] Verify build + tests pass
  - [ ] Update MEMORY.md scorecard
```

### Task Selection Improvement

Update the evolve prompt to prioritize refactoring over feature addition:

```
## Current Priority: Code Quality
The TOOL REGISTRY refactoring is in progress. 
Prefer tasks that:
1. Complete the registry migration
2. Improve test coverage
3. Reduce code duplication
Only add new features if they replace existing functionality.
```

---

## Expected Outcomes

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Tool files in src/tools/ | 39 | ~10 | -74% |
| Total source files | 94 | ~65 | -31% |
| Boilerplate lines | ~1,500 | ~400 | -73% |
| Files per capability | 2 | 1 | -50% |
| New tool creation cost | ~80 lines, 2 files | ~25 lines, 1 file | -69% |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Registry too complex for some tools | Allow escape hatch — tools can still be written manually |
| Migration breaks existing behavior | Batch-by-batch migration with build+test verification after each |
| Agent prompt behavior changes | Description auto-generation preserves action visibility |
| Type safety loss with `Record<string, unknown>` | Use TypeBox schemas for per-action validation in registry |

---

## Future Extensions

1. **Tool lazy loading** — Registry can load tool descriptions on demand, reducing startup context
2. **Tool grouping** — Registry can categorize tools for better prompt organization
3. **Dynamic tool registration** — Plugins can register tools via the same registry
4. **Tool performance tracking** — Registry can instrument handler timing automatically
