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
  PanOnScrollMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import FlowCardNode from "./FlowCardNode";
import EditableEdge, { triggerEdgeEdit } from "./EditableEdge";
import CanvasToolbar from "./CanvasToolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { useFlowAgentStore } from "@/lib/store";
import type { FlowNodeData } from "@/lib/types";
import { loadGsdsDemo } from "@/lib/gsds-demo-loader";
import SequenceDiagramView from "@/components/panels/SequenceDiagramView";
import { cn } from "@/lib/utils";

type FlowNode = Node<FlowNodeData>;

function TechCanvasViewTabs({ belowToolbar }: { belowToolbar?: boolean }) {
  const techCanvasView = useFlowAgentStore((s) => s.techCanvasView);
  const setTechCanvasView = useFlowAgentStore((s) => s.setTechCanvasView);

  /** 与 CanvasToolbar 错层：避免两者同 top、同居中叠在一起挡住「技术评审」等 */
  return (
    <div
      className={cn(
        "absolute left-1/2 z-30 -translate-x-1/2 pointer-events-none flex justify-center px-2",
        belowToolbar ? "top-[52px]" : "top-3"
      )}
    >
      <div
        className={cn(
          "pointer-events-auto inline-flex rounded-xl border border-zinc-200/90 bg-white/85 backdrop-blur-md",
          "p-1 gap-0.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
        )}
        role="tablist"
        aria-label="画布视图"
      >
        <button
          type="button"
          role="tab"
          aria-selected={techCanvasView === "flow"}
          onClick={() => setTechCanvasView("flow")}
          className={cn(
            "rounded-[10px] px-4 py-2 text-[12px] font-medium transition-colors min-w-[88px]",
            techCanvasView === "flow"
              ? "bg-zinc-900 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100/90"
          )}
        >
          流程图
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={techCanvasView === "sequence"}
          onClick={() => setTechCanvasView("sequence")}
          className={cn(
            "rounded-[10px] px-4 py-2 text-[12px] font-medium transition-colors min-w-[88px]",
            techCanvasView === "sequence"
              ? "bg-zinc-900 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100/90"
          )}
        >
          时序图
        </button>
      </div>
    </div>
  );
}

export default function FlowCanvas() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    setSelectedNodeId,
    currentRole,
    techCanvasView,
    techConfig,
  } = useFlowAgentStore();

  const isTech = currentRole === "tech";
  const showReactFlow = !isTech || techCanvasView === "flow";
  const sequenceDiagram = techConfig.overview?.sequenceDiagram;

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
    },
    [setSelectedNodeId]
  );

  const styledEdges = useMemo(
    () => edges.map((e) => ({
      ...e,
      type: "editable",
      sourceHandle: e.sourceHandle ?? "bottom-out",
      targetHandle: e.targetHandle ?? "top-in",
    })),
    [edges]
  );

  const isEmpty = nodes.length === 0;

  return (
    <div className="w-full h-full min-h-0 flex flex-col relative">
      {isTech ? <TechCanvasViewTabs belowToolbar={showReactFlow} /> : null}

      {showReactFlow ? (
        <div className="flex-1 min-h-0 relative w-full">
          <CanvasToolbar />
          {isEmpty ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="bg-white/80 rounded-2xl px-8 py-10 shadow-sm border border-zinc-100 flex flex-col items-center gap-5">
                <EmptyState
                  icon={<svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" /></svg>}
                  title="还没有流程图"
                  description="在左侧对话框输入业务描述，AI 会自动生成方案流程图"
                />
                <button
                  type="button"
                  className="pointer-events-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-sm"
                  onClick={loadGsdsDemo}
                >
                  加载示例：GSDS 入库流程
                </button>
              </div>
            </div>
          ) : null}
          <ReactFlow
            className="!absolute inset-0"
            nodes={nodes}
            edges={styledEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={(_event, edge) => triggerEdgeEdit(edge.id)}
            onInit={(instance) => { rfInstanceRef.current = instance; }}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={1.5}
            panOnScroll
            panOnScrollMode={PanOnScrollMode.Free}
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
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
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-zinc-50/80 pt-14 pb-6 px-4">
          {sequenceDiagram && sequenceDiagram.messages?.length ? (
            <div className="max-w-5xl mx-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <SequenceDiagramView data={sequenceDiagram} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[280px] text-center text-[13px] text-zinc-500 px-6">
              <p>暂无序列图数据。</p>
              <p className="text-[11px] text-zinc-400 mt-2">请先通过 AI 生成技术方案，或加载带序列图的示例流程。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
