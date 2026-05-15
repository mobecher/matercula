import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import {
  createDocument,
  loadDocumentTreeForUser,
} from "@/lib/workspace/repository";

const createSchema = z
  .object({
    parentId: z.string().uuid().nullable().optional(),
    typ: z.enum(["ordner", "seite", "pdf"]),
    titel: z.string().min(1).max(200),
    icon: z.string().max(8).nullable().optional(),
    inhaltMarkdown: z.string().nullable().optional(),
    materialId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.typ !== "pdf" || !!value.materialId, {
    message: "materialId required for pdf documents",
    path: ["materialId"],
  });

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const baum = await loadDocumentTreeForUser(user.id);
  return NextResponse.json({ baum });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const result = createSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: result.error.issues },
      { status: 400 },
    );
  }

  const dokument = await createDocument({
    ownerId: user.id,
    parentId: result.data.parentId ?? null,
    typ: result.data.typ,
    titel: result.data.titel,
    icon: result.data.icon ?? null,
    inhaltMarkdown: result.data.inhaltMarkdown ?? null,
    materialId: result.data.materialId ?? null,
  });

  if (!dokument) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  return NextResponse.json({ dokument }, { status: 201 });
}
