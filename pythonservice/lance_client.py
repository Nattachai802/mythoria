"""
LanceDB Client
Vector database operations for all content types
"""

import lancedb
from pathlib import Path

# LanceDB path
VECTOR_DB_PATH = Path(__file__).parent.parent / "vector-db"

# Connection singleton
_db = None


def get_db() -> lancedb.DBConnection:
    """Get or create LanceDB connection"""
    global _db
    if _db is None:
        VECTOR_DB_PATH.mkdir(exist_ok=True)
        _db = lancedb.connect(str(VECTOR_DB_PATH))
    return _db


def get_or_create_table(table_name: str = "content"):
    """Get or create content table"""
    db = get_db()
    
    if table_name in db.table_names():
        return db.open_table(table_name)
    
    # Create with initial schema
    import pyarrow as pa
    schema = pa.schema([
        pa.field("id", pa.string()),
        pa.field("novel_id", pa.string()),
        pa.field("content_type", pa.string()),  # character, note, chapter, location
        pa.field("title", pa.string()),
        pa.field("content", pa.string()),
        pa.field("metadata", pa.string()),  # JSON string for extra data
        pa.field("vector", pa.list_(pa.float32(), 768)),
    ])
    
    return db.create_table(table_name, schema=schema)


def upsert_content(records: list[dict]):
    """Insert or update content vectors"""
    if not records:
        return
    
    table = get_or_create_table()
    
    # Delete existing records with same IDs
    for record in records:
        try:
            table.delete(f'id = "{record["id"]}"')
        except:
            pass
    
    # Insert new records
    table.add(records)


def delete_by_novel_id(novel_id: str):
    """Delete all vectors for a novel"""
    try:
        table = get_or_create_table()
        table.delete(f'novel_id = "{novel_id}"')
    except:
        pass


def search_similar(
    query_vector: list[float], 
    novel_id: str, 
    limit: int = 10,
    content_type: str = None
) -> list[dict]:
    """Search for similar content"""
    try:
        table = get_or_create_table()
        
        # Build filter
        filter_str = f'novel_id = "{novel_id}"'
        if content_type:
            filter_str += f' AND content_type = "{content_type}"'
        
        results = (
            table.search(query_vector)
            .where(filter_str)
            .limit(limit)
            .to_list()
        )
        return results
    except Exception as e:
        print(f"[LanceDB] Search error: {e}")
        return []


def count_by_novel_id(novel_id: str) -> dict:
    """Count vectors by content type for a novel"""
    try:
        table = get_or_create_table()
        results = table.search().where(f'novel_id = "{novel_id}"').limit(10000).to_list()
        
        counts = {"total": 0, "character": 0, "note": 0, "chapter": 0, "location": 0}
        for r in results:
            counts["total"] += 1
            ct = r.get("content_type", "")
            if ct in counts:
                counts[ct] += 1
        
        return counts
    except:
        return {"total": 0, "character": 0, "note": 0, "chapter": 0, "location": 0}
