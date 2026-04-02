"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Clock, CheckCircle2, AlertTriangle,
  Play, XCircle, UserCheck, Settings,
  RotateCcw, Hand, SkipForward, ArrowDown,
} from "lucide-react";
import { MOCK_TASKS, MOCK_TASK_EVENTS } from "@/lib/mock-console";
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
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const task = MOCK_TASKS.find((t) => t.id === id);
  const events = MOCK_TASK_EVENTS[id] || [];

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

  const handleApprove = () => {
    setActionDone("approved");
    setShowRejectForm(false);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    setActionDone("rejected");
    setShowRejectForm(false);
  };

  const handleErrorAction = (action: string) => {
    setActionDone(action);
    setShowErrorActions(false);
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
              actionDone === "rejected" ? "bg-red-50 border border-red-200 text-red-700" :
              "bg-blue-50 border border-blue-200 text-blue-700"}`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {actionDone === "approved" && "已确认通过，任务将继续执行。"}
            {actionDone === "rejected" && `已驳回，原因：${rejectReason || "无"}。任务已暂停。`}
            {actionDone === "retry" && "已发起重试，任务将从当前节点重新执行。"}
            {actionDone === "manual" && "已转人工处理，相关人员将收到通知。"}
            {actionDone === "skip" && "已跳过当前节点，任务将继续执行下一步。"}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-900">{task.id}</h1>
              <Badge className={`text-xs h-5 border-0 ${sc.className}`}>{sc.label}</Badge>
              {task.priority === "urgent" && (
                <Badge className="text-xs h-5 bg-red-100 text-red-700 border-0">紧急</Badge>
              )}
              {task.priority === "high" && (
                <Badge className="text-xs h-5 bg-amber-100 text-amber-700 border-0">高优</Badge>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-1">{task.description}</p>
          </div>
          {isPending && !actionDone && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowRejectForm(true)}>
                <XCircle className="w-3.5 h-3.5 mr-1" />
                驳回
              </Button>
              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                确认通过
              </Button>
            </div>
          )}
          {isError && !actionDone && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowErrorActions(!showErrorActions)}>
              <Settings className="w-3.5 h-3.5 mr-1" />
              异常处理
              <ArrowDown className="w-3 h-3 ml-0.5" />
            </Button>
          )}
        </div>

        {/* Reject form */}
        {showRejectForm && !actionDone && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-800 mb-2">请填写驳回原因</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="说明驳回原因，以便相关人员了解..."
              className="text-sm min-h-[60px] bg-white"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowRejectForm(false)}>取消</Button>
              <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={handleReject} disabled={!rejectReason.trim()}>确认驳回</Button>
            </div>
          </div>
        )}

        {/* Error action dropdown */}
        {showErrorActions && !actionDone && (
          <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
            <p className="text-sm font-medium text-zinc-800 mb-3">选择异常处理方式</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleErrorAction("retry")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-zinc-700">重试</span>
                <span className="text-[10px] text-zinc-400">从当前节点重新执行</span>
              </button>
              <button
                onClick={() => handleErrorAction("manual")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
              >
                <Hand className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-zinc-700">人工接管</span>
                <span className="text-[10px] text-zinc-400">通知相关人员处理</span>
              </button>
              <button
                onClick={() => handleErrorAction("skip")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-100 transition-colors"
              >
                <SkipForward className="w-4 h-4 text-zinc-600" />
                <span className="text-xs font-medium text-zinc-700">跳过</span>
                <span className="text-[10px] text-zinc-400">跳过当前节点继续</span>
              </button>
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <InfoCard label="Agent" value={`${task.agentIcon} ${task.agentName}`} />
          <InfoCard label="当前节点" value={task.currentNode} />
          <InfoCard label="进度" value={`${task.progress}%`} />
          <InfoCard label="耗时" value={task.duration} icon={<Clock className="w-3.5 h-3.5 text-zinc-400" />} />
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${task.status === "error" ? "bg-red-400" : task.status === "completed" ? "bg-green-500" : "bg-blue-500"}`}
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

        {/* Timeline */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">执行时间线</h2>
          {events.length > 0 ? (
            <div className="space-y-0">
              {events.map((event, idx) => {
                const ec = EVENT_ICONS[event.type] || EVENT_ICONS.system;
                const Icon = ec.icon;
                const isLast = idx === events.length - 1;
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ec.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-zinc-200 my-1" />}
                    </div>
                    <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
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
              <p className="text-xs mt-1">任务开始执行后，这里会显示每个节点的执行详情</p>
            </div>
          )}
        </div>

        {/* Task metadata */}
        <div className="mt-8 pb-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">任务信息</h2>
          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">任务 ID</span>
              <span className="text-zinc-700 font-mono">{task.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Agent</span>
              <span className="text-zinc-700">{task.agentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">开始时间</span>
              <span className="text-zinc-700">{task.startedAt}</span>
            </div>
            {task.completedAt && (
              <div className="flex justify-between">
                <span className="text-zinc-400">完成时间</span>
                <span className="text-zinc-700">{task.completedAt}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-400">耗时</span>
              <span className="text-zinc-700">{task.duration}</span>
            </div>
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
