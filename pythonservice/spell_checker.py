"""
Thai Novel Spell Checker
ตรวจจับคำผิดในนิยายภาษาไทยโดยใช้ PyThaiNLP
รองรับชื่อตัวละคร / สถานที่ / คำศัพท์เฉพาะของเรื่อง เพื่อไม่ให้ถูกตีว่าผิด
"""

import re
import threading
from typing import List, Optional
from dataclasses import dataclass, field
from pythainlp.spell import spell, correct
from pythainlp.tokenize import word_tokenize, sent_tokenize
from pythainlp.util import normalize, dict_trie
from pythainlp.corpus.common import thai_words
from build_spell_cache import load_cache, build_cache, save_cache, CACHE_FILE

# โหลด Thai dictionary เป็น set ครั้งเดียวตอน import (O(1) lookup)
_THAI_DICT: frozenset = frozenset(thai_words())

# โหลด suggestion cache จาก .pkl (ถ้ามี)
_SUGGESTION_CACHE: dict = load_cache() or {}
_CACHE_BUILDING = False  # flag บอกว่ากำลัง build อยู่


def _background_build():
    """Build spell cache ใน background thread — ไม่บล็อก service"""
    global _SUGGESTION_CACHE, _CACHE_BUILDING
    _CACHE_BUILDING = True
    print("[SpellChecker] background build เริ่มต้น...")
    try:
        cache = build_cache(verbose=True)
        save_cache(cache, CACHE_FILE)
        _SUGGESTION_CACHE.update(cache)
        print(f"[SpellChecker] background build เสร็จ — {len(cache)} คำ")
    except Exception as e:
        print(f"[SpellChecker] background build ล้มเหลว: {e}")
    finally:
        _CACHE_BUILDING = False


def ensure_cache_built():
    """เรียกตอน startup — ถ้าไม่มี cache ให้ build ใน background"""
    if not _SUGGESTION_CACHE and not _CACHE_BUILDING:
        print("[SpellChecker] ไม่มี cache — เริ่ม background build (service ยังรับ request ได้ปกติ)")
        t = threading.Thread(target=_background_build, daemon=True)
        t.start()
    elif _SUGGESTION_CACHE:
        print(f"[SpellChecker] cache พร้อม — {len(_SUGGESTION_CACHE)} คำ โหลดจาก pkl")


# ตรวจว่า attacut ติดตั้งอยู่ไหม
try:
    from attacut import Tokenizer as AttacutTokenizer
    _ATTACUT = AttacutTokenizer("attacut-sc")
    _USE_ATTACUT = True
    print("[SpellChecker] tokenizer: attacut-sc")
except Exception:
    _ATTACUT = None
    _USE_ATTACUT = False
    print("[SpellChecker] tokenizer: newmm (attacut not available)")


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
        self._custom_trie = dict_trie(self.custom_whitelist) if self.custom_whitelist else None

        # ชี้ไปที่ global suggestion cache
        self._suggestion_cache = _SUGGESTION_CACHE

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
        print(f"[SpellChecker] thai dict size   : {len(_THAI_DICT)} words")
        print(f"[SpellChecker] suggestion cache : {len(_SUGGESTION_CACHE)} words cached")

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
                in_dict = (word in _THAI_DICT) or (word in self.custom_whitelist)

                if not in_dict:
                    # หา suggestions เฉพาะคำที่ผิด โดยใช้ cache
                    if word not in self._suggestion_cache:
                        candidates = spell(word)
                        self._suggestion_cache[word] = sorted(
                            [c for c in candidates if c != word],
                            key=lambda c: self._edit_distance(word, c)
                        )[:5]
                    suggestions = self._suggestion_cache[word]

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
        print(f"[SpellChecker] suggestion cache : {len(_SUGGESTION_CACHE)} words (after)")

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

        is_correct = (word in _THAI_DICT) or (word in self.custom_whitelist)
        if is_correct:
            return {"word": word, "correct": True, "suggestions": []}

        if word not in self._suggestion_cache:
            candidates = spell(word)
            self._suggestion_cache[word] = sorted(
                [c for c in candidates if c != word],
                key=lambda c: self._edit_distance(word, c)
            )[:5]

        return {
            "word": word,
            "correct": False,
            "suggestions": self._suggestion_cache[word],
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
        """Tokenize — ใช้ attacut ถ้ามี, fallback newmm"""
        if _USE_ATTACUT and _ATTACUT:
            try:
                tokens = _ATTACUT.tokenize(text)
                # attacut คืน "|"-delimited string หรือ list ขึ้นกับ version
                if isinstance(tokens, str):
                    return tokens.split("|")
                return list(tokens)
            except Exception:
                pass  # fallback newmm
        if self._custom_trie:
            return word_tokenize(text, engine="newmm", custom_dict=self._custom_trie)
        return word_tokenize(text, engine="newmm")

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
