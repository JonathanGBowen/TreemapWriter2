<!-- TOMBSTONE 2026-06-15 -->
# docs/ARCHITECTURE.md — split into role-separated docs

> **This file was split on 2026-06-15.** Its content was reorganized so that no
> single document mixes timeless principles with fast-changing current-state —
> the mix that had caused `ARCHITECTURE.md` to drift.

The architecture documentation now lives in role-separated files:

- **Why** the app is built this way — principles, the layer vocabulary as
  concepts, the source-of-truth model → [`VISION.md`](VISION.md)
- **How** it's built today — current architecture, the real Tauri command
  surface, SQLite-as-cache, the `Repository`/`AIProvider` seams, where-to-put-X
  → [`../AGENTS.md`](../AGENTS.md)
- **What's next** and what's out of scope → [`../STATUS.md`](../STATUS.md)
- The **dated history** of what shipped → [`migration-log.md`](migration-log.md)

## Why this tombstone exists

`ARCHITECTURE.md` had drifted: it described a *target* state as if it were
current — a `chapters/*.md` prose layout that was never built (the shipped design
is a single `project.md`), and a command surface listing `section_save` and
`search` that do not exist. Separating *vision* (changes ≈never) from
*current-state* (changes every feature) removes the class of contradiction that
produced the drift. The original `ARCHITECTURE.md` — including the SQLite DDL,
the phases table, and the aspirational layouts — remains in git history. See the
2026-06-15 reconciliation entry in [`migration-log.md`](migration-log.md).
