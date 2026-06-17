# TreemapWriter2

A single-user assistive-writing tool for a working philosopher with ADHD,
finishing a dissertation. The treemap view surfaces document structure at a
glance; AI provides _structural_ — not summary — analysis of academic
argument. Hyper Light Drifter aesthetic: spare, glyph-driven, dark-themed.

Originally scaffolded in Google AI Studio (May 2026). Now a Tauri 2 desktop
app with markdown-on-disk + SQLite cache + git history as three independent
recovery paths for the user's prose.

## Run locally

Prerequisites: Node.js 20+. Set `GEMINI_API_KEY` in `.env.local`.

```
npm install
npm run dev          # Vite browser dev server
npm test             # Vitest
npm run typecheck    # tsc --noEmit
npm run build        # production browser bundle
```

## Run as a desktop app

Requires the Tauri 2 toolchain (Rust + platform-specific build tools — see
[`AGENTS.md`](AGENTS.md) for the per-OS list).

```
npm run tauri:dev    # native window with Vite dev server
npm run tauri:build  # installer (.app / .dmg / .exe / .deb / .AppImage)
```

## Multi-machine sync

The local git repo syncs to a private GitHub remote so you can write on
multiple machines. First, the prerequisites (once per machine):

1. Create an empty private GitHub repo (no README, no `.gitignore`).
2. Generate a fine-grained Personal Access Token scoped to that repo with
   read/write Contents permission.

Then there are three ways to connect, all from the Sidebar `◇` menu:

- **Existing local project** → "Sync" (Configure Sync): paste the URL + PAT
  → Test & Save. Pushes your project up to the empty repo.
- **Brand-new project to a fresh repo** → "New from remote…" → **Create**:
  pick a folder, paste URL + PAT, and it scaffolds the project and publishes
  the first commit.
- **Second machine / existing remote** → "New from remote…" → **Clone**:
  paste the URL + PAT, pick an empty folder, and it clones the project down
  and opens it — content from the start. (No CLI `git clone` needed.)

The token lives in the OS keyring (Credential Manager / Keychain /
Secret Service); it never sits on disk. After the initial push, every
autosave commit pushes automatically (debounced 5s); focusing the
window pulls (throttled 60s). The sidebar header has a small cyan dot
when synced, magenta on error.

## Architecture & contributing

This codebase is co-developed with AI coding agents and is designed to be
agent-legible. Before touching code, read:

- [`AGENTS.md`](AGENTS.md) — operating guide; anti-patterns; where-to-put-X table.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, principles, target shape.
- [`docs/refactor-plan.md`](docs/refactor-plan.md) — the multi-phase master plan.
- [`docs/migration-log.md`](docs/migration-log.md) — what each phase changed.
