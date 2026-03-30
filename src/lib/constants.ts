import { DebateRoleId, DebateEngineId, VerifyEngineId, VerificationProvider, DebateCommand } from "./types";

// ===== 역할 풀 (8개) =====
export const ROLE_POOL: Record<
  DebateRoleId,
  {
    id: DebateRoleId;
    emoji: string;
    name: string;
    koreanName: string;
    description: string;
    alwaysInclude: boolean;
    condition?: string;
    dotColor: string;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
  }
> = {
  architect: {
    id: "architect",
    emoji: "\u{1F3D7}\uFE0F",
    name: "Architect",
    koreanName: "설계자",
    description: "시스템 구조, DB, API 설계",
    alwaysInclude: true,
    dotColor: "bg-role-architect",
    badgeBg: "bg-role-architect-bg",
    badgeText: "text-role-architect",
    borderColor: "border-role-architect/20",
  },
  critic: {
    id: "critic",
    emoji: "\u{1F50D}",
    name: "Critic",
    koreanName: "비판자",
    description: "보안, 성능, 버그 검토",
    alwaysInclude: true,
    dotColor: "bg-role-critic",
    badgeBg: "bg-role-critic-bg",
    badgeText: "text-role-critic",
    borderColor: "border-role-critic/20",
  },
  creative: {
    id: "creative",
    emoji: "\u{1F4A1}",
    name: "Creative",
    koreanName: "창의자",
    description: "대안, 최신 기술, UX 제안",
    alwaysInclude: false,
    condition: "중간 이상 복잡도",
    dotColor: "bg-role-creative",
    badgeBg: "bg-role-creative-bg",
    badgeText: "text-role-creative",
    borderColor: "border-role-creative/20",
  },
  frontend: {
    id: "frontend",
    emoji: "\u{1F3A8}",
    name: "Frontend Expert",
    koreanName: "프론트엔드 전문가",
    description: "UI/UX, 컴포넌트, 반응형",
    alwaysInclude: false,
    condition: "웹앱/모바일",
    dotColor: "bg-role-frontend",
    badgeBg: "bg-role-frontend-bg",
    badgeText: "text-role-frontend",
    borderColor: "border-role-frontend/20",
  },
  backend: {
    id: "backend",
    emoji: "\u2699\uFE0F",
    name: "Backend Expert",
    koreanName: "백엔드 전문가",
    description: "서버, DB, 인증, API",
    alwaysInclude: false,
    condition: "API/풀스택",
    dotColor: "bg-role-backend",
    badgeBg: "bg-role-backend-bg",
    badgeText: "text-role-backend",
    borderColor: "border-role-backend/20",
  },
  devops: {
    id: "devops",
    emoji: "\u{1F680}",
    name: "DevOps Expert",
    koreanName: "DevOps 전문가",
    description: "배포, CI/CD, 인프라",
    alwaysInclude: false,
    condition: "복잡한 프로젝트",
    dotColor: "bg-role-devops",
    badgeBg: "bg-role-devops-bg",
    badgeText: "text-role-devops",
    borderColor: "border-role-devops/20",
  },
  cost_analyst: {
    id: "cost_analyst",
    emoji: "\u{1F4B0}",
    name: "Cost Analyst",
    koreanName: "비용 분석가",
    description: "API 비용, 호스팅 비용 계산",
    alwaysInclude: false,
    condition: "외부 서비스 사용",
    dotColor: "bg-role-cost",
    badgeBg: "bg-role-cost-bg",
    badgeText: "text-role-cost",
    borderColor: "border-role-cost/20",
  },
  data_expert: {
    id: "data_expert",
    emoji: "\u{1F4CA}",
    name: "Data Expert",
    koreanName: "데이터 전문가",
    description: "데이터 구조, DB 설계, 데이터 흐름",
    alwaysInclude: false,
    condition: "아이디어 구체화 모드",
    dotColor: "bg-role-data",
    badgeBg: "bg-role-data-bg",
    badgeText: "text-role-data",
    borderColor: "border-role-data/20",
  },
  ux_advocate: {
    id: "ux_advocate",
    emoji: "\u{1F9D1}\u200D\u{1F4BB}",
    name: "UX Advocate",
    koreanName: "사용자 대변인",
    description: "사용자 관점, UX 불편/보완점",
    alwaysInclude: false,
    condition: "아이디어 구체화 모드",
    dotColor: "bg-role-ux",
    badgeBg: "bg-role-ux-bg",
    badgeText: "text-role-ux",
    borderColor: "border-role-ux/20",
  },
  planner: {
    id: "planner",
    emoji: "\u{1F4CB}",
    name: "Planner",
    koreanName: "기획 분석가",
    description: "비전, 사용자, 비즈니스 목표 분석",
    alwaysInclude: false,
    condition: "ideate 모드",
    dotColor: "bg-role-creative",
    badgeBg: "bg-role-creative-bg",
    badgeText: "text-role-creative",
    borderColor: "border-role-creative/20",
  },
  moderator: {
    id: "moderator",
    emoji: "\u2696\uFE0F",
    name: "Moderator",
    koreanName: "중재자",
    description: "의견 종합, 실행 계획",
    alwaysInclude: true,
    dotColor: "bg-role-moderator",
    badgeBg: "bg-role-moderator-bg",
    badgeText: "text-role-moderator",
    borderColor: "border-role-moderator/20",
  },
};

// 단축 명령어별 기본 역할
export const QUICK_ROLES: DebateRoleId[] = ["architect", "critic", "moderator"];
export const DEEP_ROLES: DebateRoleId[] = [
  "architect", "critic", "creative", "frontend", "backend", "devops", "cost_analyst", "moderator",
];
export const CONSULT_ROLES: DebateRoleId[] = ["architect", "critic", "creative", "moderator"];
export const FIX_ROLES: DebateRoleId[] = ["critic", "architect", "moderator"];

// /ideate 모드 phase별 clarification 역할
export const CLARIFY_PHASE_ROLES: Record<import("./types").ClarificationPhase, DebateRoleId[]> = {
  vision: ["planner"],
  features: ["architect", "ux_advocate"],
  technical: ["backend", "frontend", "data_expert"],
  resolution: ["moderator"],
};

export const CLARIFY_PHASE_ORDER: import("./types").ClarificationPhase[] = ["vision", "features", "technical"];

export const CLARIFY_PHASE_LABELS: Record<import("./types").ClarificationPhase, { title: string; description: string }> = {
  vision: { title: "비전 파악", description: "왜 만드는지, 누구를 위한 건지" },
  features: { title: "기능 구체화", description: "핵심 기능, 우선순위, 사용 시나리오" },
  technical: { title: "기술 제약 확인", description: "스택, 성능, 보안, 배포 환경" },
  resolution: { title: "갈림길 정리", description: "모호한 지점 최종 확인" },
};

// Legacy: 이전 단일 라운드 clarification용. 새 phase 기반은 CLARIFY_PHASE_ROLES 사용.
export const IDEATE_CLARIFY_ROLES: DebateRoleId[] = ["data_expert", "backend", "frontend"];
export const IDEATE_DEBATE_ROLES: DebateRoleId[] = ["data_expert", "backend", "frontend", "architect", "critic", "moderator"];
export const IDEATE_UX_ROLES: DebateRoleId[] = ["ux_advocate", "frontend", "creative", "moderator"];

// 역할 순서 (중재자는 항상 마지막)
export function getDebateOrder(roles: DebateRoleId[], command?: DebateCommand): DebateRoleId[] {
  const withoutModerator = roles.filter((r) => r !== "moderator");
  const hasModerator = roles.includes("moderator");

  // /fix 모드: 비판자를 맨 앞으로
  if (command === "fix") {
    const criticFirst = withoutModerator.filter((r) => r === "critic");
    const rest = withoutModerator.filter((r) => r !== "critic");
    return hasModerator ? [...criticFirst, ...rest, "moderator"] : [...criticFirst, ...rest];
  }

  return hasModerator ? [...withoutModerator, "moderator"] : withoutModerator;
}

// ===== 토론 엔진 옵션 =====
export const DEBATE_ENGINES: {
  id: DebateEngineId;
  label: string;
  description: string;
  modelId: string;
}[] = [
  { id: "claude-sonnet", label: "Claude Sonnet 4.6", description: "기본, 가성비 최고", modelId: "claude-sonnet-4-6" },
  { id: "claude-opus", label: "Claude Opus 4.6", description: "복잡한 설계, 최고 품질", modelId: "claude-opus-4-6" },
  { id: "gpt", label: "GPT-5.4", description: "다른 관점, 실행력 강점", modelId: "gpt-5.4" },
  { id: "gemini", label: "Gemini 3.1 Pro", description: "가성비 + 추론 강점", modelId: "gemini-3.1-pro-preview" },
];

// ===== 검증 AI 옵션 =====
export const VERIFY_ENGINES: {
  id: VerifyEngineId;
  label: string;
  description: string;
  condition?: string;
}[] = [
  { id: "chatgpt", label: "GPT-5.4", description: "추천" },
  { id: "gemini", label: "Gemini 3.1 Pro", description: "" },
  { id: "claude-opus", label: "Claude Opus 4.6", description: "토론 엔진이 Sonnet일 때만", condition: "claude-sonnet" },
  { id: "none", label: "검증 안 함", description: "" },
];

// 모델 설정
export const MODELS = {
  debate: { modelId: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  prd: { modelId: "claude-opus-4-6", label: "Claude Opus 4.6" },
  verification: {
    chatgpt: { modelId: "gpt-5.4", label: "GPT-5.4" },
    gemini: { modelId: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  },
};

// 토론 단계 라벨
export const STAGE_LABELS: Record<string, string> = {
  independent: "독립 분석",
  critique: "교차 비판",
  final: "최종 정리",
  clarify: "아이디어 구체화",
  user_perspective: "사용자 관점 토론",
};

// 하네스 모드는 서버 단일 응답이므로 generating_plan 하나만 사용.
// structuring_requirements / building_cps / lint_retrying / evaluating_plan 은
// 실제 런타임에서 사용되지 않아 제거됨 (2026-03-27).

// 검증 옵션 (레거시 호환)
export const VERIFICATION_OPTIONS: {
  id: VerificationProvider | null | "redebate";
  label: string;
  description: string;
  recommended: boolean;
}[] = [
  { id: "chatgpt", label: "GPT-5.4로 검증", description: "추천", recommended: true },
  { id: "gemini", label: "Gemini 3.1 Pro로 검증", description: "", recommended: false },
  { id: null, label: "검증 건너뛰고 PRD 바로 생성", description: "", recommended: false },
  { id: "redebate", label: "특정 부분 재토론", description: "", recommended: false },
];

// 프로젝트 유형 라벨
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  webapp: "웹 애플리케이션",
  api: "API / 백엔드",
  automation: "자동화 / 스크립트",
  data: "데이터 분석 / ML",
  mobile: "모바일 앱",
  fullstack: "풀스택",
  other: "기타",
};

// 복잡도 라벨
export const COMPLEXITY_LABELS: Record<string, { label: string; color: string }> = {
  simple: { label: "단순", color: "text-success" },
  medium: { label: "중간", color: "text-warning" },
  complex: { label: "복잡", color: "text-error" },
};

// 모드 정보
export const MODE_INFO: Record<DebateCommand, {
  label: string;
  shortLabel: string;
  description: string;
  category: "설계" | "보완";
}> = {
  debate: { label: "새 프로젝트 설계 토론", shortLabel: "/debate", description: "AI가 역할 추천 → 토론 → PRD", category: "설계" },
  quick: { label: "빠른 3인 토론", shortLabel: "/quick", description: "설계자+비판자+중재자", category: "설계" },
  deep: { label: "깊은 7인 토론", shortLabel: "/deep", description: "전체 7인 + 외부 검증", category: "설계" },
  consult: { label: "전문가 의견 청취", shortLabel: "/consult", description: "기존 코드에 대한 전문가 리뷰", category: "보완" },
  extend: { label: "기능 추가 설계", shortLabel: "/extend", description: "기존 프로그램에 기능 추가", category: "보완" },
  fix: { label: "구조 수정 AS", shortLabel: "/fix", description: "구조 문제 진단 및 수정", category: "보완" },
  ideate: { label: "아이디어 → 개발계획", shortLabel: "/ideate", description: "전문가 질문으로 아이디어 구체화 → 개발계획 수립", category: "설계" },
};

// 엔진 라벨 헬퍼
export function getEngineLabel(engineId: DebateEngineId): string {
  return DEBATE_ENGINES.find((e) => e.id === engineId)?.label || engineId;
}
