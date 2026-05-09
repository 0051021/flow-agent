import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export const maxDuration = 300;

// ============================================================
// System prompts（按 action 分栏）
// ============================================================

const OVERVIEW_SYSTEM = `你是系统架构师（System Architect）。

业务方已确认以下工作流程图。你的任务：为每个流程节点标注技术属性，并生成时序图数据。

**输出 JSON 严格符合此结构**（值根据流程推断）：
{
  "nodeAnnotations": [
    {
      "nodeId": "与流程图中节点 id 一致",
      "executionType": "deterministic 或 intelligent",
      "riskLevel": "low 或 medium 或 high",
      "riskReason": "风险原因（一句话）",
      "estimatedLatency": "如 2s, 30s, 人工",
      "boundSkillSuggestion": "建议绑定的 Skill 名称"
    }
  ],
  "sequenceDiagram": {
    "participants": ["参与方名称"],
    "messages": [
      {
        "from": "参与方",
        "to": "参与方",
        "label": "调用描述",
        "type": "sync 或 async",
        "nodeId": "对应的节点 id"
      }
    ]
  }
}

**规则**：
- 参与方从各节点的 inputs、outputs 与 description 中推断出涉及的系统/角色；至少包含「用户」和「系统」两个参与方。
- 流程中每个节点至少对应 sequenceDiagram.messages 中的一条 message。
- riskLevel：涉及外部系统 → medium；涉及不可逆操作（删除、对外提交、付款等）→ high；纯内部处理 → low。

直接输出合法 JSON，不要用 markdown 代码块包裹，不要任何解释性文字。`;

const DOCUMENTS_SYSTEM = `你是数据架构师（Data Architect）。

业务方已确认以下工作流程图。你的任务：从流程节点中识别所有文档/数据实体，推断 Schema，建立文档注册表。

**输出 JSON 严格符合此结构**：
{
  "documents": [
    {
      "id": "doc-1 格式递增",
      "name": "文档名称",
      "fileType": "xlsx 或 pdf 或 json 或 database 或 email",
      "role": "working 或 reference 或 archive 或 external_input 或 external_output",
      "schema": {
        "description": "文档结构描述",
        "fields": [
          { "name": "字段名", "type": "string 或 number 或 date 等", "description": "说明" }
        ]
      },
      "usedByNodes": [
        { "nodeId": "node-1", "usage": "read 或 write 或 query 或 create" }
      ]
    }
  ],
  "relationships": [
    { "from": "doc-1", "to": "doc-2", "type": "inherits 或 references 或 derived_from" }
  ]
}

**规则**：
- 从 inputs/outputs 的 name 与 description 中识别所有文档实体；同一文档被多节点引用时合并为一条 documents 项，在 usedByNodes 中列全。
- fileType 从名称推断：含 Excel/表格 → xlsx；含 PDF/证书 → pdf；等。
- role 从使用方式：只读偏 reference；被创建或反复修改偏 working；外部输入/输出用 external_input / external_output。

直接输出合法 JSON，不要用 markdown 代码块包裹，不要任何解释性文字。`;

const EXTERNALS_SYSTEM = `你是集成架构师（Integration Architect）。

业务方已确认以下工作流程图。你的任务：识别流程中的外部系统依赖，并评估对接方案。

**输出 JSON 严格符合此结构**：
{
  "externalSystems": [
    {
      "id": "ext-1 格式递增",
      "name": "系统名称",
      "type": "web_portal 或 api 或 email 或 database 或 file_system",
      "relatedNodes": ["node-1"],
      "integration": {
        "current": "manual 或 api 或 email 或 file_transfer",
        "target": "manual 或 api 或 email 或 file_transfer",
        "readiness": "ready 或 partial 或 not_available"
      },
      "auth": { "type": "none 或 bearer_token 或 username_password 或 smtp_credentials 或 unknown" },
      "constraints": [
        { "type": "availability 或 rate_limit 或 file_size 或 response_time", "detail": "具体说明" }
      ],
      "automationPriority": "high 或 medium 或 low",
      "estimatedEffort": "如 2天、1周"
    }
  ]
}

**规则**：
- 从 human_manual 节点及涉及外部交互的描述中识别；邮件、网页操作、第三方数据库均视为外部系统。
- integration.current 结合 executionMode 推断：human_manual 通常对应 manual。
- automationPriority 结合频率、手工工作量、业务关键度综合判断。

直接输出合法 JSON，不要用 markdown 代码块包裹，不要任何解释性文字。`;

const GUARDS_SYSTEM = `你是质量工程师（Quality Engineer）。

业务方已确认以下工作流程图。你的任务：为每个需要守护的节点设计质量守护策略。

**输出 JSON 严格符合此结构**：
{
  "guards": [
    {
      "nodeId": "node-1",
      "monitors": [
        {
          "type": "structural 或 statistical 或 sampling",
          "description": "监测描述",
          "checks": [
            { "field": "字段名", "rule": "not_empty 或 type_check 或 range 或 format", "severity": "error 或 warning" }
          ],
          "threshold": 0.1
        }
      ],
      "issueCategories": ["format_drift", "api_change", "data_anomaly", "rule_drift"],
      "escalation": {
        "business": ["业务员应看到的问题类型"],
        "tech": ["技术员应看到的问题类型"]
      }
    }
  ]
}

**规则**：
- ai_auto 节点：尽量覆盖 structural + statistical + sampling（在合理范围内）。
- human_confirm 节点：以 structural 为主，保证 AI 产出结构可被校验。
- human_manual 节点：不生成守护条目（不要在 guards 数组中包含这些 nodeId，或整流程若全是人工可给空数组）。
- escalation.business 写业务能理解的「哪条数据/哪个结果有问题」；escalation.tech 写根因/接口/规则层面说明。

直接输出合法 JSON，不要用 markdown 代码块包裹，不要任何解释性文字。`;

const DEPLOYMENT_SYSTEM = `你是 DevOps 工程师（DevOps Engineer）。

业务方已确认以下工作流程图。你的任务：为整个 Workflow 生成部署与运行时方案。

**输出 JSON 严格符合此结构**：
{
  "services": [
    {
      "nodeId": "node-1",
      "serviceName": "服务名称",
      "runtime": "python 或 node 或 browser_automation",
      "dependencies": ["dep-1"],
      "resourceRequirements": { "cpu": "low 或 medium 或 high", "memory": "low 或 medium 或 high" }
    }
  ],
  "messaging": [
    { "from": "node-1", "to": "node-2", "type": "sync 或 async 或 human_gate", "format": "json 或 file" }
  ],
  "envVars": [
    { "name": "ENV_VAR_NAME", "description": "说明", "secret": true, "relatedNode": "node-1" }
  ],
  "resourceLimits": [
    { "resource": "资源名称", "limit": "限制值", "strategy": "token_bucket 或 reserve_commit 或 queue" }
  ]
}

**规则**：
- 每个 ai_auto 节点尽量对应一个 services 条目（可合并强相关的确定性步骤时注明）。
- human_confirm / human_manual 与下游之间的边在 messaging 中用 type: human_gate。
- 涉及外部 API、邮件、系统的节点在 envVars 中给出占位环境变量名与说明（secret 视情况）。
- resourceLimits 根据并发、批大小、外部 API 调用量评估。

直接输出合法 JSON，不要用 markdown 代码块包裹，不要任何解释性文字。`;

const ACTION_SYSTEMS: Record<string, string> = {
  overview: OVERVIEW_SYSTEM,
  documents: DOCUMENTS_SYSTEM,
  externals: EXTERNALS_SYSTEM,
  guards: GUARDS_SYSTEM,
  deployment: DEPLOYMENT_SYSTEM,
};

const VALID_ACTIONS = new Set(Object.keys(ACTION_SYSTEMS));

function buildUserContent(flow: unknown, extraPrompt?: string) {
  const base = `以下为业务方已确认的完整流程图 JSON（含 nodes 与 edges）：\n\n${JSON.stringify(flow, null, 2)}`;
  if (extraPrompt?.trim()) {
    return `${base}\n\n**额外说明与约束（可选）：**\n${extraPrompt.trim()}`;
  }
  return base;
}

function validateActionResult(action: string, data: unknown): string | null {
  if (data === null || typeof data !== "object") {
    return "LLM 返回不是 JSON 对象";
  }
  const o = data as Record<string, unknown>;

  switch (action) {
    case "overview": {
      if (!Array.isArray(o.nodeAnnotations)) return "缺少 nodeAnnotations 数组或格式错误";
      if (!o.sequenceDiagram || typeof o.sequenceDiagram !== "object") return "缺少 sequenceDiagram 或格式错误";
      const sd = o.sequenceDiagram as Record<string, unknown>;
      if (!Array.isArray(sd.participants) || !Array.isArray(sd.messages)) {
        return "sequenceDiagram.participants 或 messages 格式错误";
      }
      return null;
    }
    case "documents": {
      if (!Array.isArray(o.documents)) return "缺少 documents 数组或格式错误";
      if (!Array.isArray(o.relationships)) return "缺少 relationships 数组或格式错误";
      return null;
    }
    case "externals": {
      if (!Array.isArray(o.externalSystems)) return "缺少 externalSystems 数组或格式错误";
      return null;
    }
    case "guards": {
      if (!Array.isArray(o.guards)) return "缺少 guards 数组或格式错误";
      return null;
    }
    case "deployment": {
      if (!Array.isArray(o.services)) return "缺少 services 数组或格式错误";
      if (!Array.isArray(o.messaging)) return "缺少 messaging 数组或格式错误";
      if (!Array.isArray(o.envVars)) return "缺少 envVars 数组或格式错误";
      if (!Array.isArray(o.resourceLimits)) return "缺少 resourceLimits 数组或格式错误";
      return null;
    }
    default:
      return "未知 action";
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; flow?: unknown; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体格式错误" }, { status: 400 });
  }

  const { action, flow, prompt } = body;

  if (!action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { success: false, error: "无效或缺少 action，应为 overview | documents | externals | guards | deployment" },
      { status: 400 }
    );
  }

  if (flow == null || typeof flow !== "object" || Array.isArray(flow)) {
    return NextResponse.json({ success: false, error: "flow 必须为非数组对象（含 nodes、edges）" }, { status: 400 });
  }
  const f = flow as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(f.nodes)) {
    return NextResponse.json({ success: false, error: "flow.nodes 必须为数组" }, { status: 400 });
  }
  if (!Array.isArray(f.edges)) {
    return NextResponse.json({ success: false, error: "flow.edges 必须为数组" }, { status: 400 });
  }

  if (!process.env.CURSOR_API_KEY && (!process.env.LLM_API_KEY || !process.env.LLM_BASE_URL)) {
    return NextResponse.json({ success: false, error: "LLM 配置缺失（需要 CURSOR_API_KEY 或 LLM_API_KEY + LLM_BASE_URL）" }, { status: 500 });
  }

  const systemPrompt = ACTION_SYSTEMS[action]!;

  let parsed: unknown;
  try {
    parsed = await callLLM(systemPrompt, buildUserContent(flow, prompt), {
      temperature: 0.3,
      maxTokens: 8192,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }

  const validationError = validateActionResult(action, parsed);
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: parsed });
}
