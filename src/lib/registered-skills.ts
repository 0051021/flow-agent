/**
 * 平台已注册、可在 Task 上绑定的 Skill（演示数据）。
 * 上线后应由接口返回「当前租户 / 环境可见的 Skill 列表」替换。
 */
import type { PlatformTaskType } from "./types";

export interface RegisteredSkillOption {
  code: string;
  title: string;
  /** 一行说明，展示在下拉项副文案 */
  summary?: string;
}

export const REGISTERED_SKILL_OPTIONS: RegisteredSkillOption[] = [
  {
    code: "skill-gsds-pdf-parser",
    title: "GSDS PDF 解析",
    summary: "PDF → 结构化字段",
  },
];

const codeSet = new Set(REGISTERED_SKILL_OPTIONS.map((s) => s.code));

export function isRegisteredSkillCode(code: string): boolean {
  return codeSet.has(code.trim());
}

export function labelForSkillCode(code: string): string {
  const o = REGISTERED_SKILL_OPTIONS.find((s) => s.code === code);
  return o ? `${o.title}（${o.code}）` : code;
}

/* ─── 平台已注册的触发器（演示数据） ─── */

export interface RegisteredTriggerOption {
  code: string;
  title: string;
  summary?: string;
  status?: "draft" | "published" | "disabled";
  type?: "api" | "webhook" | "schedule";
  inputSchema?: Record<string, unknown>;
}

export const REGISTERED_TRIGGER_OPTIONS: RegisteredTriggerOption[] = [
  {
    code: "gsds-pdf-uploaded",
    title: "PDF 文件上传",
    summary: "用户通过前端上传 PDF 后自动触发",
    status: "published",
    type: "webhook",
    inputSchema: {
      type: "object",
      required: ["sharepoint_file_url", "file_name", "uploaded_at"],
      properties: {
        sharepoint_file_url: {
          type: "string",
          description: "SharePoint 中新增 GSDS PDF 的文件地址",
        },
        file_name: {
          type: "string",
          description: "上传文件名",
        },
        uploaded_at: {
          type: "string",
          format: "date-time",
          description: "文件进入监听目录的时间",
        },
      },
    },
  },
  {
    code: "schedule-daily-9am",
    title: "每日定时（9:00）",
    summary: "每天早 9 点自动执行，cron: 0 9 * * *",
    status: "published",
    type: "schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduled_at: {
          type: "string",
          format: "date-time",
          description: "调度触发时间",
        },
      },
    },
  },
  {
    code: "schedule-hourly",
    title: "每小时定时",
    summary: "每小时整点执行，cron: 0 * * * *",
    status: "published",
    type: "schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduled_at: {
          type: "string",
          format: "date-time",
          description: "调度触发时间",
        },
      },
    },
  },
  {
    code: "manual-trigger",
    title: "人工手动触发",
    summary: "操作人员在控制台点击启动",
    status: "published",
    type: "api",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    code: "upstream-job-done",
    title: "上游 Job 完成",
    summary: "前序 Job 成功完成后自动触发",
    status: "published",
    type: "api",
    inputSchema: {
      type: "object",
      required: ["upstream_job_instance_id", "business_key"],
      properties: {
        upstream_job_instance_id: {
          type: "string",
          description: "上游 JobInstance 编号",
        },
        business_key: {
          type: "string",
          description: "跨 Job 关联业务键",
        },
      },
    },
  },
  {
    code: "api-webhook",
    title: "外部 API / Webhook",
    summary: "外部系统通过 REST 接口触发",
    status: "published",
    type: "webhook",
    inputSchema: {
      type: "object",
      required: ["event_id", "payload"],
      properties: {
        event_id: {
          type: "string",
          description: "外部事件幂等键",
        },
        payload: {
          type: "object",
          description: "外部系统传入的业务载荷",
        },
      },
    },
  },
  {
    code: "data-change-event",
    title: "数据变更事件",
    summary: "监听数据库 / 消息队列的变更事件触发",
    status: "published",
    type: "api",
    inputSchema: {
      type: "object",
      required: ["change_event_id", "record_key"],
      properties: {
        change_event_id: {
          type: "string",
          description: "数据变更事件幂等键",
        },
        record_key: {
          type: "string",
          description: "发生变更的数据主键",
        },
      },
    },
  },
];

export function labelForTriggerCode(code: string): string {
  const o = REGISTERED_TRIGGER_OPTIONS.find((t) => t.code === code);
  return o ? o.title : code;
}

/* --- 平台已注册的 RuntimeProfile / ReviewPolicy（演示数据） --- */

export interface RegisteredRuntimeProfileOption {
  code: string;
  title: string;
  summary?: string;
  status?: "draft" | "published" | "disabled";
  providerType?: "openclaw" | "http_worker" | "custom_worker";
  taskTypes: PlatformTaskType[];
}

export const REGISTERED_RUNTIME_PROFILE_OPTIONS: RegisteredRuntimeProfileOption[] = [
  {
    code: "agentic-default",
    title: "多模态解析执行器",
    summary: "OpenClaw / Agentic Runtime，用于 GSDS PDF 解析和结构化抽取",
    status: "published",
    providerType: "openclaw",
    taskTypes: ["agentic"],
  },
  {
    code: "integration-default",
    title: "平台 HTTP 集成执行器",
    summary: "HTTP Worker，用于文件下载、主库写入等系统集成任务",
    status: "published",
    providerType: "http_worker",
    taskTypes: ["integration"],
  },
  {
    code: "script-fast",
    title: "确定性规则校验执行器",
    summary: "Custom Worker，用于字段格式、必填项和规则一致性校验",
    status: "published",
    providerType: "custom_worker",
    taskTypes: ["deterministic"],
  },
];

export function labelForRuntimeProfileCode(code: string): string {
  const o = REGISTERED_RUNTIME_PROFILE_OPTIONS.find((runtime) => runtime.code === code);
  return o ? `${o.title} · ${o.code}` : code;
}

export interface RegisteredReviewPolicyOption {
  code: string;
  title: string;
  summary?: string;
  status?: "draft" | "published" | "disabled";
  reviewerGroups?: string[];
  slaHours?: number;
}

export const REGISTERED_REVIEW_POLICY_OPTIONS: RegisteredReviewPolicyOption[] = [
  {
    code: "gsds-data-steward-review",
    title: "GSDS 数据管理员入库确认",
    summary: "写入主库前由数据管理员确认解析结果和校验报告",
    status: "published",
    reviewerGroups: ["gsds-data-stewards"],
    slaHours: 24,
  },
  {
    code: "finance-exception-review",
    title: "财务异常单据审核",
    summary: "高风险或低置信度单据进入财务人工审核队列",
    status: "published",
    reviewerGroups: ["finance-ops"],
    slaHours: 8,
  },
];

export function labelForReviewPolicyCode(code: string): string {
  const o = REGISTERED_REVIEW_POLICY_OPTIONS.find((policy) => policy.code === code);
  return o ? `${o.title} · ${o.code}` : code;
}

/* --- 平台已注册的 Tool / Secret（演示数据） --- */

export interface RegisteredToolOption {
  code: string;
  title: string;
  summary?: string;
  status?: "draft" | "published" | "disabled";
  type?: "http";
  secretRefs?: string[];
}

export const REGISTERED_TOOL_OPTIONS: RegisteredToolOption[] = [
  {
    code: "sharepoint-file-download",
    title: "SharePoint 文件下载",
    summary: "根据触发器传入的文件 URL 下载 GSDS PDF",
    status: "published",
    type: "http",
    secretRefs: ["sharepoint-api-credential"],
  },
  {
    code: "gsds-db-upsert",
    title: "GSDS 主库 UPSERT",
    summary: "按 BBN + PART 写入或覆盖 GSDS 主库记录",
    status: "published",
    type: "http",
    secretRefs: ["gsds-db-credential"],
  },
  {
    code: "notify-data-steward",
    title: "通知数据管理员",
    summary: "向数据管理员发送补充材料或审核提醒",
    status: "published",
    type: "http",
    secretRefs: ["notification-service-credential"],
  },
];

export interface RegisteredSecretOption {
  code: string;
  title: string;
  summary?: string;
  status?: "active" | "disabled" | "rotating" | "revoked";
  provider?: "env" | "external_ref";
}

export const REGISTERED_SECRET_OPTIONS: RegisteredSecretOption[] = [
  {
    code: "sharepoint-api-credential",
    title: "SharePoint API 凭证",
    summary: "provider=env，供 SharePoint 文件读取 Tool 使用",
    status: "active",
    provider: "env",
  },
  {
    code: "gsds-db-credential",
    title: "GSDS 主库凭证",
    summary: "provider=env，供 GSDS 主库写入 Tool 使用",
    status: "active",
    provider: "env",
  },
  {
    code: "notification-service-credential",
    title: "通知服务凭证",
    summary: "provider=env，供消息通知 Tool 使用",
    status: "active",
    provider: "env",
  },
];

/* --- 平台已注册的上下文打包策略（演示数据） --- */
export interface RegisteredContextPolicyOption {
  code: string;
  title: string;
  summary?: string;
  status?: "draft" | "published" | "disabled";
  includesJobInput?: boolean;
  includesUpstreamOutputs?: boolean;
  includeSources?: string[];
  requiredFields?: string[];
  redactionPatterns?: string[];
  maxPayloadKb?: number;
}

export const REGISTERED_CONTEXT_POLICY_OPTIONS: RegisteredContextPolicyOption[] = [
  {
    code: "gsds-pdf-fetch-context",
    title: "GSDS PDF 获取上下文",
    summary: "包含触发器输入中的文件地址和文件元数据；不额外拉取文档源。",
    status: "published",
    includesJobInput: true,
    includesUpstreamOutputs: false,
    includeSources: [],
    requiredFields: ["job_input.sharepoint_file_url", "job_input.file_name"],
    redactionPatterns: ["token", "authorization"],
    maxPayloadKb: 128,
  },
  {
    code: "gsds-pdf-parse-context",
    title: "GSDS PDF 解析上下文",
    summary: "包含上游下载结果，并加载 GSDS 字段映射规则供解析 Task 使用。",
    status: "published",
    includesJobInput: true,
    includesUpstreamOutputs: true,
    includeSources: ["cs-gsds-field-map"],
    requiredFields: ["upstream.fetch-pdf.pdf_file_path"],
    redactionPatterns: ["token", "authorization"],
    maxPayloadKb: 1024,
  },
  {
    code: "gsds-db-write-context",
    title: "GSDS 主库写入上下文",
    summary: "包含人工确认后的 approved_record 和主库记录摘要，用于 UPSERT 前判断。",
    status: "published",
    includesJobInput: false,
    includesUpstreamOutputs: true,
    includeSources: ["cs-gsds-master-db"],
    requiredFields: [
      "upstream.approve-gsds-ingest.approval_decision",
      "upstream.approve-gsds-ingest.approved_record.bbn",
      "upstream.approve-gsds-ingest.approved_record.part",
    ],
    redactionPatterns: ["token", "authorization", "password"],
    maxPayloadKb: 512,
  },
  {
    code: "gsds-parse-validation-context",
    title: "GSDS 解析校验上下文",
    summary: "包含解析后的 gsds_record 和字段校验规则，用于写库前确定性校验。",
    status: "published",
    includesJobInput: true,
    includesUpstreamOutputs: true,
    includeSources: ["cs-gsds-validation-rules"],
    requiredFields: [
      "upstream.parse-pdf.gsds_record.bbn",
      "upstream.parse-pdf.gsds_record.part",
      "upstream.parse-pdf.gsds_record.density",
    ],
    redactionPatterns: ["token", "authorization"],
    maxPayloadKb: 512,
  },
  {
    code: "full-history",
    title: "完整历史",
    summary: "将前序所有 Task 的输入输出全部打包，适合决策类 Task",
    status: "published",
    includesJobInput: true,
    includesUpstreamOutputs: true,
    includeSources: [],
    maxPayloadKb: 512,
  },
  {
    code: "last-output-only",
    title: "仅上一步输出",
    summary: "只传入直接上游 Task 的输出，减少 Token 消耗",
    status: "published",
    includesJobInput: false,
    includesUpstreamOutputs: true,
    includeSources: [],
    maxPayloadKb: 256,
  },
  {
    code: "selective-fields",
    title: "按字段选取",
    summary: "根据 Task input_schema 自动匹配所需字段，精准裁剪上下文",
    status: "published",
    includesJobInput: true,
    includesUpstreamOutputs: true,
    includeSources: [],
    maxPayloadKb: 256,
  },
  {
    code: "document-augmented",
    title: "文档增强",
    summary: "除上游输出外，额外拉取绑定文档（RAG），适合知识密集型 Task",
    status: "published",
    includesJobInput: true,
    includesUpstreamOutputs: true,
    includeSources: ["registered-context-source"],
    redactionPatterns: ["token", "secret", "password", "authorization"],
    maxPayloadKb: 1024,
  },
  {
    code: "minimal",
    title: "最小化",
    summary: "仅传入 Task 自身 input_schema 必填字段，最低成本",
    status: "published",
    includesJobInput: false,
    includesUpstreamOutputs: false,
    includeSources: [],
    maxPayloadKb: 64,
  },
];

export function labelForContextPolicyCode(code: string): string {
  const o = REGISTERED_CONTEXT_POLICY_OPTIONS.find((p) => p.code === code);
  return o ? o.title : code;
}
