import { NextRequest } from "next/server";
import { callStructuredModel } from "@/lib/ai-stream";
import { JudgeRequestSchema } from "@/lib/api-schemas";
import { CONSENSUS_THRESHOLD, JUDGE_MODEL, MAX_ROUNDS } from "@/lib/judge-config";
import { DebaterTurn, fallbackVerdict, parseJudgeVerdict } from "@/lib/judge-loop";
import { buildJudgeMessages } from "@/lib/judge-prompt";
import { JudgeVerdict } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: ReturnType<typeof JudgeRequestSchema.parse>;

  try {
    body = JudgeRequestSchema.parse(await request.json());
  } catch (error: any) {
    if (error?.name === "ZodError") {
      console.error("Judge validation error:", error.issues);
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    throw error;
  }

  const synthesize = body.synthesize ?? false;
  const { system, user } = buildJudgeMessages({
    topic: body.topic,
    transcript: body.transcript as DebaterTurn[],
    round: body.round,
    maxRounds: body.maxRounds ?? MAX_ROUNDS,
    consensusThreshold: body.consensusThreshold ?? CONSENSUS_THRESHOLD,
    synthesize,
  });

  const ac = new AbortController();
  request.signal.addEventListener("abort", () => ac.abort(), { once: true });
  const timer = setTimeout(() => ac.abort(), 100000);

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (ac.signal.aborted) {
        throw new DOMException("AbortError", "AbortError");
      }

      try {
        const raw = await callStructuredModel(system, user, 4096, ac.signal, JUDGE_MODEL);
        const verdict = parseJudgeVerdict(raw);

        if (verdict) {
          if (synthesize && verdict.decision !== "stop") {
            verdict.decision = "stop";
            verdict.final_answer = verdict.final_answer || verdict.reason || "최종 답변을 생성하지 못했습니다.";
          }
          return Response.json(verdict);
        }
      } catch (error) {
        if (ac.signal.aborted || isAbortError(error)) {
          throw error;
        }
        console.error("Judge API attempt failed:", error);
      }
    }

    if (synthesize) {
      const verdict: JudgeVerdict = {
        consensus_level: 0,
        is_superficial_agreement: false,
        decision: "stop",
        reason: "심판 응답 생성에 실패해 최대 라운드에서 종료합니다.",
        final_answer: "심판 최종 종합 답변을 생성하지 못했습니다. 지금까지의 토론 내용을 기준으로 결론을 확인해 주세요.",
      };
      return Response.json(verdict);
    }

    return Response.json(fallbackVerdict());
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
