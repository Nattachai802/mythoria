import re
from typing import List, Dict, Any
from pythainlp.util import normalize
from pythainlp.tag import pos_tag
from pythainlp.tokenize import word_tokenize, sent_tokenize, dict_trie

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
    
