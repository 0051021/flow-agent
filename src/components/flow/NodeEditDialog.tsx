"use client";

import { useState, useEffect } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FlowNodeData, FlowNodeInput, FlowNodeOutput, NodeExecutionMode } from "@/lib/types";
import {
  X, Plus, Trash2, Bot, UserCheck, User, Code2,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const EXEC_MODES: { value: NodeExecutionMode; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { value: "ai_auto", label: "AI 自动完成", icon: Bot, desc: "AI 独立执行，无需人工介入" },
  { value: "human_confirm", label: "AI 完成，人工确认", icon: UserCheck, desc: "AI 执行后需要人工审核确认" },
  { value: "human_manual", label: "人工操作", icon: User, desc: "完全由人工手动完成" },
];

export default function NodeEditDialog() {
  const { editingNodeId, setEditingNodeId, nodes, updateNodeData, currentRole } = useFlowAgentStore();
  const isTech = currentRole === "tech";

  const node = nodes.find((n) => n.id === editingNodeId);
  const data = node ? (node.data as unknown as FlowNodeData) : null;

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [executionMode, setExecutionMode] = useState<NodeExecutionMode>("ai_auto");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [inputs, setInputs] = useState<FlowNodeInput[]>([]);
  const [outputs, setOutputs] = useState<FlowNodeOutput[]>([]);

  useEffect(() => {
    if (data) {
      setLabel(data.label);
      setDescription(data.description);
      setExecutionMode(data.executionMode);
      setEstimatedTime(data.estimatedTime);
      setInputs([...data.inputs]);
      setOutputs([...data.outputs]);
    }
  }, [data]);

  if (!editingNodeId || !data) return null;

  const handleSave = () => {
    updateNodeData(editingNodeId, {
      label,
      description,
      executionMode,
      estimatedTime,
      inputs,
      outputs,
    });
    setEditingNodeId(null);
  };

  const handleClose = () => {
    setEditingNodeId(null);
  };

  const addInput = () => {
    setInputs([
      ...inputs,
      {
        id: uuidv4(),
        name: "",
        icon: "📄",
        description: "",
        required: true,
        source: "user",
      },
    ]);
  };

  const removeInput = (id: string) => {
    setInputs(inputs.filter((i) => i.id !== id));
  };

  const updateInput = (id: string, field: keyof FlowNodeInput, value: string | boolean) => {
    setInputs(inputs.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const addOutput = () => {
    setOutputs([
      ...outputs,
      {
        id: uuidv4(),
        name: "",
        icon: "📋",
        description: "",
        flowsTo: [],
      },
    ]);
  };

  const removeOutput = (id: string) => {
    setOutputs(outputs.filter((o) => o.id !== id));
  };

  const updateOutput = (id: string, field: keyof FlowNodeOutput, value: string) => {
    setOutputs(outputs.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-[560px] max-h-[85vh] flex flex-col border border-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">编辑节点</h2>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-zinc-100 transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isTech && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-700">
              <Code2 className="w-3.5 h-3.5 shrink-0" />
              技术评审模式：可修改执行方式、耗时、描述等技术判断项，节点名称由业务方定义
            </div>
          )}

          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">节点名称</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 text-sm"
                placeholder="如：从ERP导出销售数据"
                disabled={isTech}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">节点描述</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 text-sm min-h-[60px]"
                placeholder="用一句话描述这个节点做什么"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">预计耗时</label>
              <Input
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                className="mt-1 text-sm"
                placeholder="如：约2分钟"
              />
            </div>
          </div>

          {/* Execution mode */}
          <div>
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">执行方式</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {EXEC_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = executionMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    onClick={() => setExecutionMode(mode.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                      isActive
                        ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-zinc-400"}`} />
                    <span className={`text-[11px] font-medium ${isActive ? "text-blue-700" : "text-zinc-600"}`}>
                      {mode.label}
                    </span>
                    <span className="text-[10px] text-zinc-400 leading-tight">{mode.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inputs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">需要提供（输入）</label>
              <button onClick={addInput} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700">
                <Plus className="w-3 h-3" /> 添加
              </button>
            </div>
            <div className="space-y-2">
              {inputs.map((inp) => (
                <div key={inp.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-zinc-200 bg-zinc-50">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={inp.name}
                      onChange={(e) => updateInput(inp.id, "name", e.target.value)}
                      className="text-xs h-7"
                      placeholder="名称（如：报关单（Excel））"
                    />
                    <Input
                      value={inp.description}
                      onChange={(e) => updateInput(inp.id, "description", e.target.value)}
                      className="text-xs h-7"
                      placeholder="简短说明"
                    />
                  </div>
                  <button onClick={() => removeInput(inp.id)} className="p-1 text-zinc-400 hover:text-red-500 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {inputs.length === 0 && (
                <p className="text-[11px] text-zinc-400 text-center py-3">暂无输入，点击上方"添加"</p>
              )}
            </div>
          </div>

          {/* Outputs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">会产出（输出）</label>
              <button onClick={addOutput} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700">
                <Plus className="w-3 h-3" /> 添加
              </button>
            </div>
            <div className="space-y-2">
              {outputs.map((out) => (
                <div key={out.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-zinc-200 bg-zinc-50">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={out.name}
                      onChange={(e) => updateOutput(out.id, "name", e.target.value)}
                      className="text-xs h-7"
                      placeholder="名称（如：审批结果通知（邮件））"
                    />
                    <Input
                      value={out.description}
                      onChange={(e) => updateOutput(out.id, "description", e.target.value)}
                      className="text-xs h-7"
                      placeholder="简短说明"
                    />
                  </div>
                  <button onClick={() => removeOutput(out.id)} className="p-1 text-zinc-400 hover:text-red-500 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {outputs.length === 0 && (
                <p className="text-[11px] text-zinc-400 text-center py-3">暂无输出，点击上方"添加"</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100">
          <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">
            取消
          </Button>
          <Button size="sm" onClick={handleSave} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
            保存修改
          </Button>
        </div>
      </div>
    </div>
  );
}
