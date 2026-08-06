"""
Gemini Embedding Service
สร้าง embedding vector จากข้อความด้วย Google Generative AI
"""

import math
import os
from pathlib import Path
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set. Please add it to your .env file.")
genai.configure(api_key=GEMINI_API_KEY)

# text-embedding-004 ถูกปลดระวางแล้ว — คืน 404 model not found ตั้งแต่ v1beta
# อาการคือ embedding เป็นเวกเตอร์ศูนย์ทั้งหมด แล้วค้นหาไม่เจออะไรเลยแบบเงียบ ๆ
# เช็คว่าตัวไหนยังใช้ได้: genai.list_models() แล้วดูว่ามี "embedContent" ไหม
EMBED_MODEL = "models/gemini-embedding-001"

# โมเดลใหม่คืน 3072 มิติโดยปริยาย แต่รองรับการตัดสั้น (Matryoshka) ลงมาได้
# 768 คือขนาดที่ตาราง content_vectors ประกาศไว้ (migrations/0018_pgvector.sql)
# ห้ามเปลี่ยนโดยไม่ย้ายตารางและสร้าง embedding ใหม่ทั้งหมด — เวกเตอร์คนละขนาด
# เทียบระยะกันไม่ได้ และคนละโมเดลก็เทียบกันไม่ได้แม้ขนาดเท่ากัน
EMBED_DIM = 768


def _normalize(vector: list[float]) -> list[float]:
    """
    ปรับความยาวเวกเตอร์ให้เป็น 1

    โมเดลไม่ normalize ให้เมื่อตัดสั้นกว่า 3072 — cosine distance ของ pgvector
    ไม่สนความยาวอยู่แล้ว แต่ normalize ไว้ทำให้เวกเตอร์ใช้กับ metric อื่นได้ด้วย
    ถ้าวันหลังเปลี่ยนไปใช้ dot product
    """
    norm = math.sqrt(sum(x * x for x in vector))
    return [x / norm for x in vector] if norm else vector


def generate_embedding(text: str) -> list[float]:
    """สร้าง embedding จากข้อความ — คืนเวกเตอร์ศูนย์ถ้าล้มเหลว"""
    if not text or not text.strip():
        return [0.0] * EMBED_DIM

    try:
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=text,
            task_type="retrieval_document",
            output_dimensionality=EMBED_DIM,
        )
        return _normalize(result["embedding"])
    except Exception as e:
        print(f"[Embedding] Error: {e}")
        return [0.0] * EMBED_DIM


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """สร้าง embedding หลายข้อความ"""
    return [generate_embedding(text) for text in texts]


if __name__ == "__main__":
    # เช็คตัวเอง — รัน: python embeddings.py
    # จับเคสที่พังเงียบที่สุด: โมเดลถูกปลดระวางแล้วคืนเวกเตอร์ศูนย์
    v = generate_embedding("เอริสเดินเข้าไปในหอคอยที่ถูกทิ้งร้าง")
    assert len(v) == EMBED_DIM, f"ควรได้ {EMBED_DIM} มิติ ได้ {len(v)}"
    assert any(x != 0.0 for x in v), "ได้เวกเตอร์ศูนย์ — โมเดลน่าจะถูกปลดระวางแล้ว"
    assert abs(math.sqrt(sum(x * x for x in v)) - 1.0) < 1e-6, "ควร normalize แล้ว"

    # ข้อความว่างต้องไม่ระเบิด
    assert len(generate_embedding("")) == EMBED_DIM

    # ข้อความใกล้กันต้องได้เวกเตอร์ใกล้กันกว่าข้อความคนละเรื่อง
    a = generate_embedding("เอริสร่ายเวทมนตร์ในหอคอย")
    b = generate_embedding("เอริสใช้เวทมนตร์ที่หอคอย")
    c = generate_embedding("สูตรทำอาหารไทยรสจัด")
    dot = lambda x, y: sum(i * j for i, j in zip(x, y))
    assert dot(a, b) > dot(a, c), f"ความใกล้เคียงผิด: ab={dot(a,b):.3f} ac={dot(a,c):.3f}"

    print(f"✅ embeddings ผ่านทั้งหมด (โมเดล {EMBED_MODEL}, {EMBED_DIM} มิติ)")
