import type { Node } from "@xyflow/react";
import type {
  AdaptiveConfigState,
  AdjustmentPolicyEntry,
  BindingCheckItem,
  BindingCompletionResult,
  EnvAssumptionEntry,
  FlowNodeData,
  GlobalResourceBindings,
  NodeBindingEntry,
  PlatformTaskType,
  RuntimeAdjustableParam,
  TechBindingState,
  TechDocumentsData,
  TechExternalsData,
} from "./types";

export const DEFAULT_GLOBAL_BINDINGS: GlobalResourceBindings = {
};

/** Effective skill codes for a node binding (migrates legacy skillBindingCode). */
export function getEffectiveSkillCodes(b: NodeBindingEntry | undefined): string[] {
  if (!b) return [];
  if (b.skillBindingCodes && b.skillBindingCodes.length > 0) {
    return b.skillBindingCodes.filter((c) => c.trim().length > 0);
  }
  if (b.skillBindingCode?.trim()) {
    return [b.skillBindingCode.trim()];
  }
  return [];
}

export function createDefaultTechBindingState(): TechBindingState {
  return {
    global: { ...DEFAULT_GLOBAL_BINDINGS },
    documentsById: {},
    externalsById: {},
    nodesById: {},
  };
}

export function createDefaultAdaptiveConfig(): AdaptiveConfigState {
  return {
    runtimeAdjustable: [] as RuntimeAdjustableParam[],
    envAssumptions: [] as EnvAssumptionEntry[],
    adjustmentPolicies: [] as AdjustmentPolicyEntry[],
  };
}

/**
 * Heuristic completion: Job metadata & triggers, and each node has taskType + runtime + skill/context when not human_review.
 * Resource definitions such as Tool endpoint, Secret provider, Runtime retry, and ContextPolicy rules are checked by registry/readiness.
 */
export function computeBindingCompletion(
  techBindings: TechBindingState,
  nodes: Node<FlowNodeData>[],
  _documents: TechDocumentsData | null,
  _externals: TechExternalsData | null,
  opts?: {
    jobMeta?: { code: string; name: string };
    jobTriggerCodes?: string[];
  }
): BindingCompletionResult {
  const checks: BindingCheckItem[] = [];

  const meta = opts?.jobMeta;
  checks.push({
    ok: !!(meta?.code?.trim() && meta?.name?.trim()),
    label: "Job 元信息（code / name）",
    hint: "填写 Job code 与名称",
  });

  const triggers = opts?.jobTriggerCodes ?? [];
  checks.push({
    ok: triggers.some((t) => t.trim().length > 0),
    label: "触发器已关联",
    hint: "至少填写一个 trigger code（已在 task-platform 注册）",
  });

  const sorted = [...nodes].filter((node) => !node.data.isCondition).sort(
    (a, b) => (a.data.stepIndex ?? 0) - (b.data.stepIndex ?? 0)
  );
  if (sorted.length === 0) {
    checks.push({ ok: false, label: "画布无节点", hint: "请先生成流程" });
  } else {
    let nodeOk = 0;
    for (const n of sorted) {
      const b = techBindings.nodesById[n.id];
      const tt = b?.taskType ?? inferTaskTypeFromCanvas(n.data);
      const needsSkill = tt === "agentic";
      const skills = getEffectiveSkillCodes(b);
      const ok =
        !!tt &&
        (tt === "human_review" || !!(b?.runtimeProfileCode?.trim())) &&
        (!needsSkill || skills.length > 0) &&
        (tt === "human_review" || !!(b?.contextPolicyCode?.trim()));
      if (ok) nodeOk++;
    }
    checks.push({
      ok: nodeOk === sorted.length,
      label: `节点绑定（${nodeOk}/${sorted.length}）`,
      hint: "选择 Task 类型；Agentic 节点需绑定 Skill，非人工节点需绑定上下文策略",
    });
  }

  const passed = checks.filter((c) => c.ok).length;
  const percent = checks.length === 0 ? 0 : Math.round((passed / checks.length) * 100);

  return { percent, checks };
}

function inferTaskTypeFromCanvas(data: FlowNodeData): PlatformTaskType {
  if (data.executionMode === "human_manual") return "human_review";
  if (data.executionMode === "human_confirm") return "human_review";
  return "agentic";
}
