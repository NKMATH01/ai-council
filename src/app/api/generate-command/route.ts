import { NextRequest } from "next/server";
import { GenerateCommandRequest } from "@/lib/types";
import { streamClaude } from "@/lib/ai-stream";
import { getCommandGenerationPrompt } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: GenerateCommandRequest = await request.json();
    const { topic, command, prd, modeInput } = body;

    const systemPrompt = getCommandGenerationPrompt(command);

    let userMessage = `## 주제\n${topic}\n\n## 문서 내용\n${prd}`;
    if (modeInput) {
      userMessage += `\n\n## 원본 입력 데이터\n${JSON.stringify(modeInput, null, 2)}`;
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
    console.error("Generate command error:", error);
    return Response.json(
      { error: error.message || "명령문 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
