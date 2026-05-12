import type { Node, Edge } from "@xyflow/react";
import type { AgenticTaskConfig, FlowNodeData, ProjectStatus, TaskType } from "./types";
import type { ChatMessage } from "./store";

export interface SubmissionTechProgress {
  total: number;
  done: number;
  status: "idle" | "running" | "done" | "error";
}

export interface SubmissionTimelineEvent {
  id: string;
  at: string;
  actor: "business" | "tech" | "system";
  type:
    | "submitted"
    | "tech_generation_started"
    | "tech_generation_progress"
    | "tech_generation_done"
    | "status_changed"
    | "tech_review";
  message: string;
  meta?: Record<string, unknown>;
}

export interface SubmissionReviewLog {
  id: string;
  at: string;
  actor: "business" | "tech" | "system";
  action: "submitted" | "approved" | "rejected" | "resubmitted" | "commented";
  note?: string;
  statusAfter: ProjectStatus;
}

export interface PersistedSubmission {
  id: string;
  reviewId: string;
  title: string;
  description: string;
  taskType: TaskType;
  status: ProjectStatus;
  submittedBy: string;
  submittedAt: string;
  updatedAt: string;
  prompt: string;
  projectName: string;
  nodeCount: number;
  techProgress: SubmissionTechProgress;
  nodes?: Node<FlowNodeData>[];
  edges?: Edge[];
  agenticConfig?: AgenticTaskConfig;
  chatMessages: ChatMessage[];
  timeline: SubmissionTimelineEvent[];
  reviewLogs: SubmissionReviewLog[];
}

export interface PersistedSubmissionDB {
  version: 1;
  items: PersistedSubmission[];
}

