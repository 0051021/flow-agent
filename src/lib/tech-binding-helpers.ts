import type { Node } from "@xyflow/react";
import type {
  AdaptiveConfigState,
  AdjustmentPolicyEntry,
  BindingCheckItem,
  BindingCompletionResult,
  EnvAssumptionEntry,
  ExternalSystem,
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
  timezone: "Asia/Shanghai",
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
 * Heuristic completion: Job metadata & triggers, each doc has code, each ext has tool/secret or skipped,
 * each node has taskType + runtime + skill when not human_review.
 */
export function computeBindingCompletion(
  techBindings: TechBindingState,
  nodes: Node<FlowNodeData>[],
  documents: TechDocumentsData | null,
  externals: TechExternalsData | null,
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

  const docs = documents?.documents ?? [];
  if (docs.length === 0) {
    checks.push({ ok: true, label: "无文档需绑定（AI 未生成文档契约）" });
  } else {
    let docOk = 0;
    for (const d of docs) {
      const b = techBindings.documentsById[d.id];
      const ok = !!(b?.contextSourceCode?.trim());
      if (ok) docOk++;
    }
    checks.push({
      ok: docOk === docs.length,
      label: `文档 ContextSource（${docOk}/${docs.length}）`,
      hint: "为每个文档填写数据源标识",
    });
  }

  const systems = externals?.externalSystems ?? [];
  if (systems.length === 0) {
    checks.push({ ok: true, label: "无外部系统需绑定" });
  } else {
    let extOk = 0;
    for (const s of systems) {
      const b = techBindings.externalsById[s.id];
      const ok = externalBindingSatisfied(s, b);
      if (ok) extOk++;
    }
    checks.push({
      ok: extOk === systems.length,
      label: `外部系统工具/凭证（${extOk}/${systems.length}）`,
      hint: "填写 tool/secret 或标记跳过",
    });
  }

  const sorted = [...nodes].sort(
    (a, b) => (a.data.stepIndex ?? 0) - (b.data.stepIndex ?? 0)
  );
  if (sorted.length === 0) {
    checks.push({ ok: false, label: "画布无节点", hint: "请先生成流程" });
  } else {
    let nodeOk = 0;
    for (const n of sorted) {
      const b = techBindings.nodesById[n.id];
      const tt = b?.taskType ?? inferTaskTypeFromCanvas(n.data);
      const needsSkill = tt !== "human_review";
      const skills = getEffectiveSkillCodes(b);
      const ok =
        !!tt &&
        !!(b?.runtimeProfileCode?.trim()) &&
        (!needsSkill || skills.length > 0) &&
        (!needsSkill || !!(b?.contextPolicyCode?.trim()));
      if (ok) nodeOk++;
    }
    checks.push({
      ok: nodeOk === sorted.length,
      label: `节点绑定（${nodeOk}/${sorted.length}）`,
      hint: "选择执行方式；非人工节点需绑定 Skill 和上下文策略",
    });
  }

  const passed = checks.filter((c) => c.ok).length;
  const percent = checks.length === 0 ? 0 : Math.round((passed / checks.length) * 100);

  return { percent, checks };
}

function externalBindingSatisfied(
  s: ExternalSystem,
  b: { toolCode?: string; secretCode?: string; skipped?: boolean } | undefined
): boolean {
  if (b?.skipped) return true;
  if (s.integration.readiness === "not_available") return true;
  return !!(b?.toolCode?.trim() && b?.secretCode?.trim());
}

function inferTaskTypeFromCanvas(data: FlowNodeData): PlatformTaskType {
  if (data.executionMode === "human_manual") return "human_review";
  if (data.executionMode === "human_confirm") return "human_review";
  return "agentic";
}
