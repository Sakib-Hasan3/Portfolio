from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER, constant_time_equals, decode_access_token
from app.models import AdminUser

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_admin(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    """Accepts either a Bearer token (API clients / Swagger) or the HTTP-only cookie.

    Cookie-authenticated, state-changing requests must carry a matching
    double-submit CSRF token in the X-CSRF-Token header.
    """
    token: str | None = None
    via_cookie = False
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    else:
        token = request.cookies.get(ACCESS_COOKIE)
        via_cookie = token is not None

    if not token:
        raise _unauthorized()
    payload = decode_access_token(token)
    if not payload:
        raise _unauthorized("Session expired or invalid")

    if via_cookie and request.method not in SAFE_METHODS:
        cookie_csrf = request.cookies.get(CSRF_COOKIE) or ""
        header_csrf = request.headers.get(CSRF_HEADER) or ""
        if not cookie_csrf or not header_csrf or not constant_time_equals(cookie_csrf, header_csrf):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF token missing or invalid")

    user = db.get(AdminUser, int(payload["sub"]))
    if user is None or not user.is_active:
        raise _unauthorized("Account disabled or not found")
    return user


def require_role(*roles: str):
    def checker(user: AdminUser = Depends(get_current_admin)) -> AdminUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return checker


require_admin = require_role("admin")
