---
name: plan-architecture
description: Use when implementing non-trivial features - designs implementation approach by analyzing patterns, specifying files to modify, and creating a phased build sequence
---

# Plan Architecture

## Overview

Jumping into code without a plan creates rework. Ad-hoc changes miss dependencies. Architecture planning ensures clean integration.

**Core principle:** ALWAYS design the implementation approach BEFORE writing code.

## When to Use

Use AFTER exploration, BEFORE implementation:
- New features requiring multiple files
- Refactoring existing structure
- Adding new capabilities
- Complex bug fixes touching multiple components

**Use this ESPECIALLY when:**
- Feature involves new files
- Changes affect multiple modules
- Integration points are unclear
- Existing patterns need to be followed

## The Iron Law

```
NO CODE WITHOUT ARCHITECTURE PLAN FIRST
```

If you haven't documented the plan, you cannot write implementation code.

## The Four Steps

### Step 1: Pattern Analysis

**Extract existing patterns:**
1. Review similar features in codebase
2. Identify naming conventions
3. Note error handling patterns
4. Understand test structure

**From exploration findings:**
- What files follow similar structure?
- How are similar features tested?
- What's the module organization pattern?

### Step 2: Design Decision

**Make decisive choices:**
1. Pick ONE approach (not multiple options)
2. Commit to the design
3. Document trade-offs accepted
4. Ensure seamless integration

**Questions to answer:**
- Where should new code live?
- What existing code to reuse/extend?
- What new interfaces needed?
- How will this be tested?

### Step 3: Implementation Blueprint

**Specify every change:**
1. List all files to create/modify
2. Describe each file's responsibility
3. Define interfaces between components
4. Map data flow through the system

**Format:**
```markdown
## Implementation Blueprint

### Files to Create
- `src/new-feature.ts` - Core implementation
  - Import: existing types, utilities
  - Export: main function, types

### Files to Modify
- `src/agent.ts:120-145` - Add new tool registration
- `src/config.ts` - Add new config option

### Component Design
| Component | File | Responsibility | Dependencies |
|-----------|------|----------------|--------------|
| Feature Core | src/new-feature.ts | Main logic | types, utils |
| Integration | src/agent.ts | Tool registration | feature-core |

### Data Flow
1. CLI input → config parsing
2. Agent creation → feature registration
3. Feature execution → result processing
```

### Step 4: Build Sequence

**Create phased implementation:**
1. Order changes by dependency
2. Mark critical checkpoints
3. Define verification points
4. Estimate complexity per phase

**Phased approach:**
```markdown
## Build Sequence

### Phase 1: Foundation (2 files, low complexity)
- [ ] Create types in `src/types.ts`
- [ ] Add config option in `src/config.ts`
- Verify: Build passes, types compile

### Phase 2: Core Implementation (1 file, medium complexity)
- [ ] Implement `src/new-feature.ts`
- [ ] Add unit tests
- Verify: Tests pass, feature works standalone

### Phase 3: Integration (1 file, medium complexity)
- [ ] Register tool in `src/agent.ts`
- [ ] Add integration tests
- Verify: Agent can use new feature

### Phase 4: Documentation (2 files, low complexity)
- [ ] Update README.md
- [ ] Add JOURNAL.md entry
- Verify: Docs accurate, examples work
```

## Output Format

Complete architecture plan:

```markdown
# Architecture Plan: [Feature Name]

## Goal
[One sentence describing what this builds]

## Design Decision
[Chosen approach with rationale]

## Pattern Basis
- Reference feature: [similar existing code]
- Pattern: [naming, structure, error handling]
- Integration: [how it fits existing architecture]

## Files

| File | Action | Lines | Complexity |
|------|--------|-------|------------|
| src/new-feature.ts | Create | ~50 | Medium |
| src/agent.ts | Modify | ~10 | Low |
| src/config.ts | Modify | ~5 | Low |

## Build Sequence

### Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2
- Verify: [checkpoint]

### Phase 2: [Name]
- [ ] Task 1
- [ ] Task 2
- Verify: [checkpoint]

## Critical Details
- Error handling: [approach]
- Testing: [coverage plan]
- Performance: [considerations]
- Security: [if applicable]
```

## Red Flags - Stop and Plan More

If you're thinking:
- "I'll just add this one function" → Check integration points
- "This is simple enough to skip planning" → Simple things have dependencies
- "Let me start coding and figure it out" → Figure it out first
- "The pattern is obvious" → Document it anyway for consistency

**ALL mean: STOP. Complete Step 3 (blueprint) before coding.**

## Integration with Self-Evolution

This skill should be invoked during the **Implementation** stage:
1. After explore-code (understanding complete)
2. **Invoke plan-architecture** for design
3. Use plan tool for step tracking
4. Proceed to implementation with blueprint

## Use with Plan Tool

The build sequence can be tracked with the plan tool:

```typescript
// Create plan from architecture blueprint
plan({
  action: 'create',
  steps: [
    'Phase 1: Create types',
    'Phase 1: Add config option',
    'Phase 1: Verify build passes',
    'Phase 2: Implement core',
    'Phase 2: Add unit tests',
    ...
  ]
})
```

## Real-World Impact

From actual sessions:
- Planned implementations: 90% success on first try
- Unplanned implementations: 50% success, 50% need redesign
- Average time: +10 minutes planning, -45 minutes rework

## Quick Reference

| Step | Activity | Success Criterion |
|------|----------|-------------------|
| **1. Patterns** | Analyze existing code | Know conventions |
| **2. Decision** | Choose approach | One committed design |
| **3. Blueprint** | Specify files and changes | Know exactly what to do |
| **4. Sequence** | Order implementation | Have checkpointed plan |