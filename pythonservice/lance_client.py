"""
Vector store client — pgvector บน Neon

ชื่อไฟล์ยังเป็น lance_client.py เพื่อไม่ต้องแก้ import ทั้ง main.py, ai_agent.py,
character_analyzer.py — ตัว LanceDB ถูกถอดออกไปแล้ว

ทำไมถึงย้ายมาจาก LanceDB:
  1. LanceDB เขียนไฟล์ลงดิสก์ ทำให้ deploy บน host ที่ดิสก์ไม่ถาวรไม่ได้
     (Render free ล้างดิสก์ทุกครั้งที่ตื่นจากหลับ) ผู้อ่านจำลองจะไม่เห็นตอนก่อนหน้าเลย
  2. embedding อยู่คนละที่กับเนื้อหาที่มันอธิบาย ไม่มีอะไรบังคับให้ sync กัน
     ลบโน้ตแล้ว embedding ค้าง จึงต้องมีปุ่ม "ซิงค์ฐานข้อมูล AI" ให้กดเอง
  3. lancedb + pyarrow กิน RAM ~123 MB ซึ่งมีผลจริงบนเครื่อง 512 MB

ต้องรัน migrations/0018_pgvector.sql ก่อนใช้งาน
"""

import os
import psycopg2
from pathlib import Path
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

# ตอน dev: connection string อยู่ใน .env ที่ราก repo ร่วมกับฝั่ง Next.js
# โหลดทั้งสองไฟล์จะได้ไม่ต้องก๊อปรหัสฐานข้อมูลไว้สองที่แล้วลืมแก้ทีละอัน
# ตอน deploy: rootDir คือ pythonservice/ ไม่มี .env ทั้งคู่ — ค่ามาจาก env ของ host
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

VECTOR_DIM = 768  # Gemini text-embedding-004 (ดู embeddings.py)


def _connect():
    # อ่านตอนใช้ ไม่ใช่ตอน import — module นี้ถูก import ก่อน load_dotenv() ของ main.py
    # และต้องรันเดี่ยว ๆ ได้เพื่อ self-check
    url = os.getenv("NEON_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("ต้องตั้ง NEON_DATABASE_URL หรือ DATABASE_URL")
    return psycopg2.connect(url)


def _vec(values) -> str:
    """
    แปลง list[float] เป็น literal ของ pgvector: [1.0,2.0,3.0]

    ส่งเป็น string แล้ว cast ด้วย ::vector ฝั่ง SQL — ไม่ต้องลง pgvector.psycopg2
    เพิ่มอีก dependency เพื่อทำงานแค่นี้
    """
    return "[" + ",".join(repr(float(x)) for x in values) + "]"


def upsert_content(records: list[dict]):
    """เพิ่ม/อัปเดต vector — id ซ้ำคือทับของเดิม"""
    if not records:
        return
    rows = [
        (
            r["id"], r["novel_id"], r.get("content_type"), r.get("title"),
            r.get("content"), r.get("metadata"), _vec(r["vector"]),
        )
        for r in records
    ]
    with _connect() as conn, conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO content_vectors
                (id, novel_id, content_type, title, content, metadata, vector, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s::vector, now())
            ON CONFLICT (id) DO UPDATE SET
                novel_id     = EXCLUDED.novel_id,
                content_type = EXCLUDED.content_type,
                title        = EXCLUDED.title,
                content      = EXCLUDED.content,
                metadata     = EXCLUDED.metadata,
                vector       = EXCLUDED.vector,
                updated_at   = now()
        """, rows, page_size=100)


def delete_by_novel_id(novel_id: str):
    """ลบ vector ทั้งหมดของนิยายเรื่องหนึ่ง (ใช้ก่อน re-sync)"""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM content_vectors WHERE novel_id = %s", (novel_id,))


def search_similar(
    query_vector: list[float],
    novel_id: str,
    limit: int = 10,
    content_type: str = None,
) -> list[dict]:
    """
    ค้นของใกล้เคียงด้วย cosine distance (<=> ของ pgvector)

    คืน _distance ไว้ด้วยเพราะ main.py คำนวณ score = 1 - _distance
    """
    try:
        params: list = [_vec(query_vector), novel_id]
        type_filter = ""
        if content_type:
            type_filter = " AND content_type = %s"
            params.append(content_type)
        params.append(limit)

        with _connect() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, content_type, title, content, metadata,
                       vector <=> %s::vector AS distance
                FROM content_vectors
                WHERE novel_id = %s{type_filter}
                ORDER BY distance
                LIMIT %s
            """, params)
            rows = cur.fetchall()

        return [
            {
                "id": r[0],
                "content_type": r[1],
                "title": r[2],
                "content": r[3],
                "metadata": r[4],
                "_distance": float(r[5]) if r[5] is not None else 0.0,
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[pgvector] search error: {e}")
        return []


def count_by_novel_id(novel_id: str) -> dict:
    """นับ vector แยกตามชนิด — ใช้แสดงสถานะการซิงค์"""
    counts = {"total": 0, "character": 0, "note": 0, "chapter": 0, "location": 0}
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute("""
                SELECT content_type, count(*) FROM content_vectors
                WHERE novel_id = %s GROUP BY content_type
            """, (novel_id,))
            for content_type, n in cur.fetchall():
                counts["total"] += n
                if content_type in counts:
                    counts[content_type] += n
    except Exception as e:
        print(f"[pgvector] count error: {e}")
    return counts


if __name__ == "__main__":
    # เช็คตัวเอง — รัน: python lance_client.py
    # ครอบคลุมสองอย่างที่พังเงียบได้: การประกอบ vector literal และ round-trip จริงกับฐาน
    assert _vec([1, 2, 3]) == "[1.0,2.0,3.0]"
    assert _vec([0.5, -0.25]) == "[0.5,-0.25]"

    novel = "__selfcheck__"
    v = [0.1] * VECTOR_DIM
    upsert_content([{
        "id": "__selfcheck_a__", "novel_id": novel, "content_type": "note",
        "title": "ทดสอบ", "content": "เนื้อหาทดสอบ", "metadata": "{}", "vector": v,
    }])
    found = search_similar(v, novel, limit=5)
    assert len(found) == 1, f"ค้นไม่เจอ: {found}"
    assert found[0]["id"] == "__selfcheck_a__"
    assert found[0]["_distance"] < 0.01, f"ระยะห่างควรใกล้ 0 ได้ {found[0]['_distance']}"

    # กรองด้วย content_type ต้องทำงาน
    assert len(search_similar(v, novel, content_type="character")) == 0

    assert count_by_novel_id(novel)["note"] == 1
    delete_by_novel_id(novel)
    assert count_by_novel_id(novel)["total"] == 0

    print("✅ lance_client (pgvector) ผ่านทั้งหมด")
