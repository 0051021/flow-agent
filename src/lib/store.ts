import { create } from "zustand";
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
  resetAll: () => void;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const useFlowAgentStore = create<FlowAgentState>((set) => ({
  project: {
    id: "demo-1",
    name: "",
    description: "",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  currentRole: "business",
  viewMode: "business",
  nodes: [],
  edges: [],
  annotations: [],
  knowledgeFiles: MOCK_KNOWLEDGE_FILES,
  selectedNodeId: null,
  editingNodeId: null,
  showAnnotationPanel: false,
  showKnowledgePanel: false,
  chatMessages: [],

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
    })),
  updateNodeData: (nodeId, partial) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...partial } as FlowNodeData }
          : n
      ),
    })),
  resetAll: () =>
    set({
      project: {
        id: "demo-1",
        name: "",
        description: "",
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      currentRole: "business",
      viewMode: "business",
      nodes: [],
      edges: [],
      annotations: [],
      selectedNodeId: null,
      editingNodeId: null,
      showAnnotationPanel: false,
      showKnowledgePanel: false,
      chatMessages: [],
    }),
}));
