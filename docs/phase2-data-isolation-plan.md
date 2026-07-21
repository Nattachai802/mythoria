# Phase 2 — Data Isolation Plan

## Status
`lib/authz.ts` created with `requireNovelAccess(novelId)`, `requireUser()`, `authErrorMessage()`.
Applied as a worked example to `server/factions.ts`: `createFaction`, `updateFaction`, `deleteFaction`.

## The gap (from audit)
Almost the entire `server/` directory (~50 files) has no session/ownership check at all.
Only `drive-sync.ts` and 4 functions in `factions.ts` call `auth.api.getSession`.
Any client that knows/guesses a `novelId` or entity id can currently read or write another
user's novel data. This blocks public launch.

## Two shapes of fix, seen in the factions.ts example
1. **Client sends `novelId` directly** (e.g. create-type actions) → call
   `await requireNovelAccess(data.novelId)` right at the top of the `try` block.
2. **Client sends only an entity id** (factionId, ideaId, chapterId, ...) → must first
   `select` the row to find its real `novelId`, *then* `requireNovelAccess(that novelId)`,
   *then* proceed. Also strip any `novelId` field from update payloads so a caller can't
   reassign a row to a novel they don't own.

Wrap the whole thing in the existing `try { ... } catch (error) { return { success:false,
error: authErrorMessage(error, "...") } }` pattern already used everywhere — no need to
change the function's external shape/signature.

## Remaining scope (not started)
Files with zero `getSession` calls, in priority order (writes before reads, per the audit):
- `server/novel.ts` — updateNovel, updateNovelStatus, updateNovelVisibility, deleteNovel,
  updateNovelWordCount, getNovelById*, getNovelStats, searchNovels
- `server/chapter.ts` — createChapter, updateChapter, deleteChapter, getChapter(s)
- `server/idea.ts`, `server/character.ts`, `server/lore.ts`, `server/timeline.ts`,
  `server/power.ts`, `server/note.ts`, `server/graph.ts`
- `server/version-history.ts`, `server/plot-threads.ts`, `server/story-arcs.ts`,
  `server/world-systems.ts`, `server/locations.ts`, `server/items.ts`,
  `server/life-events.ts`, `server/eras.ts`, `server/location-connections.ts`,
  `server/note-character.ts`, `server/chapter-characters.ts`, `server/character-power.ts`
- Remaining functions in `server/factions.ts` itself (addCharacterToFaction,
  removeCharacterFromFaction, createFactionRelationship, deleteFactionRelationship,
  updateFactionStatusPreset, deleteFactionStatusPreset, getFactionsByNovelId,
  getFactionRelationships, getAllFactionsWithMembers)

## Open decision (ask the user next session)
Scope of the next pass — pick one:
- (a) Highest-risk files only (novel.ts, chapter.ts) first, ship that, iterate
- (b) All ~50 files in one pass (bigger diff, needs full typecheck + build re-verification)
- (c) Something narrower — revisit and decide fresh

## Also still open from Phase 2 (untouched)
- Python service: no auth between Next.js and `localhost:8000`, and it's reachable
  directly from the internet if deployed as-is.
- Rate limiting only exists in 4 files (bible-import, chapter-summary,
  character-state-ai, note-summary) — everything else that calls AI is uncapped.
