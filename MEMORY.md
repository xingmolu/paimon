# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors | Skills Used |
|------|------|-------------|------|--------|--------|-------------|
| 2026-05-16 | capability | Tighten self-improvement filtering so strong memory health suppresses stale memory-only recommendations | ~20m | ❌ | test | evolve, plan-architecture, review-changes |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | systematic-debugging |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | evolve, review-changes |

## Learnings

- Self-improvement filtering should gate dashboard-derived memory-only recommendations when memory-quality health is already strong; otherwise task selection can drift toward stale documentation-only work instead of active capability gaps.
