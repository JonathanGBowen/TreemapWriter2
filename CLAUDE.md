# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read these first (in order)

This codebase is deliberately agent-legible. The documentation is split by
**role** so no single file mixes timeless intent with fast-changing detail.
Before changing code, read:

1. **[docs/VISION.md](docs/VISION.md)** — *why*. The user, the principles, the
   aesthetic, the summary-vs-exegesis thesis. Rarely changes; read it once and
   it sticks.
2. **[AGENTS.md](AGENTS.md)** — *how*. Current architecture, the architectural
   law, where-to-put-X, anti-patterns, commands. This is the operating guide.
3. **[STATUS.md](STATUS.md)** — *now*. What's next, lingering debts, and what's
   out of scope by design.
4. **[docs/migration-log.md](docs/migration-log.md)** — *history*. The dated,
   append-only record of what shipped.

For the *origin* — the founding brief and the AI Studio system prompt that
produced all of the above — see **[docs/FOUNDING.md](docs/FOUNDING.md)** (frozen
historical record; read it when you want the reasoning behind a constraint).

(`AGENTS.md` also has the full build/test/run commands and the env-file gotcha —
go there first when you need to build or test.)

## Canonical source per fact (the rule that keeps these docs honest)

Each fact has exactly **one** home. If two docs state the same fact, that's a
bug — delete one. When the docs and the code disagree, **trust the code.**

| You want to know… | Authoritative source |
|---|---|
| Exact file tree, counts, line numbers | **the code** — never hand-kept in prose |
| Current architecture & conventions | **AGENTS.md** |
| Why it's built this way (principles/intent) | **docs/VISION.md** |
| What's being worked on / out of scope | **STATUS.md** |
| What shipped, when, and how to roll back | **docs/migration-log.md** |

Prose in any doc may describe a *rule* ("modals are one flat file each") but not
an *inventory* ("there are 18 modals") — inventories live in the code, because
that's what drifts.
