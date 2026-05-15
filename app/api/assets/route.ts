import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { documentAssets } from "@/lib/db/schema";
import { uploadFile } from "@/lib/storage/s3";

// Upload endpoint for inline document assets (images, video, audio).
// Used by the BlockNote editor's `uploadFile` hook. Returns a stable
// internal URL that 302-redirects to a short-lived S3 signed URL.
//
// Distinct from `/api/materialien` on purpose: assets are not extracted,
// chunked, embedded, or tagged – they are plain attachments embedded in
// document content.
export const runtime = "nodejs";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB – generous to allow short videos.

// Allowed MIME types for inline media. Images, HTML5 video, HTML5 audio.
const ALLOWED_MIME_TYPES = new Set<string>([
  // images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/avif",
  // video (HTML5 <video> compatible)
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  // audio (HTML5 <audio> compatible)
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
]);

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "datei";
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200) || "datei";
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "unsupported_mime_type", mimeType }, { status: 415 });
  }

  const id = randomUUID();
  const fileName = sanitizeFilename(file.name);
  const storageKey = `assets/${user.id}/${id}/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, mimeType);

  const [asset] = await db
    .insert(documentAssets)
    .values({
      id,
      ownerId: user.id,
      fileName,
      mimeType,
      storageKey,
      size: file.size,
    })
    .returning();

  // Stable internal URL → redirects to a fresh signed URL on access.
  const url = `/api/assets/${asset.id}`;

  return NextResponse.json(
    {
      id: asset.id,
      url,
      name: asset.fileName,
      contentType: asset.mimeType,
      size: file.size,
    },
    { status: 201 },
  );
}
