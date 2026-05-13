import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema/auth";
import { addDays } from "./time";

export const SESSION_COOKIE_NAME = "matercula_session";

export const createSession = async (userId: string) => {
  const expiresAt = addDays(new Date(), 7);
  const [session] = await db.insert(sessions).values({ userId, expiresAt }).returning();
  return session;
};

export const getSessionUser = async (sessionId: string) => {
  const rows = await db
    .select({
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0]?.user ?? null;
};

export const deleteSession = async (sessionId: string) => {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
};
