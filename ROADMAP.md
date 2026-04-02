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

## Phase 20: Model Roulette (Mini-SWE-Agent Pattern)
- [x] ModelRoulette module — Random model switching for improved performance
- [x] roulette tool — Tool for model selection and statistics
- [x] Multiple strategies — random, weighted, round-robin selection
- [x] Statistics tracking — Track model performance for analysis
- [x] Minimal agent integration — Roulette support in MinimalAgentConfig
- [x] Seeded random — Reproducible experiments with fixed seed

## Phase 21: Plugins/Extensions System (Claude Code/OpenHands Pattern)
- [x] PluginManager module — Plugin discovery, loading, and management
- [x] plugins tool — Tool for listing, enabling, disabling plugins
- [x] Plugin manifest — YAML/JSON manifest for plugin metadata
- [x] Tool plugins — Dynamic tool registration from plugins
- [x] Hook plugins — Dynamic hook registration from plugins
- [x] Plugin directories — Support for multiple plugin directories

## Phase 22: Evolution Metrics Dashboard
- [x] EvolutionMetricsTracker module — Track and visualize evolution metrics over time
- [x] metrics tool — Tool for viewing metrics dashboard and analysis
- [x] Success rate trends — Weekly success rate tracking with trend indicators
- [x] Time metrics — Average time by task type with trend analysis
- [x] Error metrics — Error counts by type with common pattern detection
- [x] Skill effectiveness — Track skill usage counts and success rates
- [x] Capability velocity — Track capabilities per day and high impact percentage

## Phase 23: Task Success Predictor
- [x] TaskSuccessPredictor module — Predict task success before starting
- [x] taskPredictor tool — Tool for task prediction and analysis
- [x] Success probability — Predict success likelihood from historical patterns
- [x] Risk factors — Identify factors that increase failure risk
- [x] Recommended skills — Suggest skills based on historical success
- [x] Similar tasks — Find similar successful and failed tasks
- [x] Prediction stats — Track prediction accuracy over time

## Phase 24: Unified Evolution Intelligence
- [x] EvolutionIntelligence module — Unified system for task selection intelligence
- [x] intelligence tool — Single entry point for all intelligence recommendations
- [x] Task predictor integration — Integrate TaskSuccessPredictor for success predictions
- [x] Pattern miner integration — Integrate PatternMiner for pattern recommendations
- [x] Error patterns integration — Integrate ErrorPatternLearner for error risks
- [x] RAG integration — Integrate RagModule for context enrichment
- [x] Combined confidence scoring — Weighted scoring from all sources
- [x] Unified recommendations — Overall recommendation with risks and opportunities

## Phase 25: SDK/API for Programmatic Evolution
- [x] EvolutionSDK class — Programmatic API for self-evolution
- [x] sdk tool — Tool interface for SDK management
- [x] Session management — startSession(), runIteration(), stopSession()
- [x] Batch evolution — batchEvolve() with callbacks and thresholds
- [x] Intelligence integration — Integrated predictions and recommendations
- [x] Error pattern matching — Match errors against known patterns
- [x] Statistics tracking — Track sessions, iterations, success rates

## Phase 26: SWE-bench Benchmark Integration
- [x] BenchmarkRunner module — Run benchmark tasks for evaluation
- [x] benchmark tool — Tool for running and managing benchmarks
- [x] SWE-bench format — Load tasks from JSON/YAML format
- [x] Task execution — Run evolution tasks on benchmark instances
- [x] Patch validation — Validate generated patches against gold
- [x] Statistics tracking — Track pass rates, time, errors, quality
- [x] Sample tasks — Create sample benchmark tasks for testing

## Phase 27: Self-Modification Safety Gates
- [x] SafetyGateManager module — Proactive dangerous pattern detection
- [x] safetyGates tool — Tool for scanning code changes
- [x] Risk level categorization — Critical, high, medium, low risk patterns
- [x] Pattern categories — Security, breaking, data-loss, workflow, self-modification
- [x] Hook integration — Pre-edit validation with Safety Gates
- [x] Custom patterns — Add/remove custom dangerous patterns
- [x] Statistics tracking — Track scans, blocks, warnings, bypasses

## Phase 28: Multi-Agent Orchestrator (Claude Quickstart Pattern)
- [x] MultiAgentOrchestrator module — Two-agent pattern (initializer + coder)
- [x] multiAgent tool — Tool for orchestrator management
- [x] Initializer agent — Creates task list, plans approach, sets up structure
- [x] Coder agent — Executes tasks, marks completion, persists progress
- [x] Task list management — Create, update, track tasks with dependencies
- [x] Session persistence — Progress saved via JSON and text files
- [x] Statistics tracking — Track sessions, tasks, success rates

## Phase 29: Token/Cost Tracking (Aider Pattern)
- [x] TokenTracker module — Track LLM token usage and costs
- [x] tokenTracking tool — Tool for managing token usage and cost analysis
- [x] Session tracking — Track usage per session with task type
- [x] Cost calculation — Calculate costs with model-specific pricing
- [x] Cache support — Support for cache hits/writes (Anthropic/DeepSeek patterns)
- [x] Statistics aggregation — Cost by model, task type, daily/weekly trends
- [x] Data persistence — Save usage data for analysis

## Phase 30: Context Budget Monitoring Tool
- [x] ContextBudgetManager module — Proactive context window monitoring
- [x] contextBudget tool — Tool for monitoring and managing context usage
- [x] Context health status — Real-time token usage and limits monitoring
- [x] Proactive warnings — Alert before hitting context limits
- [x] Optimization suggestions — Recommend context reduction actions
- [x] Integration with compaction — Work with existing ContextManager
- [x] Statistics tracking — Track context usage patterns over sessions

## Phase 31: Interactive Approval Mode (SWE-agent/Aider Pattern)
- [x] InteractiveApprovalManager module — Approval workflow for risky operations
- [x] interactiveApproval tool — Tool for managing approval requests
- [x] Approval categories — File-delete, workflow, self-modification, security, etc.
- [x] Risk-based decisions — Auto-approve low risk, require approval for high risk
- [x] Protected file detection — Identify files that always require approval
- [x] Batch operations — Approve/reject multiple requests at once
- [x] Statistics tracking — Track approval rates, history, patterns

## Phase 32: SessionStart and Stop Hooks (OpenHands Pattern)
- [x] SessionStart hook type — Hooks executed at session initialization
- [x] Stop hook type — Hooks executed at session termination
- [x] Default SessionStart hooks — Memory load, context budget check, journal check
- [x] Default Stop hooks — Session stats save, token tracking finalize, tool cache save
- [x] Agent integration — executeSessionStartHooks() and executeStopHooks() methods
- [x] CLI integration — Execute hooks in runOnce() and runRepl()
- [x] Tests — Comprehensive tests for SessionStart/Stop hooks

## Phase 33: Ralph Loop Pattern (Claude Code ralph-wiggum Pattern)
- [x] RalphLoopManager module — Manage self-referential iteration loops
- [x] ralphLoop tool — Tool for managing loops (start, status, complete, cancel, list, stats)
- [x] Stop hook interception — Block exit and continue iteration
- [x] Completion promise detection — Unique string signals task completion
- [x] Max iterations safety — Prevent infinite loops
- [x] State persistence — Save loop state to disk for resumption
- [x] Statistics tracking — Track loops, iterations, completion rates
- [x] Tests — Comprehensive tests for Ralph Loop functionality

---

Priority is set by GitHub issue reactions. Open an issue to suggest improvements!