"""
วัดความแม่นของตัวตรวจคำผิดกับ spell_gold.json

    python eval_spell.py <notes.json> [local|remote|longdo]

notes.json = [{id, text, entities}] ดึงจาก DB (ไม่เก็บใน repo เพราะเป็นเนื้อหานิยายของผู้ใช้)
recall วัดเทียบคำผิดที่รู้จักเท่านั้น — คำผิดที่ไม่มีใครเคยจับได้จะไม่อยู่ในตัวหาร
"""
import json
import os
import sys
import time

from spell_checker import NovelSpellChecker, mask_entities, _LOANWORD_ENTITIES

gold = json.load(open(os.path.join(os.path.dirname(__file__), "spell_gold.json"), encoding="utf-8"))["notes"]
notes = json.load(open(sys.argv[1], encoding="utf-8"))
mode = sys.argv[2] if len(sys.argv) > 2 else "local"

tp = fn = fp_known = flagged = 0
for n in notes:
    g = gold.get(n["id"][:8])
    if not g:
        continue
    c = NovelSpellChecker(entities=n["entities"])
    masked, _ = mask_entities(c._preprocess(n["text"]), c.entities + _LOANWORD_ENTITIES)
    t0 = time.time()
    hybrid = lambda m: c.check_local(m, hints=[{"word": e.word, "offset": e.offset, "suggestions": e.suggestions}
                                               for e in c._check_via_longdo(m) or []])
    errs = {"local": c.check_local, "remote": c._check_via_remote, "hybrid": hybrid,
            "longdo": lambda m: c._check_via_longdo(m) or []}[mode](masked)
    spans = [(e.offset, e.offset + len(e.word), e.word) for e in errs]
    flagged += len(spans)
    hit = lambda a, b: any(s < b and a < e for s, e, _ in spans)
    for word, ctx in g["errors"]:
        i = masked.find(ctx) + ctx.find(word) if ctx else masked.find(word)
        if hit(i, i + len(word)):
            tp += 1
        else:
            fn += 1
            print(f"  พลาด  {word}")
    fps = [w for _, _, w in spans if any(w in f or f in w for f in g["fp"])]
    fp_known += len(fps)
    print(f"{n['id'][:8]}: ขีด {len(spans)} · {time.time() - t0:.1f}s · ขีดผิดที่รู้จัก {fps}")

print(f"\n[{mode}] จับได้ {tp}/{tp + fn} (recall {tp / max(tp + fn, 1):.0%}) · "
      f"ขีดผิดที่รู้จัก {fp_known} · ขีดทั้งหมด {flagged}")
