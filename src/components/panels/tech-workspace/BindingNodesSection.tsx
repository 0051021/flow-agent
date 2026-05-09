"use client";

import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { useFlowAgentStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FlowNodeData, NodeBindingEntry, PlatformTaskType } from "@/lib/types";

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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-medium text-zinc-400 w-6">{data.stepIndex}</span>
        <span className="text-[12px] font-semibold text-zinc-900">{data.label}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">执行类型</label>
          <Select
            value={tt}
            onValueChange={(v) => {
              const next = v as PlatformTaskType;
              const patch: Partial<NodeBindingEntry> = {
                taskType: next,
                runtimeProfileCode: recommendRuntime(next),
              };
              if (next === "human_review") {
                patch.skillBindingCode = "";
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
          <label className="text-[10px] text-zinc-500 block mb-0.5">运行时环境</label>
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
          <label className="text-[10px] text-zinc-500 block mb-0.5">绑定技能</label>
          <Input
            value={binding.skillBindingCode ?? ""}
            onChange={(e) => setNodeBinding(node.id, { skillBindingCode: e.target.value })}
            placeholder={needsSkill ? "skillBinding.code" : "人工操作无需技能"}
            disabled={!needsSkill}
            className="font-mono text-[11px] h-8"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">审核策略</label>
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
