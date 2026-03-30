import { NextRequest } from "next/server";
import { callClaude } from "@/lib/ai-stream";
import { getRecommendationPrompt } from "@/lib/prompts";
import { RecommendRequestSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { topic } = RecommendRequestSchema.parse(await request.json());

    const systemPrompt = getRecommendationPrompt();
    const result = await callClaude(systemPrompt, topic);

    // JSON 파싱 (마크다운 코드블록 제거)
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const recommendation = JSON.parse(cleaned);

    return Response.json(recommendation);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      console.error("Validation error:", error.issues);
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    console.error("Recommend API error:", error);
    return Response.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
