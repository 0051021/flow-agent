export type NodeExecutionMode = "ai_auto" | "human_confirm" | "human_manual";
export type NodeExecutionType = "deterministic" | "intelligent";
export type NodeFeasibility = "confirmed" | "partial" | "infeasible" | "pending";
export type ErrorStrategy = "retry" | "human_fallback" | "skip" | "abort";

export interface FlowNodeInput {
  id: string;
  name: string;
  icon: string;
  description: string;
  required: boolean;
  source: "user" | "previous_step" | "default";
  sourceDetail?: string;
  dataType?: string; // visible in tech view
}

export interface FlowNodeOutput {
  id: string;
  name: string;
  icon: string;
  description: string;
  flowsTo: string[]; // node ids that consume this output
  dataType?: string;
}

export interface ErrorHandling {
  strategy: ErrorStrategy;
  enabled: boolean;
  config?: {
    maxRetries?: number;
    retryInterval?: number;
    notifyRole?: string;
  };
}

export interface TechConfig {
  executionType: NodeExecutionType;
  boundSkill?: string;
  evaluator?: string;
  timeout?: number;
  feasibility: NodeFeasibility;
}

export interface FlowNodeData {
  [key: string]: unknown;
  label: string;
  icon: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  executionMode: NodeExecutionMode;
  estimatedTime: string;
  inputs: FlowNodeInput[];
  outputs: FlowNodeOutput[];
  errorHandling: ErrorHandling[];
  techConfig: TechConfig;
  isCondition?: boolean;
  conditionBranches?: { label: string; icon: string; targetLabel: string }[];
}

export interface Annotation {
  id: string;
  nodeId: string;
  author: {
    name: string;
    role: "business" | "tech";
    avatar?: string;
  };
  content: string;
  attachments: AnnotationAttachment[];
  status: "pending" | "discussing" | "resolved" | "needs_change";
  createdAt: string;
  replies: AnnotationReply[];
}

export interface AnnotationReply {
  id: string;
  author: {
    name: string;
    role: "business" | "tech";
    avatar?: string;
  };
  content: string;
  createdAt: string;
}

export interface AnnotationAttachment {
  id: string;
  fileName: string;
  source: string;
  highlight?: string; // quoted section
  lineRef?: string;
}

export type ProjectStatus =
  | "draft"
  | "business_editing"
  | "pending_review"
  | "tech_reviewing"
  | "needs_revision"
  | "confirmed";

export type ViewMode = "business" | "tech" | "overview";
export type UserRole = "business" | "tech";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  category: string;
  content: string;
  updatedAt: string;
}
