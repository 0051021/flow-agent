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
  type Connection,
  type Edge,
  type Node,
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
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(storeNodes as FlowNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
  const prevStoreNodesRef = useRef(storeNodes);

  const nodeTypes = useMemo(() => ({ flowCard: FlowCardNode }), []);

  useEffect(() => {
    if (storeNodes !== prevStoreNodesRef.current) {
      setNodes(storeNodes as FlowNode[]);
      setEdges(storeEdges);
      prevStoreNodesRef.current = storeNodes;
    }
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const onNodeDragStop = useCallback(() => {
    onNodesChangeSync(nodes as Node<FlowNodeData>[]);
  }, [nodes, onNodesChangeSync]);

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

  const onEdgeDelete = useCallback(() => {
    setTimeout(() => onEdgesChangeSync(edges), 0);
  }, [edges, onEdgesChangeSync]);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
      setEditingNodeId(node.id);
    },
    [setSelectedNodeId, setEditingNodeId]
  );

  return (
    <div className="w-full h-full relative">
      <CanvasToolbar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgeDelete}
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
