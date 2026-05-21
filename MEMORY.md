# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors | Skills Used |
|------|------|-------------|------|--------|--------|-------------|
| 2026-05-21 | capability | Integrate MEMORY-backed recurring test-recovery guidance into self-evaluation recommendations and capability gaps | ~20m | ✅ | test | evolve, plan-architecture, review-changes |
| 2026-05-20 | capability | Suppress generic recurring-error self-improvement suggestions when specific actionable error-recovery alternatives already exist | ~15m | ✅ | test | evolve, plan-architecture, review-changes |
| 2026-05-20 | capability | Suppress generic optimization-health self-improvement suggestions when specific actionable best-practice alternatives already exist | ~15m | ✅ | test | evolve, plan-architecture, review-changes |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | systematic-debugging |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | evolve, review-changes |

## Learnings

- MEMORY-backed recovery guidance should be surfaced before generic self-evaluation suggestions so recent successful or failed recovery paths are not truncated out of the recommendation list.
- Generic recurring-error self-improvement prompts should be suppressed when more specific actionable error-recovery guidance is already present, so task selection prefers concrete recovery and guardrail work over umbrella reliability summaries.
- Generic optimization-health self-improvement prompts should be suppressed when more specific actionable best-practice alternatives are already present, so autonomous task selection stays focused on actionable guidance instead of umbrella summaries.
