import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { decideSuggestion } from "@/lib/curriculum/vorschlaege";

export const runtime = "nodejs";

const idSchema = z.string().uuid();
const bodySchema = z.object({
  aktion: z.enum(["akzeptieren", "ablehnen", "zuruecksetzen"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; vid: string }> },
) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, vid } = await context.params;
  const dok = idSchema.safeParse(id);
  const vorschlag = idSchema.safeParse(vid);
  if (!dok.success || !vorschlag.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const json = await request.json().catch(() => null);
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: body.error.issues },
      { status: 400 },
    );
  }
  const result = await decideSuggestion({
    dokumentId: dok.data,
    vorschlagId: vorschlag.data,
    ownerId: user.id,
    aktion: body.data.aktion,
  });
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
