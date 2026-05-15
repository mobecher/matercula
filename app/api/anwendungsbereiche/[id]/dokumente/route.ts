import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import {
  loadDocumentsForAnwendungsbereich,
  deleteAnwendungsbereichLink,
  linkAnwendungsbereich,
} from "@/lib/curriculum/links";

const linkSchema = z.object({
  dokumentId: z.string().uuid(),
  notiz: z.string().max(500).optional(),
});

const deleteSchema = z.object({
  dokumentId: z.string().uuid(),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const dokumente = await loadDocumentsForAnwendungsbereich(id, user.id);
  return NextResponse.json({ dokumente });
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
    dokumentId: result.data.dokumentId,
    anwendungsbereichId: id,
    ownerId: user.id,
    notiz: result.data.notiz ?? null,
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
    dokumentId: result.data.dokumentId,
    anwendungsbereichId: id,
    ownerId: user.id,
  });
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
