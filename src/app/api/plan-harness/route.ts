import { NextRequest } from "next/server";
import { PlanHarnessStreamEvent } from "@/lib/types";
import { runPlanHarness } from "@/lib/plan-harness";
import { PlanHarnessRequestSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/plan-harness
 *
 * NDJSON 스트리밍 응답.
 * Content-Type: application/x-ndjson
 *
 * 각 줄은 PlanHarnessStreamEvent JSON 객체.
 * 이벤트 순서 (실제 오케스트레이션 기준):
 *   started → stage_started(normalize) → attempt(s) →
 *   stage_started(cps) → attempt(s) →
 *   stage_started(generate) → attempt(s) →
 *   stage_started(lint) → lint_result → attempt →
 *   [stage_started(repair) → stage_started(generate) → ...] →
 *   stage_started(evaluate) → attempt(s) → evaluation_result →
 *   completed | error
 */
export async function POST(req: NextRequest) {
  let body: ReturnType<typeof PlanHarnessRequestSchema.parse>;
  try {
    body = PlanHarnessRequestSchema.parse(await req.json());
  } catch (parseError: any) {
    const message = parseError?.name === "ZodError"
      ? "잘못된 요청입니다."
      : "Invalid request body";
    if (parseError?.name === "ZodError") {
      console.error("Validation error:", parseError.issues);
    }
    return new Response(
      JSON.stringify({ event: "error", message, attempts: [], timestamp: Date.now() }) + "\n",
      { status: 400, headers: ndjsonHeaders() },
    );
  }

  const { topic, command, modeInput, techSpec, referencePrd, revisionRequest, previousPlanSummary, models } = body;

  const encoder = new TextEncoder();

  // 클라이언트 연결 해제 감지를 위한 AbortController
  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: PlanHarnessStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          // stream already closed (client disconnected)
          abortController.abort();
        }
      };

      try {
        await runPlanHarness(
          {
            topic,
            command: command || "debate",
            modeInput: modeInput || undefined,
            techSpec: techSpec || undefined,
            referencePrd: referencePrd || undefined,
            revisionRequest: revisionRequest || undefined,
            previousPlanSummary: previousPlanSummary || undefined,
          },
          { onEvent: send, signal: abortController.signal, models: models || undefined },
        );
      } catch (error: any) {
        console.error("Plan harness API error:", error);
        if (!abortController.signal.aborted) {
          send({
            event: "error",
            message: "AI 응답 생성 중 오류가 발생했습니다.",
            attempts: [],
            timestamp: Date.now(),
          });
        }
      }

      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, { headers: ndjsonHeaders() });
}

function ndjsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Content-Type-Options": "nosniff",
  };
}
