import { NextRequest } from "next/server";
import { streamClaude } from "@/lib/ai-stream";
import {
  getCommandGenerationPrompt,
  getHarnessCommandPrompt, buildHarnessCommandUserMessage,
} from "@/lib/prompts";
import { GenerateCommandRequestSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = GenerateCommandRequestSchema.parse(await request.json());
    const { topic, command, prd, modeInput, source, harnessArtifacts } = body;

    let systemPrompt: string;
    let userMessage: string;

    // === 하네스 기반 경로 (PRD 없이 계획만으로 명령 생성) ===
    if (source === "harness" && harnessArtifacts) {
      systemPrompt = getHarnessCommandPrompt();
      userMessage = buildHarnessCommandUserMessage(topic, harnessArtifacts);
    }
    // === 기존 PRD 기반 경로 (변경 없음) ===
    else {
      systemPrompt = getCommandGenerationPrompt(command);
      userMessage = `## 주제\n${topic}\n\n## 문서 내용\n${prd}`;
      if (modeInput) {
        userMessage += `\n\n## 원본 입력 데이터\n${JSON.stringify(modeInput, null, 2)}`;
      }
    }

    const stream = await streamClaude(systemPrompt, userMessage, false);

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
    console.error("Generate command error:", error);
    return Response.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
