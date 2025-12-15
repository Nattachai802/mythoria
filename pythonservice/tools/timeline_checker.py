"""
Timeline Conflict Checker Tool
Validates if character can travel between locations within the story timeline
"""

from typing import Optional
import httpx


async def get_character_states_between_notes(
    novel_id: str, 
    character_id: str,
    from_note_id: str,
    to_note_id: str
) -> tuple[dict, dict]:
    """Get character states at two different notes"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:3000/api/novel/{novel_id}/character-states",
            params={"characterId": character_id},
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise Exception("Failed to fetch character states")
        
        data = response.json()
        states = data.get("states", [])
        
        from_state = next((s for s in states if s["noteId"] == from_note_id), None)
        to_state = next((s for s in states if s["noteId"] == to_note_id), None)
        
        return from_state, to_state


async def get_travel_time(
    novel_id: str,
    from_location_id: str,
    to_location_id: str
) -> Optional[dict]:
    """Get travel time between two locations"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:3000/api/novel/{novel_id}/location-connections",
            timeout=30.0
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        connections = data.get("connections", [])
        
        # Find direct connection
        for conn in connections:
            if (conn["sourceLocationId"] == from_location_id and 
                conn["targetLocationId"] == to_location_id):
                return {
                    "time": conn.get("travelTime"),
                    "unit": conn.get("travelTimeUnit", "hours"),
                    "method": conn.get("travelMethod", "walk"),
                    "bidirectional": conn.get("isBidirectional", True)
                }
            # Check reverse if bidirectional
            if (conn.get("isBidirectional") and
                conn["sourceLocationId"] == to_location_id and 
                conn["targetLocationId"] == from_location_id):
                return {
                    "time": conn.get("travelTime"),
                    "unit": conn.get("travelTimeUnit", "hours"),
                    "method": conn.get("travelMethod", "walk"),
                    "bidirectional": True
                }
        
        return None


def convert_to_hours(time_value: int, unit: str) -> float:
    """Convert travel time to hours"""
    if unit == "hours":
        return float(time_value)
    elif unit == "days":
        return float(time_value) * 24
    elif unit == "weeks":
        return float(time_value) * 24 * 7
    elif unit == "minutes":
        return float(time_value) / 60
    return float(time_value)


async def check_timeline_conflict(
    novel_id: str,
    character_id: str,
    from_note_id: str,
    to_note_id: str,
    time_elapsed_hours: float = 0  # เวลาที่ผ่านไประหว่าง 2 notes (ถ้าทราบ)
) -> dict:
    """
    Check if character can travel between two locations within timeline
    
    Returns:
        {
            "conflict": bool,
            "reason": str,
            "from_location": str,
            "to_location": str,
            "travel_time_required": float,
            "time_available": float
        }
    """
    try:
        # 1. Get character states
        from_state, to_state = await get_character_states_between_notes(
            novel_id, character_id, from_note_id, to_note_id
        )
        
        if not from_state:
            return {
                "conflict": False,
                "reason": f"No character state found for starting note",
                "from_location": None,
                "to_location": None
            }
        
        if not to_state:
            return {
                "conflict": False,
                "reason": f"No character state found for ending note",
                "from_location": from_state.get("locationName"),
                "to_location": None
            }
        
        from_location_id = from_state.get("locationId")
        to_location_id = to_state.get("locationId")
        from_location_name = from_state.get("locationName", "Unknown")
        to_location_name = to_state.get("locationName", "Unknown")
        
        # 2. Same location = no conflict
        if from_location_id == to_location_id:
            return {
                "conflict": False,
                "reason": "Character is at the same location",
                "from_location": from_location_name,
                "to_location": to_location_name
            }
        
        # 3. Get travel time
        travel_info = await get_travel_time(novel_id, from_location_id, to_location_id)
        
        if not travel_info:
            return {
                "conflict": True,
                "reason": f"No known path from '{from_location_name}' to '{to_location_name}'",
                "from_location": from_location_name,
                "to_location": to_location_name,
                "travel_time_required": None,
                "time_available": time_elapsed_hours
            }
        
        if travel_info["time"] is None:
            return {
                "conflict": False,
                "reason": "Travel time not specified, cannot determine conflict",
                "from_location": from_location_name,
                "to_location": to_location_name
            }
        
        # 4. Calculate if enough time
        travel_hours = convert_to_hours(travel_info["time"], travel_info["unit"])
        
        if time_elapsed_hours > 0 and travel_hours > time_elapsed_hours:
            return {
                "conflict": True,
                "reason": (
                    f"Travel from '{from_location_name}' to '{to_location_name}' "
                    f"requires {travel_hours:.1f} hours by {travel_info['method']}, "
                    f"but only {time_elapsed_hours:.1f} hours elapsed"
                ),
                "from_location": from_location_name,
                "to_location": to_location_name,
                "travel_time_required": travel_hours,
                "time_available": time_elapsed_hours,
                "travel_method": travel_info["method"]
            }
        
        return {
            "conflict": False,
            "reason": (
                f"Travel from '{from_location_name}' to '{to_location_name}' "
                f"is possible ({travel_hours:.1f} hours by {travel_info['method']})"
            ),
            "from_location": from_location_name,
            "to_location": to_location_name,
            "travel_time_required": travel_hours,
            "travel_method": travel_info["method"]
        }
        
    except Exception as e:
        return {
            "conflict": False,
            "reason": f"Error checking timeline: {str(e)}",
            "error": True
        }
