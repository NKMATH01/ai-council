import { NextRequest } from "next/server";
import { GenerateUiRequest } from "@/lib/types";
import { streamGemini } from "@/lib/ai-stream";
import {
  getUiPrototypePrompt, getUiRefinePrompt,
  getHarnessUiPrompt, buildHarnessUiUserMessage,
} from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: GenerateUiRequest = await request.json();
    const { prd, existingHtml, modificationRequest, source, harnessArtifacts } = body;

    let systemPrompt: string;
    let userMessage: string;

    if (existingHtml && modificationRequest) {
      // 수정 요청 (하네스/일반 공통)
      systemPrompt = getUiRefinePrompt();
      userMessage = `## 기존 HTML 코드\n${existingHtml}\n\n## 수정 요청\n${modificationRequest}`;
    }
    // === 하네스 기반 초기 생성 (PRD 없이 계획만으로) ===
    else if (source === "harness" && harnessArtifacts) {
      systemPrompt = getHarnessUiPrompt();
      userMessage = buildHarnessUiUserMessage(harnessArtifacts);
    }
    // === 기존 PRD 기반 초기 생성 (변경 없음) ===
    else {
      systemPrompt = getUiPrototypePrompt();
      userMessage = prd;
    }

    const stream = await streamGemini(systemPrompt, userMessage, undefined, 65536);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Generate UI error:", error);
    return Response.json(
      { error: error.message || "UI 프로토타입 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
