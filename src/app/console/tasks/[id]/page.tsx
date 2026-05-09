"use client";

import { use, useState, type ComponentType, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Clock, CheckCircle2, AlertTriangle,
  Play, XCircle, UserCheck, Settings,
  RotateCcw, Hand, SkipForward, ArrowDown,
  Lightbulb, BarChart3, Flag,
  ShieldAlert, ArrowRightLeft, Maximize2, FileText,
} from "lucide-react";
import {
  MOCK_TASKS, MOCK_TASK_EVENTS,
  MOCK_AGENTIC_DASHBOARD, MOCK_STRATEGY_EVOLUTION,
} from "@/lib/mock-console";
import { AgenticTabs } from "./agentic-tabs";
import type {
  ConsoleTaskStatus,
  TaskEventType,
  HumanConfirmType,
  ReviewLayout,
  TaskEvent,
} from "@/lib/types";
import { FlowPanorama } from "./flow-panorama";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const STATUS_CONFIG: Record<ConsoleTaskStatus, { label: string; className: string }> = {
  queued: { label: "排队中", className: "bg-zinc-100 text-zinc-600" },
  running: { label: "执行中", className: "bg-blue-50 text-blue-700" },
  pending_confirm: { label: "待确认", className: "bg-amber-50 text-amber-700" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700" },
  error: { label: "异常", className: "bg-red-50 text-red-700" },
};

const EVENT_ICONS: Record<TaskEventType, { icon: ComponentType<{ className?: string }>; color: string }> = {
  node_start: { icon: Play, color: "text-blue-500 bg-blue-50" },
  node_complete: { icon: CheckCircle2, color: "text-green-500 bg-green-50" },
  node_error: { icon: XCircle, color: "text-red-500 bg-red-50" },
  human_confirm: { icon: UserCheck, color: "text-amber-500 bg-amber-50" },
  system: { icon: Settings, color: "text-zinc-500 bg-zinc-50" },
  ai_suggestion: { icon: Lightbulb, color: "text-violet-500 bg-violet-50" },
  data_report: { icon: BarChart3, color: "text-blue-500 bg-blue-50" },
  milestone: { icon: Flag, color: "text-emerald-500 bg-emerald-50" },
  intervention: { icon: ShieldAlert, color: "text-orange-600 bg-orange-50" },
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
  // suggestion state moved into AgenticTabs
  const [showIntervention, setShowIntervention] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const isWorkflow = task.taskType === "workflow";
  const isRunning = task.status === "running";
  const confirmType: HumanConfirmType = (lastEvent as { confirmType?: HumanConfirmType } | undefined)?.confirmType || "verify";
  const reviewLayout: ReviewLayout = (lastEvent as { reviewLayout?: ReviewLayout } | undefined)?.reviewLayout || "card";

  const handleApprove = () => {
    setActionDone("approved");
    setShowRejectForm(false);
    toast.success(isWorkflow ? "确认无误，继续执行下一步" : "已同意，任务将继续执行");
  };

  const handleCorrect = () => {
    setActionDone("corrected");
    setShowRejectForm(false);
    toast.success("已提交修正，助手将用修正后的内容继续执行");
  };

  const handleDefer = () => {
    setActionDone("deferred");
    toast.info("已标记为稍后处理，你可以随时回来确认");
  };

  const handleReject = () => {
    if (!rejectReason.trim() || !rejectAction) return;
    setActionDone(`rejected-${rejectAction}`);
    setShowRejectForm(false);
    const labels: Record<string, string> = {
      "fix-continue": "已修正，助手将继续执行",
      "replan": "已反馈，AI 助手将重新规划方案",
      "takeover": "已转人工处理",
    };
    toast.info(labels[rejectAction] || "已处理");
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

  const handleInputSubmit = () => {
    setActionDone("input-submitted");
    toast.success("信息已提交，流程将继续执行");
  };

  const handleDecision = () => {
    if (!selectedDecision) return;
    setActionDone(`decision-${selectedDecision}`);
    toast.success("决策已提交，流程将继续执行");
  };

  // handleSuggestion moved into AgenticTabs

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6">
        <Link href="/console/tasks" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors mb-4">
          <ArrowLeft className="w-3 h-3" />
          返回任务列表
        </Link>

        {actionDone ? (
          <div
            className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-sm
            ${
              actionDone === "approved" ||
              actionDone === "corrected" ||
              actionDone === "input-submitted" ||
              actionDone.startsWith("decision-")
                ? "bg-green-50 border border-green-200 text-green-700"
                : actionDone === "deferred"
                  ? "bg-blue-50 border border-blue-200 text-blue-700"
                  : actionDone.startsWith("rejected")
                    ? "bg-amber-50 border border-amber-200 text-amber-700"
                    : "bg-blue-50 border border-blue-200 text-blue-700"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">
              {actionDone === "approved" &&
                (isWorkflow ? "确认无误，助手将继续执行下一步。" : "已同意，任务将继续执行。")}
              {actionDone === "corrected" &&
                `已修正为：${rejectReason}。助手将用修正后的内容继续。`}
              {actionDone === "deferred" && "已标记为稍后处理，你可以随时回来确认。"}
              {actionDone === "rejected-fix-continue" &&
                `已修正：${rejectReason}。助手将继续执行。`}
              {actionDone === "rejected-replan" &&
                `反馈已收到：${rejectReason}。AI 助手将重新规划。`}
              {actionDone === "rejected-takeover" &&
                `已转人工处理。原因：${rejectReason}`}
              {actionDone === "input-submitted" && "信息已提交，助手将继续办理。"}
              {actionDone.startsWith("decision-") &&
                `决策已提交：${String(selectedDecision ?? "")}。${
                  decisionNote ? `备注：${decisionNote}` : ""
                }`}
              {actionDone === "retry" && "已重新执行。"}
              {actionDone === "manual" && "已转人工处理。"}
              {actionDone === "skip" && "已跳过，继续下一步。"}
            </span>
          </div>
        ) : null}

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-900">{task.id}</h1>
              <Badge className={`text-xs h-5 border-0 ${sc.className}`}>{sc.label}</Badge>
              {isAgentic ? <Badge className="text-xs h-5 bg-violet-50 text-violet-700 border-0">智能体</Badge> : null}
              {task.priority === "urgent" ? <Badge className="text-xs h-5 bg-red-100 text-red-700 border-0">紧急</Badge> : null}
              {task.priority === "high" ? <Badge className="text-xs h-5 bg-amber-100 text-amber-700 border-0">高优</Badge> : null}
            </div>
            <p className="text-sm text-zinc-500 mt-1">{task.description}</p>
          </div>
          {isRunning && !actionDone ? (
            <Button size="sm" variant="outline" className="h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => setShowIntervention(!showIntervention)}>
              <ShieldAlert className="w-3.5 h-3.5 mr-1" /> 干预
            </Button>
          ) : null}
          {isError && !actionDone ? (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowErrorActions(!showErrorActions)}>
              <Settings className="w-3.5 h-3.5 mr-1" /> 异常处理 <ArrowDown className="w-3 h-3 ml-0.5" />
            </Button>
          ) : null}
        </div>

        {showErrorActions && !actionDone ? (
          <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
            <p className="text-sm font-medium text-zinc-800 mb-3">选择异常处理方式</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => handleErrorAction("retry")} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <RotateCcw className="w-4 h-4 text-blue-600" /><span className="text-xs font-medium text-zinc-700">重试</span>
              </button>
              <button type="button" onClick={() => handleErrorAction("manual")} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-amber-300 hover:bg-amber-50 transition-colors">
                <Hand className="w-4 h-4 text-amber-600" /><span className="text-xs font-medium text-zinc-700">人工接管</span>
              </button>
              <button type="button" onClick={() => handleErrorAction("skip")} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-100 transition-colors">
                <SkipForward className="w-4 h-4 text-zinc-600" /><span className="text-xs font-medium text-zinc-700">跳过</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-4 gap-4 mt-6">
          <InfoCard label="负责助手" value={`${String(task.agentIcon)} ${String(task.agentName)}`} />
          <InfoCard label="当前在做" value={String(task.currentNode ?? "")} />
          <InfoCard label="完成进度" value={`${task.progress}%`} />
          <InfoCard label="已用时间" value={task.duration} icon={<Clock className="w-3.5 h-3.5 text-zinc-400" />} />
        </div>

        {task.flowNodes && task.flowNodes.length > 0 ? (
          <FlowPanorama nodes={task.flowNodes} className="mt-5" />
        ) : (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${task.status === "error" ? "bg-red-400" : task.status === "completed" ? "bg-green-500" : isAgentic ? "bg-violet-500" : "bg-blue-500"}`}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Intervention panel */}
        {showIntervention ? (
          <div className="mt-6">
            <InterventionPanel taskId={task.id} onClose={() => setShowIntervention(false)} />
          </div>
        ) : null}

        {/* Pending confirm detail — renders differently by confirmType */}
        {isPending && lastEvent?.type === "human_confirm" ? (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border-2 border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">
                  {confirmType === "verify" && "需要你确认一下"}
                  {confirmType === "input" && "需要你补充信息"}
                  {confirmType === "decision" && "需要你做决定"}
                </h3>
              </div>
              {reviewLayout !== "card" ? (
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setReviewDialogOpen(true)}>
                  <Maximize2 className="w-3.5 h-3.5 mr-1" />
                  {reviewLayout === "match" ? "打开匹配视图" : "打开对照视图"}
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-amber-700 whitespace-pre-line">{lastEvent.content}</p>
            {reviewLayout === "card" && <ConfirmDetails details={lastEvent.details} />}
            {reviewLayout !== "card" ? (
              <div className="mt-3 p-3 rounded-lg bg-white/60 border border-amber-100 flex items-center gap-3 cursor-pointer hover:bg-white transition-colors" onClick={() => setReviewDialogOpen(true)}>
                <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-zinc-700">{reviewLayout === "match" ? "三栏匹配视图：源文件 ↔ AI 结果 ↔ 编码参考" : "双栏对照视图：合同原文 ↔ AI 风险标注"}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">点击展开完整审核界面</p>
                </div>
              </div>
            ) : null}

            {/* === verify 型：校验 AI 结果 === */}
            {confirmType === "verify" && !actionDone ? (
              <div className="flex gap-2 mt-4 pt-3 border-t border-amber-200/60">
                {isWorkflow ? (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-zinc-300 text-zinc-500 hover:bg-zinc-50" onClick={handleDefer}>
                      <Clock className="w-3.5 h-3.5 mr-1" /> 稍后再看
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => setShowRejectForm(true)}>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> 不对，我来改
                    </Button>
                    <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 没问题
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowRejectForm(true)}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> 有问题
                    </Button>
                    <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 同意
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            {/* === input 型：填写表单 === */}
            {confirmType === "input" && !actionDone ? (
              <InputForm details={lastEvent.details} inputValues={inputValues} setInputValues={setInputValues} onSubmit={handleInputSubmit} onDefer={handleDefer} />
            ) : null}

            {/* === decision 型：做出决策选择 === */}
            {confirmType === "decision" && !actionDone ? (
              <DecisionForm details={lastEvent.details} selectedDecision={selectedDecision} setSelectedDecision={setSelectedDecision} decisionNote={decisionNote} setDecisionNote={setDecisionNote} onSubmit={handleDecision} onDefer={handleDefer} />
            ) : null}
          </div>
        ) : null}

        {/* Review dialog for match / compare layouts */}
        {reviewLayout === "match" && lastEvent?.details?.matchView ? (
          <MatchReviewDialog
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
            data={lastEvent.details.matchView as MatchViewData}
            onApprove={handleApprove}
            onReject={() => { setReviewDialogOpen(false); setShowRejectForm(true); }}
          />
        ) : null}
        {reviewLayout === "compare" && lastEvent?.details?.compareView ? (
          <CompareReviewDialog
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
            data={lastEvent.details.compareView as CompareViewData}
            onApprove={handleApprove}
            onReject={() => { setReviewDialogOpen(false); setShowRejectForm(true); }}
          />
        ) : null}

        {/* Correction / Reject form — inline below confirm card */}
        {showRejectForm && !actionDone ? (
          isWorkflow ? (
            <div className="mt-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">填写正确内容</p>
              <p className="text-xs text-blue-600 mb-2">AI 的结果哪里不对？正确的应该是什么？</p>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="比如：编码应该是 8541.49（电晶体），不是集成电路" className="text-sm min-h-[60px] bg-white" />
              <div className="flex gap-2 mt-3 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowRejectForm(false)}>取消</Button>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleCorrect} disabled={!rejectReason.trim()}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 提交修正
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm font-medium text-amber-800 mb-2">接下来怎么办？</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <RejectOption id="fix-continue" icon={<CheckCircle2 className="w-4 h-4 text-blue-600" />} label="改了继续" desc="局部修正后继续当前方案" selected={rejectAction === "fix-continue"} onClick={() => setRejectAction("fix-continue")} />
                <RejectOption id="replan" icon={<RotateCcw className="w-4 h-4 text-amber-600" />} label="重新规划" desc="让 AI 重新想方案" selected={rejectAction === "replan"} onClick={() => setRejectAction("replan")} />
                <RejectOption id="takeover" icon={<Hand className="w-4 h-4 text-purple-600" />} label="我来处理" desc="转人工接手" selected={rejectAction === "takeover"} onClick={() => setRejectAction("takeover")} />
              </div>
              <p className="text-xs text-amber-600 mb-1.5">说一下你的想法：</p>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="哪里需要调整？你的思路是什么？" className="text-sm min-h-[60px] bg-white" />
              <div className="flex gap-2 mt-3 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowRejectForm(false); setRejectAction(null); }}>取消</Button>
                <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={handleReject} disabled={!rejectReason.trim() || !rejectAction}>确认提交</Button>
              </div>
            </div>
          )
        ) : null}

        {/* === Agentic Tabs === */}
        {isAgentic && dashboard ? (
          <AgenticTabs dashboard={dashboard} evolution={evolution || []} events={events} />
        ) : null}

        {/* Timeline — Workflow only (Agentic has its own in Logs tab) */}
        {!isAgentic && <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">事务进展</h2>
          {events.length > 0 ? (
            <div className="space-y-0">
              {events.map((event, idx) => {
                const ec = EVENT_ICONS[event.type] || EVENT_ICONS.system;
                const Icon = ec.icon;
                const isLast = idx === events.length - 1;
                const isHighlight = event.type === "ai_suggestion" || event.type === "milestone" || event.type === "human_confirm" || event.type === "intervention";
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ec.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-zinc-200 my-1" />}
                    </div>
                    {event.type === "intervention" ? (
                      <InterventionCard event={event} />
                    ) : (
                    <div className={`flex-1 pb-4 ${isHighlight ? "p-3 -ml-1 rounded-lg bg-zinc-50/50 border border-zinc-100 mb-1" : ""}`}>
                      <div className="flex items-center gap-2">
                        {event.nodeName ? (
                          <span className="text-xs font-medium text-zinc-700">{event.nodeName}</span>
                        ) : null}
                        <span className="text-[10px] text-zinc-400">{event.timestamp}</span>
                      </div>
                      <p className="text-sm text-zinc-600 mt-1 whitespace-pre-line">{event.content}</p>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-400 text-sm">
              <p>暂无执行记录</p>
            </div>
          )}
        </div>}

        {/* Task metadata */}
        <div className="mt-8 pb-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">基本信息</h2>
          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-zinc-400">编号</span><span className="text-zinc-700 font-mono">{task.id}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">负责助手</span><span className="text-zinc-700">{task.agentName}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">处理方式</span><span className="text-zinc-700">{isAgentic ? "AI 自主规划" : "按流程执行"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">开始时间</span><span className="text-zinc-700">{task.startedAt}</span></div>
            {task.completedAt && <div className="flex justify-between"><span className="text-zinc-400">完成时间</span><span className="text-zinc-700">{task.completedAt}</span></div>}
            <div className="flex justify-between"><span className="text-zinc-400">已用时间</span><span className="text-zinc-700">{task.duration}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
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
  id: string; icon: ReactNode; label: string; desc: string; selected: boolean; onClick: () => void;
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

function InterventionCard({ event }: { event: TaskEvent }) {
  const d = event.details as { operator?: string; action?: string; changes?: { param: string; from: string; to: string }[]; reason?: string } | undefined;
  return (
    <div className="flex-1 pb-4 p-4 -ml-1 rounded-xl bg-orange-50 border-2 border-orange-200 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-4 h-4 text-orange-600" />
        <span className="text-xs font-semibold text-orange-800">{event.nodeName || "管理层干预"}</span>
        <span className="text-[10px] text-orange-500 ml-auto">{event.timestamp}</span>
      </div>
      <p className="text-sm text-orange-800 mb-3">{event.content}</p>
      {d?.changes && d.changes.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {d.changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/80 border border-orange-100">
              <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="text-xs font-medium text-zinc-700 w-24 shrink-0">{c.param}</span>
              <span className="text-xs text-zinc-400 line-through">{c.from}</span>
              <span className="text-[10px] text-orange-500">→</span>
              <span className="text-xs font-semibold text-orange-700">{c.to}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start gap-4 text-[11px] text-orange-600">
        {d?.operator && <span>操作人：{d.operator}</span>}
        {d?.reason && <span className="flex-1">原因：{d.reason}</span>}
      </div>
    </div>
  );
}

function InterventionPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [param, setParam] = useState("");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const presets = [
    { param: "月推广预算", current: "¥5,000", options: ["¥10,000", "¥15,000", "¥20,000"] },
    { param: "发布频率", current: "每天3条", options: ["每天5条", "每天8条"] },
    { param: "付费推广", current: "关闭", options: ["开启"] },
    { param: "内容方向", current: "测评70%+教程25%+话题5%", options: ["测评50%+教程20%+视频30%", "测评80%+教程20%"] },
  ];

  const handleSubmit = () => {
    if (!param || !newValue || !reason) return;
    setSubmitted(true);
    toast.success("干预已提交，参数将在下一轮执行中生效", { description: `${param}: ${newValue}` });
  };

  if (submitted) {
    return (
      <div className="p-4 rounded-xl border-2 border-orange-200 bg-orange-50">
        <div className="flex items-center gap-2 text-sm text-orange-800">
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-medium">干预已生效</span>
        </div>
        <p className="text-xs text-orange-600 mt-1">{param} 已变更为 {newValue}，Agent 将在下一轮执行中应用。</p>
        <Button size="sm" variant="ghost" className="h-7 text-xs mt-2" onClick={onClose}>关闭</Button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border-2 border-orange-200 bg-orange-50/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-semibold text-orange-800">运行时干预</h3>
        </div>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-zinc-400" onClick={onClose}>取消</Button>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3">修改运行中任务的参数，变更将在下一轮执行中生效。</p>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-medium text-zinc-600 mb-1.5">选择要修改的参数</p>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((p) => (
              <button
                key={p.param}
                onClick={() => { setParam(p.param); setNewValue(""); }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  param === p.param ? "border-orange-400 bg-orange-50 ring-1 ring-orange-200" : "border-zinc-200 bg-white hover:border-orange-200"
                }`}
              >
                <p className="text-[11px] font-medium text-zinc-700">{p.param}</p>
                <p className="text-[10px] text-zinc-400">当前：{p.current}</p>
              </button>
            ))}
          </div>
        </div>

        {param && (
          <div>
            <p className="text-[11px] font-medium text-zinc-600 mb-1.5">新值</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.find((p) => p.param === param)?.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setNewValue(opt)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    newValue === opt ? "border-orange-400 bg-orange-100 text-orange-800 font-medium" : "border-zinc-200 bg-white text-zinc-600 hover:border-orange-200"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-medium text-zinc-600 mb-1.5">干预原因</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="说明为什么要修改这个参数..."
            className="text-xs min-h-[50px] bg-white"
          />
        </div>

        <Button
          size="sm"
          className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700"
          onClick={handleSubmit}
          disabled={!param || !newValue || !reason.trim()}
        >
          <ShieldAlert className="w-3.5 h-3.5 mr-1" />
          确认干预
        </Button>
      </div>
    </div>
  );
}

function ConfirmDetails({ details }: { details?: Record<string, unknown> }) {
  if (!details) return null;

  const aiResult = details.aiResult as { label: string; value: string }[] | undefined;
  const sourceFiles = details.sourceFiles as { name: string; desc: string }[] | undefined;

  if (!aiResult && !sourceFiles) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-white/60 text-xs text-amber-600 space-y-1">
        {Object.entries(details).map(([key, val]) => (
          <div key={key}>
            <span className="font-medium">{key}:</span>{" "}
            <span>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {aiResult && aiResult.length > 0 && (
        <div className="p-3 rounded-lg bg-white border border-amber-100">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">AI 分析结果</p>
          <div className="space-y-2">
            {aiResult.map((item, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-xs text-zinc-500 w-24 shrink-0 pt-0.5">{item.label}</span>
                <span className="text-xs text-zinc-800 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {sourceFiles && sourceFiles.length > 0 && (
        <div className="p-3 rounded-lg bg-white border border-amber-100">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">参考原件</p>
          <div className="space-y-1.5">
            {sourceFiles.map((file, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors text-left group"
                onClick={() => toast.info("Demo 模式暂不支持打开文件", { description: file.name })}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-amber-700">
                    {file.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-600 group-hover:text-blue-800 truncate">{file.name}</p>
                  <p className="text-[10px] text-zinc-400">{file.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface InputField {
  id: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

function InputForm({
  details,
  inputValues,
  setInputValues,
  onSubmit,
  onDefer,
}: {
  details?: Record<string, unknown>;
  inputValues: Record<string, string>;
  setInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  onSubmit: () => void;
  onDefer: () => void;
}) {
  const fields = (details?.inputFields ?? []) as InputField[];
  const requiredFields = fields.filter((f) => f.required);
  const allRequiredFilled = requiredFields.every((f) => inputValues[f.id]?.trim());

  return (
    <div className="mt-4 pt-3 border-t border-amber-200/60 space-y-3">
      {fields.map((field) => (
        <div key={field.id}>
          <label className="text-xs font-medium text-zinc-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.type === "select" && field.options ? (
            <Select
              value={inputValues[field.id] || ""}
              onValueChange={(v) => setInputValues((prev) => ({ ...prev, [field.id]: v ?? "" }))}
            >
              <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="mt-1 h-8 text-xs bg-white"
              placeholder={field.placeholder}
              value={inputValues[field.id] || ""}
              onChange={(e) => setInputValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-2 justify-end">
        <Button size="sm" variant="outline" className="h-8 text-xs border-zinc-300 text-zinc-500" onClick={onDefer}>
          <Clock className="w-3.5 h-3.5 mr-1" /> 稍后再填
        </Button>
        <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={onSubmit} disabled={!allRequiredFilled}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 提交信息
        </Button>
      </div>
    </div>
  );
}

interface DecisionOption {
  id: string;
  label: string;
  desc: string;
  color: string;
}

function DecisionForm({
  details,
  selectedDecision,
  setSelectedDecision,
  decisionNote,
  setDecisionNote,
  onSubmit,
  onDefer,
}: {
  details?: Record<string, unknown>;
  selectedDecision: string | null;
  setSelectedDecision: (v: string | null) => void;
  decisionNote: string;
  setDecisionNote: (v: string) => void;
  onSubmit: () => void;
  onDefer: () => void;
}) {
  const decisions = (details?.decisions ?? []) as DecisionOption[];

  const colorMap: Record<string, { border: string; bg: string; ring: string }> = {
    green: { border: "border-green-300", bg: "bg-green-50", ring: "ring-green-500" },
    amber: { border: "border-amber-300", bg: "bg-amber-50", ring: "ring-amber-500" },
    red: { border: "border-red-300", bg: "bg-red-50", ring: "ring-red-500" },
  };

  return (
    <div className="mt-4 pt-3 border-t border-amber-200/60 space-y-3">
      <p className="text-xs text-zinc-500">请选择你的决策：</p>
      <div className="grid gap-2">
        {decisions.map((d) => {
          const c = colorMap[d.color] || colorMap.amber;
          const selected = selectedDecision === d.id;
          return (
            <button
              key={d.id}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${selected ? `${c.border} ${c.bg} ring-2 ${c.ring}` : "border-zinc-200 hover:border-zinc-300 bg-white"}`}
              onClick={() => setSelectedDecision(d.id)}
            >
              <p className="text-sm font-medium text-zinc-800">{d.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{d.desc}</p>
            </button>
          );
        })}
      </div>
      <div>
        <label className="text-xs text-zinc-500">备注（可选）</label>
        <Textarea
          className="mt-1 text-xs min-h-[48px] bg-white"
          placeholder="有什么需要说明的？"
          value={decisionNote}
          onChange={(e) => setDecisionNote(e.target.value)}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" className="h-8 text-xs border-zinc-300 text-zinc-500" onClick={onDefer}>
          <Clock className="w-3.5 h-3.5 mr-1" /> 稍后再看
        </Button>
        <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={onSubmit} disabled={!selectedDecision}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 确认决策
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
 *  三栏匹配弹窗（Match Review Dialog）
 * ========================================================= */

interface MatchSourceField { label: string; value: string }
interface MatchAlternative { code: string; name: string; taxRate: string; confidence: number; diff: string }
interface MatchRefEntry { code: string; name: string; desc: string; highlight?: boolean }

interface MatchViewData {
  source: { title: string; subtitle: string; fields: MatchSourceField[]; file: { name: string; page: string } };
  result: { title: string; confidence: number; recommended: { code: string; name: string; taxRate: string; reason: string }; alternatives: MatchAlternative[] };
  reference: { title: string; subtitle: string; entries: MatchRefEntry[] };
}

function MatchReviewDialog({ open, onOpenChange, data, onApprove, onReject }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: MatchViewData;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { source, result, reference } = data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden p-0">
        <div className="p-4 border-b bg-amber-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">编码匹配审核</h2>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-600" onClick={onReject}>不对，我来改</Button>
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => { onApprove(); onOpenChange(false); }}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> 没问题
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x overflow-y-auto max-h-[calc(90vh-56px)]">
          {/* Left: source */}
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">{source.title}</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">{source.subtitle}</p>
            </div>
            <div className="space-y-2.5">
              {source.fields.map((f, i) => (
                <div key={i}>
                  <p className="text-[10px] text-zinc-400">{f.label}</p>
                  <p className="text-sm text-zinc-800 font-medium">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t">
              <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-50 w-full text-left" onClick={() => toast.info("Demo 模式暂不支持打开文件")}>
                <div className="w-7 h-7 rounded bg-amber-100 flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-amber-700" /></div>
                <div>
                  <p className="text-xs font-medium text-blue-600">{source.file.name}</p>
                  <p className="text-[10px] text-zinc-400">{source.file.page}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Center: AI result */}
          <div className="p-4 space-y-4 bg-green-50/30">
            <div>
              <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">{result.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 flex-1 rounded-full bg-zinc-200 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${result.confidence}%` }} />
                </div>
                <span className="text-xs font-bold text-amber-600">{result.confidence}%</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border-2 border-green-200">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-green-700 font-mono">{result.recommended.code}</span>
                <Badge className="bg-green-100 text-green-700 text-[10px]">推荐</Badge>
              </div>
              <p className="text-sm text-zinc-700 mt-1">{result.recommended.name}</p>
              <p className="text-[10px] text-zinc-400 mt-1">税率 {result.recommended.taxRate}</p>
              <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{result.recommended.reason}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">备选编码</p>
              {result.alternatives.map((alt) => (
                <div key={alt.code} className="p-2.5 rounded-lg border border-zinc-200 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-bold text-zinc-600">{alt.code}</span>
                    <span className="text-[10px] text-zinc-400">{alt.confidence}%</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">{alt.name} · 税率 {alt.taxRate}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{alt.diff}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: reference */}
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">{reference.title}</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">{reference.subtitle}</p>
            </div>
            <div className="space-y-1.5">
              {reference.entries.map((entry) => (
                <div key={entry.code} className={`p-2.5 rounded-lg border ${entry.highlight ? "border-green-300 bg-green-50" : "border-zinc-100 bg-white"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono font-bold ${entry.highlight ? "text-green-700" : "text-zinc-600"}`}>{entry.code}</span>
                    {entry.highlight && <Badge className="bg-green-100 text-green-700 text-[9px] h-4">匹配</Badge>}
                  </div>
                  <p className="text-xs text-zinc-700 font-medium mt-0.5">{entry.name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{entry.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
 *  双栏对照弹窗（Compare Review Dialog）
 * ========================================================= */

interface CompareSection { heading: string; page: number; text: string }
interface CompareAnnotation { clause: string; level: string; original: string; issue: string; detail: string; suggestion: string }

interface CompareViewData {
  left: { title: string; subtitle: string; sections: CompareSection[] };
  right: { title: string; annotations: CompareAnnotation[] };
}

function CompareReviewDialog({ open, onOpenChange, data, onApprove, onReject }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: CompareViewData;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { left, right } = data;
  const levelColors: Record<string, string> = { high: "bg-red-100 text-red-700 border-red-200", medium: "bg-amber-100 text-amber-700 border-amber-200", low: "bg-green-100 text-green-700 border-green-200" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] overflow-hidden p-0">
        <div className="p-4 border-b bg-amber-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">合同条款对照审阅</h2>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-600" onClick={onReject}>不对，我来改</Button>
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => { onApprove(); onOpenChange(false); }}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> 确认无误
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x overflow-y-auto max-h-[calc(90vh-56px)]">
          {/* Left: original text */}
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">{left.title}</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">{left.subtitle}</p>
            </div>
            {left.sections.map((sec, i) => (
              <div key={i} className="p-3 rounded-lg border border-zinc-200 bg-white">
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-semibold text-zinc-800">{sec.heading}</h4>
                  <span className="text-[10px] text-zinc-400">P.{sec.page}</span>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{sec.text}</p>
              </div>
            ))}
          </div>

          {/* Right: annotations */}
          <div className="p-4 space-y-4 bg-red-50/20">
            <div>
              <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">{right.title}</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">共标记 {right.annotations.length} 处风险</p>
            </div>
            {right.annotations.map((ann, i) => (
              <div key={i} className="p-3 rounded-lg border border-zinc-200 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-zinc-600">第 {ann.clause} 条</span>
                  <Badge className={`text-[9px] h-4 ${levelColors[ann.level] || levelColors.medium}`}>
                    {ann.level === "high" ? "高风险" : ann.level === "medium" ? "中风险" : "低风险"}
                  </Badge>
                </div>
                <div className="p-2 rounded bg-red-50 border border-red-100">
                  <p className="text-xs text-red-800 font-medium">{ann.issue}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">原文：<span className="italic">&ldquo;{ann.original}&rdquo;</span></p>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">{ann.detail}</p>
                <div className="p-2 rounded bg-blue-50 border border-blue-100">
                  <p className="text-[10px] font-medium text-blue-700">修改建议</p>
                  <p className="text-xs text-blue-800 mt-0.5">{ann.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
