import { type ZodType } from "zod";
import { callClaudeStructured } from "./ai-stream";
import { buildEvaluatorPrompt, enforcePassCriteria } from "./plan-evaluator";
import { lintPlan } from "./plan-linter";
import { buildRepairContext, createAttempt, shouldRetry } from "./plan-retry";
import {
  CpsDocument,
  DebateCommand,
  HarnessModelConfig,
  HarnessModelSettings,
  ModeInput,
  PlanAttempt,
  PlanHarnessArtifacts,
  PlanHarnessStreamEvent,
  PlanHarnessStage,
  RequirementSpec,
} from "./types";
import {
  CpsDocumentSchema,
  GeneratedPlanSchema,
  parseAndValidate,
  PlanEvaluationSchema,
  RequirementSpecSchema,
} from "./plan-schema";

// Re-export for backward compat with tests
export type HarnessStage = PlanHarnessStage | "complete" | "failed";

export type OnEvent = (event: PlanHarnessStreamEvent) => void;

// Legacy callback kept for test compat
export type OnProgress = (stage: HarnessStage, artifacts: PlanHarnessArtifacts) => void;

export interface RunPlanHarnessInput {
  topic: string;
  command: DebateCommand;
  modeInput?: ModeInput;
  techSpec?: string;
  referencePrd?: string;
  revisionRequest?: string;
  previousPlanSummary?: string;
}

export type PlanHarnessStructuredCall = (
  systemPrompt: string,
  userMessage: string,
  maxTokens?: number,
  signal?: AbortSignal,
) => Promise<string>;

export interface RunPlanHarnessOptions {
  onProgress?: OnProgress;
  onEvent?: OnEvent;
  callStructured?: PlanHarnessStructuredCall;
  signal?: AbortSignal;
  models?: HarnessModelSettings;
}

const DEFAULT_GENERATION: HarnessModelConfig = { provider: "anthropic", model: "claude-opus-4-6" };
const DEFAULT_EVALUATION: HarnessModelConfig = { provider: "anthropic", model: "claude-opus-4-6" };

function resolveModels(settings?: HarnessModelSettings) {
  return {
    generation: settings?.generation || DEFAULT_GENERATION,
    evaluation: settings?.evaluation || DEFAULT_EVALUATION,
  };
}

export async function runPlanHarness(
  input: RunPlanHarnessInput,
  options: RunPlanHarnessOptions = {},
): Promise<PlanHarnessArtifacts> {
  const artifacts: PlanHarnessArtifacts = {
    lintIssues: [],
    attempts: [],
  };
  const callStructured = options.callStructured ?? callClaudeStructured;
  const signal = options.signal;
  const { generation: genModel, evaluation: evalModel } = resolveModels(options.models);
  let lastStage: PlanHarnessStage | undefined;

  const emit = (ev: PlanHarnessStreamEvent) => {
    options.onEvent?.(ev);
  };
  const progress = (stage: HarnessStage) => {
    options.onProgress?.(stage, { ...artifacts });
  };

  function checkAbort(): boolean {
    if (signal?.aborted) {
      emit({ event: "aborted", stage: lastStage, attempts: [...artifacts.attempts], timestamp: Date.now() });
      return true;
    }
    return false;
  }

  // === started ===
  emit({ event: "started", timestamp: Date.now() });
  if (checkAbort()) return artifacts;

  // === Stage 1: normalize ===
  lastStage = "normalize";
  emit({ event: "stage_started", stage: "normalize", timestamp: Date.now() });
  progress("normalize");
  const normalizeResult = await runWithRetry(artifacts, "normalize", emit, signal, genModel,
    async (repairCtx) => {
      const { system, user } = buildNormalizePrompt(input);
      const raw = await callStructured(system, repairCtx ? `${user}\n\n${repairCtx}` : user, 4096, signal, genModel.model);
      return parseStageResult(raw, RequirementSpecSchema);
    },
  );

  if (checkAbort()) return artifacts;
  if (!normalizeResult.success) {
    emitError(emit, "normalize", artifacts);
    progress("failed");
    return artifacts;
  }
  artifacts.requirementSpec = normalizeResult.data;

  // === Stage 2: cps ===
  lastStage = "cps";
  emit({ event: "stage_started", stage: "cps", timestamp: Date.now() });
  progress("cps");
  if (checkAbort()) return artifacts;
  const cpsResult = await runWithRetry(artifacts, "cps", emit, signal, genModel,
    async (repairCtx) => {
      const { system, user } = buildCpsPrompt(artifacts.requirementSpec!);
      const raw = await callStructured(system, repairCtx ? `${user}\n\n${repairCtx}` : user, 4096, signal, genModel.model);
      return parseStageResult(raw, CpsDocumentSchema);
    },
  );

  if (checkAbort()) return artifacts;
  if (!cpsResult.success) {
    emitError(emit, "cps", artifacts);
    progress("failed");
    return artifacts;
  }
  artifacts.cps = cpsResult.data;

  // === Stage 3: generate + lint + evaluate loop ===
  lastStage = "generate";
  emit({ event: "stage_started", stage: "generate", timestamp: Date.now() });
  progress("generate");
  let repairContext: string | undefined;

  for (let repairCycle = 0; repairCycle < 3; repairCycle++) {
    if (checkAbort()) return artifacts;

    const generateResult = await runWithRetry(artifacts, "generate", emit, signal, genModel,
      async (retryCtx) => {
        const { system, user } = buildPlanPrompt(artifacts.requirementSpec!, artifacts.cps!, retryCtx || repairContext);
        const raw = await callStructured(system, user, 16384, signal, genModel.model);
        return parseStageResult(raw, GeneratedPlanSchema);
      },
    );

    if (checkAbort()) return artifacts;
    if (!generateResult.success) {
      emitError(emit, "generate", artifacts);
      progress("failed");
      return artifacts;
    }

    const plan = generateResult.data;

    // --- lint ---
    lastStage = "lint";
    emit({ event: "stage_started", stage: "lint", timestamp: Date.now() });
    progress("lint");
    const lintIssues = lintPlan(plan, artifacts.requirementSpec);
    const lintErrors = lintIssues.filter((i) => i.severity === "error");
    artifacts.generatedPlan = plan;
    artifacts.lintIssues = lintIssues;

    emit({
      event: "lint_result",
      issues: lintIssues,
      errorCount: lintErrors.length,
      warningCount: lintIssues.length - lintErrors.length,
      timestamp: Date.now(),
    });

    if (lintErrors.length > 0) {
      const lintAttempt = createAttempt(artifacts.attempts.length + 1, "lint", false,
        lintErrors.map((i) => `[${i.code}] ${i.message}`), genModel.model, genModel.provider);
      artifacts.attempts.push(lintAttempt);
      emit({ event: "attempt", attempt: lintAttempt, timestamp: Date.now() });

      if (!shouldRetry(artifacts.attempts, "lint")) {
        emitError(emit, "lint", artifacts);
        progress("failed");
        return artifacts;
      }

      if (checkAbort()) return artifacts;

      repairContext = buildRepairContext({ type: "lint_failure", issues: lintIssues });
      lastStage = "repair";
      emit({ event: "stage_started", stage: "repair", timestamp: Date.now() });
      progress("repair");
      lastStage = "generate";
      emit({ event: "stage_started", stage: "generate", timestamp: Date.now() });
      continue;
    }

    const lintOk = createAttempt(artifacts.attempts.length + 1, "lint", true, [], genModel.model, genModel.provider);
    artifacts.attempts.push(lintOk);
    emit({ event: "attempt", attempt: lintOk, timestamp: Date.now() });

    // --- evaluate ---
    lastStage = "evaluate";
    emit({ event: "stage_started", stage: "evaluate", timestamp: Date.now() });
    progress("evaluate");
    if (checkAbort()) return artifacts;

    const evaluationResult = await runWithRetry(artifacts, "evaluate", emit, signal, evalModel,
      async (retryCtx) => {
        const { system, user } = buildEvaluatorPrompt(artifacts.requirementSpec!, artifacts.cps!, plan);
        const raw = await callStructured(system, retryCtx ? `${user}\n\n${retryCtx}` : user, 4096, signal, evalModel.model);
        return enforcePassCriteria(parseStageResult(raw, PlanEvaluationSchema));
      },
    );

    if (checkAbort()) return artifacts;
    if (!evaluationResult.success) {
      emitError(emit, "evaluate", artifacts);
      progress("failed");
      return artifacts;
    }

    artifacts.evaluation = evaluationResult.data;
    emit({ event: "evaluation_result", evaluation: evaluationResult.data, timestamp: Date.now() });

    if (evaluationResult.data.passed) {
      emitCompleted(emit, true, artifacts);
      progress("complete");
      return artifacts;
    }

    // eval not passed → repair
    const repairAttempt = createAttempt(artifacts.attempts.length + 1, "repair", false,
      [`evaluation did not pass (score: ${evaluationResult.data.score})`,
       ...evaluationResult.data.suggestedFixes.slice(0, 3)],
      genModel.model, genModel.provider);
    artifacts.attempts.push(repairAttempt);
    emit({ event: "attempt", attempt: repairAttempt, timestamp: Date.now() });

    if (!shouldRetry(artifacts.attempts, "repair")) {
      emitCompleted(emit, false, artifacts);
      progress("failed");
      return artifacts;
    }

    if (checkAbort()) return artifacts;

    repairContext = buildRepairContext({ type: "eval_failure", evaluation: evaluationResult.data });
    lastStage = "repair";
    emit({ event: "stage_started", stage: "repair", timestamp: Date.now() });
    progress("repair");
    lastStage = "generate";
    emit({ event: "stage_started", stage: "generate", timestamp: Date.now() });
  }

  emitCompleted(emit, false, artifacts);
  progress("failed");
  return artifacts;
}

function emitError(emit: OnEvent, stage: string, artifacts: PlanHarnessArtifacts) {
  emit({
    event: "error",
    failedStage: stage,
    message: `${stage} 단계에서 최대 재시도 후 실패`,
    attempts: [...artifacts.attempts],
    timestamp: Date.now(),
  });
}

function emitCompleted(emit: OnEvent, success: boolean, artifacts: PlanHarnessArtifacts) {
  const parts: string[] = [];
  if (artifacts.requirementSpec) parts.push("요구사항 정규화 완료");
  if (artifacts.cps) parts.push("CPS 문서 생성 완료");
  if (artifacts.generatedPlan) parts.push(`계획 생성 완료 (${artifacts.generatedPlan.tasks.length}개 태스크)`);
  if (artifacts.lintIssues.length > 0) {
    const ec = artifacts.lintIssues.filter((i) => i.severity === "error").length;
    const wc = artifacts.lintIssues.length - ec;
    parts.push(`린트: ${ec}개 오류, ${wc}개 경고`);
  }
  if (artifacts.evaluation) {
    parts.push(`평가: ${artifacts.evaluation.score}점 (${artifacts.evaluation.passed ? "통과" : "미통과"})`);
  }

  emit({
    event: "completed",
    success,
    requirementSpec: artifacts.requirementSpec,
    cps: artifacts.cps,
    generatedPlan: artifacts.generatedPlan,
    lintIssues: artifacts.lintIssues,
    evaluation: artifacts.evaluation,
    attempts: [...artifacts.attempts],
    userFacingSummary: parts.join(" → "),
    timestamp: Date.now(),
  });
}

function buildNormalizePrompt(input: RunPlanHarnessInput) {
  const system = `당신은 소프트웨어 요구사항 분석가입니다.
사용자의 입력을 RequirementSpec JSON으로 정규화하세요.

규칙:
- 응답 전체는 하나의 JSON 객체여야 합니다.
- 코드펜스, 설명 문장, 인사말을 절대 붙이지 마세요.
- 반드시 { 로 시작하고 } 로 끝나야 합니다.

분석 지침:
- userIntent: 사용자가 진짜 달성하려는 것을 1-2문장으로 구체화. "만들어줘" 같은 모호한 표현은 구체적 목적으로 변환.
- constraints: 최소 2개. 명시된 것이 없으면 일반적으로 적용되는 제약(예: 예산 없음→무료 서비스 우선, 기간 없음→MVP 4주 가정)을 assumptions와 함께 기술.
- nonGoals: 최소 2개. 범위 확장 방지를 위해 반드시 기술. 입력이 모호할수록 더 넓은 비목표 범위 설정.
- missingInfo: 입력에서 빠진 핵심 결정사항을 적극적으로 나열. 예: 타겟 플랫폼, 인증 방식, 데이터 저장 위치, 배포 환경 등. 모호한 입력이면 최소 3개 이상.
- preferredFormat: 명시되지 않았으면 빈 배열이 아니라 합리적 기본값 제안(예: ["Next.js", "Tailwind CSS"]).

반환 스키마:
{
  "userIntent": "string",
  "targetOutcome": "string",
  "constraints": ["string (최소 2개)"],
  "nonGoals": ["string (최소 2개)"],
  "preferredFormat": ["string"],
  "assumptions": ["string"],
  "missingInfo": ["string (모호한 입력이면 3개 이상)"],
  "sourceTopic": "string",
  "sourceCommand": "string"
}`;

  let user = `## Topic\n${input.topic}\n\n## Command\n${input.command}`;

  if (input.modeInput) {
    user += `\n\n## Structured Input\n${JSON.stringify(input.modeInput, null, 2)}`;
  }

  if (input.techSpec) {
    user += `\n\n## Tech Spec\n${input.techSpec.substring(0, 4000)}`;
  }

  if (input.referencePrd) {
    user += `\n\n## Reference PRD\n${input.referencePrd.substring(0, 4000)}`;
  }

  if (input.previousPlanSummary && input.revisionRequest) {
    user += `\n\n## 이전 계획 요약 (수정 요청의 참고 자료)\n아래는 직전 하네스 실행에서 나온 계획의 구조입니다. 수정 요청에서 마일스톤/태스크 id나 이름을 참조하면 이 맥락을 사용하세요. 이전 계획을 그대로 복사하지 말고, 수정 지시를 이해하는 데만 참고하세요.\n\n${input.previousPlanSummary}`;
  }

  if (input.revisionRequest) {
    user += `\n\n## 구조적 수정 요청 (최우선 반영)\n${input.revisionRequest}`;
  }

  user += "\n\nRequirementSpec JSON만 반환하세요.";
  return { system, user };
}

function buildCpsPrompt(requirementSpec: RequirementSpec) {
  const system = `당신은 CPS(Context, Problem, Solution) 분석가입니다.
RequirementSpec을 바탕으로 CpsDocument JSON만 반환하세요.

규칙:
- 응답 전체는 하나의 JSON 객체여야 합니다.
- 코드펜스, 인사말, 설명 문장은 금지합니다.
- 반드시 { 로 시작하고 } 로 끝나야 합니다.

분석 지침:
- context: "소프트웨어를 만들려고 한다" 같은 일반론 금지. RequirementSpec의 userIntent/constraints를 반영한 구체적 배경.
- problem: 기술적 도전을 구체적으로. constraints에 시간/기술/인력 제약이 있으면 그것이 문제의 핵심.
- solution: preferredFormat이 있으면 존중. 없으면 constraints 기반 합리적 기술 선택 제안.
- successCriteria: 최소 3개. 측정 가능해야 함. "잘 동작한다"는 부적합. "모바일에서 3초 내 로딩" 수준.
- risks: 최소 2개. missingInfo와 constraints에서 도출. "일정 초과" 같은 일반론보다 구체적 위험.

반환 스키마:
{
  "context": "string (프로젝트 고유 배경)",
  "problem": "string (구체적 기술 도전)",
  "solution": "string (기술 선택 포함)",
  "successCriteria": ["string (측정 가능, 최소 3개)"],
  "risks": ["string (구체적, 최소 2개)"]
}`;

  return {
    system,
    user: `## RequirementSpec\n${JSON.stringify(requirementSpec, null, 2)}\n\nCpsDocument JSON만 반환하세요.`,
  };
}

function buildPlanPrompt(
  requirementSpec: RequirementSpec,
  cps: CpsDocument,
  repairContext?: string,
) {
  const system = `당신은 소프트웨어 프로젝트 계획 수립 전문가입니다.
RequirementSpec과 CpsDocument를 바탕으로 GeneratedPlan JSON만 반환하세요.

규칙:
- 응답 전체는 하나의 JSON 객체여야 합니다.
- 코드펜스, 설명 문장, 인사말을 절대 붙이지 마세요.
- 반드시 { 로 시작하고 } 로 끝나야 합니다.

계획 작성 지침:
- milestones: 최소 2개. 시간 제약이 있으면 기간별로 나눠라 (예: "1주차 MVP", "2주차 완성").
- tasks: milestone당 최소 2개. 각 task는 1~3일 작업량.
  - title: "구현", "개선" 같은 단독 단어 금지. "Supabase 인증 API 연동" 수준으로 구체적.
  - detail: 무엇을 어떻게 하는지 한 문장 이상.
  - deliverable: "완료" 금지. "로그인 API 3개 엔드포인트" 수준.
  - ownerHint: frontend/backend/fullstack/devops/design/qa 중 선택. 모든 task에 같은 값 금지.
- constraints 반영: RequirementSpec.constraints의 각 항목이 최소 1개 task에 반영되어야 함.
  예: "오프라인 지원" → 오프라인 동기화 설계 task, "2주 기한" → 마일스톤 기간 제약.
- nonGoals 준수: RequirementSpec.nonGoals에 해당하는 작업은 포함하지 마라.
- executionOrder: 모든 task id를 의존성 순서대로 나열. dependsOn과 일치해야 함.
- acceptanceCriteria: 최소 3개. CpsDocument.successCriteria를 검증 가능한 기준으로 변환.
- risks: RequirementSpec.constraints와 CpsDocument.risks에서 도출. 최소 2개.
- dependencies.from은 나중, dependencies.to는 먼저 실행되는 task.

반환 스키마:
{
  "title": "string",
  "objective": "string",
  "milestones": [{ "id": "string", "title": "string", "objective": "string", "exitCriteria": ["string"] }],
  "tasks": [{ "id": "string", "title": "string", "detail": "string", "milestoneId": "string", "dependsOn": ["string"], "ownerHint": "string", "deliverable": "string" }],
  "dependencies": [{ "from": "string", "to": "string", "reason": "string" }],
  "risks": ["string"],
  "acceptanceCriteria": ["string"],
  "executionOrder": ["string"],
  "estimatedComplexity": "simple | medium | complex"
}`;

  let user = `## RequirementSpec\n${JSON.stringify(requirementSpec, null, 2)}\n\n## CpsDocument\n${JSON.stringify(cps, null, 2)}`;
  if (repairContext) {
    user += `\n\n${repairContext}`;
  }
  user += "\n\nGeneratedPlan JSON만 반환하세요.";

  return { system, user };
}

async function runWithRetry<T>(
  artifacts: PlanHarnessArtifacts,
  stage: PlanAttempt["stage"],
  emit: OnEvent,
  signal: AbortSignal | undefined,
  modelConfig: HarnessModelConfig,
  fn: (repairContext?: string) => Promise<T>,
): Promise<{ success: true; data: T } | { success: false }> {
  let repairContext: string | undefined;

  for (let i = 0; i < 3; i++) {
    if (signal?.aborted) return { success: false };

    try {
      const data = await fn(repairContext);
      if (signal?.aborted) return { success: false };

      const a = createAttempt(artifacts.attempts.length + 1, stage, true, [], modelConfig.model, modelConfig.provider);
      artifacts.attempts.push(a);
      emit({ event: "attempt", attempt: a, timestamp: Date.now() });
      return { success: true, data };
    } catch (error: any) {
      if (error?.name === "AbortError" || signal?.aborted) {
        return { success: false };
      }

      const message = error instanceof Error ? error.message : String(error);
      const a = createAttempt(artifacts.attempts.length + 1, stage, false, [message], modelConfig.model, modelConfig.provider);
      artifacts.attempts.push(a);
      emit({ event: "attempt", attempt: a, timestamp: Date.now() });

      if (!shouldRetry(artifacts.attempts, stage)) {
        return { success: false };
      }

      repairContext = buildRepairContext({ type: "schema_failure", error: message });
    }
  }

  return { success: false };
}

function parseStageResult<T>(raw: string, schema: ZodType<T>) {
  const result = parseAndValidate(raw, schema);
  if (!result.success) {
    throw new SchemaError(result.error);
  }
  return result.data as T;
}

class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}
