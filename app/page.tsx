import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Lehrplan-Tagger</h1>
      <p className="text-center text-neutral-600">
        Grundgerüst ist bereit. Bitte melde dich an, um das Dashboard zu sehen.
      </p>
      <Link
        className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
        href="/login"
      >
        Zum Login
      </Link>
    </main>
  );
}
