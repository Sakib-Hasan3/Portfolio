import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    REFRESH_COOKIE,
    create_access_token,
    hash_password,
    hash_token,
    needs_rehash,
    new_csrf_token,
    new_refresh_token,
    verify_password,
)
from app.models import AdminUser, RefreshToken
from app.services.activity import log_activity

REFRESH_PATH = f"{settings.API_V1_PREFIX}/auth"
# Pre-computed hash so failed lookups take as long as real verifications (prevents user enumeration by timing)
_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


def _as_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def authenticate(db: Session, email: str, password: str) -> AdminUser:
    user = db.scalars(select(AdminUser).where(AdminUser.email == email.lower().strip())).first()
    if user is None:
        verify_password(password, _DUMMY_HASH)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not verify_password(password, user.password_hash) or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = datetime.now(UTC)
    return user


def issue_refresh_token(db: Session, user: AdminUser, family_id: str | None = None, user_agent: str | None = None):
    raw = new_refresh_token()
    record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        family_id=family_id or uuid.uuid4().hex,
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=(user_agent or "")[:255] or None,
    )
    db.add(record)
    db.flush()
    return raw, record


def rotate_refresh_token(db: Session, raw: str, user_agent: str | None = None) -> tuple[AdminUser, str]:
    record = db.scalars(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw))).first()
    if record is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    now = datetime.now(UTC)
    if record.revoked_at is not None:
        # Reuse of a rotated token => likely theft. Kill the whole family.
        revoke_family(db, record.family_id)
        log_activity(db, record.user, "security", "auth", record.user_id, "Refresh token reuse detected; sessions revoked")
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token reuse detected. Please sign in again.")
    if _as_aware(record.expires_at) <= now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token expired")
    user = record.user
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
    new_raw, new_record = issue_refresh_token(db, user, record.family_id, user_agent)
    record.revoked_at = now
    record.replaced_by_id = new_record.id
    return user, new_raw


def revoke_family(db: Session, family_id: str) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def revoke_token(db: Session, raw: str) -> None:
    record = db.scalars(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw))).first()
    if record:
        revoke_family(db, record.family_id)


def revoke_all_for_user(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def set_session_cookies(response: Response, access: str, refresh: str) -> str:
    csrf = new_csrf_token()
    common = {"secure": settings.COOKIE_SECURE, "samesite": settings.COOKIE_SAMESITE, "domain": settings.COOKIE_DOMAIN}
    response.set_cookie(
        ACCESS_COOKIE, access, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, httponly=True, path="/", **common
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        path=REFRESH_PATH,
        **common,
    )
    # Readable by JS on purpose: double-submit CSRF token
    response.set_cookie(
        CSRF_COOKIE, csrf, max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, httponly=False, path="/", **common
    )
    # Non-sensitive hint so Next.js middleware can redirect unauthenticated visitors early
    response.set_cookie(
        "admin_session", "1", max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, httponly=True, path="/", **common
    )
    return csrf


def clear_session_cookies(response: Response) -> None:
    for name, path in ((ACCESS_COOKIE, "/"), (REFRESH_COOKIE, REFRESH_PATH), (CSRF_COOKIE, "/"), ("admin_session", "/")):
        response.delete_cookie(name, path=path, domain=settings.COOKIE_DOMAIN)


def create_access(user: AdminUser) -> str:
    return create_access_token(user.id, user.role)
