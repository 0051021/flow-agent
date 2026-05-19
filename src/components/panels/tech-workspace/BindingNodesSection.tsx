"use client";

import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { useFlowAgentStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FlowNodeData, NodeBindingEntry, PlatformTaskType } from "@/lib/types";
import { getEffectiveSkillCodes } from "@/lib/tech-binding-helpers";
import { REGISTERED_CONTEXT_POLICY_OPTIONS } from "@/lib/registered-skills";

const TASK_OPTIONS: { value: PlatformTaskType; label: string }[] = [
  { value: "agentic", label: "agentic — AI 自主" },
  { value: "integration", label: "integration — 系统对接" },
  { value: "deterministic", label: "deterministic — 固定脚本" },
  { value: "human_review", label: "human_review — 人工操作" },
];

const RUNTIME_OPTIONS = [
  "agentic-default",
  "integration-default",
  "script-fast",
  "human-bridge",
];

function inferTaskType(data: FlowNodeData): PlatformTaskType {
  if (data.executionMode === "human_manual" || data.executionMode === "human_confirm") {
    return "human_review";
  }
  return "agentic";
}

function recommendRuntime(tt: PlatformTaskType): string {
  switch (tt) {
    case "agentic":
      return "agentic-default";
    case "integration":
      return "integration-default";
    case "deterministic":
      return "script-fast";
    case "human_review":
      return "human-bridge";
    default:
      return "agentic-default";
  }
}

function slugifyTaskCode(name: string, fallback: string): string {
  const tokens = name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => /^[a-zA-Z0-9]+$/.test(t))
    .map((t) => t.toLowerCase());

  if (tokens.length === 0) return fallback;
  return tokens.join("-");
}

function NodeRow({
  node,
  binding,
  setNodeBinding,
}: {
  node: Node<FlowNodeData>;
  binding: NodeBindingEntry;
  setNodeBinding: (nodeId: string, partial: Partial<NodeBindingEntry>) => void;
}) {
  const data = node.data as FlowNodeData;
  const tt = binding.taskType ?? inferTaskType(data);
  const needsSkill = tt !== "human_review";
  const taskCode = binding.taskCode ?? slugifyTaskCode(data.label, `task-${data.stepIndex || node.id}`);
  const skillText = getEffectiveSkillCodes(binding).join(", ");

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-medium text-zinc-400 w-6">
          {data.stepIndex}/{data.totalSteps}
        </span>
        <span className="text-[12px] font-semibold text-zinc-900">{data.label}</span>
        <span className="text-[10px] font-mono text-zinc-400 ml-auto">nodes[{data.stepIndex - 1}]</span>
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 block mb-0.5">
          执行器指令 <span className="font-mono text-zinc-400">identity.description</span>
        </label>
        <Textarea
          value={data.description}
          readOnly
          rows={2}
          className="text-[11px] text-zinc-500 bg-zinc-50 resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">
            Task 编码 <span className="font-mono text-zinc-400">identity.code</span>
          </label>
          <Input
            value={taskCode}
            onChange={(e) => setNodeBinding(node.id, { taskCode: e.target.value })}
            placeholder="task code"
            className="font-mono text-[11px] h-8"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">
            执行类型 <span className="font-mono text-zinc-400">taskType</span>
          </label>
          <Select
            value={tt}
            onValueChange={(v) => {
              const next = v as PlatformTaskType;
              const patch: Partial<NodeBindingEntry> = {
                taskType: next,
                runtimeProfileCode: recommendRuntime(next),
              };
              if (next === "human_review") {
                patch.skillBindingCodes = [];
                patch.skillBindingCode = undefined;
                patch.contextPolicyCode = undefined;
              }
              setNodeBinding(node.id, patch);
            }}
          >
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">
            运行时环境 <span className="font-mono text-zinc-400">runtimeBinding.profileCode</span>
          </label>
          <Select
            value={binding.runtimeProfileCode ?? recommendRuntime(tt)}
            onValueChange={(v) =>
              setNodeBinding(node.id, { runtimeProfileCode: v ?? undefined })
            }
          >
            <SelectTrigger className="h-8 text-[11px] font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RUNTIME_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={needsSkill ? "" : "opacity-50 pointer-events-none"}>
          <label className="text-[10px] text-zinc-500 block mb-0.5">
            绑定技能 <span className="font-mono text-zinc-400">skillBinding.code</span>
          </label>
          <Input
            value={skillText}
            onChange={(e) =>
              setNodeBinding(node.id, {
                skillBindingCodes: e.target.value
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean),
                skillBindingCode: undefined,
              })
            }
            placeholder={needsSkill ? "skill-a, skill-b" : "人工操作无需技能"}
            disabled={!needsSkill}
            className="font-mono text-[11px] h-8"
          />
        </div>
        {needsSkill ? (
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">
              上下文策略 <span className="font-mono text-zinc-400">context_policy_code</span>
            </label>
            <Select
              value={binding.contextPolicyCode ?? ""}
              onValueChange={(v) => setNodeBinding(node.id, { contextPolicyCode: v || undefined })}
            >
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue placeholder="选择上下文策略…" />
              </SelectTrigger>
              <SelectContent>
                {REGISTERED_CONTEXT_POLICY_OPTIONS.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.title} · {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">
            审核策略 <span className="font-mono text-zinc-400">humanInteraction.reviewBinding.code</span>
          </label>
          <Input
            value={binding.reviewPolicyCode ?? ""}
            onChange={(e) => setNodeBinding(node.id, { reviewPolicyCode: e.target.value })}
            placeholder="可选 reviewBinding.code"
            className="font-mono text-[11px] h-8"
          />
        </div>
      </div>
    </div>
  );
}

export default function BindingNodesSection() {
  const nodes = useFlowAgentStore((s) => s.nodes);
  const techBindings = useFlowAgentStore((s) => s.techBindings);
  const setNodeBinding = useFlowAgentStore((s) => s.setNodeBinding);

  const sorted = useMemo(
    () =>
      [...nodes].sort((a, b) => (a.data.stepIndex ?? 0) - (b.data.stepIndex ?? 0)),
    [nodes]
  );

  if (sorted.length === 0) {
    return <p className="text-[12px] text-zinc-400 py-4">画布暂无节点。</p>;
  }

  return (
    <div className="space-y-2">
      {sorted.map((n) => (
        <NodeRow
          key={n.id}
          node={n as Node<FlowNodeData>}
          binding={techBindings.nodesById[n.id] ?? {}}
          setNodeBinding={setNodeBinding}
        />
      ))}
    </div>
  );
}
