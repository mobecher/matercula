# Lehrplan-Tagger

## Run locally with Docker

```bash
docker compose up --build
```

Danach ist die App unter http://localhost:3000 erreichbar.

## Develop

```bash
cp .env.example .env.local
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm seed
pnpm dev
```

Login-Testnutzer:
- `admin@example.com` / `admin`
- `teacher@example.com` / `teacher`

## Deploy to Vercel

Siehe [DEPLOYMENT.md](./DEPLOYMENT.md).
