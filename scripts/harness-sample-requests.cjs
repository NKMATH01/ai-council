/**
 * 하네스 API 수동 검증용 샘플 요청 body 출력
 * 사용: node scripts/harness-sample-requests.cjs
 * 출력된 JSON을 curl이나 Postman에 붙여 넣어 테스트
 */

const samples = {
  "기본 실행 (모호한 입력)": {
    topic: "챗봇 만들어줘",
    command: "debate",
  },

  "제약 많은 실행": {
    topic: "React + Supabase로 2주 내 모바일 반응형 투두앱, 오프라인 지원 필요",
    command: "debate",
    techSpec: "Next.js 16, Tailwind CSS 4, Supabase Auth + Database",
  },

  "구조 수정 재실행": {
    topic: "React + Supabase 투두앱",
    command: "debate",
    revisionRequest: "결제는 제외하고 MVP를 1주 안에 가능한 범위로 축소",
    previousPlanSummary: "m1: 기본 구조 설정\nm2: 핵심 기능 구현\nt1: 프로젝트 초기화 [m1]\nt2: Supabase 스키마 설계 [m1]\nt3: CRUD API 구현 [m2]\nt4: 결제 연동 [m2]\n실행순서: t1 → t2 → t3 → t4",
  },

  "모델 분리 테스트 (Sonnet generation + Opus evaluation)": {
    topic: "간단한 블로그 만들기",
    command: "debate",
    models: {
      generation: { provider: "anthropic", model: "claude-sonnet-4-6" },
      evaluation: { provider: "anthropic", model: "claude-opus-4-6" },
    },
  },
};

console.log("=== 하네스 API 샘플 요청 ===\n");
console.log("엔드포인트: POST http://localhost:3030/api/plan-harness");
console.log("Content-Type: application/x-ndjson (응답)");
console.log("");

for (const [name, body] of Object.entries(samples)) {
  console.log(`--- ${name} ---`);
  console.log(JSON.stringify(body, null, 2));
  console.log("");
  console.log(`curl -X POST http://localhost:3030/api/plan-harness \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(body)}'`);
  console.log("");
}
