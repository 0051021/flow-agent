/**
 * GSDS 入库流程 demo seed —— 用于一键加载到编辑器中演示 JobSpec 技术配置。
 *
 * 5 个节点：获取 PDF → 解析 GSDS PDF → 校验解析结果 → 人工确认入库 → 写入主数据库
 * 线性流程，无条件分支。BBN+PART 做 UPSERT。
 */

import type { Node, Edge } from "@xyflow/react";
import type {
  FlowNodeData,
  TechConfig,
  TechBindingState,
  TechOverviewData,
} from "./types";

// ============================================================
// 1. 画布节点 & 边
// ============================================================

const SX = 420;
const X0 = 60;
const Y0 = 120;
const TOTAL = 5;

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
      label: "校验解析结果",
      icon: "CheckCircle",
      description: "按平台内置 GSDS 字段规则做确定性校验：BBN、PART、密度、UN 编号、危险类别和成分结构必须符合入库标准；通过后输出 validated_record。",
      stepIndex: 3,
      totalSteps: TOTAL,
      executionMode: "ai_auto",
      estimatedTime: "秒级",
      inputs: [
        {
          id: "i-3-1", name: "gsds_record", icon: "📊", description: "解析后的 GSDS 结构化记录", required: true, source: "previous_step", dataType: "json",
          subFields: [
            { key: "bbn", type: "string", desc: "必填，BBN 编号" },
            { key: "part", type: "string", desc: "必填，PART 编号" },
            { key: "un_number", type: "string", desc: "如存在必须为四位数字" },
            { key: "density", type: "number", desc: "如存在必须等于 SDS 密度四舍五入两位" },
            { key: "composition", type: "array", desc: "成分列表结构" },
          ],
        },
      ],
      outputs: [
        { id: "o-3-1", name: "passed", icon: "✅", description: "是否通过写库前校验", flowsTo: ["gsds-4"], dataType: "boolean" },
        { id: "o-3-2", name: "validated_record", icon: "📊", description: "通过校验并标准化后的 GSDS 记录", flowsTo: ["gsds-4"], dataType: "json" },
        { id: "o-3-3", name: "validation_errors", icon: "⚠️", description: "校验失败字段及原因列表", flowsTo: [], dataType: "array" },
      ],
      executionRules: [],
      errorHandling: [],
      techConfig: { executionType: "deterministic", feasibility: "confirmed" },
    },
  },
  {
    id: "gsds-4",
    type: "flowCard",
    position: { x: X0 + SX * 3, y: Y0 },
    data: {
      label: "人工确认入库",
      icon: "UserCheck",
      description: "数据管理员查看字段校验结果和标准化记录，确认是否允许写入 GSDS 主库；拒绝时记录原因并终止写库。",
      stepIndex: 4,
      totalSteps: TOTAL,
      executionMode: "human_confirm",
      estimatedTime: "5-30 分钟",
      inputs: [
        {
          id: "i-4-1", name: "validated_record", icon: "📊", description: "通过机器校验并标准化后的 GSDS 记录", required: true, source: "previous_step", dataType: "json",
          subFields: [
            { key: "bbn", type: "string", desc: "BBN 编号" },
            { key: "part", type: "string", desc: "PART 编号" },
            { key: "un_number", type: "string", desc: "UN 联合国编号" },
            { key: "density", type: "number", desc: "标准化密度" },
            { key: "composition", type: "array", desc: "成分列表" },
          ],
        },
        { id: "i-4-2", name: "passed", icon: "✅", description: "机器校验结果，必须为 true 才进入人工确认", required: true, source: "previous_step", dataType: "boolean" },
        { id: "i-4-3", name: "validation_errors", icon: "⚠️", description: "校验提示或非阻断告警，供人工复核", required: false, source: "previous_step", dataType: "array" },
      ],
      outputs: [
        { id: "o-4-1", name: "approval_decision", icon: "✅", description: "人工确认结果：approved / rejected / need_fix", flowsTo: ["gsds-5"], dataType: "string" },
        { id: "o-4-2", name: "approved_record", icon: "📊", description: "人工确认后允许写库的 GSDS 记录", flowsTo: ["gsds-5"], dataType: "json" },
        { id: "o-4-3", name: "review_comment", icon: "💬", description: "人工审核意见或拒绝原因", flowsTo: ["gsds-5"], dataType: "string" },
      ],
      executionRules: [],
      errorHandling: [],
      techConfig: { executionType: "deterministic", feasibility: "confirmed" },
    },
  },
  {
    id: "gsds-route-approval",
    type: "flowCard",
    position: { x: X0 + SX * 4, y: Y0 + 12 },
    data: {
      label: "是否批准入库",
      icon: "GitBranch",
      description: "读取人工确认节点输出的 approval_decision：approved 时进入写库；rejected 或 need_fix 时终止写库并保留审核意见。",
      stepIndex: 0,
      totalSteps: TOTAL,
      executionMode: "ai_auto",
      estimatedTime: "不运行",
      inputs: [],
      outputs: [],
      executionRules: [],
      errorHandling: [],
      techConfig: { executionType: "deterministic", feasibility: "confirmed" },
      isCondition: true,
      conditionBranches: [
        { label: "approval_decision = approved", icon: "✓", targetLabel: "写入主数据库" },
        { label: "otherwise", icon: "↯", targetLabel: "终止写库并记录意见" },
      ],
    },
  },
  {
    id: "gsds-5",
    type: "flowCard",
    position: { x: X0 + SX * 5, y: Y0 },
    data: {
      label: "写入主数据库",
      icon: "Database",
      description: "当人工确认结果 approval_decision=approved 时，以 BBN + PART 为唯一键调用已注册写库 Tool：已存在则 UPDATE 覆盖全部字段，不存在则 INSERT 新记录，并返回写入回执。",
      stepIndex: 5,
      totalSteps: TOTAL,
      executionMode: "ai_auto",
      estimatedTime: "秒级",
      inputs: [
        {
          id: "i-5-1", name: "approved_record", icon: "📊", description: "人工确认后允许写库的 GSDS 记录", required: true, source: "previous_step", dataType: "json",
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
        { id: "i-5-2", name: "approval_decision", icon: "✅", description: "人工确认结果，必须为 approved 才允许写库", required: true, source: "previous_step", dataType: "string" },
      ],
      outputs: [
        { id: "o-5-1", name: "operation", icon: "💾", description: "执行的操作类型：insert 或 update", flowsTo: [], dataType: "string" },
        { id: "o-5-2", name: "affected_rows", icon: "🔢", description: "影响的数据库行数", flowsTo: [], dataType: "number" },
        { id: "o-5-3", name: "bbn", icon: "🏷️", description: "操作的 BBN", flowsTo: [], dataType: "string" },
        { id: "o-5-4", name: "part", icon: "🏷️", description: "操作的 PART", flowsTo: [], dataType: "string" },
        { id: "o-5-5", name: "write_receipt_id", icon: "🧾", description: "写库 Tool 返回的幂等回执编号", flowsTo: [], dataType: "string" },
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
  { id: "e-gsds-3-4", source: "gsds-3", target: "gsds-4", type: "default", sourceHandle: "right-out", targetHandle: "left-in" },
  { id: "e-gsds-4-route", source: "gsds-4", target: "gsds-route-approval", type: "default", sourceHandle: "right-out", targetHandle: "left-in" },
  { id: "e-gsds-route-5", source: "gsds-route-approval", target: "gsds-5", type: "default", sourceHandle: "right-out", targetHandle: "left-in" },
];

// ============================================================
// 2. AI 生成的技术配置（只读参考 — 对应 TechConfig 五个 Tab）
// ============================================================

const techOverview: TechOverviewData = {
  nodeAnnotations: [
    { nodeId: "gsds-1", executionType: "deterministic", riskLevel: "low", riskReason: "SharePoint API 下载，确定性操作", estimatedLatency: "<5s", boundSkillSuggestion: "—" },
    { nodeId: "gsds-2", executionType: "intelligent", riskLevel: "medium", riskReason: "PDF 版面多变，多模态解析正确率约 90%", estimatedLatency: "10-60s", boundSkillSuggestion: "gsds-pdf-parser" },
    { nodeId: "gsds-3", executionType: "deterministic", riskLevel: "medium", riskReason: "写库前门禁，必须阻断低质量解析结果", estimatedLatency: "<1s", boundSkillSuggestion: "—" },
    { nodeId: "gsds-4", executionType: "deterministic", riskLevel: "medium", riskReason: "写库前人工验收，防止低质量数据进入主库", estimatedLatency: "5-30min", boundSkillSuggestion: "—" },
    { nodeId: "gsds-5", executionType: "deterministic", riskLevel: "low", riskReason: "数据库 UPSERT，确定性操作", estimatedLatency: "<1s", boundSkillSuggestion: "—" },
  ],
  sequenceDiagram: {
    participants: ["SharePoint", "文件下载服务", "多模态解析引擎", "校验 Worker", "数据管理员", "GSDS 主库"],
    messages: [
      { from: "SharePoint", to: "文件下载服务", label: "PDF 文件 URL", type: "async", nodeId: "gsds-1" },
      { from: "文件下载服务", to: "多模态解析引擎", label: "pdf_file_path + file_name", type: "sync", nodeId: "gsds-2" },
      { from: "多模态解析引擎", to: "校验 Worker", label: "gsds_record → 字段规则校验", type: "sync", nodeId: "gsds-3" },
      { from: "校验 Worker", to: "数据管理员", label: "validated_record + 校验报告", type: "async", nodeId: "gsds-4" },
      { from: "数据管理员", to: "GSDS 主库", label: "approved_record → UPSERT by BBN+PART", type: "sync", nodeId: "gsds-5" },
    ],
  },
};

export const GSDS_TECH_CONFIG: TechConfig = {
  overview: techOverview,
  documents: null,
  externals: null,
  guards: null,
  deployment: null,
  tabStates: {
    overview: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    documents: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    externals: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    guards: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
    deployment: { status: "ready", generatedAt: "2026-05-07T10:00:00Z" },
  },
};

// ============================================================
// 3. 技术方绑定数据（完整 mock，表达 FlowAgent 只填写 JobSpec Task 可引用字段）
// ============================================================

export const GSDS_TECH_BINDINGS: TechBindingState = {
  global: {},
  documentsById: {},
  externalsById: {},
  nodesById: {
    "gsds-1": {
      taskCode: "fetch-pdf",
      taskType: "integration",
      skillBindingCodes: [],
      runtimeProfileCode: "integration-default",
      contextPolicyCode: "gsds-pdf-fetch-context",
      reviewPolicyCode: "",
      toolCodes: ["sharepoint-file-download"],
      secretRefs: ["sharepoint-api-credential"],
    },
    "gsds-2": {
      taskCode: "parse-pdf",
      taskType: "agentic",
      skillBindingCodes: ["skill-gsds-pdf-parser"],
      runtimeProfileCode: "agentic-default",
      contextPolicyCode: "gsds-pdf-parse-context",
      reviewPolicyCode: "",
      toolCodes: [],
      secretRefs: [],
    },
    "gsds-3": {
      taskCode: "validate-gsds-record",
      taskType: "deterministic",
      skillBindingCodes: [],
      runtimeProfileCode: "script-fast",
      contextPolicyCode: "gsds-parse-validation-context",
      reviewPolicyCode: "",
      toolCodes: [],
      secretRefs: [],
    },
    "gsds-4": {
      taskCode: "approve-gsds-ingest",
      taskType: "human_review",
      skillBindingCodes: [],
      runtimeProfileCode: undefined,
      contextPolicyCode: undefined,
      reviewPolicyCode: "gsds-data-steward-review",
      toolCodes: [],
      secretRefs: [],
    },
    "gsds-5": {
      taskCode: "upsert-gsds-master",
      taskType: "integration",
      skillBindingCodes: [],
      runtimeProfileCode: "integration-default",
      contextPolicyCode: "gsds-db-write-context",
      reviewPolicyCode: "",
      toolCodes: ["gsds-db-upsert"],
      secretRefs: ["gsds-db-credential"],
    },
  },
};

export const GSDS_TECH_JOB_META = {
  code: "gsds-pdf-ingest",
  name: "GSDS PDF 自动入库 Job",
  description: "从 SharePoint 获取 GSDS PDF → 多模态解析提取字段 → 确定性校验 → 人工确认 → BBN+PART 做 UPSERT 写入主数据库",
  inputSchemaJson: `{
  "type": "object",
  "required": ["sharepoint_file_url", "file_name"],
  "properties": {
    "sharepoint_file_url": {
      "type": "string",
      "description": "SharePoint 指定文件夹中新上传的 GSDS PDF 文件地址"
    },
    "file_name": {
      "type": "string",
      "description": "上传文件名，用于审计和重复文件判断"
    },
    "uploaded_at": {
      "type": "string",
      "format": "date-time",
      "description": "文件进入文件夹的时间"
    }
  }
}`,
  defaultRuntimeProfileCode: "agentic-default",
  defaultReviewPolicyCode: "",
};

export const GSDS_JOB_TRIGGER_CODES = ["gsds-pdf-uploaded"];

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
    content: "已为你生成 GSDS 入库流程，包含 5 个步骤：\n\n1. **获取 PDF 文件** — 从 SharePoint 下载 PDF 到临时存储\n2. **解析 GSDS PDF** — 多模态解析，提取 BBN、PART、颜色、UN 编号、成分等字段\n3. **校验解析结果** — 用确定性规则校验关键字段、密度计算和格式\n4. **人工确认入库** — 数据管理员复核校验结果并决定是否允许写库\n5. **写入主数据库** — 人工确认通过后按 BBN+PART 做 UPSERT（有则覆盖，无则新增）\n\n流程已展示在右侧画布上，你可以点击任一节点查看详情。",
    timestamp: "2026-05-07T10:00:30Z",
  },
];
