"""
Character Analyzer - AI วิเคราะห์ตัวละครจากเนื้อเรื่อง
Uses Typhoon AI + LanceDB for context

Features:
1. วิเคราะห์ Opinion Level ระหว่างตัวละคร
2. ดึง Life Events จากเนื้อหา
3. ติดตาม Relationship Changes
"""

import os
import json
import httpx
import asyncio
import time
import hashlib
import redis
from typing import Optional
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from lance_client import search_similar
from embeddings import generate_embedding

load_dotenv()

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL")
redis_client = None
if REDIS_URL:
    try:
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        print("[Redis] Connected successfully")
    except Exception as e:
        print(f"[Redis] Connection error: {e}")

def get_cached_llm(prompt_hash: str) -> Optional[str]:
    if redis_client:
        try:
            return redis_client.get(f"llm_cache:{prompt_hash}")
        except Exception as e:
            print(f"[Redis] Cache get error: {e}")
    return None

def set_cached_llm(prompt_hash: str, response_text: str, ttl: int = 86400):
    if redis_client:
        try:
            redis_client.setex(f"llm_cache:{prompt_hash}", ttl, response_text)
        except Exception as e:
            print(f"[Redis] Cache set error: {e}")

def generate_prompt_hash(system_prompt: str, user_prompt: str) -> str:
    combined = f"system:{system_prompt}|user:{user_prompt}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


# Typhoon API Configuration
TYPHOON_API_KEY = os.getenv("TYPHOON_API_KEY")
if not TYPHOON_API_KEY:
    raise RuntimeError("TYPHOON_API_KEY is not set. Please add it to your .env file.")

# Initialize Typhoon LLM
llm = ChatOpenAI(
    model="typhoon-v2.1-12b-instruct",
    base_url="https://api.opentyphoon.ai/v1",
    api_key=TYPHOON_API_KEY,
    temperature=0.3,
    max_tokens=4096  # Increase max_tokens to handle longer prompts
)

# ============================================
# PROMPTS
# ============================================

RELATIONSHIP_PROMPT = """วิเคราะห์ความสัมพันธ์ระหว่างตัวละครจากเนื้อหานี้

ตัวละครที่เกี่ยวข้อง:
{characters}

เนื้อหา:
{content}

สำหรับแต่ละคู่ตัวละครที่มี interaction ให้ประเมิน:
1. source_character_id และ source_character_name: ID และชื่อของตัวละครที่มีความรู้สึก
2. target_character_id และ target_character_name: ID และชื่อของตัวละครเป้าหมาย
3. opinion_level (0-100): 0=เกลียดมาก, 50=กลาง, 100=รักมาก
4. sentiment: positive/negative/neutral/mixed
5. reason: เหตุผลที่ได้ค่านั้น (อ้างอิงจากเนื้อหา)
6. confidence: ความมั่นใจ 0-100

ตอบเป็น JSON array เท่านั้น ตัวอย่าง:
[
  {{
    "source_character_id": "char-id-1",
    "source_character_name": "ชื่อตัวละคร1",
    "target_character_id": "char-id-2",
    "target_character_name": "ชื่อตัวละคร2",
    "opinion_level": 75,
    "sentiment": "positive",
    "reason": "ช่วยเหลือกันในการต่อสู้",
    "confidence": 80
  }}
]

ถ้าไม่มี interaction ที่ชัดเจน ให้ตอบ []"""

LIFE_EVENTS_PROMPT = """ค้นหาเหตุการณ์สำคัญในชีวิตตัวละครจากเนื้อหานี้

ตัวละคร: {character_name} (ID: {character_id})

เนื้อหา:
{content}

มองหาเหตุการณ์ที่:
- มีผลกระทบต่อตัวละคร (บาดแผล, ความสำเร็จ, การสูญเสีย, การค้นพบ)
- เปลี่ยนแปลงบุคลิก/เป้าหมาย/แรงจูงใจ
- เป็นจุดเปลี่ยนสำคัญในเรื่อง

สำหรับแต่ละเหตุการณ์ให้ระบุ:
- title: ชื่อเหตุการณ์ (สั้น กระชับ ภาษาไทย)
- description: รายละเอียด (ภาษาไทย)
- event_type: trauma/achievement/loss/discovery/transformation/relationship/power/other
- impact: positive/negative/neutral
- importance: 1-10
- changed_traits: ลักษณะที่เปลี่ยน เช่น ["personality", "goals", "motivation"]

ตอบเป็น JSON array เท่านั้น ตัวอย่าง:
[
  {{
    "title": "ได้รับพลังพิเศษ",
    "description": "ตัวละครค้นพบพลังพิเศษหลังจากเหตุการณ์ใกล้ตาย",
    "event_type": "power",
    "impact": "positive",
    "importance": 8,
    "changed_traits": ["goals", "abilities"]
  }}
]

ถ้าไม่พบเหตุการณ์สำคัญ ให้ตอบ []"""


# ============================================
# HELPER FUNCTIONS
# ============================================

def parse_json_response(text: str) -> list:
    """Parse JSON from LLM response, handling markdown code blocks"""
    text = text.strip()
    
    # Remove markdown code block if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    
    try:
        result = json.loads(text)
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError:
        # Try to extract JSON array from text
        import re
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
        return []


async def get_story_context(novel_id: str, query: str, limit: int = 5) -> str:
    """Get relevant context from LanceDB"""
    try:
        query_vector = generate_embedding(query)
        results = search_similar(query_vector, novel_id, limit)
        
        context_parts = []
        for r in results:
            title = r.get("title", "")
            content = r.get("content", "")[:200]
            content_type = r.get("content_type", "")
            context_parts.append(f"[{content_type}] {title}: {content}")
        
        return "\n".join(context_parts)
    except Exception as e:
        print(f"[Context] Error: {e}")
        return ""


_analysis_data_cache = {}

async def fetch_analysis_data(novel_id: str) -> dict:
    """Fetch chapters and characters from Next.js API with a 5-second TTL cache"""
    now = time.time()
    cached = _analysis_data_cache.get(novel_id)
    if cached is None or (now - cached["timestamp"]) > 5.0:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:3000/api/novel/{novel_id}/analysis-data",
                    timeout=30.0
                )
                if response.status_code == 200:
                    _analysis_data_cache[novel_id] = {
                        "data": response.json(),
                        "timestamp": now
                    }
                else:
                    _analysis_data_cache[novel_id] = {
                        "data": {},
                        "timestamp": now
                    }
        except Exception as e:
            print(f"[Fetch] Error fetching analysis data: {e}")
            return {}
    return _analysis_data_cache[novel_id]["data"]


async def fetch_chapters(novel_id: str) -> list:
    """Fetch chapters from Next.js API"""
    data = await fetch_analysis_data(novel_id)
    chapters = data.get("chapters", [])
    print(f"[Fetch] Got {len(chapters)} chapters")
    return chapters


async def fetch_characters(novel_id: str) -> list:
    """Fetch characters from Next.js API"""
    data = await fetch_analysis_data(novel_id)
    characters = data.get("characters", [])
    print(f"[Fetch] Got {len(characters)} characters")
    return characters


async def fetch_analyzed_chapters(novel_id: str) -> set:
    """Fetch list of already-analyzed chapter IDs"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:3000/api/novel/{novel_id}/analysis-status",
                timeout=30.0
            )
            if response.status_code == 200:
                data = response.json()
                return set(data.get("analyzedChapterIds", []))
    except Exception as e:
        print(f"[Fetch] Error fetching analysis status: {e}")
    return set()


# ============================================
# ANALYZER FUNCTIONS
# ============================================

async def analyze_relationships(
    novel_id: str,
    chapter_id: str,
    characters: list[dict],
    content: str
) -> list[dict]:
    """วิเคราะห์ Opinion Level จากเนื้อหา"""
    
    print(f"[analyze_relationships] Starting...")
    print(f"[analyze_relationships] Content length: {len(content)}")
    
    if len(content.strip()) < 50:
        print("[analyze_relationships] Content too short, skipping")
        return []
    
    # Filter characters mentioned in content
    mentioned_chars = [
        c for c in characters
        if c.get("name", "").lower() in content.lower()
    ]
    
    print(f"[analyze_relationships] Mentioned characters: {[c.get('name') for c in mentioned_chars]}")
    
    if len(mentioned_chars) < 2:
        print("[analyze_relationships] Less than 2 characters mentioned, skipping")
        return []  # Need at least 2 characters for relationships
    
    # Build character list
    char_list = "\n".join([
        f"- {c['name']} (ID: {c['id']}): {c.get('description', '')[:100]}"
        for c in mentioned_chars
    ])
    
    # Get context from LanceDB
    print("[analyze_relationships] Getting story context...")
    context = await get_story_context(novel_id, content[:500])
    print(f"[analyze_relationships] Context length: {len(context)}")
    
    prompt = RELATIONSHIP_PROMPT.format(
        characters=char_list,
        content=content[:3000] + ("\n\n[บริบทเพิ่มเติม]\n" + context if context else "")
    )
    
    try:
        system_content = "คุณช่วยวิเคราะห์ความสัมพันธ์ในนิยาย ตอบเป็น JSON array เท่านั้น"
        prompt_hash = generate_prompt_hash(system_content, prompt)
        
        cached_response = get_cached_llm(prompt_hash)
        if cached_response:
            print("[analyze_relationships] Cache hit! Returning cached results.")
            results = parse_json_response(cached_response)
        else:
            print("[analyze_relationships] Calling Typhoon LLM...")
            response = await llm.ainvoke([
                SystemMessage(content=system_content),
                HumanMessage(content=prompt)
            ])
            
            print(f"[analyze_relationships] ===== TYPHOON FULL RESPONSE =====")
            print(response.content)
            print(f"[analyze_relationships] ===== END RESPONSE =====")
            
            results = parse_json_response(response.content)
            if results:
                set_cached_llm(prompt_hash, response.content)
                
        print(f"[analyze_relationships] Parsed {len(results)} relationships")
        
        # Add chapter_id to each result
        for r in results:
            r["chapter_id"] = chapter_id
        
        return results
        
    except Exception as e:
        import traceback
        print(f"[analyze_relationships] ERROR: {e}")
        print(traceback.format_exc())
        return []


async def analyze_life_events(
    novel_id: str,
    chapter_id: str,
    character_id: str,
    character_name: str,
    content: str
) -> list[dict]:
    """วิเคราะห์ Life Events จากเนื้อหา"""
    
    if len(content.strip()) < 50:
        return []
    
    # Check if character is mentioned
    if character_name.lower() not in content.lower():
        return []
    
    prompt = LIFE_EVENTS_PROMPT.format(
        character_name=character_name,
        character_id=character_id,
        content=content[:3000]
    )
    
    try:
        system_content = "คุณช่วยค้นหาเหตุการณ์สำคัญในชีวิตตัวละคร ตอบเป็น JSON array เท่านั้น"
        prompt_hash = generate_prompt_hash(system_content, prompt)
        
        cached_response = get_cached_llm(prompt_hash)
        if cached_response:
            print(f"[LifeEvents] Cache hit for {character_name}! Returning cached results.")
            results = parse_json_response(cached_response)
        else:
            print(f"[LifeEvents] Calling Typhoon LLM for {character_name}...")
            response = await llm.ainvoke([
                SystemMessage(content=system_content),
                HumanMessage(content=prompt)
            ])
            
            print(f"[LifeEvents] ===== TYPHOON FULL RESPONSE =====")
            print(response.content)
            print(f"[LifeEvents] ===== END RESPONSE =====")
            
            results = parse_json_response(response.content)
            if results:
                set_cached_llm(prompt_hash, response.content)
        
        # Add metadata to each result
        for r in results:
            r["character_id"] = character_id
            r["chapter_id"] = chapter_id
        
        return results
        
    except Exception as e:
        print(f"[LifeEvents] Error: {e}")
        return []


async def analyze_chapter(
    novel_id: str,
    chapter: dict,
    characters: list[dict]
) -> dict:
    """วิเคราะห์ chapter เดียว"""
    
    chapter_title = chapter.get("title", "Untitled")
    print(f"\n[analyze_chapter] ========== {chapter_title} ==========")
    
    content = chapter.get("plainText", "") or ""
    print(f"[analyze_chapter] Content length: {len(content)}")
    
    if len(content) < 50:
        print("[analyze_chapter] Content too short, skipping")
        return {"relationships": [], "life_events": []}
    
    chapter_id = chapter["id"]
    
    # 1. Analyze relationships
    print("[analyze_chapter] Analyzing relationships...")
    relationships = await analyze_relationships(
        novel_id, chapter_id, characters, content
    )
    # Add chapter_title to each relationship
    for r in relationships:
        r["chapter_title"] = chapter_title
    print(f"[analyze_chapter] Found {len(relationships)} relationships")
    
    # 2. Analyze life events for each character mentioned
    print("[analyze_chapter] Analyzing life events...")
    life_events = []
    
    # Filter mentioned characters first
    mentioned_characters = [
        char for char in characters
        if char.get("name", "").lower() in content.lower()
    ]
    
    if mentioned_characters:
        # Create async tasks to analyze life events for all mentioned characters in parallel
        tasks = [
            analyze_life_events(novel_id, chapter_id, char["id"], char.get("name", ""), content)
            for char in mentioned_characters
        ]
        
        # Run all LLM tasks concurrently
        print(f"[analyze_chapter] Running life event analysis for {len(tasks)} characters concurrently...")
        results = await asyncio.gather(*tasks)
        
        # Process results
        for char, events in zip(mentioned_characters, results):
            for e in events:
                e["chapter_title"] = chapter_title
            print(f"[analyze_chapter] Found {len(events)} events for {char.get('name')}")
            life_events.extend(events)
    
    print(f"[analyze_chapter] Total: {len(relationships)} relationships, {len(life_events)} life events")
    
    return {
        "relationships": relationships,
        "life_events": life_events
    }


async def analyze_character_for_novel(
    novel_id: str,
    character_id: str,
    character_name: str
) -> dict:
    """วิเคราะห์เฉพาะตัวละครเดียว จาก chapters ทั้งหมด"""
    
    chapters = await fetch_chapters(novel_id)
    all_characters = await fetch_characters(novel_id)
    
    all_relationships = []
    all_life_events = []
    
    for chapter in chapters:
        content = chapter.get("plainText", "") or ""
        if character_name.lower() not in content.lower():
            continue
        
        chapter_id = chapter["id"]
        
        # Relationships involving this character
        rels = await analyze_relationships(
            novel_id, chapter_id, all_characters, content
        )
        # Filter to only include relationships with this character
        rels = [r for r in rels if r.get("source_character_id") == character_id 
                or r.get("target_character_id") == character_id]
        all_relationships.extend(rels)
        
        # Life events for this character
        events = await analyze_life_events(
            novel_id, chapter_id, character_id, character_name, content
        )
        all_life_events.extend(events)
    
    return {
        "character_id": character_id,
        "relationships": all_relationships,
        "life_events": all_life_events
    }


async def analyze_unanalyzed_chapters(novel_id: str) -> dict:
    """วิเคราะห์เฉพาะ chapters ที่ยังไม่เคยวิเคราะห์"""
    
    # Get all chapters and characters
    chapters = await fetch_chapters(novel_id)
    characters = await fetch_characters(novel_id)
    
    # Get already analyzed chapters
    analyzed_ids = await fetch_analyzed_chapters(novel_id)
    
    # Filter to unanalyzed only
    unanalyzed = [c for c in chapters if c["id"] not in analyzed_ids]
    
    print(f"[Analyzer] Found {len(unanalyzed)} unanalyzed chapters out of {len(chapters)}")
    
    all_suggestions = {
        "relationships": [],
        "life_events": [],
        "chapters_analyzed": []
    }
    
    for chapter in unanalyzed:
        result = await analyze_chapter(novel_id, chapter, characters)
        all_suggestions["relationships"].extend(result["relationships"])
        all_suggestions["life_events"].extend(result["life_events"])
        all_suggestions["chapters_analyzed"].append(chapter["id"])
        print(f"[Analyzer] Analyzed: {chapter.get('title', 'Untitled')}")
    
    return all_suggestions
