# Mohammed Sakib Hasan — Portfolio CMS

A database-driven portfolio for an AI/ML engineer: a public site and a private admin dashboard. All content
(profile, about, skills, publications, projects, education, experience, achievements, social links, CV, site
settings) lives in PostgreSQL and is edited from `/admin`. Saving in the dashboard updates the public site within a
second or so, with no redeploy.

| Layer | Stack |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS 4, three.js, Framer Motion, Lucide, React Hook Form, Zod |
| Backend | Python, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, JWT (PyJWT), Argon2 |
| Data | PostgreSQL 16; media on Cloudinary (production) or local disk (development) |
| Ops | Docker, Docker Compose, Caddy (optional TLS), GitHub Actions |

---

## Quick start (Docker)

```bash
cp .env.example .env          # set POSTGRES_PASSWORD, SECRET_KEY, REVALIDATE_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up --build
```

- Public site: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin
- API docs (Swagger): http://localhost:8000/docs (ReDoc at `/redoc`)

On first start the API runs migrations, seeds the CV content into empty tables (`SEED_ON_START=true`) and creates
the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if none exists. After that, clear `ADMIN_PASSWORD` from `.env`.

## Local development (without Docker)

**Backend**

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                     # point DATABASE_URL at your Postgres
alembic upgrade head                     # create the schema
python -m app.scripts.seed               # load the initial CV content (idempotent)
python -m app.scripts.create_admin --email you@example.com --name "Mohammed Sakib Hasan"
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local               # API_INTERNAL_URL=http://localhost:8000, same REVALIDATE_SECRET as the API
npm run dev
```

## AI assistant ("Ask Sakib's AI")

A floating chat on the public site answers questions about the portfolio using retrieval-augmented generation over
your **published** content. Edit anything in `/admin` and the assistant's knowledge follows automatically (background
re-indexing, no redeploy). Set `GROQ_API_KEY` in `.env`, then manage it at `/admin/assistant`.
See [docs/ASSISTANT.md](docs/ASSISTANT.md) for architecture, safety rules and the API.

## 3-D and motion

- **Hero:** a WebGL scene (three.js, loaded only on the home page) built from your skills in the CMS. Points fly in and
  settle into one cluster per skill category; drag or use the arrow keys to orbit, hover a point to read it. Without
  WebGL it falls back to a 2-D version; with "reduce motion" turned on it renders still.
- **Cards:** project and paper cards tilt toward the pointer with a soft light (mouse only, off for reduced motion).
- **Research paper pages** (`/research/<slug>`): the paper shown as a 3-D page stack typeset from its record, abstract,
  key contributions, embedded PDF (when uploaded), IEEE and BibTeX citations, related projects and other papers.
- **Project pages** (`/projects/<slug>`): the main image leans back and straightens as you scroll it into view.
- **Page transitions:** each page lifts in from slightly behind the screen.

Clicking any project or paper card anywhere on the site opens its detail page.

## Admin setup

There is no public registration page. Admins are created on the server:

```bash
python -m app.scripts.create_admin --email you@example.com --name "Your Name"     # prompts for a password
python -m app.scripts.create_admin --email you@example.com --reset                # reset a password
# in Docker:
docker compose exec api python -m app.scripts.create_admin --email you@example.com
```

Passwords need 12+ characters and three of: lowercase, uppercase, digits, symbols. Resetting a password signs out
every session.

## What you can manage

| Dashboard page | Controls |
|---|---|
| Overview | Counts, published vs draft per section, messages over 14 days, recent activity |
| Profile & hero | Name, title, specialties, photo, headline, description, location, email, phone (hidden by default), availability |
| About me | Summary paragraphs and highlight checklist |
| Social links | GitHub, LinkedIn, email, Scholar… and which appear as hero icons |
| CV / resume | Upload PDFs, keep versions, choose which one "Download CV" serves |
| Projects | Title, slug, short + detailed description, highlights, technologies, category, status, year/period, thumbnail, screenshots, GitHub/demo/other links, featured, related publication |
| Publications | Title, venue, year, type, author position, authors, DOI, abstract, key points, topics, PDF, publisher URL |
| Skills / Skill categories | Categories (with icon) and the skills inside them — these also drive the hero visual |
| Experience / Education / Achievements | Timeline entries, degrees, awards (empty sections are hidden) |
| Messages | Contact-form inbox: unread/replied/archived/spam, search, reply by email, delete |
| Media library | Every uploaded image/PDF, copy URL, delete |
| Website settings | SEO title/description/keywords, share image, section visibility, footer, contact form on/off, email alerts, Plausible/Umami analytics |
| Account & security | Change password |

Every content module supports create, read, update, delete, search, filters, publish/unpublish and validation
(client-side with Zod, server-side with Pydantic). Projects and publications are soft-deleted to a trash and can be
restored or deleted permanently.

## How content reaches the public site

```
Browser ──► Next.js (same origin) ──/api/v1/*──► FastAPI ──► PostgreSQL
                 ▲                                   │
                 └──── POST /api/revalidate ◄────────┘  (after every admin change)
```

1. Public pages read `GET /api/v1/public/portfolio` (and per-project endpoints) through `unstable_cache`, tagged
   `portfolio`, `projects`, `publications`, …
2. When an admin saves, FastAPI calls the frontend's `/api/revalidate` webhook (shared secret) with the affected tags.
3. The next visitor gets freshly rendered content. A time-based fallback (`CONTENT_REVALIDATE_SECONDS`, default 1h)
   covers the case where the webhook can't reach the frontend.

Public endpoints only ever return published, non-deleted rows. No portfolio content is hard-coded in React components.

## Security

- **Auth:** Argon2id password hashing; 15-minute JWT access tokens and opaque 7-day refresh tokens, both in
  `HttpOnly` `SameSite=Lax` cookies (`Secure` in production). Refresh tokens are stored hashed and **rotated on every
  use**; replaying an old one revokes the whole session family.
- **CSRF:** cookie-authenticated writes require a double-submit `X-CSRF-Token` header. Bearer tokens (Swagger, scripts)
  are accepted without it because they aren't ambient credentials.
- **Same-origin proxy:** the browser only talks to the Next.js origin, which proxies `/api/v1` and `/uploads` to FastAPI,
  so cookies stay first-party and the API address is a runtime setting.
- **Validation:** Pydantic on every input; URL fields accept only `http(s)` or the app's own `/uploads/…` paths
  (blocks `javascript:` / `data:` links); React escapes all text; JSON-LD is escaped.
- **Uploads:** type detected from file contents (Pillow/PDF magic bytes), not the filename; images ≤ 5 MB, PDFs ≤ 15 MB;
  random filenames; decompression-bomb guard.
- **Rate limiting:** login 5/min, contact form 5/hour, 240 req/min globally per IP.
- **Contact spam:** honeypot field, minimum fill time, link-count heuristic (suspected spam is kept but filed as spam).
- **Headers:** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production;
  admin/auth responses are `no-store`; `/admin` is `noindex` and disallowed in `robots.txt`.
- **Secrets:** environment variables only; the API refuses to start in production with default secrets. `.env` files
  are git-ignored.

## Tests and checks

```bash
cd backend && pytest                       # 25 tests: auth, CSRF, token rotation, CRUD, visibility rules, uploads, contact, seed
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/portfolio_test pytest   # run against PostgreSQL
ruff check app tests
cd frontend && npm run typecheck && npm run lint && npm run build
```

CI (`.github/workflows/ci.yml`) runs all of these against a PostgreSQL service, checks that migrations apply and roll
back cleanly, and builds both Docker images.

## Project layout

```
backend/
  app/
    main.py                 app factory, middleware, routers
    core/                   config, database, security (JWT/Argon2), rate limiting, logging, error handlers
    models/                 SQLAlchemy models (one module, 17 tables)
    schemas/                Pydantic request/response models
    repositories/           generic data access (search, filters, pagination, soft delete)
    services/               CRUD service + per-resource hooks, auth, storage, revalidation, notifications
    routers/                auth, public, contact, media, dashboard, singletons, CRUD router factory + registry
    middleware/             security headers, request id, access log, global rate limit
    scripts/                seed.py, create_admin.py
  migrations/               Alembic
  seed_assets/              profile photo, project images and CV used by the seed
  tests/
frontend/
  src/app/(site)/           public pages: home, /projects, /projects/[slug], /research, /research/[slug], OG image
  src/app/admin/            login + dashboard pages
  src/app/api/              revalidation webhook and the /api/v1 proxy
  src/components/site/      public UI (3-D skill galaxy, paper stack, tilt cards, sections, contact form)
  src/components/admin/     dashboard UI (schema-driven forms and tables)
  src/lib/                  API clients, resource definitions, SEO helpers, types
docs/                       DEPLOYMENT.md, API.md, ARCHITECTURE.md, openapi.json
deploy/Caddyfile            TLS reverse proxy for single-VPS hosting
```

## Content still to fill in

The seed contains only what's in the CV and the previous site. Deliberately left empty for you to add in the dashboard:
GitHub/demo links for the brochure generator, Mentora, the hospital digital twin, emotion recognition and CareSync;
the CSE Study Room live-demo URL; project thumbnails and screenshots for projects without one; publication PDFs and
publisher URLs; full author lists (used in copied citations); achievements; and your public site URL in Website settings.

More: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/API.md](docs/API.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
=======
# 🌐 Personal Portfolio – Sakib Hasan

Welcome to the source code of my **Personal Portfolio Website**, built with HTML, CSS, and JavaScript, and hosted on GitHub Pages.

🔗 **Live Demo:** [sakib-hasan3.github.io/Portfolio](https://sakib-hasan3.github.io/Portfolio/)

## 📌 Features

- Clean and responsive design
- Smooth scroll navigation
- About Me, Skills, Projects, and Contact sections
- Interactive animations and effects
- Mobile-friendly layout
- Hosted via GitHub Pages

## 📁 Technologies Used

- HTML5
- CSS3
- JavaScript

## 🚀 Getting Started

To run this project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/sakib-hasan3/Portfolio.git
