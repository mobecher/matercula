import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { enqueueTagMaterial } from "@/lib/jobs/queue";
import { createMaterial } from "@/lib/materials/repository";
import { uploadFile } from "@/lib/storage/s3";

// Direktupload aus dem BlockNote-Editor. Erwartet `multipart/form-data`
// mit Feld `file`. Antwortet mit `{ url, name, contentType, size }` –
// kompatibel zu BlockNotes `uploadFile`-Hook.
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Mirror of `SUPPORTED_MIME_TYPES` in lib/extraction/client.ts and
// `SUPPORTED_MIMES` in services/extractor/app/extraction.py. Keep in sync.
const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/epub+zip",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "text/html",
  "application/xml",
  "text/xml",
  "text/x-rst",
  "text/x-org",
  "message/rfc822",
  "application/vnd.ms-outlook",
  "application/pkcs7-signature",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/heic",
]);

function sanitizeFilename(name: string): string {
  // Reduce to the basename and strip critical characters.
  const base = name.split(/[\\/]/).pop() ?? "datei";
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200) || "datei";
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "expected_multipart" }, { status: 415 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", maxBytes: MAX_BYTES },
      { status: 413 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "unsupported_mime_type", mimeType },
      { status: 415 },
    );
  }

  const id = randomUUID();
  const fileName = sanitizeFilename(file.name);
  const storageKey = `materials/${user.id}/${id}/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, mimeType);

  const material = await createMaterial({
    ownerId: user.id,
    title: fileName,
    fileName,
    mimeType,
    storageKey,
  });

  // Ordering matters: enqueue ONLY after the materialien row is committed.
  // `createMaterial` awaits its insert, so the row is durable here. If we
  // enqueued earlier (or inside an open transaction) the worker could pick
  // up the job and query for a row that doesn't exist yet.
  // Best-effort: failure to enqueue should not break the upload itself —
  // the row remains `uploaded` and a future re-trigger can pick it up.
  try {
    await enqueueTagMaterial({ materialId: material.id });
  } catch (err) {
    console.error("[materialien] enqueue tagMaterial failed", err);
  }

  // Stabile interne URL → leitet beim Aufruf auf eine frische Signed-URL um.
  const url = `/api/materialien/${material.id}/download`;

  return NextResponse.json(
    {
      id: material.id,
      url,
      name: material.fileName,
      contentType: material.mimeType,
      size: file.size,
    },
    { status: 201 },
  );
}
