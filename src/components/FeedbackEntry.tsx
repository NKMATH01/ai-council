"use client";

import { FeedbackEntry as FeedbackType } from "@/lib/types";

interface FeedbackEntryProps {
  feedback: FeedbackType;
}

export default function FeedbackEntryComponent({ feedback }: FeedbackEntryProps) {
  return (
    <div className="animate-fade-in card border-accent/15 bg-accent-light/15 px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-md bg-accent flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-accent">사용자 피드백</span>
        <span className="text-[10px] text-text-muted">v{feedback.afterRevision} 이후</span>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed ml-7">{feedback.content}</p>
    </div>
  );
}
