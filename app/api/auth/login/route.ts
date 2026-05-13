import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";
import { verifyPassword } from "@/lib/security/password";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());
  const input = loginSchema.safeParse(body);

  if (!input.success) {
    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(
        new URL("/login?error=1", process.env.AUTH_BASE_URL ?? "http://localhost:3000"),
        303,
      );
    }
    return Response.json({ ok: false, message: "Ungültige Anfrage" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, input.data.email)).limit(1);

  if (!user || !verifyPassword(input.data.password, user.passwordHash)) {
    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(
        new URL("/login?error=1", process.env.AUTH_BASE_URL ?? "http://localhost:3000"),
        303,
      );
    }
    return Response.json({ ok: false, message: "Ungültige Anmeldedaten" }, { status: 401 });
  }

  const session = await createSession(user.id);

  const response = contentType.includes("application/json")
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(
        new URL("/dashboard", process.env.AUTH_BASE_URL ?? "http://localhost:3000"),
        303,
      );
  response.cookies.set("matercula_session", session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
