"""
Character Consistency Validator Tool
Validates if character actions are consistent with their current state
"""

from typing import Optional
import httpx
import re


# Keywords that indicate physical actions
ACTION_KEYWORDS = {
    "exhausting": ["วิ่ง", "กระโดด", "ปีน", "ว่ายน้ำ", "ต่อสู้", "ยก", "แบก", "run", "jump", "climb", "fight"],
    "combat": ["ต่อสู้", "โจมตี", "ฟัน", "แทง", "ยิง", "attack", "strike", "slash", "shoot"],
    "magic": ["ร่าย", "เวทย์", "พลัง", "spell", "magic", "cast", "มนตรา"],
    "weapon": ["ดาบ", "หอก", "ธนู", "sword", "spear", "bow", "มีด", "knife"],
    "movement": ["เดิน", "วิ่ง", "หนี", "ไล่", "walk", "run", "escape", "chase"]
}

# Status that limits actions
STATUS_LIMITS = {
    "dead": {"blocks": ["all"], "message": "ตัวละครเสียชีวิตแล้ว"},
    "unconscious": {"blocks": ["all"], "message": "ตัวละครหมดสติ"},
    "severely_injured": {"blocks": ["exhausting", "combat"], "message": "ตัวละครบาดเจ็บหนักเกินไป"},
    "injured": {"blocks": ["exhausting"], "message": "ตัวละครบาดเจ็บ อาจทำกิจกรรมหนักได้ยาก"}
}

ENERGY_LIMITS = {
    "exhausted": {"blocks": ["exhausting", "combat", "magic"], "message": "ตัวละครหมดแรง"},
    "tired": {"blocks": ["magic"], "message": "ตัวละครเหนื่อยล้า มนตรา/พลังอาจใช้ไม่ได้ผลเต็มที่"}
}


def detect_action_types(text: str) -> list[str]:
    """Detect what types of actions are mentioned in text"""
    detected = []
    text_lower = text.lower()
    
    for action_type, keywords in ACTION_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                if action_type not in detected:
                    detected.append(action_type)
                break
    
    return detected


def detect_equipment_usage(text: str) -> list[str]:
    """Detect what equipment is being used in text"""
    equipment_keywords = {
        "sword": ["ดาบ", "sword", "blade"],
        "spear": ["หอก", "spear", "lance"],
        "bow": ["ธนู", "bow", "arrow"],
        "shield": ["โล่", "shield"],
        "armor": ["เกราะ", "armor"],
        "staff": ["ไม้เท้า", "staff", "wand"]
    }
    
    detected = []
    text_lower = text.lower()
    
    for equip_type, keywords in equipment_keywords.items():
        for keyword in keywords:
            if keyword in text_lower:
                if equip_type not in detected:
                    detected.append(equip_type)
                break
    
    return detected


async def get_character_state(novel_id: str, character_id: str, note_id: str) -> Optional[dict]:
    """Get character state for a specific note"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:3000/api/novel/{novel_id}/character-states",
            params={"characterId": character_id, "noteId": note_id},
            timeout=30.0
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        states = data.get("states", [])
        
        # Get state for this note or the latest before it
        if states:
            return states[0]
        return None


async def validate_character_consistency(
    novel_id: str,
    character_id: str,
    note_id: str,
    action_text: str
) -> dict:
    """
    Validate if character action is consistent with their current state
    
    Returns:
        {
            "valid": bool,
            "conflicts": [
                {
                    "type": str,
                    "action": str,
                    "reason": str,
                    "severity": "warning" | "error"
                }
            ],
            "character_state": dict
        }
    """
    conflicts = []
    
    try:
        # 1. Get character state
        state = await get_character_state(novel_id, character_id, note_id)
        
        if not state:
            return {
                "valid": True,
                "conflicts": [],
                "character_state": None,
                "message": "No character state found, skipping validation"
            }
        
        # 2. Detect actions in text
        action_types = detect_action_types(action_text)
        equipment_used = detect_equipment_usage(action_text)
        
        # 3. Check status limits
        character_status = state.get("status", "alive")
        if character_status in STATUS_LIMITS:
            limit = STATUS_LIMITS[character_status]
            blocked = limit["blocks"]
            
            for action_type in action_types:
                if "all" in blocked or action_type in blocked:
                    conflicts.append({
                        "type": "status_conflict",
                        "action": action_type,
                        "reason": f"{limit['message']} ไม่สามารถ{action_type}ได้",
                        "severity": "error" if "all" in blocked else "warning",
                        "current_status": character_status
                    })
        
        # 4. Check energy limits
        character_energy = state.get("energy", "normal")
        if character_energy in ENERGY_LIMITS:
            limit = ENERGY_LIMITS[character_energy]
            blocked = limit["blocks"]
            
            for action_type in action_types:
                if action_type in blocked:
                    conflicts.append({
                        "type": "energy_conflict",
                        "action": action_type,
                        "reason": f"{limit['message']} การ{action_type}อาจไม่เหมาะสม",
                        "severity": "warning",
                        "current_energy": character_energy
                    })
        
        # 5. Check equipment
        character_equipment = state.get("equipment", []) or []
        equipment_names = [eq.lower() if isinstance(eq, str) else eq.get("name", "").lower() 
                         for eq in character_equipment]
        
        for equip_used in equipment_used:
            has_equipment = any(equip_used in name for name in equipment_names)
            if not has_equipment:
                conflicts.append({
                    "type": "equipment_conflict",
                    "action": f"use {equip_used}",
                    "reason": f"ตัวละครไม่มี {equip_used} ในรายการอุปกรณ์",
                    "severity": "warning",
                    "available_equipment": character_equipment
                })
        
        # 6. Check health for physical actions
        health = state.get("health", 100)
        if health is not None and health < 30:
            if "exhausting" in action_types or "combat" in action_types:
                conflicts.append({
                    "type": "health_warning",
                    "action": "physical activity",
                    "reason": f"HP ต่ำมาก ({health}%) การกระทำทางกายภาพหนักอาจไม่เหมาะ",
                    "severity": "warning",
                    "current_health": health
                })
        
        # 7. Check specific injuries
        injuries = state.get("specificInjuries", []) or []
        if injuries:
            if "movement" in action_types:
                leg_injuries = [i for i in injuries if any(x in i.lower() for x in ["ขา", "เท้า", "leg", "foot"])]
                if leg_injuries:
                    conflicts.append({
                        "type": "injury_conflict",
                        "action": "movement",
                        "reason": f"มีบาดแผลที่ขา/เท้า: {leg_injuries}, การเคลื่อนไหวอาจทำได้ยาก",
                        "severity": "warning"
                    })
            
            if "combat" in action_types:
                arm_injuries = [i for i in injuries if any(x in i.lower() for x in ["แขน", "มือ", "arm", "hand"])]
                if arm_injuries:
                    conflicts.append({
                        "type": "injury_conflict",
                        "action": "combat",
                        "reason": f"มีบาดแผลที่แขน/มือ: {arm_injuries}, การต่อสู้อาจทำได้ยาก",
                        "severity": "warning"
                    })
        
        return {
            "valid": len([c for c in conflicts if c["severity"] == "error"]) == 0,
            "conflicts": conflicts,
            "character_state": {
                "status": character_status,
                "energy": character_energy,
                "health": health,
                "equipment": character_equipment,
                "injuries": injuries
            },
            "detected_actions": action_types,
            "detected_equipment": equipment_used
        }
        
    except Exception as e:
        return {
            "valid": True,
            "conflicts": [],
            "error": str(e),
            "message": f"Error during validation: {str(e)}"
        }
