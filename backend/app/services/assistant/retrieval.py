"""Hybrid retrieval: BM25 (lexical) + vector similarity, fused with reciprocal rank fusion, plus source-type routing."""

import logging
import math
import threading
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssistantSettings, KnowledgeChunk
from app.services.assistant import store
from app.services.assistant.embeddings import cosine, get_embedder
from app.services.assistant.text import CONTACT_INTENT, expand_query, tokens

log = logging.getLogger("assistant.retrieval")

MAX_CONTEXT_CHARS = 9500


@dataclass
class IndexedChunk:
    id: int
    key: str
    source_type: str
    title: str
    content: str
    url: str | None
    embedding: list[float]
    tf: Counter
    length: int


@dataclass
class Index:
    version: int
    embedder_id: str
    chunks: list[IndexedChunk] = field(default_factory=list)
    df: Counter = field(default_factory=Counter)
    avg_len: float = 1.0


@dataclass
class Retrieved:
    chunks: list[IndexedChunk]
    relevant: bool
    contact_intent: bool
    best_score: float


_cache: Index | None = None
_cache_lock = threading.Lock()


def invalidate_cache() -> None:
    global _cache
    with _cache_lock:
        _cache = None


def _load_index(db: Session, cfg: AssistantSettings, embedder_id: str) -> Index:
    """Per-process cache keyed by (knowledge_version, embedder). A version bump from any worker invalidates it."""
    global _cache
    with _cache_lock:
        if _cache and _cache.version == cfg.knowledge_version and _cache.embedder_id == embedder_id:
            return _cache
    rows = db.scalars(select(KnowledgeChunk).where(KnowledgeChunk.embedder == embedder_id)).all()
    idx = Index(version=cfg.knowledge_version, embedder_id=embedder_id)
    for r in rows:
        toks = tokens(f"{r.title} {r.title} {r.content}")  # title counted twice: cheap field boost
        tf = Counter(toks)
        idx.chunks.append(IndexedChunk(r.id, r.chunk_key, r.source_type, r.title, r.content, r.url, r.embedding or [], tf, len(toks)))
        idx.df.update(tf.keys())
    idx.avg_len = (sum(c.length for c in idx.chunks) / len(idx.chunks)) if idx.chunks else 1.0
    with _cache_lock:
        _cache = idx
    return idx


def _bm25(idx: Index, q_tokens: list[str], chunk: IndexedChunk, k1: float = 1.4, b: float = 0.75) -> float:
    n = len(idx.chunks)
    score = 0.0
    for t in set(q_tokens):
        f = chunk.tf.get(t, 0)
        if not f:
            continue
        df = idx.df.get(t, 0)
        idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
        score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * chunk.length / idx.avg_len))
    return score


def retrieve(db: Session, question: str, previous_user: str | None, *, top_k: int | None = None) -> Retrieved:
    cfg = store.get_or_create(db)
    k = top_k or cfg.top_k
    embedder = get_embedder(cfg.embedding_provider, cfg.embedding_model)
    idx = _load_index(db, cfg, embedder.id)
    contact_intent = bool(CONTACT_INTENT.search(question))
    if not idx.chunks:
        return Retrieved([], False, contact_intent, 0.0)

    # follow-ups ("what about his second paper?") borrow terms from the previous visitor question
    q_tokens, routed = expand_query(question)
    if previous_user:
        prev_tokens, prev_routed = expand_query(previous_user)
        short = len(question.split()) <= 7
        q_tokens = q_tokens * 2 + prev_tokens if short or not q_tokens else q_tokens + prev_tokens[:6]
        if short or not routed:
            routed |= prev_routed

    q_text = f"{question} {previous_user or ''}".strip()
    try:
        q_vec = embedder.embed([q_text])[0]
    except Exception as exc:  # noqa: BLE001 – fall back to lexical-only retrieval
        log.warning("query embedding failed, using lexical retrieval only: %s", exc)
        q_vec = []

    lex = sorted(((c, _bm25(idx, q_tokens, c)) for c in idx.chunks), key=lambda x: -x[1])
    vec = sorted(((c, cosine(q_vec, c.embedding)) for c in idx.chunks), key=lambda x: -x[1]) if q_vec else []
    fused: dict[int, float] = {}
    for rank, (c, s) in enumerate(lex):
        if s > 0:
            fused[c.id] = fused.get(c.id, 0.0) + 1.0 / (60 + rank)
    for rank, (c, s) in enumerate(vec[: max(k * 3, 20)]):
        if s > 0.05:
            fused[c.id] = fused.get(c.id, 0.0) + 1.0 / (60 + rank)
    by_id = {c.id: c for c in idx.chunks}
    ranked = [by_id[i] for i, _ in sorted(fused.items(), key=lambda kv: -kv[1])]

    picked: list[IndexedChunk] = []

    def add(c: IndexedChunk | None) -> None:
        if c and c not in picked:
            picked.append(c)

    # 1. grounding: who is this about
    add(next((c for c in idx.chunks if c.key == "profile:main"), None))
    # 2. explicit coverage for list/count questions about a kind of content
    plural = bool(routed) or any(w in question.lower() for w in ("how many", "list", "all ", "which", "every"))
    if plural:
        add(next((c for c in idx.chunks if c.key == "overview:main"), None))
    for st in sorted(routed):
        in_type = [c for c in ranked if c.source_type == st] or [c for c in idx.chunks if c.source_type == st]
        for c in in_type[:6]:
            add(c)
    if contact_intent:
        add(next((c for c in idx.chunks if c.key == "contact:main"), None))
    # 3. best matches overall
    for c in ranked:
        if len(picked) >= k + 3:
            break
        add(c)

    # budget the context
    out, used = [], 0
    for c in picked:
        size = len(c.content) + len(c.title)
        if used + size > MAX_CONTEXT_CHARS and out:
            continue
        out.append(c)
        used += size

    best_cos = vec[0][1] if vec else 0.0
    best_lex = lex[0][1] if lex else 0.0
    relevant = bool(routed) or best_lex > 1.0 or best_cos >= 0.2
    return Retrieved(out, relevant, contact_intent, max(best_cos, 0.0))
