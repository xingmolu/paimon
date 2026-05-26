# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors | Skills Used |
|------|------|-------------|------|--------|--------|-------------|
| 2026-05-26 | capability | Refine MEMORY-backed errorPatterns ranking so recovered sessions with actionable guardrails outrank clean wins and unresolved review-only failures gain prevention notes | ~15m | ✅ | test | evolve, plan-architecture, review-changes |
| 2026-05-25 | reliability | Fix hookify rule lifecycle stats and persisted file cleanup so rule management stays trustworthy across sessions | ~15m | ✅ | lint | evolve, plan-architecture, review-changes |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | systematic-debugging |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | evolve, review-changes |

## Learnings

- When ranking MEMORY-backed recovery suggestions, recovered sessions with explicit review/verification guardrails are more reusable than clean wins; prioritize them so future retries see actionable recovery paths first.
- When file-backed managers expose lifecycle stats, update counters on enable/disable transitions and delete persisted artifacts for real; clearing files in place leaves stale state that can silently reload on the next session.
