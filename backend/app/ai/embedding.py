import hashlib
import logging
import os
from typing import Any
import numpy as np

# Ensure offline operation by default to avoid DNS timeouts in secure sandbox environments
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

logger = logging.getLogger(__name__)

_model_instance = None
_model_failed = False
_embedding_cache: dict[str, np.ndarray] = {}


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.strip().lower().encode("utf-8")).hexdigest()


class EmbeddingEngine:
    """Manages dense sentence embedding generation with local caching and offline safety."""

    MODEL_NAME = "all-MiniLM-L6-v2"
    DIMENSION = 384

    @classmethod
    def get_model(cls):
        global _model_instance, _model_failed
        if _model_instance is not None:
            return _model_instance
        if _model_failed:
            return None

        try:
            from sentence_transformers import SentenceTransformer

            # Attempt loading from local cache first
            try:
                _model_instance = SentenceTransformer(cls.MODEL_NAME, local_files_only=True)
            except Exception:
                # If not locally cached yet, attempt normal load
                _model_instance = SentenceTransformer(cls.MODEL_NAME)
            logger.info("SentenceTransformer '%s' loaded successfully.", cls.MODEL_NAME)
            return _model_instance
        except Exception as exc:
            logger.warning(
                "Could not initialize SentenceTransformer '%s' (%s). Using fallback semantic vectorizer.",
                cls.MODEL_NAME,
                exc,
            )
            _model_failed = True
            return None

    @classmethod
    def is_dense_available(cls) -> bool:
        return cls.get_model() is not None

    @classmethod
    def get_engine_name(cls) -> str:
        if cls.is_dense_available():
            return f"sentence-transformers/{cls.MODEL_NAME}"
        return "domain-semantic-subword-tfidf (fallback)"

    @classmethod
    def encode(cls, text: str) -> np.ndarray:
        """Encodes text into a normalized dense embedding vector (384-dim)."""
        cleaned = text.strip()
        if not cleaned:
            return np.zeros(cls.DIMENSION, dtype=np.float32)

        cache_key = _text_hash(cleaned)
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]

        model = cls.get_model()
        if model is not None:
            try:
                raw_emb = model.encode(cleaned, convert_to_numpy=True, normalize_embeddings=True)
                emb = np.array(raw_emb, dtype=np.float32)
                _embedding_cache[cache_key] = emb
                return emb
            except Exception as exc:
                logger.warning("Dense encoding failed (%s). Falling back.", exc)

        # Fallback deterministic pseudo-dense projection if sentence-transformers is unavailable
        from sklearn.feature_extraction.text import HashingVectorizer

        vec = HashingVectorizer(n_features=cls.DIMENSION, norm="l2", alternate_sign=False)
        matrix = vec.transform([cleaned.lower()]).toarray()
        emb = np.array(matrix[0], dtype=np.float32)
        _embedding_cache[cache_key] = emb
        return emb

    @classmethod
    def encode_batch(cls, texts: list[str]) -> list[np.ndarray]:
        return [cls.encode(t) for t in texts]

    @classmethod
    def cosine_similarity(cls, emb_a: np.ndarray, emb_b: np.ndarray) -> float:
        """Calculates cosine similarity between two 1D vectors."""
        norm_a = np.linalg.norm(emb_a)
        norm_b = np.linalg.norm(emb_b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        dot = float(np.dot(emb_a, emb_b))
        sim = dot / (norm_a * norm_b)
        return float(np.clip(sim, 0.0, 1.0))

