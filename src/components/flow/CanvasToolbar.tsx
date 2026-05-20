"use client";

import { useCallback } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { Trash2, Copy, Code2, SplitSquareHorizontal, X, Diamond, BriefcaseBusiness } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import JobSplitPanel from "@/components/panels/tech-workspace/JobSplitPanel";

const NEW_NODE_Y_GAP = 360;

function createDefaultNode(position: { x: number; y: number }): Node<FlowNodeData> {
  const id = `node-${Date.now()}`;
  return {
    id,
    type: "flowCard",
    position,
    data: {
      label: "新节点",
      icon: "Zap",
      description: "双击编辑这个节点的描述",
      stepIndex: 0,
      totalSteps: 0,
      executionMode: "ai_auto",
      estimatedTime: "待定",
      inputs: [],
      outputs: [],
      errorHandling: [
        { strategy: "retry", enabled: true, config: { maxRetries: 3, retryInterval: 30 } },
        { strategy: "human_fallback", enabled: false },
        { strategy: "skip", enabled: false },
        { strategy: "abort", enabled: false },
      ],
      techConfig: {
        executionType: "deterministic",
        feasibility: "pending",
      },
      isCondition: false,
    },
  };
}

function createConditionNode(position: { x: number; y: number }): Node<FlowNodeData> {
  const id = `condition-${Date.now()}`;
  return {
    id,
    type: "flowCard",
    position,
    data: {
      label: "条件分支",
      icon: "GitBranch",
      description: "根据上游 Task 的输出字段选择下一步路径；该节点不运行，也不会进入 JobSpec tasks[]。",
      stepIndex: 0,
      totalSteps: 0,
      executionMode: "ai_auto",
      estimatedTime: "不运行",
      inputs: [],
      outputs: [],
      errorHandling: [],
      techConfig: {
        executionType: "deterministic",
        feasibility: "confirmed",
      },
      isCondition: true,
      conditionBranches: [
        { label: "条件成立", icon: "✓", targetLabel: "选择目标节点" },
        { label: "otherwise", icon: "↯", targetLabel: "兜底路径" },
      ],
    },
  };
}

export default function CanvasToolbar() {
  const {
    nodes,
    selectedNodeId,
    addNode,
    deleteNode,
    currentRole,
    project,
    jobSplitDraft,
    setJobSplitDraft,
    resetJobSplitDraft,
  } = useFlowAgentStore();
  const isBusinessFlowReview =
    currentRole === "tech" &&
    (project.status === "pending_review" || project.status === "needs_revision");
  const isTech = currentRole === "tech" && !isBusinessFlowReview;

  const getNextPosition = useCallback(() => {
    const lastNode = nodes[nodes.length - 1];
    return lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + NEW_NODE_Y_GAP }
      : { x: 0, y: 0 };
  }, [nodes]);

  const handleAddTaskNode = useCallback(() => {
    addNode(createDefaultNode(getNextPosition()));
  }, [addNode, getNextPosition]);

  const handleAddConditionNode = useCallback(() => {
    addNode(createConditionNode(getNextPosition()));
  }, [addNode, getNextPosition]);

  const handleDeleteNode = useCallback(() => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
    }
  }, [selectedNodeId, deleteNode]);

  const handleDuplicateNode = useCallback(() => {
    if (!selectedNodeId) return;
    const sourceNode = nodes.find((n) => n.id === selectedNodeId);
    if (!sourceNode) return;

    const newNode: Node<FlowNodeData> = {
      ...sourceNode,
      id: `node-${Date.now()}`,
      position: {
        x: sourceNode.position.x + 60,
        y: sourceNode.position.y + 60,
      },
      data: {
        ...(sourceNode.data as unknown as FlowNodeData),
        label: `${(sourceNode.data as unknown as FlowNodeData).label}（副本）`,
      },
    };
    addNode(newNode);
  }, [selectedNodeId, nodes, addNode]);

  const toolbarBg = isTech ? "bg-slate-800 border-slate-700" : "bg-white border-zinc-200";
  const btnClass = isTech
    ? "text-slate-300 hover:bg-slate-700 whitespace-nowrap shrink-0"
    : "text-zinc-600 hover:bg-zinc-100 whitespace-nowrap shrink-0";
  const dividerClass = isTech ? "bg-slate-600" : "bg-zinc-200";

  return (
    <>
      <div
        className={`absolute top-3 left-1/2 -translate-x-1/2 z-40 flex select-none items-center gap-1 rounded-lg border shadow-sm px-1.5 py-1 ${toolbarBg}`}
      >
        {isTech && (
          <>
            <Code2 className="w-3.5 h-3.5 shrink-0 text-purple-400 ml-1" />
            <span className="text-[11px] text-slate-300 font-medium whitespace-nowrap">技术评审</span>
            <div className={`w-px h-5 ${dividerClass}`} />
          </>
        )}
        <button
          type="button"
          onClick={handleAddTaskNode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${btnClass} transition-colors`}
          title="添加会进入 JobSpec tasks[] 的工作节点"
        >
          <BriefcaseBusiness className="w-3.5 h-3.5" />
          工作节点
        </button>

        <button
          type="button"
          onClick={handleAddConditionNode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${btnClass} transition-colors`}
          title="添加不运行的条件分支节点，导出为 flow.condition"
        >
          <Diamond className="w-3.5 h-3.5" />
          路由节点
        </button>

        <div className={`w-px h-5 ${dividerClass}`} />

        <button
          type="button"
          onClick={handleDuplicateNode}
          disabled={!selectedNodeId}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${btnClass} transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
          title="复制选中节点"
        >
          <Copy className="w-3.5 h-3.5" />
          复制
        </button>

        <button
          type="button"
          onClick={handleDeleteNode}
          disabled={!selectedNodeId}
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 rounded-md text-xs font-medium ${isTech ? "text-red-400 hover:bg-red-900/30" : "text-red-500 hover:bg-red-50"} transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
          title="删除选中节点"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>

        {isTech ? (
          <>
            <div className={`w-px h-5 ${dividerClass}`} />
            <button
              type="button"
              onClick={() => {
                if (jobSplitDraft.active) {
                  resetJobSplitDraft();
                } else {
                  setJobSplitDraft({ active: true, selectedNodeIds: [], newJobName: "" });
                }
              }}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                jobSplitDraft.active
                  ? "bg-purple-500 text-white hover:bg-purple-400"
                  : btnClass
              }`}
              title="进入 Job 拆分模式，在画布上点选要拆出去的工作节点"
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              Job 拆分
            </button>
          </>
        ) : null}

      </div>

      {isTech && jobSplitDraft.active ? (
        <div className="absolute left-1/2 top-16 z-40 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <SplitSquareHorizontal className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">Job 拆分配置</p>
              <p className="mt-0.5 text-[11px] leading-5 text-zinc-500">
                在画布上点选要拆成另一份 Job 的工作节点，再命名并确认。
              </p>
            </div>
            <button
              type="button"
              onClick={resetJobSplitDraft}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              title="退出 Job 拆分模式"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[min(70vh,720px)] overflow-y-auto p-4">
            <JobSplitPanel />
          </div>
        </div>
      ) : null}
    </>
  );
}
