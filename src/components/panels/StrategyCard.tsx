"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Target, ShieldCheck, BarChart3, Lock, Unlock,
  ChevronDown, ChevronRight, Zap, CheckCircle2,
  Clock, Settings, Send, ExternalLink, Check, Copy,
  FileText, Bell, Eye, Puzzle, AlertCircle,
  Info, AlertTriangle, Lightbulb, TrendingUp,
  RefreshCw, GitBranch, Database, Timer, ArrowRight,
  Pencil, Plus, Trash2, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  AgenticSectionId, AgenticSectionConfidence, AgenticConfirmItem,
  AgenticPermissionItem, AgenticApprovalItem, AgenticContentSample,
  AgenticRiskItem, AgenticDecisionLoop, AgenticSkillOrchestration,
  AgenticContextLayer, AgenticSchedule,
} from "@/lib/types";

const CONFIDENCE_BADGE: Record<string, { label: string; className: string; icon: string }> = {
  high: { label: "已确认", className: "bg-green-50 text-green-600 border-green-200", icon: "✅" },
  medium: { label: "待确认", className: "bg-amber-50 text-amber-600 border-amber-200", icon: "🟡" },
  low: { label: "需确认", className: "bg-red-50 text-red-600 border-red-200", icon: "🔴" },
};

const RISK_COLORS: Record<string, string> = {
  high: "text-red-600 bg-red-50 border-red-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-blue-600 bg-blue-50 border-blue-200",
};

function SectionHeader({ title, icon: Icon, confidence, expanded, onToggle }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  confidence?: AgenticSectionConfidence;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const conf = confidence ? CONFIDENCE_BADGE[confidence.confidence] : null;
  return (
    <button
      className="w-full flex items-center gap-2 py-3 hover:opacity-80 transition-opacity"
      onClick={onToggle}
    >
      <Icon className="w-4 h-4 text-violet-600 shrink-0" />
      <h3 className="text-sm font-semibold text-zinc-900 flex-1 text-left">{title}</h3>
      {conf && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${conf.className}`}>
          {conf.icon} {conf.label}
        </span>
      )}
      {onToggle && (
        expanded
          ? <ChevronDown className="w-4 h-4 text-zinc-400" />
          : <ChevronRight className="w-4 h-4 text-zinc-400" />
      )}
    </button>
  );
}

function InlineConfirmCard({ item, onConfirm, onSkip }: {
  item: AgenticConfirmItem;
  onConfirm: (answer: string) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const handleConfirm = () => {
    const answer = selected || custom.trim();
    if (!answer) return;
    onConfirm(answer);
  };

  return (
    <div className="mt-2 p-3 rounded-lg bg-amber-50/50 border border-amber-200">
      <p className="text-xs font-medium text-amber-800">{item.question}</p>
      {item.context && <p className="text-[10px] text-amber-600 mt-0.5">{item.context}</p>}
      {item.options && item.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => { setSelected(opt); setCustom(""); }}
              className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                selected === opt
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      <Textarea
        value={custom}
        onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
        placeholder="或输入自定义回答..."
        className="text-xs min-h-[32px] max-h-[60px] resize-none mt-2 bg-white"
      />
      <div className="flex justify-end gap-1.5 mt-2">
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-zinc-400" onClick={onSkip}>
          跳过
        </Button>
        <Button
          size="sm"
          className="h-6 text-[10px] px-3 bg-violet-600 hover:bg-violet-700"
          onClick={handleConfirm}
          disabled={!selected && !custom.trim()}
        >
          <Check className="w-3 h-3 mr-0.5" /> 确认
        </Button>
      </div>
    </div>
  );
}

function isPermissionItem(item: string | AgenticPermissionItem): item is AgenticPermissionItem {
  return typeof item === "object" && "action" in item;
}

function isApprovalItem(item: { trigger: string; description: string } | AgenticApprovalItem): item is AgenticApprovalItem {
  return "risk" in item;
}

function isStructuredTrigger(t: string | { condition: string; severity?: string }): t is { condition: string; severity?: string } {
  return typeof t === "object" && "condition" in t;
}

function EditableText({ value, onSave, multiline, className, placeholder }: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      ref: ref as never,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: save,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      },
      className: `text-xs border-violet-300 focus:ring-violet-400 ${className || ""}`,
      placeholder,
    };
    return multiline
      ? <Textarea {...shared} className={`${shared.className} min-h-[60px] resize-none`} />
      : <Input {...shared} />;
  }

  return (
    <span
      className={`group/edit cursor-pointer hover:bg-violet-50 hover:text-violet-700 rounded px-0.5 -mx-0.5 transition-colors ${className || ""}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="点击编辑"
    >
      {value}
      <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-0 group-hover/edit:opacity-50 transition-opacity" />
    </span>
  );
}

function EditableList({ items, onSave, className }: {
  items: string[];
  onSave: (items: string[]) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items);

  if (!editing) {
    return (
      <div className={`group/list ${className || ""}`}>
        {items.map((item, i) => (
          <p key={i} className="text-[11px] text-zinc-600">· {item}</p>
        ))}
        <button
          className="text-[10px] text-violet-500 opacity-0 group-hover/list:opacity-100 transition-opacity mt-1 flex items-center gap-0.5"
          onClick={() => { setDraft([...items]); setEditing(true); }}
        >
          <Pencil className="w-2.5 h-2.5" /> 编辑
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {draft.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            value={item}
            onChange={(e) => { const next = [...draft]; next[i] = e.target.value; setDraft(next); }}
            className="text-[11px] h-7 flex-1"
          />
          <button onClick={() => setDraft(draft.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-400">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5 mt-1">
        <button
          onClick={() => setDraft([...draft, ""])}
          className="text-[10px] text-violet-500 flex items-center gap-0.5"
        >
          <Plus className="w-3 h-3" /> 添加
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setEditing(false)}
          className="text-[10px] text-zinc-400 px-2 py-0.5"
        >
          取消
        </button>
        <button
          onClick={() => { onSave(draft.filter(d => d.trim())); setEditing(false); }}
          className="text-[10px] text-white bg-violet-600 hover:bg-violet-700 px-2 py-0.5 rounded"
        >
          保存
        </button>
      </div>
    </div>
  );
}

export default function StrategyCard() {
  const { agenticConfig, chatPhase, project, currentRole, updateAgenticField } = useFlowAgentStore();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showTechConfig, setShowTechConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmedSections, setConfirmedSections] = useState<Set<AgenticSectionId>>(new Set());
  const [activeQuestion, setActiveQuestion] = useState<{ section: AgenticSectionId; idx: number } | null>(null);
  const [showReportSample, setShowReportSample] = useState<string | null>(null);
  const [generatingTech, setGeneratingTech] = useState(false);
  const router = useRouter();

  const isReady = chatPhase === "agentic_ready";
  const isTech = currentRole === "tech";

  if (!agenticConfig) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        等待 AI 生成任务配置...
      </div>
    );
  }

  const gm = agenticConfig.goalMetrics;
  const rules = agenticConfig.executionRules || [];
  const perms = agenticConfig.permissions;
  const reporting = agenticConfig.reporting;
  const preview = agenticConfig.contentPreview;
  const sectionConf = agenticConfig.sectionConfidence || [];
  const risks = agenticConfig.riskAssessment || [];

  const getConfidence = (section: AgenticSectionId): AgenticSectionConfidence | undefined => {
    if (confirmedSections.has(section)) {
      return { section, confidence: "high", reason: "已确认", questions: [] };
    }
    return sectionConf.find((s) => s.section === section);
  };

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handleSectionConfirm = useCallback((section: AgenticSectionId, _answer: string) => {
    setConfirmedSections((prev) => new Set([...prev, section]));
    setActiveQuestion(null);
    toast.success(`${section === "goal" ? "目标" : section === "rules" ? "执行规则" : section === "permissions" ? "权限边界" : "汇报机制"}已确认`);
  }, []);

  const handleSectionSkip = useCallback((section: AgenticSectionId) => {
    setConfirmedSections((prev) => new Set([...prev, section]));
    setActiveQuestion(null);
  }, []);

  const handleGenerateTech = async () => {
    if (!agenticConfig) return;
    setGeneratingTech(true);
    try {
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_tech",
          currentConfig: agenticConfig,
          prompt: agenticConfig.goal,
        }),
        signal: AbortSignal.timeout(180000),
      });
      const result = await res.json();
      if (result.success && result.data) {
        const tech = result.data;
        if (tech.skills) updateAgenticField("skills", tech.skills);
        if (tech.evaluators) updateAgenticField("evaluators", tech.evaluators);
        if (tech.decisionLoop) updateAgenticField("decisionLoop", tech.decisionLoop);
        if (tech.skillOrchestration) updateAgenticField("skillOrchestration", tech.skillOrchestration);
        if (tech.contextArchitecture) updateAgenticField("contextArchitecture", tech.contextArchitecture);
        if (tech.schedule) updateAgenticField("schedule", tech.schedule);
        if (tech.humanCheckpoints) updateAgenticField("humanCheckpoints", tech.humanCheckpoints);
        if (tech.executionStrategy) updateAgenticField("executionStrategy", tech.executionStrategy);
        if (tech.maxIterations) updateAgenticField("maxIterations", tech.maxIterations);
        toast.success("技术配置已生成");
      } else {
        toast.error(result.error || "生成失败，请重试");
      }
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("aborted") ? "生成超时，请重试" : "网络错误";
      toast.error(msg);
    } finally {
      setGeneratingTech(false);
    }
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      useFlowAgentStore.getState().setProjectStatus("tech_reviewing");
      toast.success("已提交至管控后台");
    }, 1500);
  };

  const handleCopyJson = () => {
    const json = {
      agent_name: project.name || "未命名 Agent",
      goal: agenticConfig.goal,
      goalMetrics: agenticConfig.goalMetrics,
      executionRules: agenticConfig.executionRules,
      permissions: agenticConfig.permissions,
      reporting: agenticConfig.reporting,
      skills: agenticConfig.skills.map((s) => s.name),
      constraints: agenticConfig.constraints.map((c) => `${c.description}: ${c.value || ""}`),
    };
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allP0Confirmed = sectionConf
    .filter((s) => s.confidence === "low")
    .every((s) => confirmedSections.has(s.section));

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-100 bg-gradient-to-r from-violet-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Zap className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-zinc-900">策略方案</h2>
            <p className="text-xs text-zinc-400 mt-0.5">智能体模式 · 目标导向型任务</p>
          </div>
        </div>
        {(agenticConfig.estimatedDuration || agenticConfig.estimatedEfficiency) && (
          <div className="flex gap-3 mt-3">
            {agenticConfig.estimatedDuration && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Clock className="w-3.5 h-3.5" />
                预计周期：{agenticConfig.estimatedDuration}
              </div>
            )}
            {agenticConfig.estimatedEfficiency && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Zap className="w-3.5 h-3.5" />
                {agenticConfig.estimatedEfficiency}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* === 0. Execution Overview === */}
        {agenticConfig.executionOverview && (
          <div className="px-5 py-3 border-b border-zinc-100 bg-blue-50/30">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider mb-1">Agent 工作方式</p>
                <EditableText
                  value={agenticConfig.executionOverview}
                  onSave={(v) => updateAgenticField("executionOverview", v)}
                  multiline
                  className="text-xs text-zinc-700 leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}

        {/* === 1. Goal === */}
        <div className="px-5 py-3 border-b border-zinc-100">
          <SectionHeader title="目标" icon={Target} confidence={getConfidence("goal")} />
          {gm ? (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
                <EditableText
                  value={gm.core}
                  onSave={(v) => updateAgenticField("goalMetrics", { ...gm, core: v })}
                  multiline
                  className="text-sm font-medium text-violet-900"
                />
                {gm.coreReasoning && (
                  <div className="mt-2 flex items-start gap-1.5">
                    <Info className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                    <EditableText
                      value={gm.coreReasoning}
                      onSave={(v) => updateAgenticField("goalMetrics", { ...gm, coreReasoning: v })}
                      multiline
                      className="text-[11px] text-violet-600 leading-relaxed"
                    />
                  </div>
                )}
              </div>
              {gm.process.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">过程指标</p>
                  <EditableList
                    items={gm.process}
                    onSave={(items) => updateAgenticField("goalMetrics", { ...gm, process: items })}
                  />
                </div>
              )}
              {gm.baseline.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">底线指标</p>
                  <EditableList
                    items={gm.baseline}
                    onSave={(items) => updateAgenticField("goalMetrics", { ...gm, baseline: items })}
                  />
                </div>
              )}
              {gm.benchmarks && gm.benchmarks.length > 0 && (
                <div className="mt-1 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                  <p className="text-[10px] text-zinc-400 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> 行业参考
                  </p>
                  {gm.benchmarks.map((b, i) => (
                    <p key={i} className="text-[11px] text-zinc-600">{b}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-violet-50 border border-violet-100">
              <EditableText
                value={agenticConfig.goal}
                onSave={(v) => updateAgenticField("goal", v)}
                multiline
                className="text-sm font-medium text-violet-900 leading-relaxed"
              />
            </div>
          )}
          {agenticConfig.background && (
            <EditableText
              value={agenticConfig.background}
              onSave={(v) => updateAgenticField("background", v)}
              multiline
              className="text-xs text-zinc-500 mt-2 leading-relaxed"
            />
          )}
          {getConfidence("goal")?.confidence !== "high" && !confirmedSections.has("goal") && (
            activeQuestion?.section === "goal" ? (
              <InlineConfirmCard
                item={getConfidence("goal")!.questions[activeQuestion.idx]}
                onConfirm={(a) => handleSectionConfirm("goal", a)}
                onSkip={() => handleSectionSkip("goal")}
              />
            ) : (
              getConfidence("goal")?.questions.length ? (
                <button
                  onClick={() => setActiveQuestion({ section: "goal", idx: 0 })}
                  className="mt-2 text-[11px] text-amber-600 hover:text-amber-700 underline underline-offset-2"
                >
                  点击确认目标细节
                </button>
              ) : null
            )
          )}
        </div>

        {/* === 2. Execution Rules === */}
        <div className="px-5 py-3 border-b border-zinc-100">
          <SectionHeader title="执行规则" icon={FileText} confidence={getConfidence("rules")} />
          {rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((rg, i) => (
                <div key={i}>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">{rg.category}</p>
                  <EditableList
                    items={rg.rules}
                    onSave={(newRules) => {
                      const updated = rules.map((r2, i2) => i2 === i ? { ...r2, rules: newRules, source: "user_confirmed" as const } : r2);
                      updateAgenticField("executionRules", updated);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 py-2">AI 将根据你的描述推断执行规则</p>
          )}
          {getConfidence("rules")?.confidence !== "high" && !confirmedSections.has("rules") && (
            activeQuestion?.section === "rules" ? (
              <InlineConfirmCard
                item={getConfidence("rules")!.questions[activeQuestion.idx]}
                onConfirm={(a) => handleSectionConfirm("rules", a)}
                onSkip={() => handleSectionSkip("rules")}
              />
            ) : (
              getConfidence("rules")?.questions.length ? (
                <button
                  onClick={() => setActiveQuestion({ section: "rules", idx: 0 })}
                  className="mt-2 text-[11px] text-amber-600 hover:text-amber-700 underline underline-offset-2"
                >
                  点击确认规则细节
                </button>
              ) : null
            )
          )}
        </div>

        {/* === 3. Permissions === */}
        <div className="px-5 py-3 border-b border-zinc-100">
          <SectionHeader title="权限边界" icon={Lock} confidence={getConfidence("permissions")} />
          {perms ? (
            <div className="space-y-2">
              {perms.autonomous.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> 可自主决定
                  </p>
                  <div className="space-y-1">
                    {perms.autonomous.map((a, i) => {
                      const item = isPermissionItem(a) ? a : { action: a };
                      return (
                        <div key={i} className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                          <span className="text-[11px] text-green-700">{item.action}</span>
                          {item.reason && (
                            <p className="text-[10px] text-green-600/70 mt-0.5">{item.reason}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {perms.needApproval.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> 需审批
                  </p>
                  <div className="space-y-1">
                    {perms.needApproval.map((na, i) => {
                      const item = isApprovalItem(na) ? na : { ...na, risk: "medium" as const };
                      return (
                        <div key={i} className="px-3 py-2 rounded-lg bg-red-50/50 border border-red-100">
                          <div className="flex items-start gap-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5 ${RISK_COLORS[item.risk]}`}>
                              {item.risk === "high" ? "高风险" : item.risk === "medium" ? "中风险" : "低风险"}
                            </span>
                            <div className="flex-1">
                              <span className="text-xs text-zinc-700">{item.description}</span>
                              <span className="text-[10px] text-zinc-400 ml-1">({item.trigger})</span>
                              {isApprovalItem(na) && na.consequence && (
                                <p className="text-[10px] text-red-500 mt-0.5 flex items-start gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                                  {na.consequence}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {perms.safeguards.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> 兜底机制
                  </p>
                  <EditableList
                    items={perms.safeguards}
                    onSave={(items) => updateAgenticField("permissions", { ...perms, safeguards: items })}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 py-2">权限边界将在确认后生成</p>
          )}
          {getConfidence("permissions")?.confidence !== "high" && !confirmedSections.has("permissions") && (
            activeQuestion?.section === "permissions" ? (
              <InlineConfirmCard
                item={getConfidence("permissions")!.questions[activeQuestion.idx]}
                onConfirm={(a) => handleSectionConfirm("permissions", a)}
                onSkip={() => handleSectionSkip("permissions")}
              />
            ) : (
              getConfidence("permissions")?.questions.length ? (
                <button
                  onClick={() => setActiveQuestion({ section: "permissions", idx: 0 })}
                  className="mt-2 text-[11px] text-red-600 hover:text-red-700 underline underline-offset-2 font-medium"
                >
                  点击确认权限边界（必须）
                </button>
              ) : null
            )
          )}
        </div>

        {/* === 4. Reporting === */}
        <div className="px-5 py-3 border-b border-zinc-100">
          <SectionHeader title="反馈与汇报" icon={Bell} confidence={getConfidence("reporting")} />
          {reporting ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2.5 rounded-lg border ${reporting.daily.enabled ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-50"}`}>
                  <p className="text-[10px] font-medium text-zinc-500">日报</p>
                  <p className="text-xs text-zinc-700 mt-0.5">{reporting.daily.auto ? "自动生成" : "手动触发"}</p>
                  {reporting.daily.sampleContent && (
                    <button
                      onClick={() => setShowReportSample(showReportSample === "daily" ? null : "daily")}
                      className="text-[10px] text-violet-500 hover:text-violet-600 mt-1 underline underline-offset-2"
                    >
                      {showReportSample === "daily" ? "收起示例" : "查看示例"}
                    </button>
                  )}
                </div>
                <div className={`p-2.5 rounded-lg border ${reporting.weekly.enabled ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-50"}`}>
                  <p className="text-[10px] font-medium text-zinc-500">周报</p>
                  <p className="text-xs text-zinc-700 mt-0.5">{reporting.weekly.content || "需阅读"}</p>
                  {reporting.weekly.sampleContent && (
                    <button
                      onClick={() => setShowReportSample(showReportSample === "weekly" ? null : "weekly")}
                      className="text-[10px] text-violet-500 hover:text-violet-600 mt-1 underline underline-offset-2"
                    >
                      {showReportSample === "weekly" ? "收起示例" : "查看示例"}
                    </button>
                  )}
                </div>
              </div>
              {showReportSample === "daily" && reporting.daily.sampleContent && (
                <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-200">
                  <p className="text-[10px] font-medium text-violet-500 mb-1">日报示例</p>
                  <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">{reporting.daily.sampleContent}</p>
                </div>
              )}
              {showReportSample === "weekly" && reporting.weekly.sampleContent && (
                <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-200">
                  <p className="text-[10px] font-medium text-violet-500 mb-1">周报示例</p>
                  <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">{reporting.weekly.sampleContent}</p>
                </div>
              )}
              {(() => {
                const triggers = reporting.alerts.triggers;
                if (!triggers || triggers.length === 0) return null;
                return (
                  <div className="p-2.5 rounded-lg border border-red-100 bg-red-50/30">
                    <p className="text-[10px] font-medium text-red-500 mb-1">告警触发</p>
                    {triggers.map((t, i) => {
                      if (isStructuredTrigger(t)) {
                        const sevColors: Record<string, string> = {
                          critical: "text-red-600",
                          warning: "text-amber-600",
                          info: "text-blue-600",
                        };
                        return (
                          <div key={i} className="flex items-center gap-1.5 text-xs mb-0.5">
                            <span className={sevColors[t.severity || "warning"] || "text-red-600"}>
                              {t.severity === "critical" ? "🚨" : t.severity === "info" ? "ℹ️" : "⚠️"}
                            </span>
                            <span className="text-zinc-700">{t.condition}</span>
                            {t.severity && (
                              <span className={`text-[9px] px-1 py-0.5 rounded ${sevColors[t.severity]} bg-white/50`}>
                                {t.severity === "critical" ? "严重" : t.severity === "warning" ? "警告" : "提示"}
                              </span>
                            )}
                          </div>
                        );
                      }
                      return <p key={i} className="text-xs text-red-600">🚨 {t}</p>;
                    })}
                  </div>
                );
              })()}
              {reporting.milestones.length > 0 && (
                <div className="p-2.5 rounded-lg border border-zinc-200">
                  <p className="text-[10px] font-medium text-zinc-500 mb-1">里程碑</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reporting.milestones.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-violet-50 text-[10px] text-violet-600 border border-violet-200">
                        🏁 {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {reporting.channel && (
                <p className="text-[10px] text-zinc-400">汇报渠道：{reporting.channel}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 py-2">汇报机制将在确认后生成</p>
          )}
          {getConfidence("reporting")?.confidence !== "high" && !confirmedSections.has("reporting") && (
            activeQuestion?.section === "reporting" ? (
              <InlineConfirmCard
                item={getConfidence("reporting")!.questions[activeQuestion.idx]}
                onConfirm={(a) => handleSectionConfirm("reporting", a)}
                onSkip={() => handleSectionSkip("reporting")}
              />
            ) : (
              getConfidence("reporting")?.questions.length ? (
                <button
                  onClick={() => setActiveQuestion({ section: "reporting", idx: 0 })}
                  className="mt-2 text-[11px] text-amber-600 hover:text-amber-700 underline underline-offset-2"
                >
                  点击确认汇报偏好
                </button>
              ) : null
            )
          )}
        </div>

        {/* === 5. Content Preview === */}
        {preview && preview.samples.length > 0 && (
          <div className="px-5 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2 py-2">
              <Eye className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-zinc-900">内容预览</h3>
              <span className="text-[10px] text-zinc-400 ml-auto">Agent 示例产出</span>
            </div>
            {preview.generationLogic && (
              <div className="flex items-start gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-blue-50/50">
                <Lightbulb className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-600">{preview.generationLogic}</p>
              </div>
            )}
            <div className="space-y-1.5">
              {preview.samples.map((s: AgenticContentSample, i: number) => (
                <div key={i} className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 hover:bg-zinc-100/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">📝</span>
                    <span className="text-xs font-medium text-zinc-800 flex-1 line-clamp-1">{s.title}</span>
                    <Badge variant="outline" className="text-[9px] h-4 shrink-0">{s.type}</Badge>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{s.summary}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {s.tags && s.tags.length > 0 && (
                      <div className="flex gap-1">
                        {s.tags.map((tag, ti) => (
                          <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-500 border border-violet-100">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.expectedMetrics && (
                      <span className="text-[9px] text-green-600 ml-auto flex items-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5" />
                        {s.expectedMetrics}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === 6. Risk Assessment === */}
        {risks.length > 0 && (
          <div className="px-5 py-3 border-b border-zinc-100">
            <SectionHeader
              title="风险评估"
              icon={AlertTriangle}
              expanded={expandedSection === "risks"}
              onToggle={() => toggleSection("risks")}
            />
            {expandedSection === "risks" && (
              <div className="space-y-1.5 pb-1">
                {risks.map((r: AgenticRiskItem, i: number) => (
                  <div key={i} className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50">
                    <div className="flex items-start gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5 ${RISK_COLORS[r.likelihood]}`}>
                        {r.likelihood === "high" ? "高概率" : r.likelihood === "medium" ? "中概率" : "低概率"}
                      </span>
                      <span className="text-xs text-zinc-700">{r.risk}</span>
                    </div>
                    <div className="flex items-start gap-1.5 mt-1.5 ml-1">
                      <ShieldCheck className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-green-700">{r.mitigation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === Tech Config (collapsed) === */}
        {(() => {
          const hasTechContent = agenticConfig.skills.length > 0 || agenticConfig.decisionLoop || agenticConfig.schedule;
          const techSummary = hasTechContent
            ? `${agenticConfig.skills.length} 技能 · ${agenticConfig.evaluators.length} 评估器`
            : "业务确认后生成";
          return (
            <button
              className="w-full px-5 py-3 flex items-center gap-2 hover:bg-zinc-50 transition-colors text-zinc-400 border-b border-zinc-100"
              onClick={() => setShowTechConfig(!showTechConfig)}
            >
              <Settings className="w-4 h-4" />
              <span className="text-xs font-medium flex-1 text-left">
                {showTechConfig ? "收起技术配置" : "技术配置"}
              </span>
              <span className="text-[10px] mr-1">{techSummary}</span>
              {showTechConfig ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          );
        })()}
        {showTechConfig && (
          <div className="px-5 py-3 space-y-4 border-b border-zinc-100">
            {agenticConfig.skills.length === 0 && !agenticConfig.decisionLoop && (
              <div className="text-center py-6">
                <Settings className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">业务策略确认后，可生成对应的技术实现方案</p>
                <p className="text-[10px] text-zinc-300 mt-1">包含：技能编排、决策循环、上下文架构、触发调度</p>
                <Button
                  className="mt-3 bg-violet-600 hover:bg-violet-700 text-xs h-8 px-4"
                  onClick={handleGenerateTech}
                  disabled={generatingTech}
                >
                  {generatingTech ? (
                    <>
                      <div className="w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      正在生成...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      生成技术配置
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Decision Loop */}
            {agenticConfig.decisionLoop && (
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 决策循环
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["observe", "evaluate", "act", "feedback"] as const).map((phase) => {
                    const items = agenticConfig.decisionLoop![phase];
                    if (!items || items.length === 0) return null;
                    const labels: Record<string, { label: string; color: string; icon: string }> = {
                      observe: { label: "观察", color: "blue", icon: "👁" },
                      evaluate: { label: "判断", color: "amber", icon: "🧠" },
                      act: { label: "行动", color: "green", icon: "⚡" },
                      feedback: { label: "反馈", color: "violet", icon: "🔄" },
                    };
                    const cfg = labels[phase];
                    return (
                      <div key={phase} className={`p-2 rounded-lg border border-${cfg.color}-100 bg-${cfg.color}-50/30`}>
                        <p className={`text-[10px] font-medium text-${cfg.color}-600 mb-1`}>{cfg.icon} {cfg.label}</p>
                        {items.map((item, i) => (
                          <p key={i} className="text-[10px] text-zinc-600 leading-relaxed">· {item}</p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skill Orchestration */}
            {agenticConfig.skillOrchestration && (
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <GitBranch className="w-3 h-3" /> Skill 编排
                </p>
                {agenticConfig.skillOrchestration.dependencies.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <p className="text-[9px] text-zinc-400">数据流向</p>
                    {agenticConfig.skillOrchestration.dependencies.map((dep, i) => {
                      const fromSkill = agenticConfig.skills.find(s => s.id === dep.from);
                      const toSkill = agenticConfig.skills.find(s => s.id === dep.to);
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-50 border border-zinc-100">
                          <span className="text-[10px] text-blue-600 font-medium">{fromSkill?.name || dep.from}</span>
                          <ArrowRight className="w-3 h-3 text-zinc-400" />
                          <span className="text-[10px] text-green-600 font-medium">{toSkill?.name || dep.to}</span>
                          <span className="text-[9px] text-zinc-400 ml-auto">{dep.dataFlow}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {agenticConfig.skillOrchestration.parallelGroups && agenticConfig.skillOrchestration.parallelGroups.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[9px] text-zinc-400 mb-1">并行分组</p>
                    <div className="flex flex-wrap gap-1.5">
                      {agenticConfig.skillOrchestration.parallelGroups.map((group, gi) => (
                        <div key={gi} className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 border border-violet-200">
                          {group.map((sid, si) => {
                            const sk = agenticConfig.skills.find(s => s.id === sid);
                            return (
                              <span key={si} className="text-[10px] text-violet-700">
                                {si > 0 && <span className="text-violet-400 mx-0.5">∥</span>}
                                {sk?.name || sid}
                              </span>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {agenticConfig.skillOrchestration.failurePolicy.length > 0 && (
                  <div>
                    <p className="text-[9px] text-zinc-400 mb-1">失败策略</p>
                    <div className="space-y-1">
                      {agenticConfig.skillOrchestration.failurePolicy.map((fp, i) => {
                        const sk = agenticConfig.skills.find(s => s.id === fp.skillId);
                        const actionLabels: Record<string, { label: string; color: string }> = {
                          retry: { label: "重试", color: "text-blue-600 bg-blue-50" },
                          skip: { label: "跳过", color: "text-amber-600 bg-amber-50" },
                          abort: { label: "终止", color: "text-red-600 bg-red-50" },
                          fallback: { label: "降级", color: "text-violet-600 bg-violet-50" },
                        };
                        const ac = actionLabels[fp.action] || actionLabels.retry;
                        return (
                          <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-50 border border-zinc-100 text-[10px]">
                            <span className="text-zinc-700">{sk?.name || fp.skillId}</span>
                            <span className={`px-1.5 py-0.5 rounded ${ac.color}`}>{ac.label}{fp.maxRetries ? ` ×${fp.maxRetries}` : ""}</span>
                            {fp.fallbackSkillId && (
                              <span className="text-zinc-400">→ {agenticConfig.skills.find(s => s.id === fp.fallbackSkillId)?.name || fp.fallbackSkillId}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Context Architecture */}
            {agenticConfig.contextArchitecture && (
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Database className="w-3 h-3" /> 上下文架构
                </p>
                <div className="space-y-2">
                  {agenticConfig.contextArchitecture.shortTerm.length > 0 && (
                    <div className="p-2 rounded-lg border border-blue-100 bg-blue-50/30">
                      <p className="text-[9px] font-medium text-blue-500 mb-1">短期记忆（运行时）</p>
                      {agenticConfig.contextArchitecture.shortTerm.map((item, i) => (
                        <p key={i} className="text-[10px] text-zinc-600">· {item}</p>
                      ))}
                    </div>
                  )}
                  {agenticConfig.contextArchitecture.longTerm.length > 0 && (
                    <div className="p-2 rounded-lg border border-violet-100 bg-violet-50/30">
                      <p className="text-[9px] font-medium text-violet-500 mb-1">长期记忆（持久化）</p>
                      {agenticConfig.contextArchitecture.longTerm.map((item, i) => (
                        <p key={i} className="text-[10px] text-zinc-600">· {item}</p>
                      ))}
                    </div>
                  )}
                  {agenticConfig.contextArchitecture.external && agenticConfig.contextArchitecture.external.length > 0 && (
                    <div className="p-2 rounded-lg border border-amber-100 bg-amber-50/30">
                      <p className="text-[9px] font-medium text-amber-500 mb-1">外部上下文</p>
                      {agenticConfig.contextArchitecture.external.map((item, i) => (
                        <p key={i} className="text-[10px] text-zinc-600">· {item}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Schedule */}
            {agenticConfig.schedule && (
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Timer className="w-3 h-3" /> 触发与调度
                </p>
                <div className="space-y-1">
                  {agenticConfig.schedule.triggers.map((trigger, i) => {
                    const typeLabels: Record<string, { label: string; color: string }> = {
                      cron: { label: "定时", color: "text-blue-600 bg-blue-50 border-blue-200" },
                      event: { label: "事件", color: "text-green-600 bg-green-50 border-green-200" },
                      threshold: { label: "阈值", color: "text-amber-600 bg-amber-50 border-amber-200" },
                    };
                    const tc = typeLabels[trigger.type] || typeLabels.cron;
                    return (
                      <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-100">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${tc.color}`}>{tc.label}</span>
                        <div className="flex-1">
                          <p className="text-[10px] text-zinc-700">{trigger.description}</p>
                          <p className="text-[9px] text-zinc-400 font-mono">{trigger.config}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {agenticConfig.schedule.cooldown && (
                  <p className="text-[9px] text-zinc-400 mt-1">冷却间隔：{agenticConfig.schedule.cooldown}</p>
                )}
              </div>
            )}

            {/* Skills */}
            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Puzzle className="w-3 h-3" /> 可用技能
              </p>
              <div className="space-y-2">
                {agenticConfig.skills.map((skill, idx) => (
                  <div key={skill.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                        {idx + 1}
                      </div>
                      <span className="text-xs font-medium text-zinc-800">{skill.name}</span>
                      <span className="text-[9px] text-zinc-400 ml-auto font-mono">{skill.id}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mb-2">{skill.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-zinc-400 mb-1">输入</p>
                        {skill.inputs.map((inp, i) => (
                          <span key={i} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                            {inp.name}
                          </span>
                        ))}
                      </div>
                      <div>
                        <p className="text-zinc-400 mb-1">输出</p>
                        {skill.outputs.map((out, i) => (
                          <span key={i} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                            {out.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    {skill.evaluator && (
                      <p className="text-[10px] text-zinc-400 mt-2 pt-2 border-t border-zinc-100">
                        工具级评估：{skill.evaluator}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Evaluators */}
            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> 目标级评估器
              </p>
              {agenticConfig.evaluators.map((ev) => (
                <div key={ev.id} className="rounded-lg border border-zinc-200 overflow-hidden mb-2">
                  <div className="px-3 py-2 bg-zinc-50">
                    <p className="text-xs font-medium text-zinc-800">{ev.name}</p>
                    <p className="text-[10px] text-zinc-400">{ev.description}</p>
                  </div>
                  <div className="px-3 py-2 space-y-1.5">
                    {ev.metrics.map((m, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-600">{m.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4">{m.threshold}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Execution params */}
            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">执行参数</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                  <p className="text-zinc-400">执行策略</p>
                  <p className="text-zinc-700 font-medium mt-0.5">
                    {agenticConfig.executionStrategy === "adaptive" ? "自适应" :
                     agenticConfig.executionStrategy === "parallel" ? "并行" : "顺序"}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                  <p className="text-zinc-400">最大迭代</p>
                  <p className="text-zinc-700 font-medium mt-0.5">{agenticConfig.maxIterations} 轮</p>
                </div>
              </div>
            </div>

            {/* Human checkpoints */}
            {agenticConfig.humanCheckpoints.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">人工检查点</p>
                <EditableList
                  items={agenticConfig.humanCheckpoints}
                  onSave={(items) => updateAgenticField("humanCheckpoints", items)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {isReady && !submitted && (
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50">
          {isTech ? (
            <p className="text-[11px] text-zinc-500 text-center">
              技术评审：确认技能可行性、约束合理性后，点击顶部「评审通过」提交
            </p>
          ) : !allP0Confirmed && sectionConf.some((s) => s.confidence === "low") ? (
            <p className="text-[11px] text-red-500 text-center">
              请先确认标记为 🔴 的必填区域
            </p>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700 text-sm h-9"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    正在提交...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    提交至管控后台
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {submitted && (
        <div className="px-5 py-3 border-t border-zinc-100 bg-green-50 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已提交，等待技术方评审
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-xs h-8 border-green-200 text-green-700" onClick={handleCopyJson}>
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "已复制" : "复制配置"}
            </Button>
            <Button variant="outline" className="flex-1 text-xs h-8" onClick={() => router.push("/console/agents")}>
              <ExternalLink className="w-3 h-3 mr-1" />
              管控后台
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
