from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import AssistantMessageLog


def build_analytics(db: Session, days: int = 14) -> dict:
    now = datetime.now(UTC)
    since = now - timedelta(days=days)
    L = AssistantMessageLog
    total, ok, fallback, blocked, error, unanswered, p_tok, c_tok, avg_lat, sessions = db.execute(
        select(
            func.count(L.id),
            func.coalesce(func.sum(case((L.status == "ok", 1), else_=0)), 0),
            func.coalesce(func.sum(case((L.status == "fallback", 1), else_=0)), 0),
            func.coalesce(func.sum(case((L.status == "blocked", 1), else_=0)), 0),
            func.coalesce(func.sum(case((L.status == "error", 1), else_=0)), 0),
            func.coalesce(func.sum(case((L.relevant.is_(False), 1), else_=0)), 0),
            func.coalesce(func.sum(L.prompt_tokens), 0),
            func.coalesce(func.sum(L.completion_tokens), 0),
            func.coalesce(func.avg(L.latency_ms), 0),
            func.count(func.distinct(L.session_hash)),
        ).where(L.created_at >= since)
    ).one()
    rows = db.execute(select(L.created_at, L.status).where(L.created_at >= since)).all()
    per_day: dict[str, int] = {}
    for i in range(days):
        per_day[(since + timedelta(days=i + 1)).date().isoformat()] = 0
    for created, _ in rows:
        key = created.date().isoformat()
        if key in per_day:
            per_day[key] += 1
    recent = db.execute(
        select(L.created_at, L.question, L.status, L.relevant, L.latency_ms).order_by(L.created_at.desc()).limit(25)
    ).all()
    today = db.scalar(select(func.count(L.id)).where(L.created_at >= now.replace(hour=0, minute=0, second=0, microsecond=0)))
    return {
        "window_days": days,
        "total_questions": total,
        "questions_today": today or 0,
        "unique_sessions": sessions,
        "answered": ok,
        "fallback": fallback,
        "blocked": blocked,
        "errors": error,
        "unanswered_or_off_topic": unanswered,
        "prompt_tokens": int(p_tok),
        "completion_tokens": int(c_tok),
        "avg_latency_ms": int(avg_lat or 0),
        "per_day": [{"date": d, "count": c} for d, c in per_day.items()],
        "recent": [
            {"at": r.created_at, "question": r.question, "status": r.status, "relevant": r.relevant, "latency_ms": r.latency_ms}
            for r in recent
        ],
    }
