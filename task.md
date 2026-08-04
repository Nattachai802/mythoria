# Migrate pythonservice vector store: LanceDB → Upstash Vector

> **Correction (verification pass):** LanceDB was NOT the only disk-state
> dependency. `spell_cache.pkl` is a second one, and a worse blocker.
> See step 0 — it must be handled or the service cannot run on Render at all.

## Why
`pythonservice/lance_client.py` stores vectors on local disk (`vector-db/`), which
blocks deploying the Python service to any serverless host (no persistent disk).
Moving to Upstash Vector (serverless, REST-based, free tier separate from Neon)
makes the service fully stateless so it can deploy via git push like the Next.js
app on Vercel.

Confirmed via Upstash docs (see conversation for citations):
- Accepts pre-computed vectors (`vector: [...]` field) — keeps existing Gemini
  `text-embedding-004` (768 dim) embeddings as-is, no change to `embeddings.py`.
- Cosine similarity supported (default).
- Metadata filtering (`content_type = 'x'`) supported, SQL-like syntax.
- Namespaces supported — use one namespace per `novel_id` (cleaner than filtering,
  and enables whole-novel deletion via `delete_namespace`).
- Python SDK `upstash-vector` on PyPI, matches current usage pattern.
- Free tier: 10 indexes, up to 1536 dim, 1GB storage — ample for personal use.
- No data migration needed: `vector-db/` does not exist on disk anywhere
  (checked) — vectors are a derived cache, rebuildable via `/sync/{novel_id}`.

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

1. **Provision Upstash Vector**
   - Sign up at upstash.com, create a Vector index: dimension 768, metric cosine.
   - Grab `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN`.

2. **Rewrite `pythonservice/lance_client.py`**
   - Replace LanceDB client with `upstash-vector` SDK.
   - Keep function signatures identical so `main.py` needs no changes:
     `upsert_content(records)`, `delete_by_novel_id(novel_id)`,
     `search_similar(query_vector, novel_id, limit, content_type)`,
     `count_by_novel_id(novel_id)`.
   - Use `novel_id` as the Upstash namespace; filter `content_type` within it.
   - `search_similar` must keep returning `_distance` (or equivalent) since
     `main.py:288` does `score = 1 - r.get("_distance", 0)`.
   - `delete_by_novel_id` → `index.delete_namespace(novel_id)`.
   - `count_by_novel_id` → query/range within namespace, bucket by `content_type`.

3. **Update `pythonservice/requirements.txt`**
   - Remove `lancedb`.
   - Add `upstash-vector`.

4. **Update env**
   - Add `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN` to
     `pythonservice/.env` (local) and `.env.example` (repo docs).

5. **Self-check**
   - Add a small `__main__`/`assert`-based check in `lance_client.py` (or a
     `test_lance_client.py`) that upserts a throwaway vector to a test
     namespace, queries it back, deletes the namespace — confirms wiring
     without needing the full FastAPI app.

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
   - Set env vars on that host: `GEMINI_API_KEY`, `UPSTASH_VECTOR_REST_URL`,
     `UPSTASH_VECTOR_REST_TOKEN`, `INTERNAL_API_KEY`, others per `.env.example`.

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
   - Call `/sync/{novel_id}` for each novel to rebuild the Upstash index
     (nothing to migrate — old LanceDB data doesn't exist on disk).

9. **Connect Next.js repo to Vercel Git integration**
   - Import `Nattachai802/mythoria` in Vercel dashboard → push to `main` =
     production deploy, PRs = preview deploys. (Separate from Python service
     deploy, already close to ready: `vercel.json` + CI checks exist.)

## Explicitly out of scope
- No change to `embeddings.py` (Gemini embedding generation stays as-is).
- No change to `character_analyzer.py`, `stylometry.py`, or `tools/*` — they
  don't touch the vector store or disk state.
- `spell_checker.py` IS in scope, but only to delete the dead precomputed
  cache (step 0). Its actual spell-checking logic is untouched.
- No DB migration script — there is no existing vector data to migrate.
