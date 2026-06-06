import { NextRequest } from "next/server";
import { streamClaude, streamDebateEngine } from "@/lib/ai-stream";
import { getRolePrompt, formatDebateHistory, formatModeInput } from "@/lib/prompts";
import { DebateRequestSchema } from "@/lib/api-schemas";
import { getDebateProtocolPrompt } from "@/lib/debate-protocol";

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
    if (modeInput && command && ["consult", "extend", "fix"].includes(command)) {
      userMessage = formatModeInput(command, modeInput);
    } else if (command === "academy") {
      userMessage = `## 학원 운영 토론 주제\n${topic}\n\n개발 프로젝트가 아니라 학원 운영 의사결정으로 분석하세요. 수강생 모집, 상담 전환, 반 편성, 강사 배치, 커리큘럼, 학부모 커뮤니케이션, 재등록률, 매출, 비용, 운영 리스크 관점을 포함하세요.`;
    } else {
      userMessage = `## 주제\n${topic}`;
    }

    if (techSpec) {
      userMessage += `\n\n## 참고 문서\n${techSpec}`;
    }

    const historyText = formatDebateHistory(history);
    if (historyText) userMessage += historyText;

    if (isRefine && feedback) {
      userMessage += `\n\n## 사용자 피드백\n${feedback}`;
    }

    userMessage += `\n\n${getDebateProtocolPrompt(stage)}`;

    userMessage += "\n\n위 내용을 바탕으로 한국어로 분석하세요.";

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
