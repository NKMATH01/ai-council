import { PlanHarnessArtifacts } from "./types";

/**
 * 이전 하네스 결과에서 재실행에 필요한 최소 요약을 추출한다.
 * 전체 JSON이 아니라, 수정 요청을 기존 구조에 연결하기 위한 참고 자료.
 */
export function buildPreviousHarnessSummary(artifacts: PlanHarnessArtifacts): string {
  const lines: string[] = [];

  if (artifacts.generatedPlan) {
    const p = artifacts.generatedPlan;
    lines.push(`목표: ${p.objective}`);
    lines.push(`복잡도: ${p.estimatedComplexity}`);

    lines.push("\n마일스톤:");
    for (const m of p.milestones) {
      lines.push(`  ${m.id}: ${m.title}`);
    }

    lines.push("\n태스크:");
    for (const t of p.tasks) {
      lines.push(`  ${t.id}: ${t.title} [${t.milestoneId}] → ${t.deliverable}`);
    }

    lines.push(`\n실행순서: ${p.executionOrder.join(" → ")}`);

    if (p.acceptanceCriteria.length > 0) {
      lines.push("\n인수기준:");
      for (const ac of p.acceptanceCriteria) {
        lines.push(`  - ${ac}`);
      }
    }
  }

  if (artifacts.evaluation) {
    const e = artifacts.evaluation;
    lines.push(`\n평가: ${e.score}점 (${e.passed ? "통과" : "미통과"})`);
    if (e.warnings.length > 0) {
      lines.push("경고:");
      for (const w of e.warnings) lines.push(`  - ${w}`);
    }
    if (e.suggestedFixes.length > 0) {
      lines.push("수정 제안:");
      for (const f of e.suggestedFixes) lines.push(`  - ${f}`);
    }
  }

  if (artifacts.requirementSpec) {
    const rs = artifacts.requirementSpec;
    if (rs.constraints.length > 0) {
      lines.push(`\n제약사항: ${rs.constraints.join(", ")}`);
    }
    if (rs.nonGoals.length > 0) {
      lines.push(`비목표: ${rs.nonGoals.join(", ")}`);
    }
  }

  return lines.join("\n");
}
