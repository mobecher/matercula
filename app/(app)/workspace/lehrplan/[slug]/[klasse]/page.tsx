import Link from "next/link";
import { notFound } from "next/navigation";
import { ladeKlasseUebersicht } from "@/lib/curriculum/repository";

export default async function KlasseUebersichtPage({
  params,
}: {
  params: Promise<{ slug: string; klasse: string }>;
}) {
  const { slug, klasse } = await params;
  const klasseNr = Number.parseInt(klasse, 10);
  if (!Number.isFinite(klasseNr)) notFound();

  const data = await ladeKlasseUebersicht(slug, klasseNr);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <nav className="mb-2 text-xs text-neutral-500">
        <Link className="hover:text-neutral-900" href="/workspace">
          {data.lehrplan.titel}
        </Link>
        <span className="mx-1">›</span>
        <span>{data.klasse.titel}</span>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">{data.klasse.titel}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Kompetenzbereiche im Lehrplan „{data.lehrplan.titel}“
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Kompetenzbereich</th>
              <th className="px-4 py-3 font-medium">Beschreibung</th>
              <th className="px-4 py-3 font-medium text-right">Kompetenzen</th>
              <th className="px-4 py-3 font-medium text-right">Anwendungs­bereiche</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {data.bereiche.map(({ bereich, kompetenzenAnzahl, anwendungsbereicheAnzahl }) => (
              <tr key={bereich.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link
                    className="font-medium text-neutral-900 hover:underline"
                    href={`/workspace/lehrplan/${slug}/${klasseNr}/${bereich.id}`}
                  >
                    {bereich.titel}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {bereich.beschreibung ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                  {kompetenzenAnzahl}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                  {anwendungsbereicheAnzahl}
                </td>
              </tr>
            ))}
            {data.bereiche.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-neutral-500" colSpan={4}>
                  Keine Kompetenzbereiche hinterlegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
