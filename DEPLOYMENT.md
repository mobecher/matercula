# Deployment

## Vercel
1. Repository importieren.
2. Alle Variablen aus `.env.example` im Vercel Dashboard setzen.
3. Build Command: `pnpm build`
4. Start Command: `pnpm start`
5. Postgres (mit pgvector) und S3-kompatiblen Storage extern bereitstellen.

## Self-hosted mit Docker Compose
1. `docker compose up --build`
2. App läuft auf `:3000`, Postgres auf `:5432`, MinIO auf `:9000` (Console `:9001`).
