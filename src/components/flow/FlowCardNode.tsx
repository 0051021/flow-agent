"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { useFlowAgentStore } from "@/lib/store";
import { getEffectiveSkillCodes } from "@/lib/tech-binding-helpers";
import NodeAnnotationBubble from "@/components/flow/NodeAnnotationBubble";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Target, PenTool, ShieldCheck, Clock,
  Activity, RefreshCw, UserCheck,
  MessageSquare, Search, FileText, Mail, Database,
  Zap, Eye, Settings, Upload, Download, Users, Globe, Lock, Bell,
  ScrollText, Sparkles,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3, Target, PenTool, ShieldCheck, Clock,
  Activity, RefreshCw, Search, FileText, Mail, Database,
  Zap, Eye, Settings, Upload, Download, Users, Globe, Lock, Bell,
  UserCheck, ScrollText,
  Sparkles,
};

const DEFAULT_TECH_CONFIG = {
  executionType: "deterministic" as const,
  feasibility: "pending" as const,
};

function FlowCardNode({ data, id }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const [showBubble, setShowBubble] = useState(false);
  const {
    viewMode,
    currentRole,
    selectedNodeId,
    setSelectedNodeId,
    annotations,
    allNodeConfidence,
    deferredNodeIds,
    techBindings,
  } = useFlowAgentStore();
  const nodeBinding = techBindings.nodesById[id];
  const boundSkillCodes = nodeBinding ? getEffectiveSkillCodes(nodeBinding) : [];
  const IconComponent = ICON_MAP[nodeData.icon] || BarChart3;
  const techConfig = nodeData.techConfig ?? DEFAULT_TECH_CONFIG;
  const nodeAnnotations = annotations.filter((a) => a.nodeId === id);
  const unresolvedCount = nodeAnnotations.filter((a) => a.status !== "resolved").length;
  const isSelected = selectedNodeId === id;
  const nodeConf = allNodeConfidence.find((nc) => nc.nodeId === id);
  const isDeferred = deferredNodeIds.includes(id);
  const hasAnnotationContent = unresolvedCount > 0;
  const kindMeta = {
    workflow_step: { label: "固定流程", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    agentic_judgment: { label: "业务判断", className: "border-blue-200 bg-blue-50 text-blue-700" },
    agentic_strategy: { label: "处理策略", className: "border-violet-200 bg-violet-50 text-violet-700" },
    agentic_generation: { label: "内容生成", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    agentic_feedback: { label: "复盘沉淀", className: "border-amber-200 bg-amber-50 text-amber-700" },
    human_gate: { label: "确认关口", className: "border-rose-200 bg-rose-50 text-rose-700" },
    manual_operation: { label: "人工操作", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    business_judgment: { label: "业务判断", className: "border-blue-200 bg-blue-50 text-blue-700" },
    document_check: { label: "文件检查", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    handoff_wait: { label: "交接等待", className: "border-amber-200 bg-amber-50 text-amber-700" },
    rework_update: { label: "返修回填", className: "border-rose-200 bg-rose-50 text-rose-700" },
  }[nodeData.workUnitKind || "workflow_step"];


  const isFirstNode = nodeData.stepIndex === 1;

  return (
    <div
      className={`
        relative w-[320px] bg-white rounded-xl border-2 shadow-sm cursor-pointer
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
        ${isSelected ? "border-blue-400 ring-2 ring-blue-100" : unresolvedCount > 0 ? "border-red-200" : "border-zinc-200"}
      `}
      onClick={() => {
        setSelectedNodeId(id);
      }}
      {...(isFirstNode ? { "data-onboarding": "flow-node" } : {})}
    >
      {showBubble && (
        <div
          className="absolute top-0 left-full ml-4 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <NodeAnnotationBubble
            nodeId={id}
            nodeLabel={nodeData.label}
            position="right"
            onClose={() => setShowBubble(false)}
          />
        </div>
      )}
      <Handle type="target" position={Position.Top} id="top-in" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" />
      <Handle type="source" position={Position.Top} id="top-out" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" />
      <Handle type="target" position={Position.Left} id="left-in" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" style={{ top: "50%" }} />
      <Handle type="source" position={Position.Left} id="left-out" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" style={{ top: "50%" }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
            <IconComponent className="w-4 h-4 text-zinc-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{nodeData.label}</h3>
            <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] leading-none ${kindMeta.className}`}>
              {kindMeta.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isDeferred && (
            currentRole === "business" ? (
              <button
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-500 text-[10px] border border-orange-200 hover:bg-orange-100 transition-colors"
                title="待确认：信息待补充"
                onClick={(e) => {
                  e.stopPropagation();
                  useFlowAgentStore.setState({ selectedNodeId: id, showNodeQuestions: true });
                }}
              >
                <Clock className="w-2.5 h-2.5" />
                待确认
              </button>
            ) : (
              <span
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-500 text-[10px] border border-orange-200"
                title="待确认：信息待补充"
              >
                <Clock className="w-2.5 h-2.5" />
                待确认
              </span>
            )
          )}
          {nodeConf && nodeConf.confidence !== "high" && !isDeferred && (
            <button
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] border transition-colors ${
                nodeConf.confidence === "medium"
                  ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                  : "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
              }`}
              title={`AI ${nodeConf.confidence === "medium" ? "不太确定" : "需要补充"}：${nodeConf.reason}`}
              onClick={(e) => {
                e.stopPropagation();
                if (currentRole === "business") {
                  useFlowAgentStore.setState({ selectedNodeId: id, showNodeQuestions: true });
                } else {
                  useFlowAgentStore.setState({ selectedNodeId: id, showNodeQuestions: true });
                }
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                nodeConf.confidence === "medium" ? "bg-amber-400" : "bg-red-400"
              }`} />
              {nodeConf.confidence === "medium" ? "待确认" : "需补充"}
            </button>
          )}
          {hasAnnotationContent && (
            <button
              type="button"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                currentRole === "tech"
                  ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                  : "bg-red-50 text-red-600 hover:bg-red-100"
              }`}
              data-annotation-trigger
              onClick={(e) => {
                e.stopPropagation();
                setShowBubble((v) => !v);
              }}
            >
              <MessageSquare className="w-3 h-3" />
              技术批注 {unresolvedCount}
            </button>
          )}
          <span className="text-xs text-zinc-400">{nodeData.stepIndex}/{nodeData.totalSteps}</span>
        </div>
      </div>

      {/* Description */}
      <p className="px-4 text-xs text-zinc-500 leading-relaxed">{nodeData.description}</p>

      {nodeData.agenticSpec && (
        <div className="mx-4 mt-3 rounded-lg border border-dashed border-violet-100 bg-violet-50/40 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-violet-700">
            <Sparkles className="h-3 w-3" />
            这一步：{kindMeta.label}
          </div>
          {nodeData.agenticSpec.focusSignals.length > 0 && (
            <p className="line-clamp-2 text-[11px] leading-4 text-zinc-600">
              关注：{nodeData.agenticSpec.focusSignals.slice(0, 3).join("、")}
            </p>
          )}
          {nodeData.agenticSpec.recommendationOutputs.length > 0 && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-600">
              输出：{nodeData.agenticSpec.recommendationOutputs.slice(0, 2).join("、")}
            </p>
          )}
        </div>
      )}

      {nodeData.judgmentSpec && (
        <div className="mx-4 mt-3 rounded-lg border border-dashed border-blue-100 bg-blue-50/40 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-blue-700">
            <Sparkles className="h-3 w-3" />
            这一步：{kindMeta.label}
          </div>
          {nodeData.judgmentSpec.informationUsed && nodeData.judgmentSpec.informationUsed.length > 0 && (
            <p className="line-clamp-2 text-[11px] leading-4 text-zinc-600">
              依据：{nodeData.judgmentSpec.informationUsed.slice(0, 3).join("、")}
            </p>
          )}
          {nodeData.judgmentSpec.judgmentOutputs && nodeData.judgmentSpec.judgmentOutputs.length > 0 && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-600">
              结果：{nodeData.judgmentSpec.judgmentOutputs.slice(0, 2).join("、")}
            </p>
          )}
        </div>
      )}

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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-400">执行类型:</span>
            <Badge variant="outline" className="text-[10px] h-5">
              {techConfig.executionType === "deterministic" ? "🔧 确定性" : "🧠 智能规划"}
            </Badge>
            <span className="text-zinc-400">Skill 绑定:</span>
            {boundSkillCodes.length > 0 ? (
              <Badge variant="outline" className="text-[10px] h-5 font-mono max-w-[180px] truncate" title={boundSkillCodes.join(", ")}>
                {boundSkillCodes.length === 1 ? boundSkillCodes[0] : `${boundSkillCodes.length} 项`}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-5 border-amber-200 bg-amber-50 text-amber-800">
                待配置
              </Badge>
            )}
            {techConfig.boundSkill && boundSkillCodes.length === 0 && (
              <>
                <span className="text-zinc-400">草稿:</span>
                <Badge variant="outline" className="text-[10px] h-5 font-mono opacity-70">
                  {techConfig.boundSkill}
                </Badge>
              </>
            )}
          </div>
        </div>
      )}


      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 mt-2 border-t border-zinc-100">
        <span className="text-[11px] text-zinc-400">⏱️ {nodeData.estimatedTime}</span>
      </div>

      <Handle type="target" position={Position.Bottom} id="bottom-in" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" />
      <Handle type="source" position={Position.Bottom} id="bottom-out" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" />
      <Handle type="target" position={Position.Right} id="right-in" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" style={{ top: "50%" }} />
      <Handle type="source" position={Position.Right} id="right-out" className="!w-3 !h-3 !bg-zinc-300 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all" style={{ top: "50%" }} />
    </div>
  );
}

export default memo(FlowCardNode);
