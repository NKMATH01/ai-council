import { NextRequest } from "next/server";
import { searchSessions, findSimilarDebates } from "@/lib/session-store";

export const runtime = "nodejs";

// GET: search sessions
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
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST: find similar debates
export async function POST(request: NextRequest) {
  try {
    const { topic, excludeId } = await request.json();
    if (!topic || topic.trim().length < 2) {
      return Response.json([]);
    }
    const similar = await findSimilarDebates(topic.trim(), excludeId);
    return Response.json(similar);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
