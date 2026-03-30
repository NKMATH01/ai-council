/**
 * Side effect utilities for debate workflows.
 * These are pure functions that perform network operations,
 * extracted from useDebate.ts for reusability and testability.
 *
 * NOTE: These are atomic operations (fetch a stream, save a session, call an API).
 * Workflow orchestrations that sequence multiple effects belong in debate-workflows.
 */

import { DebateState, Session } from "./types";
import { buildSessionFromState } from "./session-mappers";

// ---------------------------------------------------------------------------
// Network error detection
// ---------------------------------------------------------------------------

/** Check whether an error looks like a network/connectivity failure. */
export function isNetworkError(e: unknown): boolean {
  const msg = ((e as any)?.message || "").toLowerCase();
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    (msg.includes("aborted") === false &&
      (msg.includes("timeout") ||
        msg.includes("econnreset") ||
        msg.includes("socket")))
  );
}

// ---------------------------------------------------------------------------
// Streaming fetch with abort support & auto-retry
// ---------------------------------------------------------------------------

/**
 * Streaming POST request that invokes `onChunk` with the accumulated text
 * each time a new chunk arrives.
 *
 * - Automatically retries once on network errors (after a 2 s delay).
 * - Supports an external `AbortSignal` so callers can cancel.
 * - On retry the accumulated text is reset and `onChunk("")` is called
 *   so the UI can clear any partial output.
 *
 * Returns the full accumulated response text.
 */
export async function streamFetch(
  url: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const attempt = async (retry: boolean): Promise<string> => {
    let full = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "API 요청 실패" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림 읽기 실패");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        onChunk(full);
      }

      return full;
    } catch (e: any) {
      if (e.name === "AbortError") throw e;
      // Network error + retries left → one automatic retry
      if (retry && isNetworkError(e)) {
        await new Promise((r) => setTimeout(r, 2000));
        onChunk(""); // reset stream so UI clears partial output
        return attempt(false);
      }
      throw e;
    }
  };

  return attempt(true);
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

/**
 * Save a debate session to the backend (POST /api/sessions).
 * Throws on failure so callers can handle the error.
 */
export async function saveSession(
  state: DebateState,
  statusOverride?: string,
): Promise<void> {
  const session = buildSessionFromState(state, statusOverride);
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!res.ok) {
    throw new Error("세션 저장 실패");
  }
}

/**
 * Load a session from the backend by id (GET /api/sessions/:id).
 * Returns `null` when the session is not found.
 */
export async function loadSessionData(
  sessionId: string,
): Promise<Session | null> {
  const res = await fetch(`/api/sessions/${sessionId}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Persist a UI version snapshot (PATCH /api/sessions).
 * Fire-and-forget friendly — callers typically `.catch(() => {})`.
 */
export async function saveUiVersion(
  debateId: string,
  htmlCode: string,
  modificationRequest: string,
): Promise<void> {
  await fetch("/api/sessions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, htmlCode, modificationRequest }),
  });
}

// ---------------------------------------------------------------------------
// AI API calls
// ---------------------------------------------------------------------------

/**
 * Fetch a project-type / role recommendation from the AI (POST /api/recommend).
 */
export async function fetchRecommendation(
  topic: string,
): Promise<any> {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error("추천 분석 실패");
  return res.json();
}
