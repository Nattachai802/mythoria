import re
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