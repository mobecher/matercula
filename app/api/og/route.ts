import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { fetchPage, WebFetchError } from "@/lib/web/fetch-page";

const querySchema = z.object({
  url: z.string().url().max(2048),
});

interface OgMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export async function GET(request: Request) {
  // Auth-gated to avoid turning the route into an open SSRF/proxy.
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ url: searchParams.get("url") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const page = await fetchPage(parsed.data.url);
    const metadata: OgMetadata = {
      url: page.url,
      title: page.title,
      description: page.description,
      image: page.image,
      siteName: page.siteName,
    };
    return NextResponse.json(metadata, {
      headers: {
        // Cache at the edge; client also caches via SWR-ish behavior.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    if (error instanceof WebFetchError) {
      const status =
        error.code === "invalid_url" ||
        error.code === "unsupported_protocol" ||
        error.code === "blocked_host"
          ? 400
          : error.code === "unsupported_content_type"
            ? 415
            : 502;
      return NextResponse.json(
        { error: error.code, message: error.message, status: error.status },
        { status },
      );
    }
    throw error;
  }
}
