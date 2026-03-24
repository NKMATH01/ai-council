import { NextRequest } from "next/server";
import { SynthesizeRequest } from "@/lib/types";
import { streamClaude } from "@/lib/ai-stream";
import { getPrdPrompt, formatDebateHistory, formatModeInput } from "@/lib/prompts";
import { ROLE_POOL } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: SynthesizeRequest = await request.json();
    const {
      topic, messages, confirmedRoles,
      verificationResult, feedbacks,
      previousPrd, feedback,
      mode = "initial",
      techSpec, modeInput, command,
    } = body;

    const systemPrompt = getPrdPrompt(topic, mode, command);

    const roleList = confirmedRoles
      .map((r) => `${ROLE_POOL[r].emoji} ${ROLE_POOL[r].koreanName}`)
      .join(", ");

    let userMessage = "";

    // 모드별 입력 포맷
    if (modeInput && command && ["consult", "extend", "fix"].includes(command)) {
      userMessage = formatModeInput(command, modeInput);
      userMessage += `\n\n## 참여 역할\n${roleList}`;
    } else {
      userMessage = `## 주제\n${topic}\n\n## 참여 역할\n${roleList}`;
    }

    // 기술 스펙 문서
    if (techSpec) {
      userMessage += `\n\n## 기술 스펙 문서\n${techSpec}`;
    }

    const historyText = formatDebateHistory(messages);
    if (historyText) userMessage += historyText;

    if (verificationResult) {
      userMessage += `\n\n## 외부 검증 결과\n${verificationResult}`;
    }

    if (feedbacks && feedbacks.length > 0) {
      userMessage += `\n\n## 사용자 피드백 이력`;
      for (const fb of feedbacks) {
        userMessage += `\n\n**v${fb.afterRevision} 이후 피드백:**\n${fb.content}`;
      }
    }

    if (mode === "refine" && previousPrd) {
      userMessage += `\n\n## 이전 문서\n${previousPrd}`;
    }
    if (mode === "refine" && feedback) {
      userMessage += `\n\n## 최신 사용자 피드백 (최우선 반영)\n${feedback}`;
    }

    const docName = command === "consult" ? "의견 종합 보고서"
      : command === "extend" ? "기능 확장 계획서"
      : command === "fix" ? "구조 수정 계획서"
      : "PRD";

    userMessage += `\n\n위 내용을 종합하여 완성된 ${docName}를 작성해주세요.`;

    // PRD는 Opus 4.6으로 생성 (useOpus = true)
    const stream = await streamClaude(systemPrompt, userMessage, true);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Synthesize API error:", error);
    return Response.json(
      { error: error.message || "문서 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
