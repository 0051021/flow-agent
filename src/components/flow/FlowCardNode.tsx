"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeData, PlatformTaskType } from "@/lib/types";
import { useFlowAgentStore } from "@/lib/store";
import { getEffectiveSkillCodes } from "@/lib/tech-binding-helpers";
import {
  labelForReviewPolicyCode,
  labelForRuntimeProfileCode,
} from "@/lib/registered-skills";
import NodeAnnotationBubble from "@/components/flow/NodeAnnotationBubble";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Target, PenTool, ShieldCheck, Clock,
  Activity, RefreshCw, UserCheck,
  MessageSquare, Search, FileText, Mail, Database,
  Zap, Eye, Settings, Upload, Download, Users, Globe, Lock, Bell,
  ScrollText, Sparkles, GitBranch,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3, Target, PenTool, ShieldCheck, Clock,
  Activity, RefreshCw, Search, FileText, Mail, Database,
  Zap, Eye, Settings, Upload, Download, Users, Globe, Lock, Bell,
  UserCheck, ScrollText,
  Sparkles,
  GitBranch,
};

const DEFAULT_TECH_CONFIG = {
  executionType: "deterministic" as const,
  feasibility: "pending" as const,
};

function inferTaskType(data: FlowNodeData): PlatformTaskType {
  if (data.executionMode === "human_manual" || data.executionMode === "human_confirm") {
    return "human_review";
  }
  return "agentic";
}

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
    jobSplitDraft,
    toggleJobSplitNode,
  } = useFlowAgentStore();
  const nodeBinding = techBindings.nodesById[id];
  const taskType = nodeBinding?.taskType ?? inferTaskType(nodeData);
  const boundSkillCodes = nodeBinding ? getEffectiveSkillCodes(nodeBinding) : [];
  const boundToolCodes = nodeBinding?.toolCodes?.filter((code) => code.trim().length > 0) ?? [];
  const runtimeProfileCode = nodeBinding?.runtimeProfileCode?.trim();
  const reviewPolicyCode = nodeBinding?.reviewPolicyCode?.trim();
  const IconComponent = ICON_MAP[nodeData.icon] || BarChart3;
  const techConfig = nodeData.techConfig ?? DEFAULT_TECH_CONFIG;
  const nodeAnnotations = annotations.filter((a) => a.nodeId === id);
  const unresolvedCount = nodeAnnotations.filter((a) => a.status !== "resolved").length;
  const isSelected = selectedNodeId === id;
  const nodeConf = allNodeConfidence.find((nc) => nc.nodeId === id);
  const isDeferred = deferredNodeIds.includes(id);
  const hasAnnotationContent = unresolvedCount > 0;
  const isSplitMode = viewMode === "tech" && jobSplitDraft.active;
  const isPickedForSplit = jobSplitDraft.selectedNodeIds.includes(id);
  const kindMeta = {
    sop_step: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    strategy_step: { label: "策略判断", className: "border-violet-200 bg-violet-50 text-violet-700" },
    workflow_step: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    agentic_judgment: { label: "策略判断", className: "border-violet-200 bg-violet-50 text-violet-700" },
    agentic_strategy: { label: "策略判断", className: "border-violet-200 bg-violet-50 text-violet-700" },
    agentic_generation: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    agentic_feedback: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    human_gate: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    manual_operation: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    business_judgment: { label: "策略判断", className: "border-violet-200 bg-violet-50 text-violet-700" },
    document_check: { label: "策略判断", className: "border-violet-200 bg-violet-50 text-violet-700" },
    handoff_wait: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
    rework_update: { label: "SOP 步骤", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
  }[nodeData.workUnitKind || "workflow_step"];


  const isFirstNode = nodeData.stepIndex === 1;
  if (nodeData.isCondition) {
    return (
      <div
        className="relative flex h-[210px] w-[260px] cursor-pointer items-center justify-center"
        onClick={() => setSelectedNodeId(id)}
      >
        <Handle type="target" position={Position.Top} id="top-in" className="!h-3 !w-3 !border-2 !border-white !bg-amber-300 transition-all hover:!scale-125 hover:!bg-amber-400" />
        <Handle type="source" position={Position.Bottom} id="bottom-out" className="!h-3 !w-3 !border-2 !border-white !bg-amber-300 transition-all hover:!scale-125 hover:!bg-amber-400" />
        <Handle type="target" position={Position.Left} id="left-in" className="!h-3 !w-3 !border-2 !border-white !bg-amber-300 transition-all hover:!scale-125 hover:!bg-amber-400" />
        <Handle type="source" position={Position.Left} id="left-out" className="!h-3 !w-3 !border-2 !border-white !bg-amber-300 transition-all hover:!scale-125 hover:!bg-amber-400" />
        <Handle type="target" position={Position.Right} id="right-in" className="!h-3 !w-3 !border-2 !border-white !bg-amber-300 transition-all hover:!scale-125 hover:!bg-amber-400" />
        <Handle type="source" position={Position.Right} id="right-out" className="!h-3 !w-3 !border-2 !border-white !bg-amber-300 transition-all hover:!scale-125 hover:!bg-amber-400" />

        <div
          className={`
            absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rotate-45
            rounded-[18px] border-2 bg-amber-50 shadow-sm transition-all duration-200 hover:shadow-md
            ${isSelected ? "border-amber-400 ring-2 ring-amber-100" : "border-amber-200"}
          `}
        />
        <div className="relative z-10 flex h-[120px] w-[170px] flex-col items-center justify-center text-center">
          <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm">
            <GitBranch className="h-4 w-4" />
          </div>
          <h3 className="max-w-[140px] text-sm font-semibold leading-snug text-zinc-900">{nodeData.label}</h3>
          <p className="mt-1 text-[10px] font-medium text-amber-700">路由节点 · 不运行</p>
          <p className="mt-1 max-w-[150px] text-[10px] leading-snug text-zinc-500">
            编译为 <span className="font-mono">flow.condition</span>
          </p>
        </div>

        {nodeData.conditionBranches && nodeData.conditionBranches.length > 0 ? (
          <div className="absolute -bottom-2 left-1/2 z-10 flex w-[250px] -translate-x-1/2 flex-wrap justify-center gap-1">
            {nodeData.conditionBranches.slice(0, 3).map((branch, i) => (
              <span
                key={`${branch.label}-${i}`}
                className="rounded-full border border-amber-100 bg-white px-2 py-0.5 text-[10px] text-zinc-600 shadow-sm"
              >
                {branch.icon} {branch.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const bindingMeta =
    taskType === "agentic"
      ? {
          label: "Skill 绑定:",
          values: boundSkillCodes,
          empty: "待配置",
        }
      : taskType === "integration"
        ? {
            label: "Tool 绑定:",
            values: boundToolCodes,
            empty: "待配置",
          }
        : taskType === "human_review"
          ? {
              label: "审核策略:",
              values: reviewPolicyCode ? [labelForReviewPolicyCode(reviewPolicyCode)] : [],
              empty: "待配置",
            }
          : {
              label: "执行器:",
              values: runtimeProfileCode ? [labelForRuntimeProfileCode(runtimeProfileCode)] : [],
              empty: "待配置",
            };

  return (
    <div
      className={`
        relative w-[320px] bg-white rounded-xl border-2 shadow-sm cursor-pointer
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
        ${isPickedForSplit ? "border-purple-500 ring-4 ring-purple-100" : isSelected ? "border-blue-400 ring-2 ring-blue-100" : unresolvedCount > 0 ? "border-red-200" : "border-zinc-200"}
      `}
      onClick={() => {
        if (isSplitMode) {
          toggleJobSplitNode(id);
          return;
        }
        setSelectedNodeId(id);
      }}
      {...(isFirstNode ? { "data-onboarding": "flow-node" } : {})}
    >
      {isSplitMode && (
        <div className="absolute -right-2 -top-2 z-20">
          <div
            className={`flex h-7 min-w-7 items-center justify-center rounded-full border-2 px-2 text-[11px] font-semibold shadow-sm ${
              isPickedForSplit
                ? "border-purple-500 bg-purple-600 text-white"
                : "border-purple-200 bg-white text-purple-500"
            }`}
          >
            {isPickedForSplit ? "已选" : "选"}
          </div>
        </div>
      )}
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
            {nodeData.inputs.map((input, index) => (
              <span
                key={input.id || input.inputId || `${input.name}-${index}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                  ${input.source === "user" ? "bg-blue-50 text-blue-700" : "bg-zinc-50 text-zinc-500"}`}
              >
                {input.icon} {input.name}
                {!input.required && (
                  <span className="rounded bg-white/70 px-1 text-[10px] text-zinc-400">可选</span>
                )}
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
            {nodeData.outputs.map((output, index) => (
              <span
                key={output.id || output.outputId || `${output.name}-${index}`}
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
            <span className="text-zinc-400">Task 类型:</span>
            <Badge variant="outline" className="text-[10px] h-5">
              {taskType}
            </Badge>
            <span className="text-zinc-400">{bindingMeta.label}</span>
            {bindingMeta.values.length > 0 ? (
              <Badge
                variant="outline"
                className="text-[10px] h-5 font-mono max-w-[180px] truncate"
                title={bindingMeta.values.join(", ")}
              >
                {bindingMeta.values.length === 1 ? bindingMeta.values[0] : `${bindingMeta.values.length} 项`}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-5 border-amber-200 bg-amber-50 text-amber-800">
                {bindingMeta.empty}
              </Badge>
            )}
            {taskType === "agentic" && techConfig.boundSkill && boundSkillCodes.length === 0 && (
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
