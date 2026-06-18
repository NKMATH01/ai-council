"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "비밀번호가 맞지 않습니다.");
        return;
      }

      window.location.href = next;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-5">
      <form onSubmit={handleSubmit} className="card-elevated w-full max-w-sm p-6 space-y-5">
        <div>
          <p className="text-xs font-black text-accent uppercase">AI Council</p>
          <h1 className="font-display text-2xl font-black text-text-primary mt-1">비밀번호 입력</h1>
          <p className="text-sm text-text-muted mt-2">접속하려면 비밀번호가 필요합니다.</p>
        </div>

        <div>
          <label className="text-xs font-bold text-text-secondary mb-1 block">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full px-3 py-3 bg-bg-muted border border-border-light rounded-lg focus:ring-2 focus:ring-accent/25 focus:border-accent outline-none text-text-primary"
          />
          {error && <p className="text-xs text-error mt-2">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={!password || isSubmitting}
          className="w-full px-5 py-3 btn-accent text-white text-sm font-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "확인 중..." : "입장"}
        </button>
      </form>
    </main>
  );
}

function LoginShell() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-5">
      <div className="card-elevated w-full max-w-sm p-6">
        <p className="text-sm text-text-muted">로그인 화면을 준비 중입니다.</p>
      </div>
    </main>
  );
}
