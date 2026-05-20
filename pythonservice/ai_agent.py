"""
AI Agent with Typhoon + LangChain Function Calling
Orchestrates LLM with MCP Tools for plot hole detection
"""

import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field
from typing import Optional

from tools.timeline_checker import check_timeline_conflict
from tools.character_validator import validate_character_consistency
from lance_client import search_similar
from embeddings import generate_embedding

load_dotenv()

# Typhoon API Configuration
TYPHOON_API_KEY = os.getenv("TYPHOON_API_KEY")
if not TYPHOON_API_KEY:
    raise RuntimeError("TYPHOON_API_KEY is not set. Please add it to your .env file.")

# Initialize Typhoon LLM via LangChain
llm = ChatOpenAI(
    model="typhoon-v2.1-12b-instruct",
    base_url="https://api.opentyphoon.ai/v1",
    api_key=TYPHOON_API_KEY,
    temperature=0.3
)


# ============================================
# TOOL DEFINITIONS (Pydantic)
# ============================================

class CheckTimelineConflict(BaseModel):
    """ตรวจสอบว่าตัวละครสามารถเดินทางจากสถานที่หนึ่งไปอีกสถานที่หนึ่งได้ทันตาม timeline หรือไม่"""
    
    character_id: str = Field(..., description="ID ของตัวละครที่ต้องการตรวจสอบ")
    from_note_id: str = Field(..., description="ID ของ note/scene จุดเริ่มต้น")
    to_note_id: str = Field(..., description="ID ของ note/scene จุดปลายทาง")
    time_elapsed_hours: Optional[float] = Field(None, description="เวลาที่ผ่านไประหว่าง 2 scenes (ชั่วโมง)")


class ValidateCharacterConsistency(BaseModel):
    """ตรวจสอบว่า action ของตัวละครสอดคล้องกับสถานะปัจจุบัน (สุขภาพ, พลังงาน, อุปกรณ์)"""
    
    character_id: str = Field(..., description="ID ของตัวละคร")
    note_id: str = Field(..., description="ID ของ note/scene ที่ต้องการตรวจสอบ")
    action_text: str = Field(..., description="ข้อความที่อธิบาย action ของตัวละคร")


class SearchStoryContext(BaseModel):
    """ค้นหาบริบทที่เกี่ยวข้องจากเนื้อเรื่องทั้งหมด (ตัวละคร, สถานที่, บท, notes)"""
    
    query: str = Field(..., description="คำค้นหา เช่น 'ฉากต่อสู้ที่ปราสาท'")
    content_type: Optional[str] = Field(None, description="ประเภทเนื้อหา: character, note, chapter, location")
    limit: int = Field(5, description="จำนวนผลลัพธ์สูงสุด")


# Bind tools to LLM
TOOLS = [CheckTimelineConflict, ValidateCharacterConsistency, SearchStoryContext]
llm_with_tools = llm.bind_tools(TOOLS)


# ============================================
# TOOL EXECUTION
# ============================================

async def execute_tool(tool_call: dict, novel_id: str) -> dict:
    """Execute a tool and return the result"""
    name = tool_call.get("name")
    args = tool_call.get("args", {})
    
    try:
        if name == "CheckTimelineConflict":
            return await check_timeline_conflict(
                novel_id=novel_id,
                character_id=args.get("character_id"),
                from_note_id=args.get("from_note_id"),
                to_note_id=args.get("to_note_id"),
                time_elapsed_hours=args.get("time_elapsed_hours", 0)
            )
        
        elif name == "ValidateCharacterConsistency":
            return await validate_character_consistency(
                novel_id=novel_id,
                character_id=args.get("character_id"),
                note_id=args.get("note_id"),
                action_text=args.get("action_text")
            )
        
        elif name == "SearchStoryContext":
            query = args.get("query", "")
            limit = args.get("limit", 5)
            content_type = args.get("content_type")
            
            query_vector = generate_embedding(query)
            results = search_similar(query_vector, novel_id, limit, content_type if content_type != "all" else None)
            
            return {
                "query": query,
                "results": [
                    {
                        "title": r.get("title"),
                        "content": r.get("content")[:200] if r.get("content") else "",
                        "type": r.get("content_type")
                    }
                    for r in results
                ]
            }
        
        return {"error": f"Unknown tool: {name}"}
        
    except Exception as e:
        return {"error": str(e)}


# ============================================
# MAIN ANALYZE FUNCTION
# ============================================

SYSTEM_PROMPT = """คุณเป็นผู้ช่วยตรวจสอบความสอดคล้องของนิยาย (Plot Hole Checker)
หน้าที่ของคุณคือวิเคราะห์เนื้อหาที่ผู้ใช้เขียน และตรวจหาความไม่สอดคล้อง เช่น:

1. **Timeline Conflict**: ตัวละครปรากฏที่สถานที่ต่างกันโดยไม่มีเวลาเดินทางพอ
2. **Character Inconsistency**: ตัวละครทำสิ่งที่ขัดกับสถานะปัจจุบัน (บาดเจ็บแต่วิ่งได้ปกติ)
3. **Context Mismatch**: เหตุการณ์ขัดแย้งกับสิ่งที่เคยเกิดขึ้นในเรื่อง

คุณมี Tools ที่สามารถใช้ได้:
- CheckTimelineConflict: ตรวจสอบความเป็นไปได้ของการเดินทาง
- ValidateCharacterConsistency: ตรวจสอบ action กับสถานะตัวละคร  
- SearchStoryContext: ค้นหาบริบทจากเนื้อเรื่อง

วิเคราะห์เนื้อหาและสรุปผลเป็นภาษาไทย ถ้าไม่พบปัญหาให้บอกว่าไม่พบปัญหา"""


async def analyze_plot(
    novel_id: str,
    content_text: str,
    context: dict = None
) -> dict:
    """
    Analyze content for plot holes using Typhoon with function calling
    """
    context = context or {}
    tool_calls_made = []
    tool_results = []
    
    # Build user message
    user_message = f"""วิเคราะห์เนื้อหานี้หา Plot Holes:

{content_text}

ข้อมูลเพิ่มเติม:
- Novel ID: {novel_id}
- Character IDs: {context.get('character_ids', 'ไม่ระบุ')}
- Note/Scene ID: {context.get('note_id', 'ไม่ระบุ')}

กรุณาวิเคราะห์และสรุปผลให้ผู้ใช้ ถ้าต้องการข้อมูลเพิ่มเติม ให้ใช้ Tools ที่มี"""

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_message)
    ]
    
    try:
        # First LLM call
        response = llm_with_tools.invoke(messages)
        messages.append(response)
        
        # Process tool calls if any
        max_iterations = 3
        iteration = 0
        
        while response.tool_calls and iteration < max_iterations:
            iteration += 1
            
            for tool_call in response.tool_calls:
                tool_calls_made.append({
                    "tool": tool_call.get("name"),
                    "args": tool_call.get("args")
                })
                
                # Execute the tool
                result = await execute_tool(tool_call, novel_id)
                tool_results.append({
                    "tool": tool_call.get("name"),
                    "result": result
                })
                
                # Add tool result to messages
                tool_msg = ToolMessage(
                    content=json.dumps(result, ensure_ascii=False),
                    name=tool_call["name"],
                    tool_call_id=tool_call["id"]
                )
                messages.append(tool_msg)
            
            # Get next response
            response = llm_with_tools.invoke(messages)
            messages.append(response)
        
        # Extract final analysis
        final_text = response.content if hasattr(response, 'content') else str(response)
        
        # Parse issues from tool results
        issues = []
        for tr in tool_results:
            if tr["tool"] == "CheckTimelineConflict":
                if tr["result"].get("conflict"):
                    issues.append({
                        "type": "timeline_conflict",
                        "description": tr["result"].get("reason", "พบความขัดแย้งด้าน timeline")
                    })
            
            elif tr["tool"] == "ValidateCharacterConsistency":
                if not tr["result"].get("valid", True):
                    for conflict in tr["result"].get("conflicts", []):
                        issues.append({
                            "type": "character_inconsistency",
                            "description": conflict.get("reason", "พบความไม่สอดคล้องของตัวละคร")
                        })
        
        return {
            "analysis": final_text,
            "issues": issues,
            "tool_calls": tool_calls_made,
            "tool_results": tool_results
        }
        
    except Exception as e:
        print(f"[Typhoon] Error: {e}")
        return {
            "analysis": f"เกิดข้อผิดพลาด: {str(e)}",
            "issues": [],
            "tool_calls": tool_calls_made,
            "tool_results": tool_results
        }
