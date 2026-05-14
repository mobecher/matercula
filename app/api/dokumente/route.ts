import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { erstelleDokument, ladeDokumentBaumFuerBenutzer } from "@/lib/workspace/repository";

const erstelleSchema = z
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

  const baum = await ladeDokumentBaumFuerBenutzer(user.id);
  return NextResponse.json({ baum });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const ergebnis = erstelleSchema.safeParse(json);
  if (!ergebnis.success) {
    return NextResponse.json({ error: "invalid_input", issues: ergebnis.error.issues }, { status: 400 });
  }

  const dokument = await erstelleDokument({
    ownerId: user.id,
    parentId: ergebnis.data.parentId ?? null,
    typ: ergebnis.data.typ,
    titel: ergebnis.data.titel,
    icon: ergebnis.data.icon ?? null,
    inhaltMarkdown: ergebnis.data.inhaltMarkdown ?? null,
    materialId: ergebnis.data.materialId ?? null,
  });

  if (!dokument) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  return NextResponse.json({ dokument }, { status: 201 });
}
