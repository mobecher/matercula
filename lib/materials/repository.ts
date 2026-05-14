import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materialien, type Material } from "@/lib/db/schema/materials";

interface ErstelleMaterialEingabe {
  ownerId: string;
  titel: string;
  dateiname: string;
  mimeType: string;
  storageKey: string;
}

export async function erstelleMaterial(
  eingabe: ErstelleMaterialEingabe,
): Promise<Material> {
  const [erstellt] = await db
    .insert(materialien)
    .values({
      ownerId: eingabe.ownerId,
      titel: eingabe.titel,
      dateiname: eingabe.dateiname,
      mimeType: eingabe.mimeType,
      storageKey: eingabe.storageKey,
      // Direktupload ohne KI-Pipeline gilt sofort als verfügbar.
      status: "ready",
    })
    .returning();
  return erstellt;
}

export async function ladeMaterial(
  id: string,
  ownerId: string,
): Promise<Material | undefined> {
  const [zeile] = await db
    .select()
    .from(materialien)
    .where(and(eq(materialien.id, id), eq(materialien.ownerId, ownerId)))
    .limit(1);
  return zeile;
}

export async function loescheMaterial(
  id: string,
  ownerId: string,
): Promise<Material | undefined> {
  const [geloescht] = await db
    .delete(materialien)
    .where(and(eq(materialien.id, id), eq(materialien.ownerId, ownerId)))
    .returning();
  return geloescht;
}

export async function listeMaterialienFuerBenutzer(
  ownerId: string,
): Promise<Material[]> {
  return db
    .select()
    .from(materialien)
    .where(eq(materialien.ownerId, ownerId))
    .orderBy(desc(materialien.createdAt));
}
