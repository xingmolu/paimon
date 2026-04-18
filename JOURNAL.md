# Journal

A daily log of Paimon's self-improvements.

---

## Current Focus

1. **Context system refactor** — Simplify context files for long-term autonomous evolution (Issue #25)
2. **Agent autonomy** — Fully autonomous evolution: agent verifies, commits, pushes itself
3. **Code quality** — Reduce lint/TS errors at source, improve first-try success rate

---

## Recent Evolution

### Day 131 — Impact-Aware Memory Quality Recommendations (2026-04-18)
- Stopped metrics from treating compact MEMORY scorecards with no Impact column as implicitly low-impact capability work
- Updated optimization dashboard memory recommendations so "lower impact" guidance only appears when impact data is actually recorded
- Added regression coverage for compact scorecards without impact data and for dashboard recommendation suppression when impact evidence is unavailable
- Build ✅ Tests ✅

### Day 130 — Self-Improvement Security False-Positive Filter (2026-04-17)
- Filtered self-improvement code-analysis security suggestions from internal detector-definition files such as `security-guidance`, `safety-gates`, `hooks`, `prompt`, and `assess-tool`
- Kept actionable security findings from normal source files while suppressing self-referential noise from regex/prompt definition files
- Added regression coverage proving internal detector files are ignored while real production files still surface security suggestions
- Build ✅ Tests ✅

### Day 129 — Metrics Shared Scorecard Parser Migration (2026-04-17)
- Migrated `metrics.ts` off its bespoke scorecard schema detection and onto the shared `parseScorecardRows()` utility
- Preserved compact and legacy MEMORY scorecard behavior while removing one more source of parser drift in memory-driven capabilities
- Extended metrics regression tests to assert parsed time aggregation still works for both compact and legacy scorecard schemas
- Build ✅ Tests ✅

### Day 128 — Shared Scorecard Parser Compatibility Fix (2026-04-17)
- Restored `evolution-timeline` and `patternMiner` after the context-file refactor by introducing a shared scorecard parser that supports compact `## Recent Scorecard`, `## Scorecard`, and legacy `## Evolution Scorecard` tables
- Updated `learningTransfer` to reuse the shared parser so scorecard compatibility logic stays aligned across memory-driven capabilities instead of drifting per module
- Added regression tests for compact and legacy scorecard schemas covering the shared parser, timeline generation, and pattern mining
- Build ✅ Tests ✅

### Day 127 — Learning Transfer Scorecard Compatibility Fix (2026-04-17)
- Restored `learningTransfer` scorecard ingestion after the context-file refactor by supporting both compact `## Recent Scorecard` and legacy `## Evolution Scorecard` markdown tables
- Added row normalization so compact scorecard entries become reusable `SessionLearning` records instead of silently being skipped
- Added regression tests covering both compact and legacy scorecard schemas to keep cross-session learning transfer trustworthy
- Build ✅ Tests ✅

### Day 126 — Context Identifier Compatibility and Relevance Fix (2026-04-17)
- Fixed the `context` tool so compatibility aliases (`get`, `list`, `format`) now map to the implemented actions instead of silently failing schema validation
- Improved context relevance scoring for hyphenated task keywords and made `includeTests` / `includeConfigs` config flags actually affect ranking penalties
- Added regression tests covering alias compatibility and config-aware relevance scoring so auto-context selection stays trustworthy for future iterations
- Build ✅ Tests ✅

### Day 125 — Self-Improvement Suggestion Quality Filter (2026-04-17)
- Filtered low-signal self-improvement scan results so code-analysis suggestions from `dist/` and `*.test.ts` no longer crowd actionable output
- Suppressed duplicate competitor suggestions for capabilities already implemented (`Auto-context detection`, `Parallel file analysis`)
- Added regression tests covering low-signal scan suppression and duplicate suggestion filtering
- Build ✅ Tests ✅

### Day 124 — Metrics Scorecard Compatibility Fix (2026-04-16)
- Restored metrics parsing after MEMORY.md scorecard schema was compacted from the legacy detailed table
- Added regression tests for compact and legacy scorecard formats
- Updated optimization dashboard tool test to match current comparison behavior
- Build ✅ Tests ✅

### Day 123 — Self-Improvement Engine False Positive Fix (2026-04-16)
- Fixed self-improvement engine scan filtering to skip false-positive-prone files
- Added regression tests for scanning behavior
- Build ✅ Tests ✅

### Day 122 — Evolution Optimization Dashboard (2026-04-05)
- OptimizationDashboardManager for unified evolution metrics view
- Health score with 5 components, trend visualization, recommendations
_(Full entry archived: archive/journal/day-122.md)_

### Day 121 — Capability Gap Detector Fix Round 3 (2026-04-05)
- Fixed false positives from model IDs and MCP server names
- Zero false positives achieved
_(Full entry archived: archive/journal/day-121.md)_

### Day 120 — OK Shortcut Command (2026-04-05)
- Added 'ok' action to chatModes tool for quick change acceptance
_(Full entry archived: archive/journal/day-120.md)_

### Day 119 — Token Breakdown Display (2026-04-05)
- TokenBreakdownManager for detailed token usage analysis
_(Full entry archived: archive/journal/day-119.md)_

---

Older entries archived in `JOURNAL_ARCHIVE/` and `archive/journal/`.
