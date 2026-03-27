import { GeneratedPlan, PlanEvaluation, HarnessRunSnapshot, PlanHarnessArtifacts } from "./types";

export interface HarnessDiff {
  milestonesAdded: string[];
  milestonesRemoved: string[];
  milestonesRenamed: { id: string; from: string; to: string }[];
  tasksAdded: number;
  tasksRemoved: number;
  taskCountBefore: number;
  taskCountAfter: number;
  executionOrderChanged: boolean;
  scoreChange: number | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  passedBefore: boolean | null;
  passedAfter: boolean | null;
  warningsBefore: number;
  warningsAfter: number;
  previousRevisionRequest?: string;
}

const MAX_HISTORY = 3;

export function computeHarnessDiff(
  current: PlanHarnessArtifacts,
  previous: HarnessRunSnapshot,
): HarnessDiff {
  const curPlan = current.generatedPlan;
  const prevPlan = previous.generatedPlan;
  const curEval = current.evaluation;
  const prevEval = previous.evaluation;

  const curMilestoneIds = new Set(curPlan?.milestones.map((m) => m.id) || []);
  const prevMilestoneIds = new Set(prevPlan?.milestones.map((m) => m.id) || []);
  const prevMilestoneMap = new Map((prevPlan?.milestones || []).map((m) => [m.id, m.title]));
  const curMilestoneMap = new Map((curPlan?.milestones || []).map((m) => [m.id, m.title]));

  const milestonesAdded: string[] = [];
  const milestonesRemoved: string[] = [];
  const milestonesRenamed: { id: string; from: string; to: string }[] = [];

  for (const id of curMilestoneIds) {
    if (!prevMilestoneIds.has(id)) {
      milestonesAdded.push(curMilestoneMap.get(id) || id);
    } else {
      const prev = prevMilestoneMap.get(id) || "";
      const cur = curMilestoneMap.get(id) || "";
      if (prev !== cur) milestonesRenamed.push({ id, from: prev, to: cur });
    }
  }
  for (const id of prevMilestoneIds) {
    if (!curMilestoneIds.has(id)) {
      milestonesRemoved.push(prevMilestoneMap.get(id) || id);
    }
  }

  const curTaskIds = new Set(curPlan?.tasks.map((t) => t.id) || []);
  const prevTaskIds = new Set(prevPlan?.tasks.map((t) => t.id) || []);
  let tasksAdded = 0;
  let tasksRemoved = 0;
  for (const id of curTaskIds) { if (!prevTaskIds.has(id)) tasksAdded++; }
  for (const id of prevTaskIds) { if (!curTaskIds.has(id)) tasksRemoved++; }

  const curOrder = (curPlan?.executionOrder || []).join(",");
  const prevOrder = (prevPlan?.executionOrder || []).join(",");

  return {
    milestonesAdded,
    milestonesRemoved,
    milestonesRenamed,
    tasksAdded,
    tasksRemoved,
    taskCountBefore: prevPlan?.tasks.length || 0,
    taskCountAfter: curPlan?.tasks.length || 0,
    executionOrderChanged: curOrder !== prevOrder,
    scoreChange: curEval && prevEval ? curEval.score - prevEval.score : null,
    scoreBefore: prevEval?.score ?? null,
    scoreAfter: curEval?.score ?? null,
    passedBefore: prevEval?.passed ?? null,
    passedAfter: curEval?.passed ?? null,
    warningsBefore: prevEval?.warnings.length || 0,
    warningsAfter: curEval?.warnings.length || 0,
    previousRevisionRequest: previous.revisionRequest,
  };
}

export function createSnapshot(
  artifacts: PlanHarnessArtifacts,
  runNumber: number,
  topic: string,
  revisionRequest?: string,
): HarnessRunSnapshot {
  return {
    runNumber,
    revisionRequest,
    completedAt: Date.now(),
    generatedPlan: artifacts.generatedPlan,
    evaluation: artifacts.evaluation,
    topic,
  };
}

export function pushSnapshot(
  history: HarnessRunSnapshot[],
  snapshot: HarnessRunSnapshot,
): HarnessRunSnapshot[] {
  return [snapshot, ...history].slice(0, MAX_HISTORY);
}
