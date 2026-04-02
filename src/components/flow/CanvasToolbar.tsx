"use client";

import { useCallback } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { Plus, Trash2, Copy, Code2 } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";

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

export default function CanvasToolbar() {
  const { nodes, selectedNodeId, addNode, deleteNode, currentRole } = useFlowAgentStore();
  const isTech = currentRole === "tech";

  const handleAddNode = useCallback(() => {
    const lastNode = nodes[nodes.length - 1];
    const position = lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + 280 }
      : { x: 0, y: 0 };

    addNode(createDefaultNode(position));
  }, [nodes, addNode]);

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
    ? "text-slate-300 hover:bg-slate-700"
    : "text-zinc-600 hover:bg-zinc-100";
  const dividerClass = isTech ? "bg-slate-600" : "bg-zinc-200";

  return (
    <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-lg border shadow-sm px-1.5 py-1 ${toolbarBg}`}>
      {isTech && (
        <>
          <Code2 className="w-3.5 h-3.5 text-purple-400 ml-1" />
          <span className="text-[11px] text-slate-300 font-medium">技术评审</span>
          <div className={`w-px h-5 ${dividerClass}`} />
        </>
      )}
      <button
        onClick={handleAddNode}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${btnClass} transition-colors`}
        title="添加节点"
      >
        <Plus className="w-3.5 h-3.5" />
        添加节点
      </button>

      <div className={`w-px h-5 ${dividerClass}`} />

      <button
        onClick={handleDuplicateNode}
        disabled={!selectedNodeId}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${btnClass} transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
        title="复制选中节点"
      >
        <Copy className="w-3.5 h-3.5" />
        复制
      </button>

      <button
        onClick={handleDeleteNode}
        disabled={!selectedNodeId}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${isTech ? "text-red-400 hover:bg-red-900/30" : "text-red-500 hover:bg-red-50"} transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
        title="删除选中节点"
      >
        <Trash2 className="w-3.5 h-3.5" />
        删除
      </button>
    </div>
  );
}
