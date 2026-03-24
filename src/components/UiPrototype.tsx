"use client";

import { useState, useRef } from "react";

interface UiPrototypeProps {
  html: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onRefine: (request: string) => void;
  onSkip?: () => void;
}

export default function UiPrototype({ html, isGenerating, onGenerate, onRefine, onSkip }: UiPrototypeProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineRequest, setRefineRequest] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefineSubmit = () => {
    if (refineRequest.trim()) {
      onRefine(refineRequest.trim());
      setRefineRequest("");
      setShowRefineInput(false);
    }
  };

  const handleConfirm = () => {
    setConfirmed(true);
    // Claude Code 명령문도 자동 복사
    const cmdText = `이 HTML을 기반으로 실제 프로젝트의 프론트엔드를 구현해줘. 디자인과 레이아웃을 최대한 유사하게 만들되, React/Next.js 등 실제 프레임워크로 전환해줘.\n\n[HTML 프로토타입은 별도 파일 참조]`;
    navigator.clipboard.writeText(cmdText);
  };

  const handlePreview = () => {
    if (!showPreview) {
      setShowPreview(true);
      setTimeout(() => {
        if (iframeRef.current) {
          const doc = iframeRef.current.contentDocument;
          if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
          }
        }
      }, 100);
    } else {
      setShowPreview(false);
    }
  };

  // 생성 전 상태
  if (!html && !isGenerating) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🎨</span>
            <span className="text-sm font-bold text-text-primary">UI 프로토타입</span>
            <span className="text-[10px] text-text-muted">(Gemini 3.1 Pro)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onGenerate}
              className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
            >
              UI 생성
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-3.5 py-1.5 bg-bg-muted text-text-muted rounded-lg text-xs font-medium border border-border-light hover:bg-bg-hover transition-all"
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
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border-light bg-bg-warm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🎨</span>
            <span className="text-sm font-bold text-text-primary">UI 프로토타입</span>
            <span className="text-[10px] text-text-muted">(Gemini 3.1 Pro 생성)</span>
          </div>
          {html && !isGenerating && (
            <div className="flex gap-1.5">
              <button onClick={handlePreview} className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-medium transition-all shadow-sm">
                {showPreview ? "미리보기 닫기" : "미리보기"}
              </button>
              <button onClick={handleCopy} className="px-3 py-1.5 bg-bg-muted hover:bg-border-light text-text-secondary rounded-lg text-xs font-medium transition-all border border-border-light">
                {copied ? "복사됨!" : "HTML 복사"}
              </button>
              <button onClick={() => setShowRefineInput(!showRefineInput)} className="px-3 py-1.5 bg-bg-muted hover:bg-border-light text-text-secondary rounded-lg text-xs font-medium transition-all border border-border-light">
                UI 수정
              </button>
              {!confirmed && (
                <button onClick={handleConfirm} className="px-3 py-1.5 bg-success hover:bg-success/90 text-white rounded-lg text-xs font-medium transition-all shadow-sm">
                  확정
                </button>
              )}
            </div>
          )}
        </div>
        {confirmed && (
          <div className="mt-2 px-3 py-1.5 bg-success-bg rounded-lg text-xs text-success">
            UI 확정됨 — Claude Code 명령문이 클립보드에 복사되었습니다
          </div>
        )}
      </div>

      {/* 생성 중 */}
      {isGenerating && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-accent">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm animate-pulse-soft">UI 프로토타입 생성 중...</span>
          </div>
        </div>
      )}

      {/* 미리보기 iframe */}
      {showPreview && html && (
        <div className="border-b border-border-light">
          <iframe
            ref={iframeRef}
            className="w-full h-[500px] bg-white"
            sandbox="allow-scripts"
            title="UI Prototype Preview"
          />
        </div>
      )}

      {/* 코드 보기 */}
      {html && (
        <div className="border-b border-border-light">
          <button
            onClick={() => setShowCode(!showCode)}
            className="w-full px-5 py-2 text-left text-[10px] font-bold tracking-widest text-text-muted uppercase hover:bg-bg-hover transition-colors"
          >
            {showCode ? "코드 숨기기" : "HTML 코드 보기"}
          </button>
          {showCode && (
            <div className="px-5 pb-4">
              <pre className="bg-bg-muted border border-border-light rounded-lg p-3 text-xs overflow-x-auto max-h-[300px]">
                <code>{html}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 수정 요청 */}
      {showRefineInput && (
        <div className="px-5 py-4 border-t border-border-light">
          <div className="text-xs font-medium text-text-secondary mb-2">UI 수정 요청</div>
          <div className="flex gap-2">
            <textarea
              value={refineRequest}
              onChange={(e) => setRefineRequest(e.target.value)}
              placeholder='예: "헤더 색상을 파란색으로 바꿔줘" 또는 "검색 기능 추가해줘"'
              className="flex-1 h-16 p-2.5 bg-bg-muted border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/30 outline-none text-sm text-text-primary placeholder-text-muted"
            />
            <button
              onClick={handleRefineSubmit}
              disabled={!refineRequest.trim() || isGenerating}
              className="self-end px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              수정 요청
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
