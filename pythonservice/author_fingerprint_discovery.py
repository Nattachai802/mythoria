import math
from typing import List, Dict, Any, Tuple

class AuthorFingerprint:
    FEATURE_CONFIG = [
        {"key": "ttr", "label": "ความหลากหลายของคลังคำ (TTR)", "weight": 1.5},
        {"key": "punct_density", "label": "ความหนาแน่นของเครื่องหมาย", "weight": 0.8},
        {"key": "avg_sent_len", "label": "ความยาวประโยคเฉลี่ย", "weight": 1.0},
        {"key": "dialogue_ratio", "label": "สัดส่วนบทสนทนา", "weight": 1.2},
        {"key": "particle_density", "label": "ความหนาแน่นของคำลงท้าย", "weight": 1.5}
    ]

    def __init__(self, history: List[Dict[str, float]] = None):
        self.history = history or []
        self.stats = self._calculate_baseline()

    def _calculate_baseline(self) -> Dict[str, Dict[str, float]]:
        if not self.history:
            return {}

        stats = {}
        for feature in self.FEATURE_CONFIG:
            key = feature["key"]
            values = [h.get(key, 0) for h in self.history]
            mean = sum(values) / len(values)
            variance = sum((x - mean) ** 2 for x in values) / len(values)
            std = math.sqrt(variance)
            stats[key] = {
                "mean": mean,
                "std": std if std > 0 else 0.001
            }
        return stats

    def _get_z_score_vector(self, metrics: Dict[str, float]) -> List[float]:
        if not self.stats:
            return [0.0] * len(self.FEATURE_CONFIG)

        z_vector = []
        for feature in self.FEATURE_CONFIG:
            key, weight = feature["key"], feature["weight"]
            val = metrics.get(key, 0)
            mean, std = self.stats[key]["mean"], self.stats[key]["std"]
            z = (val - mean) / std
            z_vector.append(z * weight)
        return z_vector

    def calculate_similarity(self, metrics: Dict[str, float]) -> float:
        if not self.history:
            return 1.0
        
        current_z = self._get_z_score_vector(metrics)
        distance = math.sqrt(sum(z**2 for z in current_z))
        similarity = 1 / (1 + (distance / len(self.FEATURE_CONFIG)))
        return round(similarity, 4)

    def analyze_drift(self, metrics: Dict[str, float], threshold: float = 0.80) -> Dict[str, Any]:
        similarity = self.calculate_similarity(metrics)
        alerts = []
        feature_details = []
        
        if self.stats:
            for feature in self.FEATURE_CONFIG:
                key = feature["key"]
                val = metrics.get(key, 0)
                mean, std = self.stats[key]["mean"], self.stats[key]["std"]
                z = (val - mean) / std
                
                # Full details for every feature
                feature_details.append({
                    "feature": feature["label"],
                    "z_score": round(z, 2),
                    "status": "Stable" if abs(z) <= 1.0 else ("Drifting" if abs(z) <= 1.96 else "Anomaly")
                })
                
                if abs(z) > 1.96:
                    direction = "เพิ่มขึ้น" if z > 0 else "ลดลง"
                    alerts.append({
                        "feature": feature["label"],
                        "z_score": round(z, 2),
                        "message": f"ค่า {feature['label']} {direction} ผิดปกติ ({round(abs(z), 1)} SD)"
                    })

        return {
            "similarity_score": similarity,
            "status": "Stable" if similarity >= threshold else "Drifting",
            "alerts": alerts,
            "feature_details": feature_details,
            "is_anomaly": similarity < threshold
        }

    @staticmethod
    def extract_metrics(stylometry_result: Dict[str, Any]) -> Dict[str, float]:
        lr = stylometry_result.get("lexical_richness", {})
        pm = stylometry_result.get("pacing_and_mood", {})
        ca = stylometry_result.get("chapter_anatomy", {})
        cv = stylometry_result.get("character_dialogue_vibes", {})
        
        total_words = lr.get("total_words", 1)
        return {
            "ttr": lr.get("type_token_ratio_percentage", 0),
            "punct_density": pm.get("total_density_per_1k", 0),
            "avg_sent_len": ca.get("avg_words_per_sentence", 0),
            "dialogue_ratio": ca.get("dialogue_ratio_percentage", 0),
            "particle_density": (cv.get("total_particles", 0) / total_words) * 1000
        }
