"""
Thai Novel Spell Checker
ตรวจจับคำผิดในนิยายภาษาไทยโดยใช้ PyThaiNLP
รองรับชื่อตัวละคร / สถานที่ / คำศัพท์เฉพาะของเรื่อง เพื่อไม่ให้ถูกตีว่าผิด
"""

import os
import re
from typing import List, Optional
from dataclasses import dataclass, field
from pythainlp.spell import spell, correct
from pythainlp.tokenize import word_tokenize, sent_tokenize
from pythainlp.util import normalize, dict_trie
from pythainlp.corpus.common import thai_words

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


# ============================================================
# Data Classes
# ============================================================

@dataclass
class SpellError:
    word: str                        # คำที่ผิด
    position: int                    # index ใน token list
    offset: int                      # char offset ใน text ดั้งเดิม
    suggestions: List[str]           # คำที่น่าจะถูก
    sentence: str                    # ประโยคที่พบ (context)
    sentence_index: int              # ประโยคที่ n


@dataclass
class SpellCheckResult:
    original_text: str
    errors: List[SpellError]
    total_words: int
    error_count: int
    custom_words_used: List[str]     # คำ custom ที่ skip ไป


# ============================================================
# Core Checker
# ============================================================

class NovelSpellChecker:
    """
    Spell checker สำหรับนิยายไทย
    - ใช้ PyThaiNLP NorvigSpellChecker เป็น backend
    - รองรับ whitelist คำเฉพาะของเรื่อง (ชื่อตัวละคร, สถานที่, คำแต่ง)
    - กรองคำที่ไม่ต้องตรวจ (ตัวเลข, อังกฤษ, เครื่องหมาย)
    """

    # Pattern ที่ skip การตรวจ
    SKIP_PATTERNS = [
        re.compile(r'^[a-zA-Z]+$'),              # ภาษาอังกฤษ
        re.compile(r'^\d+$'),                     # ตัวเลข
        re.compile(r'^[^฀-๿]+$'),      # ไม่ใช่ภาษาไทยเลย
        re.compile(r'^["\'\"\"\'\'「」『』《》【】\[\]()（）\-–—_.,!?:;…]+$'),  # เครื่องหมาย
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
    }

    def __init__(self, custom_words: Optional[List[str]] = None):
        """
        custom_words: ชื่อตัวละคร, สถานที่, คำเฉพาะของเรื่อง
        """
        self.custom_whitelist: set = set(self.BUILTIN_WHITELIST)

        if custom_words:
            for w in custom_words:
                if w and w.strip():
                    self.custom_whitelist.add(w.strip())
                    # เพิ่มรูปแบบย่อย เช่น "เอริส ไรกะ" → "เอริส", "ไรกะ"
                    for part in w.strip().split():
                        if part:
                            self.custom_whitelist.add(part)

        # สร้าง custom trie สำหรับ tokenizer
        # ต้อง union กับ thai_words() ด้วย — custom_dict ของ PyThaiNLP "แทนที่" พจนานุกรม
        # ไม่ใช่ "เพิ่มเข้าไป" ถ้าส่งแค่ whitelist ตัวตัดคำจะรู้จักแค่ ~50 คำ แล้วเชื่อม
        # ช่วงที่ไม่รู้จักเป็นก้อนเดียว ("ถูกทิ้งร้างมานานนับศตวรรษ" กลายเป็น token เดียว)
        self._custom_trie = dict_trie(set(thai_words()) | self.custom_whitelist)


    def _should_skip(self, word: str) -> bool:
        """คืน True ถ้าคำนี้ไม่ต้องตรวจ"""
        if word in self.custom_whitelist:
            return True
        if len(word) <= 1:
            return True
        for pattern in self.SKIP_PATTERNS:
            if pattern.match(word):
                return True
        return False

    def _get_char_offset(self, text: str, tokens: List[str], token_index: int) -> int:
        """หา character offset ของ token ใน text ดั้งเดิม"""
        pos = 0
        for i, token in enumerate(tokens):
            idx = text.find(token, pos)
            if idx == -1:
                idx = pos
            if i == token_index:
                return idx
            pos = idx + len(token)
        return -1

    def check_text(self, text: str) -> SpellCheckResult:
        """ตรวจสอบ text ทั้งหมด คืน SpellCheckResult"""
        import time
        t0 = time.time()

        cleaned = self._preprocess(text)
        sentences = sent_tokenize(cleaned, engine="whitespace+newline")

        print(f"[SpellChecker] text length      : {len(text)} chars")
        print(f"[SpellChecker] sentences        : {len(sentences)}")
        print(f"[SpellChecker] whitelist size   : {len(self.custom_whitelist)}")
        print(f"[SpellChecker] thai dict size   : {len(_get_thai_dict())} words")

        errors: List[SpellError] = []
        total_words = 0
        custom_words_found: set = set()

        char_offset_base = 0

        for sent_idx, sentence in enumerate(sentences):
            tokens = self._tokenize(sentence)
            real_tokens = [t for t in tokens if self._is_real_word(t)]
            total_words += len(real_tokens)

            print(f"[SpellChecker] sent[{sent_idx}] tokens={real_tokens}")

            for tok_idx, word in enumerate(tokens):
                if not self._is_real_word(word):
                    continue

                if word in self.custom_whitelist:
                    custom_words_found.add(word)
                    print(f"[SpellChecker]   SKIP (whitelist): {word!r}")
                    continue

                if self._should_skip(word):
                    print(f"[SpellChecker]   SKIP (pattern)  : {word!r}")
                    continue

                # ตรวจสอบด้วย dictionary lookup (O(1)) — เร็วกว่า spell() มาก
                in_dict = (word in _get_thai_dict()) or (word in self.custom_whitelist)

                if not in_dict:
                    # หา suggestions เฉพาะคำที่ผิด — เร็วพอจนไม่ต้อง cache (ดูหมายเหตุบนสุด)
                    suggestions = _suggest(word)

                    offset = self._get_char_offset(sentence, tokens, tok_idx)

                    print(f"[SpellChecker]   ERROR: {word!r} -> suggestions={suggestions}")
                    errors.append(SpellError(
                        word=word,
                        position=tok_idx,
                        offset=char_offset_base + offset,
                        suggestions=suggestions,
                        sentence=sentence.strip(),
                        sentence_index=sent_idx,
                    ))
                else:
                    print(f"[SpellChecker]   OK   : {word!r}")

            char_offset_base += len(sentence)

        elapsed = time.time() - t0
        print(f"[SpellChecker] done -- {total_words} words, {len(errors)} errors, {elapsed:.2f}s")

        return SpellCheckResult(
            original_text=text,
            errors=errors,
            total_words=total_words,
            error_count=len(errors),
            custom_words_used=sorted(custom_words_found),
        )

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

    def add_custom_words(self, words: List[str]):
        """เพิ่มคำ whitelist หลัง init"""
        for w in words:
            if w and w.strip():
                self.custom_whitelist.add(w.strip())
                for part in w.strip().split():
                    if part:
                        self.custom_whitelist.add(part)
        self._custom_trie = dict_trie(self.custom_whitelist)

    # ============================================================
    # Private helpers
    # ============================================================

    def _preprocess(self, text: str) -> str:
        """Clean text ก่อนตรวจ"""
        text = re.sub(r'<[^>]*>', '', text)           # ลบ HTML tags
        text = text.replace("\xa0", " ")              # Non-breaking space
        text = normalize(text)                        # PyThaiNLP normalize
        return text

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
        return word_tokenize(text, engine="newmm", custom_dict=self._custom_trie)

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
) -> SpellCheckResult:
    """
    ฟังก์ชั่นหลักสำหรับตรวจคำผิดในนิยาย

    Args:
        text: เนื้อหานิยาย
        custom_words: ชื่อตัวละคร, สถานที่ ฯลฯ ที่ไม่ต้องตรวจ

    Returns:
        SpellCheckResult พร้อม errors และ suggestions
    """
    checker = NovelSpellChecker(custom_words=custom_words)
    return checker.check_text(text)


def quick_check(word: str) -> dict:
    """ตรวจคำเดียวแบบเร็ว ไม่ต้อง init checker"""
    checker = NovelSpellChecker()
    return checker.check_word(word)
