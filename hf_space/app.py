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
# LM ใช้ ~80% ของเวลาตรวจ — ตัวตรวจรวบรวมคำที่ต้องให้ LM ตัดสินทั้งก้อนก่อน (งาน CPU: ตัดคำ, hunspell)
# แล้วให้คะแนนรวมใน GPU call เดียว (_score_on_gpu) ถ้าโควต้าหมด/GPU ไม่ว่าง ให้คะแนนบน CPU แทน
# และพักการลอง GPU ไว้ GPU_COOLDOWN วิ (ไม่ต้องเสียเวลาลองทุกก้อน)
# เดิมรันทั้งก้อนใน GPU: ~30 วิ/ส่วน และ 2 บทกินโควต้า 244/300 วิ เพราะงาน CPU ถูกนับเป็นเวลา GPU ด้วย
GPU_COOLDOWN = int(os.getenv("SPELL_GPU_COOLDOWN", "1800"))
_gpu_retry_at = 0.0

_get_tokenizer()
_CPU_LM = _get_lm()  # โหลดโมเดลตอนตื่น ไม่ใช่ตอน request แรก
_GPU_LM = None
if _CPU_LM is not None and torch.cuda.is_available():
    # ZeroGPU: ต้องวางโมเดลบน cuda ตั้งแต่ระดับ module (นอกฟังก์ชัน GPU เป็นโหมดจำลอง cuda)
    from transformers import AutoModelForMaskedLM
    _GPU_LM = (_CPU_LM[0], AutoModelForMaskedLM.from_pretrained(sc.LM_MODEL).eval().to("cuda"), torch)


@spaces.GPU(duration=30)
def _score_on_gpu(rows, positions, targets):
    sc._LM = _GPU_LM
    try:
        return sc.score_rows(rows, positions, targets)
    finally:
        sc._LM = _CPU_LM


class _Scorer:
    """ตัวให้คะแนน LM ของคำขอหนึ่งคำขอ — GPU ก่อน ไม่ได้ค่อย CPU · จำว่าก้อนนี้ใช้โหมดไหน"""

    def __init__(self):
        self.mode = "cpu"
        self.gpu_seconds = 0.0

    def __call__(self, rows, positions, targets):
        global _gpu_retry_at
        if _GPU_LM is not None and time.time() >= _gpu_retry_at:
            t = time.time()
            try:
                out = _score_on_gpu(rows, positions, targets)
                self.mode, self.gpu_seconds = "gpu", round(time.time() - t, 1)
                return out
            except Exception as e:  # โควต้าหมด / GPU ไม่ว่าง / ZeroGPU ขัดข้อง
                _gpu_retry_at = time.time() + GPU_COOLDOWN
                print(f"[GPU] ใช้ไม่ได้ ({type(e).__name__}: {str(e)[:120]}) — ใช้ CPU, ลองใหม่ใน {GPU_COOLDOWN}s")
        return sc.score_rows(rows, positions, targets)


def _require_key(request: Request):
    if not KEY or request.headers.get("x-internal-key") != KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


class CheckRequest(BaseModel):
    text: str
    hints: list[dict] | None = None  # คำที่ Longdo ขีดมา [{word, offset, suggestions}] — ให้กรองซ้ำ


def health():
    return {"ok": True}


def spell_check_local(req: CheckRequest, request: Request):
    _require_key(request)
    t0 = time.time()
    sc.TIMINGS.clear()
    scorer = _Scorer()
    errors = [asdict(e) for e in NovelSpellChecker().check_local(req.text, hints=req.hints, scorer=scorer)]
    return {
        "errors": errors,
        "mode": scorer.mode,                            # gpu | cpu — Render แสดงในแผงติดตาม
        "seconds": round(time.time() - t0, 1),
        "gpuSeconds": scorer.gpu_seconds,               # เวลาที่ใช้ GPU จริง (นับโควต้า) ของก้อนนี้
        # เวลาแยกตามขั้น {ขั้น: [วินาที, จำนวนครั้ง]} — ไว้หาคอขวด (คะแนน LM บน GPU ดูที่ gpuSeconds)
        "timings": {k: [round(v[0], 2), v[1]] for k, v in sorted(sc.TIMINGS.items(), key=lambda kv: -kv[1][0])},
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
