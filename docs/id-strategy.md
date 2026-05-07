# Section ID Strategy

> **Status:** placeholder. Phase 1 will replace `src/lib/utils.ts:4-6`'s
> title-slug-based scheme with a stable strategy and document it here.

## The problem

Today, section IDs are generated as
`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}` with a fallback
that tries to reuse old IDs when titles match (`src/lib/utils.ts:78-92`).

This is fragile under:

- Duplicate titles (two "Introduction" subsections produce the same base id).
- Renames (an ID derived from "Introduction" becomes meaningless after the
  user renames it to "Overture"; references — dependency edges, snapshots,
  diagnostics — point at the old id).
- Reordering (the `-${index}` suffix changes when sections are moved).

## What Phase 1 will do (sketch)

- IDs become opaque ULIDs (or UUIDv7), assigned at section creation, never
  derived from title or position.
- The current `id` field on the `Section` type stays a string; existing
  derived-IDs are migrated by hashing once and pinning.
- The markdown file does not store the ID inline; it stores a stable
  YAML-frontmatter `id:` per section file (post-Phase 3) or a sidecar
  mapping (Phase 1, IndexedDB era).
- The `parseMarkdown` parser reads the mapping rather than re-deriving from
  title.

Migration: on first load post-Phase 1, walk the existing sections and assign
ULIDs, persisting the title→ULID map. This map seeds future parses.

## Open questions for Phase 1

- Where does the title→ULID map live in the IndexedDB-era layout? Probably
  an additional field on the project blob.
- How do we handle a true delete (section removed from markdown)? Garbage
  collect on load, or keep orphan IDs until next snapshot? Default: keep,
  so dependency edges to deleted sections survive an undo.
