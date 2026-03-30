import { NextRequest } from "next/server";
import { searchSessions, findSimilarDebates } from "@/lib/session-store";
import { SearchSimilarRequestSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";

// GET: search sessions (query params — no body validation needed)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get("q") || undefined;
    const mode = searchParams.get("mode") || undefined;
    const dateFrom = searchParams.get("from") || undefined;
    const dateTo = searchParams.get("to") || undefined;

    const results = await searchSessions({ text, mode, dateFrom, dateTo });
    return Response.json(results);
  } catch (error: any) {
    console.error("Search GET API error:", error);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// POST: find similar debates
export async function POST(request: NextRequest) {
  try {
    const { topic, excludeId } = SearchSimilarRequestSchema.parse(await request.json());
    if (topic.trim().length < 2) {
      return Response.json([]);
    }
    const similar = await findSimilarDebates(topic.trim(), excludeId);
    return Response.json(similar);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      console.error("Validation error:", error.issues);
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    console.error("Search POST API error:", error);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
