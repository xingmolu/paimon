# Memory

## Recent Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Skills Used |
|------|-----------|------------------|------|-----------|--------|---------|-------------|
| 2026-05-26 | capability | Refine MEMORY-backed predictiveErrorPrevention ranking so unresolved failures and guarded recoveries outrank generic clean wins, and fix the mixed-signal optimization dashboard assertion | ~30m | ✅ | test | Yes | evolve, plan-architecture, review-changes |
| 2026-05-26 | capability | Refine MEMORY-backed errorPatterns ranking so recovered sessions with actionable guardrails outrank clean wins and unresolved review-only failures gain prevention notes | ~15m | ✅ | test | No | evolve, plan-architecture, review-changes |
| 2026-05-25 | reliability | Fix hookify rule lifecycle stats and persisted file cleanup so rule management stays trustworthy across sessions | ~15m | ✅ | lint | No | evolve, plan-architecture, review-changes |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | Yes | systematic-debugging |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | Yes | evolve, review-changes |

## Learnings

- Proactive MEMORY-backed predictions are more useful when unresolved failures surface first, recovered sessions with explicit review guardrails come next, and generic clean wins stay lower priority.
- Mixed-signal comparison tests should assert on any meaningful non-zero delta, not assume a specific direction for non-time signals when historical averages can match exactly.
