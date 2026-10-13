"""
HF Space กลางของ Mythoria — งานที่กิน RAM/CPU เกินกว่า Replit จะรับไหว

เพิ่มโมดูลใหม่เป็น route ใต้ prefix ของตัวเอง (/spell/..., /<module>/...)
ไม่เก็บ state ไม่ต่อ DB — Replit เป็นคนเขียนผลลง Neon

spell: Replit mask ชื่อในเรื่องแล้วค่อยส่งมา ที่นี่ไม่เห็นชื่อจริง

ทำไมต้องผ่าน Gradio: ZeroGPU (ฟรี) รายงาน @spaces.GPU ตอน gr.Blocks.launch() เท่านั้น
ถ้ารัน uvicorn เอง Space จะถูกปิดด้วย "No @spaces.GPU function detected during startup"
จึง launch Gradio แล้วแปะ route ของเราลงบน FastAPI ที่ Gradio สร้าง
"""
import os

import spaces  # ต้อง import ก่อน torch (attacut/transformers) ไม่งั้น ZeroGPU ไม่ยอม

os.environ.setdefault("SPELL_LM", "1")  # ต้องตั้งก่อน import spell_checker

from dataclasses import asdict

import gradio as gr
from fastapi import HTTPException, Request
from pydantic import BaseModel

from spell_checker import NovelSpellChecker, _get_lm, _get_tokenizer

KEY = os.getenv("INTERNAL_API_KEY")


# ponytail: ตอนนี้ทุกอย่างรันบน CPU ไม่กินโควต้า GPU (ฟรี 5 นาที/วัน) — ตัวนี้มีไว้ให้ผ่านการเช็คเท่านั้น
# ย้ายงานที่ช้าจริง (เช่น _lm_score ทั้งก้อน) เข้ามาใต้ decorator ถ้า CPU ไม่ทัน
@spaces.GPU(duration=1)
def _gpu_probe():
    return True


def _require_key(request: Request):
    if not KEY or request.headers.get("x-internal-key") != KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


class CheckRequest(BaseModel):
    text: str


def health():
    return {"ok": True}


def spell_check_local(req: CheckRequest, request: Request):
    _require_key(request)
    return {"errors": [asdict(e) for e in NovelSpellChecker().check_local(req.text)]}


# โหลดโมเดลตอนตื่น ไม่ใช่ตอน request แรก
_get_tokenizer()
_get_lm()

with gr.Blocks() as demo:
    gr.Markdown("Mythoria Engine — API only")

if __name__ == "__main__":
    # ssr_mode=False: Gradio 6 เปิด Node SSR ที่ 7860 แล้วซ่อน Python ไว้ 7861
    # route ของเราอยู่ฝั่ง Python จึงโดน Node ตอบหน้า Gradio / 405 แทน
    demo.launch(server_name="0.0.0.0", server_port=7860, prevent_thread_lock=True, ssr_mode=False)
    for path, fn, methods in [
        ("/health", health, ["GET"]),
        ("/spell/check-local", spell_check_local, ["POST"]),
    ]:
        demo.app.add_api_route(path, fn, methods=methods)
        # ย้ายขึ้นหน้าสุด กัน route ของ Gradio รับไปก่อน
        demo.app.router.routes.insert(0, demo.app.router.routes.pop())
    demo.block_thread()
