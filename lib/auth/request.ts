import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE_NAME } from "./session";

export async function getRequestUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return getSessionUser(sessionId);
}
