"""
Gemini Embedding Service
Uses Google Generative AI to create text embeddings
"""

import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set. Please add it to your .env file.")
genai.configure(api_key=GEMINI_API_KEY)


def generate_embedding(text: str) -> list[float]:
    """Generate embedding vector for text using Gemini API"""
    if not text or not text.strip():
        return [0.0] * 768  # Return zero vector for empty text
    
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        print(f"[Embedding] Error: {e}")
        return [0.0] * 768


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts"""
    return [generate_embedding(text) for text in texts]
