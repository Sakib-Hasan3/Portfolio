from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models import (
    Achievement,
    ActivityLog,
    AdminUser,
    ContactMessage,
    Education,
    Experience,
    Project,
    Publication,
    Skill,
    SkillCategory,
)
from app.schemas.content import ActivityRead

router = APIRouter(prefix="/dashboard", tags=["admin:dashboard"])

_PUBLISHABLE = {
    "projects": Project,
    "publications": Publication,
    "skills": Skill,
    "skill_categories": SkillCategory,
    "experience": Experience,
    "education": Education,
    "achievements": Achievement,
}


@router.get("/stats")
def stats(db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    content = {}
    for key, model in _PUBLISHABLE.items():
        base = select(func.count()).select_from(model)
        if hasattr(model, "deleted_at"):
            base = base.where(model.deleted_at.is_(None))
        published = db.scalar(base.where(model.is_published.is_(True))) or 0
        draft = db.scalar(base.where(model.is_published.is_(False))) or 0
        content[key] = {"total": published + draft, "published": published, "draft": draft}

    msg_total = db.scalar(select(func.count()).select_from(ContactMessage)) or 0
    msg_new = db.scalar(
        select(func.count()).select_from(ContactMessage).where(ContactMessage.status == "new", ContactMessage.is_spam.is_(False))
    ) or 0

    since = datetime.now(UTC) - timedelta(days=13)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = db.execute(
        select(ContactMessage.created_at).where(ContactMessage.created_at >= since)
    ).scalars().all()
    by_day: dict[str, int] = {(since + timedelta(days=i)).date().isoformat(): 0 for i in range(14)}
    for ts in rows:
        key = (ts if ts.tzinfo else ts.replace(tzinfo=UTC)).astimezone(UTC).date().isoformat()
        if key in by_day:
            by_day[key] += 1

    featured = db.scalar(
        select(func.count()).select_from(Project).where(Project.is_featured.is_(True), Project.deleted_at.is_(None))
    ) or 0

    return {
        "content": content,
        "messages": {"total": msg_total, "unread": msg_new, "by_day": [{"date": d, "count": c} for d, c in by_day.items()]},
        "featured_projects": featured,
    }


@router.get("/activity", response_model=list[ActivityRead])
def activity(limit: int = 15, db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    limit = max(1, min(limit, 100))
    return db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).limit(limit)).all()
