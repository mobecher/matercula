import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import {
  loadDocumentsForAnwendungsbereich,
  deleteAnwendungsbereichLink,
  linkAnwendungsbereich,
} from "@/lib/curriculum/links";

const linkSchema = z.object({
  documentId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

const deleteSchema = z.object({
  documentId: z.string().uuid(),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const documents = await loadDocumentsForAnwendungsbereich(id, user.id);
  return NextResponse.json({ documents });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const result = linkSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: result.error.issues },
      { status: 400 },
    );
  }
  const ok = await linkAnwendungsbereich({
    documentId: result.data.documentId,
    anwendungsbereichId: id,
    ownerId: user.id,
    note: result.data.note ?? null,
  });
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const result = deleteSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: result.error.issues },
      { status: 400 },
    );
  }
  const ok = await deleteAnwendungsbereichLink({
    documentId: result.data.documentId,
    anwendungsbereichId: id,
    ownerId: user.id,
  });
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
