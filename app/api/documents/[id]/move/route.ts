import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { moveDocument } from "@/lib/workspace/repository";

const idSchema = z.string().uuid();

const bodySchema = z.object({
  parentId: z.string().uuid().nullable(),
  position: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const idResult = idSchema.safeParse(id);
  if (!idResult.success) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const moved = await moveDocument({
    id: idResult.data,
    ownerId: user.id,
    parentId: parsed.data.parentId,
    position: parsed.data.position,
  });
  if (!moved) return NextResponse.json({ error: "invalid_move" }, { status: 400 });
  return NextResponse.json({ document: moved });
}
