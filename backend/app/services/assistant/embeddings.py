"""Embedding providers.

* ``local`` – a deterministic hashed bag of words / bigrams / character trigrams. No model download, no network,
  works offline and is cheap to rebuild. It is lexical-fuzzy rather than truly semantic.
* ``openai`` – any OpenAI-compatible ``/embeddings`` endpoint (OpenAI, Together, Voyage-compatible gateways, Ollama...)
  for real semantic search. Configure EMBEDDING_BASE_URL / EMBEDDING_API_KEY (or OPENAI_API_KEY).
"""

import hashlib
import logging
import math
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.services.assistant.text import tokens

log = logging.getLogger("assistant.embeddings")

LOCAL_DIM = 512


def _bucket(feature: str) -> tuple[int, float]:
    h = int.from_bytes(hashlib.blake2b(feature.encode(), digest_size=8).digest(), "big")
    return h % LOCAL_DIM, 1.0 if (h >> 40) & 1 else -1.0


def local_embed(text: str) -> list[float]:
    toks = tokens(text)
    vec = [0.0] * LOCAL_DIM
    counts: dict[str, float] = {}
    for i, t in enumerate(toks):
        counts[f"w:{t}"] = counts.get(f"w:{t}", 0.0) + 1.0
        if i + 1 < len(toks):
            counts[f"b:{t}_{toks[i + 1]}"] = counts.get(f"b:{t}_{toks[i + 1]}", 0.0) + 0.7
        if len(t) >= 5:
            padded = f"^{t}$"
            for j in range(len(padded) - 2):
                key = f"c:{padded[j:j + 3]}"
                counts[key] = counts.get(key, 0.0) + 0.25
    for feat, c in counts.items():
        idx, sign = _bucket(feat)
        vec[idx] += sign * (1.0 + math.log(c) if c >= 1 else c)
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 4) for v in vec]


@dataclass(frozen=True)
class Embedder:
    id: str
    provider: str
    model: str

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self.provider == "local":
            return [local_embed(t) for t in texts]
        base = (settings.EMBEDDING_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        key = settings.EMBEDDING_API_KEY or settings.OPENAI_API_KEY
        if not key:
            raise RuntimeError("Embedding API key is not configured (EMBEDDING_API_KEY or OPENAI_API_KEY)")
        out: list[list[float]] = []
        for i in range(0, len(texts), 64):
            batch = [t[:6000] for t in texts[i : i + 64]]
            r = httpx.post(
                f"{base}/embeddings",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": self.model, "input": batch},
                timeout=30.0,
            )
            r.raise_for_status()
            data = sorted(r.json()["data"], key=lambda d: d["index"])
            out.extend([[round(x, 5) for x in d["embedding"]] for d in data])
        return out


def get_embedder(provider: str, model: str) -> Embedder:
    if provider == "openai":
        return Embedder(id=f"openai:{model}", provider="openai", model=model)
    return Embedder(id="local-hash-v1", provider="local", model="local-hash-v1")


def cosine(a: list[float], b: list[float]) -> float:
    if not a or len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b, strict=False))
