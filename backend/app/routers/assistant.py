"""Public chat endpoints and the admin management API for the AI assistant."""

from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import client_ip, limiter
from app.models import AdminUser, AssistantMessageLog, KnowledgeChunk
from app.schemas.assistant import (
    AssistantPublicStatus,
    AssistantSettingsRead,
    AssistantSettingsUpdate,
    ChatRequest,
)
from app.services.activity import log_activity
from app.services.assistant import llm, store
from app.services.assistant.analytics import build_analytics
from app.services.assistant.chat import run_chat
from app.services.assistant.knowledge import reindex_safe
from app.services.assistant.retrieval import invalidate_cache

public_router = APIRouter(prefix="/assistant", tags=["assistant"])
admin_router = APIRouter(prefix="/assistant", tags=["admin:assistant"])

SSE_HEADERS = {"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


def _read(cfg) -> AssistantSettingsRead:
    out = AssistantSettingsRead.model_validate(cfg)
    out.llm_configured = llm.llm_configured(cfg.provider)
    out.embeddings_configured = cfg.embedding_provider == "local" or bool(
        settings.EMBEDDING_API_KEY or settings.OPENAI_API_KEY
    )
    return out


def _welcome(cfg, name: str | None) -> str:
    return (cfg.welcome_message or store.DEFAULT_WELCOME).replace("{name}", name or "Sakib")


# ------------------------------------------------------------------ public


@public_router.get("/status", response_model=AssistantPublicStatus)
def public_status(db: Session = Depends(get_db)):
    from app.models import Profile

    cfg = store.get_or_create(db)
    profile = db.scalars(select(Profile).order_by(Profile.id)).first()
    return AssistantPublicStatus(
        enabled=cfg.enabled, name=cfg.name, welcome_message=_welcome(cfg, profile.full_name if profile else None),
        placeholder=cfg.placeholder, knowledge_version=cfg.knowledge_version,
    )


@public_router.get("/suggestions", response_model=list[str])
def suggestions(db: Session = Depends(get_db)):
    cfg = store.get_or_create(db)
    return list(cfg.suggested_questions or [])[:8]


@public_router.post("/chat", summary="Ask the portfolio assistant (Server-Sent Events by default)")
async def chat(body: ChatRequest, request: Request, db: Session = Depends(get_db)):
    cfg = store.get_or_create(db)
    if not cfg.enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The AI assistant is currently turned off.")

    if settings.RATE_LIMIT_ENABLED:
        ip = client_ip(request)
        for bucket, limit, window in (
            ("assistant-min", cfg.rate_limit_per_minute, 60),
            ("assistant-day", cfg.rate_limit_per_day, 86400),
        ):
            ok, retry = limiter.hit(f"{bucket}:{ip}", limit, window)
            if not ok:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "You're asking quickly — please wait a moment and try again."
                    if window == 60 else "Daily question limit reached. Please come back tomorrow, or use the contact form.",
                    headers={"Retry-After": str(retry)},
                )
        start_of_day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        used = db.scalar(select(func.count(AssistantMessageLog.id)).where(AssistantMessageLog.created_at >= start_of_day)) or 0
        if used >= cfg.global_daily_cap:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "The assistant has reached its daily capacity. Please try again tomorrow.")
    db.close()  # release the connection before streaming

    if body.stream:
        return StreamingResponse(run_chat(body), media_type="text/event-stream", headers=SSE_HEADERS)

    answer, meta, done = "", {}, {}
    import json

    async for frame in run_chat(body):
        event, _, data = frame.partition("\ndata: ")
        payload = json.loads(data.strip())
        event = event.removeprefix("event: ")
        if event == "token":
            answer += payload["text"]
        elif event == "meta":
            meta = payload
        elif event == "done":
            done = payload
        elif event == "error":
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, payload["message"])
    return {"answer": answer, "sources": meta.get("sources", []), "cta": meta.get("cta"),
            "suggestions": done.get("suggestions", []), "status": done.get("status", "ok")}


# ------------------------------------------------------------------ admin


@admin_router.get("/settings", response_model=AssistantSettingsRead)
def get_settings(db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    return _read(store.get_or_create(db))


_REINDEX_FIELDS = {"embedding_provider", "embedding_model", "enabled_sources", "custom_knowledge"}


@admin_router.put("/settings", response_model=AssistantSettingsRead, summary="Update assistant settings (partial)")
def put_settings(
    body: AssistantSettingsUpdate, bg: BackgroundTasks, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)
):
    cfg = store.get_or_create(db)
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        if value is None:
            continue
        if key == "enabled_sources":
            value = {**(cfg.enabled_sources or {}), **value}
        setattr(cfg, key, value)
    log_activity(db, user, "update", "assistant", cfg.id, "Updated AI assistant settings")
    db.commit()
    db.refresh(cfg)
    if _REINDEX_FIELDS & set(data):
        bg.add_task(reindex_safe, False)
        bg.add_task(invalidate_cache)
    return _read(cfg)


@admin_router.post("/reindex", status_code=status.HTTP_202_ACCEPTED, summary="Rebuild the knowledge index")
def reindex(
    bg: BackgroundTasks, full: bool = Query(True, description="Re-embed every chunk, not only changed ones"),
    db: Session = Depends(get_db), user: AdminUser = Depends(require_admin),
):
    cfg = store.get_or_create(db)
    cfg.index_status = "indexing"
    log_activity(db, user, "update", "assistant", cfg.id, "Rebuilt AI knowledge index")
    db.commit()
    bg.add_task(reindex_safe, full)
    bg.add_task(invalidate_cache)
    return {"status": "indexing"}


@admin_router.get("/status", summary="Indexing status and knowledge breakdown")
def admin_status(db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    cfg = store.get_or_create(db)
    rows = db.execute(
        select(KnowledgeChunk.source_type, func.count(KnowledgeChunk.id), func.max(KnowledgeChunk.updated_at))
        .group_by(KnowledgeChunk.source_type)
    ).all()
    return {
        "index_status": cfg.index_status, "index_error": cfg.index_error, "knowledge_version": cfg.knowledge_version,
        "chunk_count": cfg.chunk_count, "last_indexed_at": cfg.last_indexed_at,
        "llm_configured": llm.llm_configured(cfg.provider), "provider": cfg.provider, "model": cfg.model,
        "sources": [{"type": t, "chunks": n, "updated_at": u} for t, n, u in sorted(rows)],
    }


@admin_router.get("/knowledge", summary="Browse what the assistant currently knows")
def knowledge(
    source_type: str | None = Query(None, max_length=32), db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)
):
    stmt = select(KnowledgeChunk).order_by(KnowledgeChunk.source_type, KnowledgeChunk.id)
    if source_type:
        stmt = stmt.where(KnowledgeChunk.source_type == source_type)
    return [
        {"key": c.chunk_key, "type": c.source_type, "title": c.title, "url": c.url, "version": c.version,
         "preview": c.content[:240]}
        for c in db.scalars(stmt.limit(400)).all()
    ]


@admin_router.get("/analytics")
def analytics(days: int = Query(14, ge=1, le=90), db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    return build_analytics(db, days)
