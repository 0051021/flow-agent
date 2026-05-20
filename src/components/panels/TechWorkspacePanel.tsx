"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Server,
  FolderOpen,
} from "lucide-react";
import { useFlowAgentStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { computeBindingCompletion } from "@/lib/tech-binding-helpers";
import BindingGlobalSection from "./tech-workspace/BindingGlobalSection";
import type {
  JobGroup,
  JobGroupEntry,
} from "@/lib/types";

// --- Job group directory ---

function formatTrigger(trigger: JobGroupEntry["triggerConfig"]): string {
  if (!trigger) return "未设置触发";
  const typeLabel: Record<NonNullable<JobGroupEntry["triggerConfig"]>["type"], string> = {
    schedule: "定时触发",
    manual: "人工触发",
    event: "事件触发",
    api: "API 触发",
  };
  const detail = trigger.params?.when ?? trigger.params?.cron ?? trigger.params?.endpoint;
  return detail ? `${typeLabel[trigger.type]} · ${detail}` : typeLabel[trigger.type];
}

function JobDirectory({ group }: { group: JobGroup }) {
  const currentReviewId = useFlowAgentStore((s) => s.currentReviewId);
  const techJobMeta = useFlowAgentStore((s) => s.techJobMeta);
  const activeCode = techJobMeta.code;

  return (
    <div className="shrink-0 border-b border-indigo-100/50 bg-white/45 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FolderOpen className="h-4 w-4 shrink-0 text-indigo-500" />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-slate-800">Job Group · {group.name}</p>
            <p className="text-[10px] text-slate-500">一个业务方案被拆成多个 Job；点击 Job 进入对应配置，数据依赖关系只在上层说明。</p>
          </div>
        </div>
        <Badge className="h-5 shrink-0 border-0 bg-indigo-50 text-[10px] text-indigo-600">
          {group.jobs.length} Jobs
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {group.jobs.map((job, index) => {
          const href = currentReviewId && job.schemaId
            ? `/editor?reviewId=${currentReviewId}&role=tech&job=${job.schemaId}`
            : "#";
          const active = Boolean(job.schemaId && activeCode === job.schemaId);
          return (
            <Link
              key={`${job.schemaId ?? job.name}-${index}`}
              href={href}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-indigo-300 bg-indigo-50/90 shadow-sm"
                  : "border-indigo-100/70 bg-white/75 hover:border-indigo-200 hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-800">{job.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {job.nodeIds?.length ? `${job.nodeIds.length} 个节点` : `节点 ${job.nodeStepRange[0]} - ${job.nodeStepRange[1]}`} · {formatTrigger(job.triggerConfig)}
                  </p>
                </div>
                <Badge className={`h-5 shrink-0 border-0 text-[10px] ${
                  active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                }`}>
                  {active ? "当前配置" : "Job"}
                </Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function TechWorkspacePanel() {
  const { nodes, techConfig, techBindings, techJobMeta, jobTriggerCodes, jobGroup } = useFlowAgentStore();

  const completion = useMemo(
    () =>
      computeBindingCompletion(
        techBindings,
        nodes,
        techConfig.documents,
        techConfig.externals,
        {
          jobMeta: { code: techJobMeta.code, name: techJobMeta.name },
          jobTriggerCodes,
        }
      ),
    [techBindings, nodes, techConfig.documents, techConfig.externals, techJobMeta, jobTriggerCodes]
  );

  const pct = completion.percent;
  const r = 13;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="shrink-0 border-b border-indigo-100/50 bg-white/60 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 ring-1 ring-indigo-200/50 flex items-center justify-center">
          <Server className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">技术工作区</h2>
          <p className="text-[11px] text-slate-500 leading-snug">
            当前配置：{techJobMeta.name || "未命名 Job"} · 完成度{" "}
            <span className="text-indigo-600 font-semibold">{pct}%</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            全局信息在这里填写；每个节点的 Task 类型、Skill 和 RuntimeProfile 请点击画布节点填写。
          </p>
        </div>
        <svg width="36" height="36" className="shrink-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={r} fill="none" stroke="#e0e7ff" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {jobGroup ? (
        <JobDirectory group={jobGroup} />
      ) : null}

      <ScrollArea className="flex-1 min-h-0 h-full">
        <div className="p-4 pb-6 space-y-4">
          <BindingGlobalSection />
        </div>
      </ScrollArea>
    </div>
  );
}
