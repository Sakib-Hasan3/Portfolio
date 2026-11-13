#!/usr/bin/env bash
# Asks a few questions and writes render-env/api.env and render-env/web.env (git-ignored).
set -e
mkdir -p render-env && chmod 700 render-env

echo "Proshno 1/4: Notun Groq API key paste korun (screen e dekha jabe na), tarpor Enter:"
read -rs GKEY; echo
echo "Proshno 2/4: Neon database er password paste korun (dekha jabe na), tarpor Enter:"
read -rs NEONPW; echo
echo "Proshno 3/4: Cloudinary API Key paste korun, tarpor Enter:"
read -r CKEY
echo "Proshno 4/4: Cloudinary API Secret paste korun (dekha jabe na), tarpor Enter:"
read -rs CSEC; echo

SK=$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")
RS=$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")

cat > render-env/api.env <<EOT
DATABASE_URL=postgresql://neondb_owner:${NEONPW}@ep-round-glitter-a11rriy0.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
CLOUDINARY_URL=cloudinary://${CKEY}:${CSEC}@y7or3fps
SECRET_KEY=${SK}
REVALIDATE_SECRET=${RS}
GROQ_API_KEY=${GKEY}
FRONTEND_URL=https://example.com
CORS_ORIGINS=["https://example.com"]
EOT

cat > render-env/web.env <<EOT
API_INTERNAL_URL=https://example.com
REVALIDATE_SECRET=${RS}
NEXT_PUBLIC_SITE_URL=https://example.com
EOT

chmod 600 render-env/*.env
echo
echo "Hoye geche! Duto file toiri hoyeche:"
ls render-env
