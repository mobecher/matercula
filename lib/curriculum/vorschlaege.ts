import { generateObject, type LanguageModel } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { type BenutzerAiSchluessel, FehlenderProviderSchluessel, getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { dokumente } from "@/lib/db/schema/dokumente";
import {
  anwendungsbereiche,
  kompetenzbereiche,
  kompetenzen,
  lehrplaene,
  lehrplanKlassen,
} from "@/lib/db/schema/lehrplan";
import {
  type DokumentLinkVorschlag,
  dokumentAnwendungsbereichLinks,
  dokumentKompetenzLinks,
  dokumentLinkVorschlaege,
} from "@/lib/db/schema/links";
import { materialChunks, materialien } from "@/lib/db/schema/materials";

export interface VorschlagAnsicht {
  id: string;
  zielTyp: "kompetenz" | "anwendungsbereich";
  zielId: string;
  zielCode: string;
  zielTitel: string;
  zielPfad: string;
  confidence: number;
  begruendung: string;
  modell: string;
  status: "offen" | "akzeptiert" | "abgelehnt";
  createdAt: string;
  decidedAt: string | null;
}

const MAX_DOKUMENT_ZEICHEN = 20_000;
const MAX_VORSCHLAEGE = 10;

/** Liefert das Dokument inkl. Markdown-Inhalt für den angemeldeten Nutzer. */
async function ladeDokumentFuerVorschlaege(dokumentId: string, ownerId: string) {
  const [doc] = await db
    .select()
    .from(dokumente)
    .where(and(eq(dokumente.id, dokumentId), eq(dokumente.ownerId, ownerId)))
    .limit(1);
  return doc ?? null;
}

interface KurriculumEintrag {
  zielTyp: "kompetenz" | "anwendungsbereich";
  id: string;
  code: string;
  titel: string;
  beschreibung: string | null;
  pfad: string;
}

async function ladeKurriculumKatalog(): Promise<KurriculumEintrag[]> {
  const kompRows = await db
    .select({
      id: kompetenzen.id,
      code: kompetenzen.code,
      titel: kompetenzen.titel,
      beschreibung: kompetenzen.beschreibung,
      bereichTitel: kompetenzbereiche.titel,
      klasseTitel: lehrplanKlassen.titel,
      lehrplanTitel: lehrplaene.titel,
    })
    .from(kompetenzen)
    .innerJoin(kompetenzbereiche, eq(kompetenzbereiche.id, kompetenzen.kompetenzbereichId))
    .innerJoin(lehrplanKlassen, eq(lehrplanKlassen.id, kompetenzbereiche.klasseId))
    .innerJoin(lehrplaene, eq(lehrplaene.id, lehrplanKlassen.lehrplanId))
    .orderBy(asc(kompetenzen.code));

  const awbRows = await db
    .select({
      id: anwendungsbereiche.id,
      code: anwendungsbereiche.code,
      titel: anwendungsbereiche.titel,
      beschreibung: anwendungsbereiche.beschreibung,
      bereichTitel: kompetenzbereiche.titel,
      klasseTitel: lehrplanKlassen.titel,
      lehrplanTitel: lehrplaene.titel,
    })
    .from(anwendungsbereiche)
    .innerJoin(kompetenzbereiche, eq(kompetenzbereiche.id, anwendungsbereiche.kompetenzbereichId))
    .innerJoin(lehrplanKlassen, eq(lehrplanKlassen.id, kompetenzbereiche.klasseId))
    .innerJoin(lehrplaene, eq(lehrplaene.id, lehrplanKlassen.lehrplanId))
    .orderBy(asc(anwendungsbereiche.code));

  const ausKomp: KurriculumEintrag[] = kompRows.map((r) => ({
    zielTyp: "kompetenz",
    id: r.id,
    code: r.code,
    titel: r.titel,
    beschreibung: r.beschreibung,
    pfad: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
  }));
  const ausAwb: KurriculumEintrag[] = awbRows.map((r) => ({
    zielTyp: "anwendungsbereich",
    id: r.id,
    code: r.code,
    titel: r.titel,
    beschreibung: r.beschreibung,
    pfad: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
  }));
  return [...ausKomp, ...ausAwb];
}

/**
 * Listet alle gespeicherten Vorschläge für ein Dokument auf, inklusive
 * Anzeigeinformationen (Code, Titel, Pfad, Status).
 */
export async function ladeVorschlaegeFuerDokument(
  dokumentId: string,
  ownerId: string,
): Promise<VorschlagAnsicht[] | null> {
  const doc = await ladeDokumentFuerVorschlaege(dokumentId, ownerId);
  if (!doc) return null;

  const rows = await db
    .select()
    .from(dokumentLinkVorschlaege)
    .where(eq(dokumentLinkVorschlaege.dokumentId, dokumentId))
    .orderBy(desc(dokumentLinkVorschlaege.confidence));
  if (rows.length === 0) return [];

  const katalog = await ladeKurriculumKatalog();
  const kompById = new Map(katalog.filter((e) => e.zielTyp === "kompetenz").map((e) => [e.id, e]));
  const awbById = new Map(
    katalog.filter((e) => e.zielTyp === "anwendungsbereich").map((e) => [e.id, e]),
  );

  return rows
    .map((row) => mapRowToAnsicht(row, kompById, awbById))
    .filter((v): v is VorschlagAnsicht => v !== null);
}

function mapRowToAnsicht(
  row: DokumentLinkVorschlag,
  kompById: Map<string, KurriculumEintrag>,
  awbById: Map<string, KurriculumEintrag>,
): VorschlagAnsicht | null {
  const eintrag =
    row.zielTyp === "kompetenz"
      ? row.kompetenzId
        ? kompById.get(row.kompetenzId)
        : undefined
      : row.anwendungsbereichId
        ? awbById.get(row.anwendungsbereichId)
        : undefined;
  if (!eintrag) return null;
  return {
    id: row.id,
    zielTyp: row.zielTyp,
    zielId: eintrag.id,
    zielCode: eintrag.code,
    zielTitel: eintrag.titel,
    zielPfad: eintrag.pfad,
    confidence: row.confidence,
    begruendung: row.begruendung,
    modell: row.modell,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}

/**
 * Schema des LLM-Outputs.
 *
 * Wir lassen `zielTyp` bewusst als String zu (statt `z.enum([...])`), weil
 * Modelle gelegentlich den Code in dieses Feld schreiben oder ähnliche
 * Stringvarianten liefern. Die eigentliche Validierung erfolgt anschließend
 * gegen den Lehrplan-Katalog: nur Einträge, deren `code` zu einer Kompetenz
 * bzw. einem Anwendungsbereich passt, werden persistiert. So zerstört ein
 * einzelner ausgefranster Eintrag nicht die gesamte Antwort.
 */
const llmAntwortSchema = z.object({
  vorschlaege: z
    .array(
      z.object({
        zielTyp: z
          .string()
          .min(1)
          .describe("Genau einer der Werte 'kompetenz' oder 'anwendungsbereich'."),
        code: z
          .string()
          .min(1)
          .describe("Exakter Code aus der Lehrplan-Liste, z. B. '1.1' oder 'A.2'."),
        confidence: z.number().min(0).max(1).describe("Sicherheitsmaß zwischen 0 und 1."),
        begruendung: z
          .string()
          .min(1)
          .describe(
            "Kurze deutsche Begründung (1-3 Sätze), warum das Material zu diesem Eintrag passt.",
          ),
      }),
    )
    .max(MAX_VORSCHLAEGE),
});

export interface GenerierungsErgebnis {
  ok: boolean;
  grund?: "kein_inhalt" | "nicht_unterstuetzt" | "keine_treffer" | "ai_fehler";
  fehler?: string;
  vorschlaege: VorschlagAnsicht[];
}

/**
 * Erzeugt mittels LLM neue Verknüpfungs-Vorschläge für das Dokument und
 * persistiert sie. Bestehende Vorschläge im Status `offen` werden zuvor
 * gelöscht; akzeptierte/abgelehnte bleiben als Audit-Spur erhalten.
 *
 * Unterstützt Text-Seiten (`typ === "seite"`, Quelle: `inhaltMarkdown`)
 * sowie PDF-Dokumente (`typ === "pdf"`, Quelle: extrahierte
 * `material_chunks` des verknüpften Materials).
 */
export async function generiereVorschlaegeFuerDokument(
  dokumentId: string,
  ownerId: string,
  schluessel: BenutzerAiSchluessel,
): Promise<GenerierungsErgebnis | null> {
  const doc = await ladeDokumentFuerVorschlaege(dokumentId, ownerId);
  if (!doc) return null;

  let inhalt = "";
  if (doc.typ === "seite") {
    inhalt = (doc.inhaltMarkdown ?? "").trim();
  } else if (doc.typ === "pdf") {
    if (!doc.materialId) {
      return {
        ok: false,
        grund: "kein_inhalt",
        fehler: "Diesem PDF-Dokument ist keine Datei zugeordnet.",
        vorschlaege: [],
      };
    }
    const [mat] = await db
      .select({ status: materialien.status, statusReason: materialien.statusReason })
      .from(materialien)
      .where(and(eq(materialien.id, doc.materialId), eq(materialien.ownerId, ownerId)))
      .limit(1);
    if (!mat) {
      return {
        ok: false,
        grund: "kein_inhalt",
        fehler: "Material nicht gefunden.",
        vorschlaege: [],
      };
    }
    if (mat.status === "uploaded" || mat.status === "processing") {
      return {
        ok: false,
        grund: "kein_inhalt",
        fehler:
          "PDF wird noch verarbeitet. Bitte warten, bis die Textextraktion abgeschlossen ist.",
        vorschlaege: [],
      };
    }
    if (mat.status === "error") {
      return {
        ok: false,
        grund: "kein_inhalt",
        fehler:
          mat.statusReason ?? "PDF konnte nicht verarbeitet werden.",
        vorschlaege: [],
      };
    }
    const chunks = await db
      .select({ text: materialChunks.text })
      .from(materialChunks)
      .where(eq(materialChunks.materialId, doc.materialId))
      .orderBy(asc(materialChunks.chunkIndex));
    inhalt = chunks
      .map((c) => c.text)
      .join("\n\n")
      .trim();
  } else {
    return {
      ok: false,
      grund: "nicht_unterstuetzt",
      fehler: "Vorschläge sind für diesen Dokumenttyp nicht verfügbar.",
      vorschlaege: [],
    };
  }

  if (inhalt.length === 0) {
    return {
      ok: false,
      grund: "kein_inhalt",
      fehler: "Das Dokument enthält keinen Text, der analysiert werden könnte.",
      vorschlaege: [],
    };
  }

  const katalog = await ladeKurriculumKatalog();
  if (katalog.length === 0) {
    return {
      ok: false,
      grund: "keine_treffer",
      fehler: "Es ist noch kein Lehrplan eingespielt.",
      vorschlaege: [],
    };
  }

  const modellName = process.env.AI_TAGGING_MODEL ?? "gpt-4o-mini";
  let model: LanguageModel;
  try {
    model = getModel("tagging", schluessel) as LanguageModel;
  } catch (error) {
    return {
      ok: false,
      grund: "ai_fehler",
      fehler:
        error instanceof FehlenderProviderSchluessel
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unbekannter LLM-Fehler.",
      vorschlaege: [],
    };
  }

  const ausschnitt = inhalt.slice(0, MAX_DOKUMENT_ZEICHEN);
  const katalogText = katalog
    .map(
      (e) =>
        `- [${e.zielTyp}] ${e.code} | ${e.titel}${
          e.beschreibung ? ` — ${truncate(e.beschreibung, 240)}` : ""
        } (${e.pfad})`,
    )
    .join("\n");

  const systemPrompt = `Du bist ein didaktisch geschulter Assistent, der Unterrichtsmaterialien zu österreichischen Lehrplan-Kompetenzen und Anwendungsbereichen zuordnet. Antworte ausschließlich auf Deutsch. Wähle ausschließlich Codes, die exakt in der vorgegebenen Liste vorkommen. Gib nur Zuordnungen mit klarer fachlicher Passung an (max. ${MAX_VORSCHLAEGE}). Lass eher Vorschläge weg, als unsichere zu erfinden.`;

  const userPrompt = `Dokumenttitel: ${doc.titel}

Materialinhalt (Markdown, ggf. gekürzt):
"""
${ausschnitt}
"""

Verfügbare Lehrplan-Einträge (zielTyp + Code + Titel + Beschreibung + Pfad):
${katalogText}

Aufgabe:
- Bewerte, zu welchen Einträgen das Material inhaltlich passt.
- Gib für jede Zuordnung den exakten Code, den Ziel-Typ ('kompetenz' oder 'anwendungsbereich'), eine Konfidenz (0..1) und eine kurze deutsche Begründung an.
- Maximal ${MAX_VORSCHLAEGE} Vorschläge. Lieber wenige hochwertige als viele schwache.`;

  let llmAntwort: z.infer<typeof llmAntwortSchema>;
  try {
    const result = await generateObject({
      model,
      schema: llmAntwortSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });
    llmAntwort = result.object;
  } catch (error) {
    return {
      ok: false,
      grund: "ai_fehler",
      fehler: error instanceof Error ? error.message : "Unbekannter LLM-Fehler.",
      vorschlaege: [],
    };
  }

  // Code → ID auflösen (nur Treffer im Katalog werden persistiert).
  const kompByCode = new Map(
    katalog.filter((e) => e.zielTyp === "kompetenz").map((e) => [e.code, e]),
  );
  const awbByCode = new Map(
    katalog.filter((e) => e.zielTyp === "anwendungsbereich").map((e) => [e.code, e]),
  );

  type AufgeloesterVorschlag = {
    eintrag: KurriculumEintrag;
    confidence: number;
    begruendung: string;
  };
  const aufgeloest: AufgeloesterVorschlag[] = [];
  const gesehen = new Set<string>();
  for (const v of llmAntwort.vorschlaege) {
    const typHinweis = v.zielTyp.trim().toLowerCase();
    // Bevorzugt den vom Modell gelieferten Typ; fällt aber auf die jeweils
    // andere Variante zurück, wenn der Code dort nachweisbar passt. Dadurch
    // tolerieren wir Fälle, in denen das Modell den Typ verwechselt oder
    // statt des Typs noch einmal den Code liefert.
    const primaer =
      typHinweis === "anwendungsbereich" ? awbByCode.get(v.code) : kompByCode.get(v.code);
    const sekundaer =
      typHinweis === "anwendungsbereich" ? kompByCode.get(v.code) : awbByCode.get(v.code);
    const eintrag = primaer ?? sekundaer;
    if (!eintrag) continue;
    const dedupKey = `${eintrag.zielTyp}:${eintrag.id}`;
    if (gesehen.has(dedupKey)) continue;
    gesehen.add(dedupKey);
    aufgeloest.push({
      eintrag,
      confidence: v.confidence,
      begruendung: v.begruendung.trim(),
    });
  }

  // Bestehende offene Vorschläge ersetzen; entschiedene bleiben erhalten.
  await db
    .delete(dokumentLinkVorschlaege)
    .where(
      and(
        eq(dokumentLinkVorschlaege.dokumentId, dokumentId),
        eq(dokumentLinkVorschlaege.status, "offen"),
      ),
    );

  if (aufgeloest.length > 0) {
    // Filtere Duplikate gegen bereits entschiedene Einträge.
    const vorhandene = await db
      .select({
        zielTyp: dokumentLinkVorschlaege.zielTyp,
        kompetenzId: dokumentLinkVorschlaege.kompetenzId,
        anwendungsbereichId: dokumentLinkVorschlaege.anwendungsbereichId,
      })
      .from(dokumentLinkVorschlaege)
      .where(eq(dokumentLinkVorschlaege.dokumentId, dokumentId));
    const vorhandeneKey = new Set(
      vorhandene.map((v) =>
        v.zielTyp === "kompetenz"
          ? `kompetenz:${v.kompetenzId}`
          : `anwendungsbereich:${v.anwendungsbereichId}`,
      ),
    );

    const einzufuegen = aufgeloest
      .filter((a) => !vorhandeneKey.has(`${a.eintrag.zielTyp}:${a.eintrag.id}`))
      .map((a) => ({
        dokumentId,
        zielTyp: a.eintrag.zielTyp,
        kompetenzId: a.eintrag.zielTyp === "kompetenz" ? a.eintrag.id : null,
        anwendungsbereichId: a.eintrag.zielTyp === "anwendungsbereich" ? a.eintrag.id : null,
        confidence: a.confidence,
        begruendung: a.begruendung,
        modell: modellName,
      }));

    if (einzufuegen.length > 0) {
      await db.insert(dokumentLinkVorschlaege).values(einzufuegen);
    }
  }

  const ansichten = (await ladeVorschlaegeFuerDokument(dokumentId, ownerId)) ?? [];
  return { ok: true, vorschlaege: ansichten };
}

interface EntscheidungsEingabe {
  vorschlagId: string;
  dokumentId: string;
  ownerId: string;
  aktion: "akzeptieren" | "ablehnen";
}

export interface EntscheidungsErgebnis {
  vorschlag: VorschlagAnsicht;
}

/**
 * Markiert einen Vorschlag als akzeptiert oder abgelehnt. Beim Akzeptieren
 * wird zusätzlich der entsprechende manuelle Link in
 * `dokument_*_links` angelegt (idempotent).
 */
export async function entscheideVorschlag(
  eingabe: EntscheidungsEingabe,
): Promise<EntscheidungsErgebnis | null> {
  const doc = await ladeDokumentFuerVorschlaege(eingabe.dokumentId, eingabe.ownerId);
  if (!doc) return null;

  const [vorschlag] = await db
    .select()
    .from(dokumentLinkVorschlaege)
    .where(
      and(
        eq(dokumentLinkVorschlaege.id, eingabe.vorschlagId),
        eq(dokumentLinkVorschlaege.dokumentId, eingabe.dokumentId),
      ),
    )
    .limit(1);
  if (!vorschlag) return null;

  if (eingabe.aktion === "akzeptieren") {
    if (vorschlag.zielTyp === "kompetenz" && vorschlag.kompetenzId) {
      await db
        .insert(dokumentKompetenzLinks)
        .values({
          dokumentId: eingabe.dokumentId,
          kompetenzId: vorschlag.kompetenzId,
          notiz: null,
        })
        .onConflictDoNothing();
    } else if (vorschlag.zielTyp === "anwendungsbereich" && vorschlag.anwendungsbereichId) {
      await db
        .insert(dokumentAnwendungsbereichLinks)
        .values({
          dokumentId: eingabe.dokumentId,
          anwendungsbereichId: vorschlag.anwendungsbereichId,
          notiz: null,
        })
        .onConflictDoNothing();
    }
  }

  const status = eingabe.aktion === "akzeptieren" ? "akzeptiert" : "abgelehnt";
  await db
    .update(dokumentLinkVorschlaege)
    .set({ status, decidedAt: new Date() })
    .where(eq(dokumentLinkVorschlaege.id, eingabe.vorschlagId));

  const liste = await ladeVorschlaegeFuerDokument(eingabe.dokumentId, eingabe.ownerId);
  const aktualisiert = liste?.find((v) => v.id === eingabe.vorschlagId);
  if (!aktualisiert) return null;
  return { vorschlag: aktualisiert };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
