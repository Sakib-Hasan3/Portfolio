from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, API


def test_login_sets_httponly_cookies(client, admin_user):
    r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == ADMIN_EMAIL
    cookies = r.headers.get_list("set-cookie")
    access = next(c for c in cookies if c.startswith("access_token="))
    refresh = next(c for c in cookies if c.startswith("refresh_token="))
    csrf = next(c for c in cookies if c.startswith("csrf_token="))
    assert "HttpOnly" in access and "HttpOnly" in refresh
    assert "HttpOnly" not in csrf  # readable by the dashboard for double-submit
    assert "Path=/api/v1/auth" in refresh


def test_login_rejects_bad_credentials_without_enumeration(client, admin_user):
    bad_pw = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "nope"})
    no_user = client.post(f"{API}/auth/login", json={"email": "ghost@test.dev", "password": "nope"})
    assert bad_pw.status_code == no_user.status_code == 401
    assert bad_pw.json()["detail"] == no_user.json()["detail"]


def test_login_is_rate_limited(client, admin_user):
    codes = [client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "x"}).status_code for _ in range(7)]
    assert 429 in codes
    assert codes[:5] == [401] * 5


def test_admin_routes_require_auth(client):
    assert client.get(f"{API}/admin/projects").status_code == 401
    assert client.get(f"{API}/admin/dashboard/stats").status_code == 401
    assert client.post(f"{API}/admin/projects", json={}).status_code == 401


def test_cookie_mutation_requires_csrf(admin):
    body = {"title": "X", "short_description": "Y", "category": "Z"}
    r = admin.c.post(f"{API}/admin/projects", json=body)  # no header
    assert r.status_code == 403
    r = admin.c.post(f"{API}/admin/projects", json=body, headers={"x-csrf-token": "forged"})
    assert r.status_code == 403
    assert admin.post(f"{API}/admin/projects", json=body).status_code == 201


def test_bearer_token_flow(client, admin_user):
    r = client.post(f"{API}/auth/token", data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    client.cookies.clear()
    h = {"Authorization": f"Bearer {token}"}
    assert client.get(f"{API}/auth/me", headers=h).status_code == 200
    # bearer requests are not subject to CSRF (no ambient credentials)
    r = client.post(f"{API}/admin/projects", headers=h, json={"title": "A", "short_description": "B", "category": "C"})
    assert r.status_code == 201
    assert client.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_refresh_rotates_and_detects_reuse(client, admin_user):
    client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    old = client.cookies.get("refresh_token")
    r = client.post(f"{API}/auth/refresh")
    assert r.status_code == 200
    new = client.cookies.get("refresh_token")
    assert new and new != old

    # replaying the old token revokes the whole family
    client.cookies.clear()
    client.cookies.set("refresh_token", old)
    r = client.post(f"{API}/auth/refresh")
    assert r.status_code == 401
    assert "reuse" in r.json()["detail"].lower()
    client.cookies.clear()
    client.cookies.set("refresh_token", new)
    assert client.post(f"{API}/auth/refresh").status_code == 401


def test_logout_revokes_refresh(admin):
    raw = admin.c.cookies.get("refresh_token")
    assert admin.post(f"{API}/auth/logout").status_code == 200
    admin.c.cookies.clear()
    admin.c.cookies.set("refresh_token", raw)
    assert admin.c.post(f"{API}/auth/refresh").status_code == 401


def test_change_password(admin, client):
    weak = admin.post(f"{API}/auth/change-password", json={"current_password": ADMIN_PASSWORD, "new_password": "short"})
    assert weak.status_code == 422
    wrong = admin.post(f"{API}/auth/change-password", json={"current_password": "wrong", "new_password": "A-much-better-pass-9"})
    assert wrong.status_code == 400
    ok = admin.post(f"{API}/auth/change-password", json={"current_password": ADMIN_PASSWORD, "new_password": "A-much-better-pass-9"})
    assert ok.status_code == 200
    client.cookies.clear()
    assert client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "A-much-better-pass-9"}).status_code == 200


def test_security_headers(client):
    r = client.get(f"{API}/public/projects")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert "x-request-id" in r.headers
