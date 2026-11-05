from tests.conftest import API, make_project


def test_project_crud_with_images_and_slugs(admin):
    p = make_project(admin, images=[{"url": "https://example.com/a.png", "caption": "A"}, {"url": "/uploads/x/b.png"}])
    assert p["slug"] == "vision-transformer-study"
    assert [i["url"] for i in p["images"]] == ["https://example.com/a.png", "/uploads/x/b.png"]

    dup = make_project(admin)
    assert dup["slug"] == "vision-transformer-study-2"

    r = admin.patch(f"{API}/admin/projects/{p['id']}", json={"short_description": "Updated", "images": []})
    assert r.status_code == 200
    body = r.json()
    assert body["short_description"] == "Updated" and body["images"] == []
    assert body["title"] == "Vision Transformer Study"  # untouched fields stay

    got = admin.get(f"{API}/admin/projects/{p['id']}").json()
    assert got["short_description"] == "Updated"


def test_list_search_filter_paginate(admin):
    make_project(admin, title="Alpha YOLO", category="Computer Vision", is_featured=True, technologies=["YOLO"])
    make_project(admin, title="Beta LLM", category="NLP", is_published=False)
    make_project(admin, title="Gamma RAG", category="NLP")

    def items(**q):
        return admin.get(f"{API}/admin/projects", params=q).json()

    assert items()["total"] == 3
    assert [i["title"] for i in items(q="llm")["items"]] == ["Beta LLM"]
    assert items(q="yolo")["total"] == 1  # searches the technologies JSON too
    assert items(category="NLP")["total"] == 2
    assert items(is_published="false")["total"] == 1
    assert items(is_featured="true")["items"][0]["title"] == "Alpha YOLO"
    page = items(page_size=2, page=2)
    assert page["total"] == 3 and len(page["items"]) == 1


def test_publish_toggle_and_soft_delete_restore(admin, client):
    p = make_project(admin, title="Draft Thing", is_published=False)
    assert client.get(f"{API}/public/projects/{p['slug']}").status_code == 404

    assert admin.post(f"{API}/admin/projects/{p['id']}/publish", params={"published": "true"}).json()["is_published"]
    assert client.get(f"{API}/public/projects/{p['slug']}").status_code == 200

    assert admin.delete(f"{API}/admin/projects/{p['id']}").status_code == 204
    assert client.get(f"{API}/public/projects/{p['slug']}").status_code == 404
    assert admin.get(f"{API}/admin/projects/{p['id']}").status_code == 404
    assert admin.get(f"{API}/admin/projects", params={"trash": "true"}).json()["total"] == 1

    assert admin.post(f"{API}/admin/projects/{p['id']}/restore").status_code == 200
    assert client.get(f"{API}/public/projects/{p['slug']}").status_code == 200

    admin.delete(f"{API}/admin/projects/{p['id']}")
    assert admin.delete(f"{API}/admin/projects/{p['id']}", params={"hard": "true"}).status_code == 204
    assert admin.get(f"{API}/admin/projects", params={"trash": "true"}).json()["total"] == 0


def test_validation_and_xss_url_guard(admin):
    r = admin.post(f"{API}/admin/projects", json={"title": "", "short_description": "x", "category": "c"})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "title"
    for bad in ("javascript:alert(1)", "data:text/html,hi", "ftp://x"):
        r = admin.post(f"{API}/admin/projects", json={"title": "t", "short_description": "x", "category": "c", "github_url": bad})
        assert r.status_code == 422, bad
    p = make_project(admin)
    r = admin.patch(f"{API}/admin/projects/{p['id']}", json={"title": None})
    assert r.status_code == 422
    r = admin.patch(f"{API}/admin/projects/{p['id']}", json={"publication_id": 9999})
    assert r.status_code == 422
    r = admin.post(f"{API}/admin/social-links", json={"platform": "x", "label": "X", "url": "javascript:void(0)"})
    assert r.status_code == 422
    r = admin.post(f"{API}/admin/social-links", json={"platform": "email", "label": "Mail", "url": "mailto:me@example.com"})
    assert r.status_code == 201


def test_publication_project_association(admin, client):
    pub = admin.post(f"{API}/admin/publications", json={
        "title": "StrokeGuardian: Hybrid Ensemble", "venue": "IEEE WIECON-ECE 2025", "year": 2025,
        "doi": "10.1109/WIECON-ECE69386.2025.11526163",
    })
    assert pub.status_code == 201, pub.text
    pub = pub.json()
    assert pub["slug"] == "strokeguardian-hybrid-ensemble"
    bad_doi = admin.post(f"{API}/admin/publications", json={"title": "x", "venue": "v", "year": 2025, "doi": "not-a-doi"})
    assert bad_doi.status_code == 422

    proj = make_project(admin, publication_id=pub["id"])
    detail = client.get(f"{API}/public/projects/{proj['slug']}").json()
    assert detail["publication"]["doi"] == pub["doi"]

    admin.post(f"{API}/admin/publications/{pub['id']}/publish", params={"published": "false"})
    detail = client.get(f"{API}/public/projects/{proj['slug']}").json()
    assert detail["publication"] is None  # unpublished paper isn't leaked through the project

    dup = admin.post(f"{API}/admin/publications", json={"title": "Other", "venue": "v", "year": 2025, "doi": pub["doi"]})
    assert dup.status_code == 409


def test_skills_and_categories(admin, client):
    cat = admin.post(f"{API}/admin/skill-categories", json={"name": "Computer Vision", "icon": "scan-eye"}).json()
    assert cat["slug"] == "computer-vision"
    s1 = admin.post(f"{API}/admin/skills", json={"name": "OpenCV", "category_id": cat["id"]})
    assert s1.status_code == 201 and s1.json()["category_name"] == "Computer Vision"
    admin.post(f"{API}/admin/skills", json={"name": "YOLO", "category_id": cat["id"], "is_published": False})
    assert admin.post(f"{API}/admin/skills", json={"name": "OpenCV", "category_id": cat["id"]}).status_code == 409
    assert admin.post(f"{API}/admin/skills", json={"name": "X", "category_id": 999}).status_code == 422

    public = client.get(f"{API}/public/skills").json()
    assert [s["name"] for s in public[0]["skills"]] == ["OpenCV"]
    assert admin.get(f"{API}/admin/skill-categories").json()["items"][0]["skill_count"] == 2


def test_profile_and_settings_singletons(admin, client):
    r = admin.patch(f"{API}/admin/profile", json={
        "full_name": "Mohammed Sakib Hasan", "title": "AI/ML Engineer", "about_summary": "Hello",
        "phone": "+880", "show_phone": False, "email": "",
    })
    assert r.status_code == 200, r.text
    assert r.json()["email"] is None
    assert client.get(f"{API}/public/profile").json()["phone"] is None
    admin.patch(f"{API}/admin/profile", json={"show_phone": True})
    assert client.get(f"{API}/public/profile").json()["phone"] == "+880"

    r = admin.patch(f"{API}/admin/settings", json={"site_title": "Site", "section_visibility": {"skills": False}, "analytics_provider": ""})
    assert r.status_code == 200
    s = client.get(f"{API}/public/settings").json()
    assert s["section_visibility"] == {"skills": False} and s["analytics_provider"] is None


def test_resume_only_one_active(admin, client):
    a = admin.post(f"{API}/admin/resumes", json={"title": "v1", "file_url": "/uploads/resume/a.pdf", "is_active": True}).json()
    b = admin.post(f"{API}/admin/resumes", json={"title": "v2", "file_url": "/uploads/resume/b.pdf", "is_active": True}).json()
    assert client.get(f"{API}/public/resume").json()["title"] == "v2"
    admin.patch(f"{API}/admin/resumes/{a['id']}", json={"is_active": True})
    assert client.get(f"{API}/public/resume").json()["title"] == "v1"
    assert admin.get(f"{API}/admin/resumes/{b['id']}").json()["is_active"] is False


def test_dashboard_and_activity(admin):
    make_project(admin)
    make_project(admin, is_published=False)
    stats = admin.get(f"{API}/admin/dashboard/stats").json()
    assert stats["content"]["projects"] == {"total": 2, "published": 1, "draft": 1}
    assert len(stats["messages"]["by_day"]) == 14
    acts = admin.get(f"{API}/admin/dashboard/activity").json()
    assert any(a["action"] == "create" and a["entity_type"] == "projects" for a in acts)
