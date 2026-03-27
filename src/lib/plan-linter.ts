import { GeneratedPlan, PlanLintIssue, RequirementSpec } from "./types";

const VAGUE_TITLES = [
  "구현", "개선", "정리", "작업", "처리", "개발", "수정",
  "implementation", "improvement", "cleanup", "work", "fix",
];

/**
 * 계획 결과의 도메인 검증을 수행합니다.
 * 스키마 통과 후 의미 수준 검증.
 */
export function lintPlan(
  plan: GeneratedPlan,
  requirementSpec?: RequirementSpec,
): PlanLintIssue[] {
  const issues: PlanLintIssue[] = [];

  // 1. milestone 1개 이상
  if (plan.milestones.length === 0) {
    issues.push({ code: "NO_MILESTONE", severity: "error", message: "마일스톤이 0개입니다. 최소 1개 이상 필요합니다." });
  }

  // 2. task 1개 이상
  if (plan.tasks.length === 0) {
    issues.push({ code: "NO_TASK", severity: "error", message: "태스크가 0개입니다. 최소 1개 이상 필요합니다." });
  }

  // 3. 모든 task에 유효한 milestoneId
  const milestoneIds = new Set(plan.milestones.map((m) => m.id));
  for (const task of plan.tasks) {
    if (!milestoneIds.has(task.milestoneId)) {
      issues.push({
        code: "ORPHAN_TASK",
        severity: "error",
        message: `태스크 "${task.id}"의 milestoneId "${task.milestoneId}"가 존재하지 않는 마일스톤을 참조합니다.`,
      });
    }
  }

  // 4. acceptanceCriteria 최소 3개
  if (plan.acceptanceCriteria.length < 3) {
    issues.push({
      code: "FEW_ACCEPTANCE_CRITERIA",
      severity: "error",
      message: `acceptanceCriteria가 ${plan.acceptanceCriteria.length}개입니다. 최소 3개 필요합니다.`,
    });
  }

  // 5. executionOrder에 모든 task id 포함
  const taskIds = new Set(plan.tasks.map((t) => t.id));
  const orderSet = new Set(plan.executionOrder);
  for (const tid of taskIds) {
    if (!orderSet.has(tid)) {
      issues.push({
        code: "MISSING_IN_EXECUTION_ORDER",
        severity: "error",
        message: `태스크 "${tid}"가 executionOrder에 포함되어 있지 않습니다.`,
      });
    }
  }

  // 6. 순환 참조 검출 (dependsOn + dependencies)
  const cycleResult = detectCycles(plan);
  if (cycleResult) {
    issues.push({
      code: "CIRCULAR_DEPENDENCY",
      severity: "error",
      message: `순환 참조 발견: ${cycleResult}`,
    });
  }

  // 7. 모호한 단문 title 금지
  for (const task of plan.tasks) {
    const titleTrimmed = task.title.trim();
    if (titleTrimmed.length < 5 || VAGUE_TITLES.some((v) => titleTrimmed === v)) {
      issues.push({
        code: "VAGUE_TASK_TITLE",
        severity: "error",
        message: `태스크 "${task.id}"의 제목 "${titleTrimmed}"이(가) 너무 모호합니다. 구체적인 동사+명사 조합을 사용하세요.`,
      });
    }
  }

  // 8. 중복 task title 검출
  const seenTitles = new Map<string, string>();
  for (const task of plan.tasks) {
    const normalized = task.title.trim().toLowerCase();
    if (seenTitles.has(normalized)) {
      issues.push({
        code: "DUPLICATE_TASK_TITLE",
        severity: "warning",
        message: `태스크 "${task.id}"와 "${seenTitles.get(normalized)}"의 제목이 동일합니다: "${task.title}"`,
      });
    }
    seenTitles.set(normalized, task.id);
  }

  // 9. 추상적 deliverable 검출
  for (const task of plan.tasks) {
    const d = task.deliverable.trim();
    if (d.length < 5 || /^(완료|완성|결과물|output|done|result)$/i.test(d)) {
      issues.push({
        code: "VAGUE_DELIVERABLE",
        severity: "warning",
        message: `태스크 "${task.id}"의 deliverable "${d}"이(가) 추상적입니다. 구체적인 산출물을 명시하세요.`,
      });
    }
  }

  // 10. 선후관계 충돌: dependsOn 에 없는 task id 참조
  for (const task of plan.tasks) {
    for (const dep of task.dependsOn) {
      if (!taskIds.has(dep)) {
        issues.push({
          code: "INVALID_DEPENDENCY",
          severity: "error",
          message: `태스크 "${task.id}"가 존재하지 않는 태스크 "${dep}"에 의존합니다.`,
        });
      }
    }
  }

  // 11. 요구사항 미반영 검출
  if (requirementSpec) {
    const planText = JSON.stringify(plan).toLowerCase();
    const criticalConstraints = requirementSpec.constraints.filter((c) => c.trim().length > 3);
    const unreflected = criticalConstraints.filter((c) => {
      const keywords = c.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      return keywords.length > 0 && !keywords.some((k) => planText.includes(k));
    });
    // 50% 이상 미반영 → error
    if (unreflected.length > 0 && unreflected.length >= criticalConstraints.length * 0.5) {
      issues.push({
        code: "REQUIREMENTS_NOT_REFLECTED",
        severity: "error",
        message: `요구사항의 핵심 제약 ${unreflected.length}개가 계획에 반영되지 않았습니다: ${unreflected.slice(0, 3).join(", ")}`,
      });
    }
    // 개별 미반영 제약 → warning (1개라도)
    else if (unreflected.length > 0) {
      for (const c of unreflected.slice(0, 3)) {
        issues.push({
          code: "CONSTRAINT_NOT_REFLECTED",
          severity: "warning",
          message: `제약사항 "${c}"이(가) 계획에 명시적으로 반영되지 않았습니다.`,
        });
      }
    }
  }

  // 12. ownerHint 다양성 검출 — 모든 task가 같은 ownerHint면 경고
  if (plan.tasks.length >= 3) {
    const owners = new Set(plan.tasks.map((t) => t.ownerHint.trim().toLowerCase()));
    if (owners.size === 1) {
      issues.push({
        code: "SINGLE_OWNER_HINT",
        severity: "warning",
        message: `모든 태스크의 ownerHint가 "${plan.tasks[0].ownerHint}"으로 동일합니다. 역할 분담이 필요합니다.`,
      });
    }
  }

  // 13. 마일스톤당 태스크 불균형 검출
  for (const ms of plan.milestones) {
    const msTasks = plan.tasks.filter((t) => t.milestoneId === ms.id);
    if (msTasks.length === 0) {
      issues.push({
        code: "EMPTY_MILESTONE",
        severity: "warning",
        message: `마일스톤 "${ms.id}"에 할당된 태스크가 없습니다.`,
      });
    }
  }

  // 13. executionOrder 에 존재하지 않는 task id 참조
  for (const orderId of plan.executionOrder) {
    if (!taskIds.has(orderId)) {
      issues.push({
        code: "INVALID_EXECUTION_ORDER_REF",
        severity: "warning",
        message: `executionOrder에 존재하지 않는 태스크 "${orderId}"가 포함되어 있습니다.`,
      });
    }
  }

  // 14. 선후관계 충돌: executionOrder 상 의존 태스크가 뒤에 오는 경우
  const orderIndex = new Map<string, number>();
  plan.executionOrder.forEach((id, idx) => orderIndex.set(id, idx));
  for (const task of plan.tasks) {
    const taskIdx = orderIndex.get(task.id);
    if (taskIdx === undefined) continue;
    for (const dep of task.dependsOn) {
      const depIdx = orderIndex.get(dep);
      if (depIdx !== undefined && depIdx >= taskIdx) {
        issues.push({
          code: "EXECUTION_ORDER_CONFLICT",
          severity: "error",
          message: `태스크 "${task.id}"가 의존하는 "${dep}"이 executionOrder에서 뒤에 있습니다.`,
        });
      }
    }
  }

  return issues;
}

/**
 * DFS 기반 순환 참조 검출
 */
function detectCycles(plan: GeneratedPlan): string | null {
  const adjacency = new Map<string, string[]>();
  for (const task of plan.tasks) {
    adjacency.set(task.id, [...task.dependsOn]);
  }
  for (const dep of plan.dependencies) {
    const existing = adjacency.get(dep.from) || [];
    if (!existing.includes(dep.to)) {
      existing.push(dep.to);
      adjacency.set(dep.from, existing);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  for (const taskId of adjacency.keys()) {
    const cycle = dfs(taskId, adjacency, visited, inStack, []);
    if (cycle) return cycle;
  }
  return null;
}

function dfs(
  node: string,
  adj: Map<string, string[]>,
  visited: Set<string>,
  inStack: Set<string>,
  path: string[],
): string | null {
  if (inStack.has(node)) {
    return [...path, node].join(" → ");
  }
  if (visited.has(node)) return null;

  visited.add(node);
  inStack.add(node);
  path.push(node);

  for (const neighbor of adj.get(node) || []) {
    const cycle = dfs(neighbor, adj, visited, inStack, path);
    if (cycle) return cycle;
  }

  path.pop();
  inStack.delete(node);
  return null;
}
