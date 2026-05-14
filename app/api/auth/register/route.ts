import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";
import { hashPassword } from "@/lib/security/password";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
});

const baseUrl = () => process.env.AUTH_BASE_URL ?? "http://localhost:3000";

const redirectWithError = (code: string) =>
  NextResponse.redirect(new URL(`/register?error=${code}`, baseUrl()), 303);

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());
  const input = registerSchema.safeParse(body);

  if (!input.success) {
    if (!isJson) {
      return redirectWithError("invalid");
    }
    return Response.json({ ok: false, message: "Ungültige Anfrage" }, { status: 400 });
  }

  const email = input.data.email.toLowerCase().trim();

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    if (!isJson) {
      return redirectWithError("exists");
    }
    return Response.json({ ok: false, message: "E-Mail bereits registriert" }, { status: 409 });
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: input.data.name.trim(),
      passwordHash: hashPassword(input.data.password),
      isAdmin: false,
    })
    .returning();

  if (!user) {
    if (!isJson) {
      return redirectWithError("server");
    }
    return Response.json({ ok: false, message: "Registrierung fehlgeschlagen" }, { status: 500 });
  }

  const session = await createSession(user.id);

  const response = isJson
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(new URL("/dashboard", baseUrl()), 303);

  response.cookies.set("matercula_session", session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
