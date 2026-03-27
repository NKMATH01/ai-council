"use client";

import { useState } from "react";
import {
  DebateCommand, DebateEngineId, VerifyEngineId,
  ConsultInput, ExtendInput, FixInput, ModeInput,
} from "@/lib/types";
import { MODE_INFO, DEBATE_ENGINES, VERIFY_ENGINES } from "@/lib/constants";

export type WorkflowType = "standard" | "plan_harness";

export interface TopicSubmitData {
  topic: string;
  command: DebateCommand;
  workflow: WorkflowType;
  debateEngine: DebateEngineId;
  verifyEngine: VerifyEngineId;
  techSpec: string;
  modeInput: ModeInput;
  referencePrd?: string;
}

interface TopicInputProps {
  onSubmit: (data: TopicSubmitData) => void;
  disabled: boolean;
  onTopicChange?: (topic: string) => void;
  referencePrd?: string;
}

const DESIGN_MODES: DebateCommand[] = ["ideate", "debate", "quick", "deep"];
const ASSIST_MODES: DebateCommand[] = ["consult", "extend", "fix"];

export default function TopicInput({ onSubmit, disabled, onTopicChange, referencePrd }: TopicInputProps) {
  const [mode, setMode] = useState<DebateCommand>("debate");
  const [topic, setTopic] = useState("");
  const [debateEngine, setDebateEngine] = useState<DebateEngineId>("claude-sonnet");
  const [verifyEngine, setVerifyEngine] = useState<VerifyEngineId>("chatgpt");
  const [techSpec, setTechSpec] = useState("");
  const [showTechSpec, setShowTechSpec] = useState(false);
  const [showEngineOptions, setShowEngineOptions] = useState(false);
  const [engineWarning, setEngineWarning] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowType>("standard");

  // consult 입력
  const [consultInput, setConsultInput] = useState<ConsultInput>({
    projectName: "", currentStatus: "", techStack: "", codeOrStructure: "", question: "",
  });

  // extend 입력
  const [extendInput, setExtendInput] = useState<ExtendInput>({
    projectName: "", currentFeatures: "", techStack: "", newFeature: "", constraints: "",
  });

  // fix 입력
  const [fixInput, setFixInput] = useState<FixInput>({
    projectName: "", problem: "", codeOrStructure: "", techStack: "", previousAttempts: "",
  });

  // 엔진 충돌 체크
  const checkEngineConflict = (de: DebateEngineId, ve: VerifyEngineId) => {
    const conflicts: Record<string, string> = {
      "claude-sonnet:claude-opus": "",
      "claude-opus:claude-opus": "conflict",
      "gpt:chatgpt": "conflict",
      "gemini:gemini": "conflict",
    };
    const key = `${de}:${ve}`;
    if (conflicts[key] === "conflict") {
      setEngineWarning("토론 AI와 검증 AI가 같으면 검증 효과가 떨어집니다. 다른 AI를 선택하시겠습니까?");
    } else {
      setEngineWarning("");
    }
  };

  const handleDebateEngineChange = (id: DebateEngineId) => {
    setDebateEngine(id);
    checkEngineConflict(id, verifyEngine);
  };

  const handleVerifyEngineChange = (id: VerifyEngineId) => {
    setVerifyEngine(id);
    checkEngineConflict(debateEngine, id);
  };

  const getModeInput = (): ModeInput => {
    switch (mode) {
      case "consult": return consultInput;
      case "extend": return extendInput;
      case "fix": return fixInput;
      default: return null;
    }
  };

  const getTopicFromMode = (): string => {
    switch (mode) {
      case "consult": return consultInput.projectName || consultInput.question || topic;
      case "extend": return extendInput.projectName || extendInput.newFeature || topic;
      case "fix": return fixInput.projectName || fixInput.problem || topic;
      default: return topic;
    }
  };

  const isFormValid = (): boolean => {
    switch (mode) {
      case "consult":
        return !!(consultInput.projectName && consultInput.codeOrStructure && consultInput.question);
      case "extend":
        return !!(extendInput.projectName && extendInput.newFeature);
      case "fix":
        return !!(fixInput.projectName && fixInput.problem);
      default:
        return !!topic.trim();
    }
  };

  const handleTopicTextChange = (value: string) => {
    setTopic(value);
    onTopicChange?.(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    const isHarness = workflow === "plan_harness";
    const finalTechSpec = isHarness
      ? techSpec
      : referencePrd
      ? `${techSpec}\n\n## 참고: 과거 토론 PRD\n${referencePrd}`.trim()
      : techSpec;

    onSubmit({
      topic: getTopicFromMode(),
      command: mode,
      workflow,
      debateEngine,
      verifyEngine,
      techSpec: finalTechSpec,
      modeInput: getModeInput(),
      referencePrd: isHarness ? referencePrd : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card overflow-hidden">
      {/* 모드 선택 탭 */}
      <div className="border-b border-border-light">
        <div className="px-5 pt-4 pb-2">
          <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-2">설계 모드</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DESIGN_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m
                    ? "bg-accent text-white shadow-sm"
                    : "bg-bg-muted text-text-secondary hover:bg-bg-hover border border-border-light"
                }`}
              >
                {MODE_INFO[m].shortLabel}
                <span className="ml-1.5 text-[10px] opacity-75">{MODE_INFO[m].label.replace(MODE_INFO[m].shortLabel + " ", "")}</span>
              </button>
            ))}
          </div>
          <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-2">보완 모드</div>
          <div className="flex flex-wrap gap-1.5">
            {ASSIST_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m
                    ? "bg-accent text-white shadow-sm"
                    : "bg-bg-muted text-text-secondary hover:bg-bg-hover border border-border-light"
                }`}
              >
                {MODE_INFO[m].shortLabel}
                <span className="ml-1.5 text-[10px] opacity-75">{MODE_INFO[m].label.replace(MODE_INFO[m].shortLabel.slice(1) + " ", "").replace("전문가 ", "")}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-3">
          <p className="text-xs text-text-muted">{MODE_INFO[mode].description}</p>
        </div>
      </div>

      {/* 모드별 입력 양식 */}
      <div className="px-5 py-4 space-y-3">
        {/* debate/quick/deep: 단순 주제 입력 */}
        {DESIGN_MODES.includes(mode) && (
          <textarea
            value={topic}
            onChange={(e) => handleTopicTextChange(e.target.value)}
            placeholder="프로젝트 주제를 입력하세요..."
            className="w-full h-28 p-3 bg-bg-muted border border-border-light rounded-xl resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 outline-none text-text-primary placeholder-text-muted text-sm leading-relaxed transition-all"
            disabled={disabled}
          />
        )}

        {/* /consult 양식 */}
        {mode === "consult" && (
          <div className="space-y-3">
            <InputField label="프로젝트명" required value={consultInput.projectName} onChange={(v) => setConsultInput({ ...consultInput, projectName: v })} disabled={disabled} />
            <InputField label="현재 개발 상황" required value={consultInput.currentStatus} onChange={(v) => setConsultInput({ ...consultInput, currentStatus: v })} placeholder="간단 설명" disabled={disabled} />
            <InputField label="기술 스택" required value={consultInput.techStack} onChange={(v) => setConsultInput({ ...consultInput, techStack: v })} placeholder="사용 중인 기술" disabled={disabled} />
            <TextareaField label="코드 또는 구조" required value={consultInput.codeOrStructure} onChange={(v) => setConsultInput({ ...consultInput, codeOrStructure: v })} placeholder="코드를 붙여넣거나 구조를 설명하세요" disabled={disabled} rows={6} />
            <TextareaField label="궁금한 점" required value={consultInput.question} onChange={(v) => setConsultInput({ ...consultInput, question: v })} placeholder="구체적인 질문을 작성하세요" disabled={disabled} rows={3} />
          </div>
        )}

        {/* /extend 양식 */}
        {mode === "extend" && (
          <div className="space-y-3">
            <InputField label="프로젝트명" required value={extendInput.projectName} onChange={(v) => setExtendInput({ ...extendInput, projectName: v })} disabled={disabled} />
            <TextareaField label="현재 기능" required value={extendInput.currentFeatures} onChange={(v) => setExtendInput({ ...extendInput, currentFeatures: v })} placeholder="이미 작동하는 기능들" disabled={disabled} rows={3} />
            <InputField label="기술 스택" required value={extendInput.techStack} onChange={(v) => setExtendInput({ ...extendInput, techStack: v })} placeholder="사용 중인 기술" disabled={disabled} />
            <TextareaField label="추가하고 싶은 기능" required value={extendInput.newFeature} onChange={(v) => setExtendInput({ ...extendInput, newFeature: v })} placeholder="추가할 기능을 설명하세요" disabled={disabled} rows={4} />
            <TextareaField label="제약 조건" value={extendInput.constraints} onChange={(v) => setExtendInput({ ...extendInput, constraints: v })} placeholder="비용 최소화, 특정 라이브러리 사용 등 (선택)" disabled={disabled} rows={2} />
          </div>
        )}

        {/* /fix 양식 */}
        {mode === "fix" && (
          <div className="space-y-3">
            <InputField label="프로젝트명" required value={fixInput.projectName} onChange={(v) => setFixInput({ ...fixInput, projectName: v })} disabled={disabled} />
            <TextareaField label="문제 상황" required value={fixInput.problem} onChange={(v) => setFixInput({ ...fixInput, problem: v })} placeholder="뭐가 안 되는지, 뭐가 불편한지" disabled={disabled} rows={3} />
            <TextareaField label="현재 코드/구조" required value={fixInput.codeOrStructure} onChange={(v) => setFixInput({ ...fixInput, codeOrStructure: v })} placeholder="코드를 붙여넣거나 구조를 설명하세요" disabled={disabled} rows={6} />
            <InputField label="기술 스택" required value={fixInput.techStack} onChange={(v) => setFixInput({ ...fixInput, techStack: v })} placeholder="사용 중인 기술" disabled={disabled} />
            <TextareaField label="이전에 시도한 해결법" value={fixInput.previousAttempts} onChange={(v) => setFixInput({ ...fixInput, previousAttempts: v })} placeholder="있으면 작성 (선택)" disabled={disabled} rows={2} />
          </div>
        )}
      </div>

      {/* 접기/펼치기 옵션들 */}
      <div className="px-5 pb-4 space-y-2">
        {/* 기술 스펙 문서 */}
        <button
          type="button"
          onClick={() => setShowTechSpec(!showTechSpec)}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${showTechSpec ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          기술 스펙 문서 (선택사항)
        </button>
        {showTechSpec && (
          <textarea
            value={techSpec}
            onChange={(e) => setTechSpec(e.target.value)}
            placeholder="PRD, README, 기술 스펙 등을 붙여넣으세요. 전문가들이 이 문서를 기반으로 토론합니다."
            className="w-full h-32 p-3 bg-bg-muted border border-border-light rounded-xl resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 outline-none text-text-primary placeholder-text-muted text-xs leading-relaxed transition-all"
            disabled={disabled}
          />
        )}

        {/* 토론 엔진 선택 */}
        <button
          type="button"
          onClick={() => setShowEngineOptions(!showEngineOptions)}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${showEngineOptions ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          AI 엔진 설정
          <span className="text-[10px] text-accent ml-1">
            {DEBATE_ENGINES.find((e) => e.id === debateEngine)?.label}
          </span>
        </button>
        {showEngineOptions && (
          <div className="space-y-3 p-3 bg-bg-muted rounded-xl border border-border-light">
            {/* 하네스 모드 안내 */}
            {workflow === "plan_harness" && (
              <div className="px-3 py-2 bg-accent/10 border border-accent/20 rounded-lg text-xs text-accent">
                자동 계획 하네스는 Claude Opus 4.6을 고정 사용합니다. 아래 엔진 선택은 하네스 모드에서 무시됩니다.
              </div>
            )}
            {/* 토론 엔진 */}
            <div>
              <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-1.5">토론 엔진</div>
              <div className="grid grid-cols-2 gap-1.5">
                {DEBATE_ENGINES.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => handleDebateEngineChange(e.id)}
                    className={`px-3 py-2 rounded-lg text-left transition-all ${
                      debateEngine === e.id
                        ? "bg-accent text-white"
                        : "bg-bg-card text-text-secondary hover:bg-bg-hover border border-border-light"
                    }`}
                  >
                    <div className="text-xs font-medium">{e.label}</div>
                    <div className={`text-[10px] ${debateEngine === e.id ? "text-white/70" : "text-text-muted"}`}>{e.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 검증 AI */}
            <div>
              <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-1.5">외부 검증 AI</div>
              <div className="grid grid-cols-2 gap-1.5">
                {VERIFY_ENGINES.filter((e) => {
                  if (e.condition && e.condition !== debateEngine) return false;
                  return true;
                }).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => handleVerifyEngineChange(e.id)}
                    className={`px-3 py-2 rounded-lg text-left transition-all ${
                      verifyEngine === e.id
                        ? "bg-accent text-white"
                        : "bg-bg-card text-text-secondary hover:bg-bg-hover border border-border-light"
                    }`}
                  >
                    <div className="text-xs font-medium">{e.label}</div>
                    {e.description && <div className={`text-[10px] ${verifyEngine === e.id ? "text-white/70" : "text-text-muted"}`}>{e.description}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* 경고 */}
            {engineWarning && (
              <div className="px-3 py-2 bg-warning-bg border border-warning/20 rounded-lg text-xs text-warning">
                {engineWarning}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 워크플로 선택 + 제출 */}
      <div className="px-5 pb-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWorkflow("standard")}
            disabled={disabled}
            className={`px-3 py-2.5 rounded-lg text-left transition-all border ${
              workflow === "standard"
                ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                : "border-border-light bg-bg-card hover:bg-bg-hover"
            }`}
          >
            <div className="text-xs font-semibold text-text-primary">일반 토론</div>
            <div className="text-[10px] text-text-muted mt-0.5">AI 전문가 토론 → PRD</div>
          </button>
          <button
            type="button"
            onClick={() => setWorkflow("plan_harness")}
            disabled={disabled}
            className={`px-3 py-2.5 rounded-lg text-left transition-all border ${
              workflow === "plan_harness"
                ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                : "border-border-light bg-bg-card hover:bg-bg-hover"
            }`}
          >
            <div className="text-xs font-semibold text-text-primary">자동 계획</div>
            <div className="text-[10px] text-text-muted mt-0.5">요구사항 → CPS → 검증 계획</div>
          </button>
        </div>
        {workflow === "plan_harness" && (
          <p className="text-[10px] text-accent">Claude Opus 4.6 고정. 요구사항 정규화 → CPS 분석 → 계획 생성/린트/평가를 자동 수행합니다.</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled || !isFormValid()}
            className="px-6 py-2.5 btn-accent text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
          >
            {workflow === "plan_harness" ? "자동 계획 시작" : `${MODE_INFO[mode].shortLabel} 시작`}
          </button>
        </div>
      </div>
    </form>
  );
}

// ===== 입력 필드 컴포넌트 =====
function InputField({ label, value, onChange, placeholder, disabled, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled: boolean; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1 block">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg focus:ring-2 focus:ring-accent/30 focus:border-accent/40 outline-none text-text-primary placeholder-text-muted text-sm transition-all"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, disabled, required, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled: boolean; required?: boolean; rows?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1 block">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="w-full p-3 bg-bg-muted border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 outline-none text-text-primary placeholder-text-muted text-sm leading-relaxed transition-all"
      />
    </div>
  );
}
