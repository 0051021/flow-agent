"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useFlowAgentStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { FlowNodeData, FlowNodeInput, FlowNodeOutput, NodeExecutionMode, ConfirmStrategy, ConfirmStrategyConfig, ExecutionRule } from "@/lib/types";
import {
  FileText, RotateCcw, UserCheck, SkipForward,
  OctagonX, Settings, X, Bot, User as UserIcon,
  Plus, Trash2, Pencil, Search, Puzzle,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { MOCK_MARKET_SKILLS } from "@/lib/mock-console";

function SkillBinder({ value, disabled, onChange, onClear }: {
  value?: string;
  disabled: boolean;
  onChange: (name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = MOCK_MARKET_SKILLS.filter((s) =>
    s.status === "available" && (
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase())
    )
  );

  if (value) {
    return (
      <div>
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">绑定 Skill</p>
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2">
            <Puzzle className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-medium text-blue-700">{value}</span>
          </div>
          {!disabled && (
            <button onClick={onClear} className="text-blue-400 hover:text-blue-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">绑定 Skill</p>
      {!open ? (
        <button
          onClick={() => !disabled && setOpen(true)}
          className={`flex items-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400 transition-colors ${
            disabled ? "cursor-default opacity-60" : "hover:border-blue-300 hover:text-blue-500 cursor-pointer"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          搜索并绑定 Skill...
        </button>
      ) : (
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索技能名称..."
              className="w-full pl-8 pr-8 py-2 text-xs border-b border-zinc-100 outline-none"
            />
            <button onClick={() => { setOpen(false); setQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-[160px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-zinc-400 p-3 text-center">无匹配结果</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onChange(s.name); setOpen(false); setQuery(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700">{s.name}</span>
                    <Badge className="text-[9px] h-3.5 border-0 bg-zinc-100 text-zinc-500">{s.category === "general" ? "通用" : "行业"}</Badge>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{s.description}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ERROR_STRATEGY_CONFIG = {
  retry: { label: "自动重试", icon: RotateCcw, description: "失败后自动重试" },
  human_fallback: { label: "转人工处理", icon: UserCheck, description: "重试失败后通知人工介入" },
  skip: { label: "跳过这一步", icon: SkipForward, description: "跳过后继续执行下一步" },
  abort: { label: "终止整个流程", icon: OctagonX, description: "立即停止并通知所有相关人" },
};

const EXEC_MODES: { value: NodeExecutionMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "ai_auto", label: "AI 自动", icon: Bot },
  { value: "human_confirm", label: "需人工确认", icon: UserCheck },
  { value: "human_manual", label: "人工操作", icon: UserIcon },
];

const CONFIRM_STRATEGIES: { value: ConfirmStrategy; label: string; desc: string; icon: string }[] = [
  { value: "always", label: "每次确认", desc: "所有执行都需人工确认", icon: "🔒" },
  { value: "threshold", label: "置信度", desc: "AI 置信度低于阈值时确认", icon: "📊" },
  { value: "sampling", label: "抽检", desc: "按比例随机抽检", icon: "🎲" },
  { value: "rule_based", label: "规则触发", desc: "满足特定条件时确认", icon: "📋" },
  { value: "combined", label: "组合策略", desc: "多种策略组合使用", icon: "🔗" },
];

function ConfirmStrategyPanel({ config, editable, onChange }: {
  config: ConfirmStrategyConfig;
  editable: boolean;
  onChange: (cfg: ConfirmStrategyConfig) => void;
}) {
  const activeStrategy = CONFIRM_STRATEGIES.find((s) => s.value === config.strategy) || CONFIRM_STRATEGIES[0];

  return (
    <div className="pt-2 border-t border-dashed border-zinc-200">
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">确认策略</p>
      {editable ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {CONFIRM_STRATEGIES.map((s) => (
              <button
                key={s.value}
                onClick={() => onChange({ ...config, strategy: s.value })}
                className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] transition-all ${
                  config.strategy === s.value
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {config.strategy === "threshold" && (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[10px] text-zinc-500">置信度 &lt;</span>
              <Input
                type="number"
                value={config.threshold ?? 95}
                onChange={(e) => onChange({ ...config, threshold: Number(e.target.value) })}
                className="text-xs h-6 w-16"
                min={0}
                max={100}
              />
              <span className="text-[10px] text-zinc-500">% 时需确认</span>
            </div>
          )}

          {config.strategy === "sampling" && (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[10px] text-zinc-500">每</span>
              <Input
                type="number"
                value={config.samplingRate ? Math.round(1 / config.samplingRate) : 20}
                onChange={(e) => onChange({ ...config, samplingRate: 1 / Math.max(1, Number(e.target.value)) })}
                className="text-xs h-6 w-14"
                min={1}
              />
              <span className="text-[10px] text-zinc-500">份抽检 1 份</span>
            </div>
          )}

          {config.strategy === "rule_based" && (
            <div className="pl-1 space-y-1">
              <p className="text-[10px] text-zinc-500">触发规则：</p>
              {(config.rules || ["VIP 客户", "金额 > 10万"]).map((rule, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-amber-500">•</span>
                  <span className="text-[10px] text-zinc-600">{rule}</span>
                </div>
              ))}
              <button className="text-[10px] text-blue-500 hover:text-blue-600">+ 添加规则</button>
            </div>
          )}

          {config.strategy === "combined" && (
            <div className="pl-1 space-y-1 text-[10px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500">•</span>
                <span>置信度 &lt; {config.threshold ?? 95}% → 确认</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500">•</span>
                <span>VIP 客户 → 确认</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500">•</span>
                <span>其余按 {config.samplingRate ? `${Math.round(config.samplingRate * 100)}%` : "5%"} 抽检</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{activeStrategy.icon}</span>
          <span className="text-xs text-zinc-700">{activeStrategy.label}</span>
          <span className="text-[10px] text-zinc-400">— {activeStrategy.desc}</span>
        </div>
      )}
    </div>
  );
}

const MIN_HEIGHT = 180;
const DEFAULT_HEIGHT = 300;
const MAX_HEIGHT_RATIO = 0.75;

export default function NodeDetailPanel() {
  const { selectedNodeId, nodes, viewMode, currentRole, setSelectedNodeId, updateNodeData, setEditingNodeId } = useFlowAgentStore();

  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startY.current = clientY;
    startH.current = panelHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [panelHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const delta = startY.current - clientY;
      const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
      const next = Math.min(maxH, Math.max(MIN_HEIGHT, startH.current + delta));
      setPanelHeight(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const data = node.data as unknown as FlowNodeData;
  const isTech = currentRole === "tech";
  const canEditBusiness = !isTech;

  const updateField = (field: string, value: unknown) => {
    updateNodeData(selectedNodeId, { [field]: value });
  };

  const updateInput = (inputId: string, field: keyof FlowNodeInput, value: string | boolean) => {
    const newInputs = data.inputs.map((inp) =>
      inp.id === inputId ? { ...inp, [field]: value } : inp
    );
    updateField("inputs", newInputs);
  };

  const addInput = () => {
    const newInputs = [
      ...data.inputs,
      { id: uuidv4(), name: "", icon: "📄", description: "", required: true, source: "user" as const },
    ];
    updateField("inputs", newInputs);
  };

  const removeInput = (inputId: string) => {
    updateField("inputs", data.inputs.filter((i) => i.id !== inputId));
  };

  const updateOutput = (outputId: string, field: keyof FlowNodeOutput, value: string) => {
    const newOutputs = data.outputs.map((out) =>
      out.id === outputId ? { ...out, [field]: value } : out
    );
    updateField("outputs", newOutputs);
  };

  const addOutput = () => {
    const newOutputs = [
      ...data.outputs,
      { id: uuidv4(), name: "", icon: "📋", description: "", flowsTo: [] as string[] },
    ];
    updateField("outputs", newOutputs);
  };

  const removeOutput = (outputId: string) => {
    updateField("outputs", data.outputs.filter((o) => o.id !== outputId));
  };

  const toggleErrorStrategy = (strategy: string) => {
    if (!canEditBusiness) return;
    const newHandling = data.errorHandling.map((eh) =>
      eh.strategy === strategy ? { ...eh, enabled: !eh.enabled } : eh
    );
    updateField("errorHandling", newHandling);
  };

  return (
    <div className="border-t border-zinc-200 bg-white flex flex-col" style={{ height: panelHeight, minHeight: MIN_HEIGHT }}>
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        className="flex items-center justify-center h-3 cursor-row-resize group hover:bg-zinc-100 transition-colors shrink-0"
      >
        <div className="w-8 h-1 rounded-full bg-zinc-300 group-hover:bg-zinc-400 transition-colors" />
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="text-sm">📌</span>
          {canEditBusiness ? (
            <input
              value={data.label}
              onChange={(e) => updateField("label", e.target.value)}
              className="text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none focus:ring-0 p-0 w-40"
              placeholder="节点名称"
            />
          ) : (
            <h3 className="text-sm font-semibold text-zinc-900">{data.label}</h3>
          )}
          <Badge variant="outline" className="text-[10px] h-5">
            {data.stepIndex}/{data.totalSteps}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditingNodeId(selectedNodeId)}
            className="p-1 rounded-md hover:bg-zinc-100 transition-colors"
            title="打开完整编辑"
          >
            <Pencil className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="p-1 rounded-md hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start px-4 h-9 bg-zinc-50 rounded-none border-b border-zinc-100">
          <TabsTrigger value="basic" className="text-xs h-7">📝 基本信息</TabsTrigger>
          <TabsTrigger value="io" className="text-xs h-7">📥 输入输出</TabsTrigger>
          <TabsTrigger value="error" className="text-xs h-7">⚠️ 异常处理</TabsTrigger>
          {viewMode === "tech" && (
            <TabsTrigger value="tech" className="text-xs h-7">⚙️ 技术配置</TabsTrigger>
          )}
        </TabsList>

        <ScrollArea className="flex-1 min-h-0">
          {/* === 基本信息 === */}
          <TabsContent value="basic" className="px-4 py-3 mt-0 space-y-3">
            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">节点描述</p>
              {canEditBusiness ? (
                <Textarea
                  value={data.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="text-sm min-h-[50px] bg-zinc-50 rounded-lg"
                  placeholder="描述这个节点做什么"
                />
              ) : (
                <p className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 rounded-lg p-3">{data.description}</p>
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">执行方式</p>
                {canEditBusiness ? (
                  <div className="flex gap-1.5">
                    {EXEC_MODES.map((mode) => {
                      const Icon = mode.icon;
                      const isActive = data.executionMode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          onClick={() => updateField("executionMode", mode.value)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-all ${
                            isActive
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {data.executionMode === "ai_auto" && <><Bot className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs text-zinc-700">AI 自动</span></>}
                    {data.executionMode === "human_confirm" && <><UserCheck className="w-3.5 h-3.5 text-amber-500" /><span className="text-xs text-zinc-700">需人工确认</span></>}
                    {data.executionMode === "human_manual" && <><UserIcon className="w-3.5 h-3.5 text-purple-500" /><span className="text-xs text-zinc-700">人工操作</span></>}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">预计耗时</p>
                {canEditBusiness ? (
                  <Input
                    value={data.estimatedTime}
                    onChange={(e) => updateField("estimatedTime", e.target.value)}
                    className="text-xs h-7 w-28"
                    placeholder="约2分钟"
                  />
                ) : (
                  <span className="text-xs text-zinc-700">⏱️ {data.estimatedTime}</span>
                )}
              </div>
            </div>

            {/* 执行规则 */}
            {((data.executionRules && data.executionRules.length > 0) || canEditBusiness) && (
              <div className="pt-2 border-t border-dashed border-zinc-200">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">执行规则</p>
                  {canEditBusiness && (
                    <button
                      onClick={() => {
                        const newRules: ExecutionRule[] = [
                          ...(data.executionRules || []),
                          { rule: "", detail: "", source: "user_confirmed" },
                        ];
                        updateField("executionRules", newRules);
                      }}
                      className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-3 h-3" /> 添加
                    </button>
                  )}
                </div>
                {(!data.executionRules || data.executionRules.length === 0) ? (
                  <p className="text-[11px] text-zinc-400 text-center py-2 bg-zinc-50 rounded-lg">
                    暂无执行规则{canEditBusiness ? "，点击上方「添加」" : ""}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {data.executionRules.map((r, idx) => (
                      <div key={idx} className="p-2 rounded-lg border border-zinc-100 bg-zinc-50 group">
                        <div className="flex items-start gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                            r.source === "user_confirmed"
                              ? "bg-green-50 text-green-600 border border-green-200"
                              : "bg-blue-50 text-blue-500 border border-blue-200"
                          }`}>
                            {r.source === "user_confirmed" ? "用户确认" : "AI 推断"}
                          </span>
                          <div className="flex-1 min-w-0">
                            {canEditBusiness ? (
                              <div className="space-y-1">
                                <Input
                                  value={r.rule}
                                  onChange={(e) => {
                                    const newRules = [...(data.executionRules || [])];
                                    newRules[idx] = { ...newRules[idx], rule: e.target.value };
                                    updateField("executionRules", newRules);
                                  }}
                                  className="text-xs h-6 bg-white font-medium"
                                  placeholder="规则名称（如：文件名容错）"
                                />
                                <Input
                                  value={r.detail}
                                  onChange={(e) => {
                                    const newRules = [...(data.executionRules || [])];
                                    newRules[idx] = { ...newRules[idx], detail: e.target.value };
                                    updateField("executionRules", newRules);
                                  }}
                                  className="text-xs h-6 bg-white"
                                  placeholder="具体处理方式"
                                />
                              </div>
                            ) : (
                              <>
                                <p className="text-xs font-medium text-zinc-700">{r.rule}</p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">{r.detail}</p>
                              </>
                            )}
                          </div>
                          {canEditBusiness && (
                            <button
                              onClick={() => {
                                const newRules = (data.executionRules || []).filter((_, i) => i !== idx);
                                updateField("executionRules", newRules);
                              }}
                              className="p-0.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {data.executionMode === "human_confirm" && (
              <ConfirmStrategyPanel
                config={data.confirmStrategy || { strategy: "always" }}
                editable={canEditBusiness}
                onChange={(cfg) => updateField("confirmStrategy", cfg)}
              />
            )}
          </TabsContent>

          {/* === 输入输出 === */}
          <TabsContent value="io" className="px-4 py-3 mt-0 space-y-4">
            {/* Inputs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">需要提供（输入）</p>
                {canEditBusiness && (
                  <button onClick={addInput} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
                    <Plus className="w-3 h-3" /> 添加
                  </button>
                )}
              </div>
              {data.inputs.length === 0 ? (
                <p className="text-[11px] text-zinc-400 text-center py-3 bg-zinc-50 rounded-lg">
                  暂无输入{canEditBusiness ? '，点击上方「添加」' : ''}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.inputs.map((inp) => (
                    <div key={inp.id} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-100 bg-zinc-50 group">
                      {canEditBusiness ? (
                        <>
                          <Input
                            value={inp.name}
                            onChange={(e) => updateInput(inp.id, "name", e.target.value)}
                            className="text-xs h-6 flex-1 bg-white"
                            placeholder="名称"
                          />
                          <Input
                            value={inp.description}
                            onChange={(e) => updateInput(inp.id, "description", e.target.value)}
                            className="text-xs h-6 flex-1 bg-white"
                            placeholder="说明"
                          />
                          <select
                            value={inp.source}
                            onChange={(e) => updateInput(inp.id, "source", e.target.value)}
                            className="text-[10px] h-6 px-1.5 rounded border border-zinc-200 bg-white text-zinc-600"
                          >
                            <option value="user">用户提供</option>
                            <option value="previous_step">上一步</option>
                            <option value="default">默认值</option>
                          </select>
                          <button
                            onClick={() => removeInput(inp.id)}
                            className="p-0.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs flex-1">{inp.icon} {inp.name}</span>
                          <span className="text-xs text-zinc-400 flex-1">{inp.description}</span>
                          <span className="text-[10px] text-zinc-400">
                            {inp.source === "user" ? "👤 用户" : inp.sourceDetail || "上一步"}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outputs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">会产出（输出）</p>
                {canEditBusiness && (
                  <button onClick={addOutput} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
                    <Plus className="w-3 h-3" /> 添加
                  </button>
                )}
              </div>
              {data.outputs.length === 0 ? (
                <p className="text-[11px] text-zinc-400 text-center py-3 bg-zinc-50 rounded-lg">
                  暂无输出{canEditBusiness ? '，点击上方「添加」' : ''}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.outputs.map((out) => (
                    <div key={out.id} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-100 bg-zinc-50 group">
                      {canEditBusiness ? (
                        <>
                          <Input
                            value={out.name}
                            onChange={(e) => updateOutput(out.id, "name", e.target.value)}
                            className="text-xs h-6 flex-1 bg-white"
                            placeholder="名称"
                          />
                          <Input
                            value={out.description}
                            onChange={(e) => updateOutput(out.id, "description", e.target.value)}
                            className="text-xs h-6 flex-1 bg-white"
                            placeholder="说明"
                          />
                          <button
                            onClick={() => removeOutput(out.id)}
                            className="p-0.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs flex-1">{out.icon} {out.name}</span>
                          <span className="text-xs text-zinc-400 flex-1">{out.description}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === 异常处理 === */}
          <TabsContent value="error" className="px-4 py-3 mt-0 space-y-2">
            <p className="text-xs text-zinc-500 mb-2">如果这一步出错了，怎么办？</p>
            {data.errorHandling.map((eh) => {
              const config = ERROR_STRATEGY_CONFIG[eh.strategy];
              const Icon = config.icon;
              return (
                <button
                  key={eh.strategy}
                  onClick={() => toggleErrorStrategy(eh.strategy)}
                  disabled={!canEditBusiness}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left
                    ${eh.enabled ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-50"}
                    ${canEditBusiness ? "cursor-pointer hover:border-zinc-300" : "cursor-default"}`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5
                    ${eh.enabled ? "border-blue-500 bg-blue-500" : "border-zinc-300"}`}>
                    {eh.enabled && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-sm font-medium text-zinc-700">{config.label}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{config.description}</p>
                  </div>
                </button>
              );
            })}
          </TabsContent>

          {/* === 技术配置 === */}
          {viewMode === "tech" && (
            <TabsContent value="tech" className="px-4 py-3 mt-0 space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                <Settings className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-blue-700">此区域仅技术方可编辑</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">执行类型</p>
                  <div className="flex gap-2">
                    {(["deterministic", "intelligent"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          if (isTech && selectedNodeId) {
                            updateNodeData(selectedNodeId, {
                              techConfig: { ...data.techConfig, executionType: t },
                            });
                          }
                        }}
                        disabled={!isTech}
                        className={`flex-1 p-2.5 rounded-lg border-2 transition-colors text-left
                          ${data.techConfig.executionType === t ? "border-blue-400 bg-blue-50" : "border-zinc-200"}
                          ${isTech ? "cursor-pointer hover:border-blue-300" : "cursor-default opacity-60"}`}
                      >
                        <span className="text-xs font-medium">{t === "deterministic" ? "🔧 确定性执行" : "🧠 智能规划"}</span>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{t === "deterministic" ? "Workflow" : "Agent Tech"}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <SkillBinder
                  value={data.techConfig.boundSkill}
                  disabled={!isTech}
                  onChange={(skillName) => {
                    if (selectedNodeId) {
                      updateNodeData(selectedNodeId, {
                        techConfig: { ...data.techConfig, boundSkill: skillName },
                      });
                      toast.success(`已绑定 Skill：${skillName}`);
                    }
                  }}
                  onClear={() => {
                    if (selectedNodeId) {
                      updateNodeData(selectedNodeId, {
                        techConfig: { ...data.techConfig, boundSkill: undefined },
                      });
                    }
                  }}
                />
                <div>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">可行性评估</p>
                  <div className="flex gap-2">
                    {(["confirmed", "partial", "infeasible"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          if (isTech && selectedNodeId) {
                            updateNodeData(selectedNodeId, {
                              techConfig: { ...data.techConfig, feasibility: f },
                            });
                          }
                        }}
                        disabled={!isTech}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors
                          ${data.techConfig.feasibility === f ? "border-blue-400 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-500"}
                          ${isTech ? "cursor-pointer hover:border-blue-300" : "cursor-default opacity-60"}`}
                      >
                        {f === "confirmed" && "✅ 可做"}
                        {f === "partial" && "⚠️ 部分可做"}
                        {f === "infeasible" && "❌ 不可做"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  );
}
