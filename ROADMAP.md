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

## Phase 11: Minimal Agent Mode (Mini-SWE-Agent Pattern)
- [x] Minimal agent mode — Optional simpler agent with only bash tool (inspired by Mini-SWE-Agent)
- [x] Linear history option — Append-only message history for easier debugging/fine-tuning
- [x] Independent execution — subprocess.run for each action instead of stateful shell (already uses execSync)
- [x] Template-based prompts — Jinja-style templates with {{ variable }} syntax for easier customization
- [x] Baseline mode — Minimal mode for fine-tuning and RL experiments

## Phase 12: Modular Architecture (Issue #22)
- [x] Extract truncateToolOutput to src/truncate.ts
- [x] Create src/tools/ directory structure
- [x] Extract file tools (bash, read, write, edit) to src/tools/file-tools.ts
- [x] Extract search tools (glob, grep, find, ls) to src/tools/search-tools.ts
- [x] Extract http tool to src/tools/http-tool.ts
- [x] Create src/tools/index.ts to re-export tools
- [x] Extract meta tools (plan, assess, reflect, checkpoint, parallel, hook) to separate files
- [x] Extract module tools (stuck, repomap, tom) to separate files
- [x] Update agent.ts to use extracted tools (remove inline definitions)
- [x] Extract createWrappedTools to src/wrap.ts
- [x] Extract buildSystemPrompt to src/prompt.ts
- [x] Slim down src/agent.ts to under 300 lines
- [x] All tests pass with modular architecture

## Phase 13: Self-Authorship Tracking (Aider Singularity Pattern)
- [x] Singularity module — Track self-authorship percentage via git commit analysis
- [x] singularity tool — Tool for tracking how much code was written by Paimon vs humans
- [x] Bot author detection — Recognize paimon[bot] commits as self-authored
- [x] File-level analysis — Analyze individual files for bot vs human authorship
- [x] Author breakdown — Track contributions by each author

## Phase 14: RAG Context Enrichment (PR-Agent Pattern)
- [x] RagModule — Keyword-based semantic search over past sessions, learnings, and reflections
- [x] rag tool — Tool for searching and enriching context before tasks
- [x] TF-IDF scoring — Term frequency-inverse document frequency for relevance ranking
- [x] Inverted index — Efficient keyword search with term frequencies
- [x] Context enrichment — Get relevant past context for new tasks

## Phase 15: Trajectory Viewer (Mini-SWE-Agent Pattern)
- [x] TrajectoryViewer module — View and analyze agent execution trajectories
- [x] trajectory tool — Tool for trajectory viewing and analysis
- [x] Trajectory listing — List saved trajectories with metadata preview
- [x] Trajectory analysis — Pattern analysis (success rate, error rate, tool usage)
- [x] Mini-SWE-Agent format — Export compatibility with Mini-SWE-Agent trajectory format

## Phase 16: Error Pattern Learning
- [x] ErrorPatternLearner module — Learn from error patterns across sessions
- [x] errorPatterns tool — Tool for pattern matching and suggestions
- [x] Pattern generalization — Extract regex patterns from error messages
- [x] Solution suggestions — Confidence-based solution recommendations
- [x] Pattern persistence — Save learned patterns to data/error-patterns.json

## Phase 17: Evolution Pattern Mining
- [x] PatternMiner module — Mine successful patterns from session history
- [x] patternMiner tool — Tool for pattern recommendations and analysis
- [x] Skill combination patterns — Identify skills that work well together
- [x] Task type patterns — Track success rates by task type
- [x] Time patterns — Identify optimal time ranges for tasks
- [x] Error avoidance patterns — Find approaches that avoid errors

## Phase 18: Bug Report Generator
- [x] BugReportGenerator module — Auto-generate structured bug reports from failed sessions
- [x] bugReport tool — Tool for generating and managing bug reports
- [x] Error type detection — Classify errors by type (typescript, test, lint, runtime)
- [x] Context capture — Capture git state, changed files, recent commits
- [x] Suggested fixes — Generate fix suggestions based on error patterns
- [x] GitHub issue format — Format bug reports as GitHub issues

## Phase 19: Auto-Commit Message Generation (Aider Pattern)
- [x] CommitMessageGenerator module — Generate conventional commit messages from git diffs
- [x] commitMsg tool — Tool for generating commit messages with preview/stats/commit actions
- [x] Conventional commit format — Support feat, fix, refactor, docs, test, chore types
- [x] Diff analysis — Parse git diffs to extract files, lines added/removed
- [x] Type detection — Detect commit type from diff patterns
- [x] LLM generation — Optional LLM-based commit message generation
- [x] Rule-based fallback — Simple rules for commit type detection without LLM

---

Priority is set by GitHub issue reactions. Open an issue to suggest improvements!