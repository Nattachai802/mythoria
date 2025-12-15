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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)




