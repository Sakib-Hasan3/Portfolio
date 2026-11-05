"""Tokenisation and query understanding shared by indexing and retrieval."""

import re

_WORD = re.compile(r"[a-z0-9][a-z0-9+#]*(?:[.\-][a-z0-9+#]+)*|[ঀ-৿]+")

STOPWORDS = frozenset(
    """a an and are as at be been being but by can could did do does for from had has have he her him his how i if in
    into is it its me my of on or our she so than that the their them then there these they this to us was we were what
    when where which who whom why will with would you your tell about please sakib sakibs mohammed hasan ask ai also
    any some more most much many""".split()
)

# Banglish / Bangla / colloquial words -> canonical English terms. Matching is on lower-cased tokens.
EXPAND: dict[str, tuple[str, ...]] = {
    # who / about
    "who": ("profile", "about"), "where": ("location",), "based": ("location",), "nationality": ("location",),
    "ke": ("who", "profile"), "poricoy": ("profile", "about"), "porichoy": ("profile", "about"),
    "somporke": ("about", "profile"), "shomporke": ("about", "profile"), "bishoye": ("about",),
    "introduce": ("profile", "about"), "intro": ("profile", "about"), "bio": ("profile", "about"),
    # location
    "kothay": ("location", "based"), "kothai": ("location", "based"), "thake": ("location", "based"),
    "thaken": ("location", "based"), "address": ("location",), "country": ("location",), "city": ("location",),
    "live": ("location", "based"), "lives": ("location", "based"),
    # education
    "porashona": ("education", "degree", "university"), "porasona": ("education",),
    "shikkha": ("education",), "study": ("education",), "studies": ("education",), "studied": ("education",),
    "university": ("education",), "college": ("education",), "school": ("education",), "cgpa": ("education",),
    "gpa": ("education",), "bsc": ("education", "degree"), "degree": ("education",), "graduate": ("education",),
    # research
    "gobeshona": ("research", "publication", "paper"), "goveshona": ("research", "publication", "paper"),
    "prokashona": ("publication",), "paper": ("publication", "research"), "papers": ("publication", "research"),
    "ieee": ("publication", "research", "conference"), "journal": ("publication",), "published": ("publication",),
    "publication": ("research", "paper"), "conference": ("publication", "venue"), "conferences": ("publication", "venue"),
    "doi": ("publication",), "cite": ("publication",), "citation": ("publication",), "author": ("publication",),
    "wiecon": ("publication",), "raaicon": ("publication",),
    # projects
    "projekt": ("project",), "projects": ("project",), "built": ("project",), "build": ("project",),
    "developed": ("project",), "develop": ("project",), "application": ("project",), "app": ("project",),
    "apps": ("project",), "system": ("project",), "github": ("project", "contact"), "demo": ("project",),
    # skills
    "dokkhota": ("skills",), "dakkhota": ("skills",), "jane": ("skills", "know"), "jante": ("skills", "know"),
    "janen": ("skills", "know"), "pare": ("skills",), "paren": ("skills",), "tech": ("skills", "technology"),
    "stack": ("skills", "technology"), "tools": ("skills", "technology"), "framework": ("skills", "technology"),
    "frameworks": ("skills", "technology"), "languages": ("skills", "programming", "language"),
    "language": ("skills", "programming"), "know": ("skills",), "knows": ("skills",), "expertise": ("skills",),
    "specialize": ("skills", "profile"), "specialise": ("skills", "profile"), "specialization": ("skills", "profile"),
    "genai": ("generative", "ai"), "llm": ("language", "model", "generative"), "llms": ("language", "model", "generative"),
    "rag": ("retrieval", "generation"), "cv2": ("computer", "vision"),
    # experience
    "kaj": ("experience", "work"), "kaaj": ("experience", "work"), "chakri": ("experience", "work", "job"),
    "work": ("experience",), "worked": ("experience",), "job": ("experience",), "intern": ("experience",),
    "internship": ("experience", "contact"), "leadership": ("experience", "leader"), "leader": ("experience",),
    "role": ("experience",), "career": ("experience", "education"), "club": ("experience",),
    # achievements
    "award": ("achievement",), "awards": ("achievement",), "prize": ("achievement",), "honor": ("achievement",),
    "honour": ("achievement",), "certificate": ("achievement",), "certification": ("achievement",),
    "competition": ("achievement",), "won": ("achievement",), "achievements": ("achievement",),
    # contact / availability
    "jogajog": ("contact", "email"), "jogajug": ("contact", "email"), "contact": ("email", "reach"),
    "reach": ("contact", "email"), "email": ("contact",), "mail": ("contact", "email"), "phone": ("contact",),
    "hire": ("contact", "available", "work"), "hiring": ("contact", "available"), "freelance": ("contact", "available"),
    "collaborate": ("contact", "available", "research"), "collaboration": ("contact", "available", "research"),
    "available": ("contact", "availability"), "availability": ("contact",), "linkedin": ("contact",),
    "social": ("contact",), "connect": ("contact",), "message": ("contact",),
    # testimonials / notes
    "testimonial": ("recommendation",), "testimonials": ("testimonial",), "recommendation": ("testimonial",),
    "recommendations": ("testimonial",), "feedback": ("testimonial",), "supervisor": ("testimonial",),
    "said": ("testimonial",), "blog": ("note",), "blogs": ("note",), "article": ("note",), "articles": ("note",),
    "note": ("blog",), "notes": ("blog",), "wrote": ("note", "blog"), "written": ("note", "blog"), "writing": ("note",),
    "tutorial": ("note",), "post": ("note", "blog"), "posts": ("note", "blog"),
    # cv
    "cv": ("resume",), "resume": ("cv",), "biodata": ("resume", "cv"),
}

# query-token -> source types that should be searched explicitly (so "list" questions get full coverage)
ROUTES: dict[str, tuple[str, ...]] = {
    "publication": ("publication",), "research": ("publication",), "paper": ("publication",),
    "project": ("project",), "skills": ("skill",), "technology": ("skill", "project"),
    "education": ("education",), "experience": ("experience",), "achievement": ("achievement",),
    "contact": ("contact",), "resume": ("resume",), "testimonial": ("testimonial",), "note": ("note",), "blog": ("note",), "profile": ("profile",), "location": ("profile", "contact"),
    "available": ("contact",), "email": ("contact",),
}

CONTACT_INTENT = re.compile(
    r"\b(hire|hiring|recruit\w*|collaborat\w*|freelanc\w*|intern(ship)?s?|contact|reach|email|e-mail|connect|"
    r"opportunit\w*|available|availability|job\s+offer|work\s+with|partner\w*|jogajog|collab|supervis\w*)\b",
    re.I,
)


def stem(w: str) -> str:
    if len(w) > 5 and w.endswith("ies"):
        return w[:-3] + "y"
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w


def raw_tokens(text: str) -> list[str]:
    return [t.strip(".-") for t in _WORD.findall(text.lower()) if t.strip(".-")]


def tokens(text: str, *, keep_stop: bool = False) -> list[str]:
    out: list[str] = []
    for t in raw_tokens(text):
        if not keep_stop and t in STOPWORDS:
            continue
        out.append(stem(t))
    return out


# word-prefix expansions so inflections ("educational", "publications", "researcher") still route correctly
PREFIX_EXPAND: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("educat", ("education",)), ("academ", ("education",)), ("publi", ("publication", "research")),
    ("research", ("research", "publication")), ("experienc", ("experience",)), ("achiev", ("achievement",)),
    ("certif", ("achievement",)), ("project", ("project",)), ("skill", ("skills",)), ("contact", ("contact",)),
    ("collaborat", ("contact", "research")), ("employ", ("experience",)), ("profession", ("experience", "profile")),
    ("backgr", ("profile",)), ("biograph", ("profile",)),
)


def expand_query(text: str) -> tuple[list[str], set[str]]:
    """Returns (query tokens including expansions, routed source types)."""
    base = tokens(text)
    extra: list[str] = []
    for t in raw_tokens(text):
        for e in EXPAND.get(t, ()):
            extra.append(stem(e))
        for prefix, expansions in PREFIX_EXPAND:
            if t.startswith(prefix):
                extra.extend(stem(e) for e in expansions)
    all_tokens = base + extra
    routed: set[str] = set()
    for t in all_tokens:
        for key, types in ROUTES.items():
            if t == stem(key):
                routed.update(types)
    return all_tokens, routed
