# CLAUDE.md

> **Language policy for this repository:** All code, comments, commit
> messages, documentation, and agent responses MUST be written in **English**.
> The only exceptions are the German domain terms listed in the glossary
> below and user-facing UI strings (which are German). Do not translate
> glossary terms into English in code, schema, or docs — and do not write
> the rest of the codebase in German.

## Domain glossary

These terms stay in German everywhere (code identifiers, DB columns, API
payloads, internal docs):

- **Lehrplan**: Official curricular framework; stored in `lehrplan_versionen`.
- **Kompetenzbereich**: Thematic group of competences; stored in
  `kompetenzbereiche`.
- **Kompetenz**: Individual learning-objective unit; stored in `kompetenzen`.
- **Deskriptor**: Concrete refinement of a `Kompetenz`; stored in
  `deskriptoren`.
- **Schulstufe**: Target grade level in the school system; field `schulstufe`
  in `lehrplan_versionen`.
- **Material**: Teaching material and its chunks; stored in `materialien` and
  `material_chunks`.
- **Tag**: Link between `Material` and `Kompetenz`, including the AI
  rationale; stored in `material_kompetenz_links`.

## Naming convention

- Use **German** for domain terms in code and DB columns (`kompetenzen`,
  `titel`, `schuljahr`).
- Use **English** for technical concerns (`createdAt`, `ownerId`, `status`).
- UI strings are in **German**.
- Everything else — code, comments, internal docs, PR descriptions, agent
  responses — is in **English**.

## Architectural rules

- Never use the Vercel Edge Runtime.
- Do not use Vercel-specific data products (KV/Postgres/Blob); only use the
  abstractions under `lib/`.
- All API routes validate input with Zod.
- Database access goes only through Drizzle; raw SQL is only allowed in
  migrations.
- AI calls go exclusively through `lib/ai/providers.ts`.

## How to add a feature

1. Add the schema in `lib/db/schema/`.
2. Generate a migration (`pnpm db:generate`) and apply it (`pnpm db:migrate`).
3. Add an API route with Zod validation under `app/api/`.
4. Add the UI in the App Router (`app/`).
5. Add a matching Playwright smoke test in `tests/`.

## What's intentionally NOT built yet

- AI tagging pipeline (steps 2 & 3 of `tagMaterial`: embeddings, LLM tagging)
- Markdown editor
- Mature page-reference workflows

## Extractor service

- The only Python part of the stack: Python 3.12 + FastAPI + `unstructured`,
  located in `/services/extractor/`.
- The Node worker calls the service over HTTP via `lib/extraction/client.ts`.
  **Never extract inline in the worker** — the service boundary is
  intentional.
- **Internal-only**: no host port in Compose, no public IP on Fly. On Fly the
  service runs only on the private network (`.internal`). The security model
  is network isolation, hence no auth.
- **Canonical chunk shape** (contract, mirrored in
  `lib/extraction/client.ts`):
  `chunkIndex`, `text`, `seitenzahl`, `abschnitt` plus `meta.summary`.
  These field names are mandatory — embedding and tagging downstream depend
  on them. Changing the shape means changing the whole pipeline.
- **Only PDF emits real page numbers.** For all other formats (DOCX, PPTX,
  HTML, email, images, …), `seitenzahl` and `meta.pageCount` are `null` by
  design. Do not "fix" this.
- Scanned-PDF OCR is intentionally not supported (`strategy="fast"` for
  PDFs). Image OCR (`.png`/`.jpeg`/…) is enabled — there OCR is the only
  way to get any text at all.
- Supported MIMEs: see `services/extractor/app/extraction.py`
  (`SUPPORTED_MIMES`) and the mirror in `lib/extraction/client.ts`. When
  extending, keep both lists plus the allow-list in
  `app/api/materialien/route.ts` in sync.

## Common pitfalls

- Do not translate `Kompetenz` to `Competence` in code.
- Do not add another ORM next to Drizzle.
- Do not introduce state managers (prefer React Server Components + URL
  state).
- Code is always in English except for the domain terms listed in the
  glossary.
- Do not respond to prompts in German and do not write documentation in
  German — English only, with German reserved for glossary terms and UI
  strings.
