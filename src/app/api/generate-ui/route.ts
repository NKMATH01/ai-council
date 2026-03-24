import { NextRequest } from "next/server";
import { GenerateUiRequest } from "@/lib/types";
import { streamGemini } from "@/lib/ai-stream";
import { getUiPrototypePrompt, getUiRefinePrompt } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: GenerateUiRequest = await request.json();
    const { prd, existingHtml, modificationRequest } = body;

    let systemPrompt: string;
    let userMessage: string;

    if (existingHtml && modificationRequest) {
      // 수정 요청
      systemPrompt = getUiRefinePrompt();
      userMessage = `## 기존 HTML 코드\n${existingHtml}\n\n## 수정 요청\n${modificationRequest}`;
    } else {
      // 초기 생성
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
