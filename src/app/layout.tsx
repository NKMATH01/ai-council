import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Council",
  description: "개발과 운영 의사결정을 위한 AI 토론 워크스페이스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&display=swap"
        />
      </head>
      <body
        className="bg-bg min-h-screen text-text-primary antialiased noise"
        style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif" }}
      >
        <header className="glass sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
              <div className="w-9 h-9 rounded-lg btn-accent flex items-center justify-center">
                <span className="text-white font-black text-xs tracking-normal">AC</span>
              </div>
              <div>
                <h1 className="text-sm font-black text-text-primary tracking-normal">AI Council</h1>
                <p className="text-[11px] text-text-muted">Decision workspace</p>
              </div>
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/" className="px-3.5 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-all">
                워크스페이스
              </Link>
              <Link href="/sessions" className="px-3.5 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-all">
                저장 문서
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-5 sm:px-6 py-7 relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
