"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Workflow, Code2, ArrowRight,
  Clock, AlertTriangle, CheckCircle2, FileText,
  Eye, Search, TrendingUp, Loader2, GitBranch, Layers3,
} from "lucide-react";
import { getAllReviews } from "@/lib/mock-reviews";

type ReviewStatus = "pending" | "reviewed" | "confirmed";
type ReviewStage =
  | "business_flow_review"
  | "business_flow_revision"
  | "technical_plan_config"
  | "technical_plan_review"
  | "ready_to_publish"
  | "published"
  | "returned";
type ReviewListItem = ReturnType<typeof getAllReviews>[number];

const STAGE_CONFIG: Record<ReviewStage, { label: string; className: string; icon: React.ComponentType<{ className?: string }>; action: string }> = {
  business_flow_review: { label: "业务流程评审中", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, action: "评审流程图" },
  business_flow_revision: { label: "业务流程修改中", className: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertTriangle, action: "查看修改点" },
  technical_plan_config: { label: "技术方案配置中", className: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: GitBranch, action: "进入配置" },
  technical_plan_review: { label: "技术方案评审中", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Eye, action: "评审方案" },
  ready_to_publish: { label: "待发布", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, action: "发布前检查" },
  published: { label: "已发布", className: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2, action: "查看发布版" },
  returned: { label: "已退回", className: "bg-slate-100 text-slate-600 border-slate-200", icon: AlertTriangle, action: "查看原因" },
};

const TYPE_BADGE = {
  workflow: { label: "工作流", className: "bg-blue-50 text-blue-600 border-blue-200" },
  agentic: { label: "智能体", className: "bg-violet-50 text-violet-600 border-violet-200" },
};

const FILTER_TABS: { id: string; label: string; filter: (s: ReviewStage) => boolean }[] = [
  { id: "all", label: "全部", filter: () => true },
  { id: "business", label: "业务流程评审", filter: (s) => s === "business_flow_review" || s === "business_flow_revision" },
  { id: "technical", label: "技术方案配置", filter: (s) => s === "technical_plan_config" || s === "technical_plan_review" },
  { id: "published", label: "发布态", filter: (s) => s === "ready_to_publish" || s === "published" },
];

function deriveStage(status: ReviewStatus): ReviewStage {
  if (status === "confirmed") return "published";
  if (status === "reviewed") return "technical_plan_config";
  return "business_flow_review";
}

function getStage(item: ReviewListItem): ReviewStage {
  return item.stage ?? deriveStage(item.status as ReviewStatus);
}

function reviewRank(item: ReviewListItem): number {
  if (item.initialJobGroup) return 40;
  if (item.children && item.children.length > 0) return 30;
  if (item.stage) return 20;
  return 10;
}

function formatJobTrigger(trigger: { type?: string; params?: Record<string, string> } | undefined): string {
  if (!trigger?.type) return "触发方式待配置";
  const label: Record<string, string> = {
    manual: "人工触发",
    event: "事件触发",
    schedule: "定时触发",
    api: "API 触发",
  };
  const detail = trigger.params?.when ?? trigger.params?.entry ?? trigger.params?.cron ?? trigger.params?.endpoint;
  return detail ? `${label[trigger.type] ?? trigger.type} · ${detail}` : label[trigger.type] ?? trigger.type;
}

function jobHref(item: ReviewListItem, schemaId: string | undefined): string {
  const params = new URLSearchParams({ reviewId: item.id, role: "tech" });
  if (schemaId) params.set("job", schemaId);
  return `/editor?${params.toString()}`;
}

function formatSubmittedAt(value: string): string {
  if (!value) return "-";
  if (!value.includes("T")) return value;
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TechLandingPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [serverReviews, setServerReviews] = useState<unknown[]>([]);
  const [loadingServer, setLoadingServer] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/submissions?view=reviews");
        const result = await res.json();
        if (!cancelled && result?.success && Array.isArray(result.items)) {
          setServerReviews(result.items);
        }
      } catch {
        // keep mock list if request fails
      } finally {
        if (!cancelled) setLoadingServer(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const allReviews = useMemo(() => {
    const mocks = getAllReviews();
    const merged = [...(serverReviews as typeof mocks), ...mocks];
    const seen = new Set<string>();
    const deduped = merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    const childIds = new Set(deduped.flatMap((item) => item.children?.map((child) => child.id) ?? []));
    const visible = deduped.filter((item) => !childIds.has(item.id));
    const byTitle = new Map<string, ReviewListItem>();
    for (const item of visible) {
      const current = byTitle.get(item.title);
      if (!current || reviewRank(item) > reviewRank(current)) {
        byTitle.set(item.title, item);
      }
    }
    return Array.from(byTitle.values());
  }, [serverReviews]);
  const currentFilter = FILTER_TABS.find((t) => t.id === activeFilter) || FILTER_TABS[0];

  const filteredReviews = allReviews.filter((item) => {
    const stage = getStage(item);
    if (!currentFilter.filter(stage)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.children?.some((child) => child.title.toLowerCase().includes(q) || child.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const businessReviewCount = allReviews.filter((i) => {
    const stage = getStage(i);
    return stage === "business_flow_review" || stage === "business_flow_revision";
  }).length;
  const technicalConfigCount = allReviews.filter((i) => {
    const stage = getStage(i);
    return stage === "technical_plan_config" || stage === "technical_plan_review";
  }).length;
  const publishedCount = allReviews.filter((i) => {
    const stage = getStage(i);
    return stage === "ready_to_publish" || stage === "published";
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-100 flex flex-col">
      {/* Nav */}
      <header className="h-14 border-b border-cyan-100/80 bg-white/85 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Code2 className="w-4 h-4 text-white/95" />
          </div>
          <span className="font-bold text-slate-900">FlowAgent</span>
          <Badge className="text-[10px] h-5 bg-cyan-100 text-cyan-700 border-cyan-200">
            技术方
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
          >
            <Workflow className="w-3.5 h-3.5" />
            业务方入口
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">技术评审工作台</h1>
          <p className="text-sm text-slate-600 mt-1">
            评估业务方提交的场景方案，标注技术可行性和约束条件
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl bg-white/90 border border-cyan-100 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">业务流程评审</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{businessReviewCount}</p>
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-amber-400" /> 待确认流程边界
            </p>
          </div>
          <div className="rounded-xl bg-white/90 border border-blue-100 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">技术方案配置</span>
              <GitBranch className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{technicalConfigCount}</p>
            <p className="text-[10px] text-slate-500 mt-1">配置 Job / Task / 路由</p>
          </div>
          <div className="rounded-xl bg-white/90 border border-emerald-100 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">发布态</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{publishedCount}</p>
            <p className="text-[10px] text-slate-500 mt-1">配置项已补齐</p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索场景名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-white border-cyan-100 text-slate-800 placeholder:text-slate-400 focus:border-cyan-300 focus-visible:ring-cyan-200"
            />
          </div>
          <div className="flex gap-1 p-1 bg-white/90 rounded-lg border border-cyan-100 shadow-sm overflow-x-auto">
            {FILTER_TABS.map((tab) => {
              const count = allReviews.filter((i) => tab.filter(getStage(i))).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeFilter === tab.id
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-cyan-700 hover:bg-cyan-50"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1 ${activeFilter === tab.id ? "text-slate-300" : "text-slate-400"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Review list */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">评审列表</h2>
          {loadingServer && (
            <div className="mb-3 text-xs text-slate-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              正在读取服务端评审记录...
            </div>
          )}
          {filteredReviews.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-6 h-6 text-slate-400" />}
              title="没有匹配的评审项"
              description={search ? "试试调整搜索关键词" : "当前筛选条件下没有评审项"}
              className="py-16 [&_h3]:text-slate-600 [&_p]:text-slate-500"
            />
          ) : (
            <div className="space-y-3">
              {filteredReviews.map((item) => {
                const stage = getStage(item);
                const sc = STAGE_CONFIG[stage];
                const StatusIcon = sc.icon;
                const typeBadge = TYPE_BADGE[item.type as keyof typeof TYPE_BADGE] ?? TYPE_BADGE.workflow;
                return (
                  <div
                    key={item.id}
                    className="block rounded-xl bg-white/90 border border-cyan-100 p-5 hover:border-cyan-300 hover:bg-white transition-all shadow-[0_10px_24px_-18px_rgba(14,116,144,0.45)] group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                          <Badge variant="outline" className={`text-[10px] h-5 ${typeBadge.className}`}>
                            {typeBadge.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] h-5 ${sc.className}`}>
                            <StatusIcon className="w-3 h-3 mr-0.5" />
                            {sc.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {item.nodeCount} 个节点
                          </span>
                          <span>提交人：{item.submittedBy}</span>
                          <span>{formatSubmittedAt(item.submittedAt)}</span>
                        </div>
                        {item.initialJobGroup ? (
                          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
                                <Layers3 className="h-3.5 w-3.5" />
                                技术方案拆分结果
                              </div>
                              <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] text-indigo-600">
                                已拆成 {item.initialJobGroup.jobs.length} 个 Job
                              </span>
                            </div>
                            <div className="space-y-2">
                              {item.initialJobGroup.jobs.map((job) => {
                                return (
                                  <Link
                                    key={job.schemaId ?? job.name}
                                    href={jobHref(item, job.schemaId)}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-white/70 bg-white/85 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-indigo-200 hover:bg-white hover:text-indigo-700"
                                  >
                                    <span className="min-w-0">
                                      <span className="block font-medium">{job.name}</span>
                                      <span className="block truncate text-[10px] text-slate-500">
                                        节点 {job.nodeStepRange[0]}-{job.nodeStepRange[1]} · {formatJobTrigger(job.triggerConfig)}
                                      </span>
                                    </span>
                                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] text-indigo-600">
                                      Job
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                            {item.initialJobGroup.relatedJobs.length > 0 ? (
                              <p className="mt-2 text-[10px] leading-4 text-slate-500">
                                Job Group 说明：{item.initialJobGroup.relatedJobs.map((job) => job.description).join("；")}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <Link
                          href={item.initialJobGroup?.jobs[0] ? jobHref(item, item.initialJobGroup.jobs[0].schemaId) : `/editor?reviewId=${item.id}&role=tech`}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-100 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                        >
                          {sc.action} <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
