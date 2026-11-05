"""Seed the database with the initial portfolio content (from the CV).

Idempotent: each section is only seeded when its table is empty, so running it
again never overwrites edits made in the admin dashboard.

    python -m app.scripts.seed            # seed empty sections
    python -m app.scripts.seed --no-media # skip uploading seed images / CV
"""

import argparse
import logging
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import (
    Education,
    Experience,
    MediaAsset,
    Profile,
    Project,
    Publication,
    Resume,
    Skill,
    SkillCategory,
    SocialLink,
    WebsiteSettings,
)
from app.services import storage
from app.utils.text import slugify

log = logging.getLogger("seed")
ASSETS = Path(__file__).resolve().parents[2] / "seed_assets"


def _empty(db: Session, model) -> bool:
    return (db.scalar(select(func.count()).select_from(model)) or 0) == 0


def _upload(db: Session, filename: str, purpose: str) -> str | None:
    path = ASSETS / filename
    if not path.exists():
        return None
    existing = db.scalars(select(MediaAsset).where(MediaAsset.original_filename == filename)).first()
    if existing:
        return existing.url
    stored = storage.store(path.read_bytes(), folder=purpose)
    db.add(MediaAsset(url=stored.url, provider=stored.provider, public_id=stored.public_id, kind=stored.kind,
                      mime_type=stored.mime_type, size_bytes=stored.size_bytes, width=stored.width,
                      height=stored.height, original_filename=filename, purpose=purpose))
    db.flush()
    return stored.url


PROFILE = dict(
    full_name="Mohammed Sakib Hasan",
    title="AI/ML Engineer",
    specialties=["Computer Vision", "NLP", "Generative AI", "Agentic AI"],
    hero_headline="Building intelligent systems through AI research, machine learning, and generative AI.",
    hero_description=(
        "Computer Science undergraduate and AI/ML Engineer with research experience, two IEEE conference "
        "publications, and hands-on experience developing RAG pipelines, Agentic AI workflows, and machine "
        "learning systems."
    ),
    about_title="About",
    about_summary=(
        "I'm a Computer Science and Engineering undergraduate at Patuakhali Science and Technology University "
        "with two IEEE conference papers and hands-on experience developing RAG pipelines, Agentic AI workflows, "
        "and machine learning systems.\n\n"
        "I work mostly in PyTorch and FastAPI, with open-source LLMs fine-tuned using LoRA and QLoRA, and vector "
        "search with Qdrant. I'm interested in translating practical AI research and LLM architectures into "
        "efficient, real-world solutions."
    ),
    about_highlights=[
        "Computer Science & Engineering undergraduate, PSTU",
        "First author on two IEEE conference papers (2025)",
        "RAG pipelines and Agentic AI workflows",
        "Open-source LLMs, fine-tuned with LoRA / QLoRA",
        "Vector search with Qdrant and ChromaDB",
        "PyTorch for modelling, FastAPI for serving",
    ],
    location="Chattogram, Bangladesh",
    email="sakibnghs123@gmail.com",
    phone="+8801869793139",
    show_phone=False,
    available_for_work=True,
    availability_note="Open to AI/ML engineering roles, internships and research collaborations.",
)

SKILLS: list[tuple[str, str, list[str]]] = [
    ("Programming", "code", ["Python", "C", "C++", "Java", "Dart", "SQL"]),
    ("Web Development", "globe", ["HTML5", "CSS", "JavaScript"]),
    ("Machine Learning & Deep Learning", "brain",
     ["PyTorch", "TensorFlow", "Keras", "Scikit-learn", "CNN", "RNN", "LSTM", "GRU"]),
    ("Computer Vision", "scan-eye", ["OpenCV", "YOLO", "Object Detection", "Image Classification", "Face Recognition"]),
    ("NLP & LLMs", "message-square-text",
     ["Hugging Face", "Transformers", "LoRA", "QLoRA", "Open-Source LLMs", "Prompt Engineering"]),
    ("Generative & Agentic AI", "sparkles", ["Agentic AI Workflows", "RAG", "LangChain", "Embeddings", "Semantic Search"]),
    ("Databases & Frameworks", "database", ["Qdrant", "ChromaDB", "FastAPI", "Flask", "Streamlit", "Docker", "Git"]),
]

PUBLICATIONS = [
    dict(
        title="StrokeGuardian: Hybrid Ensemble ML for Real-Time Brain Stroke Prediction and Clinical Decision Support",
        year=2025, venue="IEEE WIECON-ECE 2025", publication_type="conference", author_position="First author",
        doi="10.1109/WIECON-ECE69386.2025.11526163",
        abstract=(
            "A hybrid ensemble machine learning framework for early-stage, real-time brain stroke risk prediction, "
            "with clinical decision support features that give healthcare practitioners data-driven predictive insights."
        ),
        highlights=[
            "Proposed and evaluated a hybrid ensemble machine learning framework for early-stage, real-time brain stroke risk prediction.",
            "Implemented clinical decision support features to assist healthcare practitioners with data-driven predictive insights.",
            "Presented the paper as first author at IEEE WIECON-ECE 2025.",
        ],
        tags=["Machine Learning", "Healthcare", "Ensemble Learning"],
        sort_order=0,
    ),
    dict(
        title="SafeRide: A Real-Time IoT-Based Smart Helmet with Road-Condition Intelligence",
        year=2025, venue="IEEE RAAICON 2025", publication_type="conference", author_position="First author",
        doi="10.1109/RAAICON69033.2025.11502538",
        abstract=(
            "An IoT-enabled smart helmet that integrates real-time telemetry with road-condition monitoring, "
            "adding proactive accident prevention and alerts to improve rider safety and situational awareness."
        ),
        highlights=[
            "Designed an intelligent IoT-enabled smart helmet system integrating real-time telemetry and road-condition monitoring.",
            "Developed proactive accident prevention and alert mechanisms to improve rider safety and situational awareness.",
            "Presented the paper as lead author at IEEE RAAICON 2025.",
        ],
        tags=["IoT", "Road Safety", "Embedded Systems"],
        sort_order=1,
    ),
]

# URLs only where they already existed on the previous portfolio site. Everything else stays empty to fill in.
PROJECTS = [
    dict(
        title="AI-Powered Intelligent Brochure Generator", year=2026, category="Generative AI", is_featured=True,
        short_description="An autonomous pipeline that scrapes a company's website, extracts brand intelligence with LLMs and produces a designed multi-page PDF brochure.",
        technologies=["Python", "Groq LLM", "Hugging Face", "Streamlit", "BeautifulSoup", "Playwright", "ReportLab"],
        highlights=[
            "Built an autonomous pipeline scraping websites using BeautifulSoup and Playwright.",
            "Extracted structured brand intelligence using Groq-hosted LLMs.",
            "Generated marketing imagery using Hugging Face models.",
            "Automated dynamic multi-page PDF generation using ReportLab, inside a Streamlit UI.",
        ],
    ),
    dict(
        title="Mentora – An AI-Based Mental Health Self-Awareness Platform", year=2026, category="NLP", is_featured=True,
        short_description="A full-stack NLP platform that classifies multi-class emotional sentiment across 100+ languages, with analytics dashboards and exportable reports.",
        technologies=["Next.js 15", "TypeScript", "FastAPI", "Hugging Face", "RAG", "PostgreSQL", "Redis", "Docker"],
        highlights=[
            "Developed a full-stack NLP system classifying multi-class emotional sentiment across 100+ languages.",
            "Optimized inference pipelines using ONNX Runtime.",
            "Developed asynchronous REST APIs with FastAPI and Pydantic.",
            "Built JWT authentication, analytics dashboards, and PDF/CSV reports.",
            "Implemented PostgreSQL, Redis caching, and Dockerized deployment.",
        ],
    ),
    dict(
        title="AI-Driven Hospital Flow & Bed Management Digital Twin", year=2026, category="Machine Learning", is_featured=True,
        short_description="An event-driven hospital digital twin that simulates triage, forecasts arrival surges and optimises ICU and ward bed occupancy.",
        technologies=["React.js", "FastAPI", "SimPy", "Scikit-Learn", "HTML5 Canvas", "Tailwind CSS", "SQLite/PostgreSQL"],
        highlights=[
            "Built an event-driven 3D hospital digital twin.",
            "Simulated patient triage and forecasted patient arrival surges.",
            "Optimized ICU and ward bed occupancy.",
            "Developed a High-DPI isometric Canvas visualizer.",
            "Implemented real-time telemetry, 45-bed occupancy states, and dynamic patient pathfinding.",
        ],
    ),
    dict(
        title="Multimodal Human Emotion Recognition AI", year=2025, category="Computer Vision", is_featured=True,
        short_description="A multimodal pipeline that classifies six affective states by fusing facial expressions, speech acoustics and text sentiment.",
        technologies=["Python", "PyTorch", "OpenCV", "Librosa", "Transformers", "NLP"],
        highlights=[
            "Developed a multimodal emotion recognition pipeline classifying six affective states.",
            "Combined facial expression features and acoustic speech signals.",
            "Integrated transformer-based NLP models for textual sentiment analysis.",
        ],
    ),
    dict(
        title="CareSync – AI-Powered Family Health Coordination App", year=2025, category="Mobile", is_featured=False,
        short_description="An offline-first, cross-platform app that coordinates a family's health records, medication reminders and appointments.",
        technologies=["Flutter", "Firebase", "Gemini API", "Mobile Development"],
        highlights=[
            "Built an offline-first cross-platform healthcare application.",
            "Implemented multi-profile synchronization and secure cloud storage.",
            "Integrated the Gemini API for contextual health advice, medication reminders, and appointment scheduling.",
        ],
    ),
    dict(
        title="CSE Study Room – Collaborative Academic Platform", year=2024, category="Full-Stack", is_featured=False,
        short_description="A collaborative platform for CSE students with real-time chat, video study sessions, resource sharing and quizzes.",
        technologies=["JavaScript", "Node.js", "Python", "WebSockets", "WebRTC", "SQL"],
        highlights=[
            "Built a collaborative web platform for CSE students.",
            "Implemented real-time chat, video conferencing, and resource sharing.",
            "Developed quiz modules, progress dashboards, and academic roadmaps.",
            "Implemented authentication and session management.",
        ],
        github_url="https://github.com/Sakib-Hasan3/PhP-Basic/tree/main/Php%20Project/CSE_STUDY_ROOM",
        _thumb="cse-study-room.jpg",
    ),
    dict(
        title="Smart IoT & Embedded Systems Projects", year=2023, period_label="2022–2023", category="IoT & Embedded",
        is_featured=False,
        short_description="Hardware prototypes built on Arduino: a dual-axis solar tracker and an alcohol-detection safety system for bikes.",
        technologies=["Arduino Uno", "Embedded C", "Sensors", "Microcontrollers"],
        description=(
            "Dual-Axis Solar Tracking System (2023)\n"
            "An automated solar alignment mechanism using LDR light sensors and an Arduino Uno to keep a panel "
            "facing the sun.\n\n"
            "Smart Bike Alcohol Detection Safety Robot (2022)\n"
            "An alcohol-sensing vehicle lockout prototype using MQ sensors and a microcontroller, designed to "
            "prevent intoxicated riding and trigger alerts."
        ),
        highlights=["Dual-Axis Solar Tracking System.", "Smart Bike Alcohol Detection Safety Robot."],
        extra_links=[
            {"label": "Solar tracker on GitHub", "url": "https://github.com/Sakib-Hasan3/Solar-Tracking-System-Project"},
            {"label": "Alcohol detector on GitHub", "url": "https://github.com/Sakib-Hasan3/Alcohol-Detector-Robot"},
        ],
        _thumb="iot-alcohol-robot.jpg",
    ),
]

EXPERIENCE = [
    dict(role="Assistant General Secretary (Academic Research & Higher Studies)",
         organization="CSE Club, Patuakhali Science and Technology University", start_year=2026, is_current=True,
         employment_type="Leadership",
         highlights=[
             "Lead research discussion forums, study groups, and guidance sessions.",
             "Assist students in research methodology and paper writing.",
             "Support collaborative coding and project debugging.",
         ]),
    dict(role="Affiliate Partner", organization="10 Minute School", start_year=2022, end_year=2023, location="Remote",
         employment_type="Part-time",
         highlights=["Led digital outreach connecting students with online technical and academic courses."]),
    dict(role="Campus Ambassador", organization="Apar's Classroom", start_year=2021, end_year=2022, location="Remote",
         employment_type="Volunteer",
         highlights=["Promoted STEM education initiatives, organised virtual outreach campaigns and drove student engagement."]),
    dict(role="Academic Document Specialist / Typist", organization="Academic and Admission Pathshala",
         start_year=2020, end_year=2021, location="Remote", employment_type="Part-time",
         highlights=["Formatted, digitised and catalogued academic assessments, test materials and institutional documents."]),
]

SOCIALS = [
    dict(platform="github", label="GitHub", url="https://github.com/Sakib-Hasan3", show_in_hero=True),
    dict(platform="linkedin", label="LinkedIn", url="https://www.linkedin.com/in/sakib-hasan-931276266", show_in_hero=True),
    dict(platform="email", label="Email", url="mailto:sakibnghs123@gmail.com", show_in_hero=False),
]


def seed(db: Session, with_media: bool = True) -> list[str]:
    done: list[str] = []
    media = (lambda f, p: _upload(db, f, p)) if with_media else (lambda f, p: None)

    if _empty(db, Profile):
        db.add(Profile(**PROFILE, avatar_url=media("profile.jpg", "avatar")))
        done.append("profile")

    if _empty(db, WebsiteSettings):
        db.add(WebsiteSettings(
            site_title="Mohammed Sakib Hasan — AI/ML Engineer",
            site_description="AI/ML Engineer working on computer vision, NLP and LLM applications. Two IEEE publications, RAG pipelines and agentic AI systems.",
            keywords=["AI/ML Engineer", "Machine Learning", "Computer Vision", "NLP", "LLM", "RAG", "Agentic AI",
                      "Mohammed Sakib Hasan", "Bangladesh"],
            footer_text="Designed and built by Mohammed Sakib Hasan.",
            section_visibility={"about": True, "skills": True, "research": True, "projects": True,
                                "experience": True, "education": True, "achievements": True, "contact": True},
        ))
        done.append("settings")

    if _empty(db, SkillCategory):
        for ci, (name, icon, skills) in enumerate(SKILLS):
            cat = SkillCategory(name=name, slug=slugify(name), icon=icon, sort_order=ci)
            cat.skills = [Skill(name=s, sort_order=si) for si, s in enumerate(skills)]
            db.add(cat)
        done.append("skills")

    pubs: dict[str, Publication] = {}
    if _empty(db, Publication):
        for p in PUBLICATIONS:
            obj = Publication(slug=slugify(p["title"].split(":")[0]), **p)
            db.add(obj)
            pubs[obj.slug] = obj
        db.flush()
        done.append("publications")

    if _empty(db, Project):
        for i, raw in enumerate(PROJECTS):
            p = dict(raw)
            thumb = p.pop("_thumb", None)
            obj = Project(slug=slugify(p["title"].split("–")[0]), sort_order=i, status="completed", **p)
            if thumb:
                obj.thumbnail_url = media(thumb, "project-thumbnail")
            db.add(obj)
        done.append("projects")

    if _empty(db, Education):
        db.add(Education(
            degree="Bachelor of Science", field_of_study="Computer Science and Engineering",
            institution="Patuakhali Science and Technology University", location="Patuakhali, Bangladesh",
            end_year=2027, is_expected=True, grade="CGPA 3.56",
        ))
        done.append("education")

    if _empty(db, Experience):
        for i, e in enumerate(EXPERIENCE):
            db.add(Experience(sort_order=i, **e))
        done.append("experience")

    if _empty(db, SocialLink):
        for i, s in enumerate(SOCIALS):
            db.add(SocialLink(sort_order=i, **s))
        done.append("social links")

    if _empty(db, Resume) and with_media:
        url = media("Mohammed_Sakib_Hasan_CV.pdf", "resume")
        if url:
            asset = db.scalars(select(MediaAsset).where(MediaAsset.url == url)).first()
            db.add(Resume(title="CV — Mohammed Sakib Hasan", file_url=url, media_asset_id=asset.id if asset else None,
                          is_active=True))
            done.append("resume")

    db.commit()
    return done


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-media", action="store_true", help="Skip uploading images and the CV")
    args = parser.parse_args()
    with SessionLocal() as db:
        done = seed(db, with_media=not args.no_media)
    print("Seeded: " + (", ".join(done) if done else "nothing (all sections already have content)"))


if __name__ == "__main__":
    main()
