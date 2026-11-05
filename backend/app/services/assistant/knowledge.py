"""Builds the assistant's knowledge base from *published* portfolio content and keeps the vector index in sync.

PostgreSQL is the source of truth. ``build_chunks`` reads only public, published rows (the same filters the public
API uses) and ``reindex`` diffs the result against the stored index, embedding only what changed.
"""

import hashlib
import logging
import re
import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import (
    Achievement,
    AssistantMessageLog,
    Education,
    Experience,
    KnowledgeChunk,
    Note,
    Profile,
    Project,
    Publication,
    Resume,
    SkillCategory,
    SocialLink,
    Testimonial,
    WebsiteSettings,
)
from app.services.assistant import store
from app.services.assistant.embeddings import get_embedder

log = logging.getLogger("assistant.knowledge")

MAX_CHUNK_CHARS = 1400
ADVISORY_LOCK_KEY = 84720011


@dataclass
class ChunkSpec:
    key: str
    source_type: str  # profile | skill | project | publication | education | experience | achievement | contact | resume | custom | overview
    title: str
    content: str
    url: str | None = None
    source_id: int | None = None

    @property
    def hash(self) -> str:
        return hashlib.sha256(f"{self.source_type}|{self.title}|{self.url}|{self.content}".encode()).hexdigest()

    @property
    def embed_text(self) -> str:
        return f"{self.title}\n{self.content}"


# ---------------------------------------------------------------- helpers


def _lines(*parts: str | None) -> str:
    return "\n".join(p for p in parts if p)


def _bullets(items: list | None) -> str | None:
    items = [str(i).strip() for i in (items or []) if str(i).strip()]
    return "Highlights:\n" + "\n".join(f"- {i}" for i in items) if items else None


def _years(start: int | None, end: int | None, current: bool = False, expected: bool = False) -> str:
    if current:
        return f"{start or ''} – Present"
    if start and end and start != end:
        return f"{start} – {end}{' (expected)' if expected else ''}"
    y = end or start
    return f"{y}{' (expected)' if expected and y else ''}" if y else ""


def _split(text_: str, limit: int = MAX_CHUNK_CHARS) -> list[str]:
    text_ = text_.strip()
    if len(text_) <= limit:
        return [text_] if text_ else []
    out, cur = [], ""
    for para in re.split(r"\n\s*\n|(?<=[.!?])\s+", text_):
        if cur and len(cur) + len(para) + 1 > limit:
            out.append(cur.strip())
            cur = ""
        cur += para + "\n"
    if cur.strip():
        out.append(cur.strip())
    return out


_pdf_cache: dict[str, tuple[float, str]] = {}


def _resume_text(file_url: str) -> str:
    """Best-effort text extraction from the active CV (local upload or remote URL). Never raises."""
    try:
        from pypdf import PdfReader  # imported lazily so the app still starts without it

        data: bytes
        if file_url.startswith("http"):
            hit = _pdf_cache.get(file_url)
            if hit and hit[0] > datetime.now(UTC).timestamp() - 3600:
                return hit[1]
            r = httpx.get(file_url, timeout=15.0, follow_redirects=True)
            r.raise_for_status()
            if len(r.content) > settings.MAX_PDF_SIZE_MB * 1024 * 1024:
                return ""
            data = r.content
            key, stamp = file_url, datetime.now(UTC).timestamp()
        else:
            rel = file_url.removeprefix(settings.MEDIA_URL_PREFIX).lstrip("/")
            path = (settings.MEDIA_ROOT / rel).resolve()
            if settings.MEDIA_ROOT.resolve() not in path.parents or not path.is_file():
                return ""
            stamp = path.stat().st_mtime
            key = str(path)
            hit = _pdf_cache.get(key)
            if hit and hit[0] == stamp:
                return hit[1]
            data = path.read_bytes()

        import io

        reader = PdfReader(io.BytesIO(data))
        pages = [(p.extract_text() or "") for p in reader.pages[:12]]
        txt = re.sub(r"[ \t]+", " ", "\n".join(pages))
        txt = re.sub(r"\n{3,}", "\n\n", txt).strip()[:20000]
        _pdf_cache[key] = (stamp, txt)
        return txt
    except Exception as exc:  # noqa: BLE001
        log.warning("CV text extraction skipped: %s", exc)
        return ""


# ---------------------------------------------------------------- chunk builders


def build_chunks(db: Session, cfg=None) -> list[ChunkSpec]:
    cfg = cfg or store.get_or_create(db)
    on = lambda k: store.source_enabled(cfg, k)  # noqa: E731
    ws = db.scalars(select(WebsiteSettings).order_by(WebsiteSettings.id)).first()
    vis = (ws.section_visibility if ws else {}) or {}
    shown = lambda k: vis.get(k) is not False  # noqa: E731
    profile = db.scalars(select(Profile).order_by(Profile.id)).first()
    name = profile.full_name if profile else "the portfolio owner"
    out: list[ChunkSpec] = []

    # profile -----------------------------------------------------------------
    if profile and on("profile"):
        out.append(ChunkSpec(
            "profile:main", "profile", f"Profile of {name}",
            _lines(
                f"Name: {profile.full_name}",
                f"Title: {profile.title}",
                f"Specialties: {', '.join(profile.specialties)}" if profile.specialties else None,
                f"Headline: {profile.hero_headline}" if profile.hero_headline else None,
                profile.hero_description or None,
                f"Location: {profile.location}" if profile.location else None,
                f"Availability: {'Open to opportunities' if profile.available_for_work else 'Not currently taking new work'}"
                + (f" — {profile.availability_note}" if profile.availability_note else ""),
            ),
            "/#about" if shown("about") else "/",
        ))
        if shown("about") and (profile.about_summary or profile.about_highlights):
            for i, part in enumerate(_split(_lines(profile.about_summary, _bullets(profile.about_highlights)))):
                out.append(ChunkSpec(f"profile:about:{i}", "profile", f"About {name}", part, "/#about"))

    # skills ------------------------------------------------------------------
    if on("skills") and shown("skills"):
        cats = db.scalars(
            select(SkillCategory).where(SkillCategory.is_published.is_(True))
            .options(selectinload(SkillCategory.skills)).order_by(SkillCategory.sort_order, SkillCategory.id)
        ).all()
        for c in cats:
            skills = [s for s in sorted(c.skills, key=lambda s: (s.sort_order, s.id)) if s.is_published]
            if not skills:
                continue
            names = ", ".join(s.name + (f" (proficiency {s.proficiency}/5)" if s.proficiency else "") for s in skills)
            out.append(ChunkSpec(
                f"skill:cat:{c.id}", "skill", f"Skills — {c.name}",
                _lines(f"Skill area: {c.name}", c.description, f"Skills listed in the portfolio: {names}"),
                "/#skills", c.id,
            ))

    # publications (published research) ---------------------------------------
    pubs = []
    if on("publications") and shown("research"):
        pubs = db.scalars(
            select(Publication).where(Publication.is_published.is_(True), Publication.deleted_at.is_(None))
            .order_by(Publication.sort_order, Publication.year.desc(), Publication.id)
        ).all()
        for p in pubs:
            out.append(ChunkSpec(
                f"publication:{p.id}", "publication", f"Published research: {p.title}",
                _lines(
                    "Type: PUBLISHED RESEARCH (peer-reviewed publication, not a personal project)",
                    f"Title: {p.title}",
                    f"Venue: {p.venue} ({p.year})",
                    f"Publication type: {p.publication_type}",
                    f"Authors: {p.authors}" if p.authors else None,
                    f"Author position: {p.author_position}" if p.author_position else None,
                    f"Abstract: {p.abstract}" if p.abstract else None,
                    _bullets(p.highlights),
                    f"Keywords: {', '.join(p.tags)}" if p.tags else None,
                    f"DOI: {p.doi}" if p.doi else None,
                    f"External link: {p.external_url}" if p.external_url else None,
                ),
                f"/research/{p.slug}", p.id,
            ))

    # projects ----------------------------------------------------------------
    projects = []
    if on("projects") and shown("projects"):
        projects = db.scalars(
            select(Project).where(Project.is_published.is_(True), Project.deleted_at.is_(None))
            .options(selectinload(Project.publication))
            .order_by(Project.is_featured.desc(), Project.sort_order, Project.id)
        ).all()
        for p in projects:
            pub = p.publication if (p.publication and p.publication.is_published and not p.publication.deleted_at) else None
            body = _lines(
                "Type: PROJECT (built by Sakib)" + (" — also described in a published paper" if pub else ""),
                f"Title: {p.title}",
                f"Category: {p.category}; Status: {p.status}" + (f"; Year: {p.year}" if p.year else ""),
                f"Summary: {p.short_description}",
                f"Technologies: {', '.join(p.technologies)}" if p.technologies else None,
                _bullets(p.highlights),
                f"Related publication: {pub.title} ({pub.venue}, {pub.year})" if pub else None,
                f"GitHub: {p.github_url}" if p.github_url else None,
                f"Demo: {p.demo_url}" if p.demo_url else None,
            )
            out.append(ChunkSpec(f"project:{p.id}", "project", f"Project: {p.title}", body, f"/projects/{p.slug}", p.id))
            for i, part in enumerate(_split(p.description or "")):
                out.append(ChunkSpec(
                    f"project:{p.id}:desc:{i}", "project", f"Project: {p.title} (details)",
                    f"Project {p.title} — details:\n{part}", f"/projects/{p.slug}", p.id,
                ))

    # education / experience / achievements -------------------------------------
    edu = []
    if on("education") and shown("education"):
        edu = db.scalars(select(Education).where(Education.is_published.is_(True)).order_by(Education.sort_order, Education.id)).all()
        for e in edu:
            out.append(ChunkSpec(
                f"education:{e.id}", "education", f"Education: {e.degree}, {e.institution}",
                _lines(
                    f"Degree: {e.degree}" + (f" in {e.field_of_study}" if e.field_of_study else ""),
                    f"Institution: {e.institution}" + (f", {e.location}" if e.location else ""),
                    f"Years: {_years(e.start_year, e.end_year, expected=e.is_expected)}",
                    f"Grade: {e.grade}" if e.grade else None, e.description, _bullets(e.highlights),
                ),
                "/#education", e.id,
            ))
    exp = []
    if on("experience") and shown("experience"):
        exp = db.scalars(
            select(Experience).where(Experience.is_published.is_(True))
            .order_by(Experience.is_current.desc(), Experience.sort_order, Experience.start_year.desc())
        ).all()
        for x in exp:
            out.append(ChunkSpec(
                f"experience:{x.id}", "experience", f"Experience: {x.role}, {x.organization}",
                _lines(
                    f"Role: {x.role}", f"Organization: {x.organization}" + (f", {x.location}" if x.location else ""),
                    f"Type: {x.employment_type}" if x.employment_type else None,
                    f"Period: {_years(x.start_year, x.end_year, x.is_current)}", x.description, _bullets(x.highlights),
                ),
                "/#experience", x.id,
            ))
    ach = []
    if on("achievements") and shown("achievements"):
        ach = db.scalars(select(Achievement).where(Achievement.is_published.is_(True)).order_by(Achievement.sort_order, Achievement.id)).all()
        for a in ach:
            out.append(ChunkSpec(
                f"achievement:{a.id}", "achievement", f"Achievement: {a.title}",
                _lines(f"Achievement: {a.title}", f"Issuer: {a.issuer}" if a.issuer else None,
                       f"Year: {a.year}" if a.year else None, a.description),
                "/#achievements", a.id,
            ))

    # testimonials (quotes by other people — always attributed) -----------------
    tms = []
    if on("testimonials") and shown("testimonials"):
        tms = db.scalars(select(Testimonial).where(Testimonial.is_published.is_(True)).order_by(Testimonial.sort_order, Testimonial.id)).all()
        for t in tms:
            who = ", ".join(x for x in (t.author_name, t.author_role, t.organization) if x)
            out.append(ChunkSpec(
                f"testimonial:{t.id}", "testimonial", f"Testimonial from {t.author_name}",
                _lines("Type: TESTIMONIAL (a statement by another person about the portfolio owner, not a verified fact)",
                       f"From: {who}", f"Relationship: {t.relationship}" if t.relationship else None, f"Quote: “{t.quote}”"),
                "/#testimonials", t.id,
            ))

    # notes / blog posts ---------------------------------------------------------
    notes = []
    if on("notes") and shown("notes"):
        notes = db.scalars(
            select(Note).where(Note.is_published.is_(True), Note.deleted_at.is_(None), Note.published_at <= datetime.now(UTC))
            .order_by(Note.published_at.desc())
        ).all()
        for n in notes:
            head = _lines("Type: NOTE (technical write-up by the portfolio owner)", f"Title: {n.title}", n.summary,
                          f"Tags: {', '.join(n.tags)}" if n.tags else None)
            out.append(ChunkSpec(f"note:{n.id}", "note", f"Note: {n.title}", head, f"/notes/{n.slug}", n.id))
            body = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", n.content or "")  # drop image markup
            for i, part in enumerate(_split(body, 1200)[:10]):
                out.append(ChunkSpec(f"note:{n.id}:body:{i}", "note", f"Note: {n.title} (part {i + 1})",
                                     f"From the note “{n.title}”:\n{part}", f"/notes/{n.slug}", n.id))

    # contact -----------------------------------------------------------------
    if on("contact"):
        links = db.scalars(select(SocialLink).where(SocialLink.is_published.is_(True)).order_by(SocialLink.sort_order, SocialLink.id)).all()
        form = ws.contact_form_enabled if ws else True
        out.append(ChunkSpec(
            "contact:main", "contact", f"How to contact {name}",
            _lines(
                f"Public contact information for {name}:",
                f"Email: {profile.email}" if profile and profile.email else None,
                f"Phone: {profile.phone}" if profile and profile.show_phone and profile.phone else None,
                f"Location: {profile.location}" if profile and profile.location else None,
                *(f"{lk.label} ({lk.platform}): {lk.url}" for lk in links),
                "Contact form: available in the Contact section of this portfolio." if form else None,
                (f"Availability: {'Open to opportunities' if profile.available_for_work else 'Not currently taking new work'}"
                 + (f" — {profile.availability_note}" if profile.availability_note else "")) if profile else None,
            ),
            "/#contact",
        ))

    # CV ------------------------------------------------------------------------
    if on("resume"):
        r = db.scalars(select(Resume).where(Resume.is_active.is_(True)).order_by(Resume.id.desc())).first()
        if r:
            out.append(ChunkSpec("resume:main", "resume", "CV / résumé",
                                 f"A downloadable CV is published: “{r.title}”.", r.file_url, r.id))
            for i, part in enumerate(_split(_resume_text(r.file_url), 1200)[:14]):
                out.append(ChunkSpec(f"resume:text:{i}", "resume", f"CV content (part {i + 1})", part, r.file_url, r.id))

    # owner-curated facts -------------------------------------------------------
    if on("custom") and cfg.custom_knowledge.strip():
        for i, part in enumerate(_split(cfg.custom_knowledge.strip(), 1200)):
            out.append(ChunkSpec(f"custom:{i}", "custom", "Additional information from the portfolio owner", part, "/"))

    # overview (answers "how many…", "list all…") -----------------------------
    ov = [f"Overview of everything published on {name}'s portfolio:"]
    ov.append(f"Published research publications: {len(pubs)}" + (" — " + "; ".join(f"{p.title} ({p.venue}, {p.year})" for p in pubs) if pubs else ""))
    ov.append(f"Projects: {len(projects)}" + (" — " + "; ".join(p.title for p in projects) if projects else ""))
    ov.append(f"Education entries: {len(edu)}" + (" — " + "; ".join(f"{e.degree}, {e.institution}" for e in edu) if edu else ""))
    ov.append(f"Experience & leadership entries: {len(exp)}" + (" — " + "; ".join(f"{x.role}, {x.organization}" for x in exp) if exp else ""))
    ov.append(f"Achievements: {len(ach)}" + (" — " + "; ".join(a.title for a in ach) if ach else ""))
    if tms:
        ov.append(f"Testimonials: {len(tms)} (from " + "; ".join(t.author_name for t in tms) + ")")
    if notes:
        ov.append(f"Notes / blog posts: {len(notes)} — " + "; ".join(n.title for n in notes))
    out.append(ChunkSpec("overview:main", "overview", "Portfolio overview and counts", "\n".join(ov), "/"))
    return out


# ---------------------------------------------------------------- indexing

_local_lock = threading.Lock()
_pending = False


def _set_status(status: str, error: str | None = None) -> None:
    with SessionLocal() as db:
        cfg = store.get_or_create(db)
        cfg.index_status = status
        cfg.index_error = (error or "")[:1000] or None
        db.commit()


def reindex(db: Session, *, force: bool = False) -> dict:
    """Diff published content against the stored index; embed and write only what changed. Returns a summary."""
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": ADVISORY_LOCK_KEY})  # serialises workers
    cfg = store.get_or_create(db)
    embedder = get_embedder(cfg.embedding_provider, cfg.embedding_model)
    specs = build_chunks(db, cfg)
    existing = {c.chunk_key: c for c in db.scalars(select(KnowledgeChunk)).all()}
    wanted = {s.key: s for s in specs}

    to_embed = [
        s for s in specs
        if force or s.key not in existing or existing[s.key].content_hash != s.hash or existing[s.key].embedder != embedder.id
        or not existing[s.key].embedding
    ]
    vectors = embedder.embed([s.embed_text for s in to_embed]) if to_embed else []
    next_version = cfg.knowledge_version + 1

    added = updated = 0
    for s, vec in zip(to_embed, vectors, strict=True):
        row = existing.get(s.key)
        if row is None:
            db.add(KnowledgeChunk(
                chunk_key=s.key, source_type=s.source_type, source_id=s.source_id, title=s.title[:400],
                content=s.content, url=s.url, content_hash=s.hash, embedder=embedder.id, embedding=vec, version=next_version,
            ))
            added += 1
        else:
            row.source_type, row.source_id, row.title, row.content = s.source_type, s.source_id, s.title[:400], s.content
            row.url, row.content_hash, row.embedder, row.embedding, row.version = s.url, s.hash, embedder.id, vec, next_version
            updated += 1
    stale = [k for k in existing if k not in wanted]
    if stale:
        db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.chunk_key.in_(stale)))

    changed = bool(added or updated or stale)
    if changed:
        cfg.knowledge_version = next_version
    cfg.chunk_count = len(specs)
    cfg.index_status = "ready"
    cfg.index_error = None
    cfg.last_indexed_at = datetime.now(UTC)
    db.execute(delete(AssistantMessageLog).where(
        AssistantMessageLog.created_at < datetime.now(UTC) - timedelta(days=settings.ASSISTANT_LOG_RETENTION_DAYS)
    ))
    db.commit()
    result = {"added": added, "updated": updated, "removed": len(stale), "total": len(specs),
              "version": cfg.knowledge_version, "embedder": embedder.id}
    if changed:
        log.info("knowledge index updated: %s", result)
    return result


def reindex_safe(force: bool = False) -> None:
    """Background-task entry point: never raises, coalesces bursts of edits into one extra pass."""
    global _pending
    if not _local_lock.acquire(blocking=False):
        _pending = True  # the running pass will loop once more and pick up this change
        return
    try:
        while True:
            _pending = False
            try:
                _set_status("indexing")
                with SessionLocal() as db:
                    reindex(db, force=force)
            except Exception as exc:  # noqa: BLE001
                log.exception("knowledge reindex failed")
                try:
                    _set_status("error", f"{type(exc).__name__}: {exc}")
                except Exception:  # noqa: BLE001
                    pass
            force = False
            if not _pending:
                break
    finally:
        _local_lock.release()
