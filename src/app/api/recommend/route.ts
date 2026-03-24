import { NextRequest } from "next/server";
import { callClaude } from "@/lib/ai-stream";
import { getRecommendationPrompt } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    const systemPrompt = getRecommendationPrompt();
    const result = await callClaude(systemPrompt, topic);

    // JSON 파싱 (마크다운 코드블록 제거)
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const recommendation = JSON.parse(cleaned);

    return Response.json(recommendation);
  } catch (error: any) {
    console.error("Recommend API error:", error);
    return Response.json(
      { error: error.message || "추천 분석 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
