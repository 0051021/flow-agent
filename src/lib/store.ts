import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Annotation,
  AnnotationReply,
  FileAttachment,
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
  AgenticPhase,
  AgenticPhaseStatus,
  Notification,
  BusinessSubmission,
  TechConfig,
  TechTabId,
  TechTabStatus,
  TechOverviewData,
  TechDocumentsData,
  TechExternalsData,
  TechGuardsData,
  TechDeploymentData,
  TechBindingState,
  AdaptiveConfigState,
  JobGroup,
  GlobalResourceBindings,
  DocumentBindingEntry,
  ExternalSystemBindingEntry,
  NodeBindingEntry,
  TechJobSpecMeta,
} from "./types";
import { createDefaultTechBindingState, createDefaultAdaptiveConfig } from "./tech-binding-helpers";
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

export type GenerationStage =
  | "idle"
  | "classify_start"
  | "classify_done"
  | "draft_start"
  | "draft_done";

export interface EnrichProgress {
  total: number;
  done: number;
  status: "idle" | "running" | "done";
}

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
  currentReviewId: string | null;
  businessSubmissions: BusinessSubmission[];
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
  initFiles: ChatAttachment[];

  taskType: TaskType;
  agenticConfig: AgenticTaskConfig | null;
  agenticConfirmItems: AgenticConfirmItem[];
  agenticConfirmIdx: number;
  isReviewMode: boolean;
  collectedAnswers: Record<string, { question: string; answer: string }[]>;
  initialSnapshot: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null;
  allNodeConfidence: NodeConfidence[];
  deferredNodeIds: string[];
  showNodeQuestions: boolean;
  generationStage: GenerationStage;
  enrichProgress: EnrichProgress;

  // Notifications
  notifications: Notification[];

  // Tech-side multi-tab config
  techConfig: TechConfig;

  /** Editable resource bindings (FlowAgent-only; maps to JobSpec on export) */
  techBindings: TechBindingState;
  adaptiveConfig: AdaptiveConfigState;
  /** Confirmed Job split group; null if single-job flow */
  jobGroup: JobGroup | null;

  /** JobSpec-level metadata (tech workspace) */
  techJobMeta: TechJobSpecMeta;
  /** Trigger codes registered on task-platform */
  jobTriggerCodes: string[];
  /** Tech canvas: flow diagram vs sequence diagram */
  techCanvasView: "flow" | "sequence";

  setCurrentRole: (role: UserRole) => void;
  setViewMode: (mode: ViewMode) => void;
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setShowAnnotationPanel: (show: boolean) => void;
  setShowKnowledgePanel: (show: boolean) => void;
  setProjectStatus: (status: ProjectStatus) => void;
  setCurrentReviewId: (reviewId: string | null) => void;
  upsertBusinessSubmission: (submission: BusinessSubmission) => void;
  updateBusinessSubmission: (submissionId: string, patch: Partial<BusinessSubmission>) => void;
  updateBusinessSubmissionProgress: (
    submissionId: string,
    progress: BusinessSubmission["techProgress"]
  ) => void;
  addAnnotation: (annotation: Annotation) => void;
  addReply: (annotationId: string, reply: AnnotationReply) => void;
  updateAnnotationStatus: (
    annotationId: string,
    status: Annotation["status"]
  ) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, content: string) => void;
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
  setInitFiles: (files: ChatAttachment[]) => void;

  setTaskType: (type: TaskType) => void;
  setAgenticConfig: (config: AgenticTaskConfig | null) => void;
  updateAgenticField: <K extends keyof AgenticTaskConfig>(field: K, value: AgenticTaskConfig[K]) => void;
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
  setShowNodeQuestions: (show: boolean) => void;
  setGenerationStage: (stage: GenerationStage) => void;
  setEnrichProgress: (progress: EnrichProgress) => void;

  // Notifications
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  // Tech config tabs
  setTechTabStatus: (tab: TechTabId, status: TechTabStatus, error?: string) => void;
  setTechOverview: (data: TechOverviewData) => void;
  setTechDocuments: (data: TechDocumentsData) => void;
  setTechExternals: (data: TechExternalsData) => void;
  setTechGuards: (data: TechGuardsData) => void;
  setTechDeployment: (data: TechDeploymentData) => void;
  resetTechConfig: () => void;

  setTechBindingsGlobal: (partial: Partial<GlobalResourceBindings>) => void;
  setDocumentBinding: (docId: string, partial: Partial<DocumentBindingEntry>) => void;
  setExternalBinding: (extId: string, partial: Partial<ExternalSystemBindingEntry>) => void;
  setNodeBinding: (nodeId: string, partial: Partial<NodeBindingEntry>) => void;
  setAdaptiveConfig: (partial: Partial<AdaptiveConfigState>) => void;
  setJobGroup: (group: JobGroup | null) => void;
  resetTechBindings: () => void;

  setTechJobMeta: (partial: Partial<TechJobSpecMeta>) => void;
  setJobTriggerCodes: (codes: string[]) => void;
  setTechCanvasView: (view: "flow" | "sequence") => void;

  updateAgenticGoal: (goal: string) => void;
  updateAgenticBackground: (background: string) => void;
  addAgenticSkill: (skill: AgenticSkill) => void;
  removeAgenticSkill: (skillId: string) => void;
  addAgenticConstraint: (constraint: AgenticConstraint) => void;
  removeAgenticConstraint: (constraintId: string) => void;
  updateAgenticEvaluator: (evaluator: AgenticEvaluator) => void;
  removeAgenticEvaluator: (evaluatorId: string) => void;

  // Phase management (v3)
  updatePhase: (phaseId: string, patch: Partial<AgenticPhase>) => void;
  confirmPhase: (phaseId: string) => void;
  confirmAllPhases: () => void;
  setPhaseStatus: (phaseId: string, status: AgenticPhaseStatus) => void;
  answerPhaseQuestion: (phaseId: string, questionId: string, answer: string) => void;
  addPhase: (phase: AgenticPhase) => void;
  removePhase: (phaseId: string) => void;

  resetAll: () => void;
}

export type ChatAttachment = FileAttachment;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
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
  currentReviewId: null as string | null,
  businessSubmissions: [] as BusinessSubmission[],
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
  initFiles: [] as ChatAttachment[],
  taskType: "workflow" as TaskType,
  agenticConfig: null as AgenticTaskConfig | null,
  agenticConfirmItems: [] as AgenticConfirmItem[],
  agenticConfirmIdx: 0,
  isReviewMode: false,
  collectedAnswers: {} as Record<string, { question: string; answer: string }[]>,
  initialSnapshot: null as { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null,
  allNodeConfidence: [] as NodeConfidence[],
  deferredNodeIds: [] as string[],
  showNodeQuestions: false,
  generationStage: "idle" as GenerationStage,
  enrichProgress: { total: 0, done: 0, status: "idle" } as EnrichProgress,
  notifications: [] as Notification[],
  techConfig: {
    overview: null,
    documents: null,
    externals: null,
    guards: null,
    deployment: null,
    tabStates: {
      overview: { status: "idle" as const },
      documents: { status: "idle" as const },
      externals: { status: "idle" as const },
      guards: { status: "idle" as const },
      deployment: { status: "idle" as const },
    },
  } as TechConfig,
  techBindings: createDefaultTechBindingState(),
  adaptiveConfig: createDefaultAdaptiveConfig(),
  jobGroup: null as JobGroup | null,
  techJobMeta: {
    code: "",
    name: "",
    description: "",
    inputSchemaJson: "",
    defaultRuntimeProfileCode: "",
    defaultReviewPolicyCode: "",
  } as TechJobSpecMeta,
  jobTriggerCodes: [] as string[],
  techCanvasView: "flow" as const,
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
      setCurrentReviewId: (reviewId) => set({ currentReviewId: reviewId }),
      upsertBusinessSubmission: (submission) =>
        set((state) => {
          const idx = state.businessSubmissions.findIndex((s) => s.id === submission.id);
          if (idx >= 0) {
            const cloned = [...state.businessSubmissions];
            cloned[idx] = submission;
            return { businessSubmissions: cloned };
          }
          return { businessSubmissions: [submission, ...state.businessSubmissions] };
        }),
      updateBusinessSubmission: (submissionId, patch) =>
        set((state) => ({
          businessSubmissions: state.businessSubmissions.map((s) =>
            s.id === submissionId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
          ),
        })),
      updateBusinessSubmissionProgress: (submissionId, progress) =>
        set((state) => ({
          businessSubmissions: state.businessSubmissions.map((s) =>
            s.id === submissionId
              ? { ...s, techProgress: progress, updatedAt: new Date().toISOString() }
              : s
          ),
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
      updateChatMessage: (id, content) =>
        set((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        })),
      loadGeneratedFlow: (nodes, edges) =>
        set((state) => ({
          nodes,
          edges,
          project: {
            ...state.project,
            status: state.project.status === "draft" ? "business_editing" : state.project.status,
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
      setInitFiles: (files) => set({ initFiles: files }),

      setTaskType: (type) => set({ taskType: type }),
      setAgenticConfig: (config) => set({ agenticConfig: config }),
      updateAgenticField: (field, value) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, [field]: value }
            : null,
        })),
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
      setShowNodeQuestions: (show) => set({ showNodeQuestions: show }),
      setGenerationStage: (stage) => set({ generationStage: stage }),
      setEnrichProgress: (progress) => set({ enrichProgress: progress }),

      // Notifications
      addNotification: (notification) =>
        set((state) => ({ notifications: [notification, ...state.notifications] })),
      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearNotifications: () => set({ notifications: [] }),

      // Tech config tabs
      setTechTabStatus: (tab, status, error) =>
        set((state) => ({
          techConfig: {
            ...state.techConfig,
            tabStates: {
              ...state.techConfig.tabStates,
              [tab]: { status, error, ...(status === "ready" ? { generatedAt: new Date().toISOString() } : {}) },
            },
          },
        })),
      setTechOverview: (data) =>
        set((state) => ({
          techConfig: {
            ...state.techConfig,
            overview: data,
            tabStates: { ...state.techConfig.tabStates, overview: { status: "ready" as const, generatedAt: new Date().toISOString() } },
          },
        })),
      setTechDocuments: (data) =>
        set((state) => ({
          techConfig: {
            ...state.techConfig,
            documents: data,
            tabStates: { ...state.techConfig.tabStates, documents: { status: "ready" as const, generatedAt: new Date().toISOString() } },
          },
        })),
      setTechExternals: (data) =>
        set((state) => ({
          techConfig: {
            ...state.techConfig,
            externals: data,
            tabStates: { ...state.techConfig.tabStates, externals: { status: "ready" as const, generatedAt: new Date().toISOString() } },
          },
        })),
      setTechGuards: (data) =>
        set((state) => ({
          techConfig: {
            ...state.techConfig,
            guards: data,
            tabStates: { ...state.techConfig.tabStates, guards: { status: "ready" as const, generatedAt: new Date().toISOString() } },
          },
        })),
      setTechDeployment: (data) =>
        set((state) => ({
          techConfig: {
            ...state.techConfig,
            deployment: data,
            tabStates: { ...state.techConfig.tabStates, deployment: { status: "ready" as const, generatedAt: new Date().toISOString() } },
          },
        })),
      resetTechConfig: () =>
        set({
          techConfig: {
            overview: null, documents: null, externals: null, guards: null, deployment: null,
            tabStates: {
              overview: { status: "idle" as const }, documents: { status: "idle" as const },
              externals: { status: "idle" as const }, guards: { status: "idle" as const },
              deployment: { status: "idle" as const },
            },
          },
          techBindings: createDefaultTechBindingState(),
          adaptiveConfig: createDefaultAdaptiveConfig(),
          jobGroup: null,
          techJobMeta: {
            code: "",
            name: "",
            description: "",
            inputSchemaJson: "",
            defaultRuntimeProfileCode: "",
            defaultReviewPolicyCode: "",
          },
          jobTriggerCodes: [],
          techCanvasView: "flow",
        }),

      setTechBindingsGlobal: (partial) =>
        set((state) => ({
          techBindings: {
            ...state.techBindings,
            global: { ...state.techBindings.global, ...partial },
          },
        })),
      setDocumentBinding: (docId, partial) =>
        set((state) => ({
          techBindings: {
            ...state.techBindings,
            documentsById: {
              ...state.techBindings.documentsById,
              [docId]: { ...state.techBindings.documentsById[docId], ...partial },
            },
          },
        })),
      setExternalBinding: (extId, partial) =>
        set((state) => ({
          techBindings: {
            ...state.techBindings,
            externalsById: {
              ...state.techBindings.externalsById,
              [extId]: { ...state.techBindings.externalsById[extId], ...partial },
            },
          },
        })),
      setNodeBinding: (nodeId, partial) =>
        set((state) => ({
          techBindings: {
            ...state.techBindings,
            nodesById: {
              ...state.techBindings.nodesById,
              [nodeId]: { ...state.techBindings.nodesById[nodeId], ...partial },
            },
          },
        })),
      setAdaptiveConfig: (partial) =>
        set((state) => ({
          adaptiveConfig: { ...state.adaptiveConfig, ...partial },
        })),
      setJobGroup: (group) => set({ jobGroup: group }),
      resetTechBindings: () =>
        set({
          techBindings: createDefaultTechBindingState(),
          adaptiveConfig: createDefaultAdaptiveConfig(),
          jobGroup: null,
          techJobMeta: {
            code: "",
            name: "",
            description: "",
            inputSchemaJson: "",
            defaultRuntimeProfileCode: "",
            defaultReviewPolicyCode: "",
          },
          jobTriggerCodes: [],
        }),

      setTechJobMeta: (partial) =>
        set((state) => ({
          techJobMeta: { ...state.techJobMeta, ...partial },
        })),
      setJobTriggerCodes: (codes) => set({ jobTriggerCodes: codes }),
      setTechCanvasView: (view) => set({ techCanvasView: view }),

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

      updatePhase: (phaseId, patch) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? {
                ...state.agenticConfig,
                phases: state.agenticConfig.phases.map((p) =>
                  p.id === phaseId ? { ...p, ...patch } : p
                ),
              }
            : null,
        })),
      confirmPhase: (phaseId) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? {
                ...state.agenticConfig,
                phases: state.agenticConfig.phases.map((p) =>
                  p.id === phaseId ? { ...p, status: "confirmed" as const } : p
                ),
              }
            : null,
        })),
      confirmAllPhases: () =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? {
                ...state.agenticConfig,
                phases: state.agenticConfig.phases.map((p) => ({ ...p, status: "confirmed" as const })),
              }
            : null,
        })),
      setPhaseStatus: (phaseId, status) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? {
                ...state.agenticConfig,
                phases: state.agenticConfig.phases.map((p) =>
                  p.id === phaseId ? { ...p, status } : p
                ),
              }
            : null,
        })),
      answerPhaseQuestion: (phaseId, questionId, answer) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? {
                ...state.agenticConfig,
                phases: state.agenticConfig.phases.map((p) =>
                  p.id === phaseId
                    ? {
                        ...p,
                        questions: (p.questions || []).map((q) =>
                          q.id === questionId ? { ...q, answer } : q
                        ),
                      }
                    : p
                ),
              }
            : null,
        })),
      addPhase: (phase) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, phases: [...state.agenticConfig.phases, phase] }
            : null,
        })),
      removePhase: (phaseId) =>
        set((state) => ({
          agenticConfig: state.agenticConfig
            ? { ...state.agenticConfig, phases: state.agenticConfig.phases.filter((p) => p.id !== phaseId) }
            : null,
        })),

      resetAll: () =>
        set((state) => ({
          ...initialState,
          knowledgeFiles: MOCK_KNOWLEDGE_FILES,
          businessSubmissions: state.businessSubmissions,
          notifications: state.notifications,
        })),
    }),
    {
      name: "flow-agent-store",
      version: 11,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (_persisted: any, version: number) => {
        if (version < 10) {
          return { ...initialState };
        }
        if (version < 11) {
          return {
            ..._persisted,
            businessSubmissions: _persisted?.businessSubmissions ?? [],
            currentReviewId: _persisted?.currentReviewId ?? null,
          };
        }
        if (version < 6) {
          return {
            ..._persisted,
            techBindings: _persisted.techBindings ?? createDefaultTechBindingState(),
            adaptiveConfig: _persisted.adaptiveConfig ?? createDefaultAdaptiveConfig(),
            jobGroup: _persisted.jobGroup ?? null,
          };
        }
        if (version < 7) {
          const tb = _persisted.techBindings ?? createDefaultTechBindingState();
          const g = tb.global ?? {};
          const { contextPolicyCode: _cp, orchestrationType: _or, ...restGlobal } = g;
          tb.global = {
            ...createDefaultTechBindingState().global,
            ...restGlobal,
          };
          if (tb.nodesById) {
            for (const id of Object.keys(tb.nodesById)) {
              const n = tb.nodesById[id];
              if (n.skillBindingCode?.trim() && !(n.skillBindingCodes?.length)) {
                n.skillBindingCodes = [n.skillBindingCode.trim()];
              }
            }
          }
          return {
            ..._persisted,
            techBindings: tb,
            techJobMeta: _persisted.techJobMeta ?? {
              code: "",
              name: _persisted.project?.name ?? "",
              description: _persisted.project?.description ?? "",
              inputSchemaJson: "",
              defaultRuntimeProfileCode: "",
              defaultReviewPolicyCode: "",
            },
            jobTriggerCodes: _persisted.jobTriggerCodes ?? [],
            techCanvasView: _persisted.techCanvasView ?? "flow",
          };
        }
        if (version < 9) {
          return { ...initialState };
        }
        return _persisted;
      },
      partialize: (state) => ({
        project: state.project,
        currentReviewId: state.currentReviewId,
        businessSubmissions: state.businessSubmissions,
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
        allNodeConfidence: state.allNodeConfidence,
        deferredNodeIds: state.deferredNodeIds,
        generationStage: state.generationStage,
        enrichProgress: state.enrichProgress,
        initialSnapshot: state.initialSnapshot,
        notifications: state.notifications,
        techConfig: state.techConfig,
        techBindings: state.techBindings,
        adaptiveConfig: state.adaptiveConfig,
        jobGroup: state.jobGroup,
        techJobMeta: state.techJobMeta,
        jobTriggerCodes: state.jobTriggerCodes,
        techCanvasView: state.techCanvasView,
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

        // Reset generating tech tabs to idle
        if (state.techConfig) {
          const tabStates = { ...state.techConfig.tabStates };
          let changed = false;
          for (const tab of Object.keys(tabStates) as TechTabId[]) {
            if (tabStates[tab].status === "generating") {
              tabStates[tab] = { status: "idle" };
              changed = true;
            }
          }
          if (changed) {
            useFlowAgentStore.setState({
              techConfig: { ...state.techConfig, tabStates },
            });
          }
        }
      },
    }
  )
);
