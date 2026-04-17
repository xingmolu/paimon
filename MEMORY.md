# Memory

Persistent learnings stored across sessions.

---

## Task Types

| Type | Description | Priority |
|------|-------------|----------|
| `capability` | Improves self-evolution ability itself | Highest |
| `reliability` | Improves stability/safety/error handling | Medium |
| `feature` | Adds new general functionality | Lower |

**Rule:** Prefer `capability` > `reliability` > `feature`.

---

## Metrics

- First Try Success Rate: 92% (101/110)
- Average Time: ~15 minutes
- Rework Rate: 8%
- Capability Tasks: 94% (104/110)
- Capability Velocity: 35/day

---

## Active Patterns (High Confidence)

1. **Always verify before commit** — Run `npm run build && npm test -- --run` before any commit. Never commit broken code.
2. **Use `edit` over `write`** — Surgical changes reduce errors. Prefer `edit` for modifications.
3. **One change at a time** — Minimal focused changes have higher success rate.
4. **Fix lint at source** — Run `biome check --fix` after edits to prevent accumulation.
5. **Read skills first** — Always read matched skills before starting a task.
6. **Keep parsers aligned with context file schema** — When STRATEGY/MEMORY/JOURNAL formats are refactored, update dependent analyzers and dashboard parsers in the same change to avoid silent degradation.
7. **Filter self-improvement output for actionability** — Suppress suggestions from generated artifacts, tests, and already-implemented competitor ideas so scans stay high-signal and task selection remains trustworthy.

---

## Weak Signals (Under Observation)

- TypeScript import errors are recurring (7 occurrences). Pattern: forgetting to import new symbols.
- API timeout errors occur during long sessions. May need better timeout handling.
- Context file bloat reduces decision quality over time (addressed by Issue #25).

---

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-17 | capability | Filter low-signal self-improvement suggestions | ~15m | ✅ | none |
| 2026-04-16 | capability | Metrics scorecard compatibility fix | ~15m | ✅ | test |
| 2026-04-16 | reliability | Self-improvement engine false positive fix | ~10m | ✅ | none |
| 2026-04-05 | capability | Evolution Optimization Dashboard | ~15m | ✅ | none |
| 2026-04-05 | capability | Fix Capability Gap Detector False Positives | ~10m | ✅ | none |
| 2026-04-05 | capability | OK Shortcut Command (Aider Pattern) | ~10m | ✅ | lint |

---

## Skill Effectiveness

1. **evolve** — 32 iterations, 95% success
2. **research** — 11 iterations, competitor research
3. **writing-plans** — 5 iterations, planning workflow
4. **using-superpowers** — 4 iterations, skill guidance
5. **systematic-debugging** — 3 iterations, debugging workflow
