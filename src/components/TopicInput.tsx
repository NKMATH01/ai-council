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

const OPERATION_MODES: DebateCommand[] = ["academy"];
const DESIGN_MODES: DebateCommand[] = ["ideate", "debate", "quick", "deep"];
const ASSIST_MODES: DebateCommand[] = ["consult", "extend", "fix"];

export default function TopicInput({ onSubmit, disabled, onTopicChange, referencePrd }: TopicInputProps) {
  const [mode, setMode] = useState<DebateCommand>("academy");
  const [topic, setTopic] = useState("");
  const [debateEngine, setDebateEngine] = useState<DebateEngineId>("gpt");
  const [verifyEngine, setVerifyEngine] = useState<VerifyEngineId>("chatgpt");
  const [techSpec, setTechSpec] = useState("");
  const [showTechSpec, setShowTechSpec] = useState(false);
  const [showEngineOptions, setShowEngineOptions] = useState(false);
  const [engineWarning, setEngineWarning] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowType>("standard");

  const [academyInput, setAcademyInput] = useState({
    academyName: "",
    currentStatus: "",
    question: "",
    data: "",
  });

  const [consultInput, setConsultInput] = useState<ConsultInput>({
    projectName: "", currentStatus: "", techStack: "", codeOrStructure: "", question: "",
  });
  const [extendInput, setExtendInput] = useState<ExtendInput>({
    projectName: "", currentFeatures: "", techStack: "", newFeature: "", constraints: "",
  });
  const [fixInput, setFixInput] = useState<FixInput>({
    projectName: "", problem: "", codeOrStructure: "", techStack: "", previousAttempts: "",
  });

  const checkEngineConflict = (de: DebateEngineId, ve: VerifyEngineId) => {
    const conflicts: Record<string, boolean> = {
      "claude-opus:claude-opus": true,
      "gpt:chatgpt": true,
      "gemini:gemini": true,
    };
    setEngineWarning(conflicts[`${de}:${ve}`] ? "토론 AI와 검증 AI가 같으면 검증 효과가 약해질 수 있습니다. 가능하면 다른 AI를 선택하세요." : "");
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

  const getAcademyTopic = (): string => {
    return [
      "## 학원 운영 질문",
      academyInput.academyName ? `- 학원명/유형: ${academyInput.academyName}` : "",
      academyInput.currentStatus ? `- 현재 운영 상황: ${academyInput.currentStatus}` : "",
      "",
      "## 상담 요청",
      academyInput.question,
      academyInput.data ? `\n## 참고 데이터\n${academyInput.data}` : "",
    ].filter(Boolean).join("\n");
  };

  const getTopicFromMode = (): string => {
    switch (mode) {
      case "academy": return getAcademyTopic();
      case "consult": return consultInput.projectName || consultInput.question || topic;
      case "extend": return extendInput.projectName || extendInput.newFeature || topic;
      case "fix": return fixInput.projectName || fixInput.problem || topic;
      default: return topic;
    }
  };

  const isFormValid = (): boolean => {
    switch (mode) {
      case "academy":
        return !!academyInput.question.trim();
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
    <form onSubmit={handleSubmit} className="card-elevated overflow-hidden">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <section className="p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-border-light">
          <div className="mb-5">
            <p className="text-xs font-black text-accent uppercase tracking-normal">AI 토론 시작</p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-text-primary mt-1 tracking-normal">
              학원 운영과 개발 결정을 전문가 토론으로 정리하세요
            </h2>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              학원 운영 질문은 운영 전문가 관점으로, 개발 질문은 설계/구현 전문가 관점으로 토론하고 결과물을 만듭니다.
            </p>
          </div>

          <ModeGroup title="학원 운영" modes={OPERATION_MODES} mode={mode} setMode={setMode} disabled={disabled} />
          <ModeGroup title="기획/설계 토론" modes={DESIGN_MODES} mode={mode} setMode={setMode} disabled={disabled} />
          <ModeGroup title="개발 보완 모드" modes={ASSIST_MODES} mode={mode} setMode={setMode} disabled={disabled} />

          <div className="mt-4 p-3 rounded-lg bg-accent-light border border-accent/15">
            <div className="text-sm font-bold text-text-primary">{MODE_INFO[mode].label}</div>
            <p className="text-xs text-text-secondary mt-1">{MODE_INFO[mode].description}</p>
          </div>
        </section>

        <section className="p-5 sm:p-6 space-y-4">
          {mode === "academy" && (
            <div className="space-y-3">
              <InputField
                label="학원명 또는 유형"
                value={academyInput.academyName}
                onChange={(v) => setAcademyInput({ ...academyInput, academyName: v })}
                placeholder="예: 중등 수학학원, 영어 보습학원, 입시학원"
                disabled={disabled}
              />
              <TextareaField
                label="현재 운영 상황"
                value={academyInput.currentStatus}
                onChange={(v) => setAcademyInput({ ...academyInput, currentStatus: v })}
                placeholder="예: 신규 상담은 오는데 등록 전환이 낮고, 기존 학생 재등록률도 떨어지고 있습니다."
                disabled={disabled}
                rows={3}
              />
              <TextareaField
                label="토론해줬으면 하는 질문"
                required
                value={academyInput.question}
                onChange={(v) => setAcademyInput({ ...academyInput, question: v })}
                placeholder="예: 상담 전환율과 재등록률을 동시에 올리려면 어떤 운영 루틴과 지표를 만들어야 할까요?"
                disabled={disabled}
                rows={4}
              />
              <TextareaField
                label="참고 데이터"
                value={academyInput.data}
                onChange={(v) => setAcademyInput({ ...academyInput, data: v })}
                placeholder="예: 월 상담 40건, 등록 9건, 재등록률 62%, 강사 4명, 중1~중3 7개 반"
                disabled={disabled}
                rows={3}
              />
            </div>
          )}

          {DESIGN_MODES.includes(mode) && (
            <textarea
              value={topic}
              onChange={(e) => handleTopicTextChange(e.target.value)}
              placeholder="토론할 주제를 입력하세요."
              className="w-full h-36 p-4 bg-bg-muted border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/25 focus:border-accent outline-none text-text-primary placeholder-text-muted text-sm leading-relaxed transition-all"
              disabled={disabled}
            />
          )}

          {mode === "consult" && (
            <div className="space-y-3">
              <InputField label="프로젝트명" required value={consultInput.projectName} onChange={(v) => setConsultInput({ ...consultInput, projectName: v })} disabled={disabled} />
              <InputField label="현재 개발 상황" required value={consultInput.currentStatus} onChange={(v) => setConsultInput({ ...consultInput, currentStatus: v })} placeholder="간단 설명" disabled={disabled} />
              <InputField label="기술 스택" required value={consultInput.techStack} onChange={(v) => setConsultInput({ ...consultInput, techStack: v })} placeholder="사용 중인 기술" disabled={disabled} />
              <TextareaField label="코드 또는 구조" required value={consultInput.codeOrStructure} onChange={(v) => setConsultInput({ ...consultInput, codeOrStructure: v })} placeholder="코드를 붙여넣거나 구조를 설명하세요" disabled={disabled} rows={5} />
              <TextareaField label="궁금한 점" required value={consultInput.question} onChange={(v) => setConsultInput({ ...consultInput, question: v })} placeholder="구체적인 질문을 작성하세요" disabled={disabled} rows={3} />
            </div>
          )}

          {mode === "extend" && (
            <div className="space-y-3">
              <InputField label="프로젝트명" required value={extendInput.projectName} onChange={(v) => setExtendInput({ ...extendInput, projectName: v })} disabled={disabled} />
              <TextareaField label="현재 기능" required value={extendInput.currentFeatures} onChange={(v) => setExtendInput({ ...extendInput, currentFeatures: v })} placeholder="이미 작동하는 기능들" disabled={disabled} rows={3} />
              <InputField label="기술 스택" required value={extendInput.techStack} onChange={(v) => setExtendInput({ ...extendInput, techStack: v })} placeholder="사용 중인 기술" disabled={disabled} />
              <TextareaField label="추가하고 싶은 기능" required value={extendInput.newFeature} onChange={(v) => setExtendInput({ ...extendInput, newFeature: v })} placeholder="추가할 기능을 설명하세요" disabled={disabled} rows={4} />
              <TextareaField label="제약 조건" value={extendInput.constraints} onChange={(v) => setExtendInput({ ...extendInput, constraints: v })} placeholder="비용 최소화, 특정 라이브러리 사용 등" disabled={disabled} rows={2} />
            </div>
          )}

          {mode === "fix" && (
            <div className="space-y-3">
              <InputField label="프로젝트명" required value={fixInput.projectName} onChange={(v) => setFixInput({ ...fixInput, projectName: v })} disabled={disabled} />
              <TextareaField label="문제 상황" required value={fixInput.problem} onChange={(v) => setFixInput({ ...fixInput, problem: v })} placeholder="뭐가 안 되는지, 뭐가 불편한지" disabled={disabled} rows={3} />
              <TextareaField label="현재 코드/구조" required value={fixInput.codeOrStructure} onChange={(v) => setFixInput({ ...fixInput, codeOrStructure: v })} placeholder="코드를 붙여넣거나 구조를 설명하세요" disabled={disabled} rows={5} />
              <InputField label="기술 스택" required value={fixInput.techStack} onChange={(v) => setFixInput({ ...fixInput, techStack: v })} placeholder="사용 중인 기술" disabled={disabled} />
              <TextareaField label="이전에 시도한 해결법" value={fixInput.previousAttempts} onChange={(v) => setFixInput({ ...fixInput, previousAttempts: v })} placeholder="있으면 작성" disabled={disabled} rows={2} />
            </div>
          )}

          <div className="space-y-2">
            <button type="button" onClick={() => setShowTechSpec(!showTechSpec)} className="text-xs font-semibold text-text-secondary hover:text-text-primary">
              {showTechSpec ? "참고 문서 접기" : "참고 문서 추가"}
            </button>
            {showTechSpec && (
              <textarea
                value={techSpec}
                onChange={(e) => setTechSpec(e.target.value)}
                placeholder={mode === "academy" ? "상담 스크립트, 반별 시간표, 학부모 안내문 등 참고 자료를 붙여넣으세요." : "PRD, README, 기술 스펙 등을 붙여넣으세요."}
                className="w-full h-28 p-3 bg-bg-muted border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/25 focus:border-accent outline-none text-text-primary placeholder-text-muted text-xs leading-relaxed transition-all"
                disabled={disabled}
              />
            )}
          </div>

          <div className="space-y-2">
            <button type="button" onClick={() => setShowEngineOptions(!showEngineOptions)} className="text-xs font-semibold text-text-secondary hover:text-text-primary">
              AI 엔진 설정: {DEBATE_ENGINES.find((e) => e.id === debateEngine)?.label}
            </button>
            {showEngineOptions && (
              <div className="space-y-3 p-3 bg-bg-muted rounded-lg border border-border-light">
                <OptionGrid title="토론 엔진" items={DEBATE_ENGINES} selected={debateEngine} onSelect={(id) => handleDebateEngineChange(id as DebateEngineId)} />
                <OptionGrid title="외부 검증 AI" items={VERIFY_ENGINES.filter((e) => !e.condition || e.condition === debateEngine)} selected={verifyEngine} onSelect={(id) => handleVerifyEngineChange(id as VerifyEngineId)} />
                {engineWarning && <div className="px-3 py-2 bg-warning-bg border border-warning/20 rounded-lg text-xs text-warning">{engineWarning}</div>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <WorkflowButton active={workflow === "standard"} title="일반 토론" desc="전문가 토론 후 문서 생성" onClick={() => setWorkflow("standard")} disabled={disabled} />
            <WorkflowButton active={workflow === "plan_harness"} title="자동 계획" desc="요구사항, CPS, 평가" onClick={() => setWorkflow("plan_harness")} disabled={disabled} />
          </div>

          <button
            type="submit"
            disabled={disabled || !isFormValid()}
            className="w-full px-5 py-3 btn-accent text-white text-sm font-black rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {workflow === "plan_harness" ? "자동 계획 시작" : `${MODE_INFO[mode].shortLabel} 시작`}
          </button>
        </section>
      </div>
    </form>
  );
}

function ModeGroup({ title, modes, mode, setMode, disabled }: {
  title: string;
  modes: DebateCommand[];
  mode: DebateCommand;
  setMode: (mode: DebateCommand) => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-black text-text-muted uppercase mb-2">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            disabled={disabled}
            className={`px-3 py-2.5 rounded-lg text-left transition-all border ${
              mode === m ? "bg-accent text-white border-accent shadow-sm" : "bg-bg-card text-text-secondary hover:bg-bg-hover border-border-light"
            }`}
          >
            <div className="text-xs font-black">{MODE_INFO[m].shortLabel}</div>
            <div className={`text-[11px] mt-0.5 ${mode === m ? "text-white/80" : "text-text-muted"}`}>{MODE_INFO[m].label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionGrid({ title, items, selected, onSelect }: {
  title: string;
  items: { id: string; label: string; description?: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-normal text-text-muted uppercase mb-1.5">{title}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`px-3 py-2 rounded-lg text-left transition-all border ${
              selected === item.id ? "bg-accent text-white border-accent" : "bg-bg-card text-text-secondary hover:bg-bg-hover border-border-light"
            }`}
          >
            <div className="text-xs font-bold">{item.label}</div>
            {item.description && <div className={`text-[10px] ${selected === item.id ? "text-white/75" : "text-text-muted"}`}>{item.description}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkflowButton({ active, title, desc, onClick, disabled }: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`px-3 py-2.5 rounded-lg text-left transition-all border ${
      active ? "border-accent bg-accent-light ring-1 ring-accent/20" : "border-border-light bg-bg-card hover:bg-bg-hover"
    }`}>
      <div className="text-xs font-black text-text-primary">{title}</div>
      <div className="text-[11px] text-text-muted mt-0.5">{desc}</div>
    </button>
  );
}

function InputField({ label, value, onChange, placeholder, disabled, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled: boolean; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-text-secondary mb-1 block">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg focus:ring-2 focus:ring-accent/25 focus:border-accent outline-none text-text-primary placeholder-text-muted text-sm transition-all"
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
      <label className="text-xs font-bold text-text-secondary mb-1 block">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="w-full p-3 bg-bg-muted border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/25 focus:border-accent outline-none text-text-primary placeholder-text-muted text-sm leading-relaxed transition-all"
      />
    </div>
  );
}
