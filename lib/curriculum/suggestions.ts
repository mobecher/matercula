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
import { documentContentForAi } from "./document-content";

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
  status: "open" | "accepted" | "rejected";
  createdAt: string;
  decidedAt: string | null;
}

const MAX_DOCUMENT_CHARS = 20_000;
const MAX_SUGGESTIONS = 10;

/** Loads the document including markdown content for the signed-in user. */
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
 * Lists all stored suggestions for a document, including
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

  const catalog = await loadCurriculumCatalog();
  const kompById = new Map(
    catalog.filter((e) => e.targetType === "kompetenz").map((e) => [e.id, e]),
  );
  const awbById = new Map(
    catalog
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
    // Prefer the full description — `title` is a shortened heading
    // (e.g. a single verb), while the full Kompetenz / Anwendungsbereich
    // text lives in `description`. The full text is much more useful in
    // the suggestion review panel.
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
 * We deliberately allow `targetType` as a plain string (instead of
 * `z.enum([...])`) because models occasionally write the code into this
 * field or return similar string variants. Actual validation happens
 * afterwards against the Lehrplan catalog: only entries whose `code`
 * matches a Kompetenz / Anwendungsbereich are persisted, so a single
 * malformed entry doesn't destroy the whole response.
 */
const llmResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        targetType: z
          .string()
          .min(1)
          .describe(
            "Genau einer der Werte 'kompetenz' oder 'anwendungsbereich'.",
          ),
        code: z
          .string()
          .min(1)
          .describe(
            "Exakter Code aus der Lehrplan-Liste, z. B. '1.1' oder 'A.2'.",
          ),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe("Sicherheitsmaß zwischen 0 und 1."),
        rationale: z
          .string()
          .min(1)
          .describe(
            "Kurze deutsche Begründung (1-3 Sätze), warum das Material zu diesem Eintrag passt.",
          ),
      }),
    )
    .max(MAX_SUGGESTIONS),
});

export interface GenerationResult {
  ok: boolean;
  reason?: "no_content" | "unsupported" | "no_matches" | "ai_error";
  error?: string;
  suggestions: SuggestionView[];
}

/**
 * Generates new link suggestions for a document via the LLM and
 * persists them. Existing suggestions in status `open` are deleted first;
 * accepted/rejected suggestions are kept as an audit trail.
 *
 * Supports text pages (`type === "page"`, source: `contentMarkdown`) as
 * well as file documents (`type === "file"`, source: extracted
 * `material_chunks` of the linked Material).
 */
export async function generateSuggestionsForDocument(
  documentId: string,
  ownerId: string,
  keys: UserAiKeys,
): Promise<GenerationResult | null> {
  const doc = await loadDocumentForSuggestions(documentId, ownerId);
  if (!doc) return null;

  let content = "";
  if (doc.type === "page") {
    // BlockNote JSON is unpacked into plain text; link cards and YouTube
    // embeds are enriched with externally fetched content (HTML plain text
    // and oEmbed title respectively). External fetches fail soft so that
    // tagging still runs.
    content = (await documentContentForAi(doc.contentMarkdown)).trim();
  } else if (doc.type === "file") {
    if (!doc.materialId) {
      return {
        ok: false,
        reason: "no_content",
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
        reason: "no_content",
        error: "Material nicht gefunden.",
        suggestions: [],
      };
    }
    if (mat.status === "uploaded" || mat.status === "processing") {
      return {
        ok: false,
        reason: "no_content",
        error:
          "PDF wird noch verarbeitet. Bitte warten, bis die Textextraktion abgeschlossen ist.",
        suggestions: [],
      };
    }
    if (mat.status === "error") {
      return {
        ok: false,
        reason: "no_content",
        error: mat.statusReason ?? "PDF konnte nicht verarbeitet werden.",
        suggestions: [],
      };
    }
    const chunks = await db
      .select({ text: materialChunks.text })
      .from(materialChunks)
      .where(eq(materialChunks.materialId, doc.materialId))
      .orderBy(asc(materialChunks.chunkIndex));
    content = chunks
      .map((c) => c.text)
      .join("\n\n")
      .trim();
  } else {
    return {
      ok: false,
      reason: "unsupported",
      error: "Vorschläge sind für diesen Dokumenttyp nicht verfügbar.",
      suggestions: [],
    };
  }

  if (content.length === 0) {
    return {
      ok: false,
      reason: "no_content",
      error: "Das Document enthält keinen Text, der analysiert werden könnte.",
      suggestions: [],
    };
  }

  const catalog = await loadCurriculumCatalog();
  if (catalog.length === 0) {
    return {
      ok: false,
      reason: "no_matches",
      error: "Es ist noch kein Lehrplan eingespielt.",
      suggestions: [],
    };
  }

  const modelName = process.env.AI_TAGGING_MODEL ?? "gpt-4o-mini";
  let model: LanguageModel;
  try {
    model = getModel("tagging", keys) as LanguageModel;
  } catch (error) {
    return {
      ok: false,
      reason: "ai_error",
      error:
        error instanceof MissingProviderKey
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unbekannter LLM-Fehler.",
      suggestions: [],
    };
  }

  const excerpt = content.slice(0, MAX_DOCUMENT_CHARS);
  const catalogText = catalog
    .map(
      (e) =>
        `- [${e.targetType}] ${e.code} | ${e.title}${
          e.description ? ` — ${truncate(e.description, 240)}` : ""
        } (${e.path})`,
    )
    .join("\n");

  const systemPrompt = `Du bist ein didaktisch geschulter Assistent, der Unterrichtsmaterialien zu österreichischen Lehrplan-Kompetenzen und Anwendungsbereichen zuordnet. Antworte ausschließlich auf Deutsch. Wähle ausschließlich Codes, die exakt in der vorgegebenen Liste vorkommen. Gib nur Zuordnungen mit klarer fachlicher Passung an (max. ${MAX_SUGGESTIONS}). Lass eher Vorschläge weg, als unsichere zu erfinden.`;

  const userPrompt = `Dokumenttitel: ${doc.title}

Materialinhalt (Markdown, ggf. gekürzt):
"""
${excerpt}
"""

Verfügbare Lehrplan-Einträge (targetType + Code + Titel + Beschreibung + Pfad):
${catalogText}

Aufgabe:
- Bewerte, zu welchen Einträgen das Material inhaltlich passt.
- Gib für jede Zuordnung den exakten Code, den Ziel-Typ ('kompetenz' oder 'anwendungsbereich'), eine Konfidenz (0..1) und eine kurze deutsche Begründung an.
- Maximal ${MAX_SUGGESTIONS} Vorschläge. Lieber wenige hochwertige als viele schwache.`;

  let llmResponse: z.infer<typeof llmResponseSchema>;
  try {
    const result = await generateObject({
      model,
      schema: llmResponseSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });
    llmResponse = result.object;
  } catch (error) {
    return {
      ok: false,
      reason: "ai_error",
      error: error instanceof Error ? error.message : "Unbekannter LLM-Fehler.",
      suggestions: [],
    };
  }

  // Resolve code → ID (only matches in the catalog are persisted).
  const kompByCode = new Map(
    catalog.filter((e) => e.targetType === "kompetenz").map((e) => [e.code, e]),
  );
  const awbByCode = new Map(
    catalog
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
  for (const v of llmResponse.suggestions) {
    const typHinweis = v.targetType.trim().toLowerCase();
    // Prefer the type the model returned, but fall back to the other
    // variant if the code matches there instead. This tolerates cases
    // where the model swaps the type or
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

  // Replace existing open suggestions; decided ones are kept.
  await db
    .delete(documentLinkSuggestions)
    .where(
      and(
        eq(documentLinkSuggestions.documentId, documentId),
        eq(documentLinkSuggestions.status, "open"),
      ),
    );

  if (aufgeloest.length > 0) {
    // Filter out duplicates against already decided entries.
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
      .filter(
        (a) => !vorhandeneKey.has(`${a.eintrag.targetType}:${a.eintrag.id}`),
      )
      .map((a) => ({
        documentId,
        targetType: a.eintrag.targetType,
        kompetenzId: a.eintrag.targetType === "kompetenz" ? a.eintrag.id : null,
        anwendungsbereichId:
          a.eintrag.targetType === "anwendungsbereich" ? a.eintrag.id : null,
        confidence: a.confidence,
        rationale: a.rationale,
        model: modelName,
      }));

    if (einzufuegen.length > 0) {
      await db.insert(documentLinkSuggestions).values(einzufuegen);
    }
  }

  const ansichten =
    (await loadSuggestionsForDocument(documentId, ownerId)) ?? [];
  return { ok: true, suggestions: ansichten };
}

interface DecisionInput {
  suggestionId: string;
  documentId: string;
  ownerId: string;
  action: "accept" | "reject" | "reset";
}

export interface DecisionResult {
  suggestion: SuggestionView;
}

/**
 * Marks a suggestion as accepted or rejected. On accept the matching
 * manual link in `document_*_links` is also created (idempotent).
 */
export async function decideSuggestion(
  input: DecisionInput,
): Promise<DecisionResult | null> {
  const doc = await loadDocumentForSuggestions(input.documentId, input.ownerId);
  if (!doc) return null;

  const [suggestion] = await db
    .select()
    .from(documentLinkSuggestions)
    .where(
      and(
        eq(documentLinkSuggestions.id, input.suggestionId),
        eq(documentLinkSuggestions.documentId, input.documentId),
      ),
    )
    .limit(1);
  if (!suggestion) return null;

  if (input.action === "accept") {
    // The AI rationale of the suggestion is stored as a note on the
    // link, so it remains traceable why the link exists.
    const note = suggestion.rationale?.trim() ? suggestion.rationale : null;
    if (suggestion.targetType === "kompetenz" && suggestion.kompetenzId) {
      await db
        .insert(documentKompetenzLinks)
        .values({
          documentId: input.documentId,
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
          documentId: input.documentId,
          anwendungsbereichId: suggestion.anwendungsbereichId,
          note,
        })
        .onConflictDoNothing();
    }
  } else if (input.action === "reset") {
    // Suggestion is reset to "open"; if a link already exists (from a
    // previous accept) it is removed so the suggestion state and the
    // link table stay consistent.
    if (suggestion.targetType === "kompetenz" && suggestion.kompetenzId) {
      await db
        .delete(documentKompetenzLinks)
        .where(
          and(
            eq(documentKompetenzLinks.documentId, input.documentId),
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
            eq(documentAnwendungsbereichLinks.documentId, input.documentId),
            eq(
              documentAnwendungsbereichLinks.anwendungsbereichId,
              suggestion.anwendungsbereichId,
            ),
          ),
        );
    }
  }

  const status =
    input.action === "accept"
      ? "accepted"
      : input.action === "reject"
        ? "rejected"
        : "open";
  await db
    .update(documentLinkSuggestions)
    .set({ status, decidedAt: status === "open" ? null : new Date() })
    .where(eq(documentLinkSuggestions.id, input.suggestionId));

  const list = await loadSuggestionsForDocument(
    input.documentId,
    input.ownerId,
  );
  const updated = list?.find((v) => v.id === input.suggestionId);
  if (!updated) return null;
  return { suggestion: updated };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
