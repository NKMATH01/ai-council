// 심판(Judge) 라이브 스모크 — 실제 3벤더 토론자 + Claude 심판을 dev 서버로 구동한다.
//
// 사전 준비:
//   1) .env.local 에 ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY 설정
//   2) 별도 터미널에서 dev 서버 실행:  npm run dev   (포트 3030)
//   3) node scripts/smoke-judge.cjs        (또는 npm run smoke:judge)
//
// 환경변수:
//   SMOKE_BASE        기본 http://localhost:3030
//   SMOKE_MAX_ROUNDS  기본 judge-config 의 MAX_ROUNDS (토큰 폭주 방지용 상한)
//
// 실제 API 토큰 비용이 발생한다. CI 에는 포함하지 않는다.

const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

// TS 런타임 트랜스파일 훅 (run-harness-tests.cjs 와 동일 방식)
require.extensions[".ts"] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(transpiled.outputText, filename);
};

const { runJudgeLoop } = require(path.resolve(__dirname, "..", "src", "lib", "judge-loop.ts"));
const { DEBATER_LINEUP, MAX_ROUNDS } = require(path.resolve(__dirname, "..", "src", "lib", "judge-config.ts"));

const BASE = process.env.SMOKE_BASE || "http://localhost:3030";
const MAX = Number(process.env.SMOKE_MAX_ROUNDS) || MAX_ROUNDS;
const CONFIRMED = DEBATER_LINEUP.map((d) => d.roleId);

let currentTopic = "";
let transcript = []; // /api/debate 에 history 로 전달할 누적 메시지

async function callDebater(engine, roleId, round, stage, guidance) {
  const res = await fetch(`${BASE}/api/debate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roleId,
      topic: currentTopic,
      stage,
      confirmedRoles: CONFIRMED,
      history: transcript,
      command: "judge",
      debateEngine: engine,
      ...(guidance ? { feedback: guidance, isRefine: true } : {}),
    }),
  });
  if (!res.ok) throw new Error(`/api/debate ${res.status}: ${await res.text().catch(() => "")}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  transcript.push({ id: `${stage}-${roleId}-${round}`, roleId, stage, content: text, timestamp: Date.now() });
  return text;
}

async function callJudge(round, turns, synthesize) {
  const res = await fetch(`${BASE}/api/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: currentTopic,
      transcript: turns.map((t) => ({ round: t.round, engine: t.engine, roleId: t.roleId, content: t.content })),
      round,
      maxRounds: MAX,
      synthesize,
    }),
  });
  if (!res.ok) throw new Error(`/api/judge ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

async function runCase(label, topic) {
  currentTopic = topic;
  transcript = [];
  console.log(`\n=== [${label}] ${topic} ===`);
  const result = await runJudgeLoop({
    maxRounds: MAX,
    lineup: DEBATER_LINEUP,
    callDebater,
    callJudge,
    onVerdict: (v, r) =>
      console.log(`  [R${r}] decision=${v.decision} consensus=${v.consensus_level} superficial=${v.is_superficial_agreement} :: ${v.reason}`),
  });
  console.log(`  -> rounds=${result.rounds} stopReason=${result.stopReason} finalAnswerLen=${result.finalAnswer.length}`);
  return result;
}

(async () => {
  console.log(`심판 스모크 시작 — BASE=${BASE} MAX_ROUNDS=${MAX}`);
  const easy = await runCase("EASY(동조 예상)", "2 + 2 는 얼마인가? 근거와 함께 간단히 답하라.");
  const contested = await runCase(
    "CONTESTED(충돌 예상)",
    "원격근무와 사무실 복귀 중 팀 생산성에 무엇이 더 유리한가? 서로 다른 입장에서 근거를 들어 논쟁하라.",
  );

  const ok = [easy, contested].every(
    (r) => (r.stopReason === "judge_stop" || r.stopReason === "max_rounds") && r.finalAnswer.length > 0,
  );
  console.log(`\n${ok ? "SMOKE PASS" : "SMOKE FAIL"}`);
  process.exitCode = ok ? 0 : 1;
})().catch((error) => {
  console.error("\nSMOKE ERROR:", error instanceof Error ? error.message : error);
  console.error("dev 서버(npm run dev, 3030)가 떠 있는지, .env.local 키가 설정됐는지 확인하세요.");
  process.exitCode = 1;
});
