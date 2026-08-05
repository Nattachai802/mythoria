# Deploy plan — Next.js now, Python service later

## Status (current decision)

**Ship Next.js to Vercel first. Everything below about the Python service and
the vector store is ON HOLD.**

A large rewrite of the story-analysis AI algorithm is coming, and the vector
store choice is *downstream* of it: chunk size and strategy, embedding model
(is 768 dim still right?), one-vector-per-entity vs many, and whether retrieval
has to join the graph/`references` table are all open. Migrating now means
deciding without the requirements, and likely migrating twice. LanceDB on local
disk costs nothing during development — it only hurts when deploying Python, so
both wait together.

**When it is time to decide, the default is pgvector on Neon — not Upstash
Vector.** The reason is architectural, and it holds even if you trust every
vendor involved completely:

| | Upstash Vector | pgvector on Neon |
|---|---|---|
| delete a note → its embedding goes too | no, still a manual sync button | yes, FK cascade |
| join embeddings with `references` | separate service, network hop | one query |
| stores holding the same data | 2 | 1 |
| `/search` `/sync` `/status` endpoints | still needed | deleted |

Upstash Vector was checked against its docs and passes on every technical
point — 768-dim vectors we generate ourselves, cosine, metadata filters,
per-novel namespaces, an ample free tier, a Python SDK. It loses on
architecture: it moves the vectors from a disk to a cloud without fixing the
thing `docs/roadmap.md` names as the actual problem, which is that the
embeddings and the content they describe live in two places nothing keeps in
step.

> **Correction — the privacy argument that used to sit here was wrong.**
> It claimed that sending `main.py:197`'s `content: text[:500]` to Upstash
> would be "the first time fragments of an unpublished manuscript leave the
> system." That is not true and never was. Neon holds the entire manuscript,
> Vercel processes every request containing it, and Gemini/Groq/Typhoon
> receive chapter text on every AI call. The manuscript has always lived on
> third-party servers.
>
> What survives is narrower and much weaker: putting vectors in Neon adds
> **zero** new companies holding the text, while Upstash adds **one** — one
> more ToS to trust, one more breach surface, one more jurisdiction. That is
> a real consideration but a matter of degree, not the bright line it was
> written as. Decide vendor questions on that honest basis; the architecture
> table above is what actually settles this one.

### Still worth doing now (small, independent of the AI rewrite)

Priority order — all of these touch `spell_checker.py` and none depend on where
vectors end up:

| # | Task | Status | RAM |
|---|------|--------|-----|
| **P0** | Fix the `custom_dict` trie bug (step 0c) | **done** | — |
| **P1** | Drop `pandas`, `discord.py` (step 0d) | **done** | −111 MB |
| — | Drop `attacut` | **rejected — see 0d** | (would be −184 MB) |
| **P2** | Delete the precomputed spell cache (step 0) | **done**, via Hunspell | small |
| **P3** | Widen the custom-word whitelist (step 0b) | not done | — |

Also landed, not originally planned: suggestions now come from hunspell-th via
`spylls` instead of `pythainlp.spell()` — 56 ms/word warm against 0.66 s, which
is what made deleting the cache possible. Costs +34 MB.

P3 is worth less than it looks. `attacut` splits compound proper nouns
(`สภาผู้อาวุโส` → `สภาผู้|อาวุโส`), so a whitelist entry can fail to match no
matter how complete the list is. Fixing that needs the tokenizer to consult the
whitelist, which the attacut branch never does.

0c. **Fix the custom-dict trie (P0)**

   `spell_checker.py:146` builds the tokenizer dictionary as
   `dict_trie(self.custom_whitelist)`. In PyThaiNLP, `custom_dict` **replaces**
   the dictionary rather than extending it, so the tokenizer currently runs
   with only `BUILTIN_WHITELIST` (~50 words) plus the novel's proper nouns.
   Measured effect on the fallback path:

   ```
   ถูกทิ้งร้างมานานนับศตวรรษ     ← glued into a single token
   ```

   Fix: `dict_trie(set(thai_words()) | self.custom_whitelist)`.

   This is invisible today only because `attacut` takes priority in
   `_tokenize` (`spell_checker.py:299-311`) and the `newmm` branch never runs.

0d. **Drop attacut, pandas, discord.py (P1)**

   Measured with the project venv (baseline Python = 14 MB resident):

   | package | RAM | verdict |
   |---------|----:|---------|
   | `attacut` | 184 MB | pulls in **torch 2.12** for tokenizing |
   | `lancedb` | 123 MB | goes away with the vector migration |
   | `pandas` | 77 MB | **no import anywhere in the repo** |
   | `discord.py` | 34 MB | belongs to the `Mythoria_bot` repo |
   | `pythainlp` | 10 MB | keep — it is cheap |
   | `frozenset(thai_words())`, 62,101 words | 10 MB | keep — also cheap |

   `pandas` and `discord.py` are gone. **`attacut` stays** — it was removed,
   measured, and put back.

   The case for removing it looked strong: on prose that is spelled correctly,
   `newmm` with the merged dictionary from 0c tokenizes *better*, because the
   attacut branch never consults the whitelist and splits the novel's own
   names:

   ```
   attacut : เอริส|เดิน|เข้า|ไป|ใน|หอ|คอย|เวทมนตร์      ← หอคอย, เข้าไป split
   newmm+  : เอริส|เดิน|เข้าไป|ใน|หอคอย|เวทมนตร์
   attacut : ไร|กะ|สูด|หายใจ                            ← splits a character name
   newmm+  : ไรกะ|สูด|หายใจ
   ```

   That test measured the wrong thing. This module's job is finding
   *misspellings*, and dictionary-based tokenizers resolve a misspelling into
   whatever real words it can, which hides it:

   ```
   สวัสดร   → ส|วัส|ดร     (all three are dictionary words → no error reported)
   อนุญาติ  → อนุ|ญาติ     (both are words → no error reported)
   ```

   With `newmm` alone the checker caught **0 of 4** planted typos. attacut
   keeps the misspelled span intact, so it caught **4 of 4**, with no false
   positives on whitelisted names. The 184 MB buys the module's core function.

   Total actually saved: **−111 MB**, plus +34 MB for Hunspell. `lancedb`'s
   123 MB is still on the table via the vector migration.

### Vercel deploy checklist (the part being done now)
- `vercel.json` already sets `regions: ["sin1"]` and `maxDuration: 300`.
- `.github/workflows/ci.yml` already runs typecheck, self-checks, and build.
- Import `Nattachai802/mythoria` in the Vercel dashboard → push to `main`
  deploys production, PRs get preview URLs.
- Set the real env vars in Vercel (the list in `ci.yml` uses dummies):
  `DATABASE_URL`, `NEON_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `NEXT_PUBLIC_BASE_URL`, `GEMINI_API_KEY`, `TYPHOON_API_KEY`, `GROQ_API_KEY`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CLOUDINARY_*`, `RESEND_*`,
  `REGISTRATION_CODE`, `NEXT_PUBLIC_SENTRY_DSN`.
- **Leave `PYTHON_SERVICE_URL` unset for now.** Five API routes call Python
  (spell-check, stylometry for chapters and notes, analysis-trigger, and the
  `/api/py/[...path]` passthrough). With no Python host they return errors;
  everything else — writing, chapters, characters, world graph, auth — works.
  The build does not depend on it.

---

# (On hold) Migrate pythonservice vector store off local disk

> **Correction (verification pass):** LanceDB was NOT the only disk-state
> dependency. `spell_cache.pkl` is a second one, and a worse blocker.
> See step 0 — it must be handled or the service cannot run on Render at all.

## Why
`pythonservice/lance_client.py` stores vectors on local disk (`vector-db/`), which
blocks deploying the Python service to any serverless host (no persistent disk).
Moving them into the Neon Postgres that already holds the manuscript makes the
service fully stateless, so it deploys via git push like the Next.js app.

Nothing to migrate: `vector-db/` does not exist on disk anywhere (checked).
Vectors are a derived cache, rebuildable via `/sync/{novel_id}`.

### Upstash Vector — evaluated and not chosen
Kept because the numbers were verified and stay useful if it is ever
reconsidered. It failed on architecture, not capability (see Status above):
- Accepts pre-computed vectors (`vector: [...]` field) — keeps existing Gemini
  `text-embedding-004` (768 dim) embeddings as-is, no change to `embeddings.py`.
- Cosine similarity supported (default).
- Metadata filtering (`content_type = 'x'`) supported, SQL-like syntax.
- Namespaces supported — use one namespace per `novel_id` (cleaner than filtering,
  and enables whole-novel deletion via `delete_namespace`).
- Python SDK `upstash-vector` on PyPI, matches current usage pattern.
- Free tier: 10 indexes, up to 1536 dim, 1GB storage — ample for personal use.

## Steps

0. **Delete the precomputed spell cache (BLOCKER — do this first)**

   The second disk-state dependency, and a harder blocker than LanceDB:
   - `main.py` lifespan calls `ensure_cache_built()` on **every** startup.
   - `spell_cache.pkl` is gitignored (`.gitignore:4`), so it never ships with
     a deploy — Render always starts with no cache.
   - Render's disk is ephemeral and the free tier sleeps after 15min idle, so
     the cache would rebuild from scratch on **every cold start**.
   - Measured on this Mac: `spell()` takes **0.66 s/word** × 62,101 words in
     `thai_words()` = **11.3 hours** per build. On Render's 0.1 vCPU it is
     far slower still — it would never finish, and would burn the 750
     instance-hours/month budget doing nothing useful.
     (The docstring in `build_spell_cache.py` estimates 0.001–0.003 s/word —
     off by roughly 300x.)

   **The fix is deletion, because the cache is already useless:**
   - `spell_checker.py:217` only looks up suggestions when `not in_dict`,
     i.e. for words **absent** from `thai_words()`.
   - `build_spell_cache.py` precomputes suggestions for **all of
     `thai_words()`** — exactly the words whose suggestions are never
     requested. Hit rate is 0% by construction.
   - `spell_checker.py:219-225` already has a correct lazy path: on a cache
     miss it calls `spell(word)` and memoizes the result in
     `_SUGGESTION_CACHE`.

   So: delete `build_spell_cache.py`, drop its import in `spell_checker.py`,
   initialize `_SUGGESTION_CACHE` to an empty dict, and remove
   `ensure_cache_built()` (and the now-empty `lifespan`) from `main.py`, plus
   the `/spell-check/cache/*` endpoints that only exist to manage this cache
   (`main.py:1093`, `main.py:1108`). Behavior is unchanged — the lazy path
   already covers every real lookup. Removes ~112 lines, the pkl disk
   dependency, the 11.3-hour build, and the RAM held by a 62k-entry dict.

   **Verified in a later pass:** the two endpoints being deleted have no
   callers anywhere in `lib/`, `components/`, or `app/` — nothing in the UI
   breaks. The deletion cannot change spell-check output either: because the
   cache never hits, 100% of today's lookups already take the lazy path.
   (The 11.3-hour figure is inherited from the session that wrote this file
   and was not re-measured — but nothing here depends on it. A cache with a
   0% hit rate should be deleted whether the build takes 11 hours or 10
   seconds.)

0b. **Widen the custom-word whitelist (do this with step 0)**

   `spell-check-trigger/route.ts:33-44` already feeds Python a `custom_words`
   whitelist built from `characters` (name + aliases) and `locations`. Words
   on that list are skipped before any suggestion lookup happens, so they
   cost nothing and need no cache.

   But the novel's other invented vocabulary is missing from it: `items`,
   `factions`, `powers`, `entities`, `lore_entries`, and `world_systems` all
   hold made-up proper nouns that PyThaiNLP will never know. Adding them to
   the same query (a few lines, one round trip) does two things at once:

   - **Fixes a real annoyance**: item and faction names are currently
     underlined as misspellings.
   - **Shrinks the problem step 2 of the caching discussion was trying to
     solve**: the expensive `spell()` calls are mostly on exactly these
     words. Whitelist them and there is much less left worth caching.

   Do this before deciding whether any persistent suggestion cache is needed
   at all.

1. **Enable pgvector on Neon**
   - `CREATE EXTENSION IF NOT EXISTS vector;` — available on Neon's free plan,
     HNSW supported, index dimension limit 2,000 so 768 is fine.

2. **Rewrite `pythonservice/lance_client.py`**
   - Replace the LanceDB client with `psycopg2` against `NEON_DATABASE_URL`
     (already a dependency, and the pooled `-pooler` host is already in `.env`).
   - Keep function signatures identical so `main.py` needs no changes:
     `upsert_content(records)`, `delete_by_novel_id(novel_id)`,
     `search_similar(query_vector, novel_id, limit, content_type)`,
     `count_by_novel_id(novel_id)`.
   - `search_similar` must keep returning `_distance`, since `main.py:288`
     does `score = 1 - r.get("_distance", 0)`. Cosine distance is `<=>`.
   - Table: `content_vectors(id pk, novel_id, content_type, title, content,
     metadata, vector vector(768))`, indexed on `novel_id`.
   - Later, once the schema settles: make `novel_id` a real FK so deleting a
     novel drops its embeddings, which is the point of moving here at all.

3. **Update `pythonservice/requirements.txt`**
   - Remove `lancedb` (−123 MB resident).
   - `psycopg2-binary` is already there.

4. **Update env**
   - Nothing new. `NEON_DATABASE_URL` / `DATABASE_URL` already exist in
     `pythonservice/.env`.

5. **Self-check**
   - Add a small `__main__`/`assert`-based check in `lance_client.py` that
     upserts a throwaway vector under a test `novel_id`, queries it back, then
     deletes it — confirms wiring without booting the FastAPI app.

6. **Deploy Python service to a serverless/free host**
   - **Host: Render** (Web Service, free tier). Chosen over Railway/Fly/Koyeb/
     Cloud Run because it needs no credit or debit card, has native Python
     buildpack (no Dockerfile), native GitHub auto-deploy on push, and a
     Singapore region matching Vercel's `sin1`.
   - Free tier constraints to accept: 512MB RAM / 0.1 vCPU, sleeps after 15min
     idle (~30-60s cold start on wake), 750 shared instance-hours/month.
     No option in the no-card group (Render/Railway/Koyeb) offers more RAM
     sustainably — Railway's 1GB is a 30-day trial only, then drops below
     Render. So the fix for RAM headroom is on the code side, not platform
     shopping (see 6b below).
   - Set env vars on that host per `render.yaml`: `INTERNAL_API_KEY`,
     `GEMINI_API_KEY`, `TYPHOON_API_KEY`, `NEXT_PUBLIC_BASE_URL`, and
     `NEON_DATABASE_URL` once vectors live in Postgres.

6b. **RAM optimization (before/alongside deploy, to fit Render's 512MB)**
   - Remove `pandas` and `discord.py` from `requirements.txt` — grepped the
     codebase, neither is imported anywhere in `pythonservice/*.py`. Pure
     dead weight for *this* service; `pandas` alone typically adds 100MB+
     resident on import. Confirmed: `discord.py` belongs to the separate
     Discord bot repo (`Mythoria_bot`) — this `requirements.txt` just
     inherited the entry, the bot itself is unaffected since it lives in
     its own repo with its own deploy.
   - Lazy-import heavy modules instead of top-level in `main.py`: currently
     `from ai_agent import analyze_plot` (line 356), `from character_analyzer
     import ...` (line 399), and `from spell_checker import ...` (line 1004)
     are all module-level imports — meaning `pythainlp`, `attacut`, and
     `langchain_openai` load into RAM on every cold start, even if those
     specific endpoints are never called. Move each `import` inside its
     route handler function so they load only on first actual use of that
     feature, reducing baseline memory footprint.
   - After both changes, deploy to Render and check the dashboard's memory
     graph under real requests before assuming it's fine or broken —
     don't guess.

7. **Point Next.js at the new Python host**
   - Update `PYTHON_SERVICE_URL` in Vercel project env vars.

8. **Re-sync vectors**
   - Call `/sync/{novel_id}` for each novel to rebuild `content_vectors`
     (nothing to migrate — old LanceDB data doesn't exist on disk).

9. **Connect Next.js repo to Vercel Git integration**
   - Import `Nattachai802/mythoria` in Vercel dashboard → push to `main` =
     production deploy, PRs = preview deploys. (Separate from Python service
     deploy, already close to ready: `vercel.json` + CI checks exist.)

## Resolved: the suggestion cache is gone

This section used to weigh three homes for a persistent suggestion cache. The
question no longer exists. `pythainlp.spell()` was the reason one was ever
wanted — 0.66 s per word, spiking to 929 ms — and hunspell-th via `spylls`
answers in 56 ms warm. Nothing is worth caching at that speed, so the pkl, the
background build, the startup hook and the two management endpoints are all
deleted.

Two things recorded here were wrong and are worth keeping visible, because the
same reasoning was applied elsewhere:

- **"Spell check is a background job the writer never explicitly invoked."**
  It is not. `chapter-row.tsx:128` fires it when the writer moves a chapter to
  *รอพิสูจน์อักษร*. It is as user-triggered as the Groq/Gemini calls.
- **"Routing those words to Upstash would be the first time fragments of an
  unpublished manuscript leave the system."** They never stayed in it. Neon
  holds the manuscript, Vercel processes it, and the AI providers receive
  chapter text on every call. The honest version of this argument is only
  *one more vendor holding a copy*, which is a question of degree.

If a hosted spell checker is ever revisited (Longdo's API was measured: 4/4
typos caught, **fewer** false positives than the local pipeline, ~116 ms per
sentence against 114 ms local, and it would drop `attacut` + `spylls` for
−218 MB), decide it on that honest footing — vendor count, network dependency,
and RAM — not on a privacy line that was never true.

## Explicitly out of scope
- No change to `embeddings.py` (Gemini embedding generation stays as-is).
- No change to `character_analyzer.py`, `stylometry.py`, or `tools/*` — they
  don't touch the vector store or disk state.
- `spell_checker.py` IS in scope, but only to delete the dead precomputed
  cache (step 0). Its actual spell-checking logic is untouched.
- No DB migration script — there is no existing vector data to migrate.
