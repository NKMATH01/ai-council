/**
 * 환경변수 검증 — 이 모듈을 import하면 필수 환경변수 존재 여부를 즉시 확인합니다.
 * 누락 시 명확한 에러 메시지와 함께 프로세스가 종료됩니다.
 */

const isTest = process.env.NODE_ENV === "test" || !!process.env.VITEST || process.argv[1]?.includes("test");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (isTest) {
      return `test-dummy-${name}`;
    }
    throw new Error(
      `[env] 필수 환경변수 ${name}이(가) 설정되지 않았습니다. .env.local 파일을 확인하세요.`
    );
  }
  return value;
}

// AI API Keys
export const ANTHROPIC_API_KEY = requireEnv("ANTHROPIC_API_KEY");
export const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
export const GEMINI_API_KEY = requireEnv("GEMINI_API_KEY");

// Supabase
export const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
