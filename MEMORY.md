# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors | Skills Used |
|------|------|-------------|------|--------|--------|-------------|
| 2026-05-19 | capability | Auto-refresh self-improvement suggestions when cached results are empty or stale | ~15m | ✅ | none | evolve, plan-architecture, review-changes |
| 2026-05-18 | capability | Suppress weak-signal skill-learning suggestions unless backed by actionable evidence | ~15m | ✅ | lint | evolve, plan-architecture, review-changes |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | systematic-debugging |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | evolve, review-changes |

## Learnings

- Self-improvement suggestions should refresh automatically when cached results are empty or stale; otherwise autonomous task selection can falsely conclude there is no actionable improvement work.
- Weak-signal skill-effectiveness recommendations in the self-improvement engine should only surface when they cite a concrete low-performing skill plus actionable memory-capture guidance; generic prompts create low-signal capability churn.
