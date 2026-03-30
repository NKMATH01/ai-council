/**
 * AI 호출 공통 로거
 * 모든 AI API 호출의 request id, model, token usage, latency를 기록합니다.
 */

let requestCounter = 0;

export interface AiLogEntry {
  requestId: string;
  model: string;
  provider: "anthropic" | "openai" | "google";
  action: string;           // e.g., "streamClaude", "callClaudeStructured"
  startedAt: number;
  completedAt?: number;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

export function createRequestId(): string {
  requestCounter++;
  return `ai-${Date.now()}-${requestCounter}`;
}

export function logAiStart(entry: Pick<AiLogEntry, "requestId" | "model" | "provider" | "action">): void {
  console.log(
    `[ai-logger] START ${entry.requestId} | ${entry.provider}/${entry.model} | ${entry.action}`
  );
}

export function logAiComplete(
  requestId: string,
  startedAt: number,
  meta?: { inputTokens?: number; outputTokens?: number }
): void {
  const latencyMs = Date.now() - startedAt;
  const tokens = meta?.inputTokens || meta?.outputTokens
    ? ` | in:${meta.inputTokens ?? "?"} out:${meta.outputTokens ?? "?"}`
    : "";
  console.log(
    `[ai-logger] DONE  ${requestId} | ${latencyMs}ms${tokens}`
  );
}

export function logAiError(requestId: string, startedAt: number, error: string): void {
  const latencyMs = Date.now() - startedAt;
  console.error(
    `[ai-logger] ERROR ${requestId} | ${latencyMs}ms | ${error}`
  );
}
