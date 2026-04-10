"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Target, ChevronDown, ChevronRight, CheckCircle2,
  Clock, ArrowRight, AlertTriangle, Shield, Zap,
  MessageSquare, Check, X, Play, Settings,
  BarChart3, FileText, Eye, Bell, TrendingUp,
  Pencil, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { AgenticPhase, AgenticFallback, AgenticRiskItem, AgenticSkill } from "@/lib/types";

function EditableText({ value, onSave, className = "", multiline = false, placeholder = "" }: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      },
      placeholder,
      className: `w-full bg-white border border-blue-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${className}`,
    };
    return multiline
      ? <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} {...shared} rows={2} />
      : <input ref={inputRef as React.RefObject<HTMLInputElement>} {...shared} />;
  }

  return (
    <span
      className={`group/edit cursor-pointer hover:bg-blue-50/50 rounded px-0.5 -mx-0.5 transition-colors inline-flex items-center gap-1 ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="点击编辑"
    >
      {value || <span className="text-zinc-400 italic">{placeholder || "点击输入"}</span>}
      <Pencil className="w-2.5 h-2.5 text-zinc-300 opacity-0 group-hover/edit:opacity-100 transition-opacity shrink-0" />
    </span>
  );
}

function EditableList({ items, onSave, placeholder = "新增项目..." }: {
  items: string[];
  onSave: (items: string[]) => void;
  placeholder?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-zinc-600 group/item">
          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
          <EditableText
            value={item}
            onSave={(v) => { const next = [...items]; next[i] = v; onSave(next); }}
            className="flex-1"
          />
          <button
            onClick={() => { const next = items.filter((_, j) => j !== i); onSave(next); }}
            className="opacity-0 group-hover/item:opacity-100 text-zinc-300 hover:text-red-400 transition-all shrink-0 mt-0.5"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </li>
      ))}
      {adding ? (
        <li className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0">{items.length + 1}</span>
          <input
            ref={inputRef}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) { onSave([...items, newItem.trim()]); setNewItem(""); setAdding(false); }
              if (e.key === "Escape") { setNewItem(""); setAdding(false); }
            }}
            onBlur={() => { if (newItem.trim()) { onSave([...items, newItem.trim()]); } setNewItem(""); setAdding(false); }}
            placeholder={placeholder}
            className="flex-1 bg-white border border-blue-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </li>
      ) : (
        <li>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-500 transition-colors mt-1"
          >
            <Plus className="w-3 h-3" /> 添加
          </button>
        </li>
      )}
    </ul>
  );
}

const PHASE_STATUS_STYLE = {
  confirmed: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", dot: "bg-green-500", label: "已确认" },
  reviewing: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", label: "确认中" },
  pending: { bg: "bg-zinc-50", border: "border-zinc-200", text: "text-zinc-500", dot: "bg-zinc-400", label: "待确认" },
};

function PhaseTimeline({ phases, activePhaseId, onSelect }: {
  phases: AgenticPhase[];
  activePhaseId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
      {phases.map((phase, i) => {
        const style = PHASE_STATUS_STYLE[phase.status] || PHASE_STATUS_STYLE.pending;
        const isActive = phase.id === activePhaseId;
        const [d0, d1] = phase.dayRange || [0, 0];
        return (
          <div key={phase.id} className="flex items-center shrink-0">
            <button
              onClick={() => onSelect(phase.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs font-medium
                ${isActive ? `${style.bg} ${style.border} ${style.text} ring-2 ring-offset-1 ring-blue-300` : `bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50`}`}
            >
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className="whitespace-nowrap">{phase.name}</span>
              <span className="text-[10px] text-zinc-400">D{d0}-{d1}</span>
              {phase.requiresApproval && <Shield className="w-3 h-3 text-amber-500" />}
            </button>
            {i < phases.length - 1 && (
              <ArrowRight className="w-3.5 h-3.5 text-zinc-300 mx-1 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhaseDetail({ phase, onConfirm, onAnswerQuestion, onUpdatePhase }: {
  phase: AgenticPhase;
  onConfirm: () => void;
  onAnswerQuestion: (questionId: string, answer: string) => void;
  onUpdatePhase: (patch: Partial<AgenticPhase>) => void;
}) {
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const style = PHASE_STATUS_STYLE[phase.status] || PHASE_STATUS_STYLE.pending;

  const unansweredQuestions = (phase.questions || []).filter((q) => !q.answer);
  const canConfirm = phase.status !== "confirmed" && unansweredQuestions.length === 0;

  return (
    <div className={`mx-4 rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100/50">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
          <h3 className="text-sm font-bold text-zinc-900">
            <EditableText value={phase.name} onSave={(v) => onUpdatePhase({ name: v })} />
          </h3>
          <Badge variant="outline" className="text-[10px] h-5">
            Day {phase.dayRange[0]}–{phase.dayRange[1]}
          </Badge>
          {phase.requiresApproval && (
            <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-600 border-amber-200 gap-1">
              <Shield className="w-3 h-3" /> 需审批
            </Badge>
          )}
        </div>
        <Badge variant="outline" className={`text-[10px] h-5 ${style.text}`}>
          {style.label}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        {/* Actions */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-2">
            <Play className="w-3.5 h-3.5 text-blue-500" /> 执行动作
          </div>
          <EditableList items={phase.actions || []} onSave={(actions) => onUpdatePhase({ actions })} placeholder="新增执行动作..." />
        </div>

        {/* Success Criteria */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-violet-500" /> 判断标准
          </div>
          {(() => {
            const sc = phase.successCriteria || { good: "", warning: "", bad: "" };
            return (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-green-50/80 border border-green-200/50 p-2">
                  <div className="text-[10px] font-medium text-green-600 mb-0.5">表现好</div>
                  <div className="text-[11px] text-green-700">
                    <EditableText value={sc.good || ""} onSave={(v) => onUpdatePhase({ successCriteria: { ...sc, good: v } })} multiline />
                  </div>
                </div>
                <div className="rounded-lg bg-amber-50/80 border border-amber-200/50 p-2">
                  <div className="text-[10px] font-medium text-amber-600 mb-0.5">需关注</div>
                  <div className="text-[11px] text-amber-700">
                    <EditableText value={sc.warning || ""} onSave={(v) => onUpdatePhase({ successCriteria: { ...sc, warning: v } })} multiline />
                  </div>
                </div>
                <div className="rounded-lg bg-red-50/80 border border-red-200/50 p-2">
                  <div className="text-[10px] font-medium text-red-600 mb-0.5">表现差</div>
                  <div className="text-[11px] text-red-700">
                    <EditableText value={sc.bad || ""} onSave={(v) => onUpdatePhase({ successCriteria: { ...sc, bad: v } })} multiline />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Exit Condition */}
        <div className="flex items-start gap-2 rounded-lg bg-white/60 border border-zinc-200/50 p-2.5">
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] font-medium text-zinc-500">进入下一阶段条件</div>
            <div className="text-xs text-zinc-700">
              <EditableText value={phase.exitCondition} onSave={(v) => onUpdatePhase({ exitCondition: v })} />
            </div>
          </div>
        </div>

        {/* Approval Description */}
        {phase.requiresApproval && phase.approvalDescription && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 border border-amber-200/50 p-2.5">
            <Shield className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-[10px] font-medium text-amber-600">审批内容</div>
              <div className="text-xs text-amber-700">
                <EditableText value={phase.approvalDescription} onSave={(v) => onUpdatePhase({ approvalDescription: v })} />
              </div>
            </div>
          </div>
        )}

        {/* Required Capabilities */}
        {phase.requiredCapabilities && phase.requiredCapabilities.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> 需要的能力
            </div>
            <div className="flex flex-wrap gap-1.5">
              {phase.requiredCapabilities.map((cap, i) => (
                <Badge key={i} variant="outline" className="text-[10px] h-5 bg-white group/cap">
                  <EditableText value={cap} onSave={(v) => {
                    const next = [...phase.requiredCapabilities!];
                    next[i] = v;
                    onUpdatePhase({ requiredCapabilities: next });
                  }} />
                  <button
                    onClick={() => onUpdatePhase({ requiredCapabilities: phase.requiredCapabilities!.filter((_, j) => j !== i) })}
                    className="ml-0.5 opacity-0 group-hover/cap:opacity-100 text-zinc-300 hover:text-red-400 transition-all"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
              <button
                onClick={() => {
                  const name = prompt("新增能力名称：");
                  if (name?.trim()) onUpdatePhase({ requiredCapabilities: [...(phase.requiredCapabilities || []), name.trim()] });
                }}
                className="text-[10px] text-zinc-400 hover:text-blue-500 transition-colors flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> 添加
              </button>
            </div>
          </div>
        )}

        {/* Questions */}
        {phase.questions && phase.questions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> AI 追问
            </div>
            <div className="space-y-2">
              {phase.questions.map((q) => (
                <div key={q.id} className={`rounded-lg border p-3 ${q.answer ? "bg-green-50/50 border-green-200/50" : "bg-white border-blue-200/50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-zinc-700 font-medium">{q.question}</div>
                    {q.answer && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                  </div>
                  {q.context && (
                    <div className="text-[10px] text-zinc-400 mt-1">{q.context}</div>
                  )}
                  {q.answer ? (
                    <div className="mt-2 text-xs text-green-700 bg-green-100/50 rounded px-2 py-1">
                      {q.answer}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {q.options && q.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {q.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => onAnswerQuestion(q.id, opt)}
                              className="text-[11px] px-2.5 py-1 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                      {expandedQ === q.id ? (
                        <div className="flex gap-1.5">
                          <Textarea
                            value={answerDraft}
                            onChange={(e) => setAnswerDraft(e.target.value)}
                            placeholder="自定义回答..."
                            className="text-xs min-h-[40px] max-h-[80px] resize-none flex-1"
                          />
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              disabled={!answerDraft.trim()}
                              onClick={() => {
                                onAnswerQuestion(q.id, answerDraft.trim());
                                setAnswerDraft("");
                                setExpandedQ(null);
                              }}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-2"
                              onClick={() => { setExpandedQ(null); setAnswerDraft(""); }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setExpandedQ(q.id)}
                          className="text-[10px] text-zinc-400 hover:text-blue-500 transition-colors"
                        >
                          自定义回答...
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirm Button */}
        {phase.status !== "confirmed" && (
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={!canConfirm}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {canConfirm ? "确认此阶段" : `还有 ${unansweredQuestions.length} 个问题待回答`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
      >
        {icon}
        <span className="text-xs font-semibold text-zinc-700 flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
      </button>
      {open && <div className="p-4 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

export default function AgenticCanvas() {
  const { agenticConfig, confirmPhase, answerPhaseQuestion, updatePhase, updateAgenticField } = useFlowAgentStore();
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  const config = agenticConfig;
  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        等待 AI 生成阶段方案...
      </div>
    );
  }

  const phases: AgenticPhase[] = config.phases || [];
  const allConfirmed = phases.length > 0 && phases.every((p: AgenticPhase) => p.status === "confirmed");

  useEffect(() => {
    if (!activePhaseId && phases.length > 0) {
      const firstPending = phases.find((p: AgenticPhase) => p.status !== "confirmed");
      setActivePhaseId(firstPending?.id || phases[0].id);
    } else if (activePhaseId && phases.length > 0 && !phases.find((p) => p.id === activePhaseId)) {
      setActivePhaseId(phases[0].id);
    }
  }, [activePhaseId, phases]);

  const activePhase = phases.find((p: AgenticPhase) => p.id === activePhaseId) || (phases.length > 0 ? phases[0] : null);

  const handleConfirmPhase = useCallback((phaseId: string) => {
    confirmPhase(phaseId);
    const nextPending = phases.find((p: AgenticPhase) => p.id !== phaseId && p.status !== "confirmed");
    if (nextPending) {
      setActivePhaseId(nextPending.id);
    }
    toast.success("阶段已确认");
  }, [confirmPhase, phases]);

  const handleAnswerQuestion = useCallback((phaseId: string, questionId: string, answer: string) => {
    answerPhaseQuestion(phaseId, questionId, answer);
  }, [answerPhaseQuestion]);

  const handleUpdatePhase = useCallback((phaseId: string, patch: Partial<AgenticPhase>) => {
    updatePhase(phaseId, patch);
  }, [updatePhase]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50/50">
      {/* Goal Banner */}
      <div className="px-4 py-3 bg-white border-b border-zinc-200">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-violet-500" />
          <h2 className="text-sm font-bold text-zinc-900">
            <EditableText value={config.goal} onSave={(v) => updateAgenticField("goal", v)} />
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {config.totalDays} 天
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> {phases.length} 个阶段
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {phases.filter((p: AgenticPhase) => p.status === "confirmed").length}/{phases.length} 已确认
          </span>
          {config.estimatedDuration && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {config.estimatedDuration}
            </span>
          )}
        </div>
        {config.globalSuccessCriteria && (
          <div className="mt-1.5 text-[11px] text-zinc-500">
            <span className="font-medium">成功标准：</span>
            <EditableText value={config.globalSuccessCriteria} onSave={(v) => updateAgenticField("globalSuccessCriteria", v)} />
          </div>
        )}
      </div>

      {/* Phase Timeline */}
      <div className="bg-white border-b border-zinc-200">
        <PhaseTimeline
          phases={phases}
          activePhaseId={activePhaseId}
          onSelect={setActivePhaseId}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* Active Phase Detail */}
        {activePhase && (
          <PhaseDetail
            key={activePhase.id}
            phase={activePhase}
            onConfirm={() => handleConfirmPhase(activePhase.id)}
            onAnswerQuestion={(qId, answer) => handleAnswerQuestion(activePhase.id, qId, answer)}
            onUpdatePhase={(patch) => handleUpdatePhase(activePhase.id, patch)}
          />
        )}

        {/* Overview sections (shown after all phases confirmed, or always for context) */}
        <div className="px-4 space-y-3">
          {/* Fallbacks */}
          {config.fallbacks && config.fallbacks.length > 0 && (
            <OverviewSection title="兜底机制" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}>
              <div className="space-y-2">
                {config.fallbacks.map((fb: AgenticFallback, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs group/fb">
                    <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${
                      fb.severity === "critical" ? "text-red-600 border-red-200" :
                      fb.severity === "warning" ? "text-amber-600 border-amber-200" :
                      "text-blue-600 border-blue-200"
                    }`}>
                      {fb.severity}
                    </Badge>
                    <div className="flex-1">
                      <span className="font-medium text-zinc-700">
                        <EditableText value={fb.trigger} onSave={(v) => {
                          const next = [...config.fallbacks!];
                          next[i] = { ...fb, trigger: v };
                          updateAgenticField("fallbacks", next);
                        }} />
                      </span>
                      <span className="text-zinc-500"> → </span>
                      <EditableText value={fb.action} onSave={(v) => {
                        const next = [...config.fallbacks!];
                        next[i] = { ...fb, action: v };
                        updateAgenticField("fallbacks", next);
                      }} />
                    </div>
                    <button
                      onClick={() => updateAgenticField("fallbacks", config.fallbacks!.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover/fb:opacity-100 text-zinc-300 hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </OverviewSection>
          )}

          {/* Execution Overview */}
          {config.executionOverview && (
            <OverviewSection title="执行概览" icon={<Eye className="w-3.5 h-3.5 text-blue-500" />}>
              <div className="text-xs text-zinc-600 leading-relaxed">
                <EditableText value={config.executionOverview} onSave={(v) => updateAgenticField("executionOverview", v)} multiline />
              </div>
            </OverviewSection>
          )}

          {/* Risk Assessment */}
          {config.riskAssessment && config.riskAssessment.length > 0 && (
            <OverviewSection title="风险评估" icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}>
              <div className="space-y-2">
                {config.riskAssessment.map((r: AgenticRiskItem, i: number) => (
                  <div key={i} className="rounded-lg bg-zinc-50 p-2.5 group/risk">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] h-5 ${
                        r.likelihood === "high" ? "text-red-600 border-red-200" :
                        r.likelihood === "medium" ? "text-amber-600 border-amber-200" :
                        "text-green-600 border-green-200"
                      }`}>
                        {r.likelihood}
                      </Badge>
                      <span className="text-xs font-medium text-zinc-700 flex-1">
                        <EditableText value={r.risk} onSave={(v) => {
                          const next = [...config.riskAssessment!];
                          next[i] = { ...r, risk: v };
                          updateAgenticField("riskAssessment", next);
                        }} />
                      </span>
                      <button
                        onClick={() => updateAgenticField("riskAssessment", config.riskAssessment!.filter((_, j) => j !== i))}
                        className="opacity-0 group-hover/risk:opacity-100 text-zinc-300 hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      <EditableText value={r.mitigation} onSave={(v) => {
                        const next = [...config.riskAssessment!];
                        next[i] = { ...r, mitigation: v };
                        updateAgenticField("riskAssessment", next);
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </OverviewSection>
          )}

          {/* Reporting */}
          {config.reporting && (
            <OverviewSection title="汇报机制" icon={<Bell className="w-3.5 h-3.5 text-violet-500" />}>
              <div className="space-y-2 text-xs text-zinc-600">
                {config.reporting.daily?.enabled && (
                  <div>
                    <span className="font-medium">日报</span>
                    {config.reporting.daily.sampleContent && (
                      <div className="mt-1 text-[11px] text-zinc-500 bg-zinc-50 rounded p-2">{config.reporting.daily.sampleContent}</div>
                    )}
                  </div>
                )}
                {config.reporting.weekly?.enabled && (
                  <div>
                    <span className="font-medium">周报</span>：{config.reporting.weekly.content}
                    {config.reporting.weekly.sampleContent && (
                      <div className="mt-1 text-[11px] text-zinc-500 bg-zinc-50 rounded p-2 whitespace-pre-line">{config.reporting.weekly.sampleContent}</div>
                    )}
                  </div>
                )}
              </div>
            </OverviewSection>
          )}

          {/* Tech Config */}
          {allConfirmed && (
            <OverviewSection title="技术配置" icon={<Settings className="w-3.5 h-3.5 text-zinc-500" />}>
              {config.skills.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-zinc-700">Skills ({config.skills.length})</div>
                  {config.skills.map((sk: AgenticSkill) => (
                    <div key={sk.id} className="rounded-lg bg-zinc-50 p-2 text-xs">
                      <span className="font-medium text-zinc-700">{sk.name}</span>
                      <span className="text-zinc-500 ml-1">— {sk.description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-zinc-500">提交技术评审后将自动生成技术配置</p>
                </div>
              )}
            </OverviewSection>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      {!allConfirmed && (
        <div className="px-4 py-3 bg-white border-t border-zinc-200 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500">
            {phases.filter((p: AgenticPhase) => p.status === "confirmed").length}/{phases.length} 个阶段已确认
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              useFlowAgentStore.getState().confirmAllPhases();
              toast.success("所有阶段已确认");
            }}
            className="text-xs gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> 全部确认
          </Button>
        </div>
      )}
    </div>
  );
}
