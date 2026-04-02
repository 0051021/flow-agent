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
import { useFlowAgentStore } from "@/lib/store";
import type { FlowNodeData } from "@/lib/types";

type FlowNode = Node<FlowNodeData>;

export default function FlowCanvas() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    onNodesChangeSync,
    onEdgesChangeSync,
    setSelectedNodeId,
    setEditingNodeId,
  } = useFlowAgentStore();
  const [nodes, setNodes] = useNodesState<FlowNode>(storeNodes as FlowNode[]);
  const [edges, setEdges] = useEdgesState(storeEdges);
  const prevStoreNodesRef = useRef(storeNodes);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodeTypes = useMemo(() => ({ flowCard: FlowCardNode }), []);

  useEffect(() => {
    if (storeNodes !== prevStoreNodesRef.current) {
      setNodes(storeNodes as FlowNode[]);
      setEdges(storeEdges);
      prevStoreNodesRef.current = storeNodes;
    }
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const debouncedSyncNodes = useCallback(
    (updated: FlowNode[]) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        onNodesChangeSync(updated as Node<FlowNodeData>[]);
      }, 100);
    },
    [onNodesChangeSync]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      setNodes((prev) => {
        const updated = applyNodeChanges(changes, prev);
        const hasStructuralChange = changes.some(
          (c) => c.type === "remove" || c.type === "add" || c.type === "replace"
        );
        const hasDrag = changes.some((c) => c.type === "position" && c.dragging === false);
        if (hasStructuralChange || hasDrag) {
          debouncedSyncNodes(updated);
        }
        return updated;
      });
    },
    [setNodes, debouncedSyncNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const updated = applyEdgeChanges(changes, prev);
        const hasStructuralChange = changes.some(
          (c) => c.type === "remove" || c.type === "add" || c.type === "replace"
        );
        if (hasStructuralChange) {
          setTimeout(() => onEdgesChangeSync(updated), 0);
        }
        return updated;
      });
    },
    [setEdges, onEdgesChangeSync]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds: Edge[]) => {
        const newEdges = addEdge(
          { ...params, animated: true, style: { stroke: "#94a3b8" }, label: "" },
          eds
        );
        setTimeout(() => onEdgesChangeSync(newEdges), 0);
        return newEdges;
      });
    },
    [setEdges, onEdgesChangeSync]
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
      setEditingNodeId(node.id);
    },
    [setSelectedNodeId, setEditingNodeId]
  );

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <CanvasToolbar />
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
