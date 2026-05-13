import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await deleteSession(sessionId);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);

  return Response.redirect(
    new URL("/login", process.env.AUTH_BASE_URL ?? "http://localhost:3000"),
    303,
  );
}
