"""
Thai Novel Spell Checker
ตรวจจับคำผิดในนิยายภาษาไทยโดยใช้ PyThaiNLP
รองรับชื่อตัวละคร / สถานที่ / คำศัพท์เฉพาะของเรื่อง เพื่อไม่ให้ถูกตีว่าผิด
"""

import os
import re
import html
from collections import Counter
from typing import List, Optional
from dataclasses import dataclass, field
from pythainlp.spell import spell, correct
from pythainlp.tokenize import word_tokenize, sent_tokenize
from pythainlp.util import dict_trie
from pythainlp.corpus.common import thai_words

import longdo_client

# ตัวแนะนำคำ: Hunspell (spylls = Hunspell เขียนใหม่ด้วย Python ล้วน ไม่ต้องลง lib ระบบ)
#
# ใช้แทน pythainlp.spell() เฉพาะขั้น "แนะนำคำที่น่าจะถูก" เท่านั้น ส่วนขั้น "คำนี้ผิดไหม"
# ยังใช้ thai_words() ของ PyThaiNLP อยู่ เพราะพจนานุกรม Hunspell มี 38,722 คำ น้อยกว่า
# 62,101 คำของ PyThaiNLP และตกคำที่นิยายแฟนตาซีใช้ประจำ (เช่น "เวทมนตร์") ถ้าเอามาตัดสิน
# ว่าผิด/ถูกจะขีดแดงมั่ว
#
# ที่เปลี่ยนเพราะ pythainlp.spell() วัดได้ 0.66 วิ/คำ และแกว่งถึง 929 ms ส่วน Hunspell
# อยู่ที่ 6-70 ms คงเส้นคงวา แถมคุณภาพดีกว่า ("ประเทษไทย" -> pythainlp คืนคำผิดกลับมาเฉย ๆ
# ส่วน Hunspell คืน "ประเทศไทย") พอเร็วขนาดนี้แล้ว suggestion cache ก็ไม่ต้องมีอีกต่อไป
_HUNSPELL = None
_HUNSPELL_TRIED = False
_DICT_PATH = os.path.join(os.path.dirname(__file__), "dictionaries", "th_TH")


def _get_hunspell():
    global _HUNSPELL, _HUNSPELL_TRIED
    if not _HUNSPELL_TRIED:
        _HUNSPELL_TRIED = True
        try:
            from spylls.hunspell import Dictionary
            _HUNSPELL = Dictionary.from_files(_DICT_PATH)
            print("[SpellChecker] suggester: hunspell-th (spylls)")
        except Exception as e:
            _HUNSPELL = None
            print(f"[SpellChecker] suggester: pythainlp.spell (hunspell ใช้ไม่ได้: {e})")
    return _HUNSPELL


def _suggest(word: str, limit: int = 5) -> List[str]:
    """คำที่น่าจะถูกสำหรับ word — เรียงคำที่ใกล้ที่สุดก่อน"""
    hs = _get_hunspell()
    if hs is not None:
        try:
            return [c for c in hs.suggest(word) if c != word][:limit]
        except Exception:
            pass  # fallback pythainlp
    return sorted(
        [c for c in spell(word) if c != word],
        key=lambda c: NovelSpellChecker._edit_distance(word, c),
    )[:limit]


# Thai dictionary — lazy load ครั้งแรกที่ใช้ (กัน RAM ค้างตอน service ไม่ได้ spell-check)
_THAI_DICT_CACHE = None
def _get_thai_dict() -> frozenset:
    global _THAI_DICT_CACHE
    if _THAI_DICT_CACHE is None:
        _THAI_DICT_CACHE = frozenset(thai_words())
    return _THAI_DICT_CACHE

# attacut tokenizer — lazy load (โมเดล neural โหลดตอนใช้ครั้งแรก ไม่ใช่ตอน import)
#
# หนัก 184 MB เพราะลาก torch มาด้วย เคยลองถอดออกให้เหลือ newmm อย่างเดียวแล้ว "ห้ามทำ":
# newmm เป็น dictionary-based มันจะแตกคำที่สะกดผิดให้กลายเป็นคำที่มีในพจนานุกรมเสมอ
# ("สวัสดร" -> "ส|วัส|ดร", "อนุญาติ" -> "อนุ|ญาติ") คำผิดเลยหลุดหมด วัดแล้วจับได้ 0/4
# ส่วน attacut เก็บคำผิดไว้เป็น token เดียว จึงตรวจเจอ — 184 MB นี้ซื้อฟังก์ชันหลักของโมดูล
_ATTACUT = None
_ATTACUT_TRIED = False
def _get_tokenizer():
    global _ATTACUT, _ATTACUT_TRIED
    if not _ATTACUT_TRIED:
        _ATTACUT_TRIED = True
        try:
            from attacut import Tokenizer as AttacutTokenizer
            _ATTACUT = AttacutTokenizer("attacut-sc")
            print("[SpellChecker] tokenizer: attacut-sc (lazy)")
        except Exception:
            _ATTACUT = None
            print("[SpellChecker] tokenizer: newmm (attacut not available)")
    return _ATTACUT




# ตัวยืนยันด้วยบริบท: WangchanBERTa (masked LM ภาษาไทย ~420 MB)
#
# ปัญหาเดิม: "ไม่อยู่ในพจนานุกรม = ผิด" ทำให้คำประสมที่ถูก ("เสียงกลอง", "ข้างถนน")
# กับชิ้นคำที่ attacut ตัดแตก ("เสี", "เธ") โดนขีดแดงเป็นส่วนใหญ่ — วัดจาก DB จริง
# จับถูกราว 10% เท่านั้น ชั้นนี้ให้ LM เทียบ "คำเดิม" กับ "คำแนะนำ" ในประโยคเดียวกัน
# แล้วขีดแดงเฉพาะเมื่อคำแนะนำเข้าบริบทกว่าชัด ๆ
#
# เปิดด้วย SPELL_LM=1 เท่านั้น (ตั้งบน HF Space) — Replit RAM ไม่พอ ปิดไว้ก็ทำงานแบบเดิม
_LM = None
_LM_TRIED = False
LM_MODEL = os.getenv("SPELL_LM_MODEL", "airesearch/wangchanberta-base-att-spm-uncased")
# ponytail: เกณฑ์ตั้งจากสามัญสำนึก ยังไม่ได้จูนกับชุดทดสอบ — ปรับผ่าน env ได้
LM_MARGIN = float(os.getenv("SPELL_LM_MARGIN", "1.5"))
# ความยาวบริบทคือเวลาตรง ๆ (LM กินเวลา ~80% ของทั้งหมด) — 60 ตัวอักษรแต่ละข้าง ≈ ประโยครอบคำ
LM_CONTEXT_CHARS = int(os.getenv("SPELL_LM_CONTEXT", "60"))
LM_MAX_CANDIDATES = int(os.getenv("SPELL_LM_MAX_CANDIDATES", "6"))


# คำยืมที่นิยายแฟนตาซี/เกมใช้ประจำแต่พจนานุกรมไม่มี — ไม่ต้องตรวจ
NOVEL_LOANWORDS = frozenset({
    "สกิล", "เลเวล", "เลเวลอัพ", "มานา", "ดันเจี้ยน", "ไอเทม", "ไอเท็ม", "บัฟ", "ดีบัฟ", "คูลดาวน์",
    "เควส", "เควสต์", "บอส", "มอนสเตอร์", "ปาร์ตี้", "กิลด์", "แรงค์", "สเตตัส", "อีเวนต์",
    "ฮีล", "แทงค์", "ซัพพอร์ต", "คริติคอล", "อัลติเมท", "พอร์ทัล", "เทเลพอร์ต",
})

# คำทับศัพท์ที่เขียนไม่ตรงหลักราชบัณฑิตฯ — ไม่ใช่คำผิด แต่ผู้เขียนอาจอยากแก้ จึงแยกเป็น kind="style"
# เก็บเฉพาะเมื่อรูปที่แก้แล้วเป็นคำจริง (กันกฎไปแก้คำไทยแท้ที่บังเอิญมีรูปเดียวกัน)
_STYLE_RULES = [
    (re.compile(r"อัพ"), "อัป"),            # อัพเดต -> อัปเดต
    (re.compile(r"ท์$"), "ต์"),             # อีเวนท์ -> อีเวนต์
    (re.compile(r"ต้าร์"), "ตาร์"),          # กีต้าร์ -> กีตาร์
    (re.compile(r"ั่น"), "ัน"),             # ออดิชั่น -> ออดิชัน
    (re.compile(r"๊"), "็"),               # แท๊กซี่ -> แท็กซี่
    (re.compile(r"็ค"), "็ก"),              # ล็อค -> ล็อก
    (re.compile(r"่อร์"), "อร์"),            # เว่อร์ -> เวอร์
    (re.compile(r"ิ้ง$"), "ิง"),            # ช็อปปิ้ง -> ช็อปปิง
    (re.compile(r"ร์ค"), "ร์ก"),             # เวิร์ค -> เวิร์ก
]


def _style_fix(word: str, dictionary) -> Optional[str]:
    """
    ใช้กับคำที่ Longdo ขีดมาเท่านั้น — พจนานุกรม PyThaiNLP มีรูปไม่มาตรฐานอยู่แล้ว ("กีต้าร์")
    และกฎบางข้อชนคำไทยแท้ ("สั่น"->"สัน") ถ้าไม่มี Longdo ยืนยันว่าผิดก่อน จะแก้มั่ว
    """
    fixed = word
    for pat, rep in _STYLE_RULES:
        fixed = pat.sub(rep, fixed)
    return fixed if fixed != word and _is_real_text(fixed, dictionary) else None


# mask ก่อนตัดคำ — ไม่งั้นตัวตัดคำแตก "มอนสเตอร์ปรากฏ" เป็น "มอน|สเตอร์" แล้ว "สเตอร์" โดนขีด
_LOANWORD_ENTITIES = [{"text": w, "type": "loanword"} for w in NOVEL_LOANWORDS]

# สระ/วรรณยุกต์พิมพ์ซ้อน — "เเ" (สระเอสองตัวแทน แ), สระบน/ล่าง/วรรณยุกต์ซ้ำ, "าา", "ะะ"
# สระ/วรรณยุกต์เบิ้ล — รูปที่ภาษาไทยไม่มีจริง: สระหน้า/สระหลัง/สระบนล่าง/วรรณยุกต์ตัวเดียวกันซ้ำ
# หรือวรรณยุกต์ต่างตัวซ้อนกัน ("่้") · ซ้ำ 3 ตัวขึ้นไปมักตั้งใจลากเสียง ("ว้าาาา") แยกประเภทให้กดข้ามง่าย
_DOUBLED = re.compile(r'([เแโใไาะำ\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1+|[\u0E48-\u0E4B]{2,}')


_TRAILING = re.compile(r'[ะาำๅ\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]')  # ตัวที่ขึ้นต้นคำไม่ได้


def scan_doubled(text: str) -> List["SpellError"]:
    """
    หาสระ/วรรณยุกต์เบิ้ลทั้งข้อความด้วย regex ก่อนตัดคำ (ตัดคำก่อนอาจแตก "เ|เพื่อน" จนหลุด)
    ขีดทั้งคำ: ขยายจุดที่เจอเป็นคำด้วย newmm (คำที่ทับจุดนั้นทั้งหมด)
    """
    out: List[SpellError] = []
    for m in _DOUBLED.finditer(text):
        if out and m.start() < out[-1].offset + len(out[-1].word):
            continue  # อยู่ในคำเดียวกับจุดก่อนหน้า
        a = m.start()
        while a > 0 and "฀" <= text[a - 1] <= "๿":
            a -= 1
        b = m.end()
        while b < len(text) and "฀" <= text[b] <= "๿":
            b += 1
        pos, start, end = a, None, None
        for t in word_tokenize(text[a:b], engine="newmm"):
            if pos < m.end() and m.start() < pos + len(t):
                start = pos if start is None else start
                end = pos + len(t)
            pos += len(t)
        # newmm ตัดกลางพยางค์ที่พังได้ ("เร|ืิิอง") — ถอยไปให้คำเริ่มที่พยัญชนะ/สระหน้า
        while start > a and (_TRAILING.match(text[start]) or text[start - 1] in "เแโใไ"):
            start -= 1
        word = text[start:end]
        elongated = len(m.group(0)) >= 3 and m.group(1) is not None
        if elongated:
            fixes = [re.sub(r'(.)\1+', r'\1', word)]
        else:
            fixes = _typo_fixes(word, _get_thai_dict())
        out.append(SpellError(word=word, position=-1, offset=start, suggestions=fixes,
                              sentence="", sentence_index=-1,
                              kind="elongation" if elongated else "double_vowel"))
    return out


REMOTE_CHUNK_CHARS = int(os.getenv("SPELL_REMOTE_CHUNK", "3000"))


def _line_chunks(text: str, limit: int) -> List[tuple]:
    """(offset, ก้อน) ตัดที่ขึ้นบรรทัด — ย่อหน้าเดียวที่ยาวเกิน limit ก็ส่งทั้งย่อหน้า (ไม่ตัดกลางประโยค)"""
    chunks, start, cur = [], 0, 0
    for line in text.split("\n"):
        end = cur + len(line) + 1
        if end - start > limit and cur > start:
            chunks.append((start, text[start:cur]))
            start = cur
        cur = end
    if start < len(text):
        chunks.append((start, text[start:]))
    return chunks


# ด่านสุดท้ายก่อนถึงผู้เขียน — ลำดับความมั่นใจเมื่อจุดซ้อนกัน (มาก -> น้อย)
_KIND_RANK = {"double_vowel": 0, "elongation": 1, "spacing": 2, "spelling": 3, "style": 4}
REPEAT_COLLAPSE = int(os.getenv("SPELL_REPEAT_COLLAPSE", "4"))  # ขีดคำเดียวกันกี่ครั้งขึ้นไปถึงรวมเป็นรายการเดียว


def validate_errors(errors: List["SpellError"], text: str) -> List["SpellError"]:
    """
    กรองผลรวมทุกด่านก่อนเขียนลง DB:
      - ข้อความ ณ ตำแหน่งต้องตรงกับคำที่ขีด (กันไฮไลต์ผิดที่)
      - คำแนะนำว่าง หรือเหมือนคำเดิม -> ทิ้ง (ยกเว้นคำที่ไม่มีคำแนะนำ ให้ผู้เขียนดูเอง)
      - จุดซ้อนกัน -> เก็บตัวที่มั่นใจกว่า (_KIND_RANK)
      - คำเดียวกันขีดซ้ำ >= REPEAT_COLLAPSE จุด ด้วยคำแนะนำเดียวกัน -> น่าจะเป็นชื่อ/ศัพท์ในเรื่อง
        ที่ยังไม่ได้บันทึก รวมเหลือรายการเดียว kind="repeated" (เคยมี "เรย์" 41 จุด)
    """
    ok = []
    for e in errors:
        if text[e.offset:e.offset + len(e.word)] != e.word:
            continue
        e.suggestions = [s for s in dict.fromkeys(e.suggestions) if s and s != e.word]
        ok.append(e)

    kept: List[SpellError] = []
    for e in sorted(ok, key=lambda e: (_KIND_RANK.get(e.kind, 9), e.offset)):
        if not any(e.offset < k.offset + len(k.word) and k.offset < e.offset + len(e.word) for k in kept):
            kept.append(e)

    groups: dict = {}
    for e in kept:
        if e.kind == "spelling":
            groups.setdefault((e.word, tuple(e.suggestions[:1])), []).append(e)
    for same in groups.values():
        if len(same) >= REPEAT_COLLAPSE:
            first = min(same, key=lambda e: e.offset)
            first.kind, first.count = "repeated", len(same)
            kept = [e for e in kept if e is first or e not in same]
    return sorted(kept, key=lambda e: e.offset)


def scan_split_words(text: str) -> List["SpellError"]:
    """
    วรรคแทรกกลางคำ ("เสีย งกลอง" -> "เสียงกลอง") — ดูคำสุดท้ายก่อนช่องว่างกับคำแรกหลังช่องว่าง
    ขีดเมื่อเอามาต่อกันแล้วเป็นคำในพจนานุกรม และฝั่งใดฝั่งหนึ่งไม่เป็นคำเอง
    ("ความ รู้สึก" ไม่ขีด — ทั้งสองฝั่งเป็นคำอยู่แล้ว ผู้เขียนอาจเว้นเพื่อจังหวะ)
    """
    d = _get_thai_dict()
    out: List[SpellError] = []
    for m in re.finditer(r"(?<=[฀-๿]) (?=[฀-๿])", text):
        a = m.start()
        while a > 0 and "฀" <= text[a - 1] <= "๿":
            a -= 1
        b = m.end()
        while b < len(text) and "฀" <= text[b] <= "๿":
            b += 1
        # เอาช่องว่างออกแล้วตัดคำใหม่ ดูว่ามีคำไหนคร่อมรอยต่อ ("เสียงกลอง" -> "เสียง|กลอง" คร่อม "เสีย|ง")
        merged = text[a:m.start()] + text[m.end():b]
        j = m.start() - a
        pos = 0
        for t in word_tokenize(merged, engine="newmm"):
            if pos < j < pos + len(t):
                left, right = merged[pos:j], merged[j:pos + len(t)]
                if len(t) >= 3 and t in d and not (left in d and right in d):
                    out.append(SpellError(word=text[a + pos:m.end() + len(right)], position=-1, offset=a + pos,
                                          suggestions=[t], sentence="", sentence_index=-1, kind="spacing"))
                break
            pos += len(t)
    return out


_TYPO_MARKS = re.compile(r'เเ|([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1|าา|ะะ')

# คำผิดที่บังเอิญเป็นคำจริง — สลับเฉพาะตัวที่คนไทยพิมพ์สับสนบ่อย แล้วเก็บรูปที่มีในพจนานุกรม
_CONFUSABLE_GROUPS = ["่้๊๋", "รล", "ศษส", "ทธฒ", "พภ", "ดฎฏ", "นณ", "ยญ", "ฟฝ", "ผพ", "ิีึื", "ุู", "ใไ"]  # สระบนรวมกลุ่มเดียว: "มึ"->"มี"
_INSERTABLE = "่้วรลห"  # วรรณยุกต์ตก / อักษรควบตก ("ค้าง"->"คว้าง") / ห นำตก
# ponytail: เกณฑ์จากโน้ตทดสอบ 2 บท (ดู eval_spell.py) — คำจริงมีอคติข้างคำเดิม จึงตั้งสูงกว่า LM_MARGIN
# ปิดไว้ก่อน (999): วัดแล้วจับเพิ่มได้แค่ "ลอยค้าง" แต่ขีดเพิ่ม 22 จุดและช้าขึ้น ~6 เท่า (130 วิ/บท บน CPU)
# เปิดด้วย SPELL_REAL_WORD_MARGIN=4 เมื่อย้ายชั้นนี้ไปรันบน GPU
REAL_WORD_MARGIN = float(os.getenv("SPELL_REAL_WORD_MARGIN", "999"))
HINT_MARGIN = float(os.getenv("SPELL_HINT_MARGIN", "2.0"))  # ponytail: จูนจากโน้ตทดสอบ 2 บท (0.5/2/3.5/5)
TYPO_PRIOR = float(os.getenv("SPELL_TYPO_PRIOR", "2.0"))  # ponytail: ตั้งจากโน้ตทดสอบ 2 บท
REAL_WORD_CONTEXT_CHARS = int(os.getenv("SPELL_REAL_WORD_CONTEXT", "40"))


def _typo_fixes(word: str, dictionary) -> List[str]:
    """
    รูปที่น่าจะตั้งใจพิมพ์ของคำที่สระ/วรรณยุกต์ซ้อน — "เเพื่อน" อาจเป็น "แพื่อน" หรือ "เพื่อน"
    เก็บเฉพาะรูปที่ตัดคำแล้วเป็นคำจริงทั้งหมด (คำผิดอาจติดคำข้าง ๆ มาด้วย เช่น "ม่าานควัน")
    """
    forms = {word}
    for _ in range(3):
        nxt = set()
        for f in forms:
            m = _DOUBLED.search(f) or _TYPO_MARKS.search(f)
            if not m:
                nxt.add(f)
                continue
            a, b, hit = f[:m.start()], f[m.end():], m.group(0)
            if len(set(hit)) > 1:
                nxt.update(a + ch + b for ch in hit)  # วรรณยุกต์ต่างตัวซ้อน ("ไม่่้") — เหลือทีละตัว
                continue
            nxt.add(a + hit[0] + b)              # ตัดตัวซ้ำทิ้ง
            if hit == "เเ":
                nxt.add(a + "แ" + b)             # ตั้งใจพิมพ์ แ
            elif hit[0] not in "เแโใไ":
                nxt.add(a + b)                   # สระ/วรรณยุกต์เกินมาทั้งคู่ ("เรืิิอง" -> "เรือง")
        forms = nxt
    ok = [f for f in forms if not _DOUBLED.search(f) and not _TYPO_MARKS.search(f)
          and all(t in dictionary for t in word_tokenize(f, engine="newmm") if t.strip())]
    if ok:
        return sorted(ok, key=lambda f: -len(f))  # ตัดน้อยสุดก่อน ("ม่าน" ก่อน "ม่น")
    # แก้ตัวซ้อนแล้วยังไม่เป็นคำ ("ใหเห็น") — ลองเติม/สลับตัวที่พิมพ์ตกบ่อย ("ให้เห็น")
    fixed = [v for f in sorted(forms - {word}) for v in _confusable_variants(f, dictionary, loose=True)]
    if fixed:
        return list(dict.fromkeys(fixed))
    # แก้ตัวซ้อนแล้วยังไม่เป็นคำ ("ใหเห็น") — ให้ hunspell ช่วยต่อจากรูปที่แก้แล้ว
    base = min(forms - {word}, key=len, default=word)
    return [s for s in _suggest(base) if " " not in s][:3] or [base]


def _is_real_text(text: str, dictionary) -> bool:
    """เป็นคำจริง หรือแยกเป็นคำจริงยาว 2 ตัวขึ้นไปได้หมด ("ให้|เห็น")"""
    if text in dictionary:
        return True
    parts = word_tokenize(text, engine="newmm")
    return len(parts) > 1 and all(len(p) >= 2 and p in dictionary for p in parts)


def _is_deletion(word: str, cand: str) -> bool:
    """cand คือ word ที่ตัดบางตัวทิ้ง ("จอจบ"->"จอบ", "พบเจอ"->"เจอ")"""
    if len(cand) >= len(word):
        return False
    it = iter(word)
    return all(ch in it for ch in cand)


def _confusable_variants(word: str, dictionary, loose: bool = False) -> List[str]:
    """
    รูปที่ได้จากการสลับ/เติมตัวที่คนไทยพิมพ์สับสนบ่อย
    loose=False เก็บเฉพาะคำในพจนานุกรม · True เก็บรูปที่แยกเป็นคำจริงได้ด้วย (ใช้กับคำผิด)
    """
    out = set()
    for i, ch in enumerate(word):
        for grp in _CONFUSABLE_GROUPS:
            if ch in grp:
                out.update(word[:i] + r + word[i + 1:] for r in grp if r != ch)
        if ch in "่้๊๋":
            out.add(word[:i] + word[i + 1:])
    for i in range(1, len(word) + 1):
        out.update(word[:i] + c + word[i:] for c in _INSERTABLE)
    out.discard(word)
    if not loose:
        return sorted(v for v in out if v in dictionary)
    return sorted(v for v in out if _is_real_text(v, dictionary))


_DEEPCUT_OK = True


def _deepcut(text: str) -> List[str]:
    """ตัดคำด้วย deepcut (ตัวที่สอง) — ไม่มีให้ใช้ก็คืน [] ตัวตรวจทำงานด้วย attacut ตัวเดียวต่อ"""
    global _DEEPCUT_OK
    if not _DEEPCUT_OK:
        return []
    try:
        return word_tokenize(text, engine="deepcut")
    except Exception as e:
        _DEEPCUT_OK = False
        print(f"[SpellChecker] deepcut ใช้ไม่ได้: {e}")
        return []


def _get_lm():
    global _LM, _LM_TRIED
    if not _LM_TRIED:
        _LM_TRIED = True
        if os.getenv("SPELL_LM") != "1":
            return None
        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForMaskedLM
            tok = AutoTokenizer.from_pretrained(LM_MODEL)
            model = AutoModelForMaskedLM.from_pretrained(LM_MODEL).eval()
            _LM = (tok, model, torch)
            print(f"[SpellChecker] context LM: {LM_MODEL}")
        except Exception as e:
            _LM = None
            print(f"[SpellChecker] context LM ใช้ไม่ได้: {e}")
    return _LM


def _lm_scores(left: str, words: List[str], right: str) -> List[float]:
    """
    คะแนนความเข้ากับบริบทของแต่ละคำใน words เมื่อวางไว้ช่องเดียวกัน (pseudo-log-likelihood)

    ปิด subword ของคำทีละตัวแล้วดู log-prob ของตัวที่ถูกปิด รวมทุกคำเป็น batch เดียว
    ยิ่งสูง ยิ่งเข้ากับบริบท — เทียบได้เฉพาะระหว่างคำในชุดเดียวกัน
    """
    tok, model, torch = _LM
    enc = lambda s: tok(s.replace(" ", "<_>"), add_special_tokens=False)["input_ids"]
    l_ids, r_ids = enc(left)[-32:], enc(right)[:32]
    start = 1 + len(l_ids)
    rows, owners, targets = [], [], []
    for wi, w in enumerate(words):
        w_ids = enc(w)
        ids = [tok.cls_token_id] + l_ids + w_ids + r_ids + [tok.sep_token_id]
        for i, t in enumerate(w_ids):
            row = list(ids)
            row[start + i] = tok.mask_token_id
            rows.append(row)
            owners.append(wi)
            targets.append((start + i, t))
    if not rows:
        return [float("-inf")] * len(words)
    width = max(len(r) for r in rows)
    batch = torch.tensor([r + [tok.pad_token_id] * (width - len(r)) for r in rows])
    with torch.no_grad():
        logp = torch.log_softmax(model(input_ids=batch, attention_mask=(batch != tok.pad_token_id)).logits, dim=-1)
    sums = [0.0] * len(words)
    counts = [0] * len(words)
    for r, (wi, (pos, t)) in enumerate(zip(owners, targets)):
        sums[wi] += logp[r, pos, t].item()
        counts[wi] += 1
    # ponytail: ใช้ผลรวม (ไม่ใช่ค่าเฉลี่ย) — คำผิดมักแตกเป็น subword เยอะ ค่าเฉลี่ยจะช่วยมันไม่ควร
    return [sums[i] if counts[i] else float("-inf") for i in range(len(words))]


# ============================================================
# Masking คำเฉพาะของเรื่อง
# ============================================================
#
# แทนชื่อในเรื่องด้วยคำไทยธรรมดาก่อนตรวจ แทนการกรองทีหลังด้วย whitelist
# เพราะตัวตัดคำแตกชื่อจนกรองไม่เจอ: "เรย์กะ" ถูกตัดเป็น "เรย์|กะ" แล้ว "เรย์"
# โดนขีดแดง 41 ครั้งใน DB ทั้งที่ชื่ออยู่ใน whitelist — mask ก่อนตัดคำจึงหายทั้งก้อน
# และชื่อในเรื่องไม่ถูกส่งออกไปภายนอก (Longdo / HF) ด้วย
#
# ponytail: สรรพนามตัวเดียวต่อประเภทพอสำหรับตรวจสะกด เปลี่ยนเป็นชื่อสามัญถ้า LM ให้คะแนนเพี้ยน
MASK_BY_TYPE = {
    "character": "เขา",
    "faction": "พวกเขา",
    "location": "ที่นั่น",
    "item": "สิ่งนั้น",
    "creature": "มัน",
}
DEFAULT_MASK = "สิ่งนั้น"   # power / system / lore / คำแต่งอื่น ๆ


@dataclass
class EntitySpan:
    start: int        # ตำแหน่งใน text ก่อน mask
    end: int
    mstart: int       # ตำแหน่งใน text หลัง mask
    mend: int
    name: str
    type: str


def mask_entities(text: str, entities: List[dict]) -> tuple:
    """
    คืน (masked_text, spans) — จับชื่อที่ยาวที่สุดก่อน ("เรย์กะ" ชนะ "เรย์")

    ชื่อสั้นที่เป็นคำทั่วไป (เช่นตัวละครชื่อ "ฟ้า") ไม่ mask เพราะจะกลบคำนั้นทั้งเรื่อง
    """
    names: dict = {}
    for e in entities:
        name = (e.get("text") or "").strip()
        if len(name) >= 2 and name not in names:
            names[name] = e.get("type") or "term"
    keep = [n for n in names if len(n) >= 3 or n not in _get_thai_dict()]
    if not keep:
        return text, []

    pattern = re.compile("|".join(re.escape(n) for n in sorted(keep, key=len, reverse=True)))
    out: List[str] = []
    spans: List[EntitySpan] = []
    last = 0
    shift = 0
    for m in pattern.finditer(text):
        etype = names[m.group()]
        placeholder = MASK_BY_TYPE.get(etype, DEFAULT_MASK)
        out.append(text[last:m.start()])
        out.append(placeholder)
        mstart = m.start() + shift
        spans.append(EntitySpan(m.start(), m.end(), mstart, mstart + len(placeholder), m.group(), etype))
        shift += len(placeholder) - (m.end() - m.start())
        last = m.end()
    out.append(text[last:])
    return "".join(out), spans


def unmask_offset(offset: int, spans: List[EntitySpan]) -> Optional[int]:
    """แปลงตำแหน่งใน masked text กลับเป็นตำแหน่งเดิม — None ถ้าตกอยู่ในช่วงที่ mask"""
    delta = 0
    for s in spans:
        if offset < s.mstart:
            break
        if offset < s.mend:
            return None
        delta = s.end - s.mend
    return offset + delta


# ============================================================
# Data Classes
# ============================================================

@dataclass
class SpellError:
    word: str                        # คำที่ผิด
    position: int                    # index ใน token list (-1 ถ้าไม่มี)
    offset: int                      # char offset ใน text ที่ส่งเข้ามา (หลังลบ HTML)
    suggestions: List[str]           # คำที่น่าจะถูก
    sentence: str                    # บรรทัดที่พบ (context)
    sentence_index: int              # บรรทัดที่ n
    kind: str = "spelling"           # spelling | style (ทับศัพท์ไม่ตรงหลักราชบัณฑิตฯ — ผู้เขียนเลือกเองว่าจะแก้ไหม)
    count: int = 1                   # kind="repeated": คำนี้ถูกขีดกี่จุดในบท (รวมเหลือรายการเดียว)


@dataclass
class SpellCheckResult:
    original_text: str
    errors: List[SpellError]
    total_words: int
    error_count: int
    custom_words_used: List[str]     # คำเฉพาะที่เจอในข้อความ
    entities_found: List[dict] = field(default_factory=list)  # [{name, type, count, offsets}]


# ============================================================
# Core Checker
# ============================================================

class NovelSpellChecker:
    """
    Spell checker สำหรับนิยายไทย

    ลำดับ: ลบ HTML -> mask คำเฉพาะ -> Longdo / HF / ในเครื่อง -> แปลง offset กลับ
    """

    # Pattern ที่ skip การตรวจ
    SKIP_PATTERNS = [
        re.compile(r'^[a-zA-Z]+$'),              # ภาษาอังกฤษ
        re.compile(r'^\d+$'),                     # ตัวเลข
        re.compile(r'^[^฀-๿]+$'),      # ไม่ใช่ภาษาไทยเลย
        re.compile(r'^["\'\"\"\'\'「」『』《》【】\[\]()（）\-–—_.,!?:;…]+$'),  # เครื่องหมาย
        # ponytail: เดาคำเลียนเสียงจากรูป (อักษรซ้ำ 3+ / ไม้ตรี-จัตวาในคำสั้น) — พลาดคำผิดจริงที่หน้าตาแบบนี้ได้
        re.compile(r'(.)\1\1'),                   # "มมมมมม", "ฮึ่มมม"
        re.compile(r'^(?=.*[๊๋]).{1,4}$'),  # "อ๊าด", "ปั๋ง"
    ]

    # คำทั่วไปที่ pythainlp มักตีว่าผิดแต่จริงๆ ถูก (common false positives)
    BUILTIN_WHITELIST = {
        "ครับ", "ค่ะ", "นะ", "เลย", "ก็", "แล้ว", "อยู่", "มา", "ไป",
        "นี้", "นั้น", "ว่า", "ให้", "ได้", "จะ", "มี", "เป็น", "คือ",
        "แต่", "หรือ", "และ", "ก็คือ", "จาก", "ถึง", "กับ", "ของ", "โดย",
        "เมื่อ", "เพราะ", "ถ้า", "แม้", "ทั้ง", "ทุก", "บาง", "หลาย",
        "อีก", "แล้วก็", "ยัง", "ก็ยัง", "แล้วก็ยัง", "ซึ่ง",
        # Dialog / informal Thai ที่พบในนิยาย
        "เฮ้ย", "โอ้", "อุ้ย", "เอ้ย", "แหะ", "อ้าว", "เออ", "อืม",
        "ฮ่าๆ", "ฮ่า", "ฮะ", "หะ", "งั้น", "อ่า", "เอ่อ", "แง", "อ๋อ",
        # ภาษาพูดที่นิยายตั้งใจเขียน (บทพูด) — Longdo ขีดแต่ไม่ควรขีด
        "อ่ะ", "อะ", "รึ", "ป่ะ", "ปะ", "ม่าย", "เด้อ", "จ้ะ", "จ๊ะ", "ค้าบ", "คร้าบ", "น้า",
        "เนี่ย", "หรอ", "เหรอ", "มั้ย", "ป้ะ", "ง่ะ", "นะคะ",
        # คำซ้ำ (ๆ)
        "ๆ",
        # คำแทนจาก MASK_BY_TYPE ต้องไม่โดนขีดแดงเอง
        *MASK_BY_TYPE.values(), DEFAULT_MASK,
    }

    def __init__(
        self,
        custom_words: Optional[List[str]] = None,
        entities: Optional[List[dict]] = None,
    ):
        """
        entities: [{text, type}] คำเฉพาะของเรื่องพร้อมประเภท (character/location/...)
        custom_words: รูปเดิม — list ชื่อล้วน ถือเป็น character
        """
        self.custom_whitelist: set = set(self.BUILTIN_WHITELIST)
        self.entities: List[dict] = list(entities or [])

        for w in custom_words or []:
            if w and w.strip():
                self.entities.append({"text": w.strip(), "type": "character"})

        # เพิ่มรูปแบบย่อย เช่น "เอริส ไรกะ" -> "เอริส", "ไรกะ"
        for e in list(self.entities):
            name = (e.get("text") or "").strip()
            self.custom_whitelist.add(name)
            parts = name.split()
            if len(parts) > 1:
                for part in parts:
                    self.entities.append({"text": part, "type": e.get("type")})
                    self.custom_whitelist.add(part)

        # trie สร้างตอนใช้ครั้งแรก ไม่ใช่ตอน __init__ — มันกิน ~65 MB (62,101 คำ)
        # และใช้เฉพาะทาง fallback ในเครื่อง ทาง Longdo ไม่ต้องใช้เลย
        self._trie = None

    def _get_custom_trie(self):
        """
        พจนานุกรมสำหรับตัวตัดคำ — union ของ thai_words() กับคำเฉพาะของเรื่อง

        ต้อง union เพราะ custom_dict ของ PyThaiNLP "แทนที่" พจนานุกรม ไม่ใช่ "เพิ่มเข้าไป"
        ถ้าส่งแค่ whitelist ตัวตัดคำจะรู้จักแค่ ~50 คำ แล้วเชื่อมช่วงที่ไม่รู้จักเป็นก้อนเดียว
        ("ถูกทิ้งร้างมานานนับศตวรรษ" กลายเป็น token เดียว)
        """
        if self._trie is None:
            self._trie = dict_trie(set(thai_words()) | self.custom_whitelist)
        return self._trie

    def _should_skip(self, word: str) -> bool:
        """คืน True ถ้าคำนี้ไม่ต้องตรวจ"""
        if word in self.custom_whitelist:
            return True
        if len(word) <= 1:
            return True
        for pattern in self.SKIP_PATTERNS:
            if pattern.search(word):
                return True
        return False

    def check_text(self, text: str) -> SpellCheckResult:
        """
        ตรวจสอบ text ทั้งหมด

        ลอง Longdo ก่อน ถ้าไม่ได้ค่อยไปทางสำรอง: HF Space (ถ้าตั้ง SPELL_FALLBACK_URL)
        หรือตัวในเครื่อง — ทุกทางตรวจบน masked text แล้วแปลง offset กลับทีหลัง
        """
        import time
        t0 = time.time()

        cleaned = self._preprocess(text)
        masked, spans = mask_entities(cleaned, self.entities + _LOANWORD_ENTITIES)

        # Longdo หาคำต้องสงสัย (จับเก่ง) -> HF กรองซ้ำ + เติมที่ Longdo พลาด (ขีดผิดน้อยกว่า ~3 เท่า)
        longdo = self._check_via_longdo(masked)
        hints = [{"word": e.word, "offset": e.offset, "suggestions": e.suggestions} for e in longdo or []]
        if os.getenv("SPELL_FALLBACK_URL"):
            try:
                raw, engine = self._check_via_remote(masked, hints if longdo is not None else None), "longdo+hf"
            except Exception as e:
                if longdo is None:
                    raise  # ล่มทั้งคู่ — ให้ผู้เรียกตอบว่าตรวจไม่สำเร็จ ไม่ใช่ "ไม่มีคำผิด"
                print(f"[SpellChecker] HF ใช้ไม่ได้ ({e}) — ใช้ผล Longdo ตรง ๆ")
                raw, engine = longdo, "longdo"
        elif longdo is not None:
            raw, engine = longdo, "longdo"
        else:
            raw, engine = self.check_local(masked), "local"

        # สระ/วรรณยุกต์เบิ้ล: กฎตายตัว รันทุกครั้งไม่ขึ้นกับ Longdo/HF/ตัวตัดคำ แล้วชนะผลอื่นที่ทับกัน
        doubled = scan_doubled(masked) + scan_split_words(masked)
        ov = lambda a, b: a.offset < b.offset + len(b.word) and b.offset < a.offset + len(a.word)
        raw = [e for e in raw if not any(ov(e, d) for d in doubled)] + doubled

        errors: List[SpellError] = []
        for e in raw:
            start = unmask_offset(e.offset, spans)
            end = unmask_offset(e.offset + len(e.word) - 1, spans)
            if start is None or end is None or cleaned[start:start + len(e.word)] != e.word:
                continue  # ชนช่วงที่ mask หรือแปลงตำแหน่งไม่ลง — ทิ้ง ไม่เดา
            line_start = cleaned.rfind("\n", 0, start) + 1
            line_end = cleaned.find("\n", start)
            e.offset = start
            e.sentence = cleaned[line_start:line_end if line_end != -1 else len(cleaned)].strip()
            e.sentence_index = cleaned.count("\n", 0, start)
            errors.append(e)

        errors = validate_errors(errors, cleaned)

        found: dict = {}
        for s in spans:
            if s.type == "loanword":
                continue
            f = found.setdefault(s.name, {"name": s.name, "type": s.type, "count": 0, "offsets": []})
            f["count"] += 1
            f["offsets"].append(s.start)

        print(f"[SpellChecker] {engine} -- {len(errors)} errors, "
              f"{len(spans)} masked, {time.time() - t0:.2f}s")

        return SpellCheckResult(
            original_text=text,
            errors=errors,
            total_words=self._count_words(masked),
            error_count=len(errors),
            custom_words_used=sorted(found),
            entities_found=list(found.values()),
        )

    def check_local(self, masked: str, hints: Optional[List[dict]] = None) -> List[SpellError]:
        """
        ตัวตรวจในเครื่อง — offset ของผลอ้างกับ masked text ที่รับเข้ามา

        HF Space เรียกฟังก์ชันนี้ตรง ๆ (masking ทำที่ Replit แล้ว ชื่อไม่หลุดออกไป)

        hints = คำที่ Longdo ขีดมา [{word, offset, suggestions}] — Longdo จับเก่ง (15/16 ในชุดทดสอบ)
        แต่ขีดคำประสมที่ถูกเยอะ (17 จุด) จึงให้ตัวนี้กรองซ้ำด้วยเกณฑ์เดียวกับคำที่หาเอง
        แล้วรวมกับที่หาเองได้ (เช่น "หูฟาด" ที่ Longdo ไม่ขีด)

        คำที่ไม่อยู่ในพจนานุกรม:
          - สระ/วรรณยุกต์ซ้อน ("เเพื่อน", "เรืิิอง") -> ผิดแน่ ไม่ต้องถาม LM
          - แยกเป็นคำในพจนานุกรมได้หมด ("ข้าง|ถนน") -> น่าจะเป็นคำประสม ขีดเมื่อ LM ชอบคำแนะนำกว่าชัด ๆ
          - แยกไม่ได้ ("มึ", "เวี่ยง") -> ผิด (LM ใช้แค่เรียงคำแนะนำ)
        คำที่อยู่ในพจนานุกรม (ถ้ามี LM): ลองสลับตัวอักษรที่คนพิมพ์สับสนบ่อย ("ค้าง"->"คว้าง")
          ขีดเมื่อ LM ชอบคำคู่กว่ามาก ๆ (REAL_WORD_MARGIN)
        """
        lm = _get_lm()
        dictionary = _get_thai_dict()
        errors: List[SpellError] = []

        def add(idx: int, word: str, tok_idx: int, hint: Optional[List[str]] = None):
            # ตัดตัวเลข/อังกฤษที่ติดขอบคำทิ้ง ("เกิน4", "DMสอบถาม") — คำจาก Longdo มาแบบนี้บ่อย
            core = re.match(r'^([^฀-๿]*)(.*?)[^฀-๿]*$', word)
            idx, word = idx + len(core.group(1)), core.group(2)
            if not word or any(e.offset < idx + len(word) and idx < e.offset + len(e.word) for e in errors):
                return
            style = _style_fix(word, dictionary) if hint is not None else None
            if style:
                errors.append(SpellError(word=word, position=tok_idx, offset=idx, suggestions=[style],
                                         sentence="", sentence_index=-1, kind="style"))
                return
            suggestions = self._judge(masked, idx, word, dictionary, lm, hint)
            if suggestions is not None:
                errors.append(SpellError(word=word, position=tok_idx, offset=idx,
                                         suggestions=suggestions, sentence="", sentence_index=-1))

        for h in hints or []:
            add(h["offset"], h["word"], -1, [c for c in h.get("suggestions", []) if " " not in c])

        cursor = 0
        for line in masked.split("\n"):
            line_start = cursor
            cursor += len(line) + 1
            if not line.strip():
                continue
            for tok_idx, (idx, word) in enumerate(self._candidates(masked, line, line_start, dictionary)):
                add(idx, word, tok_idx)
        return self._merge_adjacent(errors, masked, dictionary)

    def _judge(self, masked: str, idx: int, word: str, dictionary, lm,
               hint: Optional[List[str]] = None) -> Optional[List[str]]:
        """คืนคำแนะนำถ้าตัดสินว่าผิด · None ถ้าผ่าน — hint คือคำแนะนำจาก Longdo (มี = Longdo ขีดมา)"""
        if not self._is_real_word(word) or self._should_skip(word) or word in NOVEL_LOANWORDS:
            return None
        left = masked[max(0, idx - LM_CONTEXT_CHARS):idx]
        right = masked[idx + len(word):idx + len(word) + LM_CONTEXT_CHARS]
        hinted = hint is not None

        if _TYPO_MARKS.search(word):
            return _typo_fixes(word, dictionary)

        if word in dictionary and not hinted:
            if lm is None or REAL_WORD_MARGIN >= 999:
                return None
            variants = _confusable_variants(word, dictionary)
            if not variants:
                return None
            # บริบทสั้นกว่าปกติ — ชั้นนี้เรียก LM เกือบทุกคำ ความยาวคือเวลาตรง ๆ
            k = REAL_WORD_CONTEXT_CHARS
            scores = _lm_scores(left[-k:], [word] + variants, right[:k])
            best_score, best = max(zip(scores[1:], variants))
            return [best] if best_score - scores[0] >= REAL_WORD_MARGIN else None

        # คำจริงที่ Longdo ขีด ("นั้นเอง") ถือเหมือนคำประสม — ต้องให้ LM ยืนยัน
        compound = word in dictionary or self._is_compound(word, dictionary)
        suggestions = list(dict.fromkeys((hint or []) + self._suggestions(word, dictionary)))
        if compound:
            # LM คิดคะแนนเป็นผลรวม คำที่สั้นกว่าจึงได้เปรียบ — คำประสมที่ถูกโดนเสนอ
            # "คำเดิมตัดบางส่วนทิ้ง" แล้วชนะ ("จอจบ"->"จอบ", "พบเจอ"->"เจอ") ตัดรูปพวกนี้ทิ้ง
            suggestions = [c for c in suggestions if not _is_deletion(word, c)]
        margin = None
        if lm is not None and suggestions:
            # ส่งให้ LM แค่ไม่กี่ตัวแรก: ของ Longdo ก่อน รูปพิมพ์สับสนแบบไทย แล้วค่อยที่ hunspell เสนอ
            typo_like = set(_confusable_variants(word, dictionary, loose=True))
            suggestions = sorted(suggestions, key=lambda c: (c not in (hint or []), c not in typo_like))
            suggestions = suggestions[:LM_MAX_CANDIDATES]
            scores = _lm_scores(left, [word] + suggestions, right)
            # แต้มต่อใช้เรียงคำแนะนำเท่านั้น — ตัดสินว่าผิดไหมยังใช้คะแนน LM ล้วน
            # (เคยใส่ไว้ใน margin ด้วย คำประสมที่ถูกอย่าง "จอจบ" "ปิดตา" เลยโดนขีด)
            margin = max(scores[1:]) - scores[0]
            ranked = sorted(zip(scores[1:], suggestions),
                            key=lambda p: p[0] + (TYPO_PRIOR if p[1] in typo_like else 0.0),
                            reverse=True)
            suggestions = [c for _, c in ranked]
        # คำประสมจากคำจริง ("ส้ม|แดง") ขีดเฉพาะเมื่อ LM ยืนยันว่าคำแนะนำเข้าบริบทกว่าชัด ๆ
        # ถ้า Longdo ขีดมาด้วย ใช้เกณฑ์ต่ำกว่า เพราะมีหลักฐานสองทาง
        if compound and (margin is None or margin < (HINT_MARGIN if hinted else LM_MARGIN)):
            return None
        return suggestions

    def _suggestions(self, word: str, dictionary) -> List[str]:
        """คำแนะนำจาก hunspell + รูปที่ได้จากการพิมพ์สับสนแบบไทย ("เวี่ยง"->"เหวี่ยง", "มึ"->"มี")"""
        # ตัดคำแนะนำแบบแยกคำ ("ป ปาฏิหาริย์") — hunspell ชอบเสนอ แต่ไม่เคยถูกในภาษาไทย
        cands = [
            c for c in _suggest(word)
            if " " not in c and "-" not in c and self._edit_distance(word, c) <= 2
        ]
        cands += _confusable_variants(word, dictionary, loose=True)
        return list(dict.fromkeys(cands))

    def _merge_adjacent(self, errors: List[SpellError], masked: str, dictionary) -> List[SpellError]:
        """
        รวมจุดที่ติดกันเป็นจุดเดียว — คำผิดคำเดียวที่ตัวตัดคำแตกเป็นชิ้น ("โศ"+"กด"+"ศร้า")
        เคยโผล่เป็นหลายจุด คำแนะนำของแต่ละชิ้นก็ไร้ความหมาย
        """
        merged: List[SpellError] = []
        for e in sorted(errors, key=lambda e: e.offset):
            prev = merged[-1] if merged else None
            gap = masked[prev.offset + len(prev.word):e.offset] if prev else None
            # ห่างกันด้วยคำจริงสั้น ๆ ที่ไม่มีช่องว่าง ก็นับว่าเป็นคำเดียวกัน ("โศ|กด|ศร้า")
            # ช่องว่างหรือตัวเลข/อังกฤษคั่น = คนละคำ · คำทับศัพท์ (style) ไม่รวมกับคำผิด
            if (prev is not None and len(gap) <= 3 and all("฀" <= ch <= "๿" for ch in gap)
                    and prev.kind == e.kind == "spelling"):
                word = masked[prev.offset:e.offset + len(e.word)]
                merged[-1] = SpellError(word=word, position=prev.position, offset=prev.offset,
                                        suggestions=self._suggestions(word, dictionary)[:5],
                                        sentence="", sentence_index=-1)
            else:
                merged.append(e)
        return merged

    def _candidates(self, masked: str, line: str, line_start: int, dictionary) -> List[tuple]:
        """
        (offset, คำ) ที่จะตรวจในบรรทัดนี้ เรียงตามตำแหน่ง

        ตัดคำสองรอบ attacut + deepcut เพราะพลาดคนละคำกัน (วัดแล้ว: เก็บคำผิดเป็นหน่วยเดียว
        ได้ 9 และ 8 จาก 16 แต่รวมกันได้ 12) — เอาช่วงที่ไม่อยู่ในพจนานุกรมจากทั้งคู่
        ถ้าทับกันเลือกช่วงที่สั้นกว่า (ขอบพอดีกว่า) ส่วนคำในพจนานุกรมใช้ของ attacut อย่างเดียว
        """
        def spans(tokens):
            out, pos = [], line_start
            for t in tokens:
                i = masked.find(t, pos)
                if i == -1:
                    continue
                pos = i + len(t)
                # ตัวตัดคำบางทีติดเครื่องหมายมากับคำ ("โทษ”") — ตัดขอบที่ไม่ใช่อักษรไทยออก
                core = re.match(r'^([^฀-๿]*)(.*?)[^฀-๿]*$', t)
                if core.group(2):
                    out.append((i + len(core.group(1)), core.group(2)))
            return out

        primary = spans(self._tokenize(line))
        oov = [s for s in primary if s[1] not in dictionary]
        for s in spans(_deepcut(line)):
            if s[1] in dictionary:
                continue
            clash = [o for o in oov if o[0] < s[0] + len(s[1]) and s[0] < o[0] + len(o[1])]
            if all(len(s[1]) < len(o[1]) for o in clash):
                oov = [o for o in oov if o not in clash] + [s]
        known = [s for s in primary if s[1] in dictionary
                 and not any(o[0] < s[0] + len(s[1]) and s[0] < o[0] + len(o[1]) for o in oov)]
        return sorted(oov + known)

    @staticmethod
    def _is_compound(word: str, dictionary) -> bool:
        """แยกด้วยพจนานุกรมแล้วได้คำจริงยาว 2 ตัวขึ้นไปทุกชิ้น — เช่น "ข้าง|ถนน" ไม่ใช่ "ป|ปาฏิหาริย์" """
        parts = word_tokenize(word, engine="newmm")
        return len(parts) > 1 and all(len(p) >= 2 and p in dictionary for p in parts)

    def _check_via_remote(self, masked: str, hints: Optional[List[dict]] = None) -> List[SpellError]:
        """
        ส่ง masked text (+ คำที่ Longdo ขีด) ไปตรวจที่ HF Space — ล้มให้ throw

        แบ่งส่งทีละก้อนตามบรรทัด ไม่เกิน REMOTE_CHUNK_CHARS — ทั้งบทในคำขอเดียวอาจเกิน timeout
        (ในเครื่อง ~30 วิ/บท บน CPU ของ Space ช้ากว่านั้น)
        """
        import httpx
        out: List[SpellError] = []
        headers = {
            "x-internal-key": os.getenv("INTERNAL_API_KEY", ""),
            # Space แบบ private ต้องมี HF token (read) ไม่งั้น HF ตอบ 404 ก่อนถึงแอป
            **({"Authorization": f"Bearer {os.environ['HF_TOKEN']}"} if os.getenv("HF_TOKEN") else {}),
        }
        with httpx.Client(timeout=180.0) as client:  # เผื่อ Space ตื่นจากหลับ + โหลดโมเดล
            for base, chunk in _line_chunks(masked, REMOTE_CHUNK_CHARS):
                body = {"text": chunk}
                if hints is not None:
                    body["hints"] = [dict(h, offset=h["offset"] - base) for h in hints
                                     if base <= h["offset"] and h["offset"] + len(h["word"]) <= base + len(chunk)]
                res = client.post(os.environ["SPELL_FALLBACK_URL"].rstrip("/") + "/spell/check-local",
                                  json=body, headers=headers)
                res.raise_for_status()
                for e in res.json()["errors"]:
                    err = SpellError(**e)
                    err.offset += base
                    out.append(err)
        return out

    def _check_via_longdo(self, masked: str) -> Optional[List[SpellError]]:
        """
        ตรวจด้วย Longdo — คืน None ถ้าเรียกไม่ได้ ให้ผู้เรียกไปทางสำรอง

        ชื่อในเรื่องถูก mask ไปแล้ว จึงกรองแค่ pattern ที่ไม่ต้องตรวจ
        """
        hits = longdo_client.proof(masked)
        if hits is None:
            return None
        return [
            SpellError(
                word=h["word"],
                position=-1,           # Longdo ให้ offset ตัวอักษร ไม่ให้ลำดับ token
                offset=h["offset"],
                suggestions=h["suggestions"],
                sentence="",
                sentence_index=-1,
            )
            for h in hits
            if not self._should_skip(h["word"]) and self._is_real_word(h["word"])
        ]

    def check_word(self, word: str) -> dict:
        """ตรวจคำเดียว — ใช้สำหรับ inline check"""
        if self._should_skip(word):
            return {"word": word, "correct": True, "suggestions": []}

        is_correct = (word in _get_thai_dict()) or (word in self.custom_whitelist)
        if is_correct:
            return {"word": word, "correct": True, "suggestions": []}

        return {
            "word": word,
            "correct": False,
            "suggestions": _suggest(word),
        }

    # ============================================================
    # Private helpers
    # ============================================================

    # แท็กที่จบบรรทัดใน Quill — แทนด้วย \n ไม่งั้นท้ายย่อหน้าจะติดต้นย่อหน้าถัดไป
    # (ที่มาของ "วและ", "เองห" ในผลเก่า)
    _BLOCK_TAG = re.compile(r'</(p|div|h[1-6]|li|blockquote|pre)>|<br\s*/?>', re.I)

    def _preprocess(self, text: str) -> str:
        """
        ลบ HTML ให้เหลือข้อความล้วน

        ไม่ normalize() แล้ว — มันลบ/สลับสระวรรณยุกต์ ทำให้ offset ไม่ตรงกับ editor
        และกลบคำที่พิมพ์สระซ้อนผิดซึ่งเป็นคำผิดที่ควรเห็นเอง
        """
        if "<" in text:
            text = self._BLOCK_TAG.sub("\n", text)
            text = re.sub(r'<[^>]*>', '', text)
            text = html.unescape(text)
        return text.replace("\xa0", " ")

    def _count_words(self, text: str) -> int:
        # ponytail: นับคร่าว ๆ ด้วย newmm (เร็ว) — ใช้แค่แสดงผล ไม่ต้องแม่น
        return sum(1 for t in word_tokenize(text, engine="newmm") if self._is_real_word(t))

    def _tokenize(self, text: str) -> List[str]:
        """Tokenize — ใช้ attacut ถ้ามี, fallback newmm (จับคำผิดได้น้อยกว่ามาก ดูหมายเหตุด้านบน)"""
        tok = _get_tokenizer()
        if tok:
            try:
                tokens = tok.tokenize(text)
                # attacut คืน "|"-delimited string หรือ list ขึ้นกับ version
                if isinstance(tokens, str):
                    return tokens.split("|")
                return list(tokens)
            except Exception:
                pass  # fallback newmm
        return word_tokenize(text, engine="newmm", custom_dict=self._get_custom_trie())

    def _is_real_word(self, token: str) -> bool:
        """กรองเฉพาะ token ที่เป็นคำจริงๆ (มีตัวอักษรไทย)"""
        return bool(re.search(r'[฀-๿]', token))

    @staticmethod
    def _edit_distance(a: str, b: str) -> int:
        """Levenshtein distance สำหรับ rank suggestions"""
        if len(a) < len(b):
            return NovelSpellChecker._edit_distance(b, a)
        if len(b) == 0:
            return len(a)
        prev = list(range(len(b) + 1))
        for i, ca in enumerate(a):
            curr = [i + 1]
            for j, cb in enumerate(b):
                curr.append(min(
                    prev[j + 1] + 1,
                    curr[j] + 1,
                    prev[j] + (0 if ca == cb else 1)
                ))
            prev = curr
        return prev[-1]


# ============================================================
# Convenience functions (for direct import)
# ============================================================

def check_novel_text(
    text: str,
    custom_words: Optional[List[str]] = None,
    entities: Optional[List[dict]] = None,
) -> SpellCheckResult:
    """
    ฟังก์ชั่นหลักสำหรับตรวจคำผิดในนิยาย

    Args:
        text: เนื้อหานิยาย (HTML หรือข้อความล้วน)
        custom_words: ชื่อล้วน (รูปเดิม ถือเป็น character)
        entities: [{text, type}] คำเฉพาะพร้อมประเภท
    """
    checker = NovelSpellChecker(custom_words=custom_words, entities=entities)
    return checker.check_text(text)


def quick_check(word: str) -> dict:
    """ตรวจคำเดียวแบบเร็ว ไม่ต้อง init checker"""
    checker = NovelSpellChecker()
    return checker.check_word(word)


if __name__ == "__main__":
    # เช็คตัวเอง (ไม่แตะ Longdo / LM) — รัน: python spell_checker.py
    ents = [{"text": "เรย์กะ", "type": "character"}, {"text": "เรย์", "type": "character"},
            {"text": "หอคอยนิรันดร์", "type": "location"}]
    src = "ดาบของเรย์กะพริบ ณ หอคอยนิรันดร์ แล้วอนุญาติ"
    masked, spans = mask_entities(src, ents)
    assert masked == "ดาบของเขาพริบ ณ ที่นั่น แล้วอนุญาติ", masked
    assert [s.name for s in spans] == ["เรย์กะ", "หอคอยนิรันดร์"]  # ยาวสุดชนะ
    i = masked.index("อนุญาติ")
    assert src[unmask_offset(i, spans):].startswith("อนุญาติ")
    assert unmask_offset(masked.index("เขา") + 1, spans) is None   # ในช่วง mask -> ทิ้ง

    c = NovelSpellChecker(entities=ents)
    assert c._preprocess("<p>เองห</p><p>และ&amp;</p>") == "เองห\nและ&\n"
    assert c._should_skip("มมมมมม") and c._should_skip("อ๊าด") and not c._should_skip("อนุญาติ")
    # สระ/วรรณยุกต์เบิ้ล — ต้องจับได้ทุกรูป ไม่ขึ้นกับตัวตัดคำ
    found = {e.word: e.kind for e in scan_doubled(
        "จากเเพื่อนของ เรืิิองแสง ม่าานควัน ไปป่่า ข้้าง ไม่่้รู้ ว้าาาา ไไม่ เด็็ก คะะ น้ำำ ปกติดี")}
    assert found.get("เเพื่อน") == "double_vowel", found
    assert found.get("ว้าาาา") == "elongation", found
    assert {"เรืิิอง", "เด็็ก", "ไไม่"} <= set(found) or {"เรืิิองแสง", "เด็็ก", "ไไม่"} <= set(found), found
    assert len(found) == 11 and "ปกติดี" not in found, found
    # วรรคแทรกกลางคำ
    split = {e.word: e.suggestions[0] for e in scan_split_words("เสีย งกลอง ความ รู้สึก ดอก ไม้ ปาฏิหา ริย์")}
    assert split.get("เสีย ง") == "เสียง", split
    assert split.get("ปาฏิหา ริย์") == "ปาฏิหาริย์", split
    assert "ความ รู้สึก" not in split and "ดอก ไม้" not in split, split
    # ด่านสุดท้าย
    t = "เรย์ไป เรย์มา เรย์นั่ง เรย์นอน ไไม่"
    errs = [SpellError("เรย์", -1, t.find("เรย์", i), ["เกรย์"], "", -1) for i in (0, 7, 14, 22)]
    errs += [SpellError("ไไม่", -1, t.find("ไไม่"), ["ไม่"], "", -1, kind="double_vowel"),
             SpellError("ไไ", -1, t.find("ไไม่"), ["ไ"], "", -1),             # ซ้อน -> double_vowel ชนะ
             SpellError("ผิดที่", -1, 0, ["x"], "", -1)]                        # ข้อความไม่ตรงตำแหน่ง -> ทิ้ง
    v = validate_errors(errs, t)
    assert [(e.word, e.kind, e.count) for e in v] == [("เรย์", "repeated", 4), ("ไไม่", "double_vowel", 1)], v
    assert [c for c in _line_chunks("ก" * 5 + "\n" + "ข" * 5 + "\n" + "ค" * 5, 8)] == \
        [(0, "กกกกก\n"), (6, "ขขขขข\n"), (12, "ค" * 5)]
    print("✅ spell_checker self-check ผ่าน")
