import { NextRequest } from "next/server";
import { streamClaude, streamDebateEngine } from "@/lib/ai-stream";
import { getClarificationPrompt } from "@/lib/prompts";
import { ClarifyRequestSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = ClarifyRequestSchema.parse(await request.json());
    const { roleId, topic, previousQA, round, debateEngine, phase } = body;

    const systemPrompt = getClarificationPrompt(roleId, topic, previousQA, round, phase);

    const userMessage = phase
      ? `## 아이디어\n${topic}\n\n위 아이디어에 대해 ${phase === "resolution" ? "정리하고 최종 확인 질문을 해주세요" : "질문해주세요"}.`
      : `## 아이디어\n${topic}\n\n위 아이디어에 대해 질문해주세요.`;

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
    if (error?.name === "ZodError") {
      console.error("Validation error:", error.issues);
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    console.error("Clarify API error:", error);
    return Response.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
