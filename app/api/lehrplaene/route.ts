import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { loadLehrplanSidebar } from "@/lib/curriculum/repository";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const lehrplaene = await loadLehrplanSidebar();
  return NextResponse.json({ lehrplaene });
}
