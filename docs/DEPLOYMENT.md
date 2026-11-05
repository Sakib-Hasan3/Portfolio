# Deployment guide

Two supported setups. Both use the same images and environment variables.

| | Option A: Vercel + VPS | Option B: everything on one VPS |
|---|---|---|
| Frontend | Vercel | Docker (`web`) behind Caddy |
| Backend + DB | VPS (Docker) | Docker (`api`, `db`) |
| TLS | Vercel + Caddy | Caddy (automatic Let's Encrypt) |
| Good for | Fast global edge, free tier | One bill, full control |

Before either: create a Cloudinary account (free tier is plenty) and copy its `CLOUDINARY_URL`. Local disk storage
works too, but uploads then live in a Docker volume you must back up.

Generate secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"   # SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"   # REVALIDATE_SECRET
```

---

## 1. Backend on a VPS (both options)

Any Ubuntu 22.04+/Debian 12 VPS with 1 GB RAM works (Hetzner, DigitalOcean, Lightsail…).

```bash
# on the server
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/Sakib-Hasan3/<your-repo>.git portfolio && cd portfolio
cp .env.example .env && nano .env
```

Set in `.env`:

```dotenv
ENVIRONMENT=production
POSTGRES_PASSWORD=<strong password>
SECRET_KEY=<64+ random chars>
REVALIDATE_SECRET=<random>
PUBLIC_SITE_URL=https://your-domain.com
COOKIE_SECURE=true
STORAGE_BACKEND=cloudinary
CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>
ADMIN_EMAIL=sakibnghs123@gmail.com
ADMIN_PASSWORD=<temporary strong password>     # remove after first start
SEED_ON_START=true                             # first deploy only
SITE_DOMAIN=your-domain.com                    # option B
API_DOMAIN=api.your-domain.com
# optional e-mail alerts for contact messages
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@gmail.com
SMTP_PASSWORD=<app password>
SMTP_FROM=you@gmail.com
NOTIFY_EMAIL=sakibnghs123@gmail.com
```

Point DNS `A` records for `API_DOMAIN` (and `SITE_DOMAIN` for option B) at the server, then:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose logs -f api        # watch migrations + seed + "bootstrap admin account created"
```

Afterwards remove `ADMIN_PASSWORD` and set `SEED_ON_START=false` in `.env`, then `docker compose ... up -d` again.

For **option A only**, you can drop the `web` service: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db api caddy`
(and remove the `{$SITE_DOMAIN}` block from `deploy/Caddyfile`). In that case also add `FRONTEND_URL=https://your-domain.com`
to `.env` so the revalidation webhook reaches Vercel.

### Database initialisation and migrations

- Migrations run automatically on every API start (`alembic upgrade head` in `docker-entrypoint.sh`).
- Manual: `docker compose exec api alembic upgrade head` / `alembic downgrade -1`.
- New migration after changing models: `alembic revision --autogenerate -m "describe change"` (review the file).
- Seed initial content: `docker compose exec api python -m app.scripts.seed` (only fills empty tables).

### Backups

```bash
docker compose exec -T db pg_dump -U portfolio portfolio | gzip > backup-$(date +%F).sql.gz
gunzip -c backup.sql.gz | docker compose exec -T db psql -U portfolio portfolio    # restore
```

With local storage, also back up the `uploads` volume.

## 2. Frontend on Vercel (option A)

1. Import the repo in Vercel and set **Root Directory** to `frontend` (framework is detected as Next.js).
2. Environment variables:
   - `API_INTERNAL_URL` = `https://api.your-domain.com`
   - `NEXT_PUBLIC_SITE_URL` = `https://your-domain.com`
   - `REVALIDATE_SECRET` = same value as the API
3. Deploy, add your domain, and set the same URL under Dashboard → Website settings → Public site URL.

Because the browser talks only to the Vercel origin (which proxies `/api/v1` and `/uploads`), admin cookies are
first-party and no CORS configuration is needed.

## 3. CI/CD

`.github/workflows/ci.yml` runs on every push and PR: backend lint + tests against PostgreSQL + a migration
round-trip, frontend typecheck + lint + build, and Docker image builds. Vercel deploys the frontend on its own.

To deploy the backend automatically on pushes to `main`, set repository variable `DEPLOY_BACKEND=true` and secrets
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_DIR`.

## 4. Post-deploy checklist

- [ ] `https://api.your-domain.com/health` returns `{"status":"ok"}`
- [ ] Sign in at `/admin`, change the temporary password under Account & security
- [ ] Website settings: public site URL, analytics (optional)
- [ ] Upload a project thumbnail and confirm it appears on the site
- [ ] Send a test message through the contact form and find it in Messages
- [ ] `https://your-domain.com/sitemap.xml` lists your projects; submit it in Google Search Console

## Troubleshooting

| Symptom | Check |
|---|---|
| Edits don't appear on the site | `REVALIDATE_SECRET` must match on both sides; API logs show `revalidated tags …` or the error. `FRONTEND_URL` must be reachable from the API. |
| Signed out immediately / 403 "CSRF" | In production `COOKIE_SECURE=true` requires HTTPS; make sure you browse via `https://`. |
| Uploads fail with 413 | Increase `MAX_IMAGE_SIZE_MB` / `MAX_PDF_SIZE_MB` and Caddy's `request_body max_size`. |
| "This page couldn't load its content" | The frontend can't reach `API_INTERNAL_URL`. |
| API won't start in production | It refuses default `SECRET_KEY` / `REVALIDATE_SECRET` values by design. |
