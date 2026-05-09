/**
 * 平台已注册、可在 Task 上绑定的 Skill（演示数据）。
 * 上线后应由接口返回「当前租户 / 环境可见的 Skill 列表」替换。
 */
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
  {
    code: "skill-gsds-validation-script",
    title: "规则脚本校验",
    summary: "确定性校验与报告",
  },
  {
    code: "skill-gsds-db-upsert",
    title: "主库写入 / 覆盖",
    summary: "UPSERT 与幂等",
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
}

export const REGISTERED_TRIGGER_OPTIONS: RegisteredTriggerOption[] = [
  {
    code: "gsds-pdf-uploaded",
    title: "PDF 文件上传",
    summary: "用户通过前端上传 PDF 后自动触发",
  },
  {
    code: "schedule-daily-9am",
    title: "每日定时（9:00）",
    summary: "每天早 9 点自动执行，cron: 0 9 * * *",
  },
  {
    code: "schedule-hourly",
    title: "每小时定时",
    summary: "每小时整点执行，cron: 0 * * * *",
  },
  {
    code: "manual-trigger",
    title: "人工手动触发",
    summary: "操作人员在控制台点击启动",
  },
  {
    code: "upstream-job-done",
    title: "上游 Job 完成",
    summary: "前序 Job 成功完成后自动触发",
  },
  {
    code: "api-webhook",
    title: "外部 API / Webhook",
    summary: "外部系统通过 REST 接口触发",
  },
  {
    code: "data-change-event",
    title: "数据变更事件",
    summary: "监听数据库 / 消息队列的变更事件触发",
  },
];

export function labelForTriggerCode(code: string): string {
  const o = REGISTERED_TRIGGER_OPTIONS.find((t) => t.code === code);
  return o ? o.title : code;
}

/* --- 平台已注册的上下文打包策略（演示数据） --- */
export interface RegisteredContextPolicyOption {
  code: string;
  title: string;
  summary?: string;
}

export const REGISTERED_CONTEXT_POLICY_OPTIONS: RegisteredContextPolicyOption[] = [
  {
    code: "full-history",
    title: "完整历史",
    summary: "将前序所有 Task 的输入输出全部打包，适合决策类 Task",
  },
  {
    code: "last-output-only",
    title: "仅上一步输出",
    summary: "只传入直接上游 Task 的输出，减少 Token 消耗",
  },
  {
    code: "selective-fields",
    title: "按字段选取",
    summary: "根据 Task input_schema 自动匹配所需字段，精准裁剪上下文",
  },
  {
    code: "document-augmented",
    title: "文档增强",
    summary: "除上游输出外，额外拉取绑定文档（RAG），适合知识密集型 Task",
  },
  {
    code: "minimal",
    title: "最小化",
    summary: "仅传入 Task 自身 input_schema 必填字段，最低成本",
  },
];

export function labelForContextPolicyCode(code: string): string {
  const o = REGISTERED_CONTEXT_POLICY_OPTIONS.find((p) => p.code === code);
  return o ? o.title : code;
}
