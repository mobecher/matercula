import { z } from "zod";

export const runtime = "nodejs";

const magicLinkSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const input = magicLinkSchema.safeParse(body);

  if (!input.success) {
    return Response.json({ ok: false, message: "Ungültige Anfrage" }, { status: 400 });
  }

  return Response.json({
    ok: true,
    message: "Magic-Link Versand ist vorbereitet und wird in einem Folgeschritt aktiviert.",
  });
}
