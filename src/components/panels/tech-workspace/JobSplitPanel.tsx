"use client";

import { useMemo, useState } from "react";
import { Scissors, X, Plus, GitBranch, AlertTriangle } from "lucide-react";
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

const JOB_COLORS = [
  "border-l-emerald-400 bg-emerald-50/60",
  "border-l-violet-400 bg-violet-50/60",
  "border-l-amber-400 bg-amber-50/60",
  "border-l-sky-400 bg-sky-50/60",
];

const JOB_LABELS = ["A", "B", "C", "D", "E", "F"];

const TRIGGER_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "schedule", label: "定时执行", desc: "按 cron 表达式定期运行" },
  { value: "manual", label: "人工触发", desc: "由操作人员手动启动" },
  { value: "event", label: "事件驱动", desc: "前一个 Job 完成后自动触发" },
  { value: "api", label: "API 调用", desc: "外部系统通过接口触发" },
];

interface SortedNode {
  id: string;
  stepIndex: number;
  label: string;
  isCondition: boolean;
  branchTargets: string[];
}

export default function JobSplitPanel() {
  const nodes = useFlowAgentStore((s) => s.nodes);
  const edges = useFlowAgentStore((s) => s.edges);
  const setJobGroup = useFlowAgentStore((s) => s.setJobGroup);
  const jobGroup = useFlowAgentStore((s) => s.jobGroup);

  const sorted = useMemo<SortedNode[]>(() => {
    const edgesBySource = new Map<string, string[]>();
    for (const e of edges) {
      const list = edgesBySource.get(e.source) ?? [];
      list.push(e.target);
      edgesBySource.set(e.source, list);
    }

    return [...nodes]
      .map((n) => {
        const d = n.data as FlowNodeData;
        const targets = edgesBySource.get(n.id) ?? [];
        return {
          id: n.id,
          stepIndex: d.stepIndex ?? 0,
          label: d.label ?? n.id,
          isCondition: !!d.isCondition,
          branchTargets: targets,
        };
      })
      .sort((a, b) => a.stepIndex - b.stepIndex);
  }, [nodes, edges]);

  const nodeIdToLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of sorted) m.set(n.id, n.label);
    return m;
  }, [sorted]);

  const nodeIdToSortedIdx = useMemo(() => {
    const m = new Map<string, number>();
    sorted.forEach((n, i) => m.set(n.id, i));
    return m;
  }, [sorted]);

  // dividers[i] means there's a split AFTER sorted[i]
  const [dividers, setDividers] = useState<Set<number>>(new Set());
  const [jobNames, setJobNames] = useState<Record<number, string>>({});
  const [jobTriggers, setJobTriggers] = useState<Record<number, string>>({});
  const [jobCrons, setJobCrons] = useState<Record<number, string>>({});

  const jobs = useMemo(() => {
    const result: { jobIdx: number; nodes: SortedNode[] }[] = [];
    let current: SortedNode[] = [];
    let jobIdx = 0;

    sorted.forEach((node, i) => {
      current.push(node);
      if (dividers.has(i) || i === sorted.length - 1) {
        result.push({ jobIdx, nodes: current });
        current = [];
        jobIdx++;
      }
    });
    return result;
  }, [sorted, dividers]);

  const hasSplit = dividers.size > 0;

  const crossJobWarnings = useMemo(() => {
    if (!hasSplit) return [];
    const warnings: string[] = [];
    for (const node of sorted) {
      if (!node.isCondition) continue;
      const nodeIdx = nodeIdToSortedIdx.get(node.id) ?? -1;
      const nodeJobIdx = jobs.findIndex((j) => j.nodes.some((n) => n.id === node.id));
      for (const targetId of node.branchTargets) {
        const targetJobIdx = jobs.findIndex((j) => j.nodes.some((n) => n.id === targetId));
        if (targetJobIdx !== -1 && targetJobIdx !== nodeJobIdx) {
          const targetLabel = nodeIdToLabel.get(targetId) ?? targetId;
          const srcJob = JOB_LABELS[nodeJobIdx] ?? `${nodeJobIdx + 1}`;
          const dstJob = JOB_LABELS[targetJobIdx] ?? `${targetJobIdx + 1}`;
          warnings.push(
            `「${node.label}」的分支指向「${targetLabel}」，横跨了 Job ${srcJob} → Job ${dstJob}`
          );
        }
      }
    }
    return warnings;
  }, [hasSplit, sorted, jobs, nodeIdToSortedIdx, nodeIdToLabel]);

  function toggleDivider(afterIndex: number) {
    setDividers((prev) => {
      const next = new Set(prev);
      if (next.has(afterIndex)) next.delete(afterIndex);
      else next.add(afterIndex);
      return next;
    });
  }

  function resetAll() {
    setDividers(new Set());
    setJobNames({});
    setJobTriggers({});
    setJobCrons({});
    setJobGroup(null);
  }

  function confirmSplit() {
    if (jobs.length < 2) {
      toast.error("至少插入一条分界线，形成 2 个 Job");
      return;
    }

    const entries: JobGroupEntry[] = jobs.map(({ jobIdx, nodes: jn }) => {
      const label = JOB_LABELS[jobIdx] ?? `${jobIdx + 1}`;
      const name = jobNames[jobIdx]?.trim() || `Job ${label}`;
      const triggerType = (jobTriggers[jobIdx] || (jobIdx === 0 ? "schedule" : "event")) as JobGroupEntry["triggerConfig"] extends undefined ? never : "schedule" | "manual" | "event" | "api";
      const params: Record<string, string> = {};
      if (triggerType === "schedule") {
        params.cron = jobCrons[jobIdx] || "0 9 * * *";
      }
      return {
        name,
        nodeStepRange: [jn[0].stepIndex, jn[jn.length - 1].stepIndex] as [number, number],
        triggerConfig: { type: triggerType, params: Object.keys(params).length ? params : undefined },
      };
    });

    const group: JobGroup = {
      id: `jg-${Date.now()}`,
      name: entries.map((e) => e.name).join(" → "),
      createdAt: new Date().toISOString(),
      jobs: entries,
      sharedResources: [],
      relatedJobs: [],
    };
    setJobGroup(group);
    toast.success(`已拆分为 ${entries.length} 个 Job`);
  }

  if (sorted.length < 2) {
    return (
      <p className="text-[12px] text-zinc-400 py-4">
        画布只有 {sorted.length} 个节点，无需拆分。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-[11px] text-blue-900 leading-relaxed">
        业务老师给出的是一条完整流程。如果从技术角度看，某些步骤可以<strong>独立调度</strong>（如提前跑、定时跑），在节点之间插入分界线即可拆成多个 Job。
      </div>

      {/* Node list with divider insertion points */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden">
        {sorted.map((node, i) => {
          const jobIdx = jobs.findIndex((j) => j.nodes.some((n) => n.id === node.id));
          const colorClass = hasSplit ? JOB_COLORS[jobIdx % JOB_COLORS.length] : "";
          const isFirstInJob = jobs[jobIdx]?.nodes[0]?.id === node.id;

          return (
            <div key={node.id}>
              {/* Job header - shown at start of each job segment when split */}
              {hasSplit && isFirstInJob && (
                <div className={`px-3 py-1.5 border-b border-zinc-100 ${colorClass} border-l-4`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-600">
                      Job {JOB_LABELS[jobIdx] ?? jobIdx + 1}
                    </span>
                    <Input
                      value={jobNames[jobIdx] ?? ""}
                      onChange={(e) => setJobNames((p) => ({ ...p, [jobIdx]: e.target.value }))}
                      className="h-6 text-[10px] flex-1 min-w-0 border-transparent bg-transparent hover:border-zinc-300 focus:border-zinc-400 px-1"
                      placeholder={`命名此 Job（可选）`}
                    />
                    <Select
                      value={jobTriggers[jobIdx] || (jobIdx === 0 ? "schedule" : "event")}
                      onValueChange={(v) => setJobTriggers((p) => ({ ...p, [jobIdx]: v ?? "manual" }))}
                    >
                      <SelectTrigger className="h-6 text-[10px] w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="flex flex-col gap-0.5 text-left">
                              <span>{t.label}</span>
                              <span className="text-[9px] text-zinc-400">{t.desc}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(jobTriggers[jobIdx] || (jobIdx === 0 ? "schedule" : "")) === "schedule" && (
                    <Input
                      value={jobCrons[jobIdx] ?? "0 9 * * *"}
                      onChange={(e) => setJobCrons((p) => ({ ...p, [jobIdx]: e.target.value }))}
                      className="h-6 text-[10px] font-mono mt-1 w-full border-transparent bg-transparent hover:border-zinc-300 focus:border-zinc-400 px-1"
                      placeholder="cron 表达式"
                    />
                  )}
                </div>
              )}

              {/* Node row */}
              <div className={`px-3 py-2 ${hasSplit ? `border-l-4 ${colorClass}` : ""} ${i > 0 ? "border-t border-zinc-100" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-zinc-400 w-5 shrink-0">{node.stepIndex}</span>
                  <span className="text-[12px] text-zinc-900 flex-1">{node.label}</span>
                  {node.isCondition && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                      <GitBranch className="w-3 h-3" />
                      条件分支
                    </span>
                  )}
                </div>
                {node.isCondition && node.branchTargets.length > 0 && (
                  <div className="ml-7 mt-1 space-y-0.5">
                    {node.branchTargets.map((targetId) => {
                      const targetLabel = nodeIdToLabel.get(targetId) ?? targetId;
                      const isCrossJob = hasSplit && (() => {
                        const srcJobIdx = jobs.findIndex((j) => j.nodes.some((n) => n.id === node.id));
                        const dstJobIdx = jobs.findIndex((j) => j.nodes.some((n) => n.id === targetId));
                        return srcJobIdx !== -1 && dstJobIdx !== -1 && srcJobIdx !== dstJobIdx;
                      })();
                      return (
                        <div key={targetId} className={`flex items-center gap-1 text-[10px] ${isCrossJob ? "text-red-500" : "text-zinc-400"}`}>
                          <span>→</span>
                          <span>{targetLabel}</span>
                          {isCrossJob && (
                            <span className="text-[9px] text-red-400 bg-red-50 rounded px-1">跨 Job</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Divider insertion point (between nodes, not after last) */}
              {i < sorted.length - 1 && (
                <div className="relative">
                  {dividers.has(i) ? (
                    <button
                      type="button"
                      onClick={() => toggleDivider(i)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-orange-50 border-y border-dashed border-orange-300 text-orange-600 hover:bg-orange-100 transition-colors"
                    >
                      <Scissors className="w-3 h-3" />
                      <span className="text-[10px] font-medium">分界线</span>
                      <X className="w-3 h-3 ml-1 opacity-50" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleDivider(i)}
                      className="w-full flex items-center justify-center gap-1 py-0.5 text-zinc-300 hover:text-orange-500 hover:bg-orange-50/50 transition-colors group"
                    >
                      <span className="h-px flex-1 bg-zinc-100 group-hover:bg-orange-200 transition-colors" />
                      <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity">插入分界线</span>
                      <span className="h-px flex-1 bg-zinc-100 group-hover:bg-orange-200 transition-colors" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cross-Job branch warnings */}
      {hasSplit && crossJobWarnings.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            分界线切断了条件分支
          </div>
          {crossJobWarnings.map((w, i) => (
            <p key={i} className="text-[10px] text-red-600 leading-relaxed ml-5">{w}</p>
          ))}
          <p className="text-[10px] text-red-500 ml-5">
            条件分支的目标节点跨越了不同 Job，可能导致运行时无法正确路由。建议调整分界线位置。
          </p>
        </div>
      )}

      {/* Summary when split */}
      {hasSplit && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 space-y-2">
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            拆分后，业务老师只需要知道：
            <strong className="text-zinc-800">
              {jobs.map((j) => {
                const label = JOB_LABELS[j.jobIdx] ?? `${j.jobIdx + 1}`;
                const name = jobNames[j.jobIdx]?.trim() || `Job ${label}`;
                return name;
              }).join(" → ")}
            </strong>
            ，按顺序完成即可。
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" className={`h-8 text-[11px] flex-1 ${crossJobWarnings.length > 0 ? "opacity-60" : ""}`} onClick={confirmSplit}>
              确认拆分（生成 {jobs.length} 个 JobSpec）
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]" onClick={resetAll}>
              重置
            </Button>
          </div>
        </div>
      )}

      {/* Saved result */}
      {jobGroup && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-[11px] text-emerald-900">
          <p className="font-semibold mb-1.5">已保存拆分方案</p>
          <div className="space-y-1">
            {jobGroup.jobs.map((j, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-medium">{j.name}</span>
                <span className="text-emerald-600">
                  步骤 {j.nodeStepRange[0]}～{j.nodeStepRange[1]}
                </span>
                {j.triggerConfig && (
                  <span className="text-[10px] text-emerald-500">
                    {TRIGGER_OPTIONS.find((t) => t.value === j.triggerConfig?.type)?.label ?? j.triggerConfig.type}
                  </span>
                )}
                {i < jobGroup.jobs.length - 1 && <span className="text-emerald-400">→</span>}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-[10px]"
            onClick={() => setJobGroup(null)}
          >
            清除拆分方案
          </Button>
        </div>
      )}
    </div>
  );
}
