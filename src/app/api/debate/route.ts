import { NextRequest } from "next/server";
import { streamClaude, streamDebateEngine } from "@/lib/ai-stream";
import { getRolePrompt, formatDebateHistory, formatModeInput } from "@/lib/prompts";
import { DebateRequestSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = DebateRequestSchema.parse(await request.json());
    const {
      roleId, topic, stage, confirmedRoles,
      history, feedback, isRefine = false,
      debateEngine, techSpec, modeInput, command,
    } = body;

    const systemPrompt = getRolePrompt(roleId, stage, confirmedRoles, command, techSpec);

    let userMessage = "";

    // 모드별 입력 포맷
    if (modeInput && command && ["consult", "extend", "fix"].includes(command)) {
      userMessage = formatModeInput(command, modeInput);
    } else {
      userMessage = `## 주제\n${topic}`;
    }

    // 기술 스펙 문서 추가
    if (techSpec) {
      userMessage += `\n\n## 기술 스펙 문서\n${techSpec}`;
    }

    const historyText = formatDebateHistory(history);
    if (historyText) userMessage += historyText;

    if (isRefine && feedback) {
      userMessage += `\n\n## 사용자 피드백 (최우선 반영)\n${feedback}`;
    }

    userMessage += `\n\n위 내용을 바탕으로 분석해주세요.`;

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
    console.error("Debate API error:", error);
    return Response.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
