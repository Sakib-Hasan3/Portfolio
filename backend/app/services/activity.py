from sqlalchemy.orm import Session

from app.models import ActivityLog, AdminUser


def log_activity(
    db: Session,
    user: AdminUser | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    summary: str,
) -> None:
    db.add(
        ActivityLog(
            user_id=user.id if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary[:400],
        )
    )
