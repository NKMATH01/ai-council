import { ParsedQuestion } from "./types";

/**
 * AI가 생성한 질문 마크다운 텍스트를 구조화된 질문 배열로 파싱합니다.
 *
 * 기대 형식:
 * 1. [객관식] 질문 텍스트? _(이유)_
 *    - a) 선택지 1
 *    - b) 선택지 2
 *
 * 2. [주관식] 질문 텍스트? _(이유)_
 */
export function parseQuestions(raw: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const lines = raw.split("\n");

  let current: Partial<ParsedQuestion> | null = null;

  for (const line of lines) {
    // 질문 시작: "1. [객관식] ..." 또는 "1. 질문..."
    const qMatch = line.match(
      /^\s*(\d+)\.\s*(?:\[([^\]]+)\]\s*)?(.+)/
    );
    if (qMatch) {
      // 이전 질문 저장
      if (current?.text) {
        questions.push(finalizeQuestion(current));
      }

      const idx = parseInt(qMatch[1], 10);
      const tag = qMatch[2]?.trim().toLowerCase() || "";
      const rest = qMatch[3].trim();

      // 이유 추출: _(이유)_ 패턴
      const reasonMatch = rest.match(/[_*]+\((.+?)\)[_*]+\s*$/);
      const reason = reasonMatch ? reasonMatch[1].trim() : "";
      const text = reasonMatch
        ? rest.slice(0, reasonMatch.index).trim()
        : rest;

      const isChoice =
        tag.includes("객관") || tag.includes("choice") || tag.includes("선택");

      current = {
        index: idx,
        text,
        reason,
        type: isChoice ? "choice" : "open",
        options: [],
      };
      continue;
    }

    // 선택지: "   - a) 선택지" 또는 "   - A. 선택지"
    const optMatch = line.match(
      /^\s+-\s*[a-zA-Z][.)]\s*(.+)/
    );
    if (optMatch && current) {
      current.options = current.options || [];
      current.options.push(optMatch[1].trim());
      // 선택지가 있으면 자동으로 객관식
      current.type = "choice";
      continue;
    }
  }

  // 마지막 질문 저장
  if (current?.text) {
    questions.push(finalizeQuestion(current));
  }

  return questions;
}

function finalizeQuestion(partial: Partial<ParsedQuestion>): ParsedQuestion {
  const q: ParsedQuestion = {
    index: partial.index ?? 0,
    text: partial.text ?? "",
    reason: partial.reason ?? "",
    type: partial.type ?? "open",
  };
  if (q.type === "choice" && partial.options && partial.options.length > 0) {
    q.options = partial.options;
  } else if (q.type === "choice") {
    // 객관식 태그인데 선택지가 없으면 주관식으로 전환
    q.type = "open";
  }
  return q;
}
