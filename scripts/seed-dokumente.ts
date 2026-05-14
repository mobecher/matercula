import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";
import { dokumente } from "@/lib/db/schema/dokumente";
import { dokumentBaum } from "@/lib/workspace/mock-data";
import type { DokumentKnoten } from "@/lib/workspace/types";

async function seedFuerBenutzer(email: string) {
  const [benutzer] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!benutzer) {
    console.warn(`Benutzer ${email} nicht gefunden – wird übersprungen.`);
    return;
  }

  const [bestehend] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(eq(dokumente.ownerId, benutzer.id))
    .limit(1);
  if (bestehend) {
    console.log(`Dokumente für ${email} existieren bereits – übersprungen.`);
    return;
  }

  async function insertKnoten(knoten: DokumentKnoten, parentId: string | null, sortierung: number) {
    const [eingefuegt] = await db
      .insert(dokumente)
      .values({
        ownerId: benutzer.id,
        parentId,
        typ: knoten.typ,
        titel: knoten.titel,
        icon: knoten.icon ?? null,
        inhaltMarkdown: knoten.inhalt ?? null,
        sortierung,
      })
      .returning({ id: dokumente.id });

    if (knoten.children) {
      let i = 0;
      for (const kind of knoten.children) {
        await insertKnoten(kind, eingefuegt.id, (i + 1) * 1000);
        i += 1;
      }
    }
  }

  let i = 0;
  for (const wurzel of dokumentBaum) {
    await insertKnoten(wurzel, null, (i + 1) * 1000);
    i += 1;
  }

  console.log(`Seed-Dokumente für ${email} erstellt.`);
}

async function main() {
  await seedFuerBenutzer("admin@example.com");
  await seedFuerBenutzer("teacher@example.com");
  await sqlClient.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
