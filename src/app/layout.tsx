import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Council",
  description: "AI 관점 수렴을 통해 최적의 결과물을 도출합니다",
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
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&display=swap"
        />
      </head>
      <body
        className="bg-bg min-h-screen text-text-primary antialiased"
        style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif" }}
      >
        {/* Global header */}
        <header className="border-b border-border-light bg-bg-card/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
                <span className="text-white font-bold text-[10px] tracking-tight">AC</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-text-primary tracking-tight">AI Council</h1>
                <p className="text-[10px] text-text-muted tracking-wide">관점 수렴 워크스페이스</p>
              </div>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-xs text-text-secondary hover:text-text-primary transition-colors">
                워크스페이스
              </Link>
              <Link href="/sessions" className="text-xs text-text-secondary hover:text-text-primary transition-colors">
                저장 문서
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
