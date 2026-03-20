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
    
    # 5. วิเคราะห์คลังคำศัพท์ (Lexical Richness) ของผู้แต่ง
    import string
    all_tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    exclude_chars = set(punct_analyzer.PUNCT_MAP.keys()) | set(string.punctuation)
    filtered_tokens = [t for t in all_tokens if t.strip() and t not in exclude_chars]
    unique_tokens = set(filtered_tokens)
    
    total_words = len(filtered_tokens)
    unique_words = len(unique_tokens)
    ttr = round((unique_words / total_words) * 100, 2) if total_words > 0 else 0
    
    stopwords = thai_stopwords()
    meaningful_words = [t for t in filtered_tokens if t not in stopwords and len(t) > 1]
    top_words = Counter(meaningful_words).most_common(10)
    
    # 6. วิเคราะห์สรีระของตอน (Chapter Anatomy - Showing vs Telling & Pacing)
    sentences = sent_tokenize(text, engine="whitespace+newline")
    total_sentences = len([s for s in sentences if s.strip()])
    avg_words_per_sent = round(total_words / total_sentences, 1) if total_sentences > 0 else 0
    
    total_len = len(text)
    d_len = len(dialogue_text)
    n_len = len(narration_text)
    
    dialogue_ratio = round((d_len / total_len) * 100, 2) if total_len > 0 else 0
    narration_ratio = round((n_len / total_len) * 100, 2) if total_len > 0 else 0
    
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
            "top_10_frequent_words": top_words,
            "richness_level": "สูง (คำศัพท์หลากหลาย)" if ttr > 45 else "ปกติ" if ttr > 30 else "ต่ำ (ใช้คำซ้ำเยอะ)"
        },
        "chapter_anatomy": {
            "total_sentences": total_sentences,
            "avg_words_per_sentence": avg_words_per_sent,
            "dialogue_ratio_percentage": dialogue_ratio,
            "narration_ratio_percentage": narration_ratio,
            "genre_prediction_hint": genre_hint,
            "total_dialogue_blocks": len(dialogues_list)
        }
    }
