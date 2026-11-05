# Free hosting: Vercel + Render + Neon + Cloudinary

A public link anyone can open, at no cost.

| Part | Service (free tier) | Why |
|---|---|---|
| Website (Next.js) | **Vercel** | fast CDN, HTTPS, auto-deploys from GitHub |
| API (FastAPI + AI assistant) | **Render** web service | runs the Docker image from this repo |
| Database | **Neon** Postgres | permanent free tier (0.5 GB) |
| Uploaded images / CV | **Cloudinary** | free instances have no persistent disk |

Costs: **$0**. A custom domain (optional, ~$10/yr) can be added later on Vercel.

## What to expect (free-tier trade-offs)
- **Render sleeps after ~15 min idle** and takes ~30–60 s to wake. Pages stay fast (the site caches content on Vercel);
  only the first chat message / contact form / admin login after idle is slow. A free uptime monitor pinging `/health`
  every 5 min (step 8) keeps it awake.
- **Admin uploads through Vercel are limited to ~4.5 MB** per file. Compress big images; a CV PDF is normally fine.
- Neon pauses compute when idle (resumes in under a second).

## Steps

### 0. Put the code on GitHub
Render and Vercel deploy from your GitHub repo, so the latest code must be pushed. **Never commit `.env`** (it is ignored).

### 1. Neon (database)
1. Sign up at neon.tech → create a project (region near you, e.g. Singapore).
2. Copy the **connection string** (`postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`). Keep it secret.

### 2. Copy your current data into Neon
From this project folder, with the local stack running:
```bash
docker compose exec -T db pg_dump -U portfolio -d portfolio --no-owner --no-acl > portfolio.sql
docker run --rm -i postgres:16-alpine psql "PASTE_NEON_CONNECTION_STRING" < portfolio.sql
rm portfolio.sql      # it contains your admin account hash
```
This brings your profile, projects, papers, notes, settings, assistant settings and admin login across.

### 3. Cloudinary (images and CV)
Sign up at cloudinary.com → Dashboard → **API Environment variable** → copy `CLOUDINARY_URL` (`cloudinary://key:secret@cloud`).

### 4. Move your existing uploads to Cloudinary
```bash
# preview first (changes nothing)
docker compose run --rm -e DATABASE_URL="postgresql+psycopg://USER:PASS@ep-xxx.neon.tech/neondb?sslmode=require" \
  -e CLOUDINARY_URL="cloudinary://..." api python -m app.scripts.migrate_uploads
# then really do it
docker compose run --rm -e DATABASE_URL="postgresql+psycopg://..." -e CLOUDINARY_URL="cloudinary://..." \
  api python -m app.scripts.migrate_uploads --apply
```
It uploads each file (profile photo, project images, CV) and rewrites the URLs in Neon.

### 5. Render (API)
1. render.com → **New → Blueprint** → choose your repo (it reads `render.yaml`).
2. Fill the secret values:
   - `DATABASE_URL`: the Neon string (either form works)
   - `CLOUDINARY_URL`
   - `SECRET_KEY` and `REVALIDATE_SECRET`: two **new** random values (`python3 -c "import secrets;print(secrets.token_urlsafe(48))"`). Never reuse the old ones.
   - `GROQ_API_KEY`: your Groq key
   - `FRONTEND_URL` and `CORS_ORIGINS`: put placeholders for now (`https://example.com`, `["https://example.com"]`); you fix them in step 7.
3. Deploy. Note the URL, e.g. `https://portfolio-api.onrender.com`. Open `/health` — it should say `{"status":"ok"}`.

### 6. Vercel (website)
1. vercel.com → **Add New → Project** → import the repo.
2. **Root Directory: `frontend`**. Framework: Next.js (auto).
3. Environment variables:
   - `API_INTERNAL_URL` = your Render URL (no trailing slash)
   - `REVALIDATE_SECRET` = the **same** value you gave Render
   - `NEXT_PUBLIC_SITE_URL` = leave empty for now
4. Deploy. You get `https://your-project.vercel.app`.

### 7. Connect them
- Vercel: set `NEXT_PUBLIC_SITE_URL` = your Vercel URL → redeploy.
- Render: set `FRONTEND_URL` = your Vercel URL and `CORS_ORIGINS` = `["https://your-project.vercel.app"]` → it redeploys.
  (`FRONTEND_URL` is how the API tells the site to refresh when you edit content in the admin.)

### 8. Keep the API awake (optional but recommended)
uptimerobot.com (free) → new HTTP monitor → `https://YOUR-API.onrender.com/health` every 5 minutes.

### 9. Final checks
- Open your Vercel link: hero, projects, notes, CV, language toggle.
- `/admin` → log in → **Account**: change your password (the old one was committed to GitHub history before).
- Admin → Website settings: set **Site URL** (your Vercel URL) and an **OG image**.
- Ask the AI assistant a question (needs `GROQ_API_KEY` on Render).
- Edit something in the admin and confirm it shows on the site within seconds.
- Optional: submit `https://your-site/sitemap.xml` in Google Search Console.

## Later: your own domain
Vercel → Project → Settings → Domains → add it and follow the DNS instructions, then update `NEXT_PUBLIC_SITE_URL`,
Render `FRONTEND_URL` / `CORS_ORIGINS` and the Site URL in Website settings.
