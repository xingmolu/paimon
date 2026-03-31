# Roadmap

Planned improvements for evo.

## Phase 1: Foundation
- [x] TypeScript project setup
- [x] Basic agent working with Bailian API
- [x] Self-evolution script
- [x] GitHub Actions automation

## Phase 2: Self-Improvement
- [x] Self-review capability (run tests)
- [x] Memory persistence (store learnings)
- [x] Issue processing (read, implement, close)

## Phase 3: Intelligence
- [x] Better planning (use ROADMAP.md)
- [x] Learning from failures
- [x] Code quality checks

## Phase 4: Growth
- [x] More tools (grep, find, ls for code search) — Issue #8
- [x] Progressive skill loading — Issue #7
- [x] Context file loading (AGENTS.md, CLAUDE.md) — Issue #10
- [x] Web search, API calls — Added http tool
- [x] Multi-step reasoning — Added plan tool for step-by-step task execution
- [x] Context compaction for long sessions — Issue #9
- [x] Session persistence and resume — Issue #11

## Phase 5: Advanced Capabilities
- [x] Error recovery loops — Iterative self-correction when builds/tests fail
- [x] Self-assessment — Evaluate own changes before committing
- [x] Reflection on failures — Extract lessons and update MEMORY.md automatically
- [x] Checkpoints — Save snapshots during evolution for safe rollback
- [x] Parallel task execution — Run multiple independent tasks concurrently

## Phase 6: Safety & Validation
- [x] Hook system for pre-tool validation — Inspired by Claude Code's PreToolUse hooks

## Phase 7: Specialized Agents
- [x] explore-code skill — Deep codebase exploration before making changes (inspired by Claude Code's code-explorer)
- [x] plan-architecture skill — Architecture planning before implementation (inspired by Claude Code's code-architect)
- [x] review-changes skill — Code review with confidence-based scoring (inspired by Claude Code's code-reviewer)

## Phase 8: Loop Detection & Recovery (OpenHands Pattern)
- [x] Stuck detector — Detect when agent is looping (repeated actions, same errors)
- [x] Loop recovery — Multiple recovery options: restart before loop, restart with last instruction, quit
- [x] Memory truncation — Truncate history to recovery points

## Phase 9: Repo Map (Aider Pattern)
- [x] RepoMap module — Generate structured map of codebase definitions
- [x] repomap tool — Tool for generating repo maps with token budget
- [x] Definition extraction — Extract functions, classes, interfaces, types from TypeScript/JavaScript
- [x] File importance scoring — PageRank-like algorithm for ranking files by importance
- [x] Token budget management — Fit map within context limits

## Phase 10: Theory-of-Mind (OpenHands ToM-SWE Pattern)
- [x] TomModule — Three-Tier Memory system (sessions → analyses → profiles)
- [x] tom tool — Consultation for personalized guidance based on user understanding
- [x] User profile tracking — Track evolution preferences, working styles, and patterns
- [x] Intent understanding — Reduce rework rate by understanding user intent better
- [x] Session analysis — Extract insights from past evolution sessions

---

Priority is set by GitHub issue reactions. Open an issue to suggest improvements!