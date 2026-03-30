import { NextRequest } from "next/server";
import { streamVerification } from "@/lib/ai-stream";
import { getVerificationPrompt, formatDebateHistory } from "@/lib/prompts";
import { ROLE_POOL } from "@/lib/constants";
import { VerifyRequestSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = VerifyRequestSchema.parse(await request.json());
    const { provider, topic, messages, confirmedRoles } = body;

    const systemPrompt = getVerificationPrompt(topic);

    const roleList = confirmedRoles
      .map((r) => `${ROLE_POOL[r].emoji} ${ROLE_POOL[r].koreanName}`)
      .join(", ");

    let userMessage = `## 주제\n${topic}\n\n## 참여 역할\n${roleList}`;
    const historyText = formatDebateHistory(messages);
    if (historyText) userMessage += historyText;

    userMessage += `\n\n위 토론 내용을 검증해주세요.`;

    const stream = await streamVerification(provider, systemPrompt, userMessage);

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
    console.error("Verify API error:", error);
    return Response.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
