---
title: Mythoria Engine
sdk: gradio
app_file: app.py
---

Space กลางของ Mythoria — รับงานหนักที่ Replit รันไม่ไหว

| prefix | โมดูล |
|---|---|
| `/spell` | ตัวตรวจคำผิดสำรอง (attacut + hunspell + WangchanBERTa) เรียกเมื่อ Longdo ใช้ไม่ได้ |

## Deploy

ไฟล์ตัวตรวจอยู่ที่ `pythonservice/` (แหล่งเดียว) ต้อง copy มาก่อน push ขึ้น Space ทุกครั้ง:

```bash
cp ../pythonservice/spell_checker.py ../pythonservice/longdo_client.py . && cp -r ../pythonservice/dictionaries .
```

- Space Secrets: `INTERNAL_API_KEY` (ค่าเดียวกับ Replit)
- Replit env: `HF_TOKEN` (Space เป็น private — token แบบ read จาก huggingface.co/settings/tokens)
- Replit env: `SPELL_FALLBACK_URL=https://<user>-mythoria-engine.hf.space`
- ปรับความเข้มของ LM: `SPELL_LM_MARGIN` (ค่าเริ่ม 1.5 สูงขึ้น = ขีดแดงน้อยลง)
