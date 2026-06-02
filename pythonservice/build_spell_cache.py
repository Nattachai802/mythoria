"""
build_spell_cache.py
สร้าง spell_cache.pkl จาก thai_words() ทั้งหมด

รันมือได้:  python build_spell_cache.py
รันอัตโนมัติ: ถูกเรียกจาก spell_checker.py ตอน startup ถ้าไม่มี cache
"""

import pickle
import time
import os
from pythainlp.spell import spell
from pythainlp.corpus.common import thai_words
import pythainlp

CACHE_FILE = os.path.join(os.path.dirname(__file__), "spell_cache.pkl")
VERSION_KEY = "__pythainlp_version__"


def get_current_version() -> str:
    return pythainlp.__version__


def build_cache(verbose: bool = True) -> dict:
    """
    วนลูปทุกคำใน thai_words() แล้วเรียก spell()
    คืน dict: word -> [suggestions]
    """
    words = list(thai_words())
    total = len(words)
    cache = {}
    t0 = time.time()

    if verbose:
        print(f"[BuildCache] เริ่มสร้าง cache จาก {total} คำ (PyThaiNLP {get_current_version()})")
        print(f"[BuildCache] ประมาณเวลา: {total * 0.001:.0f} – {total * 0.003:.0f} วินาที")

    for i, word in enumerate(words):
        try:
            candidates = spell(word)
            cache[word] = sorted(
                [c for c in candidates if c != word],
                key=lambda c: _edit_distance(word, c)
            )[:5]
        except Exception:
            cache[word] = []

        if verbose and (i + 1) % 5000 == 0:
            elapsed = time.time() - t0
            pct = (i + 1) / total * 100
            eta = elapsed / (i + 1) * (total - i - 1)
            print(f"[BuildCache]   {i+1}/{total} ({pct:.0f}%) — elapsed {elapsed:.0f}s — ETA {eta:.0f}s")

    elapsed = time.time() - t0
    if verbose:
        print(f"[BuildCache] เสร็จ — {total} คำ ใช้เวลา {elapsed:.0f}s")

    return cache


def save_cache(cache: dict, path: str = CACHE_FILE):
    data = {
        VERSION_KEY: get_current_version(),
        "cache": cache,
    }
    with open(path, "wb") as f:
        pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
    size_mb = os.path.getsize(path) / 1024 / 1024
    print(f"[BuildCache] บันทึก {path} ({size_mb:.1f} MB)")


def load_cache(path: str = CACHE_FILE) -> dict | None:
    """
    โหลด cache จาก pkl
    คืน dict ถ้าสำเร็จและ version ตรง, None ถ้าไม่มีหรือ version เปลี่ยน
    """
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)
        saved_version = data.get(VERSION_KEY, "")
        current_version = get_current_version()
        if saved_version != current_version:
            print(f"[BuildCache] version เปลี่ยน ({saved_version} -> {current_version}) จะสร้างใหม่")
            return None
        cache = data.get("cache", {})
        print(f"[BuildCache] โหลด cache {len(cache)} คำ (PyThaiNLP {current_version})")
        return cache
    except Exception as e:
        print(f"[BuildCache] โหลดล้มเหลว: {e}")
        return None


def _edit_distance(a: str, b: str) -> int:
    if len(a) < len(b):
        return _edit_distance(b, a)
    if len(b) == 0:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (0 if ca == cb else 1)))
        prev = curr
    return prev[-1]


if __name__ == "__main__":
    cache = build_cache(verbose=True)
    save_cache(cache)
    print("[BuildCache] done.")
