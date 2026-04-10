export type NodeExecutionMode = "ai_auto" | "human_confirm" | "human_manual";
export type NodeExecutionType = "deterministic" | "intelligent";
export type NodeFeasibility = "confirmed" | "partial" | "infeasible" | "pending";
export type ErrorStrategy = "retry" | "human_fallback" | "skip" | "abort";
export type ConfirmStrategy = "always" | "threshold" | "sampling" | "rule_based" | "combined";

export interface ConfirmStrategyConfig {
  strategy: ConfirmStrategy;
  threshold?: number;
  samplingRate?: number;
  rules?: string[];
}

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

export interface ExecutionRule {
  rule: string;
  detail: string;
  source: "ai_inferred" | "user_confirmed";
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
  executionRules?: ExecutionRule[];
  errorHandling: ErrorHandling[];
  techConfig: TechConfig;
  confirmStrategy?: ConfirmStrategyConfig;
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

// ============================================================
// Task Type (Workflow vs Agentic)
// ============================================================

export type TaskType = "workflow" | "agentic";

// ============================================================
// Agentic Task Configuration
// ============================================================

export interface AgenticSkill {
  id: string;
  name: string;
  description: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  evaluator?: string;
}

export type AgenticConstraintType = "budget" | "time" | "quality" | "compliance" | "custom";

export interface AgenticConstraint {
  id: string;
  type: AgenticConstraintType;
  description: string;
  value?: string;
}

export interface AgenticEvaluatorMetric {
  name: string;
  threshold: string;
  weight: number;
}

export interface AgenticEvaluator {
  id: string;
  name: string;
  description: string;
  metrics: AgenticEvaluatorMetric[];
}

export type AgenticExecutionStrategy = "sequential" | "parallel" | "adaptive";

// --- Agentic v2: Strategy Card structured fields ---

export interface AgenticGoalMetrics {
  core: string;
  coreReasoning?: string;
  process: string[];
  baseline: string[];
  benchmarks?: string[];
}

export interface AgenticExecutionRule {
  category: string;
  rules: string[];
  source: "user_confirmed" | "ai_inferred";
}

export interface AgenticPermissionTrigger {
  trigger: string;
  description: string;
}

export interface AgenticPermissionItem {
  action: string;
  reason?: string;
}

export interface AgenticApprovalItem {
  trigger: string;
  description: string;
  risk: "high" | "medium" | "low";
  consequence?: string;
}

export interface AgenticPermissions {
  autonomous: string[] | AgenticPermissionItem[];
  needApproval: AgenticPermissionTrigger[] | AgenticApprovalItem[];
  safeguards: string[];
}

export interface AgenticReporting {
  daily: { enabled: boolean; auto: boolean; sampleContent?: string };
  weekly: { enabled: boolean; content: string; sampleContent?: string };
  alerts: { triggers: { condition: string; severity?: "critical" | "warning" | "info" }[] } | { triggers: string[] };
  milestones: string[];
  channel?: string;
}

export interface AgenticContentSample {
  title: string;
  summary: string;
  type: string;
  tags?: string[];
  expectedMetrics?: string;
}

export interface AgenticContentPreview {
  samples: AgenticContentSample[];
  generationLogic?: string;
}

export type AgenticSectionId = "goal" | "rules" | "permissions" | "reporting";

export interface AgenticSectionConfidence {
  section: AgenticSectionId;
  confidence: "high" | "medium" | "low";
  reason: string;
  questions: AgenticConfirmItem[];
}

// --- Agentic v2: Tech-side structured fields ---

export interface AgenticDecisionLoop {
  observe: string[];
  evaluate: string[];
  act: string[];
  feedback: string[];
}

export interface AgenticSkillDependency {
  from: string;
  to: string;
  dataFlow: string;
}

export interface AgenticSkillOrchestration {
  dependencies: AgenticSkillDependency[];
  parallelGroups?: string[][];
  failurePolicy: { skillId: string; action: "retry" | "skip" | "abort" | "fallback"; fallbackSkillId?: string; maxRetries?: number }[];
}

export interface AgenticContextLayer {
  shortTerm: string[];
  longTerm: string[];
  external?: string[];
}

export interface AgenticScheduleTrigger {
  type: "cron" | "event" | "threshold";
  description: string;
  config: string;
}

export interface AgenticSchedule {
  triggers: AgenticScheduleTrigger[];
  cooldown?: string;
}

// ============================================================
// Agentic Phase (v3 core type)
// ============================================================

export type AgenticPhaseStatus = "confirmed" | "reviewing" | "pending";

export interface AgenticPhaseQuestion {
  id: string;
  question: string;
  context: string;
  options?: string[];
  answer?: string;
}

export interface AgenticPhaseSuccessCriteria {
  good: string;
  warning: string;
  bad: string;
}

export interface AgenticPhase {
  id: string;
  name: string;
  dayRange: [number, number];
  status: AgenticPhaseStatus;
  actions: string[];
  successCriteria: AgenticPhaseSuccessCriteria;
  exitCondition: string;
  requiresApproval: boolean;
  approvalDescription?: string;
  questions?: AgenticPhaseQuestion[];
  requiredCapabilities?: string[];
}

export interface AgenticFallback {
  trigger: string;
  action: string;
  severity: "critical" | "warning" | "info";
}

export interface AgenticRiskItem {
  risk: string;
  likelihood: "high" | "medium" | "low";
  mitigation: string;
}

// ============================================================
// AgenticTaskConfig (v3 — phase-based)
// ============================================================

export interface AgenticTaskConfig {
  // === Business side (stage 1) ===
  goal: string;
  background: string;
  totalDays: number;
  phases: AgenticPhase[];
  globalSuccessCriteria: string;
  approvalPoints: string[];
  fallbacks: AgenticFallback[];
  constraints: AgenticConstraint[];

  // Business-side enrichment (carried over from v2)
  goalMetrics?: AgenticGoalMetrics;
  executionRules?: AgenticExecutionRule[];
  permissions?: AgenticPermissions;
  reporting?: AgenticReporting;
  contentPreview?: AgenticContentPreview;
  estimatedDuration?: string;
  estimatedEfficiency?: string;
  executionOverview?: string;
  riskAssessment?: AgenticRiskItem[];

  // === Tech side (stage 2, generated after business confirmation) ===
  skills: AgenticSkill[];
  evaluators: AgenticEvaluator[];
  executionStrategy: AgenticExecutionStrategy;
  maxIterations: number;
  humanCheckpoints: string[];
  decisionLoop?: AgenticDecisionLoop;
  skillOrchestration?: AgenticSkillOrchestration;
  contextArchitecture?: AgenticContextLayer;
  schedule?: AgenticSchedule;

  // UI state (not persisted to backend)
  sectionConfidence?: AgenticSectionConfidence[];
}

// ============================================================
// Console: Agent & Task Management
// ============================================================

export interface AgenticConfirmItem {
  id: string;
  section: "goal" | "skills" | "constraints" | "evaluators";
  question: string;
  context: string;
  options?: string[];
}

export type AgentStatus = "running" | "draft" | "error" | "paused";
export type ConsoleTaskStatus = "queued" | "running" | "pending_confirm" | "completed" | "error";
export type TaskEventType = "node_start" | "node_complete" | "node_error" | "human_confirm" | "system" | "ai_suggestion" | "data_report" | "milestone";

export interface ConsoleAgent {
  id: string;
  name: string;
  icon: string;
  sceneId: string;
  sceneName: string;
  taskType: TaskType;
  status: AgentStatus;
  successRate: number;
  taskCount: number;
  avgDuration: string;
  version: string;
  department: string;
  lastActiveAt: string;
  description: string;
}

export interface ConsoleTask {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  currentNode: string;
  progress: number;
  status: ConsoleTaskStatus;
  taskType: TaskType;
  startedAt: string;
  completedAt?: string;
  duration: string;
  priority?: "normal" | "high" | "urgent";
  description: string;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  nodeId?: string;
  nodeName?: string;
  type: TaskEventType;
  content: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
