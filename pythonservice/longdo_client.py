"""
Longdo Spell Checker API — ตัวตรวจคำผิดหลัก

ทำไมถึงใช้เป็นตัวหลักแทนของในเครื่อง:
  ตัวในเครื่องต้องใช้ attacut (ลาก torch มา 184 MB) + hunspell (34 MB) รวม 218 MB
  บนเครื่อง 512 MB ของ Render นั่นคือเกือบครึ่ง ส่วน Longdo ตัดคำ + ตรวจให้ฝั่ง server
  จึงไม่ต้องโหลดอะไรเลย

  วัดเทียบกันแล้ว (ดู task.md): จับคำผิดได้ 4/4 เท่ากัน, false positive น้อยกว่า
  (2 vs 4 จาก 4 ประโยคนิยาย), ความเร็วพอกัน (116 ms vs 114 ms ต่อประโยค)

ข้อแลกเปลี่ยนที่รับไว้: เนื้อความถูกส่งไปประมวลผลที่เซิร์ฟเวอร์ Longdo
หน้า marketplace ของเขาระบุว่าไม่เก็บเนื้อหาถาวรและใช้เพื่อตรวจสะกดเท่านั้น
เทียบแล้วเป็นการเพิ่มผู้ให้บริการอีก 1 ราย จากที่เนื้อเรื่องผ่าน Neon/Vercel/
Gemini/Groq อยู่แล้ว

ถ้าเรียกไม่สำเร็จ (ไม่มี key, เน็ตล่ม, เกินโควตา) ผู้เรียกต้อง fallback ไปตัวในเครื่อง
โมดูลนี้จึงคืน None แทนการ raise เพื่อให้ตัดสินใจได้ง่าย
"""

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

API_URL = "https://api.longdo.com/spell-checker/proof"

# เกิน 1,024 ตัวอักษรทาง Longdo จะตัดเป็นหลาย request ให้เอง แต่ส่งเองทีละก้อน
# ทำให้ offset ที่คืนมาอ้างกับก้อนไหนชัดเจน ไม่ต้องเดา
CHUNK_SIZE = 1000

TIMEOUT = 20.0


def is_configured() -> bool:
    return bool(os.getenv("LONGDO_API_KEY"))


def _chunk(text: str) -> list[tuple[int, str]]:
    """
    แบ่งข้อความเป็นก้อน คืน (offset ในข้อความเดิม, ก้อน)

    พยายามตัดที่ช่องว่างเพื่อไม่ให้คำขาดกลาง — คำที่ถูกตัดครึ่งจะกลายเป็นคำผิดปลอม
    """
    if len(text) <= CHUNK_SIZE:
        return [(0, text)]

    chunks: list[tuple[int, str]] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            space = text.rfind(" ", start + CHUNK_SIZE // 2, end)
            if space > start:
                end = space
        chunks.append((start, text[start:end]))
        start = end
    return chunks


def proof(text: str) -> list[dict] | None:
    """
    ตรวจคำผิดทั้งข้อความ

    คืน [{word, offset, suggestions}] โดย offset อ้างกับ text ที่ส่งเข้ามา
    คืน None ถ้าเรียกไม่สำเร็จ — ผู้เรียกต้อง fallback เอง
    """
    key = os.getenv("LONGDO_API_KEY")
    if not key:
        return None

    found: list[dict] = []
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            for base, chunk in _chunk(text):
                res = client.post(API_URL, json={"key": key, "text": chunk})
                if res.status_code != 200:
                    print(f"[Longdo] HTTP {res.status_code} — fallback ไปตัวในเครื่อง")
                    return None
                for item in res.json().get("result", []):
                    word = item.get("word")
                    if not word:
                        continue
                    found.append({
                        "word": word,
                        "offset": base + int(item.get("index", 0)),
                        "suggestions": [s for s in item.get("suggestions", []) if s != word][:5],
                    })
    except Exception as e:
        print(f"[Longdo] error: {e} — fallback ไปตัวในเครื่อง")
        return None

    return found


if __name__ == "__main__":
    # เช็คตัวเอง — รัน: python longdo_client.py
    assert [c[1] for c in _chunk("สั้น")] == ["สั้น"]
    long_text = ("ก" * 400 + " ") * 5
    parts = _chunk(long_text)
    assert len(parts) > 1, "ข้อความยาวต้องถูกแบ่ง"
    assert "".join(p[1] for p in parts) == long_text, "แบ่งแล้วต่อกลับต้องได้ข้อความเดิม"
    for base, part in parts:
        assert long_text[base:base + len(part)] == part, "offset ของก้อนไม่ตรง"

    if not is_configured():
        print("⚠️ ไม่มี LONGDO_API_KEY — ข้ามการทดสอบเรียก API จริง")
    else:
        hits = proof("สวัสดร ผมอยากไปประเทษไทย เพื่อขออนุญาติกินกระเพลา")
        assert hits is not None, "เรียก API ไม่สำเร็จ"
        words = {h["word"] for h in hits}
        assert any("สวัสด" in w for w in words), f"ควรจับ สวัสดร ได้: {words}"
        assert any("อนุญาติ" in w for w in words), f"ควรจับ อนุญาติ ได้: {words}"
        # offset ต้องชี้กลับไปที่คำจริงในข้อความ
        src = "สวัสดร ผมอยากไปประเทษไทย เพื่อขออนุญาติกินกระเพลา"
        for h in hits:
            assert src[h["offset"]:h["offset"] + len(h["word"])] == h["word"], \
                f"offset ผิด: {h}"
        print(f"✅ longdo_client ผ่าน — จับได้ {len(hits)} คำ: {sorted(words)}")
