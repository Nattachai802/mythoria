"""
FastAPI Vector Search Service
Provides REST API for all content vector sync and search
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
import json
from dotenv import load_dotenv

from embeddings import generate_embedding
from lance_client import (
    upsert_content,
    delete_by_novel_id,
    search_similar,
    count_by_novel_id,
)
from author_fingerprint_discovery import AuthorFingerprint
from stylometry import analyze_single_chapter_style

load_dotenv()

app = FastAPI(title="Mythoria Vector Service", version="1.0.0")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Internal auth: ทุก request ต้องแนบ X-Internal-Key ตรงกับ env (ยกเว้น /health และ preflight) ---
# กันคนนอกยิง endpoint ตรง ๆ เมื่อ deploy จริง — Next.js เป็นตัวเดียวที่ถือ key นี้
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")


@app.middleware("http")
async def require_internal_key(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path == "/health":
        return await call_next(request)
    if not INTERNAL_API_KEY:
        # ตั้ง fail-closed: ถ้าลืมตั้ง key ฝั่ง service ให้ปฏิเสธ ดีกว่าเปิดโล่งเงียบ ๆ
        return JSONResponse(status_code=503, content={"detail": "INTERNAL_API_KEY not configured"})
    if request.headers.get("x-internal-key") != INTERNAL_API_KEY:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)


class SearchRequest(BaseModel):
    query: str
    novel_id: str
    limit: int = 10
    content_type: str = None  # character, note, chapter, location or None for all


class SearchResult(BaseModel):
    id: str
    content_type: str
    title: str
    content: str
    score: float


class SyncResult(BaseModel):
    success: bool
    synced: dict
    errors: list[str]


def extract_text_from_content(content) -> str:
    """Extract plain text from rich text content (JSON or string)"""
    if not content:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        # Handle Quill/TipTap format
        if "text" in content:
            return content["text"]
        if "ops" in content:
            # Quill delta format
            return " ".join(op.get("insert", "") for op in content.get("ops", []) if isinstance(op.get("insert"), str))
    return str(content)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "vector-search"}


@app.post("/sync/{novel_id}", response_model=SyncResult)
async def sync_all_content(novel_id: str):
    """Sync all content (characters, notes, chapters, locations) for a novel"""
    errors = []
    synced = {"character": 0, "note": 0, "chapter": 0, "location": 0}
    
    try:
        # Fetch all content from Next.js API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:3000/api/novel/{novel_id}/characters",
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch content")
            
            data = response.json()
        
        # Clear existing vectors
        delete_by_novel_id(novel_id)
        
        records = []
        
        # Process Characters
        for char in data.get("characters", []):
            try:
                text = ". ".join(filter(None, [
                    char.get("name", ""),
                    f"Role: {char.get('role', '')}" if char.get("role") else "",
                    char.get("description", "") or "",
                    char.get("personality", "") or "",
                    char.get("backstory", "") or "",
                ]))
                
                vector = generate_embedding(text)
                records.append({
                    "id": char["id"],
                    "novel_id": novel_id,
                    "content_type": "character",
                    "title": char.get("name", ""),
                    "content": text[:500],  # Limit content length
                    "metadata": json.dumps({"role": char.get("role", "")}),
                    "vector": vector,
                })
                synced["character"] += 1
                print(f"[Sync] Character: {char.get('name')}")
            except Exception as e:
                errors.append(f"Character {char.get('name')}: {e}")
        
        # Process Notes
        for note in data.get("notes", []):
            try:
                content_text = extract_text_from_content(note.get("content"))
                text = f"{note.get('title', '')}. {content_text}"
                
                if len(text.strip()) < 10:
                    continue
                
                vector = generate_embedding(text)
                records.append({
                    "id": note["id"],
                    "novel_id": novel_id,
                    "content_type": "note",
                    "title": note.get("title", ""),
                    "content": text[:500],
                    "metadata": json.dumps({"type": note.get("type", "general")}),
                    "vector": vector,
                })
                synced["note"] += 1
                print(f"[Sync] Note: {note.get('title')}")
            except Exception as e:
                errors.append(f"Note {note.get('title')}: {e}")
        
        # Process Chapters
        for chapter in data.get("chapters", []):
            try:
                content_text = chapter.get("plainText", "") or extract_text_from_content(chapter.get("content"))
                text = f"{chapter.get('title', '')}. {chapter.get('summary', '') or ''}. {content_text}"
                
                if len(text.strip()) < 10:
                    continue
                
                vector = generate_embedding(text[:2000])  # Limit for embedding
                records.append({
                    "id": chapter["id"],
                    "novel_id": novel_id,
                    "content_type": "chapter",
                    "title": chapter.get("title", ""),
                    "content": text[:500],
                    "metadata": json.dumps({"orderIndex": chapter.get("orderIndex", 0)}),
                    "vector": vector,
                })
                synced["chapter"] += 1
                print(f"[Sync] Chapter: {chapter.get('title')}")
            except Exception as e:
                errors.append(f"Chapter {chapter.get('title')}: {e}")
        
        # Process Locations
        for loc in data.get("locations", []):
            try:
                text = f"{loc.get('name', '')}. Type: {loc.get('type', '')}. {loc.get('description', '') or ''}"
                
                vector = generate_embedding(text)
                records.append({
                    "id": loc["id"],
                    "novel_id": novel_id,
                    "content_type": "location",
                    "title": loc.get("name", ""),
                    "content": text[:500],
                    "metadata": json.dumps({"type": loc.get("type", "")}),
                    "vector": vector,
                })
                synced["location"] += 1
                print(f"[Sync] Location: {loc.get('name')}")
            except Exception as e:
                errors.append(f"Location {loc.get('name')}: {e}")
        
        # Process remaining entity types via the uniform embeddable endpoint
        # (lore, faction, power, item, entity, era, timelineEvent, idea, plotThread).
        # character/location already handled above with richer fields — skip to avoid double embed.
        try:
            async with httpx.AsyncClient() as client:
                emb_resp = await client.get(
                    f"http://localhost:3000/api/novel/{novel_id}/embeddable",
                    timeout=30.0,
                )
            if emb_resp.status_code == 200:
                for rec in emb_resp.json().get("records", []):
                    ctype = rec.get("type")
                    if ctype in ("character", "location") or not rec.get("text"):
                        continue
                    try:
                        records.append({
                            "id": rec["id"],
                            "novel_id": novel_id,
                            "content_type": ctype,
                            "title": rec.get("title", ""),
                            "content": rec["text"][:500],
                            "metadata": json.dumps({}),
                            "vector": generate_embedding(rec["text"][:2000]),
                        })
                        synced[ctype] = synced.get(ctype, 0) + 1
                    except Exception as e:
                        errors.append(f"{ctype} {rec.get('title')}: {e}")
        except Exception as e:
            errors.append(f"embeddable fetch: {e}")

        # Insert all records
        if records:
            upsert_content(records)
            print(f"[Sync] Total: {len(records)} records inserted")
        
        return SyncResult(success=True, synced=synced, errors=errors)
        
    except Exception as e:
        return SyncResult(success=False, synced=synced, errors=[str(e)])


@app.post("/search", response_model=list[SearchResult])
async def search_content(request: SearchRequest):
    """Search for similar content across all types"""
    if not request.query.strip():
        return []
    
    try:
        query_vector = generate_embedding(request.query)
        results = search_similar(
            query_vector, 
            request.novel_id, 
            request.limit,
            request.content_type
        )
        
        return [
            SearchResult(
                id=r["id"],
                content_type=r["content_type"],
                title=r["title"],
                content=r["content"],
                score=1 - r.get("_distance", 0),
            )
            for r in results
        ]
    except Exception as e:
        print(f"[Search] Error: {e}")
        return []


@app.get("/status/{novel_id}")
async def get_status(novel_id: str):
    """Get sync status for a novel"""
    counts = count_by_novel_id(novel_id)
    return {"novel_id": novel_id, **counts}


# ============================================
# MCP TOOLS ENDPOINTS
# ============================================

from tools.timeline_checker import check_timeline_conflict
from tools.character_validator import validate_character_consistency


class TimelineCheckRequest(BaseModel):
    novel_id: str
    character_id: str
    from_note_id: str
    to_note_id: str
    time_elapsed_hours: float = 0


class CharacterValidateRequest(BaseModel):
    novel_id: str
    character_id: str
    note_id: str
    action_text: str


@app.post("/check-timeline")
async def check_timeline_endpoint(request: TimelineCheckRequest):
    """Check if character can travel between locations within timeline"""
    result = await check_timeline_conflict(
        novel_id=request.novel_id,
        character_id=request.character_id,
        from_note_id=request.from_note_id,
        to_note_id=request.to_note_id,
        time_elapsed_hours=request.time_elapsed_hours
    )
    return result


@app.post("/validate-character")
async def validate_character_endpoint(request: CharacterValidateRequest):
    """Validate if character action is consistent with their state"""
    result = await validate_character_consistency(
        novel_id=request.novel_id,
        character_id=request.character_id,
        note_id=request.note_id,
        action_text=request.action_text
    )
    return result


# ============================================
# AI AGENT ENDPOINT
# ============================================

from ai_agent import analyze_plot


class AnalyzePlotRequest(BaseModel):
    novel_id: str
    content_text: str
    character_ids: list[str] = []
    note_id: str = None


class PlotIssue(BaseModel):
    type: str
    description: str


class AnalyzePlotResponse(BaseModel):
    analysis: str
    issues: list[dict]
    tool_calls: list[dict]


@app.post("/analyze-plot", response_model=AnalyzePlotResponse)
async def analyze_plot_endpoint(request: AnalyzePlotRequest):
    """Analyze content for plot holes using AI with function calling"""
    result = await analyze_plot(
        novel_id=request.novel_id,
        content_text=request.content_text,
        context={
            "character_ids": request.character_ids,
            "note_id": request.note_id
        }
    )
    return AnalyzePlotResponse(
        analysis=result.get("analysis", ""),
        issues=result.get("issues", []),
        tool_calls=result.get("tool_calls", [])
    )


# ============================================
# CHARACTER ANALYSIS ENDPOINTS
# ============================================

from character_analyzer import (
    analyze_unanalyzed_chapters,
    analyze_character_for_novel,
    analyze_chapter,
    fetch_chapters,
    fetch_characters,
    fetch_analyzed_chapters
)


class AnalyzeCharactersRequest(BaseModel):
    character_id: str = None  # None = all characters
    analysis_types: list[str] = ["relationships", "life_events"]


@app.post("/analyze-characters/{novel_id}")
async def analyze_characters_endpoint(novel_id: str, request: AnalyzeCharactersRequest = None):
    """วิเคราะห์ตัวละครใน novel - auto-run สำหรับ chapters ที่ยังไม่วิเคราะห์"""
    try:
        if request and request.character_id:
            # Analyze specific character
            characters = await fetch_characters(novel_id)
            char = next((c for c in characters if c["id"] == request.character_id), None)
            if not char:
                return {"success": False, "error": "Character not found"}
            
            result = await analyze_character_for_novel(
                novel_id, request.character_id, char.get("name", "")
            )
            return {"success": True, "suggestions": result}
        else:
            # Analyze all unanalyzed chapters
            result = await analyze_unanalyzed_chapters(novel_id)
            return {"success": True, "suggestions": result}
    except Exception as e:
        print(f"[AnalyzeCharacters] Error: {e}")
        return {"success": False, "error": str(e)}


class AnalyzeQueueRequest(BaseModel):
    character_id: str = None
    analysis_type: str = "all"


@app.post("/analyze-queue/{novel_id}")
async def trigger_analyze_queue(
    novel_id: str,
    request: AnalyzeQueueRequest,
    background_tasks: BackgroundTasks
):
    """Trigger character analysis from the database queue asynchronously in background"""
    background_tasks.add_task(
        process_analysis_queue_task,
        novel_id,
        request.character_id,
        request.analysis_type
    )
    return {"success": True, "message": "Background analysis task triggered."}


async def process_analysis_queue_task(
    novel_id: str,
    character_id: str = None,
    analysis_type: str = "all"
):
    """Worker loop to process pending analysis tasks in background"""
    print(f"[Worker] Starting background task for novel: {novel_id}")
    nextjs_base_url = os.getenv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000")
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. Fetch current queue statuses
            status_res = await client.get(
                f"{nextjs_base_url}/api/novel/{novel_id}/analysis-status",
                timeout=30.0
            )
            if status_res.status_code != 200:
                print(f"[Worker] Failed to fetch queue status: {status_res.text}")
                return
                
            status_data = status_res.json()
            chapters_data = status_data.get("chapters", [])
            
            # Find chapters with status 'pending'
            pending_chapters = [c for c in chapters_data if c.get("status") == "pending"]
            
            if not pending_chapters:
                print(f"[Worker] No pending chapters to analyze for novel {novel_id}")
                return
                
            print(f"[Worker] Found {len(pending_chapters)} pending chapters. Fetching characters...")
            characters = await fetch_characters(novel_id)
            
            # 2. Process each pending chapter
            for chapter in pending_chapters:
                chapter_id_val = chapter["id"]
                print(f"[Worker] Analyzing chapter {chapter_id_val} ({chapter.get('title', 'Untitled')})...")
                
                # Update queue status to 'processing'
                patch_res = await client.patch(
                    f"{nextjs_base_url}/api/novel/{novel_id}/analysis-status",
                    json={"chapterId": chapter_id_val, "status": "processing"},
                    timeout=10.0
                )
                if patch_res.status_code != 200:
                    print(f"[Worker] Failed to update status to processing for chapter {chapter_id_val}")
                
                try:
                    # Run AI analysis
                    result = await analyze_chapter(novel_id, chapter, characters)
                    
                    # Prepare AI suggestions payload
                    suggestions = []
                    for r in result.get("relationships", []):
                        r["suggestionType"] = "opinion_level"
                        r["sourceChapterId"] = chapter_id_val
                        suggestions.append(r)
                    for e in result.get("life_events", []):
                        e["suggestionType"] = "life_event"
                        e["sourceChapterId"] = chapter_id_val
                        suggestions.append(e)
                        
                    # Save AI Suggestions via Next.js
                    if suggestions:
                        sug_res = await client.post(
                            f"{nextjs_base_url}/api/novel/{novel_id}/ai-suggestions",
                            json={"suggestions": suggestions},
                            timeout=30.0
                        )
                        if sug_res.status_code != 200:
                            print(f"[Worker] Failed to save suggestions for chapter {chapter_id_val}: {sug_res.text}")
                            
                    # Update queue status to 'completed'
                    await client.patch(
                        f"{nextjs_base_url}/api/novel/{novel_id}/analysis-status",
                        json={"chapterId": chapter_id_val, "status": "completed"},
                        timeout=10.0
                    )
                    print(f"[Worker] Completed analysis for chapter {chapter_id_val}")
                    
                except Exception as ch_err:
                    print(f"[Worker] Error analyzing chapter {chapter_id_val}: {ch_err}")
                    # Update queue status to 'failed'
                    await client.patch(
                        f"{nextjs_base_url}/api/novel/{novel_id}/analysis-status",
                        json={"chapterId": chapter_id_val, "status": "failed", "error": str(ch_err)},
                        timeout=10.0
                    )
                    
    except Exception as e:
        print(f"[Worker] Critical error in background analysis task: {e}")


@app.get("/analyze-characters-stream/{novel_id}")
async def analyze_characters_stream(novel_id: str, character_id: str = None):
    """SSE endpoint for real-time character analysis progress"""
    
    print(f"\n{'='*50}")
    print(f"[SSE] === STARTING STREAM ===")
    print(f"[SSE] novel_id: {novel_id}")
    print(f"[SSE] character_id: {character_id}")
    print(f"{'='*50}\n")
    
    async def event_generator():
        import sys
        try:
            print("[SSE] Entering event_generator...")
            sys.stdout.flush()
            
            print("[SSE] Sending start event...")
            sys.stdout.flush()
            yield f"data: {json.dumps({'type': 'start'})}\n\n"
            
            print("[SSE] Fetching chapters...")
            chapters = await fetch_chapters(novel_id)
            print(f"[SSE] Got {len(chapters)} chapters")
            
            print("[SSE] Fetching characters...")
            characters = await fetch_characters(novel_id)
            print(f"[SSE] Got {len(characters)} characters")
            
            if len(chapters) == 0:
                print("[SSE] ERROR: No chapters found!")
                yield f"data: {json.dumps({'type': 'error', 'message': 'ไม่พบ chapters ใน novel นี้'})}\n\n"
                return
            
            if len(characters) == 0:
                print("[SSE] ERROR: No characters found!")
                yield f"data: {json.dumps({'type': 'error', 'message': 'ไม่พบ characters ใน novel นี้'})}\n\n"
                return
            
            if character_id:
                # Filter chapters that mention specific character
                char = next((c for c in characters if c["id"] == character_id), None)
                if not char:
                    print(f"[SSE] ERROR: Character {character_id} not found!")
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Character not found'})}\n\n"
                    return
                
                char_name = char.get("name", "")
                char_aliases = char.get("aliases", []) or []
                
                # Build list of all names to search for
                all_names = [char_name]
                if isinstance(char_aliases, list):
                    all_names.extend([str(a) for a in char_aliases if a])
                
                print(f"[SSE] Filtering chapters for character: {char_name}")
                print(f"[SSE] Character aliases: {char_aliases}")
                print(f"[SSE] Searching for names: {all_names}")
                sys.stdout.flush()
                
                # Debug: show chapter content preview
                for c in chapters:
                    preview = (c.get("plainText", "") or "")[:100]
                    print(f"[SSE] Chapter '{c.get('title')}' plainText preview: {preview}...")
                sys.stdout.flush()
                
                # Filter chapters that mention any of the character's names
                def mentions_character(chapter_text: str) -> bool:
                    text_lower = chapter_text.lower()
                    for name in all_names:
                        if name.lower() in text_lower:
                            print(f"[SSE] MATCH! Found '{name}' in chapter")
                            return True
                    return False
                
                chapters = [c for c in chapters if mentions_character(c.get("plainText", "") or "")]
                print(f"[SSE] Found {len(chapters)} chapters mentioning {char_name} or aliases")
                sys.stdout.flush()
            else:
                # No character filter - analyze all chapters
                print("[SSE] No character filter - will analyze all chapters")
                sys.stdout.flush()
            
            total = len(chapters)
            
            if total == 0:
                print("[SSE] No chapters to analyze, sending complete...")
                yield f"data: {json.dumps({'type': 'complete', 'message': 'ไม่มี chapters ใหม่ที่ต้องวิเคราะห์', 'suggestions': {'relationships': [], 'life_events': [], 'chapters_analyzed': []}})}\n\n"
                return
            
            info_msg = f'พบ {total} chapters ที่ต้องวิเคราะห์'
            print(f"[SSE] {info_msg}")
            sys.stdout.flush()
            yield f"data: {json.dumps({'type': 'info', 'total': total, 'message': info_msg}, ensure_ascii=False)}\n\n"
            
            all_suggestions = {
                "relationships": [],
                "life_events": [],
                "chapters_analyzed": []
            }
            
            for i, chapter in enumerate(chapters):
                chapter_title = chapter.get("title", "Untitled")
                chapter_content = chapter.get("plainText", "") or ""
                
                print(f"[SSE] Processing chapter {i+1}/{total}: {chapter_title}")
                print(f"[SSE] Content length: {len(chapter_content)} chars")
                
                yield f"data: {json.dumps({'type': 'progress', 'current': chapter_title, 'progress': i + 1, 'total': total}, ensure_ascii=False)}\n\n"
                
                print(f"[SSE] Calling analyze_chapter...")
                sys.stdout.flush()
                result = await analyze_chapter(novel_id, chapter, characters)
                
                print(f"[SSE] Result: {len(result['relationships'])} relationships, {len(result['life_events'])} life events")
                
                all_suggestions["relationships"].extend(result["relationships"])
                all_suggestions["life_events"].extend(result["life_events"])
                all_suggestions["chapters_analyzed"].append(chapter["id"])
                
                # Send intermediate results
                yield f"data: {json.dumps({'type': 'result', 'chapter_id': chapter['id'], 'chapter_title': chapter_title, 'relationships_found': len(result['relationships']), 'events_found': len(result['life_events'])}, ensure_ascii=False)}\n\n"
                
                # Small delay to avoid rate limiting
                await asyncio.sleep(0.5)
            
            print(f"[SSE] === COMPLETE ===")
            print(f"[SSE] Total relationships: {len(all_suggestions['relationships'])}")
            print(f"[SSE] Total life events: {len(all_suggestions['life_events'])}")
            yield f"data: {json.dumps({'type': 'complete', 'suggestions': all_suggestions}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            import traceback
            print(f"[SSE] ERROR: {e}")
            print(traceback.format_exc())
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "http://localhost:3000",
        }
    )


@app.get("/analysis-status/{novel_id}")
async def get_analysis_status(novel_id: str):
    """Get analysis status for a novel - which chapters have been analyzed"""
    try:
        chapters = await fetch_chapters(novel_id)
        analyzed_ids = await fetch_analyzed_chapters(novel_id)
        
        return {
            "success": True,
            "total_chapters": len(chapters),
            "analyzed_count": len(analyzed_ids),
            "unanalyzed_count": len(chapters) - len(analyzed_ids),
            "analyzed_chapter_ids": list(analyzed_ids)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================
# BACKGROUND JOB: CHECK ALL NOTES
# ============================================

def extract_plain_text(content) -> str:
    """Extract plain text from rich text content"""
    if not content:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        if "text" in content:
            return content["text"]
        if "ops" in content:
            return " ".join(op.get("insert", "") for op in content.get("ops", []) if isinstance(op.get("insert"), str))
    return str(content)


@app.post("/check-all-notes/{novel_id}")
async def check_all_notes(novel_id: str):
    """Background job: Check all unchecked notes for plot holes"""
    checked = 0
    errors = []
    
    try:
        # 1. Fetch unchecked notes from Next.js API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:3000/api/novel/{novel_id}/plot-hole-status",
                params={"uncheckedOnly": "true"},
                timeout=30.0
            )
            
            if response.status_code != 200:
                return {"success": False, "error": "Failed to fetch notes"}
            
            data = response.json()
            notes_to_check = data.get("notes", [])
        
        print(f"[PlotHoleJob] Found {len(notes_to_check)} notes to check")
        
        # 2. Check each note
        for note in notes_to_check:
            try:
                content_text = extract_plain_text(note.get("content", ""))
                
                if len(content_text.strip()) < 10:
                    # Skip short notes, mark as checked with 0 issues
                    await update_note_status(novel_id, note["id"], 0, [])
                    checked += 1
                    continue
                
                # Analyze using AI
                result = await analyze_plot(
                    novel_id=novel_id,
                    content_text=content_text,
                    context={"note_id": note["id"]}
                )
                
                issues = result.get("issues", [])
                
                # Update note status
                await update_note_status(novel_id, note["id"], len(issues), issues)
                checked += 1
                
                print(f"[PlotHoleJob] Checked: {note.get('title', 'Untitled')} - {len(issues)} issues")
                
            except Exception as e:
                errors.append(f"Note {note.get('title', note['id'])}: {str(e)}")
        
        return {
            "success": True,
            "checked": checked,
            "total": len(notes_to_check),
            "errors": errors
        }
        
    except Exception as e:
        return {"success": False, "error": str(e), "checked": checked}


async def update_note_status(novel_id: str, note_id: str, count: int, issues: list):
    """Update plot hole status for a note via Next.js API"""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"http://localhost:3000/api/novel/{novel_id}/plot-hole-status",
            json={
                "noteId": note_id,
                "plotHoleCount": count,
                "plotHoleIssues": issues
            },
            timeout=30.0
        )


# ============================================
# SSE STREAMING: REAL-TIME PROGRESS
# ============================================

from fastapi.responses import StreamingResponse
import asyncio


@app.get("/check-all-notes-stream/{novel_id}")
async def check_all_notes_stream(novel_id: str):
    """SSE endpoint for real-time plot hole checking progress"""
    
    async def event_generator():
        checked = 0
        
        try:
            # Send start event
            yield f"data: {json.dumps({'type': 'start'})}\n\n"
            
            # 1. Fetch unchecked notes
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:3000/api/novel/{novel_id}/plot-hole-status",
                    params={"uncheckedOnly": "true"},
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to fetch notes'})}\n\n"
                    return
                
                data = response.json()
                notes_to_check = data.get("notes", [])
            
            # Sort by updatedAt descending (newest first)
            notes_to_check.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
            
            total = len(notes_to_check)
            print(f"[PlotHoleJob] Found {total} notes to check (newest first)")
            
            # 2. Check each note
            for note in notes_to_check:
                try:
                    note_title = note.get("title", "Untitled")
                    
                    # Send progress update
                    yield f"data: {json.dumps({'type': 'progress', 'currentNote': note_title, 'checked': checked, 'total': total}, ensure_ascii=False)}\n\n"
                    
                    content_text = extract_plain_text(note.get("content", ""))
                    
                    if len(content_text.strip()) < 10:
                        await update_note_status(novel_id, note["id"], 0, [])
                        checked += 1
                        print(f"[PlotHoleJob] Skipped (too short): {note_title}")
                        continue
                    
                    # Analyze using AI
                    print(f"[PlotHoleJob] Analyzing: {note_title}")
                    result = await analyze_plot(
                        novel_id=novel_id,
                        content_text=content_text,
                        context={"note_id": note["id"]}
                    )
                    
                    issues = result.get("issues", [])
                    
                    # Update note status
                    await update_note_status(novel_id, note["id"], len(issues), issues)
                    checked += 1
                    
                    print(f"[PlotHoleJob] Checked: {note_title} - {len(issues)} issues found")
                    
                    # Small delay to avoid rate limiting
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    print(f"[PlotHoleJob] Error checking note: {e}")
                    checked += 1
            
            # Send complete event
            yield f"data: {json.dumps({'type': 'complete', 'checked': checked, 'total': total})}\n\n"
            print(f"[PlotHoleJob] Complete! Checked {checked}/{total} notes")
            
        except Exception as e:
            print(f"[PlotHoleJob] Fatal error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "http://localhost:3000",
        }
    )

# ============================================
# STYLOMETRY ANALYSIS ENDPOINTS
# ============================================

from stylometry import analyze_single_chapter_style

class StyleAnalyzeRequest(BaseModel):
    novel_id: str
    chapter_text: str
    character_names: list[str] = []

@app.post("/analyze-chapter-style")
async def analyze_chapter_style_endpoint(request: StyleAnalyzeRequest):
    """Analyze writing style, author voice, and mood for a single chapter"""
    try:
        content_text = extract_plain_text(request.chapter_text)
        if not content_text.strip():
            return {"success": False, "error": "Empty chapter text"}
            
        result = analyze_single_chapter_style(
            text=content_text,
            character_names=request.character_names
        )
        return {"success": True, "style_metrics": result}
    except Exception as e:
        print(f"[AnalyzeStyle] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


class FingerprintRequest(BaseModel):
    history: list[dict]
    current_metrics: dict


@app.post("/analyze-fingerprint")
async def analyze_fingerprint_endpoint(request: FingerprintRequest):
    """Analyze author writing style drift based on history and current metrics"""
    try:
        # Extract metrics from history list
        history_metrics = [AuthorFingerprint.extract_metrics(h) for h in request.history]
        
        # Initialize analyzer with history
        fingerprint = AuthorFingerprint(history=history_metrics)
        
        # Extract current metrics
        current = AuthorFingerprint.extract_metrics(request.current_metrics)
        
        # Analyze drift
        result = fingerprint.analyze_drift(current)
        
        return {"success": True, "fingerprint_analysis": result}
    except Exception as e:
        print(f"[Fingerprint] Error: {e}")
        return {"success": False, "error": str(e)}


class BulkFingerprintRequest(BaseModel):
    items: list[dict]


@app.post("/analyze-fingerprint-bulk")
async def analyze_fingerprint_bulk_endpoint(request: BulkFingerprintRequest):
    """Analyze author writing style drift for a sequence of items"""
    try:
        results = []
        history_pool = []
        
        # In bulk mode, we analyze each item against all items BEFORE it in the list
        for i, item in enumerate(request.items):
            current_metrics = AuthorFingerprint.extract_metrics(item)
            
            # Analyze against history pool
            fingerprint = AuthorFingerprint(history=history_pool)
            analysis = fingerprint.analyze_drift(current_metrics)
            
            results.append({
                "id": item.get("id"),
                "fingerprint_analysis": analysis
            })
            
            # Add current to pool for NEXT item
            history_pool.append(current_metrics)
            
        return {"success": True, "results": results}
    except Exception as e:
        print(f"[BulkFingerprint] Error: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# SPELL CHECK ENDPOINTS
# ============================================

from spell_checker import NovelSpellChecker, check_novel_text


class SpellCheckRequest(BaseModel):
    text: str
    custom_words: list[str] = []     # รูปเดิม — ชื่อล้วน ถือเป็นตัวละคร
    entities: list[dict] = []        # [{text, type}] คำเฉพาะของเรื่อง — ถูก mask ก่อนตรวจ
    novel_id: str = ""               # optional — ใช้สำหรับ logging


class SpellErrorResponse(BaseModel):
    word: str
    position: int
    offset: int
    suggestions: list[str]
    sentence: str
    sentence_index: int
    kind: str = "spelling"   # spelling | style (ทับศัพท์) | double_vowel (สระซ้อน) | elongation (ลากเสียง) | spacing (วรรคกลางคำ)


class SpellCheckResponse(BaseModel):
    success: bool
    total_words: int
    error_count: int
    errors: list[SpellErrorResponse]
    custom_words_used: list[str]
    entities_found: list[dict] = []  # [{name, type, count, offsets}] — ไว้ทำไฮไลต์/ผูกฉาก


@app.post("/spell-check", response_model=SpellCheckResponse)
def spell_check_endpoint(request: SpellCheckRequest):
    """
    ตรวจจับคำผิดในเนื้อหานิยาย
    - รองรับ custom_words เพื่อ whitelist ชื่อตัวละคร/สถานที่
    - คืน errors พร้อม suggestions และ context
    """
    if not request.text.strip():
        return SpellCheckResponse(
            success=True,
            total_words=0,
            error_count=0,
            errors=[],
            custom_words_used=[],
        )

    try:
        result = check_novel_text(
            text=request.text,
            custom_words=request.custom_words if request.custom_words else None,
            entities=request.entities or None,
        )

        return SpellCheckResponse(
            success=True,
            total_words=result.total_words,
            error_count=result.error_count,
            errors=[
                SpellErrorResponse(
                    word=e.word,
                    position=e.position,
                    offset=e.offset,
                    suggestions=e.suggestions,
                    sentence=e.sentence,
                    sentence_index=e.sentence_index,
                    kind=e.kind,
                )
                for e in result.errors
            ],
            custom_words_used=result.custom_words_used,
            entities_found=result.entities_found,
        )

    except Exception as e:
        print(f"[SpellCheck] Error: {e}")
        return SpellCheckResponse(
            success=False,
            total_words=0,
            error_count=0,
            errors=[],
            custom_words_used=[],
        )


class WordCheckRequest(BaseModel):
    word: str
    custom_words: list[str] = []


@app.post("/spell-check/word")
def spell_check_word_endpoint(request: WordCheckRequest):
    """ตรวจคำเดียว — สำหรับ inline real-time check"""
    checker = NovelSpellChecker(custom_words=request.custom_words or None)
    return checker.check_word(request.word)


# ============================================
# BACKGROUND SPELL CHECK (trigger จากการเปลี่ยนสถานะ note)
# ============================================

class SpellCheckNoteRequest(BaseModel):
    noteId: str
    novelId: str
    text: str                    # HTML จาก DB (ตรวจตอนเปลี่ยนสถานะ) หรือข้อความล่าสุดจาก editor (ปุ่มตรวจ)
    customWords: list[str] = []
    entities: list[dict] = []    # [{text, type}]
    setStatus: bool = False      # True = ตรวจจากการเปลี่ยนสถานะ -> เสร็จแล้วตั้ง user_verify


# คิวตรวจคำผิดกลางของทั้ง service — worker เดียว ทำทีละบท
#
# วัดแล้ว (2026-10-14): ตรวจบทละ ~100-160 วิ (HF CPU เป็นคอขวด) และหลายงานพร้อมกันก็แค่ต่อคิวกันที่ HF
# อยู่ดี (4 งานพร้อมกัน งานสุดท้าย 417 วิ) การรันทีละงานจึงไม่ช้าลง แต่คุมโหลดได้ และบอกลำดับคิวให้ผู้ใช้เห็นได้
# งานจากปุ่มตรวจ / เปลี่ยนสถานะ / ตรวจทั้งคิว เข้าคิวเดียวกันหมด ผู้ใช้ปิดหน้าหรือ logout งานก็ยังเดินต่อ
#
# ponytail: คิว + สถานะอยู่ในหน่วยความจำ — Render restart แล้วหายทั้งคู่ (หน้าจอเห็น "unknown" ให้กดใหม่)
# ถ้าต้องรอด restart ให้ย้ายไป Redis (Upstash มีอยู่แล้วแต่ยังไม่ได้ตั้ง REDIS_URL บน Render)
import threading
from collections import deque

SPELL_JOBS: dict = {}          # noteId -> {state: queued|running|done|error, ...}
SPELL_QUEUE: deque = deque()   # SpellCheckNoteRequest ที่รอตรวจ
_SPELL_LOCK = threading.Lock()
_SPELL_WAKE = threading.Event()
_SPELL_WORKER = None


def _spell_worker_loop():
    while True:
        _SPELL_WAKE.wait()
        while True:
            with _SPELL_LOCK:
                if not SPELL_QUEUE:
                    _SPELL_WAKE.clear()
                    break
                req = SPELL_QUEUE.popleft()
                SPELL_JOBS[req.noteId] = {"state": "running", "startedAt": __import__("time").time()}
            process_spell_check_task(req)


def _enqueue_spell(req) -> dict:
    """ใส่คิว — ตอนที่รอคิว/กำลังตรวจอยู่แล้วไม่ใส่ซ้ำ (รอคิวอยู่ = อัปเดตข้อความ/ตัวเลือกเป็นของล่าสุด)"""
    global _SPELL_WORKER
    with _SPELL_LOCK:
        state = SPELL_JOBS.get(req.noteId, {}).get("state")
        if state == "running":
            return {"state": "running"}
        for i, q in enumerate(SPELL_QUEUE):
            if q.noteId == req.noteId:
                SPELL_QUEUE[i] = req
                return {"state": "queued", "position": i + 1}
        SPELL_QUEUE.append(req)
        SPELL_JOBS[req.noteId] = {"state": "queued"}
        if _SPELL_WORKER is None or not _SPELL_WORKER.is_alive():
            _SPELL_WORKER = threading.Thread(target=_spell_worker_loop, daemon=True, name="spell-worker")
            _SPELL_WORKER.start()
        _SPELL_WAKE.set()
        return {"state": "queued", "position": len(SPELL_QUEUE)}


def _job_status(note_id: str) -> dict:
    job = dict(SPELL_JOBS.get(note_id, {"state": "unknown"}))
    if job["state"] == "queued":
        pos = next((i + 1 for i, q in enumerate(SPELL_QUEUE) if q.noteId == note_id), None)
        job["position"] = pos
    return job


@app.post("/spell-check-note")
def spell_check_note_endpoint(request: SpellCheckNoteRequest):
    """ใส่โน้ตเข้าคิวตรวจ — ตอบทันที พร้อมลำดับคิว"""
    return {"success": True, **_enqueue_spell(request)}


@app.get("/spell-check-note/status/{note_id}")
def spell_check_note_status(note_id: str):
    """queued (+position) | running | done | error | unknown (ไม่เคยสั่ง หรือ service restart ไปแล้ว)"""
    return _job_status(note_id)


@app.get("/spell-queue/status")
def spell_queue_status(ids: str = ""):
    """สถานะหลายโน้ตในคำขอเดียว (แผงความคืบหน้าในคิวแก้ไข) — ids คั่นด้วย ,"""
    return {"jobs": {i: _job_status(i) for i in ids.split(",") if i},
            "queueLength": len(SPELL_QUEUE)}


class SpellQueueCancelRequest(BaseModel):
    noteIds: list[str]


@app.post("/spell-queue/cancel")
def spell_queue_cancel(request: SpellQueueCancelRequest):
    """ถอนตอนที่ยังรอคิวออก — ตอนที่กำลังตรวจอยู่ตรวจต่อจนเสร็จ"""
    ids = set(request.noteIds)
    with _SPELL_LOCK:
        removed = [q.noteId for q in SPELL_QUEUE if q.noteId in ids]
        for q in [q for q in SPELL_QUEUE if q.noteId in ids]:
            SPELL_QUEUE.remove(q)
        for i in removed:
            SPELL_JOBS.pop(i, None)
    return {"success": True, "cancelled": len(removed)}


def _issue_description(err) -> str:
    sug = err.suggestions
    if err.kind == "repeated":
        return (f"คำนี้ถูกขีด {err.count} ครั้งในบทนี้ — เป็นชื่อ/ศัพท์ในเรื่องหรือเปล่า? "
                f"ถ้าใช่ เพิ่มในข้อมูลตัวละคร/ศัพท์แล้วตรวจใหม่"
                + (f" · ถ้าสะกดผิด แนะนำ: {sug[0]}" if sug else ""))
    if err.kind == "style":
        return f"ทับศัพท์ไม่ตรงหลักราชบัณฑิตฯ — แนะนำ: {sug[0]} (แก้หรือไม่ก็ได้)"
    if err.kind == "double_vowel":
        return f"สระ/วรรณยุกต์ซ้อน — แนะนำ: {', '.join(sug[:3])}"
    if err.kind == "elongation":
        return f"ลากเสียงยาว ตั้งใจหรือเปล่า? — ถ้าไม่ตั้งใจ: {sug[0]}"
    if err.kind == "spacing":
        return f"เว้นวรรคกลางคำ — ควรเป็น: {sug[0]}"
    if sug:
        return f"คำสะกดผิด — แนะนำ: {', '.join(sug[:3])}"
    return "อาจสะกดผิด — ไม่มีคำแนะนำอัตโนมัติ โปรดตรวจสอบเอง"


def process_spell_check_task(req: SpellCheckNoteRequest):
    """
    Worker: ตรวจ -> เขียน note_audit_issues ลง Neon ตรง (ลบของเก่า + ใส่ใหม่ใน transaction เดียว)

    รันใน thread ของ worker คิว (_spell_worker_loop) ไม่ใช่ใน event loop — งานนี้เรียก HF นาน ~2 นาที/บท

    เดิมยิงกลับไปที่ API ของ Next (/audit-issues, /status) แต่ route พวกนั้นต้องมี session ผู้ใช้
    Python ไม่มี cookie จึงได้ 401 เงียบ ๆ ผลไม่เคยถูกบันทึก — เขียน DB เองตรงนี้แทน
    """
    import time
    from lance_client import _connect
    t0 = time.time()
    print(f"[SpellCheckWorker] เริ่มตรวจ note {req.noteId} ({len(req.text)} chars, {len(req.entities)} entities)")
    try:
        result = check_novel_text(text=req.text, custom_words=req.customWords or None,
                                  entities=req.entities or None)
        conn = _connect()
        try:
            with conn, conn.cursor() as cur:  # with conn = commit ทั้งก้อน หรือ rollback ทั้งก้อน
                cur.execute("DELETE FROM note_audit_issues WHERE note_id = %s AND novel_id = %s AND category = 'spelling'",
                            (req.noteId, req.novelId))
                for err in result.errors:
                    has = bool(err.suggestions)
                    cur.execute(
                        """INSERT INTO note_audit_issues
                           (novel_id, note_id, level, category, start_index, end_index, flagged_text,
                            issue_description, suggested_text, suggestion_notes)
                           VALUES (%s, %s, %s, 'spelling', %s, %s, %s, %s, %s, %s)""",
                        (req.novelId, req.noteId, "proofreading" if has else "line",
                         err.offset, err.offset + len(err.word), err.word, _issue_description(err),
                         err.suggestions[0] if has else None,
                         None if has else "ระบบหาคำที่ถูกต้องไม่ได้"),
                    )
                if req.setStatus:
                    cur.execute("UPDATE notes SET status = 'user_verify', updated_at = now() WHERE id = %s",
                                (req.noteId,))
        finally:
            conn.close()
        SPELL_JOBS[req.noteId] = {"state": "done", "count": len(result.errors), "seconds": round(time.time() - t0, 1)}
        print(f"[SpellCheckWorker] เสร็จ — {len(result.errors)} issues, {time.time() - t0:.1f}s"
              + (", status → user_verify" if req.setStatus else ""))
    except Exception as e:
        # ไม่แตะรายการเดิม (DELETE อยู่ใน transaction เดียวกับ INSERT ถ้าล้มก็ rollback ทั้งคู่)
        SPELL_JOBS[req.noteId] = {"state": "error", "error": str(e)[:200]}
        print(f"[SpellCheckWorker] Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)




