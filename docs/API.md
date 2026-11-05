# API reference

Base path: `/api/v1`. Interactive docs: `/docs` (Swagger UI, use **Authorize** with your admin email/password) and
`/redoc`. The full schema is in [`openapi.json`](openapi.json).

All errors share one shape:

```json
{ "detail": "title: String should have at least 1 character", "code": "validation_error",
  "errors": [{ "field": "title", "message": "String should have at least 1 character" }] }
```

## Authentication

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → sets `access_token`, `refresh_token`, `csrf_token` cookies. 5/min per IP. |
| POST | `/auth/token` | OAuth2 form (`username`, `password`) → `{access_token}` bearer token for scripts/Swagger. |
| POST | `/auth/refresh` | Rotates the refresh cookie; reuse of a rotated token revokes the session family. |
| POST | `/auth/logout` | Revokes the session and clears cookies. |
| GET/PATCH | `/auth/me` | Current admin; update name/email. |
| POST | `/auth/change-password` | `{current_password, new_password}`; signs out all sessions. |

Admin requests authenticate with either `Authorization: Bearer <token>` or the session cookie. Cookie-authenticated
`POST/PATCH/PUT/DELETE` requests must send `X-CSRF-Token` equal to the `csrf_token` cookie.

## Public (no auth, published content only)

| Method | Path | Notes |
|---|---|---|
| GET | `/public/portfolio` | Everything the home page needs in one response |
| GET | `/public/profile`, `/public/settings`, `/public/resume` | Singletons (phone only if `show_phone`) |
| GET | `/public/skills` | Categories with their published skills |
| GET | `/public/projects?category=&technology=&featured=&q=` | Featured first, then sort order |
| GET | `/public/projects/{slug}` | 404 for drafts and deleted projects |
| GET | `/public/publications?year=&type=` and `/public/publications/{slug}` | |
| GET | `/public/education`, `/public/experience`, `/public/achievements`, `/public/social-links` | |
| GET | `/public/sitemap` | Slugs and update times for the sitemap |
| POST | `/public/contact` | `{name, email, subject, message, website (honeypot), elapsed_ms}`; 5/hour per IP |

## Admin content modules

Every module below has the same endpoints under `/admin/{module}`:

| Method | Path | |
|---|---|---|
| GET | `/admin/{module}?q=&page=&page_size=&trash=&<filters>` | Paginated `{items, total, page, page_size}` |
| GET | `/admin/{module}/{id}` | |
| POST | `/admin/{module}` | Create (201) |
| PATCH | `/admin/{module}/{id}` | Partial update — send only changed fields |
| POST | `/admin/{module}/{id}/publish?published=true|false` | Publish / unpublish |
| DELETE | `/admin/{module}/{id}?hard=false` | Soft delete for projects & publications; `hard=true` removes permanently |
| POST | `/admin/{module}/{id}/restore` | Projects & publications only |

| Module | Search fields | Filters |
|---|---|---|
| `projects` | title, short description, category, technologies | `category`, `status`, `is_featured`, `is_published`, `year` |
| `publications` | title, venue, DOI, abstract | `year`, `publication_type`, `is_published` |
| `skill-categories` | name, description | `is_published` |
| `skills` | name | `category_id`, `is_published` |
| `education` | degree, institution, field | `is_published` |
| `experience` | role, organisation, description | `is_published`, `is_current`, `employment_type` |
| `achievements` | title, issuer, description | `is_published`, `year` |
| `social-links` | platform, label, URL | `is_published`, `platform` |
| `resumes` | title, notes | `is_active` (setting one active deactivates the rest) |

Projects accept `images: [{url, caption}]` (replaces the screenshot list) and `extra_links: [{label, url}]`.
Slugs are generated from the title when omitted and de-duplicated (`-2`, `-3`…).

## Other admin endpoints

| Method | Path | |
|---|---|---|
| GET/PATCH | `/admin/profile` | Profile, hero and about content |
| GET/PATCH | `/admin/settings` | Website settings |
| POST | `/admin/media/upload` | multipart `file`, `purpose` (`avatar`, `project-thumbnail`, `project-screenshot`, `publication-pdf`, `resume`, `og-image`, `misc`) |
| GET / DELETE | `/admin/media`, `/admin/media/{id}` | Library listing (`kind=image|pdf`, `q`) and deletion |
| GET | `/admin/messages?status=&spam=&q=` | Contact inbox |
| GET | `/admin/messages/unread-count` | |
| GET/PATCH/DELETE | `/admin/messages/{id}` | PATCH `{status, is_spam}` |
| GET | `/admin/dashboard/stats` | Totals, published vs draft, messages per day (14 days) |
| GET | `/admin/dashboard/activity?limit=` | Audit log |

## Example: create a project with a script

```bash
TOKEN=$(curl -s -X POST https://api.your-domain.com/api/v1/auth/token \
  -d "username=you@example.com" --data-urlencode "password=$ADMIN_PASSWORD" | jq -r .access_token)

curl -X POST https://api.your-domain.com/api/v1/admin/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"RAG over lecture notes","short_description":"Semantic search over course material.",
       "category":"Generative AI","technologies":["LangChain","Qdrant","FastAPI"],"year":2026}'
```
