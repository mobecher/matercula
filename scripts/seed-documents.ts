import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";
import { documents } from "@/lib/db/schema/documents";
import { documentTree } from "@/lib/workspace/mock-data";
import type { DocumentNode } from "@/lib/workspace/types";

async function seedForUser(email: string) {
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!userRow) {
    console.warn(`User ${email} not found – skipping.`);
    return;
  }

  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.ownerId, userRow.id))
    .limit(1);
  if (existing) {
    console.log(`Documents for ${email} already exist – skipping.`);
    return;
  }

  async function insertNode(
    node: DocumentNode,
    parentId: string | null,
    sortOrder: number,
  ) {
    const [inserted] = await db
      .insert(documents)
      .values({
        ownerId: userRow.id,
        parentId,
        type: node.type,
        title: node.title,
        icon: node.icon ?? null,
        contentMarkdown: node.content ?? null,
        sortOrder,
      })
      .returning({ id: documents.id });

    if (node.children) {
      let i = 0;
      for (const child of node.children) {
        await insertNode(child, inserted.id, (i + 1) * 1000);
        i += 1;
      }
    }
  }

  let i = 0;
  for (const root of documentTree) {
    await insertNode(root, null, (i + 1) * 1000);
    i += 1;
  }

  console.log(`Seed documents for ${email} created.`);
}

async function main() {
  await seedForUser("admin@example.com");
  await seedForUser("teacher@example.com");
  await sqlClient.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
