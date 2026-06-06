"use client";

import { useMemo, useState } from "react";

interface UiPrototypeProps {
  html: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onRefine: (request: string) => void;
  onSkip?: () => void;
}

interface StitchMeta {
  projectId?: string;
  screenId?: string;
  imageUrl?: string;
}

export default function UiPrototype({ html, isGenerating, onGenerate, onRefine, onSkip }: UiPrototypeProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineRequest, setRefineRequest] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const stitchMeta = useMemo(() => extractStitchMeta(html), [html]);
  const isStitchHtml = !!stitchMeta.projectId || html.includes("ai-council-stitch");
  const secondaryButtonClass = "px-3 py-1.5 bg-bg-muted hover:bg-border-light text-text-secondary rounded-lg text-xs font-bold transition-all border border-border-light";

  const handleCopy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRefineSubmit = () => {
    if (!refineRequest.trim()) return;
    onRefine(refineRequest.trim());
    setRefineRequest("");
    setShowRefineInput(false);
  };

  const handleConfirm = () => {
    setConfirmed(true);
    const cmdText = [
      "Use the confirmed Stitch HTML prototype as the visual source of truth.",
      "Implement the real React/Next.js UI to match layout, spacing, colors, and interactions as closely as possible.",
      "Keep the app production-ready, responsive, accessible, and connected to the existing project structure.",
    ].join("\n");
    navigator.clipboard.writeText(cmdText);
  };

  if (!html && !isGenerating) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-text-primary">Stitch UI 프로토타입</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-light text-accent font-bold">Google Stitch</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              PRD를 Stitch로 보내 실제 UI 화면을 생성하고 여기서 바로 미리봅니다.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="px-3.5 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-black transition-all shadow-sm disabled:opacity-40"
            >
              Stitch로 생성
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-3.5 py-2 bg-bg-muted text-text-secondary rounded-lg text-xs font-bold border border-border-light hover:bg-bg-hover transition-all"
              >
                건너뛰기
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="px-5 py-3 border-b border-border-light bg-bg-warm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-text-primary">Stitch UI 프로토타입</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-light text-accent font-bold">
                {isStitchHtml ? "Stitch 생성" : "HTML"}
              </span>
              {stitchMeta.projectId && (
                <span className="text-[10px] text-text-muted">Project {stitchMeta.projectId}</span>
              )}
            </div>
            {stitchMeta.screenId && (
              <p className="text-[11px] text-text-muted mt-1">Screen {stitchMeta.screenId}</p>
            )}
          </div>

          {html && !isGenerating && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setShowPreview((v) => !v)} className={secondaryButtonClass}>
                {showPreview ? "미리보기 닫기" : "미리보기"}
              </button>
              {stitchMeta.imageUrl && (
                <a href={stitchMeta.imageUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                  스크린샷
                </a>
              )}
              <button onClick={handleCopy} className={secondaryButtonClass}>
                {copied ? "복사됨" : "HTML 복사"}
              </button>
              <button onClick={() => setShowRefineInput((v) => !v)} className={secondaryButtonClass}>
                Stitch 수정
              </button>
              {!confirmed && (
                <button onClick={handleConfirm} className="px-3 py-1.5 bg-success hover:bg-success/90 text-white rounded-lg text-xs font-black transition-all shadow-sm">
                  확정
                </button>
              )}
            </div>
          )}
        </div>

        {confirmed && (
          <div className="mt-2 px-3 py-1.5 bg-success-bg rounded-lg text-xs text-success">
            UI 확정 명령문을 클립보드에 복사했습니다.
          </div>
        )}
      </div>

      {isGenerating && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-accent">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm animate-pulse-soft">Stitch가 UI 화면을 생성하는 중입니다. 몇 분 걸릴 수 있습니다.</span>
          </div>
        </div>
      )}

      {showPreview && html && (
        <div className="border-b border-border-light bg-white">
          <iframe
            className="w-full h-[620px] bg-white"
            sandbox="allow-scripts allow-forms allow-popups"
            title="Stitch UI Prototype Preview"
            srcDoc={html}
          />
        </div>
      )}

      {html && (
        <div className="border-b border-border-light">
          <button
            onClick={() => setShowCode((v) => !v)}
            className="w-full px-5 py-2 text-left text-[10px] font-black tracking-normal text-text-muted uppercase hover:bg-bg-hover transition-colors"
          >
            {showCode ? "HTML 코드 숨기기" : "HTML 코드 보기"}
          </button>
          {showCode && (
            <div className="px-5 pb-4">
              <pre className="bg-bg-muted border border-border-light rounded-lg p-3 text-xs overflow-x-auto max-h-[320px]">
                <code>{html}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {showRefineInput && (
        <div className="px-5 py-4 border-t border-border-light bg-bg-muted">
          <div className="text-xs font-bold text-text-secondary mb-2">Stitch 수정 요청</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              value={refineRequest}
              onChange={(event) => setRefineRequest(event.target.value)}
              placeholder="예: 상담 전환율 카드와 주간 액션 체크리스트를 더 눈에 띄게 배치해 주세요."
              className="flex-1 h-20 p-2.5 bg-bg-card border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/25 outline-none text-sm text-text-primary placeholder-text-muted"
            />
            <button
              onClick={handleRefineSubmit}
              disabled={!refineRequest.trim() || isGenerating}
              className="sm:self-end px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              수정 요청
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function extractStitchMeta(html: string): StitchMeta {
  const match = html.match(/<!--\s*ai-council-stitch\s+({[\s\S]*?})\s*-->/);
  if (!match) return {};

  try {
    return JSON.parse(match[1]) as StitchMeta;
  } catch {
    return {};
  }
}
