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

import time

import torch

import spell_checker as sc
from spell_checker import NovelSpellChecker, _get_lm, _get_tokenizer

KEY = os.getenv("INTERNAL_API_KEY")


# ── GPU (ZeroGPU) + fallback CPU ─────────────────────────────────────────────
# LM บน CPU ของ Space ใช้ ~95% ของเวลาตรวจ (บทละ ~106 วิ) — ลองบน GPU ก่อน ถ้าโควต้าหมด/GPU ไม่ว่าง
# กลับไปใช้ CPU และพักการลอง GPU ไว้ GPU_COOLDOWN วิ (ไม่ต้องเสียเวลาลองทุกก้อน)
# โควต้า ZeroGPU บัญชีฟรี 5 นาที/วัน — ทั้งก้อน (ตัดคำ + hunspell + LM) รันใน GPU call เดียว
# เพราะเรียก GPU ทีละคำจะเสียเวลาจองเครื่องซ้ำ ๆ · ponytail: ถ้าโควต้าไม่พอค่อยย้ายเฉพาะ LM เข้า GPU แบบ batch
GPU_COOLDOWN = int(os.getenv("SPELL_GPU_COOLDOWN", "1800"))
_gpu_retry_at = 0.0

_get_tokenizer()
_CPU_LM = _get_lm()  # โหลดโมเดลตอนตื่น ไม่ใช่ตอน request แรก
_GPU_LM = None
if _CPU_LM is not None and torch.cuda.is_available():
    # ZeroGPU: ต้องวางโมเดลบน cuda ตั้งแต่ระดับ module (นอกฟังก์ชัน GPU เป็นโหมดจำลอง cuda)
    from transformers import AutoModelForMaskedLM
    _GPU_LM = (_CPU_LM[0], AutoModelForMaskedLM.from_pretrained(sc.LM_MODEL).eval().to("cuda"), torch)


@spaces.GPU(duration=90)
def _check_on_gpu(text: str, hints):
    sc._LM = _GPU_LM
    try:
        return [asdict(e) for e in NovelSpellChecker().check_local(text, hints=hints)]
    finally:
        sc._LM = _CPU_LM


def _require_key(request: Request):
    if not KEY or request.headers.get("x-internal-key") != KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


class CheckRequest(BaseModel):
    text: str
    hints: list[dict] | None = None  # คำที่ Longdo ขีดมา [{word, offset, suggestions}] — ให้กรองซ้ำ


def health():
    return {"ok": True}


def spell_check_local(req: CheckRequest, request: Request):
    global _gpu_retry_at
    _require_key(request)
    t0 = time.time()
    errors, mode = None, "cpu"
    if _GPU_LM is not None and t0 >= _gpu_retry_at:
        try:
            errors, mode = _check_on_gpu(req.text, req.hints), "gpu"
        except Exception as e:  # โควต้าหมด / GPU ไม่ว่าง / ZeroGPU ขัดข้อง
            _gpu_retry_at = time.time() + GPU_COOLDOWN
            print(f"[GPU] ใช้ไม่ได้ ({type(e).__name__}: {str(e)[:120]}) — ใช้ CPU, ลองใหม่ใน {GPU_COOLDOWN}s")
    if errors is None:
        errors = [asdict(e) for e in NovelSpellChecker().check_local(req.text, hints=req.hints)]
    return {
        "errors": errors,
        "mode": mode,                                   # gpu | cpu — Render แสดงในแผงติดตาม
        "seconds": round(time.time() - t0, 1),
        "gpuCooldownUntil": _gpu_retry_at if _gpu_retry_at > time.time() else None,
        "gpuAvailable": _GPU_LM is not None,
    }



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
