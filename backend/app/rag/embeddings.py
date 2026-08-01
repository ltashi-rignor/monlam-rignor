"""Embedding service — BGE-M3 for Tibetan-capable multilingual retrieval.

The model is large; we warm it in a background thread at API startup so
request handlers are not the first to pay the load cost. Concurrent callers
share one load via a lock.
"""

from __future__ import annotations

import logging
import threading
from functools import lru_cache

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmbeddingNotReady(RuntimeError):
    """Raised when the model is still loading and a non-blocking call is made."""


class EmbeddingService:
    def __init__(self) -> None:
        settings = get_settings()
        self.model_name = settings.embedding_model
        self.dim = settings.embedding_dim
        self.local_files_only = bool(settings.embedding_local_files_only)
        self._model = None
        self._lock = threading.Lock()
        self._loading = False
        self._ready = threading.Event()
        self._warm_started = False

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    def warm_async(self) -> None:
        """Start loading in a daemon thread (idempotent)."""
        if self._model is not None or self._warm_started:
            return
        self._warm_started = True
        thread = threading.Thread(
            target=self._warm_worker,
            name="embed-warm",
            daemon=True,
        )
        thread.start()

    def _warm_worker(self) -> None:
        try:
            self._load()
            logger.info("Embedding model ready (%s)", self.model_name)
        except Exception:
            logger.exception("Background embedding warm-up failed")
            self._warm_started = False

    def _load(self):
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is not None:
                return self._model
            self._loading = True
            from sentence_transformers import SentenceTransformer

            logger.info(
                "Loading embedding model %s (local_files_only=%s) ...",
                self.model_name,
                self.local_files_only,
            )
            try:
                self._model = SentenceTransformer(
                    self.model_name,
                    local_files_only=self.local_files_only,
                )
            except Exception:
                if self.local_files_only:
                    logger.warning(
                        "Local embedding cache miss — retrying with download allowed"
                    )
                    self._model = SentenceTransformer(
                        self.model_name,
                        local_files_only=False,
                    )
                else:
                    raise
            self._ready.set()
            self._loading = False
            return self._model

    def wait_ready(self, timeout: float | None = None) -> bool:
        if self._model is not None:
            return True
        self.warm_async()
        return self._ready.wait(timeout=timeout)

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model = self._load()
        vectors = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]

    def try_embed_one(self, text: str, *, wait_s: float = 0.0) -> list[float] | None:
        """Embed if ready (optionally wait briefly); else None — caller can skip RAG."""
        if self._model is None:
            if wait_s > 0:
                self.wait_ready(timeout=wait_s)
            if self._model is None:
                self.warm_async()
                return None
        return self.embed_one(text)


@lru_cache
def get_embeddings() -> EmbeddingService:
    return EmbeddingService()
