"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import FlowCardNode from "./FlowCardNode";
import CanvasToolbar from "./CanvasToolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { useFlowAgentStore } from "@/lib/store";
import type { FlowNodeData } from "@/lib/types";

type FlowNode = Node<FlowNodeData>;

export default function FlowCanvas() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    setSelectedNodeId,
    setEditingNodeId,
  } = useFlowAgentStore();

  const [nodes, setNodes] = useNodesState<FlowNode>(storeNodes as FlowNode[]);
  const [edges, setEdges] = useEdgesState(storeEdges);

  const nodeTypes = useMemo(() => ({ flowCard: FlowCardNode }), []);

  const prevStoreNodesRef = useRef(storeNodes);
  const prevStoreEdgesRef = useRef(storeEdges);

  useEffect(() => {
    if (storeNodes !== prevStoreNodesRef.current || storeEdges !== prevStoreEdgesRef.current) {
      setNodes(storeNodes as FlowNode[]);
      setEdges(storeEdges);
      prevStoreNodesRef.current = storeNodes;
      prevStoreEdgesRef.current = storeEdges;
    }
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      setNodes((prev) => {
        const updated = applyNodeChanges(changes, prev);

        const hasStructural = changes.some(
          (c) => c.type === "remove" || c.type === "add" || c.type === "replace"
        );
        const hasDragEnd = changes.some(
          (c) => c.type === "position" && c.dragging === false
        );

        if (hasStructural || hasDragEnd) {
          if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
          }
          prevStoreNodesRef.current = updated as Node<FlowNodeData>[];
          setStoreNodes(updated as Node<FlowNodeData>[]);
        }

        return updated;
      });
    },
    [setNodes, setStoreNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const updated = applyEdgeChanges(changes, prev);
        const hasStructural = changes.some(
          (c) => c.type === "remove" || c.type === "add" || c.type === "replace"
        );
        if (hasStructural) {
          prevStoreEdgesRef.current = updated;
          setStoreEdges(updated);
        }
        return updated;
      });
    },
    [setEdges, setStoreEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds: Edge[]) => {
        const newEdges = addEdge(
          { ...params, animated: true, style: { stroke: "#94a3b8" }, label: "" },
          eds
        );
        prevStoreEdgesRef.current = newEdges;
        setStoreEdges(newEdges);
        return newEdges;
      });
    },
    [setEdges, setStoreEdges]
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
      setEditingNodeId(node.id);
    },
    [setSelectedNodeId, setEditingNodeId]
  );

  const isEmpty = nodes.length === 0;

  return (
    <div className="w-full h-full relative">
      <CanvasToolbar />
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <EmptyState
            icon={<svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" /></svg>}
            title="还没有流程图"
            description="在左侧对话框输入业务描述，AI 会自动生成方案流程图"
            className="bg-white/80 rounded-2xl px-8 py-10 shadow-sm border border-zinc-100"
          />
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode="Backspace"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e4e7" />
        <Controls className="!bg-white !border-zinc-200 !shadow-sm" />
        <MiniMap
          className="!bg-white !border-zinc-200"
          nodeColor="#e4e4e7"
          maskColor="rgba(255,255,255,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
