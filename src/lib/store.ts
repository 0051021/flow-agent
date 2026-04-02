import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Annotation,
  AnnotationReply,
  FlowNodeData,
  KnowledgeFile,
  Project,
  ProjectStatus,
  UserRole,
  ViewMode,
} from "./types";
import type { Node, Edge } from "@xyflow/react";
import { MOCK_KNOWLEDGE_FILES } from "./mock-data";

export type ChatPhase =
  | "idle"
  | "drafting"
  | "questioning"
  | "refining_node"
  | "ready"
  | "refining";

export interface NodeQuestion {
  id: string;
  question: string;
  context: string;
  defaultSuggestion: string;
  options?: string[];
}

export interface NodeConfidence {
  nodeId: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  questions: NodeQuestion[];
}

interface FlowAgentState {
  project: Project;
  currentRole: UserRole;
  viewMode: ViewMode;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  annotations: Annotation[];
  knowledgeFiles: KnowledgeFile[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  showAnnotationPanel: boolean;
  showKnowledgePanel: boolean;
  chatMessages: ChatMessage[];

  chatPhase: ChatPhase;
  originalPrompt: string;
  pendingNodes: NodeConfidence[];
  currentNodeIdx: number;
  nodeLabelMap: Record<string, string>;
  initQuery: string | null;

  setCurrentRole: (role: UserRole) => void;
  setViewMode: (mode: ViewMode) => void;
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setShowAnnotationPanel: (show: boolean) => void;
  setShowKnowledgePanel: (show: boolean) => void;
  setProjectStatus: (status: ProjectStatus) => void;
  addAnnotation: (annotation: Annotation) => void;
  addReply: (annotationId: string, reply: AnnotationReply) => void;
  updateAnnotationStatus: (
    annotationId: string,
    status: Annotation["status"]
  ) => void;
  addChatMessage: (message: ChatMessage) => void;
  loadGeneratedFlow: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  onNodesChangeSync: (nodes: Node<FlowNodeData>[]) => void;
  onEdgesChangeSync: (edges: Edge[]) => void;
  addNode: (node: Node<FlowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  setChatPhase: (phase: ChatPhase) => void;
  setOriginalPrompt: (prompt: string) => void;
  setPendingNodes: (nodes: NodeConfidence[]) => void;
  setCurrentNodeIdx: (idx: number) => void;
  setNodeLabelMap: (map: Record<string, string>) => void;
  setInitQuery: (query: string | null) => void;
  resetAll: () => void;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const initialState = {
  project: {
    id: "demo-1",
    name: "",
    description: "",
    status: "draft" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  currentRole: "business" as const,
  viewMode: "business" as const,
  nodes: [] as Node<FlowNodeData>[],
  edges: [] as Edge[],
  annotations: [] as Annotation[],
  knowledgeFiles: MOCK_KNOWLEDGE_FILES,
  selectedNodeId: null,
  editingNodeId: null,
  showAnnotationPanel: false,
  showKnowledgePanel: false,
  chatMessages: [] as ChatMessage[],
  chatPhase: "idle" as ChatPhase,
  originalPrompt: "",
  pendingNodes: [] as NodeConfidence[],
  currentNodeIdx: 0,
  nodeLabelMap: {} as Record<string, string>,
  initQuery: null as string | null,
};

export const useFlowAgentStore = create<FlowAgentState>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentRole: (role) =>
        set({ currentRole: role, viewMode: role === "tech" ? "tech" : "business" }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setEditingNodeId: (id) => set({ editingNodeId: id }),
      setShowAnnotationPanel: (show) => set({ showAnnotationPanel: show }),
      setShowKnowledgePanel: (show) => set({ showKnowledgePanel: show }),
      setProjectStatus: (status) =>
        set((state) => ({
          project: { ...state.project, status, updatedAt: new Date().toISOString() },
        })),
      addAnnotation: (annotation) =>
        set((state) => ({ annotations: [...state.annotations, annotation] })),
      addReply: (annotationId, reply) =>
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === annotationId ? { ...a, replies: [...a.replies, reply] } : a
          ),
        })),
      updateAnnotationStatus: (annotationId, status) =>
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === annotationId ? { ...a, status } : a
          ),
        })),
      addChatMessage: (message) =>
        set((state) => ({ chatMessages: [...state.chatMessages, message] })),
      loadGeneratedFlow: (nodes, edges) =>
        set((state) => ({
          nodes,
          edges,
          project: {
            ...state.project,
            status: "business_editing",
            updatedAt: new Date().toISOString(),
          },
        })),
      onNodesChangeSync: (nodes) => set({ nodes }),
      onEdgesChangeSync: (edges) => set({ edges }),
      addNode: (node) =>
        set((state) => ({ nodes: [...state.nodes, node] })),
      deleteNode: (nodeId) =>
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== nodeId),
          edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
          editingNodeId: state.editingNodeId === nodeId ? null : state.editingNodeId,
        })),
      updateNodeData: (nodeId, partial) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, ...partial } as FlowNodeData }
              : n
          ),
        })),
      setChatPhase: (phase) => set({ chatPhase: phase }),
      setOriginalPrompt: (prompt) => set({ originalPrompt: prompt }),
      setPendingNodes: (nodes) => set({ pendingNodes: nodes }),
      setCurrentNodeIdx: (idx) => set({ currentNodeIdx: idx }),
      setNodeLabelMap: (map) => set({ nodeLabelMap: map }),
      setInitQuery: (query) => set({ initQuery: query }),
      resetAll: () =>
        set({
          ...initialState,
          knowledgeFiles: MOCK_KNOWLEDGE_FILES,
        }),
    }),
    {
      name: "flow-agent-store",
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        if (version === 0 || !persisted) return { ...initialState, ...(persisted as Record<string, unknown>) };
        return persisted as FlowAgentState;
      },
      partialize: (state) => ({
        project: state.project,
        currentRole: state.currentRole,
        viewMode: state.viewMode,
        nodes: state.nodes,
        edges: state.edges,
        annotations: state.annotations,
        chatMessages: state.chatMessages,
        chatPhase: state.chatPhase,
        originalPrompt: state.originalPrompt,
        pendingNodes: state.pendingNodes,
        currentNodeIdx: state.currentNodeIdx,
        nodeLabelMap: state.nodeLabelMap,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { chatPhase, pendingNodes, currentNodeIdx, nodes } = state;
        if (chatPhase === "drafting" || chatPhase === "refining_node" || chatPhase === "refining") {
          const recovered = pendingNodes.length > 0 && currentNodeIdx < pendingNodes.length
            ? "questioning" as ChatPhase
            : (nodes.length > 0 ? "ready" as ChatPhase : "idle" as ChatPhase);
          useFlowAgentStore.setState({ chatPhase: recovered });
        }
      },
    }
  )
);
