import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { updateDocument, deleteDocument } from "@/lib/workspace/repository";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  icon: z.string().max(8).nullable().optional(),
  contentMarkdown: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().finite().optional(),
});

const idSchema = z.string().uuid();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const idResult = idSchema.safeParse(id);
  if (!idResult.success)
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await request.json().catch(() => null);
  const result = patchSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: result.error.issues },
      { status: 400 },
    );
  }

  if (result.data.parentId === idResult.data) {
    return NextResponse.json({ error: "self_parent" }, { status: 400 });
  }

  const updated = await updateDocument({
    id: idResult.data,
    ownerId: user.id,
    ...result.data,
  });
  if (!updated)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ document: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const idResult = idSchema.safeParse(id);
  if (!idResult.success)
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const ok = await deleteDocument(idResult.data, user.id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
