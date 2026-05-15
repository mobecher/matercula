import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceFrame } from "@/components/workspace/workspace-frame";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { loadLehrplanSidebar } from "@/lib/curriculum/repository";
import { loadDocumentTreeForUser } from "@/lib/workspace/repository";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) redirect("/login");
  const user = await getSessionUser(sessionId);
  if (!user) redirect("/login");

  const [baum, lehrplaene] = await Promise.all([
    loadDocumentTreeForUser(user.id),
    loadLehrplanSidebar(),
  ]);

  return (
    <WorkspaceFrame baum={baum} lehrplaene={lehrplaene} benutzerName={user.name}>
      {children}
    </WorkspaceFrame>
  );
}
