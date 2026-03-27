import { PlanAttempt } from "./types";

/**
 * 클라이언트 실시간 attempts와 서버 final attempts를 안전하게 병합한다.
 *
 * 병합 규칙:
 * 1. attempt 번호 + stage 를 dedupe key로 사용
 * 2. 동일 key가 양쪽에 있으면 서버 값을 우선 (더 완전한 issues/model/provider를 가질 수 있음)
 * 3. 클라이언트에만 있는 attempt는 유지 (서버가 아직 안 보냈거나 abort로 누락)
 * 4. 서버에만 있는 attempt는 추가 (클라이언트가 이벤트를 놓침)
 * 5. 최종 결과는 attempt 번호 오름차순
 */
export function mergeAttempts(
  clientAttempts: PlanAttempt[],
  serverAttempts: PlanAttempt[],
): PlanAttempt[] {
  const merged = new Map<string, PlanAttempt>();

  // 클라이언트 먼저 넣기
  for (const a of clientAttempts) {
    merged.set(attemptKey(a), a);
  }

  // 서버 값으로 덮어쓰기 (동일 key면 서버 우선)
  for (const a of serverAttempts) {
    const key = attemptKey(a);
    const existing = merged.get(key);
    if (!existing || shouldPreferServer(existing, a)) {
      merged.set(key, a);
    }
  }

  // attempt 번호 오름차순 정렬
  return [...merged.values()].sort((a, b) => a.attempt - b.attempt);
}

function attemptKey(a: PlanAttempt): string {
  return `${a.attempt}:${a.stage}`;
}

/**
 * 서버 값을 우선할지 판단.
 * 서버 쪽이 더 완전한 정보를 가질 가능성이 높으면 true.
 */
function shouldPreferServer(client: PlanAttempt, server: PlanAttempt): boolean {
  // issues가 서버 쪽이 더 많거나, 클라이언트에 없는 model/provider가 서버에 있으면 서버 우선
  if (server.issues.length > client.issues.length) return true;
  if (!client.model && server.model) return true;
  if (!client.provider && server.provider) return true;
  // 기본: 서버 우선 (final payload가 더 정확)
  return true;
}
