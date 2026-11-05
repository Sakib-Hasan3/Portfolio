from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import KnowledgeChunk
from tests.conftest import API


def _note(admin, **kw):
    body = {"title": "How I built a RAG pipeline", "summary": "Retrieval notes.", "content": "# Intro\n" + "word " * 450, "tags": ["RAG", "FastAPI"], **kw}
    r = admin.post(f"{API}/admin/notes", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_testimonial_crud_and_public_visibility(client, admin):
    r = admin.post(f"{API}/admin/testimonials", json={"author_name": "Dr. A", "author_role": "Professor", "organization": "PSTU", "relationship": "Supervisor", "quote": "Rigorous and curious."})
    assert r.status_code == 201
    hidden = admin.post(f"{API}/admin/testimonials", json={"author_name": "Draft", "quote": "x", "is_published": False}).json()
    pub = client.get(f"{API}/public/testimonials").json()
    assert [t["author_name"] for t in pub] == ["Dr. A"]
    assert [t["author_name"] for t in client.get(f"{API}/public/portfolio").json()["testimonials"]] == ["Dr. A"]
    assert admin.patch(f"{API}/admin/testimonials/{hidden['id']}", json={"quote": ""}).status_code == 422


def test_note_lifecycle_slug_reading_time_and_scheduling(client, admin):
    n = _note(admin)
    assert n["slug"] == "how-i-built-a-rag-pipeline" and n["reading_minutes"] == 2
    detail = client.get(f"{API}/public/notes/{n['slug']}").json()
    assert detail["content"].startswith("# Intro") and detail["tags"] == ["RAG", "FastAPI"]
    # future-dated notes stay hidden until their time
    future = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    s = _note(admin, title="Scheduled post", published_at=future)
    assert client.get(f"{API}/public/notes/{s['slug']}").status_code == 404
    assert [x["slug"] for x in client.get(f"{API}/public/notes").json()] == [n["slug"]]
    assert [x["slug"] for x in client.get(f"{API}/public/notes?tag=rag").json()] == [n["slug"]]
    assert "content" not in client.get(f"{API}/public/notes").json()[0]
    # unpublish + soft delete
    admin.post(f"{API}/admin/notes/{n['id']}/publish?published=false")
    assert client.get(f"{API}/public/notes/{n['slug']}").status_code == 404
    assert any(x["slug"] == n["slug"] for x in client.get(f"{API}/public/sitemap").json()["notes"]) is False


def test_notes_and_testimonials_sync_into_assistant_knowledge(admin, db):
    n = _note(admin)
    admin.post(f"{API}/admin/testimonials", json={"author_name": "Dr. A", "quote": "Rigorous and curious."})
    db.expire_all()
    chunks = db.scalars(select(KnowledgeChunk)).all()
    kinds = {c.source_type for c in chunks}
    assert {"note", "testimonial"} <= kinds
    assert any("TESTIMONIAL" in c.content and "Rigorous" in c.content for c in chunks)
    assert any(c.url == f"/notes/{n['slug']}" for c in chunks)
    admin.delete(f"{API}/admin/notes/{n['id']}")
    db.expire_all()
    assert not any(c.source_type == "note" for c in db.scalars(select(KnowledgeChunk)).all())
