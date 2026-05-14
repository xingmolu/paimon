# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors | Skills Used |
|------|------|-------------|------|--------|--------|-------------|
| 2026-05-14 | capability | Fix capability coverage reporting for evolution strategy | ~20m | ✅ | test | evolve, explore-code, plan-architecture, review-changes |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | systematic-debugging |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | evolve, review-changes |

## Learnings

- Evolution strategy coverage should use current capability inventory, not scorecard-derived capability velocity totals. Historical iteration counts and present capability coverage measure different things and produce misleading recommendations when conflated.
