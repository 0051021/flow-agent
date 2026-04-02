"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { useFlowAgentStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Target, PenTool, ShieldCheck, Clock,
  Activity, RefreshCw, Bot, UserCheck, User,
  MessageSquare,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3, Target, PenTool, ShieldCheck, Clock,
  Activity, RefreshCw,
};

const EXEC_MODE_CONFIG = {
  ai_auto: { label: "AI 自动", icon: Bot, className: "bg-blue-50 text-blue-700 border-blue-200" },
  human_confirm: { label: "需人工确认", icon: UserCheck, className: "bg-amber-50 text-amber-700 border-amber-200" },
  human_manual: { label: "人工操作", icon: User, className: "bg-purple-50 text-purple-700 border-purple-200" },
};

function FlowCardNode({ data, id }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const { viewMode, currentRole, selectedNodeId, setSelectedNodeId, setShowAnnotationPanel, annotations } = useFlowAgentStore();
  const IconComponent = ICON_MAP[nodeData.icon] || BarChart3;
  const execConfig = EXEC_MODE_CONFIG[nodeData.executionMode];
  const ExecIcon = execConfig.icon;
  const nodeAnnotations = annotations.filter((a) => a.nodeId === id);
  const unresolvedCount = nodeAnnotations.filter((a) => a.status !== "resolved").length;
  const isSelected = selectedNodeId === id;

  const feasibilityBorder = {
    confirmed: "border-l-green-500",
    partial: "border-l-amber-500",
    infeasible: "border-l-red-500",
    pending: "border-l-transparent",
  };

  return (
    <div
      className={`
        w-[320px] bg-white rounded-xl border-2 shadow-sm cursor-pointer
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
        border-l-[4px] ${feasibilityBorder[nodeData.techConfig.feasibility]}
        ${isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-zinc-200"}
      `}
      onClick={() => {
        setSelectedNodeId(id);
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
            <IconComponent className="w-4 h-4 text-zinc-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{nodeData.label}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {unresolvedCount > 0 && (
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-xs hover:bg-amber-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNodeId(id);
                setShowAnnotationPanel(true);
              }}
            >
              <MessageSquare className="w-3 h-3" />
              {unresolvedCount}
            </button>
          )}
          <span className="text-xs text-zinc-400">{nodeData.stepIndex}/{nodeData.totalSteps}</span>
        </div>
      </div>

      {/* Description */}
      <p className="px-4 text-xs text-zinc-500 leading-relaxed">{nodeData.description}</p>

      {/* Inputs & Outputs - business view */}
      <div className="px-4 mt-3 space-y-2">
        <div>
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">需要提供</p>
          <div className="flex flex-wrap gap-1">
            {nodeData.inputs.map((input) => (
              <span
                key={input.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                  ${input.source === "user" ? "bg-blue-50 text-blue-700" : "bg-zinc-50 text-zinc-500"}`}
              >
                {input.icon} {input.name}
                {viewMode === "tech" && input.dataType && (
                  <span className="text-[10px] text-zinc-400 ml-0.5">({input.dataType})</span>
                )}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">会产出</p>
          <div className="flex flex-wrap gap-1">
            {nodeData.outputs.map((output) => (
              <span
                key={output.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs"
              >
                {output.icon} {output.name}
                {viewMode === "tech" && output.dataType && (
                  <span className="text-[10px] text-green-500 ml-0.5">({output.dataType})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Condition branches */}
      {nodeData.isCondition && nodeData.conditionBranches && (
        <div className="px-4 mt-2">
          <div className="flex gap-2">
            {nodeData.conditionBranches.map((branch, i) => (
              <div key={i} className="flex-1 px-2 py-1.5 rounded-md bg-zinc-50 text-center">
                <span className="text-xs">{branch.icon} {branch.label}</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">→ {branch.targetLabel}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech config - only in tech view */}
      {viewMode === "tech" && (
        <div className="px-4 mt-2 pt-2 border-t border-dashed border-zinc-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400">执行类型:</span>
            <Badge variant="outline" className="text-[10px] h-5">
              {nodeData.techConfig.executionType === "deterministic" ? "🔧 确定性" : "🧠 智能规划"}
            </Badge>
            {nodeData.techConfig.boundSkill && (
              <>
                <span className="text-zinc-400">Skill:</span>
                <Badge variant="outline" className="text-[10px] h-5 font-mono">
                  {nodeData.techConfig.boundSkill}
                </Badge>
              </>
            )}
          </div>
        </div>
      )}

      {/* Feasibility bar - tech view only */}
      {currentRole === "tech" && nodeData.techConfig.feasibility !== "pending" && (
        <div className={`mx-4 mt-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${
          nodeData.techConfig.feasibility === "confirmed"
            ? "bg-green-50 text-green-700 border border-green-200"
            : nodeData.techConfig.feasibility === "partial"
            ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {nodeData.techConfig.feasibility === "confirmed" && "✅ 技术可行"}
          {nodeData.techConfig.feasibility === "partial" && "⚠️ 部分可行，需调整"}
          {nodeData.techConfig.feasibility === "infeasible" && "❌ 技术不可行"}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 mt-2 border-t border-zinc-100">
        <span className="text-[11px] text-zinc-400">⏱️ {nodeData.estimatedTime}</span>
        <Badge variant="outline" className={`text-[10px] h-5 ${execConfig.className}`}>
          <ExecIcon className="w-3 h-3 mr-1" />
          {execConfig.label}
        </Badge>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white" />
    </div>
  );
}

export default memo(FlowCardNode);
