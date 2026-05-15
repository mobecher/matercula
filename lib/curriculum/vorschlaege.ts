import { generateObject, type LanguageModel } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { type UserAiKeys, MissingProviderKey, getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema/documents";
import {
  anwendungsbereiche,
  kompetenzbereiche,
  kompetenzen,
  lehrplaene,
  lehrplanKlassen,
} from "@/lib/db/schema/lehrplan";
import {
  type DocumentLinkSuggestion,
  documentAnwendungsbereichLinks,
  documentKompetenzLinks,
  documentLinkSuggestions,
} from "@/lib/db/schema/links";
import { materialChunks, materialien } from "@/lib/db/schema/materials";
import { documentContentForAi } from "./dokument-inhalt";

export interface SuggestionView {
  id: string;
  targetType: "kompetenz" | "anwendungsbereich";
  targetId: string;
  targetCode: string;
  targetTitle: string;
  targetPath: string;
  confidence: number;
  rationale: string;
  model: string;
  status: "offen" | "akzeptiert" | "abgelehnt";
  createdAt: string;
  decidedAt: string | null;
}

const MAX_DOKUMENT_ZEICHEN = 20_000;
const MAX_VORSCHLAEGE = 10;

/** Liefert das Document inkl. Markdown-Inhalt für den angemeldeten Nutzer. */
async function loadDocumentForSuggestions(documentId: string, ownerId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId)))
    .limit(1);
  return doc ?? null;
}

interface CurriculumEntry {
  targetType: "kompetenz" | "anwendungsbereich";
  id: string;
  code: string;
  title: string;
  description: string | null;
  path: string;
}

async function loadCurriculumCatalog(): Promise<CurriculumEntry[]> {
  const kompRows = await db
    .select({
      id: kompetenzen.id,
      code: kompetenzen.code,
      title: kompetenzen.title,
      description: kompetenzen.description,
      bereichTitel: kompetenzbereiche.title,
      klasseTitel: lehrplanKlassen.title,
      lehrplanTitel: lehrplaene.title,
    })
    .from(kompetenzen)
    .innerJoin(
      kompetenzbereiche,
      eq(kompetenzbereiche.id, kompetenzen.kompetenzbereichId),
    )
    .innerJoin(
      lehrplanKlassen,
      eq(lehrplanKlassen.id, kompetenzbereiche.klasseId),
    )
    .innerJoin(lehrplaene, eq(lehrplaene.id, lehrplanKlassen.lehrplanId))
    .orderBy(asc(kompetenzen.code));

  const awbRows = await db
    .select({
      id: anwendungsbereiche.id,
      code: anwendungsbereiche.code,
      title: anwendungsbereiche.title,
      description: anwendungsbereiche.description,
      bereichTitel: kompetenzbereiche.title,
      klasseTitel: lehrplanKlassen.title,
      lehrplanTitel: lehrplaene.title,
    })
    .from(anwendungsbereiche)
    .innerJoin(
      kompetenzbereiche,
      eq(kompetenzbereiche.id, anwendungsbereiche.kompetenzbereichId),
    )
    .innerJoin(
      lehrplanKlassen,
      eq(lehrplanKlassen.id, kompetenzbereiche.klasseId),
    )
    .innerJoin(lehrplaene, eq(lehrplaene.id, lehrplanKlassen.lehrplanId))
    .orderBy(asc(anwendungsbereiche.code));

  const ausKomp: CurriculumEntry[] = kompRows.map((r) => ({
    targetType: "kompetenz",
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    path: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
  }));
  const ausAwb: CurriculumEntry[] = awbRows.map((r) => ({
    targetType: "anwendungsbereich",
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    path: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
  }));
  return [...ausKomp, ...ausAwb];
}

/**
 * Listet alle gespeicherten Vorschläge für ein Document auf, inklusive
 * Anzeigeinformationen (Code, Titel, Pfad, Status).
 */
export async function loadSuggestionsForDocument(
  documentId: string,
  ownerId: string,
): Promise<SuggestionView[] | null> {
  const doc = await loadDocumentForSuggestions(documentId, ownerId);
  if (!doc) return null;

  const rows = await db
    .select()
    .from(documentLinkSuggestions)
    .where(eq(documentLinkSuggestions.documentId, documentId))
    .orderBy(desc(documentLinkSuggestions.confidence));
  if (rows.length === 0) return [];

  const katalog = await loadCurriculumCatalog();
  const kompById = new Map(
    katalog.filter((e) => e.targetType === "kompetenz").map((e) => [e.id, e]),
  );
  const awbById = new Map(
    katalog
      .filter((e) => e.targetType === "anwendungsbereich")
      .map((e) => [e.id, e]),
  );

  return rows
    .map((row) => mapRowToView(row, kompById, awbById))
    .filter((v): v is SuggestionView => v !== null);
}

function mapRowToView(
  row: DocumentLinkSuggestion,
  kompById: Map<string, CurriculumEntry>,
  awbById: Map<string, CurriculumEntry>,
): SuggestionView | null {
  const eintrag =
    row.targetType === "kompetenz"
      ? row.kompetenzId
        ? kompById.get(row.kompetenzId)
        : undefined
      : row.anwendungsbereichId
        ? awbById.get(row.anwendungsbereichId)
        : undefined;
  if (!eintrag) return null;
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: eintrag.id,
    targetCode: eintrag.code,
    // Bevorzugt die vollständige Beschreibung – `title` ist eine gekürzte
    // Überschrift (z. B. ein einzelnes Verb), während die ganze Kompetenz/
    // der Anwendungsbereich in `description` steht. Für die Entscheidung
    // im Vorschlags-Panel ist der volle Text deutlich nützlicher.
    targetTitle: eintrag.description?.trim() || eintrag.title,
    targetPath: eintrag.path,
    confidence: row.confidence,
    rationale: row.rationale,
    model: row.model,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}

/**
 * Schema des LLM-Outputs.
 *
 * Wir lassen `targetType` bewusst als String zu (statt `z.enum([...])`), weil
 * Modelle gelegentlich den Code in dieses Feld schreiben oder ähnliche
 * Stringvarianten liefern. Die eigentliche Validierung erfolgt anschließend
 * gegen den Lehrplan-Katalog: nur Einträge, deren `code` zu einer Kompetenz
 * bzw. einem Anwendungsbereich passt, werden persistiert. So zerstört ein
 * einzelner ausgefranster Eintrag nicht die gesamte Antwort.
 */
const llmAntwortSchema = z.object({
  suggestions: z
    .array(
      z.object({
        targetType: z
          .string()
          .min(1)
          .describe("Genau einer der Werte 'kompetenz' oder 'anwendungsbereich'."),
        code: z
          .string()
          .min(1)
          .describe("Exakter Code aus der Lehrplan-Liste, z. B. '1.1' oder 'A.2'."),
        confidence: z.number().min(0).max(1).describe("Sicherheitsmaß zwischen 0 und 1."),
        rationale: z
          .string()
          .min(1)
          .describe(
            "Kurze deutsche Begründung (1-3 Sätze), warum das Material zu diesem Eintrag passt.",
          ),
      }),
    )
    .max(MAX_VORSCHLAEGE),
});

export interface GenerationResult {
  ok: boolean;
  reason?: "kein_inhalt" | "nicht_unterstuetzt" | "keine_treffer" | "ai_fehler";
  error?: string;
  suggestions: SuggestionView[];
}

/**
 * Erzeugt mittels LLM neue Verknüpfungs-Vorschläge für das Document und
 * persistiert sie. Bestehende Vorschläge im Status `offen` werden zuvor
 * gelöscht; akzeptierte/abgelehnte bleiben als Audit-Spur erhalten.
 *
 * Unterstützt Text-Seiten (`type === "seite"`, Quelle: `contentMarkdown`)
 * sowie PDF-Dokumente (`type === "pdf"`, Quelle: extrahierte
 * `material_chunks` des verknüpften Materials).
 */
export async function generateSuggestionsForDocument(
  documentId: string,
  ownerId: string,
  schluessel: UserAiKeys,
): Promise<GenerationResult | null> {
  const doc = await loadDocumentForSuggestions(documentId, ownerId);
  if (!doc) return null;

  let inhalt = "";
  if (doc.type === "seite") {
    // BlockNote-JSON wird zu Klartext entpackt; Link-Karten und
    // YouTube-Einbettungen werden mit extern abgeholten Inhalten
    // (HTML-Plain-Text bzw. oEmbed-Titel) angereichert. Externe Fetches
    // scheitern weich, damit das Tagging trotzdem läuft.
    inhalt = (await documentContentForAi(doc.contentMarkdown)).trim();
  } else if (doc.type === "pdf") {
    if (!doc.materialId) {
      return {
        ok: false,
        reason: "kein_inhalt",
        error: "Diesem PDF-Document ist keine Datei zugeordnet.",
        suggestions: [],
      };
    }
    const [mat] = await db
      .select({
        status: materialien.status,
        statusReason: materialien.statusReason,
      })
      .from(materialien)
      .where(
        and(
          eq(materialien.id, doc.materialId),
          eq(materialien.ownerId, ownerId),
        ),
      )
      .limit(1);
    if (!mat) {
      return {
        ok: false,
        reason: "kein_inhalt",
        error: "Material nicht gefunden.",
        suggestions: [],
      };
    }
    if (mat.status === "uploaded" || mat.status === "processing") {
      return {
        ok: false,
        reason: "kein_inhalt",
        error:
          "PDF wird noch verarbeitet. Bitte warten, bis die Textextraktion abgeschlossen ist.",
        suggestions: [],
      };
    }
    if (mat.status === "error") {
      return {
        ok: false,
        reason: "kein_inhalt",
        error: mat.statusReason ?? "PDF konnte nicht verarbeitet werden.",
        suggestions: [],
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
      reason: "nicht_unterstuetzt",
      error: "Vorschläge sind für diesen Dokumenttyp nicht verfügbar.",
      suggestions: [],
    };
  }

  if (inhalt.length === 0) {
    return {
      ok: false,
      reason: "kein_inhalt",
      error: "Das Document enthält keinen Text, der analysiert werden könnte.",
      suggestions: [],
    };
  }

  const katalog = await loadCurriculumCatalog();
  if (katalog.length === 0) {
    return {
      ok: false,
      reason: "keine_treffer",
      error: "Es ist noch kein Lehrplan eingespielt.",
      suggestions: [],
    };
  }

  const modellName = process.env.AI_TAGGING_MODEL ?? "gpt-4o-mini";
  let model: LanguageModel;
  try {
    model = getModel("tagging", schluessel) as LanguageModel;
  } catch (error) {
    return {
      ok: false,
      reason: "ai_fehler",
      error:
        error instanceof MissingProviderKey
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unbekannter LLM-Fehler.",
      suggestions: [],
    };
  }

  const ausschnitt = inhalt.slice(0, MAX_DOKUMENT_ZEICHEN);
  const katalogText = katalog
    .map(
      (e) =>
        `- [${e.targetType}] ${e.code} | ${e.title}${
          e.description ? ` — ${truncate(e.description, 240)}` : ""
        } (${e.path})`,
    )
    .join("\n");

  const systemPrompt = `Du bist ein didaktisch geschulter Assistent, der Unterrichtsmaterialien zu österreichischen Lehrplan-Kompetenzen und Anwendungsbereichen zuordnet. Antworte ausschließlich auf Deutsch. Wähle ausschließlich Codes, die exakt in der vorgegebenen Liste vorkommen. Gib nur Zuordnungen mit klarer fachlicher Passung an (max. ${MAX_VORSCHLAEGE}). Lass eher Vorschläge weg, als unsichere zu erfinden.`;

  const userPrompt = `Dokumenttitel: ${doc.title}

Materialinhalt (Markdown, ggf. gekürzt):
"""
${ausschnitt}
"""

Verfügbare Lehrplan-Einträge (targetType + Code + Titel + Beschreibung + Pfad):
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
      reason: "ai_fehler",
      error: error instanceof Error ? error.message : "Unbekannter LLM-Fehler.",
      suggestions: [],
    };
  }

  // Code → ID auflösen (nur Treffer im Katalog werden persistiert).
  const kompByCode = new Map(
    katalog.filter((e) => e.targetType === "kompetenz").map((e) => [e.code, e]),
  );
  const awbByCode = new Map(
    katalog
      .filter((e) => e.targetType === "anwendungsbereich")
      .map((e) => [e.code, e]),
  );

  type AufgeloesterVorschlag = {
    eintrag: CurriculumEntry;
    confidence: number;
    rationale: string;
  };
  const aufgeloest: AufgeloesterVorschlag[] = [];
  const gesehen = new Set<string>();
  for (const v of llmAntwort.suggestions) {
    const typHinweis = v.targetType.trim().toLowerCase();
    // Bevorzugt den vom Modell gelieferten Typ; fällt aber auf die jeweils
    // andere Variante zurück, wenn der Code dort nachweisbar passt. Dadurch
    // tolerieren wir Fälle, in denen das Modell den Typ verwechselt oder
    // statt des Typs noch einmal den Code liefert.
    const primaer =
      typHinweis === "anwendungsbereich"
        ? awbByCode.get(v.code)
        : kompByCode.get(v.code);
    const sekundaer =
      typHinweis === "anwendungsbereich"
        ? kompByCode.get(v.code)
        : awbByCode.get(v.code);
    const eintrag = primaer ?? sekundaer;
    if (!eintrag) continue;
    const dedupKey = `${eintrag.targetType}:${eintrag.id}`;
    if (gesehen.has(dedupKey)) continue;
    gesehen.add(dedupKey);
    aufgeloest.push({
      eintrag,
      confidence: v.confidence,
      rationale: v.rationale.trim(),
    });
  }

  // Bestehende offene Vorschläge ersetzen; entschiedene bleiben erhalten.
  await db
    .delete(documentLinkSuggestions)
    .where(
      and(
        eq(documentLinkSuggestions.documentId, documentId),
        eq(documentLinkSuggestions.status, "offen"),
      ),
    );

  if (aufgeloest.length > 0) {
    // Filtere Duplikate gegen bereits entschiedene Einträge.
    const vorhandene = await db
      .select({
        targetType: documentLinkSuggestions.targetType,
        kompetenzId: documentLinkSuggestions.kompetenzId,
        anwendungsbereichId: documentLinkSuggestions.anwendungsbereichId,
      })
      .from(documentLinkSuggestions)
      .where(eq(documentLinkSuggestions.documentId, documentId));
    const vorhandeneKey = new Set(
      vorhandene.map((v) =>
        v.targetType === "kompetenz"
          ? `kompetenz:${v.kompetenzId}`
          : `anwendungsbereich:${v.anwendungsbereichId}`,
      ),
    );

    const einzufuegen = aufgeloest
      .filter((a) => !vorhandeneKey.has(`${a.eintrag.targetType}:${a.eintrag.id}`))
      .map((a) => ({
        documentId,
        targetType: a.eintrag.targetType,
        kompetenzId: a.eintrag.targetType === "kompetenz" ? a.eintrag.id : null,
        anwendungsbereichId:
          a.eintrag.targetType === "anwendungsbereich" ? a.eintrag.id : null,
        confidence: a.confidence,
        rationale: a.rationale,
        model: modellName,
      }));

    if (einzufuegen.length > 0) {
      await db.insert(documentLinkSuggestions).values(einzufuegen);
    }
  }

  const ansichten =
    (await loadSuggestionsForDocument(documentId, ownerId)) ?? [];
  return { ok: true, suggestions: ansichten };
}

interface EntscheidungsEingabe {
  suggestionId: string;
  documentId: string;
  ownerId: string;
  action: "akzeptieren" | "ablehnen" | "zuruecksetzen";
}

export interface EntscheidungsErgebnis {
  suggestion: SuggestionView;
}

/**
 * Markiert einen Vorschlag als akzeptiert oder abgelehnt. Beim Akzeptieren
 * wird zusätzlich der entsprechende manuelle Link in
 * `dokument_*_links` angelegt (idempotent).
 */
export async function decideSuggestion(
  eingabe: EntscheidungsEingabe,
): Promise<EntscheidungsErgebnis | null> {
  const doc = await loadDocumentForSuggestions(
    eingabe.documentId,
    eingabe.ownerId,
  );
  if (!doc) return null;

  const [suggestion] = await db
    .select()
    .from(documentLinkSuggestions)
    .where(
      and(
        eq(documentLinkSuggestions.id, eingabe.suggestionId),
        eq(documentLinkSuggestions.documentId, eingabe.documentId),
      ),
    )
    .limit(1);
  if (!suggestion) return null;

  if (eingabe.action === "akzeptieren") {
    // Die KI-Begründung des Vorschlags wird als Notiz an der Verknüpfung
    // gespeichert, damit nachvollziehbar bleibt, warum der Link existiert.
    const note = suggestion.rationale?.trim() ? suggestion.rationale : null;
    if (suggestion.targetType === "kompetenz" && suggestion.kompetenzId) {
      await db
        .insert(documentKompetenzLinks)
        .values({
          documentId: eingabe.documentId,
          kompetenzId: suggestion.kompetenzId,
          note,
        })
        .onConflictDoNothing();
    } else if (
      suggestion.targetType === "anwendungsbereich" &&
      suggestion.anwendungsbereichId
    ) {
      await db
        .insert(documentAnwendungsbereichLinks)
        .values({
          documentId: eingabe.documentId,
          anwendungsbereichId: suggestion.anwendungsbereichId,
          note,
        })
        .onConflictDoNothing();
    }
  } else if (eingabe.action === "zuruecksetzen") {
    // Vorschlag wird auf "offen" zurückgesetzt; falls bereits ein Link
    // (durch früheres Akzeptieren) existiert, wird dieser entfernt, damit
    // Vorschlags-Zustand und Link-Tabelle konsistent bleiben.
    if (suggestion.targetType === "kompetenz" && suggestion.kompetenzId) {
      await db
        .delete(documentKompetenzLinks)
        .where(
          and(
            eq(documentKompetenzLinks.documentId, eingabe.documentId),
            eq(documentKompetenzLinks.kompetenzId, suggestion.kompetenzId),
          ),
        );
    } else if (
      suggestion.targetType === "anwendungsbereich" &&
      suggestion.anwendungsbereichId
    ) {
      await db
        .delete(documentAnwendungsbereichLinks)
        .where(
          and(
            eq(documentAnwendungsbereichLinks.documentId, eingabe.documentId),
            eq(
              documentAnwendungsbereichLinks.anwendungsbereichId,
              suggestion.anwendungsbereichId,
            ),
          ),
        );
    }
  }

  const status =
    eingabe.action === "akzeptieren"
      ? "akzeptiert"
      : eingabe.action === "ablehnen"
        ? "abgelehnt"
        : "offen";
  await db
    .update(documentLinkSuggestions)
    .set({ status, decidedAt: status === "offen" ? null : new Date() })
    .where(eq(documentLinkSuggestions.id, eingabe.suggestionId));

  const liste = await loadSuggestionsForDocument(
    eingabe.documentId,
    eingabe.ownerId,
  );
  const aktualisiert = liste?.find((v) => v.id === eingabe.suggestionId);
  if (!aktualisiert) return null;
  return { suggestion: aktualisiert };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
