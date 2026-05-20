"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MousePointer2, SplitSquareHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useFlowAgentStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FlowNodeData, JobGroup, JobGroupEntry } from "@/lib/types";

const TRIGGER_OPTIONS: { value: NonNullable<JobGroupEntry["triggerConfig"]>["type"]; label: string; desc: string }[] = [
  { value: "event", label: "事件触发", desc: "由上游 Job 或平台事件触发" },
  { value: "api", label: "API 触发", desc: "外部系统通过接口触发" },
  { value: "manual", label: "人工触发", desc: "由操作人员手动启动" },
  { value: "schedule", label: "定时触发", desc: "按计划周期运行" },
];

interface SplitNode {
  id: string;
  stepIndex: number;
  label: string;
  isCondition: boolean;
}

function slugify(value: string): string {
  const tokens = value
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => /^[a-zA-Z0-9]+$/.test(t))
    .map((t) => t.toLowerCase());
  return tokens.length ? tokens.join("-") : `job-${Math.random().toString(36).slice(2, 6)}`;
}

function stepRange(nodes: SplitNode[]): [number, number] {
  const steps = nodes.map((n) => n.stepIndex).filter((n) => n > 0);
  if (steps.length === 0) return [0, 0];
  return [Math.min(...steps), Math.max(...steps)];
}

export default function JobSplitPanel() {
  const nodes = useFlowAgentStore((s) => s.nodes);
  const techJobMeta = useFlowAgentStore((s) => s.techJobMeta);
  const jobSplitDraft = useFlowAgentStore((s) => s.jobSplitDraft);
  const setJobSplitDraft = useFlowAgentStore((s) => s.setJobSplitDraft);
  const resetJobSplitDraft = useFlowAgentStore((s) => s.resetJobSplitDraft);
  const setJobGroup = useFlowAgentStore((s) => s.setJobGroup);
  const jobGroup = useFlowAgentStore((s) => s.jobGroup);
  const [triggerType, setTriggerType] = useState<NonNullable<JobGroupEntry["triggerConfig"]>["type"]>("event");

  const sorted = useMemo<SplitNode[]>(
    () =>
      [...nodes]
        .map((n) => {
          const data = n.data as FlowNodeData;
          return {
            id: n.id,
            stepIndex: data.stepIndex ?? 0,
            label: data.label ?? n.id,
            isCondition: Boolean(data.isCondition),
          };
        })
        .sort((a, b) => a.stepIndex - b.stepIndex),
    [nodes]
  );

  const taskNodes = sorted.filter((node) => !node.isCondition);
  const selectedIds = new Set(jobSplitDraft.selectedNodeIds);
  const selectedNodes = taskNodes.filter((node) => selectedIds.has(node.id));
  const remainingNodes = taskNodes.filter((node) => !selectedIds.has(node.id));
  const conditionNodes = sorted.filter((node) => node.isCondition);
  const canConfirm = selectedNodes.length > 0 && remainingNodes.length > 0;

  function confirmSplit() {
    if (selectedNodes.length === 0) {
      toast.error("请先在画布上点选要拆出去的工作节点");
      return;
    }
    if (remainingNodes.length === 0) {
      toast.error("不能把所有工作节点都拆出去，至少保留一个主 Job 节点");
      return;
    }

    const mainName = techJobMeta.name || "原主流程 Job";
    const newName =
      jobSplitDraft.newJobName.trim() ||
      `${selectedNodes[0].label}${selectedNodes.length > 1 ? "等" : ""} Job`;

    const entries: JobGroupEntry[] = [
      {
        schemaId: techJobMeta.code || slugify(mainName),
        name: mainName,
        nodeIds: remainingNodes.map((node) => node.id),
        nodeStepRange: stepRange(remainingNodes),
        triggerConfig: { type: "api" },
      },
      {
        schemaId: slugify(newName),
        name: newName,
        nodeIds: selectedNodes.map((node) => node.id),
        nodeStepRange: stepRange(selectedNodes),
        triggerConfig: { type: triggerType },
      },
    ];

    const group: JobGroup = {
      id: `jg-${Date.now()}`,
      name: `${mainName} → ${newName}`,
      sourceSchemaId: techJobMeta.code || undefined,
      createdAt: new Date().toISOString(),
      jobs: entries,
      sharedResources: [],
      relatedJobs: [],
    };

    setJobGroup(group);
    resetJobSplitDraft();
    toast.success(`已拆分为 2 个 Job：${mainName} / ${newName}`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
        <div className="flex items-start gap-2">
          <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
          <div>
            <p className="text-[12px] font-semibold text-purple-900">拆分模式已开启</p>
            <p className="mt-1 text-[11px] leading-5 text-purple-800">
              直接在画布上点击要拆成另一份 Job 的<strong>工作节点</strong>。路由节点只是 flow.condition，
              不会作为 Job 的 Task 被选择。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <p className="text-[11px] font-semibold text-zinc-800">保留在主 Job</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">{remainingNodes.length} 个工作节点</p>
          <div className="mt-2 space-y-1">
            {remainingNodes.slice(0, 5).map((node) => (
              <div key={node.id} className="truncate rounded-md bg-zinc-50 px-2 py-1 text-[10px] text-zinc-600">
                {node.stepIndex}. {node.label}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3">
          <p className="text-[11px] font-semibold text-purple-900">拆成新 Job</p>
          <p className="mt-0.5 text-[10px] text-purple-500">{selectedNodes.length} 个工作节点</p>
          <div className="mt-2 space-y-1">
            {selectedNodes.length > 0 ? (
              selectedNodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-[10px] text-purple-700">
                  <span className="truncate">{node.stepIndex}. {node.label}</span>
                  <button
                    type="button"
                    className="shrink-0 text-purple-300 hover:text-red-500"
                    onClick={() => {
                      setJobSplitDraft({
                        selectedNodeIds: jobSplitDraft.selectedNodeIds.filter((id) => id !== node.id),
                      });
                    }}
                    title="取消选择"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-purple-200 bg-white/60 px-2 py-3 text-center text-[10px] text-purple-400">
                尚未选择节点
              </p>
            )}
          </div>
        </div>
      </div>

      {conditionNodes.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[10px] leading-5 text-amber-800">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              当前画布包含 {conditionNodes.length} 个路由节点。确认拆分后，需要在 JobSpec 预览中检查
              `flow.condition` 是否仍指向同一 Job 内的 Task；跨 Job 条件应提升为事件或数据依赖。
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-medium text-zinc-700">新 Job 名称</label>
          <Input
            value={jobSplitDraft.newJobName}
            onChange={(e) => setJobSplitDraft({ newJobName: e.target.value })}
            placeholder="例如：GSDS PDF 自动入库 Job"
            className="h-9 text-[12px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-zinc-700">新 Job 触发方式</label>
          <Select value={triggerType} onValueChange={(v) => setTriggerType(v as typeof triggerType)}>
            <SelectTrigger className="h-9 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex flex-col gap-0.5 text-left">
                    <span>{option.label}</span>
                    <span className="text-[10px] text-zinc-400">{option.desc}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 flex-1 text-[11px]"
            disabled={!canConfirm}
            onClick={confirmSplit}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            确认拆分
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]" onClick={resetJobSplitDraft}>
            退出
          </Button>
        </div>
      </div>

      {jobGroup ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-[11px] text-emerald-900">
          <p className="font-semibold">当前已保存 Job Group</p>
          <p className="mt-1 leading-5">
            {jobGroup.jobs.map((job) => job.name).join(" / ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
