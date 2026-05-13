import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";
import { hashPassword } from "@/lib/security/password";

const upsertUser = async (email: string, password: string, name: string, isAdmin = false) => {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    return;
  }

  await db.insert(users).values({
    email,
    name,
    isAdmin,
    passwordHash: hashPassword(password),
  });
};

async function main() {
  await upsertUser("admin@example.com", "admin", "Admin", true);
  await upsertUser("teacher@example.com", "teacher", "Teacher", false);
  await sqlClient.end();
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
