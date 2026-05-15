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
    type: z.enum(["folder", "page", "file"]),
    title: z.string().min(1).max(200),
    icon: z.string().max(8).nullable().optional(),
    contentMarkdown: z.string().nullable().optional(),
    materialId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.type !== "file" || !!value.materialId, {
    message: "materialId required for pdf documents",
    path: ["materialId"],
  });

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tree = await loadDocumentTreeForUser(user.id);
  return NextResponse.json({ tree });
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
    type: result.data.type,
    title: result.data.title,
    icon: result.data.icon ?? null,
    contentMarkdown: result.data.contentMarkdown ?? null,
    materialId: result.data.materialId ?? null,
  });

  if (!dokument) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  return NextResponse.json({ dokument }, { status: 201 });
}
