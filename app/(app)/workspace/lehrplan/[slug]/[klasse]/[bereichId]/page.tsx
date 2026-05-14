import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  ladeDokumenteFuerAnwendungsbereich,
  ladeDokumenteFuerKompetenz,
  type VerknuepftesDokument,
} from "@/lib/curriculum/links";
import { ladeKompetenzbereichDetail } from "@/lib/curriculum/repository";

const PERSPEKTIVE_LABEL: Record<string, string> = {
  T: "Technik",
  G: "Gesellschaft",
  I: "Interaktion",
};

const PERSPEKTIVE_BADGE: Record<string, string> = {
  T: "bg-blue-100 text-blue-800",
  G: "bg-amber-100 text-amber-800",
  I: "bg-emerald-100 text-emerald-800",
};

export default async function KompetenzbereichDetailPage({
  params,
}: {
  params: Promise<{ slug: string; klasse: string; bereichId: string }>;
}) {
  const { slug, klasse, bereichId } = await params;
  const data = await ladeKompetenzbereichDetail(bereichId);
  if (!data) notFound();

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = sessionId ? await getSessionUser(sessionId) : null;
  if (!user) notFound();

  // Prefetch verknüpfte Dokumente für jede Zeile (server-side, parallel).
  const [kompDocs, appDocs] = await Promise.all([
    Promise.all(
      data.kompetenzen.map((k) => ladeDokumenteFuerKompetenz(k.id, user.id)),
    ),
    Promise.all(
      data.anwendungsbereiche.map((a) =>
        ladeDokumenteFuerAnwendungsbereich(a.id, user.id),
      ),
    ),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <nav className="mb-2 text-xs text-neutral-500">
        <Link className="hover:text-neutral-900" href="/workspace">
          {data.lehrplan.titel}
        </Link>
        <span className="mx-1">›</span>
        <Link
          className="hover:text-neutral-900"
          href={`/workspace/lehrplan/${slug}/${klasse}`}
        >
          {data.klasse.titel}
        </Link>
        <span className="mx-1">›</span>
        <span>{data.bereich.titel}</span>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">{data.bereich.titel}</h1>
      {data.bereich.beschreibung && (
        <p className="mt-2 text-sm text-neutral-600">{data.bereich.beschreibung}</p>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Kompetenzen</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="w-24 px-4 py-3 font-medium">Perspektive</th>
                <th className="px-4 py-3 font-medium">Beschreibung</th>
                <th className="px-4 py-3 font-medium">Verknüpfte Materialien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {data.kompetenzen.map((k, i) => (
                <tr key={k.id} className="align-top">
                  <td className="px-4 py-3">
                    {k.perspektive ? (
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold ${
                          PERSPEKTIVE_BADGE[k.perspektive] ?? ""
                        }`}
                        title={PERSPEKTIVE_LABEL[k.perspektive]}
                      >
                        {k.perspektive}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-800">{k.beschreibung}</td>
                  <td className="px-4 py-3">
                    <DokumentList docs={kompDocs[i]} />
                  </td>
                </tr>
              ))}
              {data.kompetenzen.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={3}>
                    Keine Kompetenzen hinterlegt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Anwendungsbereiche</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Anwendungsbereich</th>
                <th className="px-4 py-3 font-medium">Verknüpfte Materialien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {data.anwendungsbereiche.map((a, i) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3 text-neutral-800">{a.beschreibung ?? a.titel}</td>
                  <td className="px-4 py-3">
                    <DokumentList docs={appDocs[i]} />
                  </td>
                </tr>
              ))}
              {data.anwendungsbereiche.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={2}>
                    Keine Anwendungsbereiche hinterlegt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DokumentList({ docs }: { docs: VerknuepftesDokument[] }) {
  if (docs.length === 0) {
    return <span className="text-xs text-neutral-400">—</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {docs.map((d) => (
        <li
          key={d.id}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
          title={d.notiz ?? undefined}
        >
          <span aria-hidden>{d.icon ?? "📄"}</span>
          <span className="max-w-40 truncate">{d.titel}</span>
        </li>
      ))}
    </ul>
  );
}
