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
LM_CONTEXT_CHARS = 120


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


def _lm_score(left: str, word: str, right: str) -> float:
    """
    ค่าเฉลี่ย log-prob ของ subword ของ word เมื่อปิดทีละตัว (pseudo-log-likelihood)
    ยิ่งสูง ยิ่งเข้ากับบริบท — เทียบได้เฉพาะระหว่างคำที่อยู่ช่องเดียวกัน
    """
    tok, model, torch = _LM
    enc = lambda s: tok(s.replace(" ", "<_>"), add_special_tokens=False)["input_ids"]
    l_ids, w_ids, r_ids = enc(left)[-60:], enc(word), enc(right)[:60]
    if not w_ids:
        return float("-inf")
    ids = [tok.cls_token_id] + l_ids + w_ids + r_ids + [tok.sep_token_id]
    start = 1 + len(l_ids)
    batch = torch.tensor([ids] * len(w_ids))
    for i in range(len(w_ids)):
        batch[i, start + i] = tok.mask_token_id
    with torch.no_grad():
        logits = model(input_ids=batch).logits
    logp = torch.log_softmax(logits, dim=-1)
    total = sum(logp[i, start + i, w_ids[i]].item() for i in range(len(w_ids)))
    return total / len(w_ids)


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
        masked, spans = mask_entities(cleaned, self.entities)

        raw = self._check_via_longdo(masked)
        engine = "longdo"
        if raw is None:
            if os.getenv("SPELL_FALLBACK_URL"):
                raw, engine = self._check_via_remote(masked), "remote"
            else:
                raw, engine = self.check_local(masked), "local"

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

        found: dict = {}
        for s in spans:
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

    def check_local(self, masked: str) -> List[SpellError]:
        """
        ตัวตรวจในเครื่อง — offset ของผลอ้างกับ masked text ที่รับเข้ามา

        HF Space เรียกฟังก์ชันนี้ตรง ๆ (masking ทำที่ Replit แล้ว ชื่อไม่หลุดออกไป)
        """
        lm = _get_lm()
        errors: List[SpellError] = []
        dictionary = _get_thai_dict()
        cursor = 0
        for line in masked.split("\n"):
            line_start = cursor
            cursor += len(line) + 1
            if not line.strip():
                continue
            pos = line_start
            for tok_idx, word in enumerate(self._tokenize(line)):
                idx = masked.find(word, pos)
                if idx == -1:
                    continue
                pos = idx + len(word)
                # attacut บางทีติดเครื่องหมายมากับคำ ("โทษ”") — ตัดขอบที่ไม่ใช่อักษรไทยออก
                core = re.match(r'^([^฀-๿]*)(.*?)[^฀-๿]*$', word)
                idx, word = idx + len(core.group(1)), core.group(2)
                if not self._is_real_word(word) or self._should_skip(word) or word in dictionary:
                    continue

                # ตัดคำแนะนำแบบแยกคำ ("ป ปาฏิหาริย์", "ป-ปาฏิหาริย์") — hunspell ชอบเสนอ แต่ไม่เคยเป็นคำตอบที่ถูกในภาษาไทย
                suggestions = [
                    s for s in _suggest(word)
                    if " " not in s and "-" not in s and self._edit_distance(word, s) <= 2
                ]

                if lm is not None:
                    # ไม่มีคำแนะนำ = LM เทียบไม่ได้ — ปล่อยผ่าน ดีกว่าขีดแดงชิ้นคำมั่ว
                    if not suggestions:
                        continue
                    left = masked[max(0, idx - LM_CONTEXT_CHARS):idx]
                    right = masked[pos:pos + LM_CONTEXT_CHARS]
                    base = _lm_score(left, word, right)
                    scored = sorted(((_lm_score(left, s, right), s) for s in suggestions), reverse=True)
                    if scored[0][0] - base < LM_MARGIN:
                        continue
                    suggestions = [s for _, s in scored]

                errors.append(SpellError(
                    word=word,
                    position=tok_idx,
                    offset=idx,
                    suggestions=suggestions,
                    sentence="",
                    sentence_index=-1,
                ))
        return errors

    def _check_via_remote(self, masked: str) -> List[SpellError]:
        """ส่ง masked text ไปตรวจที่ HF Space — ล้มให้ throw ผู้เรียกตอบ success=False"""
        import httpx
        res = httpx.post(
            os.environ["SPELL_FALLBACK_URL"].rstrip("/") + "/spell/check-local",
            json={"text": masked},
            headers={
                "x-internal-key": os.getenv("INTERNAL_API_KEY", ""),
                # Space แบบ private ต้องมี HF token (read) ไม่งั้น HF ตอบ 404 ก่อนถึงแอป
                **({"Authorization": f"Bearer {os.environ['HF_TOKEN']}"} if os.getenv("HF_TOKEN") else {}),
            },
            timeout=180.0,  # เผื่อ Space ตื่นจากหลับ + โหลดโมเดล
        )
        res.raise_for_status()
        return [SpellError(**e) for e in res.json()["errors"]]

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
    print("✅ spell_checker self-check ผ่าน")
