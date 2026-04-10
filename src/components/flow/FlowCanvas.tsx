"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import FlowCardNode from "./FlowCardNode";
import EditableEdge from "./EditableEdge";
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
  const edgeTypes = useMemo(() => ({ editable: EditableEdge }), []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfInstanceRef = useRef<ReactFlowInstance<any, any> | null>(null);
  const prevStoreNodesRef = useRef(storeNodes);
  const prevStoreEdgesRef = useRef(storeEdges);
  const prevNodeCountRef = useRef(storeNodes.length);

  useEffect(() => {
    if (storeNodes !== prevStoreNodesRef.current || storeEdges !== prevStoreEdgesRef.current) {
      const wasEmpty = prevNodeCountRef.current === 0;
      setNodes(storeNodes as FlowNode[]);
      setEdges(storeEdges);
      prevStoreNodesRef.current = storeNodes;
      prevStoreEdgesRef.current = storeEdges;
      prevNodeCountRef.current = storeNodes.length;

      if (wasEmpty && storeNodes.length > 0 && rfInstanceRef.current) {
        requestAnimationFrame(() => rfInstanceRef.current?.fitView({ padding: 0.3, duration: 300 }));
      }
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
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          const snapshot = updated as Node<FlowNodeData>[];
          syncTimerRef.current = setTimeout(() => {
            syncTimerRef.current = null;
            prevStoreNodesRef.current = snapshot;
            setStoreNodes(snapshot);
          }, 200);
        }

        return updated;
      });
    },
    [setNodes, setStoreNodes]
  );

  const edgeSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (edgeSyncRef.current) clearTimeout(edgeSyncRef.current); }; }, []);

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const updated = applyEdgeChanges(changes, prev);
        const hasStructural = changes.some(
          (c) => c.type === "remove" || c.type === "add" || c.type === "replace"
        );
        if (hasStructural) {
          if (edgeSyncRef.current) clearTimeout(edgeSyncRef.current);
          edgeSyncRef.current = setTimeout(() => {
            edgeSyncRef.current = null;
            prevStoreEdgesRef.current = updated;
            setStoreEdges(updated);
          }, 200);
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
        setTimeout(() => setStoreEdges(newEdges), 0);
        return newEdges;
      });
    },
    [setEdges, setStoreEdges]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => {
        const updated = reconnectEdge(oldEdge, newConnection, eds);
        prevStoreEdgesRef.current = updated;
        setTimeout(() => setStoreEdges(updated), 0);
        return updated;
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

  const styledEdges = useMemo(
    () => edges.map((e) => ({ ...e, type: "editable" })),
    [edges]
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
        edges={styledEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onInit={(instance) => { rfInstanceRef.current = instance; }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "editable",
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode="Backspace"
        edgesReconnectable
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
