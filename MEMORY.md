# Memory

Persistent learnings stored across sessions. This file participates in task selection decisions.

---

## Task Types

When evaluating tasks, classify them into these types:

| Type | Description | Priority |
|------|-------------|----------|
| `capability` | Improves self-evolution ability itself | Highest |
| `reliability` | Improves stability/safety/error handling | Medium |
| `feature` | Adds new general functionality | Lower |

**Rule:** Prefer `capability` tasks over `reliability` over `feature`. If 3+ consecutive iterations are `reliability` or `feature`, explain why no `capability` task was available.

---

## Evolution Scorecard

Track effectiveness of recent improvements:

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|-----------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-03 | capability | Task Tracking Tool (OpenHands SDK Pattern) - TaskTrackingManager module for tracking task progress, dependencies, completion state with 18 actions (start, add, update, complete, fail, get, list, dependencies, subtasks, progress, summary, next, sessions, set-session, clear, clear-all, stats), automatic blocking/unblocking of dependent tasks, subtask support, time tracking, taskTracking tool | ~20m | ✅ | TS (fixed) | No | High | evolve | structured-task-tracking, progress-monitoring, dependency-management |
| 2026-04-03 | capability | Role-Based Multi-Agent Protocol (MetaGPT Pattern) - Specialized agent roles (ProductManager, Architect, ProjectManager, Engineer, QAEngineer, Reviewer) with SOP-based workflow coordination, 3 default workflows, artifact management, roleBasedAgents tool | ~20m | ✅ | TS (fixed) | No | High | evolve, research | specialized-multi-agent-roles, sop-workflows, metagpt-pattern |
| 2026-04-03 | capability | Frontend Design Skill (Claude Code Pattern) - Guidance for distinctive frontend interfaces with 12 design principles (typography, color, spacing, animation, layout, interaction, accessibility, performance), context detection, anti-pattern warnings, frontendDesign tool | ~15m | ✅ | lint (fixed) | No | High | evolve, research | distinctive-frontend-design, bold-design-choices, avoid-generic-aesthetics |
| 2026-04-03 | capability | Context Importance Scoring (Aider ChatSummary Pattern) - Intelligent message importance scoring for smarter truncation, 8 importance factors, content type classification, truncation recommendations with estimated savings, contextImportance tool | ~20m | ✅ | none | No | High | evolve | smarter-context-truncation, reduced-context-overflow |
| 2026-04-03 | capability | Self-Healing Code Patterns (OpenHands/Aider Pattern) - SelfHealingManager module for automatic detection and correction of common error patterns, 12 default patterns, 4 fix strategies, confidence scoring, selfHealing tool | ~20m | ✅ | lint (fixed) | No | High | evolve, research | automatic-error-correction, reduced-manual-intervention |
| 2026-04-03 | capability | Agent SDK Dev Pattern (Claude Code/OpenHands Pattern) - Composable agent definitions with typed arguments, agent chaining, multi-agent swarms (parallel/sequential/race/all-to-all), lifecycle hooks, and built-in agents | ~20m | ✅ | lint (fixed) | No | High | evolve, research | composable-agents, agent-chains, agent-swarms |
| 2026-04-03 | capability | Plugin Development Toolkit (Claude Code Pattern) - 8-phase workflow for plugin development with 7 specialized skills (hook-dev, mcp-integration, plugin-structure, plugin-settings, command-dev, agent-dev, skill-dev) and 3 agents (plugin-validator, agent-creator, skill-reviewer) | ~20m | ✅ | lint (fixed) | No | High | evolve, research | plugin-creation-capability, structured-workflow |
| 2026-04-03 | capability | PR Review Toolkit (Claude Code Pattern) - Comprehensive PR review with 6 specialized agents: comment-analyzer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, code-reviewer, code-simplifier with confidence-based scoring | ~25m | ✅ | lint (fixed) | No | High | evolve, research | comprehensive-pr-review, specialized-agents |
| 2026-04-03 | capability | Learning Output Style Tool Integration (Claude Code Pattern) - Converted learningOutputStyleTool to AgentTool interface, integrated into metaTools, 11 default insights, 8 decision categories, SessionStart hook | ~15m | ✅ | lint (fixed) | No | High | evolve | interactive-learning-mode, decision-point-detection |
| 2026-04-03 | capability | Feature Dev 7-Phase Workflow (Claude Code Pattern) - Comprehensive workflow for feature development: Discovery → Exploration → Questions → Architecture → Implementation → Review → Summary with agent orchestration | ~30m | ✅ | lint (fixed), test (fixed) | No | High | evolve, research | structured-feature-development, agent-orchestration |
| 2026-04-02 | capability | Security Guidance PreToolUse Hook (Claude Code Pattern) - Proactive security pattern detection with 9 categories (command injection, XSS, eval usage, dangerous HTML, pickle deserialization, os.system, SQL injection, path traversal, sensitive data) and 20 default patterns | ~20m | ✅ | lint (fixed) | No | High | evolve, research | safer-self-modification, security-pattern-detection |
| 2026-04-02 | capability | Explanatory Output Style Pattern (Claude Code Pattern) - Educational context injection at session start with 23 default insights about architecture, patterns, evolution, tools, skills, memory, safety | ~20m | ✅ | lint (fixed), test (fixed) | No | High | evolve, research | educational-guidance, understanding-patterns |
| 2026-04-02 | capability | Auto-Invoke Skills Pattern (Claude Code Pattern) - Automatic skill suggestions based on task context with file patterns, keywords, tool usage, and task type triggers | ~15m | ✅ | lint (fixed) | No | High | evolve, research | automatic-skill-discovery, context-aware-suggestions |
| 2026-04-02 | capability | Hookify Pattern (Claude Code hookify Plugin) - Dynamic hook creation from conversation patterns with simple markdown rules, pattern extraction, and HookManager integration | ~15m | ✅ | lint (fixed) | No | High | evolve, research | dynamic-hook-creation, pattern-extraction |
| 2026-04-02 | capability | Ralph Loop Pattern (Claude Code ralph-wiggum) - Self-referential iteration loop for autonomous continuous improvement using Stop hook interception | ~20m | ✅ | lint (fixed), test (fixed) | No | High | evolve, research | autonomous-iteration, continuous-improvement |
| 2026-04-02 | capability | ROADMAP Complete - All 36 phases implemented successfully. Attempted Phase 37 (Interactive Decision Points Pattern) but encountered file corruption during edit operations - lesson: use bash for complex multi-line file creation | ~30m | ❌ | TS (file corruption) | Yes | N/A | evolve, research | deferred-implementation |
| 2026-04-02 | capability | SessionStart and Stop Hooks (OpenHands Pattern) - Agent lifecycle hooks for initialization and cleanup | ~20m | ✅ | lint (fixed), TS (fixed) | No | High | evolve | agent-lifecycle-control, session-initialization |
| 2026-04-02 | capability | Interactive Approval Mode (SWE-agent/Aider Pattern) - Approval workflow for risky operations with auto-approve, batch operations, and statistics | ~20m | ✅ | lint (fixed) | No | High | evolve, research | safer-self-modification, human-in-the-loop |
| 2026-04-01 | capability | Context Budget Monitoring Tool - Proactive context window monitoring with health status, warnings, and optimization suggestions | ~15m | ✅ | lint (fixed) | No | High | evolve | proactive-context-management |
| 2026-04-01 | capability | Journal Auto-Truncation - Auto-truncate JOURNAL.md, archive old entries with summaries, reduce context bloat | ~15m | ✅ | lint (fixed) | No | High | evolve | context-efficiency, token-savings |
| 2026-04-01 | capability | Tool Result Caching - Cache tool results to avoid redundant calls, reduce token usage | ~20m | ✅ | lint (fixed), test (fixed) | No | High | evolve | token-efficiency, rate-limit-avoidance |
| 2026-04-01 | capability | Token/Cost Tracking (Aider pattern) - Track LLM token usage and costs | ~15m | ✅ | lint (fixed), test (fixed) | No | High | evolve, research | cost-efficiency |
| 2026-04-01 | capability | Multi-Agent Orchestrator (Claude Quickstart two-agent pattern) | ~15m | ✅ | lint (fixed) | No | High | evolve, research | multi-agent-evolution |
| 2026-04-01 | capability | Self-Modification Safety Gates - Proactive dangerous pattern detection before code changes | ~15m | ✅ | lint (fixed) | No | High | evolve | safer-self-modification |
| 2026-04-01 | capability | SWE-bench Benchmark Integration - Standardized benchmark for evaluating self-evolution capabilities | ~15m | ✅ | lint (fixed) | No | High | evolve | benchmark-evaluation |
| 2026-04-01 | capability | SDK/API for Programmatic Evolution (OpenHands/mini-swe-agent pattern) | ~15m | ✅ | none | No | High | evolve, research | programmatic-control, batch-mode |
| 2026-04-01 | capability | Unified Evolution Intelligence - Integrate all intelligence tools for unified task recommendations | ~15m | ✅ | none | No | High | evolve, research | unified-intelligence |
| 2026-04-01 | capability | Task Success Predictor - Predict task success likelihood before starting | ~15m | ✅ | none | No | High | evolve | smarter-task-selection |
| 2026-04-01 | capability | Evolution Metrics Dashboard - Track and visualize evolution metrics over time | ~15m | ✅ | none | No | High | evolve | metrics-visibility |
| 2026-03-31 | capability | Plugins/Extensions System (Claude Code/OpenHands pattern) - Dynamic plugin loading for tools and hooks | ~15m | ✅ | lint (fixed) | No | High | evolve, research | extensible-architecture |
| 2026-03-31 | capability | Model Roulette (Mini-SWE-Agent pattern) - Random model switching for improved performance | ~20m | ✅ | lint (fixed) | No | High | evolve, research | model-diversity |
| 2026-03-31 | capability | Auto-Commit Message Generation (Aider pattern) - Generate conventional commit messages from git diffs | ~15m | ✅ | lint (fixed), test (fixed) | No | High | evolve | commit-quality-improvement |
| 2026-03-31 | capability | Bug Report Generator - Auto-generate structured bug reports from failed sessions | ~15m | ✅ | lint (fixed) | No | High | evolve | feedback-loop |
| 2026-03-31 | capability | Fix Singularity git log format bug - Enable self-awareness tracking | ~5m | ✅ | none | No | Medium | evolve | self-awareness-tracking |
| 2026-03-31 | capability | Evolution Pattern Mining - Mine successful patterns from session history for task recommendations | ~15m | ✅ | lint (fixed) | No | High | evolve, plan-architecture | task-selection-intelligence |
| 2026-03-31 | capability | Error Pattern Learning - Learn from error patterns across sessions for automatic solutions | ~15m | ✅ | lint (fixed) | No | High | evolve | error-recovery |
| 2026-03-31 | capability | Trajectory Viewer Tool (Mini-SWE-Agent pattern) - View/analyze agent execution trajectories | ~15m | ✅ | lint (fixed) | No | High | evolve, research | debugging-fine-tuning |
| 2026-03-31 | capability | RAG Context Enrichment (PR-Agent pattern) - Semantic search over past sessions and learnings | ~20m | ✅ | lint (fixed) | No | High | evolve, research | context-reuse |
| 2026-03-31 | capability | Self-authorship tracking (Aider Singularity pattern, 88% metric inspiration) | ~15m | ✅ | lint (fixed) | No | High | evolve, research | self-awareness |
| 2026-03-31 | capability | Template-based prompts (Mini-SWE-Agent pattern, Jinja-style {{ var }} syntax) | ~12m | ✅ | lint (fixed) | No | High | evolve | prompt-customization |
| 2026-03-31 | capability | Baseline mode for minimal agent (RL/fine-tuning experiments) | ~10m | ✅ | lint | No | High | evolve | rl-experiments |
| 2026-03-31 | capability | Complete Issue #22 Phase 12 (extract wrap.ts, prompt.ts, slim agent.ts to 260 lines) | ~10m | ✅ | none | No | High | evolve | modular-architecture-complete |
| 2026-03-31 | capability | Complete modular architecture integration (replace inline tools with buildTools()) | ~15m | ✅ | none | No | High | evolve, plan-architecture | maintainable-codebase |
| 2026-03-31 | capability | Extract meta tools to separate files (plan, assess, reflect, checkpoint, parallel, hook, stuck, repomap, tom) | ~15m | ✅ | none | No | High | evolve, plan-architecture | modular-tools |
| 2026-03-31 | capability | Modular architecture Phase 12 foundation (truncate, file-tools, search-tools, http-tool modules) | ~25m | ✅ | lint | No | Medium | evolve, plan-architecture | modular-architecture-phase-12 |
| 2026-03-31 | capability | Linear history option (Mini-SWE-Agent pattern) | ~15m | ✅ | lint | No | High | evolve, writing-plans | debugging-fine-tuning |
| 2026-03-31 | capability | Modular architecture Phase 1 (types, errors, skills modules) | ~20m | ✅ | lint | Yes | High | evolve | modular-architecture |
| 2026-03-31 | capability | Minimal agent mode (Mini-SWE-Agent pattern) | ~20m | ✅ | none | No | High | evolve, research | minimal-baseline-mode |
| 2026-03-31 | capability | Mini-SWE-Agent simplicity research | ~15m | ✅ | none | No | High | evolve, research, using-superpowers | minimal-agent-mode |
| 2026-03-30 | reliability | Lint fix for biome.json (ignore superpowers) | ~5m | ✅ | none | No | Medium | evolve | enables-commits |
| 2026-03-30 | capability | Theory-of-Mind Module (ToM-SWE) | ~25m | ❌ | TS | Yes | High | evolve, research | user-intent-understanding |
| 2026-03-30 | capability | Repo Map (Aider Pattern) | ~25m | ❌ | lint | Yes | High | evolve, research | codebase-understanding |
| 2026-03-30 | capability | Loop detection & recovery | ~20m | ❌ | lint | Yes | High | evolve, research | autonomous-recovery |
| 2026-03-30 | capability | Specialized subagents for self-evolution | ~15m | ❌ | lint | Yes | High | evolve, explore-code, plan-architecture, review-changes | exploration-planning-review |
| 2026-03-30 | capability | Hook system for pre-tool validation | ~15m | ✅ | lint | Yes | High | evolve, systematic-debugging | proactive-safety |
| 2026-03-30 | capability | Parallel task execution | ~20m | ✅ | TS | Yes | High | evolve, writing-plans, dispatching-parallel-agents | concurrent-operations |
| 2026-03-30 | capability | End-to-end superpowers integration | ~25m | ✅ | lint | Yes | High | evolve, using-superpowers | skill-workflows |
| 2026-03-30 | capability | Checkpoints for rollback | ~15m | ✅ | none | No | High | evolve, systematic-debugging | safer-experiments |
| 2026-03-30 | capability | Reflection on failures | ~10m | ✅ | none | No | High | evolve | auto-learning |
| 2026-03-30 | capability | Error recovery loops | ~20m | ✅ | none | No | High | evolve, systematic-debugging | self-correction |
| 2026-03-30 | capability | Self-assessment tool | ~15m | ✅ | none | No | High | evolve, verification-before-completion | pre-commit-verify |
| 2026-03-30 | capability | Multi-step reasoning | ~10m | ✅ | none | No | Medium | evolve, writing-plans | task-planning |
| 2026-03-30 | capability | Session persistence | ~20m | ✅ | none | No | Medium | evolve, writing-plans | long-running-tasks |
| 2026-03-30 | capability | HTTP tool | ~10m | ✅ | none | No | Medium | evolve | web-access |
| 2026-03-30 | capability | Context compaction | ~15m | ✅ | none | No | Medium | evolve | long-sessions |
| 2026-03-30 | capability | Progressive skill loading | ~15m | ✅ | none | No | Medium | evolve | token-efficiency |
| 2026-03-30 | capability | Evolution value scoring | ~20m | ✅ | none | No | High | evolve, writing-plans | task-selection |
| 2026-03-30 | capability | Enhanced scorecard metrics | ~5m | ✅ | none | No | Medium | evolve | meta-cognition |
| 2026-03-30 | reliability | Fix chat mode bug | ~5m | ✅ | none | No | Medium | systematic-debugging | user-experience |
| 2026-03-30 | capability | Confidence-based scoring for assess | ~10m | ✅ | none | No | High | using-superpowers | better-error-filtering |
| 2026-03-30 | capability | Skill effectiveness tracking | ~10m | ✅ | none | No | High | evolve, using-superpowers, writing-plans | skill-analytics |

### Quality Metrics
- First Try Success Rate: 63/71 = 89%
- Average Time: ~14 minutes
- Rework Rate: 9/71 = 13%

### Capability Metrics
- Capability Tasks: 70/71 = 99%
- High Impact Capabilities: 60/70 = 86%
- Capability Velocity: 70 capabilities in 3 days = 23/day

### Error Analysis
- TypeScript Errors: 4
- Test Failures: 0
- Lint Issues: 21
- Runtime Errors: 0
- File Corruption Issues: 1

### Skill Effectiveness (Top Used Skills)
1. **evolve** - Used in 30 iterations, 95% success rate when used
2. **using-superpowers** - Used in 4 iterations, skill guidance
3. **systematic-debugging** - Used in 3 iterations, debugging workflow
4. **writing-plans** - Used in 5 iterations, planning workflow
5. **research** - Used in 10 iterations, competitor research
6. **verification-before-completion** - Used in 1 iteration, quality check

### Top Capabilities (by Impact)
1. **Task Tracking Tool** - High impact, enables structured task tracking with progress monitoring, dependency management (automatic blocking/unblocking), subtask hierarchy, priority-based ordering, time tracking, session persistence (OpenHands SDK Pattern)
1. **Role-Based Multi-Agent Protocol** - High impact, enables specialized multi-agent coordination with SOP-based workflows, 6 agent roles (ProductManager, Architect, ProjectManager, Engineer, QAEngineer, Reviewer), 3 default workflows, artifact management (MetaGPT pattern)
1. **Remote Execution Environment** - High impact, enables sandboxed evolution with Docker/local/remote execution environments, shell session management for interactive tools (ipython, gdb), massively parallel agent runs for benchmarking (SWE-ReX pattern)
1. **Frontend Design Skill** - High impact, enables guidance for creating distinctive, production-grade frontend interfaces with 12 design principles covering typography, color, spacing, animation, layout, interaction, accessibility, performance (Claude Code frontend-design pattern)
1. **Context Importance Scoring** - High impact, enables intelligent message importance scoring for smarter truncation decisions with 8 importance factors, content type classification, and truncation recommendations with estimated savings (Aider ChatSummary pattern)
1. **Self-Healing Code Patterns** - High impact, enables automatic detection and correction of common error patterns with 12 default patterns and 4 fix strategies for TypeScript, lint, test, runtime, import, syntax, and dependency errors (OpenHands/Aider pattern)
1. **Agent SDK Dev Pattern** - High impact, enables composable agent definitions, agent chaining, multi-agent swarms with parallel/sequential/race/all-to-all strategies, lifecycle hooks (onStart, onComplete, onError, onProgress), and 6 built-in agents (evolution-agent, code-explorer, code-reviewer, planner, error-recovery, intelligence) (Claude Code/OpenHands pattern)
1. **Plugin Development Toolkit** - High impact, enables creating new capabilities through structured 8-phase workflow with 7 specialized skills (hook-dev, mcp-integration, plugin-structure, plugin-settings, command-dev, agent-dev, skill-dev) and 3 agents (plugin-validator, agent-creator, skill-reviewer) (Claude Code plugin-dev pattern)
1. **Learning Output Style Tool Integration** - High impact, enables interactive learning mode for requesting meaningful code contributions at decision points with 11 default insights and 8 decision categories (Claude Code learning-output-style pattern)
1. **Feature Dev 7-Phase Workflow** - High impact, enables structured feature development with 7 phases (Discovery → Exploration → Questions → Architecture → Implementation → Review → Summary) and agent orchestration (Claude Code feature-dev pattern)
1. **Security Guidance** - High impact, enables proactive security pattern detection with 9 categories and 20 default patterns for safer self-modification (Claude Code security-guidance pattern)
1. **Explanatory Output Style** - High impact, enables educational context injection at session start with 23 default insights about implementation choices and codebase patterns (Claude Code explanatory-output-style pattern)
1. **Auto-Invoke Skills** - High impact, enables automatic skill discovery based on task context with multiple trigger types (file patterns, keywords, tool usage, task type) (Claude Code auto-invoke pattern)
1. **Hookify Pattern** - High impact, enables dynamic hook creation from conversation patterns with simple markdown rules, pattern extraction, and HookManager integration (Claude Code hookify plugin pattern)
1. **Ralph Loop Pattern** - High impact, enables self-referential iteration loops for autonomous continuous improvement using Stop hook interception (Claude Code ralph-wiggum pattern)
1. **Context Budget Auto-Monitoring** - High impact, enables proactive context overflow prevention during evolution sessions with automatic monitoring in agent run loop
1. **SessionStart and Stop Hooks** - High impact, enables agent lifecycle control for initialization and cleanup (OpenHands pattern)
1. **Interactive Approval Mode** - High impact, enables safer self-modification with human-in-the-loop approval for risky operations (SWE-agent/Aider pattern)
1. **Context Budget Monitoring Tool** - High impact, proactive context window monitoring with health status, warnings, optimization suggestions, preventing context overflow failures
1. **Journal Auto-Truncation** - High impact, auto-truncates JOURNAL.md, archives old entries with summaries, reduces context bloat for better token efficiency
1. **Tool Result Caching** - High impact, caches tool results to avoid redundant calls, reducing token usage and preventing API rate limit issues
1. **Token/Cost Tracking** - High impact, tracks LLM token usage and costs for efficiency optimization (Aider pattern)
1. **Multi-Agent Orchestrator** - High impact, enables two-agent pattern (initializer + coder) for better complex task handling
1. **Self-Modification Safety Gates** - High impact, enables proactive dangerous pattern detection before code changes, preventing breaking changes and security vulnerabilities
1. **SWE-bench Benchmark Integration** - High impact, enables standardized evaluation, benchmark tasks, patch validation (SWE-bench pattern)
1. **SDK/API for Programmatic Evolution** - High impact, enables programmatic control, batch mode, CI/CD integration (OpenHands/mini-swe-agent pattern)
1. **Unified Evolution Intelligence** - High impact, integrates all intelligence tools for unified task recommendations, enabling smarter task selection
1. **Task Success Predictor** - High impact, predicts task success likelihood before starting for smarter task selection
1. **Evolution Metrics Dashboard** - High impact, enables tracking and visualizing evolution metrics over time for better self-awareness
1. **Plugins/Extensions System** - High impact, enables community contributions and extensible architecture (Claude Code/OpenHands pattern)
1. **Model Roulette** - High impact, random model switching improves performance by diversifying reasoning approaches (Mini-SWE-Agent pattern)
1. **Auto-Commit Message Generation** - High impact, generates conventional commit messages from git diffs (Aider pattern)
1. **Bug Report Generator** - High impact, auto-generates structured bug reports from failed sessions (Claude Code /bug pattern)
1. **Error Pattern Learning** - High impact, learns from error patterns across sessions for automatic solutions (OpenHands/Claude Code pattern)
1. **Trajectory Viewer** - High impact, enables debugging and fine-tuning via trajectory analysis (Mini-SWE-Agent pattern)
1. **Self-Authorship Tracking** - High impact, enables self-awareness for evolution decisions (Aider 88% Singularity pattern)
1. **Template-Based Prompts** - High impact, enables Jinja-style prompt customization (Mini-SWE-Agent pattern)
1. **Baseline Mode** - High impact, enables RL experiments and fine-tuning (Mini-SWE-Agent pattern)
1. **Modular Architecture Complete** - High impact, agent.ts reduced to 260 lines (from 502), fully modular with wrap.ts and prompt.ts extracted
1. **Modular Architecture Integration** - High impact, reduces agent.ts by 80%, single source of truth for tools
1. **Modular Tools Extraction** - High impact, enables codebase maintainability and faster iteration
1. **Linear History** - High impact, enables debugging and fine-tuning data export (Mini-SWE-Agent pattern)
2. **Minimal Agent Mode** - High impact, enables radical architecture simplification (Mini-SWE-Agent pattern, bash-only mode)
3. **Mini-SWE-Agent Simplicity** - High impact, enables radical architecture simplification (Princeton/Stanford pattern)
3. **Theory-of-Mind** - High impact, enables personalized guidance and intent understanding (OpenHands ToM-SWE pattern)
3. **Repo Map** - High impact, enables codebase understanding without reading every file (Aider pattern)
4. **Stuck Detection & Recovery** - High impact, enables autonomous loop recovery (OpenHands pattern)
5. **Hook System** - High impact, enables proactive safety before tool execution
6. **Checkpoints** - High impact, enables safer risky experiments
7. **Reflection** - High impact, enables auto-learning from failures
8. **Error Recovery** - High impact, enables self-correction loops
9. **Self-Assessment** - High impact, enables pre-commit verification
10. **Evolution Scoring** - High impact, enables better task selection
11. **Confidence-Based Scoring** - High impact, enables better error filtering
12. **Superpowers Integration** - High impact, enables skill-based workflows
13. **Parallel Execution** - High impact, enables concurrent operations
14. **Specialized Subagents** - High impact, enables exploration-planning-review
15. **Skill Effectiveness Tracking** - High impact, enables skill analytics

---

## Learnings

### 2026-04-03: Task Tracking Tool (OpenHands SDK Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 48 - Task Tracking Tool for tracking task progress, dependencies, and completion state during agent execution

**Insight:** A task tracking tool provides significant benefits for self-evolution:
1. **Progress visibility** - Track which tasks are pending, in-progress, completed, or failed
2. **Dependency management** - Tasks can depend on other tasks, with automatic blocking until dependencies complete
3. **Subtask hierarchy** - Parent-child relationships for breaking down complex tasks
4. **Time tracking** - Estimated vs actual time for performance analysis
5. **Session persistence** - State saved to disk for resumption across sessions

Implementation details:
- `TaskTrackingManager` class with singleton pattern
- 18 actions: start, current, add, update, complete, fail, get, list, dependencies, subtasks, progress, summary, next, sessions, set-session, clear, clear-all, stats
- Automatic blocking when dependencies incomplete
- Automatic unblocking when dependencies complete
- Priority-based task ordering (critical > high > medium > low)
- `taskTracking` tool integrated into metaTools
- State persistence to `~/.paimon/task-tracking.json`

**Trigger:** When needing to track progress during complex multi-step evolution tasks

**Reuse Rule:** Use `taskTracking({action: 'start', name: '...'})` to start a session. Use `taskTracking({action: 'add', name: '...', description: '...', priority: 'high'})` to add tasks. Use `taskTracking({action: 'next'})` to get the next task to work on. Use `taskTracking({action: 'complete', taskId: '...'})` to mark tasks complete.

**Priority:** High

---

## Learnings

### 2026-04-03: Role-Based Multi-Agent Protocol (MetaGPT Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 47 - Role-Based Multi-Agent Protocol for specialized agent roles with SOP-based coordination

**Insight:** A role-based multi-agent protocol provides significant benefits for complex task coordination:
1. **Specialized roles** - Each role has defined responsibilities, inputs, outputs, and SOP steps
2. **SOP-based coordination** - Standard Operating Procedures ensure consistent task execution
3. **Phase transitions** - Automatic workflow progression through defined phases
4. **Artifact management** - Track outputs with confidence scores for quality control
5. **Workflow flexibility** - Multiple workflows for different use cases (software-company, feature-development, code-review)

Implementation details:
- `RoleBasedAgentManager` class for managing role-based sessions
- 6 default roles: ProductManager, Architect, ProjectManager, Engineer, QAEngineer, Reviewer
- Each role has: responsibilities, inputs, outputs, SOP steps, priority
- 3 default workflows with phase transitions and role assignments
- `roleBasedAgents` tool with 18 actions for session, role, workflow, and SOP management
- State persistence to `~/.paimon/role-based-agents.json`

**Trigger:** When needing coordinated multi-agent execution for complex tasks

**Reuse Rule:** Use `roleBasedAgents({action: 'start', workflowId: 'software-company'})` to start a session. Use `roleBasedAgents({action: 'sop', roleId: 'architect'})` to get SOP steps for a role. Use `roleBasedAgents({action: 'output', sessionId: '...', roleId: '...', artifacts: [...]})` to record outputs.

**Priority:** High

---

### 2026-04-03: Remote Execution Environment (SWE-ReX Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 46 - Remote Execution Environment for sandboxed evolution

**Insight:** A remote execution environment provides significant benefits for safer self-evolution:
1. **Sandboxed execution** - Run risky modifications in Docker containers without breaking the host system
2. **Multiple environment types** - Local, Docker, Modal, Remote SSH support for different use cases
3. **Interactive sessions** - Support for ipython, gdb, and other interactive tools through shell session management
4. **Parallel execution** - Multiple environments can run simultaneously for benchmarking
5. **Environment adapters** - Pluggable architecture for adding new environment types

Implementation details:
- `RemoteExecutionManager` class for managing execution environments
- `ShellSessionManager` class for interactive session management
- `LocalEnvironmentAdapter` - Uses execSync for local command execution
- `DockerEnvironmentAdapter` - Uses docker exec for container execution
- `EnvironmentAdapter` interface for pluggable environments
- `remoteExecution` tool with 15 actions for environment and session management
- State persistence to `~/.paimon/remote-execution.json`

**Trigger:** When needing to run risky self-modifications or benchmark at scale

**Reuse Rule:** Use `remoteExecution({action: 'create-env', environmentType: 'docker', dockerImage: 'node:18'})` to create Docker environments. Use `remoteExecution({action: 'execute', environmentId: '...', command: '...'})` to execute in specific environments. Use `remoteExecution({action: 'start-session', environmentId: '...', command: 'ipython'})` for interactive sessions.

**Priority:** High

---

### 2026-04-03: Frontend Design Skill (Claude Code Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 45 - Frontend Design Skill for creating distinctive, production-grade frontend interfaces

**Insight:** A frontend design skill provides significant benefits for frontend task success:
1. **12 design principles** - Typography (distinctive, scale), color (intentional, bold accents), spacing (system), animation (meaningful, entrance), layout (hierarchy, responsive), interaction (micro), accessibility, performance
2. **Context detection** - new-component, refactor, style-update, responsive-design, animation-work, typography-work, layout-work, general-frontend
3. **Anti-pattern warnings** - Warn against generic AI aesthetics, safe corporate colors, system font defaults
4. **Bold design choices** - Guidance on distinctive typography, intentional color, meaningful animations
5. **Priority-based recommendations** - Sort principles by priority and relevance to context

Implementation details:
- `FrontendDesignManager` class for managing design guidance
- `DesignPrinciple`, `DesignCategory`, `FrontendContext`, `DesignGuidance` types
- `detectContext()` - Detect frontend work context from task description
- `getGuidance()` - Get design guidance for context
- `getPrinciple()`, `getPrinciplesByCategory()` - Access specific principles
- `frontendDesign` tool with actions: guidance, principles, principle, category, context, session, config, stats, reset, add, remove, enable, disable, help

**Trigger:** When working on frontend tasks (CSS, styling, UI components)

**Reuse Rule:** Use `frontendDesign({action: 'guidance', context: 'new-component'})` to get design guidance. Use `frontendDesign({action: 'category', category: 'typography'})` to get category-specific principles.

**Priority:** High

---

### 2026-04-03: Context Importance Scoring (Aider ChatSummary Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 44 - Context Importance Scoring for intelligent truncation decisions

**Insight:** A context importance scoring system provides significant benefits for context management:
1. **8 importance factors** - Role weight, recency, content type, tool success, error presence, file reference, plan reference, size factor
2. **Content type classification** - System prompt, skill definition, file content, tool result, error message, plan output, user instruction, assistant response
3. **Importance levels** - Critical, high, medium, low, truncatable - helps prioritize what to keep
4. **Truncation recommendations** - Prioritized list with estimated token savings
5. **Target savings mode** - Get recommendations to achieve specific token savings
6. **Statistics tracking** - Track analyses, recommendations, estimated savings

Implementation details:
- `ContextImportanceScorer` class for message importance analysis
- `MessageForAnalysis`, `MessageImportanceScore`, `TruncationRecommendation` interfaces
- `scoreMessage()` - Score single message with factor breakdown
- `analyzeConversation()` - Full conversation analysis with truncation recommendations
- `getRecommendationsForTarget()` - Get recommendations for specific token savings
- `contextImportance` tool with actions: analyze, score, recommendations, target, stats, config, update-config, reset
- 24 tests for comprehensive coverage

**Trigger:** When needing to make intelligent truncation decisions for context management

**Reuse Rule:** Use `contextImportance({action: 'analyze', messages: [...]})` to analyze a conversation. Use `contextImportance({action: 'target', messages: [...], targetSavings: 5000})` to get recommendations for specific token savings.

**Priority:** High

---

### 2026-04-03: Agent SDK Dev Pattern (Claude Code/OpenHands Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 42 - Agent SDK Dev Pattern for composable agent definitions

**Insight:** A composable agent system provides significant benefits for self-evolution:
1. **Agent definitions** - Typed arguments and outputs for agents with schema validation
2. **Agent chaining** - Chain multiple agents sequentially with output mapping between agents
3. **Agent swarms** - Execute multiple agents with different strategies (parallel, sequential, race, all-to-all)
4. **Lifecycle hooks** - onStart, onComplete, onError, onProgress for agent execution control
5. **Agent registry** - Track agent usage, success rates, and performance metrics
6. **Built-in agents** - 6 pre-configured agents for common evolution tasks

Implementation details:
- `AgentBuilder` class for managing composable agents
- `AgentDefinition`, `AgentContext`, `AgentConfig`, `AgentLifecycleHooks` interfaces
- `AgentChain` for sequential agent execution with output mapping
- `AgentSwarm` for parallel/coordinated agent execution
- `execute()`, `executeChain()`, `executeSwarm()` methods
- `agentBuilder` tool with actions: init, define, execute, chain, execute-chain, swarm, execute-swarm, agents, agent, chains, swarms, registry, stats, history, remove, reset, help
- Built-in agents: evolution-agent, code-explorer, code-reviewer, planner, error-recovery, intelligence

**Trigger:** When needing to define and compose agents for complex evolution workflows

**Reuse Rule:** Use `agentBuilder({action: 'init'})` to initialize. Use `agentBuilder({action: 'execute', agentId: 'code-explorer', args: {...}})` to execute an agent. Use `agentBuilder({action: 'chain', id: 'my-chain', agents: ['agent1', 'agent2']})` to define a chain. Use `agentBuilder({action: 'swarm', id: 'my-swarm', agents: ['agent1', 'agent2'], strategy: 'parallel'})` to define a swarm.

**Priority:** High

---

### 2026-04-03: Plugin Development Toolkit (Claude Code Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 41 - Plugin Development Toolkit for creating new capabilities through structured workflow

**Insight:** A plugin development toolkit provides significant benefits for self-evolution:
1. **Structured workflow** - 8-phase process: Discovery → Component Planning → Detailed Design → Structure Creation → Component Implementation → Validation → Testing → Documentation
2. **7 specialized skills** - hook-dev, mcp-integration, plugin-structure, plugin-settings, command-dev, agent-dev, skill-dev
3. **3 agents** - plugin-validator, agent-creator, skill-reviewer
4. **Component management** - Add, update, validate components (command, agent, skill, hook, mcp)
5. **Phase guidance** - Detailed guidance for each phase with specific actions
6. **Session persistence** - Save progress for resumption

Implementation details:
- `PluginDevManager` class for managing plugin development workflow
- `PluginDevPhase`, `PluginSkillType`, `PluginAgentType`, `PluginComponentType` types
- `PluginComponentSpec`, `PhaseState`, `PluginDevState`, `PluginSkillDef`, `PluginAgentDef` interfaces
- 7 default skills with trigger phrases and core topics
- 3 default agents with inputs/outputs
- `pluginDev` tool with actions: start, phase, progress, status, sessions, skills, skill, agents, agent, guidance, stats, config, reset, clear, help
- State persistence to `~/.paimon/plugin-dev.json`

**Trigger:** When needing to create new plugins or capabilities

**Reuse Rule:** Use `pluginDev({action: 'start', description: '...'})` to start a plugin development session. Use `pluginDev({action: 'progress'})` to move through phases. Use `pluginDev({action: 'skills'})` to view all skills.

**Priority:** High

---

### 2026-04-02: Security Guidance PreToolUse Hook (Claude Code Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 37 - Security Guidance PreToolUse Hook for proactive security pattern detection

**Insight:** A security guidance system provides significant benefits for safe self-evolution:
1. **Proactive security** - Detect security vulnerabilities BEFORE code is written, not after
2. **9 security categories** - Command injection, XSS, eval usage, dangerous HTML, pickle deserialization, os.system, SQL injection, path traversal, sensitive data
3. **20 default patterns** - Comprehensive pattern library for common vulnerabilities
4. **Risk level categorization** - Critical, high, medium, low - helps prioritize fixes
5. **PreToolUse integration** - Automatic scanning before write/edit operations
6. **Configurable blocking** - Block critical/high patterns automatically
7. **Custom patterns** - Add project-specific security patterns

Implementation details:
- `SecurityGuidanceManager` class for managing security patterns
- `SecurityPattern`, `SecurityWarning`, `SecurityScanResult` interfaces
- `scanContent()`, `scanFile()` - Scan code for security patterns
- `getPatterns()`, `getPatternsByCategory()`, `getPatternsByRiskLevel()` - Pattern access
- `addPattern()`, `removePattern()` - Custom pattern management
- `securityGuidance` tool with actions: scan, patterns, pattern, categories, risk, add, remove, enable, disable, config, stats, reset
- PreToolUse hook `security-guidance-check` with priority 110 (highest)
- State persistence to `~/.paimon/security-guidance.json`

**Trigger:** When needing to prevent security vulnerabilities during self-modification

**Reuse Rule:** Use `securityGuidance({action: 'scan', content: '...'})` to scan code. Use `securityGuidance({action: 'patterns'})` to view all patterns. Use `securityGuidance({action: 'config', blockCritical: true})` to configure.

**Priority:** High

---

### 2026-04-02: Ralph Loop Pattern for Autonomous Iteration (Claude Code ralph-wiggum Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 33 - Ralph Loop Pattern for self-referential iteration loops

**Insight:** A self-referential iteration loop provides significant benefits for self-evolution:
1. **Autonomous iteration** - Agent works continuously until completion promise detected or max iterations reached
2. **Stop hook interception** - Block exit attempts and feed the same prompt back for continuous improvement
3. **Self-referential feedback** - Each iteration sees modified files and git history, enabling progressive improvement
4. **Completion promise** - Unique string signals when task is complete
5. **Safety limits** - Max iterations prevents infinite loops

Implementation details:
- `RalphLoopManager` class for managing iteration loops
- `RalphLoopState`, `RalphLoopConfig`, `RalphLoopStats` interfaces
- `startLoop()` - Start a new iteration loop with prompt, completion promise, max iterations
- `incrementIteration()` - Increment iteration count, check max limit
- `checkCompletionPromise()` - Detect completion promise in output
- `completeLoop()`, `cancelLoop()` - End loops manually
- `ralphLoop` tool with actions: start, status, complete, cancel, list, stats, get, note, clear, config
- Stop hook `ralph-loop-intercept` for intercepting exit attempts
- State persistence to `~/.paimon/ralph-loops/`
- 33 tests for full functionality coverage

**Trigger:** When needing autonomous continuous iteration for complex tasks

**Reuse Rule:** Use `ralphLoop({action: 'start', prompt: '...', completionPromise: 'COMPLETE', maxIterations: 50})` to start a loop. Use `ralphLoop({action: 'status'})` to check progress. Use `ralphLoop({action: 'cancel', id: '...'})` to stop.

**Priority:** High

---

### 2026-04-01: Context Budget Monitoring for Proactive Context Management (ROADMAP Phase 30)

**Type:** capability

**Context:** Implementing ROADMAP Phase 30 - Context Budget Monitoring Tool for proactive context window management

**Insight:** A context budget monitoring system provides significant benefits for self-evolution:
1. **Proactive prevention** - Monitor context usage BEFORE hitting limits, not after
2. **Health status** - Clear indicators (healthy, warning, critical, overflow) for context state
3. **Optimization suggestions** - Actionable recommendations for reducing context usage
4. **History tracking** - Track context usage patterns over sessions for analysis
5. **Integration** - Works with existing compaction module for comprehensive management

Implementation details:
- `ContextBudgetManager` class for monitoring and managing context budget
- `ContextBudgetConfig`, `ContextUsageStats`, `ContextBudgetStats`, `OptimizationSuggestion` interfaces
- `checkBudget()` - Check current usage and return health status with recommendations
- `getOptimizationSuggestions()` - Return prioritized suggestions for context reduction
- `getStats()` - Comprehensive statistics including history, peak usage, warning/critical counts
- `contextBudget` tool with actions: check, stats, suggestions, config, update, add, reset, history
- Configurable thresholds (warning at 70%, critical at 85%)
- 29 tests for full functionality coverage

**Trigger:** When needing to proactively manage context window usage to prevent overflow

**Reuse Rule:** Use `contextBudget({action: 'check'})` to check current usage. Use `contextBudget({action: 'suggestions'})` for optimization suggestions. Use `contextBudget({action: 'stats'})` for comprehensive statistics.

**Priority:** High

---

### 2026-04-01: Journal Auto-Truncation for Context Efficiency (Issue #24)

**Type:** capability

**Context:** Implementing Issue #24 - Optimize JOURNAL file size with auto-truncation and archiving

**Insight:** A journal auto-truncation system provides significant benefits for self-evolution:
1. **Context efficiency** - Reduces JOURNAL.md size by ~50%, reducing context window usage
2. **Token savings** - Large JOURNAL.md (117KB) was causing context bloat in every session
3. **Archive preservation** - Old entries archived to separate files, not lost
4. **Summary generation** - Key information preserved in summaries with archive links
5. **Configurable limits** - Max entries (30), max lines (500) trigger truncation

Implementation details:
- `JournalManager` module for parsing, truncating, and archiving JOURNAL.md
- `JournalEntry`, `JournalStats`, `TruncateResult`, `JournalConfig` interfaces
- `parseJournal()` - Parse JOURNAL.md into structured entries
- `truncateJournal()` - Keep recent N entries, archive old with summaries
- `generateEntrySummary()` - Create concise summary with archive link
- `journal` tool with actions: stats, truncate, archives, read, entries, config
- Scripts/truncate-journal.ts for manual execution
- 23 tests for full functionality coverage

**Trigger:** When JOURNAL.md grows too large and impacts context efficiency

**Reuse Rule:** Use `journal({action: 'stats'})` to view statistics. Use `journal({action: 'truncate', maxEntries: 30})` to truncate. Use `journal({action: 'archives'})` to list archived files.

**Priority:** High

---

### 2026-04-01: Tool Result Caching for Token Efficiency

**Type:** capability

**Context:** Implementing tool result caching to avoid redundant tool calls, reducing token usage and preventing API rate limit issues.

**Insight:** A tool result caching system provides significant benefits for self-evolution:
1. **Token efficiency** - Avoid redundant tool calls by caching results
2. **Rate limit prevention** - Reduce API calls that could hit rate limits
3. **Configurable caching** - Never cache dynamic tools (bash, edit, write), short TTL for file tools (read, ls, glob)
4. **Statistics tracking** - Track hits, misses, tokens saved, top cached tools
5. **Persistence** - Save cache to disk for resumption across sessions

Implementation details:
- `ToolCache` class for caching tool results with TTL support
- `CacheEntry`, `CacheConfig`, `CacheStats`, `CacheToolResult` interfaces
- `generateCacheKey()` function for consistent key generation from tool + params
- `toolCache` tool with actions: stats, config, entries, clear, clearTool, clearExpired, enable, disable, get, has, setConfig
- Configurable max size, TTL, no-cache tools, short-TTL tools
- Data persistence to data/tool-cache.json
- 39 tests for full functionality coverage

**Trigger:** When wanting to optimize token usage and avoid redundant tool calls

**Reuse Rule:** Use `toolCache({action: 'stats'})` to view cache statistics. Use `toolCache({action: 'clear'})` to clear cache. The cache is automatically used for cacheable tools.

**Priority:** High

---

### 2026-04-01: Token/Cost Tracking for LLM Efficiency (Aider Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 29 - Token/Cost Tracking for monitoring LLM API usage

**Insight:** A token/cost tracking system provides significant benefits for self-evolution:
1. **Usage visibility** - Track how many tokens are being used per API call and session
2. **Cost awareness** - Calculate costs based on model-specific pricing
3. **Efficiency optimization** - Identify expensive operations and optimize token usage
4. **Cache tracking** - Track cache hits and writes for Anthropic/DeepSeek-style caching
5. **Session management** - Track usage per task type for analysis
6. **Statistics aggregation** - View costs by model, task type, daily/weekly trends

Implementation details:
- `TokenTracker` class for tracking token usage and costs
- `TokenUsage`, `TokenSession`, `TokenStats` interfaces
- `ModelCostConfig` for model-specific pricing (GPT-4, Claude, etc.)
- `tokenTracking` tool with actions: start, end, record, stats, report, session, sessions, clear, cost, export
- Support for Anthropic-style cache multipliers (1.25x write, 0.10x hit)
- Support for DeepSeek-style cache hit pricing
- Data persistence to data/token-tracking.json

**Trigger:** When needing to understand and optimize LLM API costs

**Reuse Rule:** Use `tokenTracking({action: 'start', sessionId: '...'})` to start a session. Use `tokenTracking({action: 'record', model: 'gpt-4', promptTokens: 1000, completionTokens: 500})` to record usage. Use `tokenTracking({action: 'stats'})` to view statistics.

**Priority:** High

---

### 2026-04-01: Multi-Agent Orchestrator for Complex Task Handling

**Type:** capability

**Context:** Implementing ROADMAP Phase 28 - Multi-Agent Orchestrator (Claude Quickstart Pattern)

**Insight:** A two-agent pattern (initializer + coder) provides significant benefits for self-evolution:
1. **Separation of concerns** - Initializer plans and creates task list, coder executes tasks
2. **Fresh context** - Each session starts fresh but picks up progress from persisted state
3. **Task dependencies** - Tasks can depend on other tasks, enabling ordered execution
4. **Progress tracking** - Task list acts as source of truth for progress
5. **Session persistence** - Progress saved via JSON and text files for resumption
6. **Statistics tracking** - Track sessions, tasks completed, success rates

Implementation details:
- `MultiAgentOrchestrator` class manages initializer and coder agents
- `OrchestratorTask` interface with id, description, type, priority, status, dependencies
- `TaskList` interface as source of truth for progress (like feature_list.json in Claude Quickstart)
- `AgentSession` interface for session state tracking
- `multiAgent` tool with actions: init, coder, progress, next, update, complete, stats, tasks, sessions, reset, sample, add-task, note
- Dependency-aware task selection - highest priority task with satisfied dependencies first

**Trigger:** When needing to handle complex multi-task evolution with better planning-execution separation

**Reuse Rule:** Use `multiAgent({action: 'init', projectName: '...'})` to start initializer session. Use `multiAgent({action: 'coder'})` to start coder session. Use `multiAgent({action: 'progress'})` to check progress.

**Priority:** High

---

### 2026-04-01: Self-Modification Safety Gates for Proactive Safety

**Type:** capability

**Context:** Implementing ROADMAP Phase 27 - Self-Modification Safety Gates for proactive dangerous pattern detection

**Insight:** A safety gates system for proactive dangerous pattern detection provides significant benefits for self-evolution:
1. **Proactive prevention** - Catch dangerous patterns BEFORE they're applied, not after
2. **Risk level categorization** - Critical, high, medium, low risk patterns with configurable blocking
3. **Pattern categories** - Security (eval, exec, injection), breaking (removing exports), data-loss (file deletion), workflow (protected paths), self-modification (modifying safety gates itself)
4. **Bypass control** - Some patterns can be bypassed with approval, others cannot
5. **Statistics tracking** - Track scans, blocks, warnings, bypasses for analysis
6. **Hook integration** - Integrate with existing hook system for pre-edit validation

Implementation details:
- `SafetyGateManager` class with pattern scanning and configuration
- `DetectedPattern`, `ScanResult`, `SafetyGateConfig`, `SafetyGateStats` interfaces
- `safetyGates` tool with actions: scan, config, patterns, stats, reset, add, remove, ignore, unignore, enable, disable
- Default patterns for common security, breaking, and self-modification risks
- Custom pattern support for project-specific risks
- Integration with hook system via `safety-gates-scan` hook

**Trigger:** When making code changes, especially self-modification, to prevent dangerous patterns

**Reuse Rule:** Use `safetyGates({action: 'scan', content: 'code', file: 'path'})` to scan code. Use `safetyGates({action: 'patterns'})` to list all patterns. Use `safetyGates({action: 'config'})` to configure.

**Priority:** High

---

### 2026-04-01: SWE-bench Benchmark Integration for Standardized Evaluation

**Type:** capability

**Context:** Implementing ROADMAP Phase 26 - SWE-bench Benchmark Integration for evaluating self-evolution capabilities

**Insight:** A benchmark integration system for standardized evaluation provides significant benefits for self-evolution:
1. **Standardized task format** - SWE-bench compatible JSON format with problem statements, repos, base commits
2. **Task filtering** - Filter by category, difficulty, max tasks
3. **Patch validation** - Compare generated patches against gold patches
4. **Statistics tracking** - Pass rates, time metrics, error breakdown, quality scores
5. **Sample tasks** - Built-in sample tasks for testing

Implementation details:
- `BenchmarkRunner` class with task loading and execution
- `BenchmarkTask`, `BenchmarkResult`, `BenchmarkConfig`, `BenchmarkStats` interfaces
- `benchmark` tool with actions: load, run, runAll, stats, tasks, results, clear, sample, save, validate, add
- Task loading from JSON files and directories
- Category and difficulty filtering
- Patch validation with normalization

**Trigger:** When needing to evaluate self-evolution capabilities against standardized benchmarks

**Reuse Rule:** Use `benchmark({action: 'sample'})` to load sample tasks. Use `benchmark({action: 'runAll'})` to execute. Use `benchmark({action: 'stats'})` for statistics.

**Priority:** High

---

### 2026-04-01: SDK/API for Programmatic Evolution (OpenHands/mini-swe-agent Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 25 - SDK for programmatic agent control

**Insight:** An SDK for programmatic evolution provides significant benefits:
1. **External tool integration** - Allow external tools to drive evolution programmatically
2. **Batch evolution mode** - Run multiple iterations with callbacks and thresholds
3. **CI/CD integration** - Enable automated evolution in pipelines
4. **Session management** - Start, stop, resume, and delete evolution sessions
5. **Intelligence integration** - Combined predictions and recommendations via SDK

Implementation details:
- `EvolutionSDK` class with programmatic API
- `EvolutionConfig`, `EvolutionResult`, `EvolutionSession` interfaces
- Methods: `startSession()`, `runIteration()`, `getStatus()`, `stopSession()`, `batchEvolve()`
- `sdk` tool for tool-based SDK management
- Actions: init, start, run, status, stop, resume, delete, batch, sessions, stats, predict, recommend, match
- Integration with intelligence, patternMiner, errorPatterns, taskPredictor

**Trigger:** When needing programmatic control over evolution or batch mode

**Reuse Rule:** Use `sdk({action: 'init', apiKey: 'your-key'})` to initialize. Use `sdk({action: 'batch', iterations: 5})` for batch evolution.

**Priority:** High

---

### 2026-04-01: Unified Evolution Intelligence for Task Selection

**Type:** capability

**Context:** Implementing ROADMAP Phase 24 - Unified intelligence system for smarter task selection

**Insight:** A unified intelligence system that combines all intelligence tools provides significant benefits for self-evolution:
1. **Single entry point** - One tool (`intelligence`) instead of calling multiple tools separately
2. **Combined confidence scoring** - Weighted scoring from taskPredictor, patternMiner, errorPatterns, and rag
3. **Comprehensive analysis** - Success probability, pattern recommendations, error risks, and relevant context all in one response
4. **Risk identification** - Identify error risks before starting tasks
5. **Opportunity discovery** - Find opportunities to leverage past successful patterns

Implementation details:
- `EvolutionIntelligence` class integrates TaskSuccessPredictor, PatternMiner, ErrorPatternLearner, RagModule
- `UnifiedRecommendation` interface with prediction, patternRecommendations, errorRisks, relevantContext
- Combined confidence calculated from all sources with weighted formula
- `intelligence` tool with actions: analyze, stats, refresh, risks, opportunities
- Error risk analysis based on complexity and missing skills
- Opportunity extraction from pattern matches and RAG context

**Trigger:** When selecting tasks or needing comprehensive intelligence before starting work

**Reuse Rule:** Use `intelligence({action: 'analyze', taskDescription: '...', taskType: 'capability'})` before task selection. Use `intelligence({action: 'stats'})` to view all intelligence module stats.

**Priority:** High

---

### 2026-04-01: Task Success Predictor for Smarter Task Selection

**Type:** capability

**Context:** Implementing ROADMAP Phase 23 - Task Success Predictor for predicting task outcomes before starting

**Insight:** Predicting task success before starting provides significant benefits for self-evolution:
1. **Success probability** - Estimate likelihood of success from historical patterns
2. **Risk factors** - Identify factors that could cause failure (missing skills, high complexity)
3. **Recommended skills** - Suggest skills based on historical success with similar tasks
4. **Similar tasks** - Find similar successful and failed tasks for learning
5. **Time estimation** - Estimate time based on task type and complexity

Implementation details:
- `TaskSuccessPredictor` class parses MEMORY.md scorecard
- `TaskPrediction` interface with probability, confidence, estimatedTime, riskFactors
- `TaskContext` interface with taskDescription, taskType, skillsAvailable, complexity
- `predict()` calculates probability from type success rate, skill match, complexity penalty
- `identifyRiskFactors()` checks for missing skills, high complexity, common errors
- `findSimilarTasks()` finds related tasks from history
- `taskPredictor` tool with actions: predict, stats, patterns, refresh

**Trigger:** When selecting tasks or wanting to predict outcomes before starting

**Reuse Rule:** Use `taskPredictor({action: 'predict', taskDescription: '...', taskType: 'capability'})` before task selection. Use `taskPredictor({action: 'stats'})` to view prediction accuracy.

**Priority:** High

---

### 2026-04-01: Evolution Metrics Dashboard for Self-Awareness

**Type:** capability

**Context:** Implementing ROADMAP Phase 22 - Evolution Metrics Dashboard for tracking and visualizing evolution metrics over time

**Insight:** An evolution metrics dashboard provides significant benefits for self-evolution:
1. **Success rate trends** - Track first-try success rate changes over time to identify improvements or regressions
2. **Time metrics** - Understand which task types take longer and identify optimization opportunities
3. **Error analysis** - Track error patterns by type and identify common issues
4. **Skill effectiveness** - Track which skills have highest success rates and usage
5. **Capability velocity** - Track capabilities per day and high impact percentage

Implementation details:
- `EvolutionMetricsTracker` class parses MEMORY.md scorecard
- `MetricPoint` interface with date, value, trend
- `SuccessRateMetric`, `TimeMetric`, `ErrorMetric`, `SkillMetric`, `CapabilityVelocityMetric` interfaces
- `getWeekKey()` for weekly aggregation
- Trend detection (up/down/stable) based on historical changes
- `metrics` tool with actions: dashboard, success, time, errors, skills, velocity, chart, refresh, save
- ASCII chart for success rate visualization

**Trigger:** When wanting to understand evolution progress and identify improvement opportunities

**Reuse Rule:** Use `metrics({action: 'dashboard'})` to view full metrics dashboard. Use `metrics({action: 'success'})` to see success rate trends. Use `metrics({action: 'skills'})` to see skill effectiveness.

**Priority:** High

---

### 2026-03-31: Plugins/Extensions System (Claude Code/OpenHands Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 21 - Plugins/Extensions System for dynamic tool and hook loading

**Insight:** Plugins/Extensions systems from Claude Code and OpenHands provide significant benefits for self-evolution:
1. **Extensible architecture** - New tools and hooks can be added without modifying core code
2. **Plugin manifest** - YAML/JSON files define plugin metadata (name, version, tools, hooks)
3. **Plugin discovery** - Automatically discover plugins from configured directories
4. **Enable/disable** - Runtime control over which plugins are active
5. **Tool registration** - Dynamically add tools from plugin manifests
6. **Hook registration** - Dynamically add hooks for validation/safety

Implementation details:
- `PluginManager` class with discoverPlugins(), loadPlugin(), initialize()
- `PluginManifest` interface with name, version, description, tools, hooks
- `LoadedPlugin` interface with manifest, path, enabled, tools, hooks, errors
- `plugins` tool with actions: list, stats, enable, disable, details, refresh, dirs
- Support for multiple plugin directories
- Placeholder tool creation when no handler is specified

**Trigger:** When wanting to extend Paimon with new capabilities without modifying core code

**Reuse Rule:** Create a plugin directory with plugin.json or plugin.yaml manifest. Use `plugins({action: 'list'})` to view loaded plugins, `plugins({action: 'enable', name: 'plugin-name'})` to enable.

**Priority:** High

---

### 2026-03-31: Model Roulette for Performance Improvement (Mini-SWE-Agent Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 20 - Model Roulette for random model switching

**Insight:** Mini-SWE-Agent research shows "Randomly switching between GPT-5 and Sonnet 4 boosts performance". Model roulette provides significant benefits:
1. **Model diversity** - Different models have different strengths; switching improves overall success rate
2. **Multiple strategies** - random, weighted (by model weight), round-robin (cycle through)
3. **Statistics tracking** - Track which models perform best for future optimization
4. **Seeded experiments** - Reproducible selection with fixed seed for RL/fine-tuning

Implementation details:
- `ModelRoulette` class with random, weighted, round-robin strategies
- `RouletteModel` interface with id, weight, baseUrl, apiKey
- `RouletteStats` interface for tracking successes, failures, response times
- `switchEvery` config to control how often models switch
- `seed` config for reproducible experiments
- Integration with MinimalAgent via `roulette` config option
- Tool: `roulette({action: 'select'})` to switch, `roulette({action: 'stats'})` for statistics

**Trigger:** When wanting to improve agent performance through model diversity

**Reuse Rule:** Configure roulette in MinimalAgentConfig: `roulette: { models: [{id: 'model-a'}, {id: 'model-b'}], strategy: 'random' }`. Use `switchRouletteModel()` before each turn.

**Priority:** High

---

### 2026-03-31: Auto-Commit Message Generation (Aider Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 19 - Auto-generate conventional commit messages from git diffs

**Insight:** Aider's commit message generation provides significant benefits for self-evolution:
1. **Conventional commit format** - Structured messages (feat, fix, refactor, etc.) improve git history readability
2. **Diff analysis** - Parse git diffs to extract files, lines added/removed, and content patterns
3. **Type detection** - Detect commit type from diff patterns (test files → test, markdown → docs, etc.)
4. **LLM generation** - Optional LLM-based generation for better messages
5. **Rule-based fallback** - Simple rules work well without LLM overhead

Implementation details:
- `CommitMessageGenerator` class with diff parsing and analysis
- `commitMsg` tool with generate, preview, stats, commit actions
- Support for staged, unstaged, and all diff types
- Scope detection from file paths
- Token budget management for large diffs

**Trigger:** When needing to generate commit messages during self-evolution

**Reuse Rule:** Use `commitMsg({action: 'generate'})` to generate commit messages. Use `commitMsg({action: 'preview'})` to preview before committing.

**Priority:** High

---

### 2026-03-31: Evolution Pattern Mining for Task Selection

**Type:** capability

**Context:** Implementing ROADMAP Phase 17 - Mining successful patterns from session history

**Insight:** Mining evolution patterns from MEMORY.md scorecard provides significant benefits:
1. **Skill combination patterns** - Identify skills that work well together (e.g., evolve + research = 95% success)
2. **Task type patterns** - Track success rates by task type (capability = 97% vs reliability = 3%)
3. **Time patterns** - Identify optimal time ranges for tasks (tasks under 10min = higher success)
4. **Error avoidance patterns** - Find approaches that avoid common errors
5. **Recommendation engine** - Predict optimal approach for new tasks based on historical patterns

Implementation details:
- `PatternMiner` class parses MEMORY.md scorecard table
- `EvolutionPattern` interface with type, characteristics, successRate, confidence
- Pattern types: skill-combination, task-type-success, time-pattern, error-avoidance
- `getRecommendations()` returns ranked recommendations for task context
- `getStats()` provides pattern statistics
- Persistence to data/evolution-patterns.json
- Tool: `patternMiner({action: 'recommend', taskType: 'capability'})`

**Trigger:** When selecting tasks or needing to predict optimal approach

**Reuse Rule:** Use `patternMiner({action: 'recommend', taskType: 'capability'})` before task selection. Use `patternMiner({action: 'stats'})` to view pattern analysis.

**Priority:** High

---

### 2026-03-31: Error Pattern Learning for Self-Evolution

**Type:** capability

**Context:** Implementing ROADMAP Phase 16 - Error pattern learning for automatic solutions

**Insight:** Learning from error patterns across sessions provides significant benefits:
1. **Pattern recognition** - Regex-based matching finds known error patterns
2. **Solution suggestions** - Confidence-based recommendations for fixing errors
3. **Cross-session learning** - Patterns persist to data/error-patterns.json
4. **Error classification** - Automatic detection of TypeScript, test, lint, runtime errors
5. **Incremental improvement** - Confidence increases with each occurrence

Implementation details:
- `ErrorPattern` interface with type, pattern, description, solution, confidence, occurrences
- Default patterns for common TypeScript, test, lint, runtime errors
- `detectErrorType()` classifies error by category
- `learnFromError()` extracts and generalizes patterns
- `matchError()` finds known solutions
- `getSuggestions()` returns ranked solutions
- Persistence to data/error-patterns.json

**Trigger:** When encountering errors during self-evolution

**Reuse Rule:** Use `errorPatterns({action: 'match', error: 'message'})` to find solutions. Use `errorPatterns({action: 'learn', error: 'message', solution: 'fix'})` to learn new patterns.

**Priority:** High

---

### 2026-03-30: Theory-of-Mind Module from OpenHands ToM-SWE

**Type:** capability

**Context:** Implementing ROADMAP Phase 10 - Theory-of-Mind module inspired by OpenHands' ToM-SWE package

**Insight:** OpenHands' ToM-SWE package provides personalized user understanding through:
1. **Three-Tier Memory**: Cleaned sessions → Session analyses → User profiles
2. **Agent Consultation**: Personalized guidance based on user preferences and working styles
3. **Session Analysis**: Extract insights from past sessions to improve future iterations
4. **Preference Tracking**: Track skills that work, common errors, and average iteration times
5. **Confidence Scoring**: Calculate confidence based on analysis depth

**Trigger:** When needing to understand user intent or provide personalized guidance during self-evolution

**Reuse Rule:** Use `tom({action: 'consult'})` before complex tasks to get personalized recommendations. Use `tom({action: 'analyze', sessionData: {...}})` after each iteration to build user profile.

**Priority:** High

---

### 2026-03-30: Loop Detection and Recovery from OpenHands

**Type:** capability

**Context:** Implementing ROADMAP Phase 8 - stuck detection and recovery inspired by OpenHands' StuckDetector

**Insight:** OpenHands has a sophisticated StuckDetector that detects multiple loop types and provides recovery options:
1. **Loop types detected**: repeated_action (same tool called 3+ times), same_error (same error 3+ times), no_progress (similar content 5+ times)
2. **Recovery options**: restart before loop (preserves earlier progress), restart with last message (try different approach), quit task
3. **Memory truncation**: Can truncate conversation history to recovery points to remove loop context
4. **Autonomous operation**: Critical for long-running sessions without human intervention

**Trigger:** When agent appears stuck in a loop during autonomous evolution

**Reuse Rule:** Call `stuck({action: 'check'})` periodically during long tasks. If stuck, use `stuck({action: 'recover', recoveryOption: N})` to recover.

**Priority:** High

---

### 2026-03-30: Specialized Subagents for Self-Evolution

**Type:** capability

**Context:** Implementing ROADMAP Phase 7 - specialized skills for exploration, planning, and review

**Insight:** Specialized subagents (explore-code, plan-architecture, review-changes) improve self-evolution quality by providing dedicated roles for each phase:
1. **explore-code** - Deep codebase exploration before changes reduces blind edits
2. **plan-architecture** - Architecture planning before coding reduces rework
3. **review-changes** - Code review with confidence scoring catches bugs early
4. Each skill should be invoked at specific workflow stages (Context → Planning → Assessment)
5. Confidence-based scoring (≥80 threshold) filters false positives from real issues

**Trigger:** When making non-trivial code changes requiring multiple files

**Reuse Rule:** Always invoke explore-code before complex changes, plan-architecture before implementation, review-changes before assess.

**Priority:** High

---

### 2026-03-30: Hook System for Pre-Tool Validation

**Type:** capability

**Context:** Implementing hook system inspired by Claude Code's hooks (PreToolUse, SessionStart, Stop)

**Insight:** Hook systems provide proactive safety by intercepting tool calls before execution:
1. **PreToolUse hooks** - Check parameters before tool execution, can block or warn
2. **Priority-based execution** - Higher priority hooks run first, enabling layered security
3. **Default security hooks** - Block dangerous patterns (rm -rf /, curl | bash) and protected paths
4. **Dynamic management** - Hooks can be enabled/disabled at runtime via hook tool
5. **Wrapped tool execution** - All tools wrapped to check hooks before execution

**Trigger:** When implementing safety or validation mechanisms

**Reuse Rule:** Wrap tool execution with PreToolUse hooks. Use priority 100 for critical security, 90 for important validations, 80 for warnings.

**Priority:** High

---

### 2026-03-30: Confidence-Based Scoring for Error Filtering

**Type:** capability

**Context:** Implementing confidence-based scoring for the assess tool after researching Claude Code's code-review plugin

**Insight:** Confidence scoring (0-100) with threshold filtering dramatically improves error pattern detection quality:
1. **Error type determines confidence** - TypeScript errors with known codes (95%), test failures (80%), lint errors (85-95%)
2. **Default threshold of 80** filters out most false positives while keeping real issues
3. **Confidence display** helps users understand reliability of each suggestion
4. **Threshold adjustment** allows flexibility for different use cases

**Trigger:** When implementing error detection or recommendation systems

**Reuse Rule:** Always add confidence scores to error patterns. Use 80 as default threshold. Show confidence percentages in output.

**Priority:** High

---

### 2026-03-30: Evolution Value Scoring

**Type:** capability

**Context:** Implementing Issue #20 - prioritize self-evolution capability over local infrastructure

**Insight:** Task selection should not be simple priority order (issues → ROADMAP → research). Instead:
1. Score each candidate task on evolution value
2. Consider: future iteration success rate, failure rate reduction, memory quality improvement
3. Explicitly output why this task was selected
4. Track task types and prefer `capability` over `reliability` over `feature`

**Trigger:** When selecting next task to implement

**Reuse Rule:** Before any task selection:
1. List all candidate tasks (issues + ROADMAP items)
2. Classify each as capability/reliability/feature
3. Score each on evolution value (1-10)
4. Select highest-scoring capability task
5. If no capability tasks, explain why

**Priority:** High

---

### 2026-03-29: Debug Timeout Pattern for Async Operations

**Type:** reliability

**Context:** CLI was hanging indefinitely with no error message

**Insight:** When dealing with async operations (API calls, event-based systems):
1. **Always add a timeout** - Never let a Promise hang forever
2. **Log events for debugging** - Track when operations start/end, what events fire
3. **Clear timeouts on completion** - Prevent memory leaks and false errors
4. **Use environment variables for debug mode** - PAIMON_DEBUG=true for troubleshooting

**Code pattern:**
```typescript
const run = (prompt: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 60000);
    
    agent.subscribe((event) => {
      if (event.type === 'agent_end') {
        clearTimeout(timeout);
        resolve(outputs.join(''));
      }
    });
    
    agent.prompt(prompt).catch(error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};
```

**Trigger:** When creating any async function that returns Promise

**Reuse Rule:** Always wrap event-based Promises with timeout + cleanup

**Priority:** High

---

### 2026-03-29: Claude Code Best Practices Study

**Type:** capability

**Context:** Researching Claude Code (Anthropic's CLI agent) to adopt best practices

**Insight:** Claude Code uses several powerful patterns:
1. **Structured frontmatter** - Agents have name, description, tools metadata at top
2. **Hooks system** - PreToolUse, SessionStart, Stop hooks for behavior modification
3. **Security reminders** - Pattern matching to warn about dangerous code before it's written
4. **Context injection** - Using !\`command\` to inject dynamic context in prompts
5. **Specialized agents** - Code explorer, architect, reviewer with focused roles
6. **Phased workflows** - Clear stages with specific tasks

**Trigger:** When improving agent capabilities or workflow

**Reuse Rule:** Study successful agents and adapt their patterns. Hooks and security reminders are high-value.

**Action:**
- Added structured frontmatter to system prompt
- Added Security Awareness section
- Added Workflow Stages section with clear phases
- Added Best Practices section from Claude Code patterns
- Keep minimal, focused changes

**Priority:** High

---

### 2026-03-30: Competitor Research Patterns for Self-Evolution

**Type:** capability

**Context:** Researched Claude Code and Cursor to identify improvements for Paimon

**Insight:** Key patterns from successful AI coding agents:
1. **Ralph Wiggum Pattern** — Claude Code uses Stop hooks to intercept exit attempts and continue iteration, enabling autonomous error recovery loops
2. **Checkpoints** — Cursor saves snapshots during agent sessions for safe rollback
3. **Specialized Agents** — Feature development benefits from code-explorer, code-architect, code-reviewer roles
4. **Parallel Launching** — Multiple agents run in parallel for exploration, architecture, and review
5. **Structured Workflows** — Clear phases (Discovery → Exploration → Clarifying → Architecture → Implementation → Review → Summary)

**Trigger:** When planning major capability improvements

**Reuse Rule:** Research competitors before implementing major features. Ralph Wiggum pattern enables autonomous iteration.

**Action:**
- Added ROADMAP Phase 5 with advanced capabilities
- Created skills/evolve/SKILL.md for structured self-evolution
- Error recovery loops should be implemented as core capability
- Consider adding checkpoint mechanism for safe rollback

**Priority:** High

---

### 2026-03-29: Check Git State Before Editing

**Type:** reliability

**Context:** Attempted to edit a file that had already been modified in previous sessions

**Insight:** In self-evolution workflows, the codebase may change between sessions:
1. **Always check git status** - Run `git status` and `git log` before starting
2. **Verify file exists** - Read the file to see its current state
3. **Check issue status** - Issues may be closed in previous iterations
4. **Don't assume file state** - The codebase evolves, so verify before editing

**Pattern:**
```bash
# Check state before working
git status --porcelain  # See uncommitted changes
git log --oneline -5    # See recent commits
gh issue list --state open  # See open issues
gh issue view <number>  # Check specific issue
```

**Trigger:** Before starting any implementation work

**Reuse Rule:** Always run git status && git log && gh issue list before editing files

**Priority:** Medium

---

### 2026-03-30: Issue Closure Verification

**Type:** reliability

**Context:** Issue #11 was closed but ROADMAP showed it as incomplete - no actual implementation existed

**Insight:** When checking issues:
1. **Verify implementation exists** - Check for files mentioned in issue spec
2. **Don't trust issue state alone** - ROADMAP may show incomplete items
3. **Re-implement if needed** - Just because issue is closed doesn't mean it's done

**Pattern:**
```bash
# Before working on "completed" ROADMAP items
ls src/  # Check if implementation files exist
git log --oneline | grep -i <feature>  # Check if commits exist
gh issue view <number>  # Check issue status and comments
```

**Trigger:** When an issue or ROADMAP item appears "complete"

**Reuse Rule:** Verify implementation exists with file checks before assuming something is done

**Priority:** Medium

---

### 2026-03-30: Skill Effectiveness Tracking

**Type:** capability

**Context:** Adding skill analytics to track which skills lead to successful outcomes

**Insight:** Tracking which skills are actively used during iterations enables:
1. **Skill effectiveness analysis** - Identify which skills improve success rates
2. **Better skill selection** - Future iterations can prioritize effective skills
3. **Skill audit trail** - JSONL logging provides detailed skill usage history
4. **Scorecard enhancement** - "Skills Used" column tracks skill-to-outcome mapping

**Trigger:** When evaluating skill effectiveness or improving skill selection

**Reuse Rule:** Log skills used in each iteration to MEMORY.md scorecard. Analyze skill effectiveness metrics to improve future skill matching.

**Priority:** High

---

### 2026-03-30: Repo Map for Codebase Understanding

**Type:** capability

**Context:** Implementing ROADMAP Phase 9 - Repo Map inspired by Aider's RepoMap

**Insight:** Aider's RepoMap provides a structured view of codebase definitions without reading every file:
1. **Definition extraction** - Regex-based parsing for functions, classes, interfaces, types
2. **File importance scoring** - PageRank-like algorithm prioritizes important files
3. **Token budget management** - Fits map within context limits with truncation
4. **Import reference tracking** - Shows dependencies between files
5. **Simpler than tree-sitter** - Regex parsing is sufficient for TypeScript/JavaScript

**Trigger:** When needing to understand codebase structure quickly

**Reuse Rule:** Use `repomap({})` before complex evolution tasks. Generate map at session start for context.

**Priority:** High

---

### 2026-03-31: Modular Architecture Foundation

**Type:** capability

**Context:** Implementing Issue #22 - Split agent.ts into modular architecture

**Insight:** Extracting tools to separate modules provides clear benefits:
1. **Reduced context bloat** - Each tool file is smaller and easier to understand
2. **Better organization** - Tools grouped by category (file, search, http)
3. **Incremental extraction** - Can extract tools progressively without breaking changes
4. **Preserved functionality** - All tests pass with extracted modules

Implementation details:
- `src/truncate.ts` - Utility for truncating tool output (20 lines)
- `src/tools/file-tools.ts` - bash, read, write, edit tools (158 lines)
- `src/tools/search-tools.ts` - glob, grep, find, ls tools (186 lines)
- `src/tools/http-tool.ts` - http tool (117 lines)
- `src/tools/index.ts` - Tool registry and re-exports (57 lines)
- Total extracted: 538 lines (from agent.ts which is still 2587 lines with inline tools)

**Trigger:** When agent.ts grows too large and causes context overflow

**Reuse Rule:** Create tools in separate modules, import via tools/index.ts. Extract utilities first (truncate), then file tools, then search tools, then meta tools.

**Priority:** High

---

### 2026-03-31: Linear History for Debugging/Fine-tuning

**Type:** capability

**Context:** Implementing ROADMAP Phase 11 - Linear history option for main agent (Mini-SWE-Agent pattern)

**Insight:** Linear message history provides significant benefits for debugging and fine-tuning:
1. **Append-only tracking** - Every user/assistant interaction is stored chronologically
2. **Easy export** - JSON format for fine-tuning datasets
3. **Session persistence** - save/load history for long-running sessions
4. **Minimal overhead** - Just an array push per message
5. **CLI flag** - `--linear` or `-l` enables this mode

Implementation details:
- `LinearMessage` type in types.ts: `{ role, content, timestamp }`
- `config.linearHistory: boolean` option
- Methods: `getHistory()`, `getHistoryJson()`, `saveHistory()`, `loadHistory()`, `clearHistory()`
- Methods only available when `linearHistory: true`

**Trigger:** When needing to debug agent behavior or prepare fine-tuning data

**Reuse Rule:** Use `--linear` flag when running long sessions or when debugging agent behavior. Export history with `getHistoryJson()` for analysis.

**Priority:** High

---

### 2026-03-31: Minimal Agent Mode Implementation

**Type:** capability

**Context:** Implementing ROADMAP Phase 11 - Minimal agent mode inspired by Mini-SWE-Agent (Princeton/Stanford)

**Insight:** MinimalAgent class with only bash tool achieves radical simplification:
1. **Bash-only design** - Shell commands can do everything: read files (cat), write files (echo >), search (grep), etc. No need for specialized file tools.
2. **Linear message history** - Append-only history makes debugging and fine-tuning easier. Every interaction is just added to the messages array.
3. **Independent subprocess execution** - execSync for each command, no stateful shell session. Makes sandboxing trivial (just switch execSync with docker exec).
4. **Template-based system prompt** - Easy to customize with custom system prompts via setSystemPrompt() method.
5. **History export/import** - getHistoryJson(), saveHistory(), loadHistory() enable session persistence and fine-tuning data export.

Implementation details:
- ~150 lines for full MinimalAgent class (still very compact)
- CLI flag: `--minimal` or `-m` activates minimal mode
- Full linear history tracking with export/import capability
- Compatible with existing session management

**Trigger:** When a simpler baseline agent is needed for debugging, testing, or fine-tuning experiments

**Reuse Rule:** Use `--minimal` flag to activate minimal mode. The agent will only use bash commands, making it simpler and easier to debug. Use `getHistory()` to export message history for analysis.

**Priority:** High

---

### 2026-03-31: Trajectory Viewer Pattern (Mini-SWE-Agent)

**Type:** capability

**Context:** Implementing ROADMAP Phase 15 - Trajectory viewer inspired by Mini-SWE-Agent's trajectory browser

**Insight:** Mini-SWE-Agent's trajectory browser provides critical debugging and fine-tuning capabilities:
1. **Trajectory visualization** - Step-by-step breakdown of agent execution history
2. **Pattern analysis** - Success rates, error rates, tool usage statistics
3. **Format compatibility** - Mini-SWE-Agent format export enables compatibility with existing tooling
4. **Fine-tuning preparation** - Trajectories can be exported for RL/fine-tuning datasets
5. **Debugging support** - View exactly what the agent did at each step

**Trigger:** When needing to debug agent behavior or prepare fine-tuning data

**Reuse Rule:** Use `trajectory({action: 'list'})` to find trajectories, `trajectory({action: 'view', name: '...'})` to inspect them, and `trajectory({action: 'analyze'})` to find patterns.

**Priority:** High

---

### 2026-03-31: Self-Authorship Tracking (Aider Singularity Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 13 - Self-authorship tracking inspired by Aider's 88% Singularity metric

**Insight:** Aider's "Singularity" metric (88% of code written by itself) provides critical self-awareness for self-evolution:
1. **Self-authorship tracking** - Know which code the agent authored vs humans via git commit analysis
2. **Bot author detection** - Recognize `paimon[bot]` commits as self-authored
3. **File-level analysis** - Git blame shows line-level authorship for individual files
4. **Confidence decisions** - Be more confident modifying bot-authored code (>50% Paimon-authored)
5. **Evolution progress tracking** - Track how much the agent has grown itself over time
6. **Author breakdown** - See contribution percentages by each developer

**Trigger:** When needing to understand code origin before modifications, or tracking evolution progress

**Reuse Rule:** Use `singularity({action: 'report'})` to get full stats. Use `singularity({action: 'check', file: 'path'})` before modifying files. Be more confident with bot-authored code.

**Priority:** High

---

### 2026-03-31: Mini-SWE-Agent Simplicity Patterns

**Type:** capability

**Context:** Researching Mini-SWE-Agent (Princeton/Stanford team) after all ROADMAP phases completed

**Insight:** Mini-SWE-Agent achieves 74% on SWE-bench verified with just 100 lines of Python:
1. **No special tools** - Only bash commands, no tool-calling interface needed. The LM uses shell to its full potential instead of custom tools.
2. **Linear message history** - Every step just appends to messages. No complex history processing. Great for debugging and fine-tuning.
3. **Independent subprocess execution** - `subprocess.run` for each action, no stateful shell session. This makes sandboxing trivial (just switch `subprocess.run` with `docker exec`).
4. **Template-based prompts** - Jinja templates for system and instance messages, easy to customize.
5. **Simplicity is powerful** - "What if our agent was 100x simpler, and still worked nearly as well?" - radical simplification approach.

Key architecture points:
- `DefaultAgent` class: `run()` → `step()` → `query()` + `execute_actions()` loop
- Messages are the trajectory - no separation between messages and history
- Works with any model (doesn't require tool-calling interface)
- Perfect baseline for fine-tuning and RL

**Trigger:** When considering agent architecture simplification or evaluating tool complexity

**Reuse Rule:** Consider minimal agent mode for simpler tasks. Evaluate if current tool complexity is necessary. Use linear history for easier debugging.

**Priority:** High

---

## Memory Format

Each learning entry should have:
- **Type:** capability | reliability | feature
- **Context:** What problem was being solved
- **Insight:** What was learned
- **Trigger:** When this learning should be applied
- **Reuse Rule:** How to apply this in future
- **Priority:** High | Medium | Low
- **Action:** (optional) What was done

---

## Quick Reference

### High Priority Learnings
1. Evolution Value Scoring - Score tasks before selection
2. Timeout Pattern - Always wrap async with timeout
3. Claude Code Patterns - Study and adapt successful agents
4. Competitor Research - Ralph Wiggum, Checkpoints, Specialized Agents

### Task Selection Algorithm
```
1. List candidates (open issues + ROADMAP incomplete items)
2. Classify each: capability | reliability | feature
3. Score each on evolution value (1-10):
   - Future iteration success improvement: +3
   - Failure rate reduction: +2
   - Memory quality improvement: +2
   - Implementation cost: -1 (complex) to -3 (very complex)
4. Select highest-scoring capability task
5. If no capability tasks, select highest-scoring reliability
6. Explain selection in output
```

### When to Use MEMORY.md
- **Before task selection** - Review relevant learnings, check priority
- **After failure** - Check for similar patterns, learn from past
- **When stuck** - Search for trigger conditions, find applicable rules
- **After success** - Add new learning if pattern is reusable

---

### 2026-03-30: Verification Before Commit

**Type:** reliability

**Context:** Iteration 1 failed verification

**Insight:** 
- Build: PASS
- Tests: PASS
- Error: Error: 400 <400> InternalError.Algo.InvalidParameter: Range of input length should be [1, 202745]

**Trigger:** Before committing any changes

**Reuse Rule:** Always run `npm run build && npm test -- --run` before committing. Use assess({}) tool for verification.

**Priority:** High

