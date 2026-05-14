import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { erstelleMaterial } from "@/lib/materials/repository";
import { uploadFile } from "@/lib/storage/s3";

// Direktupload aus dem BlockNote-Editor. Erwartet `multipart/form-data`
// mit Feld `file`. Antwortet mit `{ url, name, contentType, size }` –
// kompatibel zu BlockNotes `uploadFile`-Hook.
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ERLAUBTE_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

function bereinigeDateiname(name: string): string {
  // Auf Basisnamen reduzieren und kritische Zeichen entfernen.
  const basis = name.split(/[\\/]/).pop() ?? "datei";
  return basis.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200) || "datei";
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected_multipart" },
      { status: 415 },
    );
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
  if (!ERLAUBTE_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "unsupported_mime_type", mimeType },
      { status: 415 },
    );
  }

  const id = randomUUID();
  const dateiname = bereinigeDateiname(file.name);
  const storageKey = `materials/${user.id}/${id}/${dateiname}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, mimeType);

  const material = await erstelleMaterial({
    ownerId: user.id,
    titel: dateiname,
    dateiname,
    mimeType,
    storageKey,
  });

  // Stabile interne URL → leitet beim Aufruf auf eine frische Signed-URL um.
  const url = `/api/materialien/${material.id}/download`;

  return NextResponse.json(
    {
      id: material.id,
      url,
      name: material.dateiname,
      contentType: material.mimeType,
      size: file.size,
    },
    { status: 201 },
  );
}
