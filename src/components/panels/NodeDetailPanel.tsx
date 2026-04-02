"use client";

import { useFlowAgentStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowNodeData, FlowNodeInput, FlowNodeOutput, NodeExecutionMode } from "@/lib/types";
import {
  FileText, RotateCcw, UserCheck, SkipForward,
  OctagonX, Settings, X, Bot, User as UserIcon,
  Plus, Trash2, Pencil,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

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

export default function NodeDetailPanel() {
  const { selectedNodeId, nodes, viewMode, currentRole, setSelectedNodeId, updateNodeData, setEditingNodeId } = useFlowAgentStore();

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
    <div className="border-t border-zinc-200 bg-white">
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

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="w-full justify-start px-4 h-9 bg-zinc-50 rounded-none border-b border-zinc-100">
          <TabsTrigger value="basic" className="text-xs h-7">📝 基本信息</TabsTrigger>
          <TabsTrigger value="io" className="text-xs h-7">📥 输入输出</TabsTrigger>
          <TabsTrigger value="error" className="text-xs h-7">⚠️ 异常处理</TabsTrigger>
          {viewMode === "tech" && (
            <TabsTrigger value="tech" className="text-xs h-7">⚙️ 技术配置</TabsTrigger>
          )}
        </TabsList>

        <ScrollArea className="h-[220px]">
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
                <div>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">绑定 Skill</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400">
                    <FileText className="w-3.5 h-3.5" />
                    {data.techConfig.boundSkill || "从知识中心搜索并绑定..."}
                  </div>
                </div>
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
