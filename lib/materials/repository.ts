import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type Material, materialien } from "@/lib/db/schema/materials";

interface CreateMaterialInput {
  ownerId: string;
  titel: string;
  dateiname: string;
  mimeType: string;
  storageKey: string;
}

export async function createMaterial(
  input: CreateMaterialInput,
): Promise<Material> {
  const [erstellt] = await db
    .insert(materialien)
    .values({
      ownerId: input.ownerId,
      titel: input.titel,
      dateiname: input.dateiname,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      // Newly-uploaded materials enter the tagging pipeline immediately;
      // the worker transitions status to `processing` → `ready`/`error`.
      status: "uploaded",
    })
    .returning();
  return erstellt;
}

export async function loadMaterial(
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

export async function deleteMaterial(
  id: string,
  ownerId: string,
): Promise<Material | undefined> {
  const [geloescht] = await db
    .delete(materialien)
    .where(and(eq(materialien.id, id), eq(materialien.ownerId, ownerId)))
    .returning();
  return geloescht;
}

export async function listMaterialsForUser(
  ownerId: string,
): Promise<Material[]> {
  return db
    .select()
    .from(materialien)
    .where(eq(materialien.ownerId, ownerId))
    .orderBy(desc(materialien.createdAt));
}
