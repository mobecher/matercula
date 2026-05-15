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
3. Der `extractor`-Service läuft intern auf Port 8000 und ist **bewusst
   nicht** auf den Host gemappt. Erreichbar nur für `app` und `worker`
   über `http://extractor:8000`.

## Fly.io (drei Apps)

Wir deployen drei separate Fly-Apps, alle in der Region `fra`:

| App                    | Zweck                                  | Konfig                |
|------------------------|----------------------------------------|-----------------------|
| `matercula`            | Next.js Web-App                        | `fly.toml`            |
| `matercula-worker`     | pg-boss Worker (Tagging-Pipeline)      | `fly.worker.toml`     |
| `matercula-extractor`  | PDF/DOCX Extraktion (Python, internal) | `services/extractor/fly.toml` |

### Deploy-Reihenfolge

Der Extractor zuerst — der Worker ist über sein Health-Check und die
Service-Adresse von ihm abhängig.

```bash
# 1. Extractor zuerst (kein Public-IP nötig; nutzt nur 6PN).
#    Wichtig: aus dem Service-Verzeichnis deployen, damit der
#    Docker-Build-Context `services/extractor/` ist (Dockerfile macht
#    `COPY pyproject.toml ./`).
(cd services/extractor && fly deploy --remote-only)

# 2. Worker (liest EXTRACTOR_URL aus fly.worker.toml).
fly deploy -c fly.worker.toml

# 3. Web-App.
fly deploy -c fly.toml
```

### Networking

`matercula-extractor` hat **keine Public IP** und keinen
`[http_service]`-Block — ausschließlich erreichbar über
`http://matercula-extractor.internal:8000` aus anderen Fly-Apps der
Organisation. So beim ersten Anlegen sicherstellen:

```bash
fly apps create matercula-extractor
# KEINE IP allokieren. Falls bereits eine vergeben wurde:
fly ips list -a matercula-extractor
fly ips release <ip> -a matercula-extractor
```

### Secrets

Pro App nur die nötigen Secrets setzen — siehe `.env.example`. Der
Extractor benötigt keinerlei Secrets; der Worker braucht `DATABASE_URL`,
`S3_*`. Web-App braucht zusätzlich `AUTH_*`, AI-Provider-Keys.

### Automatische Deploys via GitHub Actions

`.github/workflows/deploy.yml` deployt bei jedem Push auf `main`
automatisch nur die Apps, deren Quellen sich geändert haben
(extractor → worker → web, in dieser Reihenfolge).

**Setup (einmalig):**

```bash
# Org-weiten Deploy-Token erstellen (gilt für alle drei Apps).
fly tokens create org
```

Den Token-Wert als GitHub-Secret `FLY_API_TOKEN` im Repo hinterlegen
(`Settings → Secrets and variables → Actions → New repository secret`).

**Manueller Trigger:** Im Actions-Tab den `Deploy`-Workflow per
"Run workflow" starten und unter `target` `all` oder einen einzelnen
App-Namen wählen.
