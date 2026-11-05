"""Test setup. Uses TEST_DATABASE_URL (PostgreSQL in CI) or falls back to SQLite."""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="portfolio-test-")
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_tmp}/test.db")
os.environ["MEDIA_ROOT"] = os.path.join(_tmp, "uploads")
os.environ["STORAGE_BACKEND"] = "local"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256-signing"
os.environ.pop("ADMIN_EMAIL", None)
os.environ.pop("ADMIN_PASSWORD", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AdminUser, Base  # noqa: E402

ADMIN_EMAIL = "admin@test.dev"
ADMIN_PASSWORD = "Correct-Horse-42!"


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean():
    limiter.reset()
    yield
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            names = ", ".join(t.name for t in Base.metadata.sorted_tables)
            conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
        else:
            for t in reversed(Base.metadata.sorted_tables):
                conn.execute(t.delete())


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


@pytest.fixture
def admin_user(db):
    user = AdminUser(email=ADMIN_EMAIL, full_name="Test Admin", password_hash=hash_password(ADMIN_PASSWORD), role="admin")
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class AuthedClient:
    """Cookie-session client that sends the CSRF header like the dashboard does."""

    def __init__(self, c: TestClient):
        self.c = c

    @property
    def csrf(self) -> str:
        return self.c.cookies.get("csrf_token") or ""

    def _h(self, extra=None):
        return {"x-csrf-token": self.csrf, **(extra or {})}

    def get(self, url, **kw):
        return self.c.get(url, **kw)

    def post(self, url, **kw):
        return self.c.post(url, headers=self._h(kw.pop("headers", None)), **kw)

    def patch(self, url, **kw):
        return self.c.patch(url, headers=self._h(kw.pop("headers", None)), **kw)

    def delete(self, url, **kw):
        return self.c.delete(url, headers=self._h(kw.pop("headers", None)), **kw)


@pytest.fixture
def admin(client, admin_user) -> AuthedClient:
    r = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return AuthedClient(client)


API = "/api/v1"


def make_project(admin: AuthedClient, **overrides):
    body = {"title": "Vision Transformer Study", "short_description": "A study.", "category": "Computer Vision",
            "technologies": ["PyTorch"], **overrides}
    r = admin.post(f"{API}/admin/projects", json=body)
    assert r.status_code == 201, r.text
    return r.json()
