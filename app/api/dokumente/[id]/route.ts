import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { aktualisiereDokument, loescheDokument } from "@/lib/workspace/repository";

const patchSchema = z.object({
  titel: z.string().min(1).max(200).optional(),
  icon: z.string().max(8).nullable().optional(),
  inhaltMarkdown: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortierung: z.number().finite().optional(),
});

const idSchema = z.string().uuid();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const idErgebnis = idSchema.safeParse(id);
  if (!idErgebnis.success) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await request.json().catch(() => null);
  const ergebnis = patchSchema.safeParse(json);
  if (!ergebnis.success) {
    return NextResponse.json({ error: "invalid_input", issues: ergebnis.error.issues }, { status: 400 });
  }

  if (ergebnis.data.parentId === idErgebnis.data) {
    return NextResponse.json({ error: "self_parent" }, { status: 400 });
  }

  const aktualisiert = await aktualisiereDokument({
    id: idErgebnis.data,
    ownerId: user.id,
    ...ergebnis.data,
  });
  if (!aktualisiert) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ dokument: aktualisiert });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const idErgebnis = idSchema.safeParse(id);
  if (!idErgebnis.success) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const ok = await loescheDokument(idErgebnis.data, user.id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
