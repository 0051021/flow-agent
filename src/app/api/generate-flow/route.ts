import { NextRequest, NextResponse } from "next/server";

// ============================================================
// JSON Schema
// ============================================================

const FLOW_JSON_SCHEMA = `{
  "projectName": "项目名称（简短）",
  "nodes": [
    {
      "id": "node-1",
      "label": "节点名称（2-6个字）",
      "icon": "图标名（从以下选择：BarChart3, Target, PenTool, ShieldCheck, Clock, Activity, RefreshCw, Search, FileText, Mail, Database, Zap, Eye, Settings, Upload, Download, Users, Globe, Lock, Bell）",
      "description": "用一句话描述这个节点做什么（20-40字）",
      "executionMode": "ai_auto 或 human_confirm 或 human_manual",
      "estimatedTime": "预计耗时（如：约2分钟、约30秒、持续运行）",
      "inputs": [
        {
          "name": "输入名称（含格式，如：报关单草稿（Excel））",
          "icon": "一个emoji",
          "description": "简短说明",
          "required": true,
          "source": "user 或 previous_step 或 default",
          "sourceDetail": "如果source不是user，说明来源"
        }
      ],
      "outputs": [
        {
          "name": "输出名称（含格式）",
          "icon": "一个emoji",
          "description": "简短说明"
        }
      ],
      "isCondition": false,
      "conditionBranches": null,
      "executionType": "deterministic 或 intelligent"
    }
  ],
  "edges": [
    {
      "source": "node-1",
      "target": "node-2",
      "label": "连线标签",
      "style": "normal 或 success 或 error 或 loop"
    }
  ]
}`;

// ============================================================
// Prompt: Draft（草稿流程图 + 按节点分组的待确认项）
// ============================================================

const DRAFT_SYSTEM = `你是一个资深的业务流程分析师，擅长帮业务人员把模糊的想法变成清晰的流程图。

用户会用自然语言描述一个业务流程。你的任务是**同时**做两件事：
1. 基于用户描述，尽力生成一个草稿流程图
2. 对每个节点评估你的把握程度，对把握不大的节点提出确认问题

**第一步：判断描述完整度**
先判断用户的描述有多详细：
- 如果用户已经说清了具体步骤、涉及的系统、文件格式等，那大部分节点的 confidence 应该是 "high"
- 如果用户只说了大概意思，没说具体怎么做，那很多节点的 confidence 会是 "low"

**第二步：生成草稿 + 按节点标注问题**

请严格按以下 JSON 格式输出：
{
  "flow": ${FLOW_JSON_SCHEMA},
  "nodeConfidence": [
    {
      "nodeId": "node-1",
      "confidence": "high 或 medium 或 low",
      "reason": "为什么是这个 confidence（一句话）",
      "questions": [
        {
          "id": "node-1-q1",
          "question": "用通俗的语言提问",
          "context": "为什么要问这个（一句话）",
          "defaultSuggestion": "如果你没有特别要求，我建议...",
          "options": ["具体方案A", "具体方案B"]
        }
      ]
    }
  ]
}

**关于 confidence 评估**：
- "high"：用户描述中已经明确说了这一步怎么做、用什么工具、什么格式。questions 留空数组 []
- "medium"：用户提到了这一步，但缺少具体细节（比如说了"提交审批"但没说用什么系统）。questions 放 1 个问题
- "low"：这一步完全是你根据常识推测的，用户没有提到。questions 放 1-2 个问题

**关于节点的问题（questions）**：
- 每个节点最多 2 个问题，聚焦这个节点本身的 HOW（怎么做）
- 问题要具体到这个节点：不要问全局问题（如"整个流程多久做一次"），要问节点级问题（如"这一步的数据是从哪个系统导出的？"）
- 每个问题必须提供 2-3 个可选方案（options），让用户直接点选
- 选项要用业务人员能理解的语言
- defaultSuggestion 是你认为最合理的推荐方案
- confidence 为 "high" 的节点不需要问题，questions 留空 []

**关于草稿流程图**：
- 即使信息不完整也要出图，用最常见的业务做法填充不确定的部分
- 节点数量 4-8 个
- label 要具体（"从ERP导出销售数据" 而非 "获取数据"）
- inputs/outputs 标明文件格式（"报关单（Excel）"）
- 支持并行分支和条件判断
- 涉及发布/删除等操作 executionMode 设为 "human_confirm"
- 涉及业务决策 executionMode 设为 "human_manual"
- 节点 id 从 node-1 开始递增

规则：
- 只输出 JSON，不要有任何解释文字
- confidence 为 "high" 的节点 questions 必须为空数组`;

// ============================================================
// Prompt: RefineNode（根据一个节点的所有确认结果微调）
// ============================================================

const REFINE_NODE_SYSTEM = `你是一个业务流程优化专家。你会收到：
1. 当前的流程图 JSON
2. 某个节点的 ID 和名称
3. 用户对这个节点的所有确认回答（可能有 1-2 个问题的回答）

请根据用户的回答，修改这个节点及其关联部分，输出修改后的完整流程图 JSON。

修改规则：
1. **主要修改目标节点**：更新它的 label、description、inputs、outputs、executionMode 等
2. 如果回答揭示了新的子步骤，可以将目标节点拆分为多个节点（新节点 id 接着最大 id 递增）
3. 如果回答揭示了条件分支，相应调整 edges
4. 如果回答影响了相邻节点的 inputs/outputs 衔接，也要同步修改
5. **不要动和这个回答无关的节点**
6. 修改后的 JSON 格式必须和原来一致
7. 只输出 JSON，不要有任何解释文字

输出格式：
${FLOW_JSON_SCHEMA}`;

// ============================================================
// Prompt: Refine（自由对话修改）
// ============================================================

const REFINE_SYSTEM = `你是一个业务流程优化专家。你会收到：
1. 当前的流程图（结构化 JSON，反映用户在画布上的最新修改）
2. 用户的修改意见
3. 用户的原始需求（供参考）

请根据用户意见修改流程图，输出修改后的完整 JSON。

修改规则：
1. **只改用户提到的部分**，不要动其他已经合理的节点
2. 如果需要新增节点，id 接着当前最大 id 递增
3. 如果需要删除节点，同时删除相关的 edges
4. 如果用户在画布上已经做了修改，尊重这些修改
5. 修改后的 JSON 格式必须和原来一致
6. 只输出 JSON，不要有任何解释文字

输出格式：
${FLOW_JSON_SCHEMA}`;

// ============================================================
// LLM 调用
// ============================================================

async function callLLM(
  systemPrompt: string,
  userContent: string,
  options?: { temperature?: number; expectJson?: boolean }
) {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL || "gpt-4o";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");

  if (options?.expectJson === false) return content;

  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  return JSON.parse(jsonStr);
}

// ============================================================
// API Route Handler
// ============================================================

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }
    const { prompt, action = "draft", currentFlow, feedback, nodeId, nodeLabel, answers } = body;

    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL;
    if (!apiKey || !baseUrl) {
      return NextResponse.json({ error: "LLM 配置缺失" }, { status: 500 });
    }

    // --- Action: draft ---
    if (action === "draft") {
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "请输入业务描述" }, { status: 400 });
      }
      const result = await callLLM(DRAFT_SYSTEM, prompt);
      if (!result?.flow?.nodes || !Array.isArray(result.flow.nodes)) {
        return NextResponse.json({ error: "AI 返回的流程图格式异常，请重试" }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        data: result.flow,
        nodeConfidence: result.nodeConfidence || [],
      });
    }

    // --- Action: refine_node ---
    if (action === "refine_node") {
      if (!currentFlow || !nodeId) {
        return NextResponse.json({ error: "缺少流程图或节点ID" }, { status: 400 });
      }
      if (!Array.isArray(answers)) {
        return NextResponse.json({ error: "回答格式错误" }, { status: 400 });
      }

      const answersText = answers
        .map((a: { question: string; answer: string }) => `问：${a.question || ""}\n答：${a.answer || ""}`)
        .join("\n\n");

      const refineInput = [
        `当前流程图：\n${JSON.stringify(currentFlow, null, 2)}`,
        `\n目标节点：${nodeId}（${nodeLabel || ""})`,
        `\n用户对这个节点的确认：\n${answersText}`,
        prompt ? `\n原始需求（供参考）：${prompt}` : "",
      ].join("\n");

      const refined = await callLLM(REFINE_NODE_SYSTEM, refineInput);
      if (!refined?.nodes || !Array.isArray(refined.nodes)) {
        return NextResponse.json({ error: "AI 优化结果格式异常，请重试" }, { status: 502 });
      }
      return NextResponse.json({ success: true, data: refined });
    }

    // --- Action: refine ---
    if (action === "refine") {
      if (!currentFlow || !feedback) {
        return NextResponse.json({ error: "缺少流程图或反馈" }, { status: 400 });
      }
      const refineInput = `原始需求：${prompt || "未提供"}\n\n当前流程图：\n${JSON.stringify(currentFlow, null, 2)}\n\n用户反馈：${feedback}`;
      const refined = await callLLM(REFINE_SYSTEM, refineInput);
      if (!refined?.nodes || !Array.isArray(refined.nodes)) {
        return NextResponse.json({ error: "AI 修改结果格式异常，请重试" }, { status: 502 });
      }
      return NextResponse.json({ success: true, data: refined });
    }

    return NextResponse.json({ error: "未知 action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("API error:", error);
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
