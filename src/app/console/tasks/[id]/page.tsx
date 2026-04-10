"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Clock, CheckCircle2, AlertTriangle,
  Play, XCircle, UserCheck, Settings,
  RotateCcw, Hand, SkipForward, ArrowDown,
  Lightbulb, BarChart3, Flag, TrendingUp,
  ThumbsUp, ThumbsDown, GitBranch,
} from "lucide-react";
import {
  MOCK_TASKS, MOCK_TASK_EVENTS,
  MOCK_AGENTIC_DASHBOARD, MOCK_STRATEGY_EVOLUTION,
} from "@/lib/mock-console";
import type { ConsoleTaskStatus, TaskEventType } from "@/lib/types";

const STATUS_CONFIG: Record<ConsoleTaskStatus, { label: string; className: string }> = {
  queued: { label: "排队中", className: "bg-zinc-100 text-zinc-600" },
  running: { label: "执行中", className: "bg-blue-50 text-blue-700" },
  pending_confirm: { label: "待确认", className: "bg-amber-50 text-amber-700" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700" },
  error: { label: "异常", className: "bg-red-50 text-red-700" },
};

const EVENT_ICONS: Record<TaskEventType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  node_start: { icon: Play, color: "text-blue-500 bg-blue-50" },
  node_complete: { icon: CheckCircle2, color: "text-green-500 bg-green-50" },
  node_error: { icon: XCircle, color: "text-red-500 bg-red-50" },
  human_confirm: { icon: UserCheck, color: "text-amber-500 bg-amber-50" },
  system: { icon: Settings, color: "text-zinc-500 bg-zinc-50" },
  ai_suggestion: { icon: Lightbulb, color: "text-violet-500 bg-violet-50" },
  data_report: { icon: BarChart3, color: "text-blue-500 bg-blue-50" },
  milestone: { icon: Flag, color: "text-emerald-500 bg-emerald-50" },
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const task = MOCK_TASKS.find((t) => t.id === id);
  const events = MOCK_TASK_EVENTS[id] || [];
  const dashboard = MOCK_AGENTIC_DASHBOARD[id];
  const evolution = MOCK_STRATEGY_EVOLUTION[id];
  const isAgentic = task?.taskType === "agentic";

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">任务 {id} 不存在</p>
          <Link href="/console/tasks" className="text-blue-500 text-sm mt-2 inline-block">返回任务列表</Link>
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[task.status];
  const isPending = task.status === "pending_confirm";
  const isError = task.status === "error";
  const lastEvent = events[events.length - 1];

  const [actionDone, setActionDone] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showErrorActions, setShowErrorActions] = useState(false);
  const [rejectAction, setRejectAction] = useState<string | null>(null);
  const [suggestionActions, setSuggestionActions] = useState<Record<string, string>>({});
  const isWorkflow = task.taskType === "workflow";

  const handleApprove = () => {
    setActionDone("approved");
    setShowRejectForm(false);
    toast.success("已确认通过，任务将继续执行");
  };

  const handleReject = () => {
    if (!rejectReason.trim() || !rejectAction) return;
    setActionDone(`rejected-${rejectAction}`);
    setShowRejectForm(false);
    const labels: Record<string, string> = {
      "fix-continue": "已驳回，人工修正后将继续执行后续步骤",
      "redo-prev": "已驳回，将退回上一步重新执行",
      "replan": "已驳回，Agent 将根据反馈重新规划执行策略",
      "takeover": "已驳回，已转人工接管处理",
    };
    toast.info(labels[rejectAction] || "已驳回");
  };

  const handleErrorAction = (action: string) => {
    setActionDone(action);
    setShowErrorActions(false);
    const labels: Record<string, string> = {
      retry: "已重试，从当前节点重新执行",
      takeover: "已通知相关人员接管",
      skip: "已跳过当前节点，继续执行",
    };
    toast.success(labels[action] || "操作已执行");
  };

  const handleSuggestion = (sugId: string, action: "accepted" | "rejected") => {
    setSuggestionActions((prev) => ({ ...prev, [sugId]: action }));
    toast.success(action === "accepted" ? "已采纳建议" : "已忽略建议");
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6">
        {/* Back */}
        <Link href="/console/tasks" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors mb-4">
          <ArrowLeft className="w-3 h-3" />
          返回任务列表
        </Link>

        {/* Action result banner */}
        {actionDone && (
          <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-sm
            ${actionDone === "approved" ? "bg-green-50 border border-green-200 text-green-700" :
              actionDone.startsWith("rejected") ? "bg-red-50 border border-red-200 text-red-700" :
              "bg-blue-50 border border-blue-200 text-blue-700"}`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {actionDone === "approved" && "已确认通过，任务将继续执行。"}
            {actionDone === "rejected-fix-continue" && `已驳回（修正继续），原因：${rejectReason}。`}
            {actionDone === "rejected-redo-prev" && `已驳回（退回上一步），原因：${rejectReason}。`}
            {actionDone === "rejected-replan" && `已驳回（重新规划），原因：${rejectReason}。Agent 将重新规划策略。`}
            {actionDone === "rejected-takeover" && `已驳回（人工接管），原因：${rejectReason}。`}
            {actionDone === "retry" && "已发起重试。"}
            {actionDone === "manual" && "已转人工处理。"}
            {actionDone === "skip" && "已跳过当前节点。"}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-900">{task.id}</h1>
              <Badge className={`text-xs h-5 border-0 ${sc.className}`}>{sc.label}</Badge>
              {isAgentic && <Badge className="text-xs h-5 bg-violet-50 text-violet-700 border-0">智能体</Badge>}
              {task.priority === "urgent" && <Badge className="text-xs h-5 bg-red-100 text-red-700 border-0">紧急</Badge>}
              {task.priority === "high" && <Badge className="text-xs h-5 bg-amber-100 text-amber-700 border-0">高优</Badge>}
            </div>
            <p className="text-sm text-zinc-500 mt-1">{task.description}</p>
          </div>
          {isPending && !actionDone && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowRejectForm(true)}>
                <XCircle className="w-3.5 h-3.5 mr-1" /> 驳回
              </Button>
              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 确认通过
              </Button>
            </div>
          )}
          {isError && !actionDone && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowErrorActions(!showErrorActions)}>
              <Settings className="w-3.5 h-3.5 mr-1" /> 异常处理 <ArrowDown className="w-3 h-3 ml-0.5" />
            </Button>
          )}
        </div>

        {/* Reject form */}
        {showRejectForm && !actionDone && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-800 mb-2">驳回处理</p>
            <p className="text-xs text-red-600 mb-2">选择驳回后的处理方式：</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {isWorkflow ? (
                <>
                  <RejectOption id="fix-continue" icon={<CheckCircle2 className="w-4 h-4 text-blue-600" />} label="修正继续" desc="修正当前步骤，继续执行" selected={rejectAction === "fix-continue"} onClick={() => setRejectAction("fix-continue")} />
                  <RejectOption id="redo-prev" icon={<RotateCcw className="w-4 h-4 text-amber-600" />} label="退回上一步" desc="从上一个节点重新执行" selected={rejectAction === "redo-prev"} onClick={() => setRejectAction("redo-prev")} />
                  <RejectOption id="takeover" icon={<Hand className="w-4 h-4 text-purple-600" />} label="人工接管" desc="转人工处理" selected={rejectAction === "takeover"} onClick={() => setRejectAction("takeover")} />
                </>
              ) : (
                <>
                  <RejectOption id="fix-continue" icon={<CheckCircle2 className="w-4 h-4 text-blue-600" />} label="修正继续" desc="局部修正后继续当前策略" selected={rejectAction === "fix-continue"} onClick={() => setRejectAction("fix-continue")} />
                  <RejectOption id="replan" icon={<RotateCcw className="w-4 h-4 text-amber-600" />} label="重新规划" desc="Agent 根据反馈重新规划" selected={rejectAction === "replan"} onClick={() => setRejectAction("replan")} />
                  <RejectOption id="takeover" icon={<Hand className="w-4 h-4 text-purple-600" />} label="人工接管" desc="人工直接处理" selected={rejectAction === "takeover"} onClick={() => setRejectAction("takeover")} />
                </>
              )}
            </div>
            <p className="text-xs text-red-600 mb-1.5">驳回原因：</p>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="说明驳回原因..." className="text-sm min-h-[60px] bg-white" />
            <div className="flex gap-2 mt-2 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowRejectForm(false); setRejectAction(null); }}>取消</Button>
              <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={handleReject} disabled={!rejectReason.trim() || !rejectAction}>确认驳回</Button>
            </div>
          </div>
        )}

        {/* Error actions */}
        {showErrorActions && !actionDone && (
          <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
            <p className="text-sm font-medium text-zinc-800 mb-3">选择异常处理方式</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleErrorAction("retry")} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <RotateCcw className="w-4 h-4 text-blue-600" /><span className="text-xs font-medium text-zinc-700">重试</span>
              </button>
              <button onClick={() => handleErrorAction("manual")} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-amber-300 hover:bg-amber-50 transition-colors">
                <Hand className="w-4 h-4 text-amber-600" /><span className="text-xs font-medium text-zinc-700">人工接管</span>
              </button>
              <button onClick={() => handleErrorAction("skip")} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-100 transition-colors">
                <SkipForward className="w-4 h-4 text-zinc-600" /><span className="text-xs font-medium text-zinc-700">跳过</span>
              </button>
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <InfoCard label="Agent" value={`${task.agentIcon} ${task.agentName}`} />
          <InfoCard label={isAgentic ? "当前阶段" : "当前节点"} value={task.currentNode} />
          <InfoCard label="进度" value={`${task.progress}%`} />
          <InfoCard label="耗时" value={task.duration} icon={<Clock className="w-3.5 h-3.5 text-zinc-400" />} />
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${task.status === "error" ? "bg-red-400" : task.status === "completed" ? "bg-green-500" : isAgentic ? "bg-violet-500" : "bg-blue-500"}`}
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>

        {/* Pending confirm detail */}
        {isPending && lastEvent?.type === "human_confirm" && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">需要人工确认</h3>
            </div>
            <p className="text-sm text-amber-700 whitespace-pre-line">{lastEvent.content}</p>
            {lastEvent.details && (
              <div className="mt-3 p-3 rounded-lg bg-white/60 text-xs text-amber-600 space-y-1">
                {Object.entries(lastEvent.details).map(([key, val]) => (
                  <div key={key}>
                    <span className="font-medium">{key}:</span>{" "}
                    <span>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === Agentic Dashboard === */}
        {isAgentic && dashboard && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              运营看板
            </h2>

            {/* Weekly summary */}
            <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 mb-4">
              <p className="text-xs font-medium text-violet-600 mb-1">本周摘要</p>
              <p className="text-sm text-violet-900 leading-relaxed">{dashboard.weeklySummary}</p>
            </div>

            {/* Goal progress + stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-1 p-4 rounded-xl border border-zinc-200 bg-white">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">目标进度</p>
                <p className="text-2xl font-bold text-violet-700 mt-1">{dashboard.goalProgress.percentage}%</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {dashboard.goalProgress.current.toLocaleString()} / {dashboard.goalProgress.target.toLocaleString()}
                </p>
                <div className="h-2 rounded-full bg-zinc-100 mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${dashboard.goalProgress.percentage}%` }} />
                </div>
              </div>

              {/* Weekly growth */}
              <div className="col-span-2 p-4 rounded-xl border border-zinc-200 bg-white">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">周涨粉趋势</p>
                <div className="flex items-end gap-2 h-20">
                  {dashboard.weeklyGrowth.map((w, i) => {
                    const maxF = Math.max(...dashboard.weeklyGrowth.map((x) => x.followers));
                    const h = maxF > 0 ? (w.followers / maxF) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-zinc-500">+{w.followers}</span>
                        <div className="w-full rounded-t bg-violet-200 hover:bg-violet-300 transition-colors" style={{ height: `${h}%`, minHeight: 4 }} />
                        <span className="text-[9px] text-zinc-400">{w.week}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Content performance */}
            {dashboard.contentPerformance.length > 0 && (
              <div className="p-4 rounded-xl border border-zinc-200 bg-white mb-4">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3">内容效果对比</p>
                <div className="space-y-2">
                  {dashboard.contentPerformance.map((cp, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-zinc-700 w-20 shrink-0">{cp.type}</span>
                      <div className="flex items-center gap-1">
                        {"⭐".repeat(cp.rating)}{"☆".repeat(5 - cp.rating)}
                      </div>
                      <span className="text-[11px] text-zinc-500">平均赞 {cp.avgLikes}</span>
                      <span className="text-[11px] text-zinc-400">评论 {cp.avgComments}</span>
                      <span className="text-[10px] text-zinc-400 ml-auto">{cp.count} 条</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            {dashboard.aiSuggestions.length > 0 && (
              <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/30 mb-4">
                <p className="text-[10px] text-violet-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" /> AI 建议
                </p>
                <div className="space-y-2">
                  {dashboard.aiSuggestions.map((sug) => {
                    const acted = suggestionActions[sug.id] || sug.status;
                    return (
                      <div key={sug.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-zinc-100">
                        <div className="flex-1">
                          <p className="text-xs text-zinc-700">{sug.content}</p>
                          <span className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded ${
                            sug.impact === "高" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                          }`}>
                            影响：{sug.impact}
                          </span>
                        </div>
                        {acted === "pending" ? (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleSuggestion(sug.id, "accepted")}
                              className="p-1.5 rounded-md border border-green-200 text-green-600 hover:bg-green-50 transition-colors"
                              title="采纳"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSuggestion(sug.id, "rejected")}
                              className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:bg-zinc-50 transition-colors"
                              title="忽略"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${
                            acted === "accepted" ? "border-green-200 text-green-600" : "border-zinc-200 text-zinc-400"
                          }`}>
                            {acted === "accepted" ? "已采纳" : "已忽略"}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Strategy Evolution === */}
        {isAgentic && evolution && evolution.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-violet-600" />
              策略演进
            </h2>
            <div className="relative">
              {/* Horizontal timeline connector */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-zinc-200" />
              <div className="flex justify-between relative">
                {evolution.map((ver, i) => (
                  <EvolutionNode key={i} version={ver} isLast={i === evolution.length - 1} isCurrent={i === evolution.length - 1} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">执行时间线</h2>
          {events.length > 0 ? (
            <div className="space-y-0">
              {events.map((event, idx) => {
                const ec = EVENT_ICONS[event.type] || EVENT_ICONS.system;
                const Icon = ec.icon;
                const isLast = idx === events.length - 1;
                const isHighlight = event.type === "ai_suggestion" || event.type === "milestone" || event.type === "human_confirm";
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ec.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-zinc-200 my-1" />}
                    </div>
                    <div className={`flex-1 pb-4 ${isHighlight ? "p-3 -ml-1 rounded-lg bg-zinc-50/50 border border-zinc-100 mb-1" : ""}`}>
                      <div className="flex items-center gap-2">
                        {event.nodeName && (
                          <span className="text-xs font-medium text-zinc-700">{event.nodeName}</span>
                        )}
                        <span className="text-[10px] text-zinc-400">{event.timestamp}</span>
                      </div>
                      <p className="text-sm text-zinc-600 mt-1 whitespace-pre-line">{event.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-400 text-sm">
              <p>暂无执行记录</p>
            </div>
          )}
        </div>

        {/* Task metadata */}
        <div className="mt-8 pb-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">任务信息</h2>
          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-zinc-400">任务 ID</span><span className="text-zinc-700 font-mono">{task.id}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Agent</span><span className="text-zinc-700">{task.agentName}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">类型</span><span className="text-zinc-700">{isAgentic ? "智能体" : "工作流"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">开始时间</span><span className="text-zinc-700">{task.startedAt}</span></div>
            {task.completedAt && <div className="flex justify-between"><span className="text-zinc-400">完成时间</span><span className="text-zinc-700">{task.completedAt}</span></div>}
            <div className="flex justify-between"><span className="text-zinc-400">耗时</span><span className="text-zinc-700">{task.duration}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-3.5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {icon}
        <p className="text-sm font-semibold text-zinc-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function RejectOption({ icon, label, desc, selected, onClick }: {
  id: string; icon: React.ReactNode; label: string; desc: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
        selected ? "border-red-400 bg-red-50 ring-1 ring-red-200" : "border-zinc-200 bg-white hover:border-red-200"
      }`}
    >
      {icon}
      <span className="text-xs font-medium text-zinc-700">{label}</span>
      <span className="text-[10px] text-zinc-400 leading-tight">{desc}</span>
    </button>
  );
}

function EvolutionNode({ version, isLast, isCurrent }: {
  version: { version: string; date: string; summary: string; changes: string[]; trigger: string };
  isLast: boolean;
  isCurrent: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col items-center" style={{ width: `${100 / 3}%` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
          isCurrent
            ? "border-violet-500 bg-violet-100 text-violet-700 ring-2 ring-violet-200"
            : "border-zinc-300 bg-white text-zinc-500 hover:border-violet-300"
        }`}
      >
        <span className="text-[10px] font-bold">{version.version}</span>
      </button>
      <p className="text-[10px] text-zinc-500 mt-1.5">{version.date}</p>
      <p className="text-[11px] font-medium text-zinc-700 mt-0.5 text-center">{version.summary}</p>
      {expanded && (
        <div className="mt-2 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-left w-full">
          <div className="space-y-1 mb-2">
            {version.changes.map((c, i) => (
              <p key={i} className="text-[10px] text-zinc-600">• {c}</p>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 border-t border-zinc-200 pt-1.5">触发：{version.trigger}</p>
        </div>
      )}
    </div>
  );
}
