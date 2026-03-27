import { NextRequest } from "next/server";
import { ClarifyRequest } from "@/lib/types";
import { streamClaude, streamDebateEngine } from "@/lib/ai-stream";
import { getClarificationPrompt } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: ClarifyRequest = await request.json();
    const { roleId, topic, previousQA, round, debateEngine } = body;

    const systemPrompt = getClarificationPrompt(roleId, topic, previousQA, round);

    const userMessage = `## 아이디어\n${topic}\n\n위 아이디어에 대해 질문해주세요.`;

    // 엔진 선택 분기
    const stream = debateEngine
      ? await streamDebateEngine(debateEngine, systemPrompt, userMessage)
      : await streamClaude(systemPrompt, userMessage, false);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Clarify API error:", error);
    return Response.json(
      { error: error.message || "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
