"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFlowAgentStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Target, Puzzle, ShieldCheck, BarChart3,
  ChevronRight, Clock, DollarSign, CheckCircle2,
  AlertTriangle, Zap, Users, Settings, Layers,
  Pencil, X, Check, Trash2, Plus, Rocket,
  Store, Search,
} from "lucide-react";
import type {
  AgenticConstraintType, AgenticExecutionStrategy,
  AgenticSkill, AgenticEvaluator, AgenticEvaluatorMetric,
} from "@/lib/types";
import { MOCK_MARKET_SKILLS, type MarketSkill } from "@/lib/mock-console";
import { v4 as uuidv4 } from "uuid";

type TabId = "goal" | "skills" | "constraints" | "evaluators";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "goal", label: "目标与背景", icon: Target },
  { id: "skills", label: "技能配置", icon: Puzzle },
  { id: "constraints", label: "约束条件", icon: ShieldCheck },
  { id: "evaluators", label: "评估体系", icon: BarChart3 },
];

const CONSTRAINT_ICONS: Record<AgenticConstraintType, React.ComponentType<{ className?: string }>> = {
  budget: DollarSign,
  time: Clock,
  quality: CheckCircle2,
  compliance: ShieldCheck,
  custom: Settings,
};

const CONSTRAINT_LABELS: Record<AgenticConstraintType, string> = {
  budget: "预算",
  time: "时间",
  quality: "质量",
  compliance: "合规",
  custom: "自定义",
};

const STRATEGY_LABELS: Record<AgenticExecutionStrategy, { label: string; desc: string }> = {
  sequential: { label: "顺序执行", desc: "技能按顺序依次执行" },
  parallel: { label: "并行执行", desc: "技能尽可能并行执行" },
  adaptive: { label: "自适应", desc: "AI 根据情况动态决定执行顺序" },
};

export default function AgenticConfigPanel() {
  const { agenticConfig, chatPhase, project, taskType, originalPrompt } = useFlowAgentStore();
  const [activeTab, setActiveTab] = useState<TabId>("goal");
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const router = useRouter();

  const isReady = chatPhase === "agentic_ready";

  if (!agenticConfig) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        等待 AI 生成任务配置...
      </div>
    );
  }

  const strategyInfo = STRATEGY_LABELS[agenticConfig.executionStrategy] || STRATEGY_LABELS.adaptive;

  const handleDeploy = () => {
    setDeploying(true);
    setTimeout(() => {
      setDeploying(false);
      setDeployed(true);
    }, 1500);
  };

  const handleGoToConsole = () => {
    router.push("/console/agents");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Agent 任务配置</h2>
            <p className="text-[11px] text-zinc-400">智能体模式 · 目标导向</p>
          </div>
          <Badge className="ml-auto text-[10px] h-5 bg-violet-50 text-violet-700 border-0">
            {strategyInfo.label}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-100">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
                ${isActive
                  ? "text-violet-600 border-b-2 border-violet-600"
                  : "text-zinc-400 hover:text-zinc-600"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "goal" && <GoalTab editable={isReady} />}
        {activeTab === "skills" && <SkillsTab editable={isReady} />}
        {activeTab === "constraints" && <ConstraintsTab editable={isReady} />}
        {activeTab === "evaluators" && <EvaluatorsTab editable={isReady} />}
      </div>

      {/* Deploy footer */}
      {isReady && (
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50">
          {deployed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">已部署为「{project.name || "Agent"}」</span>
              </div>
              <Button variant="outline" className="w-full text-sm h-9" onClick={handleGoToConsole}>
                前往管控后台查看
              </Button>
            </div>
          ) : (
            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 text-sm h-9"
              onClick={handleDeploy}
              disabled={deploying}
            >
              {deploying ? (
                <>
                  <div className="w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  部署中...
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />
                  部署为 Agent
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Goal Tab (editable)
// ============================================================

function GoalTab({ editable }: { editable: boolean }) {
  const { agenticConfig, updateAgenticGoal, updateAgenticBackground, setAgenticConfig } = useFlowAgentStore();
  const [editingField, setEditingField] = useState<"goal" | "background" | null>(null);
  const [draft, setDraft] = useState("");

  if (!agenticConfig) return null;

  const strategyInfo = STRATEGY_LABELS[agenticConfig.executionStrategy] || STRATEGY_LABELS.adaptive;

  const startEdit = (field: "goal" | "background") => {
    setEditingField(field);
    setDraft(field === "goal" ? agenticConfig.goal : agenticConfig.background);
  };

  const saveEdit = () => {
    if (!editingField) return;
    if (editingField === "goal") updateAgenticGoal(draft);
    else if (editingField === "background") updateAgenticBackground(draft);
    setEditingField(null);
  };

  const cancelEdit = () => { setEditingField(null); setDraft(""); };

  const cycleStrategy = () => {
    const strategies: AgenticExecutionStrategy[] = ["sequential", "parallel", "adaptive"];
    const idx = strategies.indexOf(agenticConfig.executionStrategy);
    setAgenticConfig({ ...agenticConfig, executionStrategy: strategies[(idx + 1) % strategies.length] });
  };

  return (
    <div className="space-y-5">
      <EditableSection
        label="业务目标"
        value={agenticConfig.goal}
        editable={editable}
        editing={editingField === "goal"}
        onStartEdit={() => startEdit("goal")}
        onSave={saveEdit}
        onCancel={cancelEdit}
        draft={draft}
        onDraftChange={setDraft}
        highlight
      />
      <EditableSection
        label="业务背景"
        value={agenticConfig.background}
        editable={editable}
        editing={editingField === "background"}
        onStartEdit={() => startEdit("background")}
        onSave={saveEdit}
        onCancel={cancelEdit}
        draft={draft}
        onDraftChange={setDraft}
      />

      <div>
        <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">执行策略</label>
        <button
          onClick={editable ? cycleStrategy : undefined}
          disabled={!editable}
          className={`mt-2 w-full p-3.5 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center gap-3 text-left
            ${editable ? "hover:border-violet-200 hover:bg-violet-50/30 cursor-pointer transition-colors" : ""}`}
        >
          <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-zinc-700">{strategyInfo.label}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{strategyInfo.desc}</p>
          </div>
          {editable && <Pencil className="w-3 h-3 text-zinc-300 ml-auto shrink-0" />}
        </button>
      </div>

      {agenticConfig.humanCheckpoints.length > 0 && (
        <div>
          <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">人工确认节点</label>
          <div className="mt-2 space-y-1.5">
            {agenticConfig.humanCheckpoints.map((cp, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-700">{cp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-2 text-xs text-zinc-400">
        <span>最大迭代次数：{agenticConfig.maxIterations}</span>
      </div>
    </div>
  );
}

function EditableSection({ label, value, editable, editing, onStartEdit, onSave, onCancel, draft, onDraftChange, highlight }: {
  label: string; value: string; editable: boolean; editing: boolean;
  onStartEdit: () => void; onSave: () => void; onCancel: () => void;
  draft: string; onDraftChange: (v: string) => void; highlight?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
        {editable && !editing && (
          <button onClick={onStartEdit} className="text-zinc-400 hover:text-violet-600 transition-colors"><Pencil className="w-3 h-3" /></button>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <Textarea value={draft} onChange={(e) => onDraftChange(e.target.value)} className="text-sm min-h-[60px]" autoFocus />
          <div className="flex gap-1.5 mt-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancel}><X className="w-3 h-3" /></Button>
            <Button size="sm" className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700" onClick={onSave}><Check className="w-3 h-3" /></Button>
          </div>
        </div>
      ) : (
        <div className={`mt-2 p-3.5 rounded-xl border ${highlight ? "bg-violet-50 border-violet-100" : "bg-zinc-50 border-zinc-100"}`}>
          <p className={`text-sm leading-relaxed ${highlight ? "text-violet-900 font-medium" : "text-zinc-600"}`}>{value}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Skills Tab (editable + skill market)
// ============================================================

function SkillsTab({ editable }: { editable: boolean }) {
  const { agenticConfig, removeAgenticSkill, addAgenticSkill } = useFlowAgentStore();
  const [showMarket, setShowMarket] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");

  if (!agenticConfig) return null;

  const existingSkillNames = new Set(agenticConfig.skills.map((s) => s.name));

  const filteredMarketSkills = MOCK_MARKET_SKILLS.filter((ms) => {
    if (existingSkillNames.has(ms.name)) return false;
    if (!marketSearch.trim()) return true;
    return ms.name.includes(marketSearch) || ms.description.includes(marketSearch);
  });

  const handleAddFromMarket = (ms: MarketSkill) => {
    const skill: AgenticSkill = {
      id: `sk-${uuidv4().slice(0, 8)}`,
      name: ms.name,
      description: ms.description,
      inputs: ms.inputs,
      outputs: ms.outputs,
      evaluator: ms.evaluator,
    };
    addAgenticSkill(skill);
  };

  const handleAddCustom = () => {
    addAgenticSkill({
      id: `sk-${uuidv4().slice(0, 8)}`,
      name: "新技能",
      description: "请描述这个技能的功能",
      inputs: [{ name: "输入", type: "text" }],
      outputs: [{ name: "输出", type: "text" }],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">共 {agenticConfig.skills.length} 个技能</p>
        {editable && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setShowMarket(!showMarket)}>
              <Store className="w-3 h-3 mr-0.5" /> 技能市场
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={handleAddCustom}>
              <Plus className="w-3 h-3 mr-0.5" /> 自定义
            </Button>
          </div>
        )}
      </div>

      {/* Skill market panel */}
      {showMarket && (
        <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Store className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">从技能市场选择</span>
            <button onClick={() => setShowMarket(false)} className="ml-auto text-zinc-400 hover:text-zinc-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
            <Input
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder="搜索技能..."
              className="text-xs h-7 pl-7"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-1.5">
            {filteredMarketSkills.map((ms) => (
              <button
                key={ms.id}
                onClick={() => handleAddFromMarket(ms)}
                className="w-full text-left p-2.5 rounded-lg border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-800">{ms.name}</span>
                  <Badge variant="outline" className="text-[9px] h-3.5">
                    {ms.category === "general" ? "通用" : ms.category === "industry" ? "行业" : "定制"}
                  </Badge>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{ms.description}</p>
                <div className="flex gap-3 mt-1 text-[9px] text-zinc-400">
                  <span>调用 {ms.callCount.toLocaleString()} 次</span>
                  <span>均耗时 {ms.avgDuration}</span>
                </div>
              </button>
            ))}
            {filteredMarketSkills.length === 0 && (
              <p className="text-center text-xs text-zinc-400 py-3">没有匹配的技能</p>
            )}
          </div>
        </div>
      )}

      {/* Existing skills */}
      {agenticConfig.skills.map((skill, idx) => (
        <div key={skill.id} className="rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-zinc-900">{skill.name}</h4>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{skill.description}</p>
            </div>
            {editable && (
              <button onClick={() => removeAgenticSkill(skill.id)} className="text-zinc-300 hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">输入</p>
                <div className="flex flex-wrap gap-1">
                  {skill.inputs.map((inp, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs">
                      {inp.name}<span className="text-blue-400 text-[10px]">{inp.type}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center"><ChevronRight className="w-3.5 h-3.5 text-zinc-300" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">输出</p>
                <div className="flex flex-wrap gap-1">
                  {skill.outputs.map((out, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs">
                      {out.name}<span className="text-green-400 text-[10px]">{out.type}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {skill.evaluator && (
              <div className="pt-2 border-t border-zinc-100">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">评估标准</p>
                <p className="text-xs text-zinc-500">{skill.evaluator}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Constraints Tab (editable)
// ============================================================

function ConstraintsTab({ editable }: { editable: boolean }) {
  const { agenticConfig, removeAgenticConstraint, addAgenticConstraint } = useFlowAgentStore();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<AgenticConstraintType>("custom");
  const [newDesc, setNewDesc] = useState("");
  const [newValue, setNewValue] = useState("");

  if (!agenticConfig) return null;

  const handleAdd = () => {
    if (!newDesc.trim()) return;
    addAgenticConstraint({
      id: `c-${uuidv4().slice(0, 8)}`,
      type: newType,
      description: newDesc.trim(),
      value: newValue.trim() || undefined,
    });
    setAdding(false);
    setNewDesc("");
    setNewValue("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">共 {agenticConfig.constraints.length} 项约束条件</p>
        {editable && !adding && (
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3 mr-0.5" /> 添加约束
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border-2 border-dashed border-violet-200 p-3.5 space-y-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as AgenticConstraintType)}
            className="text-xs border border-zinc-200 rounded-md px-2 py-1"
          >
            {Object.entries(CONSTRAINT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Input placeholder="约束描述" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-xs h-8" />
          <Input placeholder="具体标准（可选）" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="text-xs h-8" />
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setAdding(false)}>取消</Button>
            <Button size="sm" className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700" onClick={handleAdd} disabled={!newDesc.trim()}>添加</Button>
          </div>
        </div>
      )}

      {agenticConfig.constraints.map((constraint) => {
        const Icon = CONSTRAINT_ICONS[constraint.type] || Settings;
        const typeLabel = CONSTRAINT_LABELS[constraint.type] || constraint.type;
        return (
          <div key={constraint.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className="text-[10px] h-4">{typeLabel}</Badge>
              <p className="text-sm text-zinc-700 mt-1">{constraint.description}</p>
              {constraint.value && <p className="text-xs text-zinc-400 mt-1">标准：{constraint.value}</p>}
            </div>
            {editable && (
              <button onClick={() => removeAgenticConstraint(constraint.id)} className="text-zinc-300 hover:text-red-500 transition-colors shrink-0 mt-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Evaluators Tab (full CRUD)
// ============================================================

function EvaluatorsTab({ editable }: { editable: boolean }) {
  const { agenticConfig, removeAgenticEvaluator, updateAgenticEvaluator } = useFlowAgentStore();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New evaluator form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMetrics, setNewMetrics] = useState<AgenticEvaluatorMetric[]>([{ name: "", threshold: "", weight: 0.5 }]);

  if (!agenticConfig) return null;

  const resetForm = () => {
    setNewName("");
    setNewDesc("");
    setNewMetrics([{ name: "", threshold: "", weight: 0.5 }]);
  };

  const handleAddEvaluator = () => {
    if (!newName.trim()) return;
    const validMetrics = newMetrics.filter((m) => m.name.trim() && m.threshold.trim());
    if (validMetrics.length === 0) return;
    const ev: AgenticEvaluator = {
      id: `ev-${uuidv4().slice(0, 8)}`,
      name: newName.trim(),
      description: newDesc.trim(),
      metrics: validMetrics,
    };
    updateAgenticEvaluator(ev);
    setAdding(false);
    resetForm();
  };

  const startEditEvaluator = (ev: AgenticEvaluator) => {
    setEditingId(ev.id);
    setNewName(ev.name);
    setNewDesc(ev.description);
    setNewMetrics(ev.metrics.length > 0 ? [...ev.metrics] : [{ name: "", threshold: "", weight: 0.5 }]);
  };

  const handleSaveEdit = () => {
    if (!editingId || !newName.trim()) return;
    const validMetrics = newMetrics.filter((m) => m.name.trim() && m.threshold.trim());
    if (validMetrics.length === 0) return;
    updateAgenticEvaluator({
      id: editingId,
      name: newName.trim(),
      description: newDesc.trim(),
      metrics: validMetrics,
    });
    setEditingId(null);
    resetForm();
  };

  const cancelEdit = () => { setEditingId(null); setAdding(false); resetForm(); };

  const addMetricRow = () => setNewMetrics([...newMetrics, { name: "", threshold: "", weight: 0.3 }]);
  const removeMetricRow = (idx: number) => setNewMetrics(newMetrics.filter((_, i) => i !== idx));
  const updateMetric = (idx: number, field: keyof AgenticEvaluatorMetric, value: string | number) => {
    setNewMetrics(newMetrics.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const renderForm = (isEdit: boolean) => (
    <div className="rounded-xl border-2 border-dashed border-violet-200 p-3.5 space-y-3">
      <p className="text-xs font-medium text-violet-700">{isEdit ? "编辑评估器" : "新增评估器"}</p>
      <Input placeholder="评估器名称" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-xs h-8" />
      <Input placeholder="评估说明" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-xs h-8" />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">评估指标</p>
          <button onClick={addMetricRow} className="text-violet-500 hover:text-violet-700 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-1.5">
          {newMetrics.map((metric, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <Input
                placeholder="指标名"
                value={metric.name}
                onChange={(e) => updateMetric(i, "name", e.target.value)}
                className="text-[11px] h-7 flex-1"
              />
              <Input
                placeholder="阈值"
                value={metric.threshold}
                onChange={(e) => updateMetric(i, "threshold", e.target.value)}
                className="text-[11px] h-7 w-24"
              />
              <Input
                type="number"
                placeholder="权重"
                value={metric.weight}
                onChange={(e) => updateMetric(i, "weight", parseFloat(e.target.value) || 0)}
                className="text-[11px] h-7 w-16"
                min={0} max={1} step={0.1}
              />
              {newMetrics.length > 1 && (
                <button onClick={() => removeMetricRow(i)} className="text-zinc-300 hover:text-red-500 shrink-0">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 justify-end">
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={cancelEdit}>取消</Button>
        <Button
          size="sm" className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700"
          onClick={isEdit ? handleSaveEdit : handleAddEvaluator}
          disabled={!newName.trim() || newMetrics.every((m) => !m.name.trim())}
        >
          {isEdit ? "保存" : "添加"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">共 {agenticConfig.evaluators.length} 个评估器</p>
        {editable && !adding && !editingId && (
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3 mr-0.5" /> 添加评估器
          </Button>
        )}
      </div>

      {adding && renderForm(false)}

      {agenticConfig.evaluators.map((evaluator) => {
        if (editingId === evaluator.id) return <div key={evaluator.id}>{renderForm(true)}</div>;

        return (
          <div key={evaluator.id} className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" />
                <h4 className="text-sm font-semibold text-zinc-900 flex-1">{evaluator.name}</h4>
                {editable && (
                  <div className="flex gap-1">
                    <button onClick={() => startEditEvaluator(evaluator)} className="text-zinc-300 hover:text-violet-600 transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeAgenticEvaluator(evaluator.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">{evaluator.description}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">评估指标</p>
              <div className="space-y-2">
                {evaluator.metrics.map((metric, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-700">{metric.name}</span>
                        <span className="text-[10px] text-zinc-400">权重 {Math.round(metric.weight * 100)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${metric.weight * 100}%` }} />
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0 whitespace-nowrap">{metric.threshold}</Badge>
                  </div>
                ))}
              </div>
            </div>
            {evaluator.metrics.length > 0 && (
              <div className="px-4 py-2 bg-green-50 border-t border-green-100">
                <div className="flex items-center gap-1.5 text-xs text-green-700">
                  <AlertTriangle className="w-3 h-3" />
                  所有指标达标后视为通过
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
