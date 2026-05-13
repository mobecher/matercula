import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const showError = Boolean(resolvedSearchParams.error);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Anmeldung</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/auth/login" className="space-y-4" method="post">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {showError ? <p className="text-sm text-red-600">Ungültige Anmeldedaten.</p> : null}
            <button
              type="submit"
              className="inline-flex w-full justify-center rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
            >
              Einloggen
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
