// --- File Attachment ---
export interface FileAttachment {
  originalName: string;
  storedName: string;
  path: string;
  size: number;
  type: string;
  ext: string;
  jobMaterialCategory?: "workflow_plan" | "business_rule_knowhow" | "file_template" | "uncategorized";
}

// --- Feasibility Gate (v12) ---
export interface FeasibilityDetail {
  dimension: string;
  status: "pass" | "warning" | "block";
  note: string;
}

export interface FeasibilityAssessment {
  level: "suitable" | "partial" | "not_recommended";
  summary: string;
  automationRate?: string;
  details: FeasibilityDetail[];
  suggestion?: string;
}

export type NodeExecutionMode = "pending" | "ai_auto" | "human_confirm" | "human_manual";
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

/** json/object/array 等复合类型的子字段定义 */
export interface SubField {
  key: string;
  type: string;
  desc: string;
}

export interface FlowNodeInput {
  id: string;
  /** Agent schema alias; UI keeps id for ReactFlow compatibility */
  inputId?: string;
  name: string;
  icon: string;
  description: string;
  required: boolean;
  source: "user" | "previous_step" | "default";
  sourceDetail?: string;
  dataType?: string;
  /** @deprecated 旧版纯文本示例，迁移到 subFields */
  example?: string;
  /** 复合类型的内部字段结构 */
  subFields?: SubField[];
  /** 业务方上传的样例文件 */
  exampleFiles?: FileAttachment[];
}

export interface FlowNodeOutput {
  id: string;
  /** Agent schema alias; UI keeps id for ReactFlow compatibility */
  outputId?: string;
  name: string;
  icon: string;
  description: string;
  flowsTo: string[];
  dataType?: string;
  /** @deprecated 旧版纯文本示例，迁移到 subFields */
  example?: string;
  /** 复合类型的内部字段结构 */
  subFields?: SubField[];
  /** 业务方上传的样例文件 */
  exampleFiles?: FileAttachment[];
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

/** Per-node technical settings on the flow canvas (execution type, skills, feasibility). */
export interface NodeTechConfig {
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

export type WorkUnitKind =
  | "sop_step"
  | "strategy_step"
  | "workflow_step"
  | "agentic_judgment"
  | "agentic_strategy"
  | "agentic_generation"
  | "agentic_feedback"
  | "human_gate"
  | "manual_operation"
  | "business_judgment"
  | "document_check"
  | "handoff_wait"
  | "rework_update";

export interface AgenticNodeSpec {
  strategyActionType: string;
  /** 业务侧：这个策略/判断节点到底要判断或决定什么 */
  decisionSubject?: string;
  focusSignals: string[];
  aiActions: string[];
  recommendationOutputs: string[];
  humanConfirmation?: string[];
  feedbackUpdate?: string[];
  riskBoundaries?: string[];
}

export interface JudgmentSpec {
  /** 业务侧：这一步原本由业务人员判断什么 */
  decisionSubject?: string;
  /** 业务人员判断时会看的信息、材料或上下文 */
  informationUsed?: string[];
  /** 业务人员实际遵循的判断口径或规则 */
  judgmentRules?: string[];
  /** 判断完成后形成的业务结果 */
  judgmentOutputs?: string[];
  /** 原人工流程里升级、交接或找主管/专岗处理的条件 */
  escalationConditions?: string[];
  /** 业务人员不能越过的边界 */
  riskBoundaries?: string[];
}

export interface SopSpec {
  operationSteps: string[];
  businessRules: string[];
}

export interface StrategySpec {
  basis: string[];
  judgmentProcess: string[];
  escalationConditions: string[];
}

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains";

export interface ConditionRule {
  sourceNodeId?: string;
  sourceOutputId?: string;
  sourceOutputPath?: string;
  sourceOutputName?: string;
  outputDataType?: string;
  operator?: ConditionOperator;
  compareValue?: string | number | boolean;
}

export interface ConditionGroup {
  logic: "all" | "any";
  conditions: ConditionRule[];
}

export interface ConditionBranch extends ConditionRule {
  label: string;
  icon: string;
  targetLabel: string;
  conditionGroup?: ConditionGroup;
  targetNodeId?: string;
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
  /** 业务侧：节点/工作单元语义，用于区分固定流程步骤和策略判断节点 */
  workUnitKind?: WorkUnitKind;
  /** 业务侧：偏 agentic/策略节点的补充字段 */
  agenticSpec?: AgenticNodeSpec;
  /** 业务侧：人工业务判断节点的补充字段，用于还原原人工流程 */
  judgmentSpec?: JudgmentSpec;
  /** 业务侧 MVP：SOP 型节点第三个 tab 字段 */
  sopSpec?: SopSpec;
  /** 业务侧 MVP：策略型节点第三个 tab 字段 */
  strategySpec?: StrategySpec;
  errorHandling: ErrorHandling[];
  techConfig: NodeTechConfig;
  confirmStrategy?: ConfirmStrategyConfig;
  /** 业务侧：节点内操作清单（SOP 小步骤） */
  operationSteps?: string[];
  /** 业务侧：结构化校对字段，作为规则文本的补充数据 */
  requiredCheckFields?: string[];
  /** 业务侧：校对规则，可由自然语言描述 */
  checkRulesText?: string;
  /** 业务侧：校对规则文件，如规则表、SOP、校验清单 */
  checkRuleFiles?: FileAttachment[];
  /** 业务侧：结果输出标准 */
  doneCriteria?: string;
  isCondition?: boolean;
  conditionBranches?: ConditionBranch[];
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
  | "ai_generating"
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

export interface BusinessSubmission {
  id: string;
  reviewId: string;
  title: string;
  description: string;
  taskType: TaskType;
  status: ProjectStatus;
  submittedAt: string;
  updatedAt: string;
  techProgress: {
    total: number;
    done: number;
    status: "idle" | "running" | "done" | "error";
  };
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

export interface AgenticReportingFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface AgenticReporting {
  daily: { enabled: boolean; auto: boolean; sampleContent?: string };
  weekly: { enabled: boolean; content: string; sampleContent?: string };
  alerts: { triggers: { condition: string; severity?: "critical" | "warning" | "info" }[] } | { triggers: string[] };
  milestones: string[];
  channel?: string;
  files?: AgenticReportingFile[];
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

export const AGENTIC_NOT_RELEVANT_ANSWER = "__FLOW_AGENT_NOT_RELEVANT__";

export interface AgenticPhaseSuccessCriteria {
  good: string;
  warning: string;
  bad: string;
}

export interface AgenticPhaseMaterialFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface AgenticPhase {
  id: string;
  name: string;
  dayRange: [number, number];
  status: AgenticPhaseStatus;
  responsibility?: string;
  actions: string[];
  focusSignals?: string[];
  successCriteria: AgenticPhaseSuccessCriteria;
  exitCondition: string;
  requiresApproval: boolean;
  approvalDescription?: string;
  questions?: AgenticPhaseQuestion[];
  requiredCapabilities?: string[];
  materialFiles?: AgenticPhaseMaterialFile[];
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
export type TaskEventType = "node_start" | "node_complete" | "node_error" | "human_confirm" | "system" | "ai_suggestion" | "data_report" | "milestone" | "intervention";

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

export type FlowNodeStatus = "completed" | "running" | "pending_confirm" | "error" | "waiting";

export interface FlowNodeDef {
  id: string;
  label: string;
  type: "ai_auto" | "human_confirm" | "human_manual";
  status: FlowNodeStatus;
  duration?: string;
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
  flowNodes?: FlowNodeDef[];
  /** 拆分后的子 Job，展示为文件夹式展开 */
  subJobs?: ConsoleSubJob[];
}

export interface ConsoleSubJob {
  id: string;
  name: string;
  status: ConsoleTaskStatus;
  progress: number;
  trigger: string;
  currentNode: string;
  flowNodes?: FlowNodeDef[];
}

/**
 * verify  — AI 已产出结果，人来校验对不对
 * input   — 流程需要人补充 AI 无法获取的信息
 * decision— AI 准备好材料，人来做业务决策
 */
export type HumanConfirmType = "verify" | "input" | "decision";

/**
 * card    — 卡片式（默认，信息量小的审批/填表）
 * compare — 双栏对照（合同审阅：原文 ↔ 标注）
 * match   — 三栏匹配（编码匹配：源件 ↔ 结果 ↔ 参考库）
 */
export type ReviewLayout = "card" | "compare" | "match";

export interface TaskEvent {
  id: string;
  taskId: string;
  nodeId?: string;
  nodeName?: string;
  type: TaskEventType;
  confirmType?: HumanConfirmType;
  reviewLayout?: ReviewLayout;
  content: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ============================================================
// Notification System
// ============================================================

export type NotificationType = "tech_config_ready" | "review_submitted" | "review_approved" | "review_rejected" | "annotation_reply" | "quality_alert" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  relatedProject?: string;
}

// ============================================================
// Tech-side Multi-Tab Configuration
// ============================================================

export type TechTabId = "overview" | "documents" | "externals" | "guards" | "deployment";
export type TechTabStatus = "idle" | "generating" | "ready" | "error";

export interface TechTabState {
  status: TechTabStatus;
  error?: string;
  generatedAt?: string;
}

// --- Tab 1: Overview + Sequence Diagram ---

export interface NodeAnnotation {
  nodeId: string;
  executionType: "deterministic" | "intelligent";
  riskLevel: "low" | "medium" | "high";
  riskReason: string;
  estimatedLatency: string;
  boundSkillSuggestion: string;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  type: "sync" | "async";
  nodeId: string;
}

export interface SequenceDiagram {
  participants: string[];
  messages: SequenceMessage[];
}

export interface TechOverviewData {
  nodeAnnotations: NodeAnnotation[];
  sequenceDiagram: SequenceDiagram;
}

// --- Tab 2: Document Contracts ---

export interface DocumentField {
  name: string;
  type: string;
  description: string;
}

export interface DocumentSchema {
  description: string;
  fields: DocumentField[];
}

export interface DocumentUsage {
  nodeId: string;
  usage: "read" | "write" | "query" | "create";
}

export interface DocumentEntry {
  id: string;
  name: string;
  fileType: "xlsx" | "pdf" | "json" | "database" | "email" | "other";
  role: "working" | "reference" | "archive" | "external_input" | "external_output";
  schema: DocumentSchema;
  usedByNodes: DocumentUsage[];
}

export interface DocumentRelationship {
  from: string;
  to: string;
  type: "inherits" | "references" | "derived_from";
}

export interface TechDocumentsData {
  documents: DocumentEntry[];
  relationships: DocumentRelationship[];
}

// --- Tab 3: External Systems ---

export interface ExternalSystemIntegration {
  current: "manual" | "api" | "email" | "file_transfer" | "database_query";
  target: "manual" | "api" | "email" | "file_transfer" | "database_query";
  readiness: "ready" | "partial" | "not_available";
}

export interface ExternalSystemConstraint {
  type: "availability" | "rate_limit" | "file_size" | "response_time" | "format";
  detail: string;
}

export interface ExternalSystem {
  id: string;
  name: string;
  type: "web_portal" | "api" | "email" | "database" | "file_system";
  relatedNodes: string[];
  integration: ExternalSystemIntegration;
  auth: { type: "none" | "bearer_token" | "username_password" | "certificate" | "smtp_credentials" | "unknown" };
  capabilities: string[];
  constraints: ExternalSystemConstraint[];
  humanFallback: string;
  automationPriority: "high" | "medium" | "low";
  estimatedEffort: string;
}

export interface TechExternalsData {
  externalSystems: ExternalSystem[];
}

// --- Tab 4: Quality Guards ---

export interface GuardCheck {
  field: string;
  rule: "not_empty" | "type_check" | "range" | "format";
  severity: "error" | "warning";
}

export interface GuardMonitor {
  type: "structural" | "statistical" | "sampling";
  description: string;
  checks: GuardCheck[];
  threshold?: number;
}

export interface GuardEscalation {
  business: string[];
  tech: string[];
}

export interface NodeGuard {
  nodeId: string;
  monitors: GuardMonitor[];
  issueCategories: string[];
  escalation: GuardEscalation;
}

export interface TechGuardsData {
  guards: NodeGuard[];
}

// --- Tab 5: Deployment ---

export interface DeploymentService {
  nodeId: string;
  serviceName: string;
  runtime: "python" | "node" | "browser_automation";
  dependencies: string[];
  resourceRequirements: { cpu: "low" | "medium" | "high"; memory: "low" | "medium" | "high" };
}

export interface DeploymentMessaging {
  from: string;
  to: string;
  type: "sync" | "async" | "human_gate";
  format: "json" | "file";
}

export interface DeploymentEnvVar {
  name: string;
  description: string;
  secret: boolean;
  relatedNode: string;
}

export interface DeploymentResourceLimit {
  resource: string;
  limit: string;
  strategy: "token_bucket" | "reserve_commit" | "queue";
}

export interface TechDeploymentData {
  services: DeploymentService[];
  messaging: DeploymentMessaging[];
  envVars: DeploymentEnvVar[];
  resourceLimits: DeploymentResourceLimit[];
}

// --- Combined Tech Config ---

export interface TechConfig {
  overview: TechOverviewData | null;
  documents: TechDocumentsData | null;
  externals: TechExternalsData | null;
  guards: TechGuardsData | null;
  deployment: TechDeploymentData | null;
  tabStates: Record<TechTabId, TechTabState>;
}

// ============================================================
// Tech workspace — editable bindings (FlowAgent-only, not JobSpec)
// ============================================================

/** Tab ids for binding-focused workspace UI */
export type TechWorkspaceBindingTabId =
  | "binding_global"
  | "binding_documents"
  | "binding_externals"
  | "adaptive";

/** Maps to task-platform Task.type / executable-schema taskType */
export type PlatformTaskType = "agentic" | "integration" | "deterministic" | "human_review";

/** Reserved for future JobSpec-level resource defaults selected by FlowAgent. */
export interface GlobalResourceBindings {}

/** JobSpec metadata (editable in tech workspace, maps to metadata + defaults) */
export interface TechJobSpecMeta {
  code: string;
  name: string;
  description: string;
  /** JSON string: Job-level input schema (JobSpec input_schema) */
  inputSchemaJson?: string;
  defaultRuntimeProfileCode?: string;
  defaultReviewPolicyCode?: string;
  /** 用户是否手动编辑过 code；为 true 后名称变更不再联动 */
  codeManuallyEdited?: boolean;
}

/** Per-document overrides keyed by DocumentEntry.id */
export interface DocumentBindingEntry {
  contextSourceCode?: string;
  sourceType?: "manual" | "static" | "http" | "object_storage";
  sensitivity?: "public" | "internal" | "confidential";
}

/** Per external system overrides keyed by ExternalSystem.id */
export interface ExternalSystemBindingEntry {
  toolCode?: string;
  secretCode?: string;
  skipped?: boolean;
}

/** Per-flow-node overrides keyed by React Flow node id */
export interface NodeBindingEntry {
  /** Job 内唯一的 Task 编码 → JobSpec task.code */
  taskCode?: string;
  taskType?: PlatformTaskType;
  /** Multiple skills → JobSpec skill_codes */
  skillBindingCodes?: string[];
  /** @deprecated use skillBindingCodes; kept for persist migration */
  skillBindingCode?: string;
  runtimeProfileCode?: string;
  /** 上下文打包策略 → JobSpec context_policy_code（非人工 Task 必填） */
  contextPolicyCode?: string;
  reviewPolicyCode?: string;
  /** Task 需要调用的工具编码列表 → JobSpec tool_codes */
  toolCodes?: string[];
  /** Task 需要访问的凭证引用列表 → JobSpec secret_refs */
  secretRefs?: string[];
}

export interface TechBindingState {
  global: GlobalResourceBindings;
  documentsById: Record<string, DocumentBindingEntry>;
  externalsById: Record<string, ExternalSystemBindingEntry>;
  nodesById: Record<string, NodeBindingEntry>;
}

export interface RuntimeAdjustableParam {
  path: string;
  valueType: "number" | "string" | "enum";
  scope: "hot" | "warm" | "cold";
  description?: string;
}

export interface EnvAssumptionEntry {
  id: string;
  description: string;
  monitorType: string;
  interval?: string;
  warningThreshold?: string;
  criticalThreshold?: string;
}

export interface AdjustmentPolicyEntry {
  id: string;
  title: string;
  triggerCondition?: string;
  actions?: string;
}

/** Mirrors adaptiveConfig in executable-schema / JobSpec v2 */
export interface AdaptiveConfigState {
  runtimeAdjustable: RuntimeAdjustableParam[];
  envAssumptions: EnvAssumptionEntry[];
  adjustmentPolicies: AdjustmentPolicyEntry[];
}

export interface JobGroupEntry {
  schemaId?: string;
  name: string;
  nodeIds?: string[];
  /** Original canvas node stepIndex range [from, to] inclusive */
  nodeStepRange: [number, number];
  triggerConfig?: {
    type: "schedule" | "manual" | "event" | "api";
    params?: Record<string, string>;
  };
}

export interface JobRelationEntry {
  from: string;
  to: string;
  relation: "upstream_producer" | "downstream_consumer";
  sharedResource?: string;
  description?: string;
}

export interface JobGroup {
  id: string;
  name: string;
  sourceSchemaId?: string;
  createdAt: string;
  jobs: JobGroupEntry[];
  sharedResources: string[];
  relatedJobs: JobRelationEntry[];
}

export interface JobSplitDraft {
  active: boolean;
  selectedNodeIds: string[];
  newJobName: string;
}

/** Validation checklist item for export readiness */
export interface BindingCheckItem {
  ok: boolean;
  label: string;
  hint?: string;
}

export interface BindingCompletionResult {
  percent: number;
  checks: BindingCheckItem[];
}
