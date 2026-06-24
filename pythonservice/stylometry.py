import re
from typing import List, Dict, Any, Tuple
from pythainlp.util import normalize , dict_trie
from pythainlp.tag import pos_tag
from pythainlp.tokenize import word_tokenize, sent_tokenize

def normalize_text(text: str, preserve_elongation: bool = True):
    text = text.replace("&nbsp"," ").replace("\xa0"," ") # remove &nbsp(Non-Breaking Space) and \xa0(whitespace)
    text = re.sub(r'<[^>]*>', '', text) # remove html tags

    text = normalize(text) # normalize text

    elongation_count = 0
    if preserve_elongation:
        pattern = re.compile(r'(.)\1{2,}')
        elongation_count = len(pattern.findall(text))
        text = pattern.sub(r'\1', text)
    
    return text.strip()

def analyze_pos_with_custom(text: str, character_list: list, location_list: list):
    all_custom_names = set(character_list + location_list)
    custom_trie = dict_trie(all_custom_names)
    
    tokens = word_tokenize(text, engine="newmm", custom_dict=custom_trie)
    
    standard_tags = pos_tag(tokens, engine='perceptron', corpus='orchid')
    
    final_tags = []
    for word, tag in standard_tags:
        if word in all_custom_names:
            final_tags.append((word, 'NPRP'))
        else:
            final_tags.append((word, tag))
            
    return final_tags

def segment_and_tokenize(text: str):    
    sentences = sent_tokenize(text, engine="whitespace+newline")
    
    processed_data = []
    all_word_counts = []

    for sent in sentences:
        if not sent.strip():
            continue
            
        tokens = word_tokenize(sent, engine="newmm", keep_whitespace=False)
        
        sent_data = {
            "raw_segment": sent.strip(),
            "tokens": tokens,
            "word_count": len(tokens)
        }
        
        processed_data.append(sent_data)
        all_word_counts.append(len(tokens))

    summary_stats = {
        "total_segments": len(processed_data),
        "total_words": sum(all_word_counts),
        "avg_word_per_segment": sum(all_word_counts) / len(all_word_counts) if all_word_counts else 0,
        "max_segment_length": max(all_word_counts) if all_word_counts else 0
    }

    return processed_data, summary_stats

class DialogExtractor:
    def __init__(self, character_list: List[str], use_word_vector: bool = False):
        self.characters = set(character_list)
        
        # Static speech verbs cache for performance
        self.static_speech_verbs = {
            "พูด", "กล่าว", "ถาม", "ตอบ", "ตะโกน", "บอก", "กระซิบ", 
            "ร้อง", "สวน", "คำราม", "ตวาด", "พึมพำ"
        }
        self.emphasis_markers = {"คือ", "เรียกว่า", "ชื่อว่า", "หมายถึง", "คำว่า", "ฉายา"}
        
        # Word Vector setup for semantic similarity
        self.use_word_vector = use_word_vector
        if self.use_word_vector:
            from pythainlp.word_vector import WordVector
            self.wv = WordVector()
            
        # Regex for quotes: "", “”, '', ‘’
        self.dialog_pattern = re.compile(r'([\"\'\u201c\u201d\u2018\u2019])(.*?)\1')
        self.punct_pattern = re.compile(r'[!?]')

    def _check_dynamic_verb(self, word: str) -> float:
        if not self.use_word_vector:
            return 0.0
        try:
            # higher than 0.55 means close meaning
            sim = self.wv.similarity(word, "พูด")
            return float(sim) if sim > 0.55 else 0.0
        except Exception:
            return 0.0

    def extract(self, text: str, threshold: float = 1.5) -> List[Dict[str, Any]]:
        results = []
        
        # A. Multi-Pattern Splitter
        matches = list(self.dialog_pattern.finditer(text))
        
        for i, match in enumerate(matches):
            quote_type = match.group(1)
            content = match.group(2).strip()
            start, end = match.span()
            
            # 50 chars context before and after
            context_before = text[max(0, start - 50):start]
            context_after = text[end:min(len(text), end + 50)]
            
            tokens_before = word_tokenize(context_before, engine="newmm")
            tokens_after = word_tokenize(context_after, engine="newmm")
            surrounding_tokens = tokens_before + tokens_after
            
            score = 0.0
            found_speaker = None
            found_verb = None
            
            # B & C. Dynamic Speech Verb Finder & Scoring Classifier
            
            # 1. Punctuation Score (+Score)
            if self.punct_pattern.search(content):
                score += 2.0
                
            # 2. Context Score: Character Names (+Score)
            for token in surrounding_tokens:
                if token in self.characters:
                    score += 1.5
                    found_speaker = token
                    break
                    
            # 3. Context Score: Speech Verbs (+Score)
            for token in surrounding_tokens:
                if token in self.static_speech_verbs:
                    score += 2.0
                    found_verb = token
                    break
                elif self.use_word_vector:
                    sim_score = self._check_dynamic_verb(token)
                    if sim_score > 0:
                        score += (sim_score * 2.5)
                        found_verb = token
                        break
                        
            # 4. Grammar / Emphasis Score (-Score)
            # Check for emphasis markers near the quote
            if any(marker in "".join(tokens_before[-3:]) for marker in self.emphasis_markers):
                score -= 3.0
                
            # 5. Length Heuristic (-Score)
            if len(content) < 5 and not found_verb and not found_speaker:
                score -= 1.0
                
            # 6. Chain Bonus
            if i > 0 and results[-1]['is_dialog']:
                prev_end = matches[i-1].end()
                text_between = text[prev_end:start]
                if '\n' in text_between and len(text_between.strip()) < 5:
                    score += 2.0 
                    
            is_dialog = score >= threshold
            
            results.append({
                "text": content,
                "is_dialog": is_dialog,
                "span": (start, end),
                "confidence_score": round(score, 2),
                "metadata": {
                    "guessed_speaker": found_speaker,
                    "guessed_verb": found_verb,
                    "quote_type": quote_type
                }
            })
            
        return results
    


class PunctuationAnalyzer:
    PUNCT_MAP = {
        "\u2026": "ellipsis",
        "!":      "exclamation",
        "?":      "question",
        '"':      "quote_double",
        "\u201c": "quote_double",
        "\u201d": "quote_double",
        "'":      "quote_single",
        "\u2018": "quote_single",
        "\u2019": "quote_single",
    }

    NOTABLE_BIGRAMS = [
        ("ellipsis",    "exclamation"),
        ("exclamation", "exclamation"),
        ("ellipsis",    "ellipsis"),
        ("exclamation", "question"),
        ("question",    "ellipsis"),
    ]

    def __init__(self, custom_notable_bigrams: list = None):
        self._punct_re = re.compile(r'\.{3,}|\u2026|[!?"\u201c\u201d\u2018\u2019\']')
        self.notable_bigrams = custom_notable_bigrams if custom_notable_bigrams is not None else self.NOTABLE_BIGRAMS

    def _label(self, token: str) -> str:
        if re.match(r'\.{2,}', token) or token == "\u2026":
            return "ellipsis"
        return self.PUNCT_MAP.get(token, "other")

    def analyze(self, text: str, word_count: int = None, density_threshold: float = 5.0) -> Dict[str, Any]:
        tokens = self._punct_re.findall(text)
        labels = [self._label(t) for t in tokens]

        counts: Dict[str, int] = {}
        for lbl in labels:
            counts[lbl] = counts.get(lbl, 0) + 1

        total = len(labels)

        if word_count is None:
            word_count = len(word_tokenize(text, engine="newmm", keep_whitespace=False))

        density: Dict[str, float] = {
            k: round((v / word_count) * 1000, 2) if word_count else 0.0
            for k, v in counts.items()
        }
        total_density = round((total / word_count) * 1000, 2) if word_count else 0.0

        bigram_counts: Dict[str, int] = {}
        for i in range(len(labels) - 1):
            key = f"{labels[i]}\u2192{labels[i + 1]}"
            bigram_counts[key] = bigram_counts.get(key, 0) + 1

        notable: Dict[str, int] = {
            f"{a}\u2192{b}": bigram_counts[f"{a}\u2192{b}"]
            for a, b in self.notable_bigrams
            if f"{a}\u2192{b}" in bigram_counts
        }

        dominant = max(counts, key=counts.get) if counts else None
        vibe = self._infer_vibe(counts, total_density, density_threshold)

        return {
            "counts": counts,
            "density_per_1k": density,
            "total_puncts": total,
            "total_density_per_1k": total_density,
            "dominant": dominant,
            "bigram_profile": notable,
            "vibe": vibe,
        }

    def compare(self, chapters: Dict[str, str]) -> Dict[str, Any]:
        return {label: self.analyze(text) for label, text in chapters.items()}

    @staticmethod
    def _infer_vibe(counts: Dict[str, int], density: float, density_threshold: float = 5.0) -> str:
        ellipsis    = counts.get("ellipsis", 0)
        exclamation = counts.get("exclamation", 0)
        question    = counts.get("question", 0)

        if density < density_threshold:
            return "เรียบเฉย (Calm / Narration-heavy)"
        if ellipsis > exclamation and ellipsis > question:
            return "หม่นเงียบ / ลังเล (Melancholic / Hesitant)"
        if exclamation > ellipsis and exclamation > question:
            return "พลังงานสูง / ขัดแย้ง (High-energy / Action)"
        if question > ellipsis:
            return "ชวนสืบ / ไม่แน่ใจ (Investigative / Uncertain)"
        return "ผสมผสาน (Mixed)"


class ParticleAnalyzer:
    """
    วิเคราะห์คำอนุภาค (Particles) ในภาษาไทย
    เพื่อดู Social Hierarchy, Modal Confidence และ Temporal Vibe ของบท
    """

    PARTICLE_TAXONOMY: Dict[str, Any] = {
        "ครับ":       "polite_male",
        "ค่ะ":        "polite_female",
        "นะคะ":       "polite_female",
        "นะครับ":     "polite_male",
        "ขอรับ":      "polite_formal",
        "พ่ะย่ะค่ะ":  "polite_royal",
        "เจ้าค่ะ":    "polite_northern",
        "เจ้าข้า":    "polite_archaic",
        "นะ": {
            "default": "softener",
            "rules": [
                {"prev_words": ["ไป", "ทำ", "กิน", "หยุด", "อย่า"], "category": "assertive"},
                {"prev_words": ["อะไร", "ใคร", "ไหน", "หรือ"], "category": "rhetorical"}
            ]
        },
        "น่ะ":        "softener",
        "หน่อย":      "softener",
        "เนาะ":       "softener_isan",
        "เน้อ":       "softener_northern",
        "วะ":         "casual_male",
        "ว่ะ":        "casual_male",
        "เว้ย":       "casual_male",
        "โว้ย":       "casual_male",
        "ยะ":         "casual_female",
        "จ้า":        "casual_female",
        "จ้ะ":        "casual_female",
        "สิ":         "assertive",
        "ซิ":         "assertive",
        "ล่ะ":        "assertive",
        "เลย": {
            "default": "assertive",
            "rules": [
                {"context_words": ["ไม่", "ไร้", "หา", "มิ", "เปล่า"], "category": "dismissive"} 
            ]
        },
        "หรอก":       "dismissive",
        "หรอกนะ":     "dismissive",
        "มั้ง":       "uncertain",
        "มั๊ง":       "uncertain",
        "คงจะ":       "uncertain",
        "เล่า":       "rhetorical",
        "กระนั้น":    "rhetorical",
        "แล":         "archaic",
        "เอย":        "archaic",
        "นั้นหนา":    "archaic",
        "หนา":        "archaic",
        "เถิด":       "archaic",
        "ทีเถอะ":     "archaic",
        "โดยแท้":     "archaic",
        "ด้วยเถิด":   "archaic",
    }

    CATEGORY_GROUPS: Dict[str, set] = {
        "politeness": {"polite_male", "polite_female", "polite_formal",
                       "polite_royal", "polite_northern", "polite_archaic"},
        "casual":     {"casual_male", "casual_female", "softener",
                       "softener_isan", "softener_northern"},
        "modal":      {"assertive", "dismissive", "uncertain", "rhetorical"},
        "archaic":    {"archaic"},
    }

    def __init__(self, tokenizer_engine: str = "newmm", custom_taxonomy: Dict[str, Any] = None, custom_category_groups: Dict[str, set] = None):
        self.tokenizer_engine = tokenizer_engine
        self.taxonomy = custom_taxonomy if custom_taxonomy is not None else self.PARTICLE_TAXONOMY
        self.category_groups = custom_category_groups if custom_category_groups is not None else self.CATEGORY_GROUPS
        
        self._particle_set = set(self.taxonomy.keys())
        self._particle_trie = dict_trie(self._particle_set)

    def _extract_particles(self, text: str) -> List[tuple]:
        tokens = word_tokenize(
            text, engine=self.tokenizer_engine,
            custom_dict=self._particle_trie,
            keep_whitespace=False
        )
        
        results = []
        for i, token in enumerate(tokens):
            if token in self._particle_set:
                cat_info = self.taxonomy[token]
                
                if isinstance(cat_info, str):
                    cat = cat_info
                else:
                    cat = cat_info.get("default", "unknown")
                    matched = False
                    for rule in cat_info.get("rules", []):
                        if "prev_words" in rule:
                            prev_context = tokens[max(0, i-2):i]
                            if any(w in prev_context for w in rule["prev_words"]):
                                cat = rule["category"]
                                matched = True
                                
                        if not matched and "context_words" in rule:
                            window = tokens[max(0, i-5):min(len(tokens), i+5)]
                            if any(w in window for w in rule["context_words"]):
                                cat = rule["category"]
                                matched = True
                                
                        if matched:
                            break
                            
                results.append((token, cat))
                
        return results

    def analyze(self, text: str) -> Dict[str, Any]:
        found = self._extract_particles(text)

        raw_counts: Dict[str, int] = {}
        category_counts: Dict[str, int] = {}
        group_counts: Dict[str, int] = {g: 0 for g in self.category_groups}

        for p, cat in found:
            raw_counts[p] = raw_counts.get(p, 0) + 1
            category_counts[cat] = category_counts.get(cat, 0) + 1
            for group, cats in self.category_groups.items():
                if cat in cats:
                    group_counts[group] += 1

        dominant_group = max(group_counts, key=group_counts.get) if found else None
        vibe = self._infer_vibe(group_counts, raw_counts)

        return {
            "raw_counts": raw_counts,
            "category_counts": category_counts,
            "group_counts": group_counts,
            "dominant_group": dominant_group,
            "total_particles": len(found),
            "vibe": vibe,
        }

    def track_character_voice(
        self,
        character_dialogs: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        report: Dict[str, Any] = {}

        for char, chapters in character_dialogs.items():
            per_chapter = []
            dominants = []
            drift_detected = []

            for i, ch_text in enumerate(chapters):
                result = self.analyze(ch_text)
                per_chapter.append({f"chapter_{i + 1}": result})
                
                current_dominant = result["dominant_group"]
                dominants.append(current_dominant)

                # ตรวจจับ Consecutive Drift (เทียบกับตอนที่มีข้อมูลล่าสุดก่อนหน้า)
                if i > 0 and current_dominant is not None:
                    # หา dominant ของตอนก่อนหน้าที่มีข้อมูล
                    prev_dominants = [d for d in dominants[:-1] if d is not None]
                    if prev_dominants:
                        prev_dominant = prev_dominants[-1]
                        if current_dominant != prev_dominant:
                            drift_detected.append({
                                "chapter": f"chapter_{i + 1}",
                                "from": prev_dominant,
                                "to": current_dominant
                            })

            report[char] = {
                "per_chapter": per_chapter,
                "dominant_per_chapter": dominants,
                "is_consistent": len(drift_detected) == 0,
                "drift_detected": drift_detected,
            }

        return report

    @staticmethod
    def _infer_vibe(group_counts: Dict[str, int], raw: Dict[str, int]) -> str:
        if not any(group_counts.values()):
            return "ไม่พบ particle ที่วิเคราะห์ได้"

        dominant = max(group_counts, key=group_counts.get)

        if dominant == "archaic":
            return "บรรยากาศย้อนยุค / แฟนตาซีโบราณ (Archaic/Fantasy)"
        if dominant == "politeness":
            if raw.get("ขอรับ", 0) + raw.get("พ่ะย่ะค่ะ", 0) > 0:
                return "สุภาพมาก / ราชสำนัก (Highly Formal / Royal)"
            return "สุภาพปกติ (Polite / Neutral)"
        if dominant == "casual":
            if raw.get("วะ", 0) + raw.get("เว้ย", 0) > 0:
                return "ลำลอง / เพื่อนสนิท ฝั่งชาย (Casual Bro-speak)"
            return "ลำลองทั่วไป (Casual)"
        if dominant == "modal":
            if raw.get("หรอก", 0) > raw.get("สิ", 0):
                return "ประชดประชัน / แก้ตัว (Dismissive/Sarcastic)"
            if raw.get("มั้ง", 0) > 0:
                return "ลังเล / ไม่มั่นใจ (Uncertain)"
            return "มั่นใจ / กล้าแสดงออก (Assertive)"
        return "ผสมผสาน (Mixed)"


class PronounAnalyzer:
    """
    วิเคราะห์สไตล์ของนักเขียน (Author Profiling) ผ่านการใช้คำสรรพนาม (Pronouns)
    1. ภาพรวม (Overview): สรรพนามที่นักเขียนโปรดปรานและเลือกใช้บ่อยที่สุดรอบเรื่อง
    2. ความสม่ำเสมอ (Consistency/Shift): ตอนที่แล้วกับตอนนี้เปลี่ยนสำนวนการใช้สรรพนามไปแค่ไหน
    """

    def analyze_tags(self, pos_tags: List[Tuple[str, str]]) -> Dict[str, Any]:
        """แยก PPRS ออกมานับความถี่สำหรับข้อความ 1 ก้อน (เช่น 1 ตอน)"""
        pronouns = [word for word, tag in pos_tags if tag == 'PPRS']
        counts: Dict[str, int] = {}
        for p in pronouns:
            counts[p] = counts.get(p, 0) + 1
            
        return {
            "counts": counts,
            "total_pronouns": len(pronouns)
        }

    def analyze_text(self, text: str, engine: str = "newmm") -> Dict[str, Any]:
        from pythainlp.tokenize import word_tokenize
        from pythainlp.tag import pos_tag
        tokens = word_tokenize(text, engine=engine)
        tags = pos_tag(tokens, engine='perceptron', corpus='orchid')
        return self.analyze_tags(tags)

    def compile_author_profile(self, chapters_text: Dict[str, str], engine: str = "newmm") -> Dict[str, Any]:
        """
        ประเมินภาพรวมสไตล์นักเขียน และตรวจจับความคลาดเคลื่อนเทียบตอนต่อตอน (Delta/Shift)
        โดยใช้วิธี Cosine Similarity บน Vector ความถี่ของ Pronoun
        """
        import math
        
        # 1. รวบรวมข้อมูลดิบแต่ละตอน
        chapter_stats = {}
        aggregated_counts: Dict[str, int] = {}
        total_all = 0
        
        chapter_order = list(chapters_text.keys())
        
        for ch in chapter_order:
            res = self.analyze_text(chapters_text[ch], engine)
            chapter_stats[ch] = res
            
            # รวมเข้ากองกลางเพื่อหาภาพรวมผู้แต่ง
            for p, c in res["counts"].items():
                aggregated_counts[p] = aggregated_counts.get(p, 0) + c
            total_all += res["total_pronouns"]

        # จัดอันดับคำสรรพนามที่เป็น 'ซิกเนเจอร์' (ตัวท็อป) ของนักเขียนคนนี้
        top_pronouns = sorted(aggregated_counts.items(), key=lambda x: x[1], reverse=True)

        # 2. ปริมาณ Shift ระหว่างตอน (N-1 vs N) ด้วย Math Vector
        shifts = []
        for i in range(1, len(chapter_order)):
            prev_ch = chapter_order[i-1]
            curr_ch = chapter_order[i]
            
            vec_prev = chapter_stats[prev_ch]["counts"]
            vec_curr = chapter_stats[curr_ch]["counts"]
            
            # คำนวณความคล้ายคลึงของชุดคำ (Cosine Similarity)
            all_keys = set(vec_prev.keys()) | set(vec_curr.keys())
            dot = sum(vec_prev.get(k, 0) * vec_curr.get(k, 0) for k in all_keys)
            mag_prev = math.sqrt(sum(v**2 for v in vec_prev.values()))
            mag_curr = math.sqrt(sum(v**2 for v in vec_curr.values()))
            
            if mag_prev > 0 and mag_curr > 0:
                sim = dot / (mag_prev * mag_curr)
            else:
                sim = 0.0 if (mag_prev or mag_curr) else 1.0 # กรณีที่ไม่มีสรรพนามเลยทั้งคู่ ถือว่าเหมือนกัน
                
            shift_percent = round((1 - sim) * 100, 2)
            
            shifts.append({
                "from_chapter": prev_ch,
                "to_chapter": curr_ch,
                "similarity_score": round(sim, 2),
                "shift_percentage": shift_percent,
                "status": "Stable Pattern" if shift_percent < 40.0 else "High Shift (Warning: Style Change)"
            })
            
        return {
            "author_overview": {
                "top_10_signature_pronouns": top_pronouns[:10],
                "total_pronouns_used": total_all,
                "unique_pronouns_count": len(aggregated_counts)
            },
            "chapter_shifts": shifts,
            "chapter_raw_data": chapter_stats
        }

# ============================================================
# Patch 2.5 — Lexical diversity (length-robust) + sentence rhythm
# statistical ล้วน, deterministic, ไม่ใช้ LLM
# ============================================================

def _mtld_pass(tokens: List[str], threshold: float = 0.72) -> float:
    """หนึ่งทิศของ MTLD — นับจำนวน 'factor' ที่ TTR ตกถึง threshold"""
    factors = 0.0
    types: set = set()
    count = 0
    for t in tokens:
        count += 1
        types.add(t)
        if (len(types) / count) <= threshold:
            factors += 1
            types = set()
            count = 0
    if count > 0:
        # factor บางส่วนที่ค้างท้าย
        partial = (1 - (len(types) / count)) / (1 - threshold)
        factors += partial
    return len(tokens) / factors if factors > 0 else float(len(tokens))


def compute_mtld(tokens: List[str], threshold: float = 0.72) -> float:
    """MTLD — ความหลากหลายคำศัพท์ที่ทนต่อความยาว (เฉลี่ย forward + backward)"""
    if len(tokens) < 10:
        return 0.0
    fwd = _mtld_pass(tokens, threshold)
    bwd = _mtld_pass(list(reversed(tokens)), threshold)
    return round((fwd + bwd) / 2, 1)


def compute_mattr(tokens: List[str], window: int = 50) -> float:
    """MATTR — TTR เฉลี่ยจาก sliding window (เทียบตอนยาว-สั้นได้แฟร์), คืนเป็น %"""
    n = len(tokens)
    if n == 0:
        return 0.0
    if n <= window:
        return round(len(set(tokens)) / n * 100, 2)
    total = 0.0
    for i in range(n - window + 1):
        total += len(set(tokens[i:i + window])) / window
    return round(total / (n - window + 1) * 100, 2)


def sentence_rhythm(sentences: List[str]) -> Dict[str, Any]:
    """เส้นจังหวะประโยค — ความยาว (จำนวนคำ) ของแต่ละประโยคตามลำดับ + สถิติ burstiness"""
    import statistics
    lengths: List[int] = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        toks = word_tokenize(s, engine="newmm", keep_whitespace=False)
        wc = len([t for t in toks if t.strip()])
        if wc > 0:
            lengths.append(wc)

    if not lengths:
        return {"curve": [], "mean": 0, "stddev": 0, "burstiness": 0, "longest": 0, "shortest": 0}

    mean = statistics.mean(lengths)
    stdev = statistics.pstdev(lengths) if len(lengths) > 1 else 0.0
    # burstiness: -1 (สม่ำเสมอ) → +1 (สั้นสลับยาวรุนแรง) = จังหวะ action/บรรยายสลับ
    burst = (stdev - mean) / (stdev + mean) if (stdev + mean) > 0 else 0.0
    return {
        "curve": lengths,            # สำหรับ line chart "จังหวะหัวใจ" ของตอน
        "mean": round(mean, 1),
        "stddev": round(stdev, 1),
        "burstiness": round(burst, 3),
        "longest": max(lengths),
        "shortest": min(lengths),
    }


# Patch 2.5 — C1 Echo detector: จับคำที่โผล่ซ้ำในระยะใกล้ (เธอ...เธอ...เธอ / "นั่นเอง" รัวๆ)
# statistical ล้วน · ข้าม connector/particle ที่ซ้ำได้ตามธรรมชาติ แต่คงสรรพนาม (ปัญหาคลาสสิก web novel ไทย)
ECHO_IGNORE = {
    "และ", "ที่", "ก็", "แล้ว", "ของ", "ใน", "เป็น", "มี", "ได้", "จะ", "ไม่", "ว่า",
    "ให้", "กับ", "แต่", "หรือ", "ๆ", "มา", "ไป", "อยู่", "นั้น", "นี้", "คือ", "เมื่อ", "ซึ่ง", "โดย",
}

def detect_echoes(tokens: List[str], exclude: set = None,
                  window: int = 40, min_count: int = 3, max_results: int = 15) -> List[Dict[str, Any]]:
    """หาคำ content ที่ซ้ำ >= min_count ภายในหน้าต่าง window โทเคน → คืนคำ + จำนวน + ตัวอย่าง"""
    exclude = exclude or set()
    positions: Dict[str, List[int]] = {}
    for i, t in enumerate(tokens):
        tt = t.strip()
        if not tt or len(tt) <= 1 or tt in exclude or tt in ECHO_IGNORE:
            continue
        positions.setdefault(tt, []).append(i)

    echoes: List[Dict[str, Any]] = []
    for term, idxs in positions.items():
        if len(idxs) < min_count:
            continue
        # หาหน้าต่างที่หนาแน่นสุด (sliding two-pointer บนตำแหน่งของคำนั้น)
        best, best_lo, lo = 0, idxs[0], 0
        for hi in range(len(idxs)):
            while idxs[hi] - idxs[lo] > window:
                lo += 1
            if hi - lo + 1 > best:
                best, best_lo = hi - lo + 1, idxs[lo]
        if best >= min_count:
            s, e = max(0, best_lo - 4), min(len(tokens), best_lo + 12)
            excerpt = "".join(tokens[s:e]).strip()
            echoes.append({"term": term, "count": best, "excerpt": excerpt})

    echoes.sort(key=lambda x: x["count"], reverse=True)
    return echoes[:max_results]


# Patch 2.6 — #3 Function-word profile (input ของ Burrows's Delta ที่คำนวณ cross-chapter ฝั่ง dashboard)
# คำเล็กที่ใช้โดยไม่รู้ตัว = ลายเซ็นผู้แต่ง (topic-independent) · vocabulary คงที่เพื่อเทียบข้ามตอนได้
THAI_FUNCTION_WORDS = [
    "และ", "แต่", "หรือ", "ก็", "ที่", "ซึ่ง", "โดย", "เพราะ", "จึง", "แล้ว", "ก่อน", "หลัง",
    "ของ", "ใน", "บน", "กับ", "แก่", "ต่อ", "จาก", "ถึง", "ตาม", "เพื่อ",
    "จะ", "ได้", "ต้อง", "ควร", "อาจ", "กำลัง", "เคย", "ยัง", "ไม่",
    "นี้", "นั้น", "นั่น", "นี่", "เอง", "อยู่", "มา", "ไป", "ขึ้น", "ลง",
    "ว่า", "คือ", "เป็น", "มี", "ให้", "อย่าง", "ๆ", "นะ", "สิ", "เถอะ",
]

def function_word_profile(tokens: List[str]) -> Dict[str, float]:
    """ความถี่ function word ต่อ 1000 โทเคน (vocabulary คงที่)"""
    from collections import Counter
    n = len(tokens) or 1
    c = Counter(tokens)
    return {w: round(c.get(w, 0) / n * 1000, 2) for w in THAI_FUNCTION_WORDS}


def rolling_drift(sentences: List[str], win: int = 8, step: int = 4) -> Dict[str, Any]:
    """#4 — เลื่อนหน้าต่างประโยคในตอน หา window ที่ความยาวประโยคเฉลี่ยเพี้ยนจากค่ากลางของตอน
    (ชี้จุดสไตล์หลุดระดับย่อหน้า → จับ AI แทรก / ghostwriter)"""
    sents = [s.strip() for s in sentences if s.strip()]
    if len(sents) < win * 2:
        return {"windows": [], "note": "ตอนสั้นเกินวิเคราะห์ระดับย่อหน้า"}
    windows = []
    i = 0
    while i + max(3, win // 2) <= len(sents):
        chunk = sents[i:i + win]
        wc = [len(word_tokenize(s, engine="newmm", keep_whitespace=False)) for s in chunk]
        windows.append({
            "start_sentence": i,
            "avg_sentence_len": round(sum(wc) / len(wc), 1),
            "excerpt": (" ".join(chunk))[:120],
        })
        i += step
    vals = [w["avg_sentence_len"] for w in windows]
    if len(vals) >= 2:
        m = sum(vals) / len(vals)
        sd = (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5 or 0.001
        for w in windows:
            w["z"] = round((w["avg_sentence_len"] - m) / sd, 2)
            w["drift"] = abs(w["z"]) >= 1.5
    return {"windows": windows}


# Patch 2.6 — #5C POS n-gram profile (ไวยากรณ์เชิงสไตล์: พรรณนา-heavy vs แอ็กชัน-heavy)
# orchid tagset ไม่มี ADJ แยก — คำขยายไทยคือ VATT (attributive verb) / VSTA (stative)
# map tag ละเอียด → หมวดหยาบ เพื่อ distribution + bigram ที่เสถียรพอเทียบข้ามตอน
ORCHID_COARSE = {
    # นาม
    "NCMN": "noun", "NPRP": "noun", "NONM": "noun", "NLBL": "noun", "NCNM": "noun", "NTTL": "noun",
    # สรรพนาม
    "PPRS": "pron", "PDMN": "pron", "PNTR": "pron", "PREL": "pron",
    # กริยา — แยกการกระทำ (action) กับสภาพ/ขยาย (descriptive)
    "VACT": "verb_action",
    "VSTA": "verb_desc", "VATT": "verb_desc",
    # กริยาช่วย
    "XVBM": "aux", "XVAM": "aux", "XVMM": "aux", "XVBB": "aux", "XVAE": "aux",
    # วิเศษณ์
    "ADVN": "adv", "ADVI": "adv", "ADVP": "adv", "ADVS": "adv",
    # เชื่อม / บุพบท / กำหนด / ลักษณนาม
    "JCRG": "conj", "JCMP": "conj", "JSBR": "conj",
    "RPRE": "prep",
    "DDAN": "det", "DDAC": "det", "DDBQ": "det", "DDAQ": "det",
    "CNIT": "clas", "CLTV": "clas", "CMTR": "clas", "CFQC": "clas", "CVBL": "clas",
    # อื่นๆ
    "NEG": "neg", "INT": "intj",
}
# tag ที่ไม่นับใน distribution (เครื่องหมาย/ช่องว่าง)
_POS_SKIP = {"PUNC"}


def pos_ngram_profile(tokens: List[str], top_bigrams: int = 8) -> Dict[str, Any]:
    """#5C — tag ชนิดคำทั้งตอน → สัดส่วนหมวด + bigram ที่พบบ่อย + ratio บอกแนวสไตล์
    reuse perceptron/orchid tagger เดิม ไม่มี lexicon ใหม่"""
    from collections import Counter
    if not tokens:
        return {"distribution": {}, "top_bigrams": [], "ratios": {}, "lean": "ไม่พอวิเคราะห์"}

    tags = pos_tag(tokens, engine="perceptron", corpus="orchid")
    coarse = [ORCHID_COARSE.get(t, "other") for w, t in tags if t not in _POS_SKIP]
    coarse = [c for c in coarse if c != "other"]
    n = len(coarse)
    if n < 20:
        return {"distribution": {}, "top_bigrams": [], "ratios": {}, "lean": "ตอนสั้นเกินวิเคราะห์"}

    cnt = Counter(coarse)
    distribution = {k: round(v / n * 100, 1) for k, v in cnt.most_common()}

    bg = Counter(zip(coarse, coarse[1:]))
    top_bg = [{"pair": f"{a}→{b}", "pct": round(c / (n - 1) * 100, 1)}
              for (a, b), c in bg.most_common(top_bigrams)]

    desc = cnt.get("verb_desc", 0)
    act = cnt.get("verb_action", 0)
    noun = cnt.get("noun", 0) or 1
    ratios = {
        # >1 = พรรณนาเยอะกว่ากริยาการกระทำ
        "descriptive_vs_action": round(desc / act, 2) if act else None,
        # ความหนาแน่นคำขยาย (adv + กริยาขยาย) ต่อ 100 โทเคน
        "modifier_density": round((cnt.get("adv", 0) + desc) / n * 100, 1),
        "noun_ratio": round(noun / n * 100, 1),
    }

    r = ratios["descriptive_vs_action"]
    lean = "สมดุล" if r is None else "พรรณนา-heavy" if r >= 1.3 else "แอ็กชัน-heavy" if r <= 0.7 else "สมดุล"

    return {"distribution": distribution, "top_bigrams": top_bg, "ratios": ratios, "lean": lean}


# Patch 2.6 — #5D Emotional arc + sensory density (statistical ล้วน, lexicon คัดมือสำหรับนิยายไทย)
# ไม่ใช้ LLM — เร็ว, deterministic, อธิบายได้ · คำคัดจากอารมณ์ในงานบรรยาย ไม่ใช่รีวิวสินค้า
THAI_SENTIMENT_POS = {
    "รัก", "ชอบ", "สุข", "มีความสุข", "ยิ้ม", "หัวเราะ", "ดีใจ", "ปลื้ม", "อบอุ่น", "สดใส",
    "งดงาม", "สวย", "หวาน", "อ่อนโยน", "นุ่มนวล", "สงบ", "ผ่อนคลาย", "หวัง", "ภูมิใจ", "มั่นใจ",
    "ปลอดภัย", "อิ่มเอม", "ตื่นเต้น", "สนุก", "ขอบคุณ", "เมตตา", "ปีติ", "เบิกบาน", "ชื่นชม", "ประทับใจ",
    "โล่ง", "ยินดี", "รื่นรมย์", "เปล่งประกาย", "อ่อนหวาน", "ละมุน",
}
THAI_SENTIMENT_NEG = {
    "เกลียด", "โกรธ", "แค้น", "เศร้า", "เสียใจ", "ร้องไห้", "น้ำตา", "กลัว", "หวาดกลัว", "สะพรึง",
    "เจ็บ", "ปวด", "ทรมาน", "ทุกข์", "สิ้นหวัง", "หมดหวัง", "มืด", "หนาวเหน็บ", "เปลี่ยวเหงา", "เหงา",
    "โดดเดี่ยว", "ตาย", "ความตาย", "เลือด", "สั่น", "หวั่น", "วิตก", "กังวล", "อึดอัด", "หดหู่",
    "ขมขื่น", "โหดร้าย", "น่ากลัว", "สยอง", "อาฆาต", "ผิดหวัง", "ว้าเหว่", "ระทม", "โศก", "ตื่นตระหนก",
}
NEGATORS = {"ไม่", "ไม่ได้", "มิ", "ไร้", "ปราศจาก", "หมด", "เลิก"}

SENSORY_LEXICON = {
    "sight": {"เห็น", "มอง", "จ้อง", "แสง", "เงา", "สี", "สว่าง", "มืด", "ประกาย", "ภาพ", "วาววับ", "พร่างพราย", "ริบหรี่", "สลัว", "เปล่งแสง"},
    "sound": {"ได้ยิน", "เสียง", "ดัง", "เงียบ", "กระซิบ", "ตะโกน", "ก้อง", "แว่ว", "ครืน", "ดนตรี", "ร้อง", "คำราม", "อึกทึก", "แผ่วเบา"},
    "touch": {"สัมผัส", "เย็น", "ร้อน", "อุ่น", "นุ่ม", "แข็ง", "หยาบ", "ลื่น", "เปียก", "แห้ง", "สั่น", "อ่อนนุ่ม", "หนาว", "ชื้น"},
    "smell": {"กลิ่น", "หอม", "เหม็น", "ฉุน", "อบอวล", "กรุ่น", "คาว", "หืน"},
    "taste": {"รส", "หวาน", "เปรี้ยว", "เค็ม", "ขม", "เผ็ด", "จืด", "กลมกล่อม", "ฝาด"},
}


def emotional_arc(sentences: List[str]) -> Dict[str, Any]:
    """#5D — ไล่ sentiment ทีละประโยค → เส้นอารมณ์ตลอดตอน (รองรับ negation: 'ไม่สุข' → ลบ)"""
    import statistics
    curve: List[int] = []
    pos_total = neg_total = 0
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        toks = word_tokenize(s, engine="newmm", keep_whitespace=False)
        score = 0
        for i, t in enumerate(toks):
            pol = 1 if t in THAI_SENTIMENT_POS else -1 if t in THAI_SENTIMENT_NEG else 0
            if pol == 0:
                continue
            # negation ภายใน 2 โทเคนก่อนหน้า → กลับขั้ว
            if any(toks[j] in NEGATORS for j in range(max(0, i - 2), i)):
                pol = -pol
            score += pol
            if pol > 0:
                pos_total += 1
            else:
                neg_total += 1
        curve.append(score)

    if not curve:
        return {"curve": [], "valence": 0, "volatility": 0, "trajectory": "ไม่พบคำบ่งอารมณ์", "positive_words": 0, "negative_words": 0}

    emo = pos_total + neg_total
    valence = round((pos_total - neg_total) / emo, 2) if emo else 0  # -1 (มืด) → +1 (สว่าง)
    volatility = round(statistics.pstdev(curve), 2) if len(curve) > 1 else 0.0
    # ทิศทาง: เทียบครึ่งแรก vs ครึ่งหลังของตอน
    half = len(curve) // 2 or 1
    delta = (sum(curve[half:]) / max(1, len(curve) - half)) - (sum(curve[:half]) / half)
    trajectory = "พุ่งขึ้น (จบสว่างกว่าเปิด)" if delta > 0.4 else "ดิ่งลง (จบมืดกว่าเปิด)" if delta < -0.4 else "ทรงตัว"
    return {
        "curve": curve,                      # line chart เส้นอารมณ์
        "valence": valence,
        "volatility": volatility,            # แกว่งมาก = อารมณ์ขึ้นลงรุนแรง
        "trajectory": trajectory,
        "positive_words": pos_total,
        "negative_words": neg_total,
    }


def sensory_density(tokens: List[str]) -> Dict[str, Any]:
    """#5D — ความหนาแน่นคำประสาทสัมผัส (proxy ของ 'showing') ต่อ 1000 โทเคน + ประสาทเด่น"""
    n = len(tokens) or 1
    # substring match — newmm รวมเป็น compound บ่อย ("แสงแดด"⊃"แสง", "อบอุ่น"⊃"อุ่น")
    # คำประสาทสัมผัสเป็นรากคำ จึงปลอดภัยพอ (proxy ความหนาแน่น ไม่ใช่การนับเป๊ะ)
    counts = {sense: sum(1 for t in tokens if any(w in t for w in words))
              for sense, words in SENSORY_LEXICON.items()}
    total = sum(counts.values())
    dominant = max(counts, key=counts.get) if total else None
    return {
        "per_1000": round(total / n * 1000, 1),   # สูง = เขียนให้เห็นภาพ (showing) มาก
        "by_sense": counts,
        "dominant_sense": dominant,
    }


def voice_distances(extracted: List[Dict[str, Any]], particle_analyzer, min_lines: int = 3) -> Dict[str, Any]:
    """C2 — per-character particle fingerprint → ระยะห่างระหว่างตัวละคร (ใกล้กันเกิน = เสียงไม่แตกต่าง)
    หมายเหตุ: อิง guessed_speaker (fuzzy) + ระดับตอนเดียว → ถือเป็น approximate"""
    import itertools, math
    by_char: Dict[str, List[str]] = {}
    for d in extracted:
        if not d.get("is_dialog"):
            continue
        spk = (d.get("metadata") or {}).get("guessed_speaker")
        if spk:
            by_char.setdefault(spk, []).append(d["text"])
    vecs: Dict[str, Dict[str, float]] = {}
    for spk, lines in by_char.items():
        if len(lines) < min_lines:
            continue
        cats = particle_analyzer.analyze("\n".join(lines)).get("category_counts", {})
        tot = sum(cats.values()) or 1
        vecs[spk] = {k: v / tot for k, v in cats.items()}
    keys = list(vecs)
    if len(keys) < 2:
        return {"pairs": [], "note": "ตัวละครที่มีบทพูดพอวิเคราะห์ < 2 คน"}
    allcats = set().union(*[set(v) for v in vecs.values()])
    pairs = []
    for a, b in itertools.combinations(keys, 2):
        dist = math.sqrt(sum((vecs[a].get(c, 0) - vecs[b].get(c, 0)) ** 2 for c in allcats))
        pairs.append({"a": a, "b": b, "distance": round(dist, 3), "too_similar": dist < 0.15})
    pairs.sort(key=lambda x: x["distance"])
    return {"pairs": pairs[:10]}


def analyze_single_chapter_style(text: str, character_names: List[str] = None) -> Dict[str, Any]:
    """
    วิเคราะห์สไตล์ของ 1 ตอน (Chapter) ชุดใหญ่
    รวบยอดทั้ง Pacing (Punctuation), Author Voice (Pronoun), Character Vibes (Particle)
    และเพิ่ม Lexical Richness / Chapter Anatomy แบบเจาะลึก
    """
    from pythainlp.tokenize import word_tokenize, sent_tokenize
    from pythainlp.corpus import thai_stopwords
    from collections import Counter
    import re

    if character_names is None:
        character_names = []
        
    # 1. แยกแยะบทบรรยาย และ บทสนทนา
    extractor = DialogExtractor(character_names)
    extracted = extractor.extract(text)
    
    dialogues_list = [d["text"] for d in extracted if d["is_dialog"]]
    dialogue_text = "\n".join(dialogues_list)
    
    # ใช้วิธีลบ dialogue pattern ออกจาก text เพื่อเอาบทบรรยายเพียวๆ
    narration_text = re.sub(extractor.dialog_pattern, ' ', text)
    
    # 2. วิเคราะห์น้ำเสียง/กราฟอารมณ์จากเครื่องหมายวรรคตอน (ใช้ข้อความรวมทั้งหมด)
    punct_analyzer = PunctuationAnalyzer()
    punct_vibe = punct_analyzer.analyze(text)
    
    # 3. วิเคราะห์สไตล์นักเขียน (Pronouns ในบทบรรยาย)
    pronoun_analyzer = PronounAnalyzer()
    author_voice = pronoun_analyzer.analyze_text(narration_text)
    
    # 4. วิเคราะห์ Character Vibes (Particles ในบทสนทนา)
    particle_analyzer = ParticleAnalyzer()
    char_vibes = particle_analyzer.analyze(dialogue_text)
    # C2 — ระยะห่างเสียงตัวละคร (nest ใน characterDialogueVibes JSONB เดิม)
    char_vibes["voice_distances"] = voice_distances(extracted, particle_analyzer)
    
    # 5. วิเคราะห์คลังคำศัพท์ (Lexical Richness) ของผู้แต่ง
    import string
    all_tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    exclude_chars = set(punct_analyzer.PUNCT_MAP.keys()) | set(string.punctuation)
    filtered_tokens = [t for t in all_tokens if t.strip() and t not in exclude_chars]
    unique_tokens = set(filtered_tokens)
    
    total_words = len(filtered_tokens)
    unique_words = len(unique_tokens)
    ttr = round((unique_words / total_words) * 100, 2) if total_words > 0 else 0
    # Patch 2.5: ตัววัดที่ทนต่อความยาว (แทนการพึ่ง TTR อย่างเดียว)
    mtld = compute_mtld(filtered_tokens)
    mattr = compute_mattr(filtered_tokens)

    stopwords = thai_stopwords()
    meaningful_words = [t for t in filtered_tokens if t not in stopwords and len(t) > 1]
    top_words = Counter(meaningful_words).most_common(10)
    
    # 6. วิเคราะห์สรีระของตอน (Chapter Anatomy - Showing vs Telling & Pacing)
    sentences = sent_tokenize(text, engine="whitespace+newline")
    total_sentences = len([s for s in sentences if s.strip()])
    avg_words_per_sent = round(total_words / total_sentences, 1) if total_sentences > 0 else 0
    
    total_len = len(text)

    # Dialogue footprint = ความยาว span เต็ม (รวมเครื่องหมายคำพูด) ของ quote ที่จัดเป็นบทสนทนา
    # ใช้ span จาก extractor ตัวเดียว เพื่อให้บรรยาย + สนทนา partition กันสะอาด รวมได้ 100% เสมอ
    dialogue_char_len = sum((d["span"][1] - d["span"][0]) for d in extracted if d["is_dialog"])
    dialogue_ratio = round((dialogue_char_len / total_len) * 100, 2) if total_len > 0 else 0
    narration_ratio = round(100 - dialogue_ratio, 2) if total_len > 0 else 0
    
    if dialogue_ratio > 60:
        genre_hint = "เน้นบทสนทนา (Dialog-Heavy / Fast-paced)"
    elif narration_ratio > 70:
        genre_hint = "เน้นการบรรยาย (Descriptive / Slow-Burn)"
    else:
        genre_hint = "สมดุล (Balanced Showing & Telling)"
    
    return {
        "pacing_and_mood": punct_vibe,
        "author_narration_style": author_voice,
        "character_dialogue_vibes": char_vibes,
        "lexical_richness": {
            "total_words": total_words,
            "unique_words": unique_words,
            "type_token_ratio_percentage": ttr,
            # Patch 2.5 — length-robust diversity (ใช้ตัดสิน richness แทน TTR)
            "mtld": mtld,
            "mattr_percentage": mattr,
            "top_10_frequent_words": top_words,
            # #3 — function-word profile (dashboard ใช้คำนวณ Burrows's Delta ข้ามตอน)
            "function_words": function_word_profile(filtered_tokens),
            # richness_level อิง MTLD (TTR เก่ายังคืนไว้เพื่อ backward-compat)
            "richness_level": "สูง (คำศัพท์หลากหลาย)" if mtld > 80 else "ปกติ" if mtld > 50 else "ต่ำ (ใช้คำซ้ำเยอะ)"
        },
        "chapter_anatomy": {
            "total_sentences": total_sentences,
            "avg_words_per_sentence": avg_words_per_sent,
            "dialogue_ratio_percentage": dialogue_ratio,
            "narration_ratio_percentage": narration_ratio,
            "genre_prediction_hint": genre_hint,
            "total_dialogue_blocks": len(dialogues_list),
            # Patch 2.5 — "จังหวะหัวใจ" ของตอน (เส้นความยาวประโยค) — nest ใน anatomy
            # เพื่อไหลผ่าน chapterAnatomy JSONB เดิม ไม่ต้องแก้ schema/route
            "sentence_rhythm": sentence_rhythm(sentences),
            # Patch 2.5 — C1 Echo detector (nest ใน anatomy → ไหลผ่าน chapterAnatomy JSONB เดิม ไม่ต้องแก้ schema/route)
            "echoes": detect_echoes(all_tokens, exclude_chars),
            # #4 — rolling-window drift (จุดสไตล์เพี้ยนระดับย่อหน้า)
            "rolling_drift": rolling_drift(sentences),
            # #5C — POS n-gram (ไวยากรณ์เชิงสไตล์: พรรณนา vs แอ็กชัน) — reuse all_tokens
            "pos_profile": pos_ngram_profile(all_tokens),
            # #5D — เส้นอารมณ์ + ความหนาแน่นประสาทสัมผัส (showing) — reuse sentences/all_tokens
            "emotional_arc": emotional_arc(sentences),
            "sensory_density": sensory_density(all_tokens)
        }
    }
