"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, ListChecks, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Layers, ArrowRight, XCircle, Folder, FolderOpen } from "lucide-react";
import { MOCK_TASKS, MOCK_TASK_EVENTS } from "@/lib/mock-console";
import type { ConsoleTaskStatus } from "@/lib/types";

const STATUS_CONFIG: Record<ConsoleTaskStatus, { label: string; className: string }> = {
  queued: { label: "排队中", className: "bg-zinc-100 text-zinc-600" },
  running: { label: "执行中", className: "bg-blue-50 text-blue-700" },
  pending_confirm: { label: "待确认", className: "bg-amber-50 text-amber-700" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700" },
  error: { label: "异常", className: "bg-red-50 text-red-700" },
};

const FILTER_TABS: { id: string; label: string; filter: (s: ConsoleTaskStatus) => boolean }[] = [
  { id: "all", label: "全部", filter: () => true },
  { id: "running", label: "进行中", filter: (s) => s === "running" },
  { id: "pending", label: "等你确认", filter: (s) => s === "pending_confirm" },
  { id: "completed", label: "已办结", filter: (s) => s === "completed" },
  { id: "error", label: "需关注", filter: (s) => s === "error" },
];

type SortKey = "progress" | "duration" | "priority";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { urgent: 3, high: 2, normal: 1 };
const PAGE_SIZE = 6;

export default function TasksPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [batchMode, setBatchMode] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchDone, setBatchDone] = useState<Record<string, string>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const currentFilter = FILTER_TABS.find((t) => t.id === activeFilter) || FILTER_TABS[0];
  const pendingCount = MOCK_TASKS.filter((t) => t.status === "pending_confirm").length;
  const errorCount = MOCK_TASKS.filter((t) => t.status === "error").length;

  const filteredAndSorted = useMemo(() => {
    let tasks = MOCK_TASKS.filter((t) => currentFilter.filter(t.status));
    if (sortKey) {
      tasks = [...tasks].sort((a, b) => {
        let diff = 0;
        if (sortKey === "progress") diff = a.progress - b.progress;
        else if (sortKey === "priority") diff = (PRIORITY_ORDER[a.priority || "normal"] || 1) - (PRIORITY_ORDER[b.priority || "normal"] || 1);
        else if (sortKey === "duration") diff = a.duration.localeCompare(b.duration);
        return sortDir === "asc" ? diff : -diff;
      });
    }
    return tasks;
  }, [currentFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const pagedTasks = filteredAndSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const handleFilterChange = (id: string) => {
    setActiveFilter(id);
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-zinc-300" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-zinc-600" /> : <ChevronDown className="w-3 h-3 text-zinc-600" />;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6">
        <h1 className="text-xl font-bold text-zinc-900">事务中心</h1>
        <p className="text-sm text-zinc-400 mt-1">
          共 {MOCK_TASKS.length} 件事务
          {pendingCount > 0 && <> · <span className="text-amber-600 font-medium">{pendingCount} 件等你确认</span></>}
          {errorCount > 0 && <> · <span className="text-red-600 font-medium">{errorCount} 件需要关注</span></>}
        </p>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-6 p-1 bg-zinc-100 rounded-lg w-fit">
          {FILTER_TABS.map((tab) => {
            const count = MOCK_TASKS.filter((t) => tab.filter(t.status)).length;
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeFilter === tab.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab.label}
                <span className="ml-1 text-zinc-400">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Batch mode toggle — only when filtering pending tasks */}
        {activeFilter === "pending" && pendingCount > 0 && !batchMode && (
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-800">{pendingCount} 件事务等你确认</span>
            </div>
            <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={() => { setBatchMode(true); setBatchIndex(0); setBatchDone({}); }}>
              <Layers className="w-3.5 h-3.5 mr-1" /> 批量处理
            </Button>
          </div>
        )}

        {/* Batch review panel */}
        {batchMode && <BatchReviewPanel
          tasks={MOCK_TASKS.filter((t) => t.status === "pending_confirm")}
          index={batchIndex}
          done={batchDone}
          onAction={(taskId, action) => {
            setBatchDone((prev) => ({ ...prev, [taskId]: action }));
            const pendingTasks = MOCK_TASKS.filter((t) => t.status === "pending_confirm");
            if (batchIndex < pendingTasks.length - 1) {
              setBatchIndex(batchIndex + 1);
            }
          }}
          onNavigate={setBatchIndex}
          onExit={() => setBatchMode(false)}
          onViewDetail={(id) => router.push(`/console/tasks/${id}`)}
        />}

        {/* Table */}
        {!batchMode && <div className="mt-4 bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                <th className="text-left px-4 py-3 font-medium">事务</th>
                <th className="text-left px-4 py-3 font-medium">负责助手</th>
                <th className="text-left px-4 py-3 font-medium">正在做什么</th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("progress")}>
                  <span className="inline-flex items-center gap-1">进度 <SortIcon col="progress" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("priority")}>
                  <span className="inline-flex items-center gap-1">状态 <SortIcon col="priority" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("duration")}>
                  <span className="inline-flex items-center gap-1">用时 <SortIcon col="duration" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedTasks.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<ListChecks className="w-6 h-6 text-zinc-400" />}
                      title="没有匹配的任务"
                      description="当前筛选条件下没有任务"
                      className="py-16"
                    />
                  </td>
                </tr>
              )}
              {pagedTasks.map((task) => {
                const sc = STATUS_CONFIG[task.status];
                const hasSubJobs = task.subJobs && task.subJobs.length > 0;
                const isExpanded = expandedTasks.has(task.id);

                return (
                  <React.Fragment key={task.id}>
                    <tr
                      onClick={() => {
                        if (hasSubJobs) {
                          setExpandedTasks((prev) => {
                            const next = new Set(prev);
                            if (next.has(task.id)) next.delete(task.id);
                            else next.add(task.id);
                            return next;
                          });
                        } else {
                          router.push(`/console/tasks/${task.id}`);
                        }
                      }}
                      className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {hasSubJobs && (
                            isExpanded
                              ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                              : <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <div>
                            <span className="text-sm font-medium text-zinc-900">{task.description}</span>
                            {hasSubJobs && (
                              <span className="ml-2 text-[10px] text-amber-600 font-medium">
                                {task.subJobs!.length} 个子 Job
                              </span>
                            )}
                            <p className="text-[10px] text-zinc-400 mt-0.5">{task.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        <div className="flex items-center gap-1.5">
                          <span>{task.agentIcon}</span>
                          <span className="text-xs">{task.agentName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{task.currentNode}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${task.status === "error" ? "bg-red-400" : task.status === "completed" ? "bg-green-500" : "bg-blue-500"}`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 w-8">{task.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-[10px] h-4 border-0 ${sc.className}`}>{sc.label}</Badge>
                          {task.priority === "urgent" && (
                            <Badge className="text-[10px] h-4 bg-red-100 text-red-700 border-0">紧急</Badge>
                          )}
                          {task.priority === "high" && (
                            <Badge className="text-[10px] h-4 bg-amber-100 text-amber-700 border-0">高优</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-zinc-400">
                          <Clock className="w-3 h-3" />
                          {task.duration}
                        </div>
                      </td>
                    </tr>
                    {hasSubJobs && isExpanded && task.subJobs!.map((sub) => {
                      const subSc = STATUS_CONFIG[sub.status];
                      return (
                        <tr
                          key={sub.id}
                          onClick={() => router.push(`/console/tasks/${task.id}`)}
                          className="border-b border-zinc-50 bg-amber-50/30 hover:bg-amber-50/60 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-2.5 pl-12">
                            <span className="text-[13px] font-medium text-zinc-800">{sub.name}</span>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{sub.id} · {sub.trigger}</p>
                          </td>
                          <td className="px-4 py-2.5" />
                          <td className="px-4 py-2.5 text-zinc-500 text-xs">{sub.currentNode}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${sub.status === "completed" ? "bg-green-500" : "bg-blue-500"}`}
                                  style={{ width: `${sub.progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-zinc-400 w-8">{sub.progress}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`text-[10px] h-4 border-0 ${subSc.className}`}>{subSc.label}</Badge>
                          </td>
                          <td className="px-4 py-2.5" />
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {filteredAndSorted.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
              <p className="text-xs text-zinc-400">
                显示 {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredAndSorted.length)} / {filteredAndSorted.length} 条
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      page === i ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}

/* =========================================================
 *  批量审核面板 (Batch Review Panel)
 * ========================================================= */

import type { ConsoleTask } from "@/lib/types";

function BatchReviewPanel({
  tasks,
  index,
  done,
  onAction,
  onNavigate,
  onExit,
  onViewDetail,
}: {
  tasks: ConsoleTask[];
  index: number;
  done: Record<string, string>;
  onAction: (taskId: string, action: string) => void;
  onNavigate: (i: number) => void;
  onExit: () => void;
  onViewDetail: (id: string) => void;
}) {
  const current = tasks[index];
  if (!current) return null;

  const events = MOCK_TASK_EVENTS[current.id] || [];
  const lastEvent = events[events.length - 1];
  const doneCount = Object.keys(done).length;
  const allDone = doneCount === tasks.length;

  const aiResult = lastEvent?.details?.aiResult as { label: string; value: string }[] | undefined;

  return (
    <div className="mt-4 bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">批量审核</span>
          <span className="text-xs text-amber-600">{doneCount}/{tasks.length} 已处理</span>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 全部处理完毕
            </span>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onExit}>退出批量模式</Button>
        </div>
      </div>

      {/* Task nav strip */}
      <div className="px-4 py-2 border-b border-zinc-100 flex gap-1.5 overflow-x-auto">
        {tasks.map((t, i) => {
          const isDone = !!done[t.id];
          const isCurrent = i === index;
          return (
            <button
              key={t.id}
              onClick={() => onNavigate(i)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all
                ${isCurrent ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300" :
                  isDone ? "bg-green-50 text-green-600" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
            >
              {isDone && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
              {t.id}
            </button>
          );
        })}
      </div>

      {/* Current task content */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-zinc-900">{current.description}</span>
              {current.priority === "urgent" && <Badge className="text-[10px] h-4 bg-red-100 text-red-700 border-0">紧急</Badge>}
              {current.priority === "high" && <Badge className="text-[10px] h-4 bg-amber-100 text-amber-700 border-0">高优</Badge>}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{current.id} · {current.agentIcon} {current.agentName} · {current.currentNode}</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => onViewDetail(current.id)}>
            查看详情 <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Event summary */}
        {lastEvent && (
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 mb-4">
            <p className="text-sm text-zinc-700">{lastEvent.content}</p>
            {aiResult && (
              <div className="mt-2 space-y-1">
                {aiResult.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-zinc-400 w-20 shrink-0">{item.label}</span>
                    <span className="text-zinc-700 font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {done[current.id] ? (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            已{done[current.id] === "approved" ? "确认通过" : "标记需修改"}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={() => { onAction(current.id, "rejected"); toast.info("已标记需修改，可到详情页处理"); }}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> 需要修改
            </Button>
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => { onAction(current.id, "approved"); toast.success("已确认通过"); }}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 确认通过
            </Button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={index === 0} onClick={() => onNavigate(index - 1)}>
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> 上一条
          </Button>
          <span className="text-xs text-zinc-400">{index + 1} / {tasks.length}</span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={index === tasks.length - 1} onClick={() => onNavigate(index + 1)}>
            下一条 <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
