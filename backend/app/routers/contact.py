import re
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import client_ip, rate_limit
from app.core.security import hash_ip
from app.models import AdminUser, ContactMessage, WebsiteSettings
from app.schemas.common import Message, Page
from app.schemas.content import ContactCreate, ContactRead, ContactUpdate
from app.services.activity import log_activity
from app.services.notifications import notify_new_contact

public_router = APIRouter(prefix="/contact", tags=["public"])
admin_router = APIRouter(prefix="/messages", tags=["admin:messages"])

_URL = re.compile(r"https?://", re.IGNORECASE)
MIN_FILL_MS = 2500


def _looks_like_spam(body: ContactCreate) -> bool:
    text = f"{body.subject} {body.message}"
    if len(_URL.findall(text)) > 3:
        return True
    return False


@public_router.post(
    "",
    response_model=Message,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("contact", settings.RATE_LIMIT_CONTACT_PER_HOUR, 3600))],
)
def submit_contact(body: ContactCreate, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    site = db.scalars(select(WebsiteSettings)).first()
    if site is not None and not site.contact_form_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The contact form is currently disabled")

    ok = Message(detail="Thanks — your message has been sent.")
    # Honeypot or too-fast submissions: pretend success, store nothing.
    if body.website or (body.elapsed_ms is not None and body.elapsed_ms < MIN_FILL_MS):
        return ok

    spam = _looks_like_spam(body)
    msg = ContactMessage(
        name=body.name.strip(),
        email=body.email.lower(),
        subject=body.subject.strip(),
        message=body.message.strip(),
        is_spam=spam,
        status="new",
        ip_hash=hash_ip(client_ip(request)),
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
    )
    db.add(msg)
    db.commit()
    if not spam and (site is None or site.notify_on_contact):
        bg.add_task(notify_new_contact, msg.name, msg.email, msg.subject, msg.message)
    return ok


@admin_router.get("", response_model=Page[ContactRead])
def list_messages(
    q: str | None = Query(None, max_length=200),
    status_: Literal["new", "read", "replied", "archived"] | None = Query(None, alias="status"),
    spam: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    stmt = select(ContactMessage)
    if q:
        p = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(ContactMessage.name).like(p),
                func.lower(ContactMessage.email).like(p),
                func.lower(ContactMessage.subject).like(p),
                func.lower(ContactMessage.message).like(p),
            )
        )
    if status_:
        stmt = stmt.where(ContactMessage.status == status_)
    if spam is not None:
        stmt = stmt.where(ContactMessage.is_spam == spam)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(ContactMessage.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@admin_router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    n = db.scalar(
        select(func.count()).select_from(ContactMessage).where(ContactMessage.status == "new", ContactMessage.is_spam.is_(False))
    )
    return {"count": n or 0}


@admin_router.get("/{message_id}", response_model=ContactRead)
def get_message(message_id: int, db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    msg = db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    return msg


@admin_router.patch("/{message_id}", response_model=ContactRead)
def update_message(
    message_id: int, body: ContactUpdate, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)
):
    msg = db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    for k, v in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(msg, k, v)
    db.commit()
    return msg


@admin_router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(message_id: int, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)):
    msg = db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    log_activity(db, user, "delete", "messages", msg.id, f"Deleted message from {msg.email}")
    db.delete(msg)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
