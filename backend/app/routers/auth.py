from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.core.security import REFRESH_COOKIE, hash_password, verify_password
from app.models import AdminUser
from app.schemas.auth import (
    AdminProfileUpdate,
    AdminRead,
    ChangePasswordRequest,
    LoginRequest,
    SessionResponse,
    TokenResponse,
)
from app.schemas.common import Message
from app.services import auth as auth_service
from app.services.activity import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])

login_limit = rate_limit("login", settings.RATE_LIMIT_LOGIN_PER_MINUTE, 60)


@router.post("/login", response_model=SessionResponse, dependencies=[Depends(login_limit)])
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Cookie-based login for the admin dashboard."""
    user = auth_service.authenticate(db, body.email, body.password)
    refresh, _ = auth_service.issue_refresh_token(db, user, user_agent=request.headers.get("user-agent"))
    access = auth_service.create_access(user)
    log_activity(db, user, "login", "auth", user.id, "Signed in")
    db.commit()
    csrf = auth_service.set_session_cookies(response, access, refresh)
    return SessionResponse(
        user=AdminRead.model_validate(user), csrf_token=csrf, access_expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/token", response_model=TokenResponse, dependencies=[Depends(login_limit)])
def token(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    """OAuth2 password flow returning a short-lived bearer token (for Swagger UI and scripts)."""
    user = auth_service.authenticate(db, form.username, form.password)
    db.commit()
    return TokenResponse(access_token=auth_service.create_access(user), expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.post("/refresh", response_model=SessionResponse, dependencies=[Depends(rate_limit("refresh", 30, 60))])
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token")
    try:
        user, new_raw = auth_service.rotate_refresh_token(db, raw, request.headers.get("user-agent"))
    except HTTPException:
        auth_service.clear_session_cookies(response)
        raise
    db.commit()
    csrf = auth_service.set_session_cookies(response, auth_service.create_access(user), new_raw)
    return SessionResponse(
        user=AdminRead.model_validate(user), csrf_token=csrf, access_expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/logout", response_model=Message)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        auth_service.revoke_token(db, raw)
        db.commit()
    auth_service.clear_session_cookies(response)
    return Message(detail="Signed out")


@router.get("/me", response_model=AdminRead)
def me(user: AdminUser = Depends(get_current_admin)):
    return user


@router.patch("/me", response_model=AdminRead)
def update_me(body: AdminProfileUpdate, user: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    if body.email and body.email.lower() != user.email:
        if db.scalars(select(AdminUser).where(AdminUser.email == body.email.lower())).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
        user.email = body.email.lower()
    if body.full_name:
        user.full_name = body.full_name
    db.commit()
    return user


@router.post("/change-password", response_model=Message)
def change_password(
    body: ChangePasswordRequest,
    response: Response,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    auth_service.revoke_all_for_user(db, user.id)
    log_activity(db, user, "security", "auth", user.id, "Changed password; other sessions signed out")
    db.commit()
    auth_service.clear_session_cookies(response)
    return Message(detail="Password changed. Please sign in again.")
