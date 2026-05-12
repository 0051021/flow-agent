"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useFlowAgentStore } from "@/lib/store";
import type { BusinessSubmission, ProjectStatus } from "@/lib/types";
import type { PersistedSubmission } from "@/lib/submission-types";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Clock3, FileStack, Loader2, Plus, RotateCcw, Workflow } from "lucide-react";

type BusinessStatus = "waiting" | "action_needed" | "approved";
type BusinessSubmissionWithHistory = BusinessSubmission & Pick<PersistedSubmission, "timeline" | "reviewLogs">;
type NodeCommentMeta = {
  nodeId?: string;
  content?: string;
  businessTodo?: string;
};

const BUSINESS_STATUS: Record<BusinessStatus, { label: string; className: string }> = {
  waiting: { label: "待评审", className: "bg-amber-50 text-amber-700 border-amber-200" },
  action_needed: { label: "待处理", className: "bg-red-50 text-red-700 border-red-200" },
  approved: { label: "已通过", className: "bg-green-50 text-green-700 border-green-200" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getBusinessStatus(status: ProjectStatus): BusinessStatus {
  if (status === "needs_revision" || status === "draft" || status === "business_editing") return "action_needed";
  if (status === "confirmed") return "approved";
  return "waiting";
}

type HandoffStep = {
  id: string;
  label: string;
  owner: string;
  description: string;
  state: "done" | "active" | "todo" | "feedback";
};

function getTimelineNodeComments(item: BusinessSubmissionWithHistory) {
  return item.timeline.flatMap((event) => {
    const raw = event.meta?.nodeComments;
    if (!Array.isArray(raw)) return [];

    return raw.flatMap((comment): Array<NodeCommentMeta & { eventAt: string; eventMessage: string }> => {
      if (!comment || typeof comment !== "object") return [];
      const c = comment as NodeCommentMeta;
      if (typeof c.content !== "string") return [];
      return [{
        nodeId: typeof c.nodeId === "string" ? c.nodeId : undefined,
        content: c.content,
        businessTodo: typeof c.businessTodo === "string" ? c.businessTodo : undefined,
        eventAt: event.at,
        eventMessage: event.message,
      }];
    });
  });
}

function inferBusinessTodo(content: string) {
  return content
    .replace(/^请业务确认[：:]?/, "")
    .replace(/^请确认[：:]?/, "")
    .replace(/^需要确认[：:]?/, "")
    .replace(/。$/, "")
    .trim();
}

function getFlowRound(item: BusinessSubmissionWithHistory) {
  const submitLikeCount = item.timeline.filter((event) => (
    event.type === "submitted" || event.message.includes("重新提交")
  )).length;
  return Math.max(1, submitLikeCount);
}

function getCurrentOwner(item: BusinessSubmissionWithHistory) {
  if (item.status === "confirmed") return "方案已敲定";
  if (item.status === "needs_revision" || item.status === "draft" || item.status === "business_editing") return "当前轮到业务方";
  if (item.status === "ai_generating") return "AI 正在整理";
  return "当前轮到技术方";
}

function getFlowDetails(item: BusinessSubmissionWithHistory) {
  const comments = getTimelineNodeComments(item);
  const latestCommentAt = comments.length
    ? comments.reduce((latest, comment) => (
      new Date(comment.eventAt) > new Date(latest) ? comment.eventAt : latest
    ), comments[0].eventAt)
    : null;
  const todos = Array.from(new Set(comments.map((comment) => (
    comment.businessTodo || inferBusinessTodo(comment.content ?? "")
  )).filter(Boolean)));

  return {
    round: getFlowRound(item),
    owner: getCurrentOwner(item),
    commentCount: comments.length,
    latestCommentAt,
    todos,
  };
}

function getHandoffFlow(item: BusinessSubmissionWithHistory, pct: number): { steps: HandoffStep[]; summary: string; canIgnore: boolean } {
  const details = getFlowDetails(item);
  const base = [
    {
      id: "business",
      label: "业务补充",
      owner: "业务方",
      description: "根据批注修改节点内容",
    },
    {
      id: "submit",
      label: "重新提交",
      owner: "业务方",
      description: "交给技术方继续评审",
    },
    {
      id: "review",
      label: "技术评审",
      owner: "技术方",
      description: "评审方案并留下批注",
    },
    {
      id: "final",
      label: "方案敲定",
      owner: "双方确认",
      description: "业务方暂时不用再处理",
    },
  ] as const;

  if (item.status === "confirmed") {
    return {
      canIgnore: true,
      summary: `第 ${details.round} 轮 · 方案已经敲定，业务方暂时不用再处理。`,
      steps: base.map((step) => ({ ...step, state: step.id === "final" ? "active" : "done" })),
    };
  }

  if (item.status === "needs_revision" || item.status === "draft" || item.status === "business_editing") {
    return {
      canIgnore: false,
      summary: `第 ${details.round} 轮 · 技术方已反馈 ${details.commentCount || ""} 条批注，当前轮到业务方补充。`,
      steps: base.map((step) => ({
        ...step,
        label: step.id === "review" ? "技术反馈" : step.label,
        description: step.id === "review" ? "未通过，留下批注" : step.description,
        state: step.id === "business" ? "active" : step.id === "review" ? "feedback" : "todo",
      })),
    };
  }

  if (item.status === "ai_generating") {
    return {
      canIgnore: false,
      summary: `第 ${details.round} 轮 · AI 正在整理技术材料，完成 ${pct}% 后提交技术评审。`,
      steps: [
        { ...base[0], state: "done" },
        { ...base[1], label: "AI 整理", owner: "系统", description: `材料生成 ${pct}%`, state: "active" },
        { ...base[2], state: "todo" },
        { ...base[3], state: "todo" },
      ],
    };
  }

  return {
    canIgnore: false,
    summary: `第 ${details.round} 轮 · 当前轮到技术方，业务方等待评审结论。`,
    steps: base.map((step) => ({
      ...step,
      state: step.id === "business" || step.id === "submit" ? "done" : step.id === "review" ? "active" : "todo",
    })),
  };
}

function getActionText(item: BusinessSubmissionWithHistory) {
  if (item.status === "needs_revision") return "继续处理";
  if (item.status === "confirmed") return "查看通过版";
  return "查看进展";
}

function FlowHistoryDetails({ item }: { item: BusinessSubmissionWithHistory }) {
  const details = getFlowDetails(item);

  return (
    <details className="group mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-medium text-zinc-700">
        <span>查看流转详情</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 border-t border-zinc-100 pt-3 text-[11px] leading-5 text-zinc-500">
        <p className="font-medium text-zinc-800">第 {details.round} 轮 · {details.owner}</p>
        {details.commentCount > 0 && details.latestCommentAt ? (
          <p className="mt-1">
            技术方在 {formatTime(details.latestCommentAt)} 留下 {details.commentCount} 条批注。
          </p>
        ) : (
          <p className="mt-1">暂时还没有技术批注。</p>
        )}
        {details.todos.length > 0 ? (
          <div className="mt-2">
            <p className="font-medium text-zinc-700">业务方需要补充：</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {details.todos.map((todo) => (
                <span key={todo} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                  {todo}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function HandoffFlowStrip({ item, pct }: { item: BusinessSubmissionWithHistory; pct: number }) {
  const flow = getHandoffFlow(item, pct);
  return (
    <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-900">方案流转</p>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">{flow.summary}</p>
        </div>
        {!flow.canIgnore ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
            <RotateCcw className="h-3 w-3" />
            可能往返
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700">
            <CheckCircle2 className="h-3 w-3" />
            已敲定
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {flow.steps.map((step, index) => {
          const isDone = step.state === "done";
          const isActive = step.state === "active";
          const isFeedback = step.state === "feedback";
          return (
            <div key={`${step.id}-${index}`} className="relative min-w-0">
              {index < flow.steps.length - 1 ? (
                <span className={`absolute left-[calc(100%-2px)] top-4 h-px w-2 ${
                  isDone ? "bg-green-300" : isFeedback ? "bg-amber-300" : "bg-zinc-200"
                }`} />
              ) : null}
              <div className={`h-full rounded-lg border px-2.5 py-2 ${
                isActive
                  ? "border-blue-200 bg-white shadow-sm ring-2 ring-blue-50"
                  : isDone
                    ? "border-green-100 bg-white"
                    : isFeedback
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-zinc-200 bg-white/70"
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isDone
                        ? "bg-green-500 text-white"
                        : isFeedback
                          ? "bg-amber-500 text-white"
                          : "bg-zinc-200 text-zinc-500"
                  }`}>
                    {isDone ? "✓" : isFeedback ? "!" : index + 1}
                  </span>
                  <p className={`truncate text-[11px] font-semibold ${
                    isActive ? "text-blue-700" : isDone ? "text-zinc-800" : isFeedback ? "text-amber-700" : "text-zinc-500"
                  }`}>
                    {step.label}
                  </p>
                </div>
                <p className="mt-1 truncate text-[10px] text-zinc-400">{step.owner}</p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-zinc-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      <FlowHistoryDetails item={item} />
    </div>
  );
}

function SubmissionCard({ item }: { item: BusinessSubmissionWithHistory }) {
  const status = getBusinessStatus(item.status);
  const sc = BUSINESS_STATUS[status];
  const pct = item.techProgress.total > 0
    ? Math.round((item.techProgress.done / item.techProgress.total) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 truncate">{item.title}</h3>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{item.description || "暂无描述"}</p>
        </div>
        <Badge variant="outline" className={`text-[10px] h-5 ${sc.className}`}>{sc.label}</Badge>
      </div>

      <HandoffFlowStrip item={item} pct={pct} />

      <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />更新于 {formatTime(item.updatedAt)}</span>
        <Link href={`/me/${item.reviewId || item.id}`} className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
          {getActionText(item)} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  description,
  count,
  tone,
}: {
  label: string;
  description: string;
  count: number;
  tone: "amber" | "red" | "green";
}) {
  const toneClass = {
    amber: "border-amber-100 text-amber-700",
    red: "border-red-100 text-red-700",
    green: "border-green-100 text-green-700",
  }[tone];

  return (
    <div className={`rounded-lg border bg-white p-4 ${toneClass}`}>
      <p className="text-xs font-medium text-zinc-700">{label}</p>
      <p className="text-[11px] text-zinc-400 mt-1">{description}</p>
      <p className="text-2xl font-bold mt-3">{count}</p>
    </div>
  );
}

export default function MyProjectsPage() {
  const localSubmissions = useFlowAgentStore((s) => s.businessSubmissions);
  const [serverSubmissions, setServerSubmissions] = useState<BusinessSubmissionWithHistory[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchServer = async () => {
      try {
        const res = await fetch("/api/submissions");
        const result = await res.json();
        if (!cancelled && result?.success && Array.isArray(result.items)) {
          const mapped = (result.items as PersistedSubmission[]).map((item) => ({
            id: item.id,
            reviewId: item.reviewId || item.id,
            title: item.title,
            description: item.description,
            taskType: item.taskType,
            status: item.status,
            submittedAt: item.submittedAt,
            updatedAt: item.updatedAt,
            techProgress: item.techProgress,
            timeline: item.timeline,
            reviewLogs: item.reviewLogs,
          }));
          setServerSubmissions(mapped);
        }
      } catch {
        // fallback to local
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchServer();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const source: BusinessSubmissionWithHistory[] = serverSubmissions ?? localSubmissions.map((item) => ({
      ...item,
      timeline: [],
      reviewLogs: [],
    }));
    return [...source].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [localSubmissions, serverSubmissions]);
  const waitingCount = sorted.filter((s) => getBusinessStatus(s.status) === "waiting").length;
  const actionNeededCount = sorted.filter((s) => getBusinessStatus(s.status) === "action_needed").length;
  const approvedCount = sorted.filter((s) => getBusinessStatus(s.status) === "approved").length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="h-14 border-b border-zinc-200 bg-white/85 backdrop-blur-sm px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="返回首页"
            className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Workflow className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-900">业务方个人主页</span>
        </div>
        <Link
          href="/"
          className="h-8 px-3 inline-flex items-center rounded-md bg-zinc-900 hover:bg-zinc-800 text-xs text-white font-medium"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新建方案
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="待评审" description="已提交，等待技术方给结论" count={waitingCount} tone="amber" />
          <StatCard label="待处理" description="技术方需要你补充或修改" count={actionNeededCount} tone="red" />
          <StatCard label="已通过" description="方案已通过评审" count={approvedCount} tone="green" />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400 mx-auto" />
            <p className="text-sm text-zinc-500 mt-3">正在加载项目记录...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center">
              <FileStack className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-600 mt-4">你还没有提交过项目</p>
            <p className="text-xs text-zinc-400 mt-1">提交后会在这里显示评审状态、当前进展和下一步</p>
            <Link
              href="/"
              className="mt-5 h-8 px-3 inline-flex items-center rounded-md bg-zinc-900 hover:bg-zinc-800 text-xs text-white font-medium"
            >
              去创建第一个方案
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => (
              <SubmissionCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {waitingCount > 0 && (
          <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            有项目正在等待技术评审，整理材料和评审进度会自动更新。
          </div>
        )}
        {approvedCount > 0 && waitingCount === 0 && (
          <div className="mt-6 rounded-lg border border-green-100 bg-green-50/60 px-4 py-3 text-xs text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已通过项目可作为后续模板继续复用。
          </div>
        )}
      </main>
    </div>
  );
}
