"""
FastAPI Vector Search Service
Provides REST API for all content vector sync and search
"""

from fastapi import FastAPI, HTTPException
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)




