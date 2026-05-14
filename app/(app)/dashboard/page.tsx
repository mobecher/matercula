import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    redirect("/login");
  }

  const user = await getSessionUser(sessionId);

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Willkommen, {user.name}.</p>
      <p className="text-sm text-neutral-600">Dieser Bereich ist geschützt.</p>
      <a
        className="inline-block w-fit rounded-md bg-neutral-900 px-4 py-2 text-white"
        href="/workspace"
      >
        Arbeitsbereich öffnen
      </a>
      <form action="/api/auth/logout" method="post">
        <button
          className="rounded-md bg-neutral-900 px-4 py-2 text-white"
          type="submit"
        >
          Abmelden
        </button>
      </form>
    </main>
  );
}
