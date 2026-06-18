import assert from "node:assert/strict";

import {
  fallbackVerdict,
  JudgeLoopOptions,
  parseJudgeVerdict,
  runJudgeLoop,
} from "./judge-loop";
import { shouldUseJudge } from "./judge-config";
import { buildSessionRow, mapRowToSession } from "./session-mappers";
import type { JudgeVerdict, Session } from "./types";

function makeJudgeSession(judgeVerdicts: JudgeVerdict[]): Session {
  return {
    id: "judge-test-session",
    topic: "테스트 주제",
    command: "judge",
    recommendation: null,
    confirmedRoles: ["architect", "critic", "creative"],
    messages: [],
    verificationProvider: null,
    verificationResult: "",
    prd: "",
    prdRevisions: [],
    revisionCount: 0,
    feedbacks: [],
    judgeVerdicts,
    status: "complete",
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}

const lineup: JudgeLoopOptions["lineup"] = [
  { engine: "gemini", roleId: "architect" },
  { engine: "gpt", roleId: "critic" },
  { engine: "claude-sonnet", roleId: "creative" },
];

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

(async () => {
  await test("parseJudgeVerdict parses valid JSON string", () => {
    const verdict = parseJudgeVerdict(JSON.stringify({
      consensus_level: 0.91,
      is_superficial_agreement: false,
      decision: "stop",
      reason: "수렴했습니다.",
      final_answer: "최종안",
    }));

    assert.equal(verdict?.decision, "stop");
    assert.equal(verdict?.consensus_level, 0.91);
  });

  await test("parseJudgeVerdict parses json code fence", () => {
    const verdict = parseJudgeVerdict([
      "```json",
      "{\"consensus_level\":0.4,\"is_superficial_agreement\":true,\"decision\":\"continue\",\"reason\":\"충돌\",\"guidance_for_next_round\":\"더 비판\"}",
      "```",
    ].join("\n"));

    assert.equal(verdict?.decision, "continue");
    assert.equal(verdict?.is_superficial_agreement, true);
  });

  await test("parseJudgeVerdict extracts JSON from surrounding text", () => {
    const verdict = parseJudgeVerdict([
      "설명입니다.",
      "{\"consensus_level\":0.7,\"is_superficial_agreement\":false,\"decision\":\"continue\",\"reason\":\"남은 쟁점\"}",
      "끝입니다.",
    ].join("\n"));

    assert.equal(verdict?.decision, "continue");
    assert.equal(verdict?.consensus_level, 0.7);
  });

  await test("parseJudgeVerdict returns null for malformed input", () => {
    assert.equal(parseJudgeVerdict("{ not json"), null);
  });

  await test("fallbackVerdict returns continue decision", () => {
    assert.equal(fallbackVerdict().decision, "continue");
  });

  await test("runJudgeLoop stops on round 1 judge stop", async () => {
    const result = await runJudgeLoop({
      maxRounds: 4,
      lineup,
      callDebater: async (engine, roleId, round) => `${round}:${engine}:${roleId}`,
      callJudge: async () => ({
        consensus_level: 0.95,
        is_superficial_agreement: false,
        decision: "stop",
        reason: "충분히 수렴했습니다.",
        final_answer: "최종 결론",
      }),
    });

    assert.equal(result.rounds, 1);
    assert.equal(result.stopReason, "judge_stop");
    assert.equal(result.finalAnswer, "최종 결론");
  });

  await test("runJudgeLoop synthesizes after max rounds", async () => {
    let callJudgeCount = 0;
    const result = await runJudgeLoop({
      maxRounds: 3,
      lineup,
      callDebater: async (engine, roleId, round) => `${round}:${engine}:${roleId}`,
      callJudge: async (_round, _turns, synthesize) => {
        callJudgeCount += 1;
        return synthesize
          ? {
              consensus_level: 0.8,
              is_superficial_agreement: false,
              decision: "stop",
              reason: "최대 라운드",
              final_answer: "종합 결론",
            }
          : {
              consensus_level: 0.2,
              is_superficial_agreement: false,
              decision: "continue",
              reason: "계속",
              guidance_for_next_round: "더 구체화",
            };
      },
    });

    assert.equal(result.rounds, 3);
    assert.equal(result.stopReason, "max_rounds");
    assert.equal(callJudgeCount, 4);
  });

  await test("runJudgeLoop passes guidance into round 2 debaters", async () => {
    const round2Guidance: Array<string | undefined> = [];
    const result = await runJudgeLoop({
      maxRounds: 4,
      lineup,
      callDebater: async (_engine, _roleId, round, _stage, guidance) => {
        if (round === 2) round2Guidance.push(guidance);
        return `round ${round}`;
      },
      callJudge: async (round) => round === 1
        ? {
            consensus_level: 0.3,
            is_superficial_agreement: false,
            decision: "continue",
            reason: "더 필요",
            guidance_for_next_round: "X 지적하라",
          }
        : {
            consensus_level: 0.9,
            is_superficial_agreement: false,
            decision: "stop",
            reason: "완료",
            final_answer: "최종",
          },
    });

    assert.equal(result.rounds, 2);
    assert.deepEqual(round2Guidance, ["X 지적하라", "X 지적하라", "X 지적하라"]);
  });

  await test("runJudgeLoop aborts before any debater call", async () => {
    const ac = new AbortController();
    ac.abort();
    let callDebaterCount = 0;
    let callJudgeCount = 0;

    await assert.rejects(() => runJudgeLoop({
      maxRounds: 4,
      lineup,
      signal: ac.signal,
      callDebater: async () => {
        callDebaterCount += 1;
        return "should not run";
      },
      callJudge: async () => {
        callJudgeCount += 1;
        return {
          consensus_level: 0.9,
          is_superficial_agreement: false,
          decision: "stop",
          reason: "should not run",
        };
      },
    }), /AbortError/);

    assert.equal(callDebaterCount, 0);
    assert.equal(callJudgeCount, 0);
  });

  await test("runJudgeLoop aborts after first debater without judge call", async () => {
    const ac = new AbortController();
    let callDebaterCount = 0;
    let callJudgeCount = 0;

    await assert.rejects(() => runJudgeLoop({
      maxRounds: 4,
      lineup,
      signal: ac.signal,
      callDebater: async () => {
        callDebaterCount += 1;
        ac.abort();
        return "first turn";
      },
      callJudge: async () => {
        callJudgeCount += 1;
        return {
          consensus_level: 0.9,
          is_superficial_agreement: false,
          decision: "stop",
          reason: "should not run",
        };
      },
    }), /AbortError/);

    assert.equal(callDebaterCount, 1);
    assert.equal(callJudgeCount, 0);
  });

  await test("runJudgeLoop aborts from onTurn before judge call", async () => {
    const ac = new AbortController();
    let callDebaterCount = 0;
    let callJudgeCount = 0;

    await assert.rejects(() => runJudgeLoop({
      maxRounds: 4,
      lineup: [lineup[0]],
      signal: ac.signal,
      callDebater: async () => {
        callDebaterCount += 1;
        return "first turn";
      },
      callJudge: async () => {
        callJudgeCount += 1;
        return {
          consensus_level: 0.9,
          is_superficial_agreement: false,
          decision: "stop",
          reason: "should not run",
        };
      },
      onTurn: () => {
        ac.abort();
      },
    }), /AbortError/);

    assert.equal(callDebaterCount, 1);
    assert.equal(callJudgeCount, 0);
  });

  await test("shouldUseJudge resolves env and session toggles", () => {
    assert.equal(shouldUseJudge(false, undefined), false);
    assert.equal(shouldUseJudge(true, undefined), true);
    assert.equal(shouldUseJudge(false, true), true);
    assert.equal(shouldUseJudge(false, false), false);
  });

  const sampleVerdicts: JudgeVerdict[] = [{
    consensus_level: 0.9,
    is_superficial_agreement: false,
    decision: "stop",
    reason: "수렴",
    final_answer: "최종안",
    round: 1,
  }];

  await test("buildSessionRow dedicated stores verdicts in column, not piggyback", () => {
    const row = buildSessionRow(makeJudgeSession(sampleVerdicts));
    assert.deepEqual(row.judge_verdicts, sampleVerdicts);
    const rec = row.recommendation as Record<string, unknown> | null;
    assert.ok(!rec || !("_judgeVerdicts" in rec));
    assert.deepEqual(mapRowToSession(row, "").judgeVerdicts, sampleVerdicts);
  });

  await test("buildSessionRow legacy piggybacks verdicts into recommendation", () => {
    const row = buildSessionRow(makeJudgeSession(sampleVerdicts), { judgeStorage: "legacy" });
    assert.equal(row.judge_verdicts, undefined);
    const rec = row.recommendation as Record<string, unknown>;
    assert.deepEqual(rec._judgeVerdicts, sampleVerdicts);
    assert.deepEqual(mapRowToSession(row, "").judgeVerdicts, sampleVerdicts);
  });

  await test("mapRowToSession restores verdicts from pre-migration piggyback", () => {
    // 마이그레이션 전: judge_verdicts 컬럼이 없는 상태(키 부재) + recommendation 내 _judgeVerdicts
    const row = buildSessionRow(makeJudgeSession(sampleVerdicts), { judgeStorage: "legacy" });
    delete (row as { judge_verdicts?: unknown }).judge_verdicts;
    assert.deepEqual(mapRowToSession(row, "").judgeVerdicts, sampleVerdicts);
  });

  console.log(`passed ${passed} judge tests`);
})().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
