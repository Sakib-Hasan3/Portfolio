# Architecture

## Phases delivered

| Phase | Result |
|---|---|
| 1. Requirements & architecture | Two interfaces (public site, `/admin`) over one FastAPI content API; same-origin proxy; tag-based cache invalidation |
| 2. Schema & API design | 17 normalised tables (below), REST modules generated from one registry |
| 3. Backend & auth | FastAPI app, Argon2 + JWT cookie sessions with refresh rotation, CSRF, rate limiting, logging, error handling |
| 4. Public UI | Home, projects index with search/filters, project detail pages, research page, 404, loading/error states, SEO |
| 5. Admin dashboard | Overview with charts, 12 management areas, schema-driven forms and tables |
| 6. Integration | Typed server fetchers with cache tags, browser client with CSRF + silent refresh |
| 7. Uploads, security, caching | Cloudinary/local storage with content sniffing, security headers, revalidation webhook |
| 8. Testing | 24 backend tests (PostgreSQL + SQLite), typecheck, lint, production build, browser end-to-end run |
| 9. Docker & deployment | Dockerfiles, compose (dev + prod with Caddy), CI workflow, guides |

## Request flow

```
                 ┌──────────── Next.js (Vercel or Docker) ────────────┐
 visitor ──────► │ (site) pages  ── unstable_cache(tags) ──┐          │
                 │                                          ▼          │
 admin ────────► │ /admin pages ── fetch /api/v1/* ──► route proxy ────┼──► FastAPI ──► PostgreSQL
                 │ /api/revalidate ◄────────────────────────────────── │◄── (after writes)
                 └────────────────────────────────────────────────────┘        │
                                                                         Cloudinary / disk
```

- **Rendering:** public pages render per request but read through `unstable_cache`, so most requests never touch the
  API. Tags: `portfolio` (everything) plus `projects`, `publications`, `skills`, … The build doesn't need the API.
- **Writes:** only via `/api/v1/admin/*`. Each CRUD router enqueues a background revalidation for its tags.
- **Proxy:** `src/app/api/v1/[...path]/route.ts` forwards method, body, cookies, CSRF header and client IP, and relays
  `Set-Cookie`. The API never needs to be exposed to browsers directly.

## Backend layering

```
routers/factory.py  build_admin_router(ResourceConfig)  →  list/get/create/update/publish/delete/restore
        │
services/crud.py    CRUDService: slugging, required-field checks, activity log, commit + 409 mapping
services/content.py per-resource hooks (project images & publication FK, skill category FK, single active resume)
        │
repositories/base.py Repository: search (ILIKE over columns incl. JSON), filters, pagination, soft delete
        │
models/entities.py  SQLAlchemy 2 typed models
```

Adding a content module = a model, three schemas and one `ResourceConfig` entry in `routers/resources.py`, plus one
`ResourceDef` in `frontend/src/lib/admin/resources.ts` for the dashboard form and table.

## Data model

| Table | Purpose | Notes |
|---|---|---|
| `admin_users` | Dashboard accounts | unique email, role, Argon2 hash |
| `refresh_tokens` | Session rotation | hashed token (unique), `family_id`, `revoked_at`, `replaced_by_id` |
| `profiles` | Identity, hero, about | singleton |
| `website_settings` | SEO, section visibility, analytics, contact toggles | singleton |
| `skill_categories` / `skills` | Grouped skills | unique `(category_id, name)`, FK cascade |
| `publications` | Papers | unique slug, unique DOI, soft delete |
| `projects` | Case studies | unique slug, FK → publications (SET NULL), soft delete, featured index |
| `project_images` | Screenshots | FK cascade, ordered |
| `education`, `experiences`, `achievements` | Background | publish flag + sort order |
| `social_links` | Profile links | `show_in_hero` |
| `media_assets` | Every upload | provider, public id, kind, MIME, size, dimensions |
| `resumes` | CV versions | one `is_active` at a time, FK → media_assets |
| `contact_messages` | Inbox | status, spam flag, hashed IP |
| `activity_logs` | Audit trail | FK → admin_users |

All tables have `created_at`/`updated_at` (activity log: `created_at`). JSON lists (technologies, highlights, tags)
use JSONB on PostgreSQL.

## Frontend design notes

- Dark-first charcoal palette with one periwinkle accent; Bricolage Grotesque for display, IBM Plex Sans for text.
- The hero is a three.js scene generated from the CMS (2-D canvas fallback without WebGL): every published skill is a point that settles into its category's
  cluster, so editing skills changes the hero. It stops animating under `prefers-reduced-motion`.
- Publications are presented as numbered citations with DOI links and a copy-citation action.
- Projects without a thumbnail get a typographic cover built from their own technology stack.
- Dashboard charts use colour tokens validated for contrast and colour-vision deficiency in both themes.
