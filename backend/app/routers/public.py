"""Read-only endpoints for the public site. Only published, non-deleted content is ever returned."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models import (
    Achievement,
    Education,
    Experience,
    Profile,
    Project,
    Publication,
    Resume,
    SkillCategory,
    SocialLink,
    WebsiteSettings,
)
from app.schemas.content import (
    AchievementRead,
    EducationRead,
    ExperienceRead,
    PortfolioBundle,
    PublicProfile,
    PublicProject,
    PublicPublication,
    PublicPublicationRef,
    PublicResume,
    PublicSettings,
    PublicSkill,
    PublicSkillCategory,
    SocialLinkRead,
)

router = APIRouter(prefix="/public", tags=["public"])


# ---------------------------------------------------------------- serializers


def _profile(db: Session) -> PublicProfile | None:
    p = db.scalars(select(Profile).order_by(Profile.id)).first()
    if not p:
        return None
    return PublicProfile(
        full_name=p.full_name, title=p.title, specialties=p.specialties or [], hero_headline=p.hero_headline,
        hero_description=p.hero_description, about_title=p.about_title, about_summary=p.about_summary,
        about_highlights=p.about_highlights or [], location=p.location, email=p.email,
        phone=p.phone if p.show_phone else None, avatar_url=p.avatar_url, available_for_work=p.available_for_work,
        availability_note=p.availability_note,
    )


def _settings(db: Session) -> PublicSettings | None:
    s = db.scalars(select(WebsiteSettings).order_by(WebsiteSettings.id)).first()
    return PublicSettings.model_validate(s, from_attributes=True) if s else None


def _publication(p: Publication) -> PublicPublication:
    return PublicPublication(
        id=p.id, title=p.title, slug=p.slug, abstract=p.abstract, highlights=p.highlights or [], authors=p.authors,
        author_position=p.author_position, venue=p.venue, publication_type=p.publication_type, year=p.year, doi=p.doi,
        doi_url=f"https://doi.org/{p.doi}" if p.doi else None, pdf_url=p.pdf_url, external_url=p.external_url,
        tags=p.tags or [],
    )


def _project(p: Project) -> PublicProject:
    pub = p.publication
    pub_ref = None
    if pub is not None and pub.is_published and pub.deleted_at is None:
        pub_ref = PublicPublicationRef(id=pub.id, title=pub.title, slug=pub.slug, venue=pub.venue, year=pub.year, doi=pub.doi)
    return PublicProject(
        id=p.id, title=p.title, slug=p.slug, short_description=p.short_description, description=p.description,
        highlights=p.highlights or [], technologies=p.technologies or [], category=p.category, status=p.status,
        year=p.year, period_label=p.period_label, thumbnail_url=p.thumbnail_url, github_url=p.github_url,
        demo_url=p.demo_url, extra_links=p.extra_links or [], is_featured=p.is_featured,
        images=[{"id": i.id, "url": i.url, "caption": i.caption, "sort_order": i.sort_order} for i in p.images],
        publication=pub_ref,
    )


def _published_projects_query():
    return (
        select(Project)
        .where(Project.is_published.is_(True), Project.deleted_at.is_(None))
        .options(selectinload(Project.images), selectinload(Project.publication))
        .order_by(Project.is_featured.desc(), Project.sort_order, Project.year.desc().nulls_last(), Project.id)
    )


def _publications(db: Session, year: int | None = None, ptype: str | None = None) -> list[PublicPublication]:
    stmt = select(Publication).where(Publication.is_published.is_(True), Publication.deleted_at.is_(None))
    if year:
        stmt = stmt.where(Publication.year == year)
    if ptype:
        stmt = stmt.where(Publication.publication_type == ptype)
    stmt = stmt.order_by(Publication.sort_order, Publication.year.desc(), Publication.id)
    return [_publication(p) for p in db.scalars(stmt).all()]


def _skills(db: Session) -> list[PublicSkillCategory]:
    cats = db.scalars(
        select(SkillCategory)
        .where(SkillCategory.is_published.is_(True))
        .options(selectinload(SkillCategory.skills))
        .order_by(SkillCategory.sort_order, SkillCategory.id)
    ).all()
    out = []
    for c in cats:
        skills = [
            PublicSkill(id=s.id, name=s.name, icon=s.icon, proficiency=s.proficiency)
            for s in sorted(c.skills, key=lambda s: (s.sort_order, s.id))
            if s.is_published
        ]
        if skills:
            out.append(PublicSkillCategory(id=c.id, name=c.name, slug=c.slug, description=c.description, icon=c.icon, skills=skills))
    return out


def _simple(db: Session, model, read_schema, order):
    rows = db.scalars(select(model).where(model.is_published.is_(True)).order_by(*order)).all()
    return [read_schema.model_validate(r) for r in rows]


def _resume(db: Session) -> PublicResume | None:
    r = db.scalars(select(Resume).where(Resume.is_active.is_(True)).order_by(Resume.id.desc())).first()
    return PublicResume(title=r.title, file_url=r.file_url, updated_at=r.updated_at) if r else None


# ---------------------------------------------------------------- endpoints


@router.get("/portfolio", response_model=PortfolioBundle, summary="Everything the home page needs in one call")
def portfolio(db: Session = Depends(get_db)):
    return PortfolioBundle(
        profile=_profile(db),
        settings=_settings(db),
        social_links=_simple(db, SocialLink, SocialLinkRead, (SocialLink.sort_order, SocialLink.id)),
        skills=_skills(db),
        publications=_publications(db),
        projects=[_project(p) for p in db.scalars(_published_projects_query()).all()],
        education=_simple(db, Education, EducationRead, (Education.sort_order, Education.end_year.desc().nulls_first())),
        experience=_simple(
            db, Experience, ExperienceRead,
            (Experience.is_current.desc(), Experience.sort_order, Experience.start_year.desc()),
        ),
        achievements=_simple(db, Achievement, AchievementRead, (Achievement.sort_order, Achievement.year.desc().nulls_last())),
        resume=_resume(db),
    )


@router.get("/profile", response_model=PublicProfile | None)
def profile(db: Session = Depends(get_db)):
    return _profile(db)


@router.get("/settings", response_model=PublicSettings | None)
def site_settings(db: Session = Depends(get_db)):
    return _settings(db)


@router.get("/skills", response_model=list[PublicSkillCategory])
def skills(db: Session = Depends(get_db)):
    return _skills(db)


@router.get("/projects", response_model=list[PublicProject])
def projects(
    category: str | None = Query(None, max_length=80),
    technology: str | None = Query(None, max_length=80),
    featured: bool | None = None,
    q: str | None = Query(None, max_length=200),
    db: Session = Depends(get_db),
):
    stmt = _published_projects_query()
    if category:
        stmt = stmt.where(func.lower(Project.category) == category.lower())
    if featured is not None:
        stmt = stmt.where(Project.is_featured.is_(featured))
    items = [_project(p) for p in db.scalars(stmt).all()]
    if technology:  # JSON filtering kept in Python for portability across databases
        t = technology.lower()
        items = [p for p in items if any(t == x.lower() for x in p.technologies)]
    if q:
        needle = q.lower()
        items = [
            p for p in items
            if needle in p.title.lower() or needle in p.short_description.lower()
            or any(needle in x.lower() for x in p.technologies)
        ]
    return items


@router.get("/projects/{slug}", response_model=PublicProject)
def project_detail(slug: str, db: Session = Depends(get_db)):
    p = db.scalars(_published_projects_query().where(Project.slug == slug)).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return _project(p)


@router.get("/publications", response_model=list[PublicPublication])
def publications(
    year: int | None = None,
    type: str | None = Query(None, max_length=40),
    db: Session = Depends(get_db),
):
    return _publications(db, year, type)


@router.get("/publications/{slug}", response_model=PublicPublication)
def publication_detail(slug: str, db: Session = Depends(get_db)):
    p = db.scalars(
        select(Publication).where(
            Publication.slug == slug, Publication.is_published.is_(True), Publication.deleted_at.is_(None)
        )
    ).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Publication not found")
    return _publication(p)


@router.get("/education", response_model=list[EducationRead])
def education(db: Session = Depends(get_db)):
    return _simple(db, Education, EducationRead, (Education.sort_order, Education.id))


@router.get("/experience", response_model=list[ExperienceRead])
def experience(db: Session = Depends(get_db)):
    return _simple(db, Experience, ExperienceRead, (Experience.is_current.desc(), Experience.sort_order, Experience.start_year.desc()))


@router.get("/achievements", response_model=list[AchievementRead])
def achievements(db: Session = Depends(get_db)):
    return _simple(db, Achievement, AchievementRead, (Achievement.sort_order, Achievement.id))


@router.get("/social-links", response_model=list[SocialLinkRead])
def social_links(db: Session = Depends(get_db)):
    return _simple(db, SocialLink, SocialLinkRead, (SocialLink.sort_order, SocialLink.id))


@router.get("/resume", response_model=PublicResume | None)
def resume(db: Session = Depends(get_db)):
    return _resume(db)


@router.get("/sitemap")
def sitemap_data(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Project.slug, Project.updated_at).where(Project.is_published.is_(True), Project.deleted_at.is_(None))
    ).all()
    pubs = db.execute(
        select(Publication.slug, Publication.updated_at).where(
            Publication.is_published.is_(True), Publication.deleted_at.is_(None)
        )
    ).all()
    return {
        "projects": [{"slug": s, "updated_at": u} for s, u in rows],
        "publications": [{"slug": s, "updated_at": u} for s, u in pubs],
    }
