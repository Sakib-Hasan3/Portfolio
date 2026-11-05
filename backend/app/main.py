import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.security import hash_password
from app.middleware.security import RequestContextMiddleware, SecurityHeadersMiddleware
from app.models import AdminUser
from app.routers import admin_singletons, auth, contact, dashboard, media, public
from app.routers.resources import build_resources_router

configure_logging()
log = logging.getLogger("app")


def bootstrap_admin() -> None:
    """Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if no admin exists yet."""
    if not (settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD):
        return
    with SessionLocal() as db:
        if db.scalars(select(AdminUser).limit(1)).first():
            return
        db.add(
            AdminUser(
                email=settings.ADMIN_EMAIL.lower(),
                full_name=settings.ADMIN_NAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
            )
        )
        db.commit()
        log.info("bootstrap admin account created for %s", settings.ADMIN_EMAIL)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        bootstrap_admin()
    except Exception:  # noqa: BLE001 – tables may not exist yet before migrations
        log.exception("admin bootstrap skipped")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Content API for the portfolio. Public endpoints return only published content. "
        "Admin endpoints require a bearer token (use **Authorize** with your admin credentials) "
        "or the dashboard's HTTP-only session cookie plus the X-CSRF-Token header."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_parameters={"persistAuthorization": True},
)

register_exception_handlers(app)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"],
)

api = APIRouter(prefix=settings.API_V1_PREFIX)
api.include_router(auth.router)
api.include_router(public.router)
api.include_router(contact.public_router, prefix="/public")

admin = APIRouter(prefix="/admin")
admin.include_router(dashboard.router)
admin.include_router(admin_singletons.router)
admin.include_router(build_resources_router())
admin.include_router(media.router)
admin.include_router(contact.admin_router)
api.include_router(admin)

app.include_router(api)

if settings.STORAGE_BACKEND == "local":
    settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    app.mount(settings.MEDIA_URL_PREFIX, StaticFiles(directory=settings.MEDIA_ROOT), name="media")


@app.get("/health", tags=["health"])
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}
