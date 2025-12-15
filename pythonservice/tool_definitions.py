"""
Tool Definitions for Gemini Function Calling
Defines the schema of tools that Gemini can call
"""

from google.generativeai.types import FunctionDeclaration

# Tool 1: Check Timeline Conflict
check_timeline_tool = FunctionDeclaration(
    name="check_timeline_conflict",
    description="ตรวจสอบว่าตัวละครสามารถเดินทางจากสถานที่หนึ่งไปอีกสถานที่หนึ่งได้ทันตาม timeline หรือไม่ ใช้เมื่อตัวละครปรากฏในสถานที่ต่างกันในช่วงเวลาใกล้เคียงกัน",
    parameters={
        "type": "object",
        "properties": {
            "character_id": {
                "type": "string",
                "description": "ID ของตัวละครที่ต้องการตรวจสอบ"
            },
            "from_note_id": {
                "type": "string",
                "description": "ID ของ note/scene จุดเริ่มต้น"
            },
            "to_note_id": {
                "type": "string",
                "description": "ID ของ note/scene จุดปลายทาง"
            },
            "time_elapsed_hours": {
                "type": "number",
                "description": "เวลาที่ผ่านไประหว่าง 2 scenes (ชั่วโมง) ถ้าทราบ"
            }
        },
        "required": ["character_id", "from_note_id", "to_note_id"]
    }
)

# Tool 2: Validate Character Consistency
validate_character_tool = FunctionDeclaration(
    name="validate_character_consistency",
    description="ตรวจสอบว่า action ของตัวละครสอดคล้องกับสถานะปัจจุบัน (สุขภาพ, พลังงาน, อุปกรณ์, บาดแผล) หรือไม่ ใช้เมื่อตัวละครทำกิจกรรมที่อาจขัดแย้งกับสถานะ",
    parameters={
        "type": "object",
        "properties": {
            "character_id": {
                "type": "string",
                "description": "ID ของตัวละคร"
            },
            "note_id": {
                "type": "string",
                "description": "ID ของ note/scene ที่ต้องการตรวจสอบ"
            },
            "action_text": {
                "type": "string",
                "description": "ข้อความที่อธิบาย action ของตัวละคร"
            }
        },
        "required": ["character_id", "note_id", "action_text"]
    }
)

# Tool 3: Search Story Context
search_context_tool = FunctionDeclaration(
    name="search_story_context",
    description="ค้นหาบริบทที่เกี่ยวข้องจากเนื้อเรื่องทั้งหมด (ตัวละคร, สถานที่, บท, notes) ใช้เมื่อต้องการหาข้อมูลเพิ่มเติมเกี่ยวกับเรื่องราว",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "คำค้นหา เช่น 'ฉากต่อสู้ที่ปราสาท' หรือ 'ตัวละครที่มีพลังวิเศษ'"
            },
            "content_type": {
                "type": "string",
                "enum": ["character", "note", "chapter", "location", "all"],
                "description": "ประเภทเนื้อหา (optional) - ใช้ 'all' สำหรับค้นหาทุกประเภท"
            },
            "limit": {
                "type": "integer",
                "description": "จำนวนผลลัพธ์สูงสุด (default: 5)"
            }
        },
        "required": ["query"]
    }
)

# All tools list
ALL_TOOLS = [
    check_timeline_tool,
    validate_character_tool,
    search_context_tool
]
