import io

from PIL import Image

from app.scripts.seed import seed
from tests.conftest import API

VALID = {"name": "Ada", "email": "ada@example.com", "subject": "Hello", "message": "I'd like to talk about a role.", "elapsed_ms": 9000}


def test_contact_stores_message_and_admin_manages_it(client, admin):
    r = client.post(f"{API}/public/contact", json=VALID)
    assert r.status_code == 201
    assert admin.get(f"{API}/admin/messages/unread-count").json()["count"] == 1
    items = admin.get(f"{API}/admin/messages").json()["items"]
    assert items[0]["email"] == "ada@example.com" and items[0]["status"] == "new"
    mid = items[0]["id"]
    assert admin.patch(f"{API}/admin/messages/{mid}", json={"status": "replied"}).json()["status"] == "replied"
    assert admin.get(f"{API}/admin/messages", params={"status": "replied"}).json()["total"] == 1
    assert admin.get(f"{API}/admin/messages/unread-count").json()["count"] == 0
    assert admin.delete(f"{API}/admin/messages/{mid}").status_code == 204


def test_contact_spam_protection(client, admin):
    assert client.post(f"{API}/public/contact", json={**VALID, "website": "http://spam"}).status_code == 201
    assert client.post(f"{API}/public/contact", json={**VALID, "elapsed_ms": 300}).status_code == 201
    assert admin.get(f"{API}/admin/messages").json()["total"] == 0  # silently dropped

    linky = {**VALID, "message": "buy http://a.com http://b.com http://c.com http://d.com now"}
    client.post(f"{API}/public/contact", json=linky)
    assert admin.get(f"{API}/admin/messages", params={"spam": "true"}).json()["total"] == 1
    assert admin.get(f"{API}/admin/messages/unread-count").json()["count"] == 0


def test_contact_validation_and_rate_limit(client):
    r = client.post(f"{API}/public/contact", json={**VALID, "email": "nope"})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "email"
    assert client.post(f"{API}/public/contact", json={**VALID, "message": "short"}).status_code == 422
    # the limit counts every attempt (the two invalid ones above included): 5 per hour per IP
    codes = [client.post(f"{API}/public/contact", json=VALID).status_code for _ in range(5)]
    assert codes == [201, 201, 201, 429, 429]


def _png(w=4, h=3) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), "blue").save(buf, "PNG")
    return buf.getvalue()


def test_media_upload_validation(admin, client):
    r = admin.post(f"{API}/admin/media/upload", files={"file": ("a.png", _png(), "image/png")}, data={"purpose": "project-thumbnail"})
    assert r.status_code == 201, r.text
    asset = r.json()
    assert asset["kind"] == "image" and asset["width"] == 4 and asset["url"].startswith("/uploads/project-thumbnail/")
    assert client.get(asset["url"]).status_code == 200

    # content is sniffed, not trusted from the filename/content-type
    fake = admin.post(f"{API}/admin/media/upload", files={"file": ("evil.png", b"<script>alert(1)</script>", "image/png")})
    assert fake.status_code == 415
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    assert admin.post(f"{API}/admin/media/upload", files={"file": ("cv.pdf", pdf, "application/pdf")}, data={"purpose": "resume"}).status_code == 201
    wrong = admin.post(f"{API}/admin/media/upload", files={"file": ("a.png", _png(), "image/png")}, data={"purpose": "resume"})
    assert wrong.status_code == 415

    assert admin.get(f"{API}/admin/media").json()["total"] == 2
    assert admin.delete(f"{API}/admin/media/{asset['id']}").status_code == 204
    assert client.get(asset["url"]).status_code == 404


def test_seed_is_idempotent_and_public_bundle(db, client):
    first = seed(db, with_media=False)
    assert "projects" in first and "publications" in first
    assert seed(db, with_media=False) == []
    bundle = client.get(f"{API}/public/portfolio").json()
    assert bundle["profile"]["full_name"] == "Mohammed Sakib Hasan"
    assert bundle["profile"]["phone"] is None  # seeded but hidden by default
    assert len(bundle["publications"]) == 2
    assert bundle["publications"][0]["doi_url"].startswith("https://doi.org/10.1109/")
    assert len(bundle["projects"]) == 7 and bundle["projects"][0]["is_featured"]
    assert {c["name"] for c in bundle["skills"]} >= {"Computer Vision", "NLP & LLMs"}
    # nothing invented: projects without known links have none
    brochure = next(p for p in bundle["projects"] if p["slug"].startswith("ai-powered"))
    assert brochure["github_url"] is None and brochure["demo_url"] is None
    filtered = client.get(f"{API}/public/projects", params={"technology": "pytorch"}).json()
    assert [p["slug"] for p in filtered] == ["multimodal-human-emotion-recognition-ai"]


def test_publication_detail_and_sitemap(db, client):
    seed(db, with_media=False)
    pubs = client.get(f"{API}/public/publications").json()
    slug = pubs[0]["slug"]
    detail = client.get(f"{API}/public/publications/{slug}").json()
    assert detail["title"].startswith("StrokeGuardian") and detail["highlights"]
    assert client.get(f"{API}/public/publications/does-not-exist").status_code == 404
    sm = client.get(f"{API}/public/sitemap").json()
    assert {p["slug"] for p in sm["publications"]} == {p["slug"] for p in pubs}
    assert len(sm["projects"]) == 7
