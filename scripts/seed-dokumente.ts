import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";
import { documents } from "@/lib/db/schema/documents";
import { documentTree } from "@/lib/workspace/mock-data";
import type { DocumentNode } from "@/lib/workspace/types";

async function seedForUser(email: string) {
  const [benutzer] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!benutzer) {
    console.warn(`Benutzer ${email} nicht gefunden – wird übersprungen.`);
    return;
  }

  const [bestehend] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.ownerId, benutzer.id))
    .limit(1);
  if (bestehend) {
    console.log(`Dokumente für ${email} existieren bereits – übersprungen.`);
    return;
  }

  async function insertKnoten(
    knoten: DocumentNode,
    parentId: string | null,
    sortOrder: number,
  ) {
    const [eingefuegt] = await db
      .insert(documents)
      .values({
        ownerId: benutzer.id,
        parentId,
        type: knoten.type,
        title: knoten.title,
        icon: knoten.icon ?? null,
        contentMarkdown: knoten.inhalt ?? null,
        sortOrder,
      })
      .returning({ id: documents.id });

    if (knoten.children) {
      let i = 0;
      for (const kind of knoten.children) {
        await insertKnoten(kind, eingefuegt.id, (i + 1) * 1000);
        i += 1;
      }
    }
  }

  let i = 0;
  for (const wurzel of documentTree) {
    await insertKnoten(wurzel, null, (i + 1) * 1000);
    i += 1;
  }

  console.log(`Seed-Dokumente für ${email} erstellt.`);
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
