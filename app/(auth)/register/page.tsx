import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const errorMessage = (code: string | undefined) => {
  switch (code) {
    case "exists":
      return "Diese E-Mail-Adresse ist bereits registriert.";
    case "invalid":
      return "Bitte überprüfe deine Eingaben (Passwort mindestens 8 Zeichen).";
    case "server":
      return "Registrierung fehlgeschlagen. Bitte später erneut versuchen.";
    default:
      return null;
  }
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawError = resolvedSearchParams.error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const message = errorMessage(errorCode);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Registrierung</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/auth/register" className="space-y-4" method="post">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" type="text" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
              <p className="text-xs text-neutral-500">Mindestens 8 Zeichen.</p>
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <button
              type="submit"
              className="inline-flex w-full justify-center rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
            >
              Konto anlegen
            </button>
            <p className="text-center text-sm text-neutral-600">
              Bereits ein Konto?{" "}
              <Link href="/login" className="underline hover:text-neutral-900">
                Anmelden
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
