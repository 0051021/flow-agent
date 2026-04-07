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
  TaskType,
  AgenticTaskConfig,
  AgenticSkill,
  AgenticConstraint,
  AgenticEvaluator,
  AgenticConfirmItem,
} from "./types";
import type { Node, Edge } from "@xyflow/react";
import { MOCK_KNOWLEDGE_FILES } from "./mock-data";

export type ChatPhase =
  | "idle"
  | "classifying"
  | "drafting"
  | "questioning"
  | "refining_node"
  | "ready"
  | "refining"
  | "drafting_agentic"
  | "confirming_agentic"
  | "agentic_ready"
  | "refining_agentic";

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

  taskType: TaskType;
  agenticConfig: AgenticTaskConfig | null;
  agenticConfirmItems: AgenticConfirmItem[];
  agenticConfirmIdx: number;
  isReviewMode: boolean;
  collectedAnswers: Record<string, { question: string; answer: string }[]>;
  initialSnapshot: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null;
  allNodeConfidence: NodeConfidence[];
  deferredNodeIds: string[];

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

  setTaskType: (type: TaskType) => void;
  setAgenticConfig: (config: AgenticTaskConfig | null) => void;
  setAgenticConfirmItems: (items: AgenticConfirmItem[]) => void;
  setAgenticConfirmIdx: (idx: number) => void;
  setIsReviewMode: (v: boolean) => void;
  setCollectedAnswers: (answers: Record<string, { question: string; answer: string }[]>) => void;
  addCollectedAnswer: (nodeId: string, answers: { question: string; answer: string }[]) => void;
  setInitialSnapshot: (snapshot: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null) => void;
  setAllNodeConfidence: (conf: NodeConfidence[]) => void;
  setDeferredNodeIds: (ids: string[]) => void;
  addDeferredNodeId: (id: string) => void;
  removeDeferredNodeId: (id: string) => void;
  updateAgenticGoal: (goal: string) => void;
  updateAgenticBackground: (background: string) => void;
  addAgenticSkill: (skill: AgenticSkill) => void;
  removeAgenticSkill: (skillId: string) => void;
  addAgenticConstraint: (constraint: AgenticConstraint) => void;
  removeAgenticConstraint: (constraintId: string) => void;
  updateAgenticEvaluator: (evaluator: AgenticEvaluator) => void;
  removeAgenticEvaluator: (evaluatorId: string) => void;

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
  taskType: "workflow" as TaskType,
  agenticConfig: null as AgenticTaskConfig | null,
  agenticConfirmItems: [] as AgenticConfirmItem[],
  agenticConfirmIdx: 0,
  isReviewMode: false,
  collectedAnswers: {} as Record<string, { question: string; answer: string }[]>,
  initialSnapshot: null as { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null,
  allNodeConfidence: [] as NodeConfidence[],
  deferredNodeIds: [] as string[],
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

      setTaskType: (type) => set({ taskType: type }),
      setAgenticConfig: (config) => set({ agenticConfig: config }),
      setAgenticConfirmItems: (items) => set({ agenticConfirmItems: items }),
      setAgenticConfirmIdx: (idx) => set({ agenticConfirmIdx: idx }),
      setIsReviewMode: (v) => set({ isReviewMode: v }),
      setCollectedAnswers: (answers) => set({ collectedAnswers: answers }),
      addCollectedAnswer: (nodeId, answers) =>
        set((state) => ({
          collectedAnswers: { ...state.collectedAnswers, [nodeId]: answers },
        })),
      setInitialSnapshot: (snapshot) => set({ initialSnapshot: snapshot }),
      setAllNodeConfidence: (conf) => set({ allNodeConfidence: conf }),
      setDeferredNodeIds: (ids) => set({ deferredNodeIds: ids }),
      addDeferredNodeId: (id) =>
        set((state) => ({
          deferredNodeIds: state.deferredNodeIds.includes(id)
            ? state.deferredNodeIds
            : [...state.deferredNodeIds, id],
        })),
      removeDeferredNodeId: (id) =>
        set((state) => ({
          deferredNodeIds: state.deferredNodeIds.filter((d) => d !== id),
        })),
      updateAgenticGoal: (goal) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, goal }
            : null,
        })),
      updateAgenticBackground: (background) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, background }
            : null,
        })),
      addAgenticSkill: (skill) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, skills: [...state.agenticConfig.skills, skill] }
            : null,
        })),
      removeAgenticSkill: (skillId) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, skills: state.agenticConfig.skills.filter((s) => s.id !== skillId) }
            : null,
        })),
      addAgenticConstraint: (constraint) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, constraints: [...state.agenticConfig.constraints, constraint] }
            : null,
        })),
      removeAgenticConstraint: (constraintId) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, constraints: state.agenticConfig.constraints.filter((c) => c.id !== constraintId) }
            : null,
        })),
      updateAgenticEvaluator: (evaluator) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? {
                ...state.agenticConfig,
                evaluators: state.agenticConfig.evaluators.some((e) => e.id === evaluator.id)
                  ? state.agenticConfig.evaluators.map((e) => (e.id === evaluator.id ? evaluator : e))
                  : [...state.agenticConfig.evaluators, evaluator],
              }
            : null,
        })),
      removeAgenticEvaluator: (evaluatorId) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, evaluators: state.agenticConfig.evaluators.filter((e) => e.id !== evaluatorId) }
            : null,
        })),

      resetAll: () =>
        set({
          ...initialState,
          knowledgeFiles: MOCK_KNOWLEDGE_FILES,
        }),
    }),
    {
      name: "flow-agent-store",
      version: 2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any, version: number) => {
        if (version < 2 || !persisted) {
          return { ...initialState, ...persisted, taskType: "workflow", agenticConfig: null };
        }
        return persisted;
      },
      partialize: (state) => ({
        project: state.project,
        currentRole: state.currentRole,
        viewMode: state.viewMode,
        nodes: state.nodes,
        edges: state.edges,
        chatMessages: state.chatMessages,
        chatPhase: state.chatPhase,
        originalPrompt: state.originalPrompt,
        pendingNodes: state.pendingNodes,
        currentNodeIdx: state.currentNodeIdx,
        nodeLabelMap: state.nodeLabelMap,
        taskType: state.taskType,
        agenticConfig: state.agenticConfig,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { chatPhase, pendingNodes, currentNodeIdx, nodes, agenticConfig } = state;
        const unstablePhases: ChatPhase[] = [
          "drafting", "refining_node", "refining",
          "classifying", "drafting_agentic", "refining_agentic",
          "confirming_agentic",
        ];
        if (unstablePhases.includes(chatPhase)) {
          let recovered: ChatPhase;
          if (agenticConfig) {
            recovered = "agentic_ready";
          } else if (pendingNodes.length > 0 && currentNodeIdx < pendingNodes.length) {
            recovered = "questioning";
          } else if (nodes.length > 0) {
            recovered = "ready";
          } else {
            recovered = "idle";
          }
          useFlowAgentStore.setState({
            chatPhase: recovered,
            agenticConfirmItems: [],
            agenticConfirmIdx: 0,
            collectedAnswers: {},
            deferredNodeIds: [],
          });
        }
      },
    }
  )
);
