/**
 * GSDS 入库流程 demo seed —— 用于一键加载到编辑器中演示技术工作区全功能。
 *
 * 3 个节点：获取 PDF → 解析 GSDS PDF → 写入主数据库
 * 线性流程，无条件分支。BBN+PART 做 UPSERT。
 */

import type { Node, Edge } from "@xyflow/react";
import type {
  FlowNodeData,
  TechConfig,
  TechBindingState,
  AdaptiveConfigState,
  TechOverviewData,
  TechDocumentsData,
  TechExternalsData,
  TechGuardsData,
  TechDeploymentData,
} from "./types";

// ============================================================
// 1. 画布节点 & 边
// ============================================================

const SX = 420;
const X0 = 60;
const Y0 = 120;
const TOTAL = 3;

export const GSDS_NODES: Node<FlowNodeData>[] = [
  {
    id: "gsds-1",
    type: "flowCard",
    position: { x: X0, y: Y0 },
    data: {
      label: "获取 PDF 文件",
      icon: "Upload",
      description: "从 SharePoint 下载用户上传的 GSDS PDF 文件到临时存储，返回本地文件路径和原始文件名。",
      stepIndex: 1,
      totalSteps: TOTAL,
      executionMode: "ai_auto",
      estimatedTime: "秒级",
      inputs: [
        { id: "i-1-1", name: "sharepoint_file_url", icon: "🔗", description: "SharePoint 上 GSDS PDF 文件的 URL 或路径", required: true, source: "user", dataType: "string" },
      ],
      outputs: [
        { id: "o-1-1", name: "pdf_file_path", icon: "📄", description: "下载后的本地临时文件路径", flowsTo: ["gsds-2"], dataType: "string" },
        { id: "o-1-2", name: "file_name", icon: "📝", description: "原始文件名", flowsTo: ["gsds-2"], dataType: "string" },
      ],
      executionRules: [],
      errorHandling: [],
      techConfig: { executionType: "deterministic", feasibility: "confirmed" },
    },
  },
  {
    id: "gsds-2",
    type: "flowCard",
    position: { x: X0 + SX, y: Y0 },
    data: {
      label: "解析 GSDS PDF",
      icon: "FileText",
      description: "使用多模态能力解析 GSDS PDF，提取 BBN、PART、颜色、状态、运输名称、UN 编号、各项危害类别、密度、成分列表等字段。部分字段在 PDF 中可能不存在则不填写。",
      stepIndex: 2,
      totalSteps: TOTAL,
      executionMode: "ai_auto",
      estimatedTime: "10-60 秒",
      inputs: [
        { id: "i-2-1", name: "pdf_file_path", icon: "📄", description: "待解析的 PDF 本地路径", required: true, source: "previous_step", dataType: "string" },
      ],
      outputs: [
        {
          id: "o-2-1", name: "gsds_record", icon: "📊", description: "解析后的 GSDS 结构化记录（符合 gsds-parsed-record.schema.json）", flowsTo: ["gsds-3"], dataType: "json",
          subFields: [
            { key: "bbn", type: "string", desc: "BBN 编号（如 CL/VA-8.10）" },
            { key: "part", type: "string", desc: "PART 编号（如 Part 2B）" },
            { key: "color", type: "string", desc: "颜色（如 浅黄色）" },
            { key: "state", type: "string", desc: "物理状态（如 透明液体）" },
            { key: "official_transport_name", type: "string", desc: "正式运输名称" },
            { key: "un_number", type: "string", desc: "UN 联合国编号（四位数字）" },
            { key: "hazard_class", type: "string", desc: "危险货物类别" },
            { key: "packing_group", type: "string", desc: "包装类别（罗马数字）" },
            { key: "flammable_liquid_category", type: "string", desc: "易燃液体，类别" },
            { key: "metal_corrosion_category", type: "string", desc: "金属腐蚀剂，类别" },
            { key: "skin_corrosion_irritation_category", type: "string", desc: "皮肤腐蚀/刺激，类别" },
            { key: "serious_eye_damage_category", type: "string", desc: "严重眼损伤/眼刺激，类别" },
            { key: "skin_sensitization_category", type: "string", desc: "皮肤致敏，类别" },
            { key: "aspiration_hazard_category", type: "string", desc: "吸入危险，类别" },
            { key: "aquatic_hazard_short_term", type: "string", desc: "危害水生环境-短期危害，类别" },
            { key: "aquatic_hazard_long_term", type: "string", desc: "危害水生环境-长期危害，类别" },
            { key: "marine_pollutant", type: "string", desc: "海洋污染物" },
            { key: "acute_toxicity", type: "string", desc: "急毒性" },
            { key: "sds_density", type: "number", desc: "SDS 密度（如 0.9772）" },
            { key: "density", type: "number", desc: "密度 = SDS密度四舍五入保留两位小数（如 0.9772→0.98）" },
            { key: "composition", type: "array", desc: "成分列表：[{component, content, cas}]" },
          ],
        },
      ],
      executionRules: [],
      errorHandling: [],
      techConfig: { executionType: "intelligent", feasibility: "confirmed" },
    },
  },
  {
    id: "gsds-3",
    type: "flowCard",
    position: { x: X0 + SX * 2, y: Y0 },
    data: {
      label: "写入主数据库",
      icon: "Database",
      description: "以 BBN + PART 为唯一键查询 GSDS 主数据库：已存在则 UPDATE 覆盖全部字段，不存在则 INSERT 新记录。",
      stepIndex: 3,
      totalSteps: TOTAL,
      executionMode: "ai_auto",
      estimatedTime: "秒级",
      inputs: [
        {
          id: "i-3-1", name: "gsds_record", icon: "📊", description: "解析后的 GSDS 结构化记录", required: true, source: "previous_step", dataType: "json",
          subFields: [
            { key: "bbn", type: "string", desc: "BBN 编号" },
            { key: "part", type: "string", desc: "PART 编号" },
            { key: "color", type: "string", desc: "颜色" },
            { key: "state", type: "string", desc: "物理状态" },
            { key: "official_transport_name", type: "string", desc: "正式运输名称" },
            { key: "un_number", type: "string", desc: "UN 联合国编号" },
            { key: "hazard_class", type: "string", desc: "危险货物类别" },
            { key: "packing_group", type: "string", desc: "包装类别" },
            { key: "sds_density", type: "number", desc: "SDS 密度" },
            { key: "density", type: "number", desc: "密度" },
            { key: "composition", type: "array", desc: "成分列表" },
          ],
        },
      ],
      outputs: [
        { id: "o-3-1", name: "operation", icon: "💾", description: "执行的操作类型：insert 或 update", flowsTo: [], dataType: "string" },
        { id: "o-3-2", name: "affected_rows", icon: "🔢", description: "影响的数据库行数", flowsTo: [], dataType: "number" },
        { id: "o-3-3", name: "bbn", icon: "🏷️", description: "操作的 BBN", flowsTo: [], dataType: "string" },
        { id: "o-3-4", name: "part", icon: "🏷️", description: "操作的 PART", flowsTo: [], dataType: "string" },
      ],
      executionRules: [],
      errorHandling: [],
      techConfig: { executionType: "deterministic", feasibility: "confirmed" },
    },
  },
];

export const GSDS_EDGES: Edge[] = [
  { id: "e-gsds-1-2", source: "gsds-1", target: "gsds-2", type: "default", sourceHandle: "right-out", targetHandle: "left-in" },
  { id: "e-gsds-2-3", source: "gsds-2", target: "gsds-3", type: "default", sourceHandle: "right-out", targetHandle: "left-in" },
];

// ============================================================
// 2. AI 生成的技术配置（只读参考 — 对应 TechConfig 五个 Tab）
// ============================================================

const techOverview: TechOverviewData = {
  nodeAnnotations: [
    { nodeId: "gsds-1", executionType: "deterministic", riskLevel: "low", riskReason: "SharePoint API 下载，确定性操作", estimatedLatency: "<5s", boundSkillSuggestion: "—" },
    { nodeId: "gsds-2", executionType: "intelligent", riskLevel: "medium", riskReason: "PDF 版面多变，多模态解析正确率约 90%", estimatedLatency: "10-60s", boundSkillSuggestion: "gsds-pdf-parser" },
    { nodeId: "gsds-3", executionType: "deterministic", riskLevel: "low", riskReason: "数据库 UPSERT，确定性操作", estimatedLatency: "<1s", boundSkillSuggestion: "gsds-db-writer" },
  ],
  sequenceDiagram: {
    participants: ["SharePoint", "文件下载服务", "多模态解析引擎", "GSDS 主库"],
    messages: [
      { from: "SharePoint", to: "文件下载服务", label: "PDF 文件 URL", type: "async", nodeId: "gsds-1" },
      { from: "文件下载服务", to: "多模态解析引擎", label: "pdf_file_path + file_name", type: "sync", nodeId: "gsds-2" },
      { from: "多模态解析引擎", to: "GSDS 主库", label: "gsds_record → UPSERT by BBN+PART", type: "sync", nodeId: "gsds-3" },
    ],
  },
};

const techDocuments: TechDocumentsData = {
  documents: [
    {
      id: "doc-gsds-pdf",
      name: "GSDS PDF（源文件）",
      fileType: "pdf",
      role: "external_input",
      schema: { description: "上传至 SharePoint 的 GSDS 安全数据说明书 PDF", fields: [
        { name: "BBN", type: "string", description: "BBN 编号（如 CL/VA-8.10）" },
        { name: "PART", type: "string", description: "PART 编号（如 Part 2B）" },
        { name: "颜色", type: "string", description: "如 浅黄色" },
        { name: "状态", type: "string", description: "如 透明液体" },
        { name: "UN联合国编号", type: "string", description: "四位数字" },
        { name: "危险货物类别", type: "string", description: "一位数字" },
        { name: "成分|含量|CAS", type: "string", description: "成分列表" },
        { name: "SDS密度", type: "string", description: "数值" },
        { name: "密度", type: "string", description: "数值" },
      ]},
      usedByNodes: [
        { nodeId: "gsds-1", usage: "read" },
        { nodeId: "gsds-2", usage: "read" },
      ],
    },
    {
      id: "doc-gsds-master-row",
      name: "GSDS 主库行（逻辑视图）",
      fileType: "database",
      role: "working",
      schema: { description: "主键 (BBN, PART)；按 BBN+PART 做 UPSERT", fields: [
        { name: "BBN", type: "string", description: "主键之一" },
        { name: "PART", type: "string", description: "主键之二" },
        { name: "所有解析字段", type: "json", description: "颜色、状态、UN、成分等 — 全量覆盖写入" },
        { name: "入库时间", type: "string", description: "ISO8601" },
      ]},
      usedByNodes: [
        { nodeId: "gsds-3", usage: "write" },
      ],
    },
  ],
  relationships: [
    { from: "doc-gsds-pdf", to: "doc-gsds-master-row", type: "derived_from" },
  ],
};

const techExternals: TechExternalsData = {
  externalSystems: [
    {
      id: "sys-sharepoint",
      name: "SharePoint（GSDS 文件目录）",
      type: "file_system",
      relatedNodes: ["gsds-1"],
      integration: { current: "file_transfer", target: "api", readiness: "partial" },
      auth: { type: "bearer_token" },
      capabilities: ["文件下载", "Webhook 事件通知"],
      constraints: [
        { type: "file_size", detail: "PDF 通常 1-5MB" },
        { type: "availability", detail: "依赖企业 SharePoint 服务可用性" },
      ],
      humanFallback: "SharePoint 不可用时，用户可通过本地上传入口触发",
      automationPriority: "high",
      estimatedEffort: "2-3 天（API 对接 + Webhook）",
    },
    {
      id: "sys-gsds-master-db",
      name: "GSDS 主数据库",
      type: "database",
      relatedNodes: ["gsds-3"],
      integration: { current: "database_query", target: "database_query", readiness: "ready" },
      auth: { type: "username_password" },
      capabilities: ["SELECT 按 BBN+PART 查询", "INSERT 新记录", "UPDATE 覆盖已有记录"],
      constraints: [
        { type: "rate_limit", detail: "连接池上限 50" },
      ],
      humanFallback: "数据库不可用时暂停写入并告警",
      automationPriority: "high",
      estimatedEffort: "1 天（已有 DB 驱动）",
    },
  ],
};

const techGuards: TechGuardsData = {
  guards: [
    {
      nodeId: "gsds-1",
      monitors: [{ type: "structural", description: "SharePoint 下载成功率", checks: [
        { field: "pdf_file_path", rule: "not_empty", severity: "error" },
      ] }],
      issueCategories: ["SharePoint 连接失败", "文件不存在", "权限不足"],
      escalation: { business: [], tech: ["检查 SharePoint API 凭证和网络"] },
    },
    {
      nodeId: "gsds-2",
      monitors: [{ type: "structural", description: "解析字段完整性", checks: [
        { field: "bbn", rule: "not_empty", severity: "error" },
        { field: "part", rule: "not_empty", severity: "error" },
      ], threshold: 0.95 }],
      issueCategories: ["解析遗漏", "PDF 版面异常", "多模态模型超时"],
      escalation: { business: ["通知数据管理员"], tech: ["检查版面模板或切换解析模型"] },
    },
    {
      nodeId: "gsds-3",
      monitors: [{ type: "structural", description: "写库成功率", checks: [
        { field: "operation", rule: "not_empty", severity: "error" },
        { field: "affected_rows", rule: "range", severity: "error" },
      ] }],
      issueCategories: ["写库失败", "唯一约束冲突", "连接池耗尽"],
      escalation: { business: ["通知数据管理员"], tech: ["检查 DB 连接池和唯一索引"] },
    },
  ],
};

const techDeployment: TechDeploymentData = {
  services: [
    { nodeId: "gsds-1", serviceName: "gsds-file-fetcher", runtime: "node", dependencies: ["sharepoint-sdk"], resourceRequirements: { cpu: "low", memory: "low" } },
    { nodeId: "gsds-2", serviceName: "gsds-pdf-parser", runtime: "python", dependencies: ["multimodal-api", "pdf-parser-lib"], resourceRequirements: { cpu: "medium", memory: "medium" } },
    { nodeId: "gsds-3", serviceName: "gsds-db-writer", runtime: "node", dependencies: ["db-driver"], resourceRequirements: { cpu: "low", memory: "low" } },
  ],
  messaging: [
    { from: "gsds-1", to: "gsds-2", type: "sync", format: "json" },
    { from: "gsds-2", to: "gsds-3", type: "sync", format: "json" },
  ],
  envVars: [
    { name: "SHAREPOINT_API_URL", description: "SharePoint API 地址", secret: false, relatedNode: "gsds-1" },
    { name: "SHAREPOINT_TOKEN", description: "SharePoint Bearer Token", secret: true, relatedNode: "gsds-1" },
    { name: "GSDS_DB_URL", description: "GSDS 主库连接串", secret: true, relatedNode: "gsds-3" },
    { name: "GSDS_DB_USER", description: "主库用户名", secret: true, relatedNode: "gsds-3" },
  ],
  resourceLimits: [
    { resource: "PDF 解析并发", limit: "5 / 分钟", strategy: "queue" },
    { resource: "DB 写入连接", limit: "50 连接池", strategy: "reserve_commit" },
  ],
};

export const GSDS_TECH_CONFIG: TechConfig = {
  overview: techOverview,
  documents: techDocuments,
  externals: techExternals,
  guards: techGuards,
  deployment: techDeployment,
  tabStates: {
    overview: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    documents: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    externals: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    guards: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    deployment: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
  },
};

// ============================================================
// 3. 技术方绑定数据（预填一部分，模拟"填了一半"）
// ============================================================

export const GSDS_TECH_BINDINGS: TechBindingState = {
  global: {
    timezone: "Asia/Shanghai",
  },
  documentsById: {
    "doc-gsds-pdf": {
      contextSourceCode: "cs-sharepoint-pdf",
      sourceType: "object_storage",
      sensitivity: "internal",
    },
    "doc-gsds-master-row": {
      contextSourceCode: "cs-gsds-master-db",
      sourceType: "http",
      sensitivity: "confidential",
    },
  },
  externalsById: {
    "sys-sharepoint": {
      toolCode: "sharepoint-file-download",
      secretCode: "sharepoint-api-credential",
    },
    "sys-gsds-master-db": {
      toolCode: "gsds-db-upsert",
      secretCode: "gsds-db-credential",
    },
  },
  nodesById: {
    "gsds-1": {
      taskCode: "fetch-pdf",
      taskType: "integration",
      skillBindingCodes: [],
      runtimeProfileCode: "integration-default",
      contextPolicyCode: "minimal",
      reviewPolicyCode: "",
      toolCodes: ["sharepoint-file-download"],
      secretRefs: ["sharepoint-api-credential"],
    },
    "gsds-2": {
      taskCode: "parse-pdf",
      taskType: "agentic",
      skillBindingCodes: ["skill-gsds-pdf-parser"],
      runtimeProfileCode: "agentic-default",
      contextPolicyCode: "last-output-only",
      reviewPolicyCode: "",
      toolCodes: [],
      secretRefs: [],
    },
    "gsds-3": {
      taskCode: "upsert-db",
      taskType: "integration",
      skillBindingCodes: ["skill-gsds-db-upsert"],
      runtimeProfileCode: "integration-default",
      contextPolicyCode: "last-output-only",
      reviewPolicyCode: "",
      toolCodes: ["gsds-db-upsert"],
      secretRefs: ["gsds-db-credential"],
    },
  },
};

export const GSDS_TECH_JOB_META = {
  code: "gsds-ingest",
  name: "GSDS 入库",
  description: "从 SharePoint 获取 GSDS PDF → 多模态解析提取字段 → BBN+PART 做 UPSERT 写入主数据库",
  inputSchemaJson: "",
  defaultRuntimeProfileCode: "agentic-default",
  defaultReviewPolicyCode: "",
};

export const GSDS_JOB_TRIGGER_CODES = ["gsds-pdf-uploaded"];

export const GSDS_ADAPTIVE_CONFIG: AdaptiveConfigState = {
  runtimeAdjustable: [
    { path: "task-parse-pdf.timeout", valueType: "number", scope: "hot", description: "解析超时（秒）" },
    { path: "task-upsert-db.retryPolicy.maxRetries", valueType: "number", scope: "warm", description: "写库最大重试次数" },
  ],
  envAssumptions: [
    { id: "ea-1", description: "SharePoint 7×24 可用", monitorType: "heartbeat", interval: "5m", warningThreshold: "1 次 miss", criticalThreshold: "3 次 miss" },
    { id: "ea-2", description: "GSDS 主库连接池充足", monitorType: "metric", interval: "1m", warningThreshold: "使用率 > 80%", criticalThreshold: "使用率 > 95%" },
  ],
  adjustmentPolicies: [
    { id: "ap-1", title: "SharePoint 不可用降级", triggerCondition: "ea-1 critical", actions: "暂停入库 Job 并告警；恢复后自动补跑" },
    { id: "ap-2", title: "写库高峰限流", triggerCondition: "ea-2 warning", actions: "降低并发至 2；释放多余连接" },
  ],
};

// ============================================================
// 4. 对话消息 — 模拟业务方提需求
// ============================================================

export const GSDS_CHAT_MESSAGES = [
  {
    id: "gsds-msg-1",
    role: "user" as const,
    content: "我们需要做一个 GSDS 入库流程：用户在 SharePoint 上传 GSDS PDF 文件，系统自动解析 PDF 得到 BBN、PART、颜色、状态、UN编号、各项危害类别、密度、成分列表等字段，然后按 BBN+PART 在数据库中做唯一性判断——有就 UPDATE，没有就 INSERT。",
    timestamp: "2026-05-07T10:00:00Z",
  },
  {
    id: "gsds-msg-2",
    role: "assistant" as const,
    content: "已为你生成 GSDS 入库流程，包含 3 个步骤：\n\n1. **获取 PDF 文件** — 从 SharePoint 下载 PDF 到临时存储\n2. **解析 GSDS PDF** — 多模态解析，提取 BBN、PART、颜色、UN 编号、成分等全部字段\n3. **写入主数据库** — 按 BBN+PART 做 UPSERT（有则覆盖，无则新增）\n\n流程已展示在右侧画布上，你可以点击任一节点查看详情。",
    timestamp: "2026-05-07T10:00:30Z",
  },
];
