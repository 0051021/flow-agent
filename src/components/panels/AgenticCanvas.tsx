"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Target, ChevronDown, ChevronRight,
  Clock, ArrowRight, ArrowUp, ArrowDown, AlertTriangle, Zap,
  MessageSquare, X, Play, Save,
  BarChart3, Bell,
  FileText, Pencil, Plus, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AGENTIC_NOT_RELEVANT_ANSWER, type AgenticPhase, type AgenticFallback, type AgenticPhaseQuestion } from "@/lib/types";

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

const FALLBACK_SEVERITY_STYLE: Record<AgenticFallback["severity"], { label: string; className: string }> = {
  critical: { label: "高风险事项", className: "text-red-600 border-red-200 bg-red-50" },
  warning: { label: "需关注事项", className: "text-amber-600 border-amber-200 bg-amber-50" },
  info: { label: "提示事项", className: "text-blue-600 border-blue-200 bg-blue-50" },
};

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function countPendingPhaseQuestions(phase: AgenticPhase, decisions: Record<string, QuestionDecision> = {}) {
  return (phase.questions || []).filter((question) => (
    question.answer !== AGENTIC_NOT_RELEVANT_ANSWER &&
    !question.answer &&
    !isQuestionHandledByDecision(decisions[question.id])
  )).length;
}

function isQuestionHandledByDecision(decision?: QuestionDecision) {
  if (!decision) return false;
  if (decision.status === "skipped") return true;
  return decision.value.trim().length > 0;
}

function PhaseTimeline({ phases, activePhaseId, decisions, onSelect }: {
  phases: AgenticPhase[];
  activePhaseId: string | null;
  decisions: Record<string, QuestionDecision>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-6 py-4">
      {phases.map((phase, i) => {
        const isActive = phase.id === activePhaseId;
        const pendingQuestionCount = countPendingPhaseQuestions(phase, decisions);
        return (
          <div key={phase.id} className="flex items-center shrink-0">
            <button
              onClick={() => onSelect(phase.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all
                ${isActive ? "bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-offset-1 ring-blue-300" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
              >
              <span className={`w-2 h-2 rounded-full ${pendingQuestionCount > 0 ? "bg-amber-500" : "bg-zinc-300"}`} />
              <span className="whitespace-nowrap">{phase.name}</span>
              <span className="text-[10px] text-zinc-400">模块 {i + 1}/{phases.length}</span>
              {pendingQuestionCount > 0 && (
                <Badge variant="outline" className="h-5 border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-600">
                  {pendingQuestionCount} 个待明确
                </Badge>
              )}
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

function ModuleManagerPanel({
  phases,
  activePhaseId,
  onSelect,
  onRename,
  onMove,
  onDelete,
  onAdd,
}: {
  phases: AgenticPhase[];
  activePhaseId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mx-6 mb-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-zinc-800">管理模块结构</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            如果 AI 拆分不准，可以在这里改名、调整顺序、新增或删除模块。
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> 新增模块
        </Button>
      </div>
      <div className="space-y-2">
        {phases.map((phase, index) => {
          const isActive = phase.id === activePhaseId;
          return (
            <div
              key={phase.id}
              className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 ${
                isActive ? "border-blue-200 ring-1 ring-blue-100" : "border-zinc-200"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(phase.id)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isActive ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {index + 1}
              </button>
              <div className="min-w-0 flex-1 text-sm font-medium text-zinc-800">
                <EditableText value={phase.name} onSave={(name) => onRename(phase.id, name)} />
              </div>
              <Badge variant="outline" className="h-5 text-[10px] text-zinc-500">
                D{phase.dayRange?.[0]}-{phase.dayRange?.[1]}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-500"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-500"
                disabled={index === phases.length - 1}
                onClick={() => onMove(index, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                disabled={phases.length <= 1}
                onClick={() => onDelete(phase.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhaseDetail({ phase, phaseIndex, totalPhases, onUpdatePhase }: {
  phase: AgenticPhase;
  phaseIndex: number;
  totalPhases: number;
  onUpdatePhase: (patch: Partial<AgenticPhase>) => void;
}) {
  const materialFileInputRef = useRef<HTMLInputElement>(null);
  const requirementTags = phase.requiredCapabilities || [];
  const materialFiles = phase.materialFiles || [];

  const handleMaterialFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const uploadedAt = new Date().toISOString();
    const nextFiles = files.map((file, index) => ({
      id: `material-${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
      uploadedAt,
    }));

    onUpdatePhase({ materialFiles: [...materialFiles, ...nextFiles] });
    toast.success(`已添加 ${files.length} 个资料文件`);
  };

  return (
    <div className="mx-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100/70 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <h3 className="text-sm font-bold text-zinc-900">
            <EditableText value={phase.name} onSave={(v) => onUpdatePhase({ name: v })} />
          </h3>
          <Badge variant="outline" className="text-[10px] h-5">
            模块 {phaseIndex + 1}/{totalPhases}
          </Badge>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {/* Business handling */}
        <div>
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
            <Play className="w-3.5 h-3.5 text-blue-500" /> 业务处理内容
          </div>
          <EditableList items={phase.actions || []} onSave={(actions) => onUpdatePhase({ actions })} placeholder="新增业务处理内容..." />
        </div>

        {/* Business materials and requirements */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> 资料、规则文件与时效要求
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={materialFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleMaterialFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 rounded-full px-3 text-[10px]"
                onClick={() => materialFileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" /> 上传文件
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {requirementTags.map((cap, i) => (
              <Badge key={i} variant="outline" className="text-[10px] h-5 bg-white group/cap">
                <EditableText value={cap} onSave={(v) => {
                  const next = [...requirementTags];
                  next[i] = v;
                  onUpdatePhase({ requiredCapabilities: next });
                }} />
                <button
                  onClick={() => onUpdatePhase({ requiredCapabilities: requirementTags.filter((_, j) => j !== i) })}
                  className="ml-0.5 opacity-0 group-hover/cap:opacity-100 text-zinc-300 hover:text-red-400 transition-all"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
            <button
              onClick={() => {
                onUpdatePhase({ requiredCapabilities: [...requirementTags, "点击填写资料、规则文件或时效要求"] });
              }}
              className="text-[10px] text-zinc-400 hover:text-blue-500 transition-colors flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> 添加文字要求
            </button>
          </div>
          {materialFiles.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {materialFiles.map((file) => (
                <div
                  key={file.id}
                  className="group/file flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-500">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-zinc-700">{file.name}</div>
                    <div className="text-[10px] text-zinc-400">{formatFileSize(file.size)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdatePhase({ materialFiles: materialFiles.filter((item) => item.id !== file.id) })}
                    className="opacity-0 transition-opacity text-zinc-300 hover:text-red-400 group-hover/file:opacity-100"
                    title="移除文件"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[10px] text-zinc-400">
            可以上传规则文件、模板或表格，也可以用文字补充业务时效、材料要求、结果输出标准和例外口径；后续技术方再判断如何落地。
          </p>
        </div>

      </div>
    </div>
  );
}

type QuestionDecision = {
  value: string;
  status: "answered" | "skipped";
};

type QuestionItem = {
  phaseId: string;
  phaseName: string;
  question: AgenticPhaseQuestion;
};

function SupplementQuestionsPanel({
  questions,
  decisions,
  onChooseOption,
  onCustomAnswer,
  onSkip,
}: {
  questions: QuestionItem[];
  decisions: Record<string, QuestionDecision>;
  onChooseOption: (questionId: string, value: string) => void;
  onCustomAnswer: (questionId: string, value: string) => void;
  onSkip: (questionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pendingCount = questions.filter((item) => !item.question.answer && !isQuestionHandledByDecision(decisions[item.question.id])).length;
  const stagedCount = Object.keys(decisions).length;

  if (questions.length === 0) return null;

  const statusLabel = (decision?: QuestionDecision, answer?: string) => {
    if (answer && answer !== AGENTIC_NOT_RELEVANT_ANSWER) return { text: "已应用", className: "bg-green-50 text-green-700 border-green-200" };
    if (decision?.status === "answered") return { text: "已填写", className: "bg-blue-50 text-blue-700 border-blue-200" };
    if (decision?.status === "skipped") return { text: "不涉及", className: "bg-zinc-50 text-zinc-500 border-zinc-200" };
    return { text: "未处理", className: "bg-white text-zinc-500 border-zinc-200" };
  };

  return (
    <div className="mx-6 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/40 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <MessageSquare className="h-4 w-4 text-blue-600" />
        <div className="flex-1">
          <div className="text-sm font-bold text-zinc-900">补充问题清单</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            先集中回答或标记不涉及；不确定的问题可以先留空，保存整个方案草稿后再回来补。
          </div>
        </div>
        <Badge variant="outline" className="h-6 border-blue-200 bg-white text-xs text-blue-700">
          {pendingCount} 个待补充
        </Badge>
        {open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-blue-100 bg-white/70 p-5">
          {questions.map((item, index) => {
            const decision = decisions[item.question.id];
            const status = statusLabel(decision, item.question.answer);
            return (
              <div key={item.question.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-zinc-400">{item.phaseName}</span>
                      <Badge variant="outline" className={`h-5 text-[10px] ${status.className}`}>
                        {status.text}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-relaxed text-zinc-800">{item.question.question}</div>
                    {item.question.context && <div className="mt-1 text-[11px] text-zinc-500">{item.question.context}</div>}
                    {item.question.answer ? (
                      <div className="mt-2 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">{item.question.answer}</div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {item.question.options && item.question.options.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {item.question.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => onChooseOption(item.question.id, opt)}
                                className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                                  decision?.status === "answered" && decision.value === opt
                                    ? "border-blue-300 bg-blue-50 text-blue-700"
                                    : "border-zinc-200 bg-white text-zinc-600 hover:border-blue-200 hover:text-blue-600"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        <Textarea
                          value={decision?.status === "answered" ? decision.value : ""}
                          onChange={(e) => onCustomAnswer(item.question.id, e.target.value)}
                          placeholder="也可以输入自定义回答..."
                          className="min-h-[68px] resize-none bg-white text-xs"
                        />
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-zinc-500" onClick={() => onSkip(item.question.id)}>
                            不涉及
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="border-t border-zinc-100 pt-4 text-[11px] text-zinc-500">
            已处理 {stagedCount} 个问题，应用前不会改动方案内容；未回答的问题会继续保留在草稿里，不涉及的问题应用后不再提交给技术方。
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-3 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
      >
        {icon}
        <span className="text-xs font-semibold text-zinc-700 flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
      </button>
      {open && <div className="border-t border-zinc-100 p-5">{children}</div>}
    </div>
  );
}

export default function AgenticCanvas() {
  const { agenticConfig, answerPhaseQuestion, updatePhase, updateAgenticField } = useFlowAgentStore();
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [questionDecisions, setQuestionDecisions] = useState<Record<string, QuestionDecision>>({});
  const [moduleManagerOpen, setModuleManagerOpen] = useState(false);
  const reportingFileInputRef = useRef<HTMLInputElement>(null);

  const config = agenticConfig;
  const phases: AgenticPhase[] = useMemo(() => config?.phases || [], [config?.phases]);
  const reportingFiles = config?.reporting?.files || [];
  const durationLabel = config?.estimatedDuration || (config?.totalDays ? `${config.totalDays} 天` : "持续运行");
  const supplementQuestions: QuestionItem[] = useMemo(
    () => phases.flatMap((phase) => (phase.questions || []).map((question) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      question,
    }))),
    [phases],
  );
  const visibleSupplementQuestions = useMemo(
    () => supplementQuestions.filter((item) => item.question.answer !== AGENTIC_NOT_RELEVANT_ANSWER),
    [supplementQuestions],
  );
  const pendingQuestionCount = visibleSupplementQuestions.filter((item) => !item.question.answer && !isQuestionHandledByDecision(questionDecisions[item.question.id])).length;

  const defaultPhaseId = phases.find((p: AgenticPhase) => p.status !== "confirmed")?.id || phases[0]?.id || null;
  const resolvedActivePhaseId = activePhaseId && phases.some((p) => p.id === activePhaseId)
    ? activePhaseId
    : defaultPhaseId;
  const activePhase = phases.find((p: AgenticPhase) => p.id === resolvedActivePhaseId) || null;

  const handleUpdatePhase = useCallback((phaseId: string, patch: Partial<AgenticPhase>) => {
    updatePhase(phaseId, patch);
  }, [updatePhase]);

  const handleMovePhase = useCallback((index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= phases.length) return;
    const next = [...phases];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    updateAgenticField("phases", next);
    setActivePhaseId(moved.id);
  }, [phases, updateAgenticField]);

  const handleAddPhase = useCallback(() => {
    const lastDay = phases.reduce((max, phase) => Math.max(max, phase.dayRange?.[1] || 0), 0);
    const newPhase: AgenticPhase = {
      id: `phase-${Date.now()}`,
      name: `新模块 ${phases.length + 1}`,
      dayRange: [lastDay + 1, lastDay + 1],
      status: "pending",
      actions: ["描述这个模块需要处理的业务内容"],
      successCriteria: {
        good: "规则明确后可直接处理",
        warning: "仍有业务口径需要补充",
        bad: "不能直接处理，需要进入异常处理或复核",
      },
      exitCondition: "该模块规则被业务方确认",
      requiresApproval: false,
      questions: [],
      requiredCapabilities: [],
      materialFiles: [],
    };
    updateAgenticField("phases", [...phases, newPhase]);
    setActivePhaseId(newPhase.id);
    toast.success("已新增模块");
  }, [phases, updateAgenticField]);

  const handleDeletePhase = useCallback((phaseId: string) => {
    if (phases.length <= 1) {
      toast.error("至少需要保留 1 个模块");
      return;
    }
    const phase = phases.find((item) => item.id === phaseId);
    if (!window.confirm(`确认删除「${phase?.name || "该模块"}」吗？模块里的内容和问题也会一起删除。`)) return;
    const next = phases.filter((item) => item.id !== phaseId);
    updateAgenticField("phases", next);
    if (resolvedActivePhaseId === phaseId) {
      setActivePhaseId(next[Math.max(0, phases.findIndex((item) => item.id === phaseId) - 1)]?.id || next[0]?.id || null);
    }
    toast.success("已删除模块");
  }, [phases, resolvedActivePhaseId, updateAgenticField]);

  const setQuestionDecision = useCallback((questionId: string, decision: QuestionDecision) => {
    setQuestionDecisions((prev) => ({ ...prev, [questionId]: decision }));
  }, []);

  const handleApplyQuestions = useCallback(() => {
    let applied = 0;
    visibleSupplementQuestions.forEach((item) => {
      const decision = questionDecisions[item.question.id];
      if (!decision) return;
      if (decision.status === "skipped") {
        answerPhaseQuestion(item.phaseId, item.question.id, AGENTIC_NOT_RELEVANT_ANSWER);
        applied += 1;
      } else if (decision.value.trim()) {
        answerPhaseQuestion(item.phaseId, item.question.id, decision.value.trim());
        applied += 1;
      }
    });
    setQuestionDecisions({});
    toast.success(applied > 0 ? `已应用 ${applied} 个补充项` : "没有可应用的补充项");
  }, [answerPhaseQuestion, questionDecisions, visibleSupplementQuestions]);

  const handleSaveDraft = useCallback(() => {
    toast.success("已暂存为草稿（后续会接入个人主页草稿列表）");
  }, []);

  const handleReportingFiles = useCallback((fileList: FileList | null) => {
    if (!config?.reporting) return;

    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const uploadedAt = new Date().toISOString();
    const nextFiles = files.map((file, index) => ({
      id: `reporting-${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
      uploadedAt,
    }));

    updateAgenticField("reporting", {
      ...config.reporting,
      files: [...(config.reporting.files || []), ...nextFiles],
    });
    toast.success(`已添加 ${files.length} 个记录文档`);
  }, [config, updateAgenticField]);

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        等待 AI 生成运行方案...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50/50">
      {/* Goal Banner */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-500" />
          <h2 className="text-sm font-bold text-zinc-900">
            <EditableText value={config.goal} onSave={(v) => updateAgenticField("goal", v)} />
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleSaveDraft}>
              <Save className="h-3.5 w-3.5" /> 保存草稿
            </Button>
            <Button
              size="sm"
              className="h-8 bg-blue-600 text-xs hover:bg-blue-700"
              onClick={handleApplyQuestions}
              disabled={Object.keys(questionDecisions).length === 0}
            >
              应用补充到方案
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {durationLabel}
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> {phases.length} 个工作模块
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> {pendingQuestionCount} 个待补充问题
          </span>
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
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <PhaseTimeline
              phases={phases}
              activePhaseId={resolvedActivePhaseId}
              decisions={questionDecisions}
              onSelect={setActivePhaseId}
            />
          </div>
          <div className="shrink-0 pr-6">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setModuleManagerOpen((open) => !open)}
            >
              {moduleManagerOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              管理模块
            </Button>
          </div>
        </div>
        {moduleManagerOpen && (
          <ModuleManagerPanel
            phases={phases}
            activePhaseId={resolvedActivePhaseId}
            onSelect={setActivePhaseId}
            onRename={(id, name) => handleUpdatePhase(id, { name })}
            onMove={handleMovePhase}
            onDelete={handleDeletePhase}
            onAdd={handleAddPhase}
          />
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto space-y-5 py-6">
        <SupplementQuestionsPanel
          questions={visibleSupplementQuestions}
          decisions={questionDecisions}
          onChooseOption={(questionId, value) => setQuestionDecision(questionId, { value, status: "answered" })}
          onCustomAnswer={(questionId, value) => setQuestionDecision(questionId, { value, status: "answered" })}
          onSkip={(questionId) => setQuestionDecision(questionId, { value: "不涉及", status: "skipped" })}
        />

        {/* Active Phase Detail */}
        {activePhase && (
          <PhaseDetail
            key={activePhase.id}
            phase={activePhase}
            phaseIndex={Math.max(0, phases.findIndex((p) => p.id === activePhase.id))}
            totalPhases={phases.length}
            onUpdatePhase={(patch) => handleUpdatePhase(activePhase.id, patch)}
          />
        )}

        {/* Overview sections (shown after all phases confirmed, or always for context) */}
        <div className="space-y-4 px-6">
          {/* Fallbacks */}
          {config.fallbacks && config.fallbacks.length > 0 && (
            <OverviewSection title="异常情况怎么处理" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}>
              <div className="space-y-2">
                {config.fallbacks.map((fb: AgenticFallback, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs group/fb">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 shrink-0 ${FALLBACK_SEVERITY_STYLE[fb.severity]?.className || FALLBACK_SEVERITY_STYLE.info.className}`}
                    >
                      {FALLBACK_SEVERITY_STYLE[fb.severity]?.label || FALLBACK_SEVERITY_STYLE.info.label}
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

          {/* Reporting */}
          {config.reporting && (
            <OverviewSection title="记录与通知要求（可选）" icon={<Bell className="w-3.5 h-3.5 text-violet-500" />}>
              <div className="space-y-4 text-xs text-zinc-600">
                <p className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] leading-relaxed text-violet-700">
                  这里描述业务人员平时做这项工作时，哪些内容需要留痕、哪些情况要通知别人、后续要复盘什么；不是让业务方设计技术监控指标。
                </p>

                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-800">记录位置与记录文档</div>
                      <div className="mt-0.5 text-[10px] text-zinc-400">
                        可以补充工单字段说明、日报模板、复盘表或通知规范。
                      </div>
                    </div>
                    <div className="shrink-0">
                      <input
                        ref={reportingFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          handleReportingFiles(event.currentTarget.files);
                          event.currentTarget.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 rounded-full px-3 text-[10px]"
                        onClick={() => reportingFileInputRef.current?.click()}
                      >
                        <Upload className="h-3 w-3" /> 上传记录文档
                      </Button>
                    </div>
                  </div>
                  <div className="text-[11px] leading-relaxed text-zinc-500">
                    <EditableText
                      value={config.reporting.channel || "未指定"}
                      onSave={(v) => updateAgenticField("reporting", { ...config.reporting!, channel: v })}
                    />
                  </div>
                  {reportingFiles.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {reportingFiles.map((file) => (
                        <div
                          key={file.id}
                          className="group/file flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-500">
                            <FileText className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-medium text-zinc-700">{file.name}</div>
                            <div className="text-[10px] text-zinc-400">{formatFileSize(file.size)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateAgenticField("reporting", {
                              ...config.reporting!,
                              files: reportingFiles.filter((item) => item.id !== file.id),
                            })}
                            className="opacity-0 transition-opacity text-zinc-300 hover:text-red-400 group-hover/file:opacity-100"
                            title="移除文件"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {config.reporting.daily?.enabled && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="mb-1 text-[11px] font-semibold text-zinc-800">需要留痕的内容</div>
                    <div className="mb-2 text-[10px] text-zinc-400">
                      例如客户诉求、查询到的状态、采用的处理方式、客户是否接受、主管确认意见。
                    </div>
                    {config.reporting.daily.sampleContent && (
                      <div className="rounded-lg bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-600">
                        <EditableText
                          value={config.reporting.daily.sampleContent}
                          onSave={(v) => updateAgenticField("reporting", {
                            ...config.reporting!,
                            daily: { ...config.reporting!.daily, sampleContent: v },
                          })}
                          multiline
                        />
                      </div>
                    )}
                  </div>
                )}
                {config.reporting.alerts?.triggers?.length ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="mb-1 text-[11px] font-semibold text-zinc-800">需要通知的情况</div>
                    <div className="mb-2 text-[10px] text-zinc-400">
                      业务人员遇到这些情况时，通常要通知主管、专岗或相关系统负责人。
                    </div>
                    <EditableList
                      items={config.reporting.alerts.triggers.map((trigger) => (
                        typeof trigger === "string" ? trigger : trigger.condition
                      ))}
                      onSave={(items) => updateAgenticField("reporting", {
                        ...config.reporting!,
                        alerts: { triggers: items.map((condition) => ({ condition, severity: "warning" as const })) },
                      })}
                      placeholder="例如：客户连续表达不满、金额超过上限、系统查不到必要信息"
                    />
                  </div>
                ) : null}
                {config.reporting.weekly?.enabled && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="mb-1 text-[11px] font-semibold text-zinc-800">定期复盘的内容</div>
                    <div className="mb-2 text-[10px] text-zinc-400">
                      用来沉淀规则缺口、话术问题和需要补充的资料，不等于系统上线后的技术监控。
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-600">
                      <EditableText
                        value={config.reporting.weekly.content}
                        onSave={(v) => updateAgenticField("reporting", {
                          ...config.reporting!,
                          weekly: { ...config.reporting!.weekly, content: v },
                        })}
                        multiline
                      />
                    </div>
                    {config.reporting.weekly.sampleContent && (
                      <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/70 p-2 text-[11px] leading-relaxed text-zinc-500 whitespace-pre-line">
                        <div className="mb-1 text-[10px] font-medium text-zinc-400">复盘示例</div>
                        <EditableText
                          value={config.reporting.weekly.sampleContent}
                          onSave={(v) => updateAgenticField("reporting", {
                            ...config.reporting!,
                            weekly: { ...config.reporting!.weekly, sampleContent: v },
                          })}
                          multiline
                        />
                      </div>
                    )}
                  </div>
                )}
                {config.reporting.milestones?.length ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="mb-1 text-[11px] font-semibold text-zinc-800">阶段性确认事项</div>
                    <div className="mb-2 text-[10px] text-zinc-400">
                      这些是业务侧在试运行或交接前希望确认的事项。
                    </div>
                    <EditableList
                      items={config.reporting.milestones}
                      onSave={(items) => updateAgenticField("reporting", { ...config.reporting!, milestones: items })}
                      placeholder="例如：确认客服主管能看懂异常记录"
                    />
                  </div>
                ) : null}
              </div>
            </OverviewSection>
          )}

        </div>
      </div>
    </div>
  );
}
