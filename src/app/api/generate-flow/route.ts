import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

export const maxDuration = 60;

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
- 节点 id 从 node-1 开始递增

**关于人机分工（executionMode）— 这是核心要求**：
每个节点必须认真评估 executionMode，不能全部设为 ai_auto。遵循以下规则：
- 数据采集、格式转换、定时执行、文件归档等确定性操作 → "ai_auto"
- 数据采集/处理完成后的校验节点 → "human_confirm"（防止AI产出错误数据）
- 策略制定、方案决策等需要业务判断的节点 → "human_confirm"
- 内容创作完成后的审核节点 → "human_confirm"（需要审美和品牌调性把控）
- 涉及发布、删除、付款、对外提交等不可逆操作 → "human_confirm"
- 纯人工操作（如实物签字、现场检查） → "human_manual"
一个典型的 6 节点流程中，应有 2-3 个节点设为 human_confirm 或 human_manual。如果你生成的方案中所有节点都是 ai_auto，说明你没有认真执行这条规则

规则：
- 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字
- 确保 JSON 格式严格正确：所有字符串用双引号，数组和对象末尾不要有多余逗号
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
7. 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字

输出格式：
${FLOW_JSON_SCHEMA}`;

// ============================================================
// Prompt: Refine（自由对话修改）
// ============================================================

// ============================================================
// Prompt: Classify（判断任务类型）
// ============================================================

const CLASSIFY_SYSTEM = `你是一个企业级 AI 产品架构师。你需要判断用户描述的业务场景属于哪种任务类型。

**三种任务类型的定义**：

1. **workflow（工作流）**：
   - 类似思维链（COT），追求每步准确
   - 有明确的、固定的步骤顺序，每一步的输入输出是确定的
   - 流程可以画成流程图
   - 重点是"准确执行每一步"
   - 典型场景：财务报销、合同审批、进出口报关、IT 工单处理、售后退货

2. **agentic（智能体）**：
   - 类似 ReAct，追求目标达成
   - 有业务目标但执行路径不固定，需要 AI 自主规划和决策
   - 涉及策略制定、内容生成、数据分析等创造性工作
   - 重点是"达成目标"
   - 典型场景：账号运营涨粉、竞品分析、营销活动策划、智能客服

3. **hybrid（混合型）**：
   - 部分步骤是确定性的（workflow），部分步骤需要 AI 自主规划（agentic）
   - 整体有流程框架，但某些环节需要 AI 灵活发挥
   - 典型场景：内容营销（固定发布流程 + AI 生成内容）、招聘流程（固定筛选步骤 + AI 评估匹配度）、数据报告（固定采集清洗 + AI 分析洞察）

**判断标准**：
- 如果用户描述的全是"流程"（有步骤、有顺序、有规则，每步确定性高）→ workflow
- 如果用户描述的全是"目标"（要达成什么、需要什么能力，路径不固定）→ agentic
- 如果既有固定流程部分，又有需要 AI 自主发挥的部分 → hybrid
- 如果不确定，倾向于 hybrid（大部分真实业务场景都是混合的）

请输出 JSON：
{
  "taskType": "workflow 或 agentic 或 hybrid",
  "reason": "一句话解释为什么是这个类型",
  "confidence": 0.0-1.0
}

规则：直接输出合法 JSON，不要用 markdown 代码块包裹。`;

// ============================================================
// Prompt: Draft Agentic（生成 Agentic 任务配置草稿）
// ============================================================

const AGENTIC_JSON_SCHEMA = `{
  "projectName": "项目名称（简短）",
  "config": {
    "goal": "用一句话描述业务目标（如：3个月内小红书账号涨粉5万）",
    "background": "业务背景描述（2-3句话，说明当前状况和为什么要做这件事）",
    "constraints": [
      {
        "id": "c-1",
        "type": "budget 或 time 或 quality 或 compliance 或 custom",
        "description": "约束条件描述",
        "value": "具体数值或标准（如：每月预算不超过5000元）"
      }
    ],
    "skills": [
      {
        "id": "sk-1",
        "name": "技能名称（2-4个字）",
        "description": "这个技能做什么（一句话）",
        "inputs": [{ "name": "输入名", "type": "数据类型" }],
        "outputs": [{ "name": "输出名", "type": "数据类型" }],
        "evaluator": "评估这个技能输出质量的标准（一句话）"
      }
    ],
    "evaluators": [
      {
        "id": "ev-1",
        "name": "评估器名称",
        "description": "评估什么（一句话）",
        "metrics": [
          { "name": "指标名", "threshold": "达标阈值", "weight": 0.0-1.0 }
        ]
      }
    ],
    "executionStrategy": "sequential 或 parallel 或 adaptive",
    "maxIterations": 5,
    "humanCheckpoints": ["需要人工确认的关键节点描述"]
  },
  "confirmItems": [
    {
      "id": "confirm-1",
      "section": "goal 或 skills 或 constraints 或 evaluators",
      "question": "用通俗语言提问",
      "context": "为什么要确认这个",
      "options": ["选项A", "选项B"]
    }
  ]
}`;

const DRAFT_AGENTIC_SYSTEM = `你是一个资深的 AI 产品架构师，擅长将业务目标转化为可执行的 Agent 任务配置。

用户会用自然语言描述一个业务目标。你的任务是：
1. 分析业务目标，生成完整的 Agent 任务配置
2. 对不确定的部分提出确认问题

**关于技能（skills）**：
- 每个技能是一个原子能力，有明确的输入和输出
- 技能数量 3-6 个
- 技能名称要具体（"竞品数据采集" 而非 "数据采集"）
- 每个技能要有评估标准

**关于约束条件（constraints）**：
- 至少包含时间和质量两个维度
- 如果用户提到了预算、合规等要求，也要加上

**关于评估器（evaluators）**：
- 至少 1 个整体评估器
- 每个评估器有 2-3 个具体指标
- 指标要可量化（如"互动率 > 5%"）

**关于人工确认节点（humanCheckpoints）— 这是核心要求**：
- 不允许生成全自动方案，必须包含至少 2 个 humanCheckpoints
- 数据采集/处理完成后：确认数据准确性（防止AI捏造数据）
- 策略/方案生成后：确认策略方向是否正确
- 内容创作完成后：审核内容质量和品牌调性
- 对外发布/不可逆操作前：最终确认
- 长周期任务的阶段节点：防止执行方向偏移
- humanCheckpoints 的描述要具体，如"内容生成完成后，人工审核文案质量和配图效果"

**关于确认项（confirmItems）**：
- 3-5 个确认问题
- 聚焦于目标是否准确、技能是否合适、约束是否合理
- 每个问题提供 2-3 个选项

请严格按以下 JSON 格式输出：
${AGENTIC_JSON_SCHEMA}

规则：
- 直接输出合法 JSON，不要用 markdown 代码块包裹
- 确保 JSON 格式严格正确`;

// ============================================================
// Prompt: Refine Agentic（根据反馈修改 Agentic 配置）
// ============================================================

const REFINE_AGENTIC_SYSTEM = `你是一个 AI 产品架构师。你会收到：
1. 当前的 Agent 任务配置 JSON
2. 用户的修改意见
3. 用户的原始需求（供参考）

请根据用户意见修改配置，输出修改后的完整 JSON。

修改规则：
1. 只改用户提到的部分
2. 新增的 skill/constraint/evaluator，id 接着当前最大 id 递增
3. 保持 JSON 格式一致
4. 直接输出合法 JSON，不要用 markdown 代码块包裹

输出格式（只需要 config 部分，不需要 confirmItems）：
{
  "projectName": "项目名称",
  "config": { ... }
}`;

// ============================================================
// Prompt: Refine（自由对话修改 Workflow）
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
6. 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字

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
      ...(options?.expectJson !== false && {
        response_format: { type: "json_object" },
      }),
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
  const fenceMatch = jsonStr.match(/`{3,}(?:json)?\s*([\s\S]*?)`{3,}/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    const braceStart = jsonStr.indexOf("{");
    const braceEnd = jsonStr.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    const repaired = jsonrepair(jsonStr);
    return JSON.parse(repaired);
  }
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
    const { prompt, action = "draft", currentFlow, currentConfig, feedback, nodeId, nodeLabel, answers } = body;

    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL;
    if (!apiKey || !baseUrl) {
      return NextResponse.json({ error: "LLM 配置缺失" }, { status: 500 });
    }

    // --- Action: classify ---
    if (action === "classify") {
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "请输入业务描述" }, { status: 400 });
      }
      const result = await callLLM(CLASSIFY_SYSTEM, prompt, { temperature: 0.1 });
      if (!result?.taskType) {
        return NextResponse.json({ error: "AI 分类结果格式异常" }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        taskType: result.taskType,
        reason: result.reason || "",
        confidence: result.confidence || 0.5,
      });
    }

    // --- Action: draft_agentic ---
    if (action === "draft_agentic") {
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "请输入业务描述" }, { status: 400 });
      }
      const result = await callLLM(DRAFT_AGENTIC_SYSTEM, prompt);
      if (!result?.config) {
        return NextResponse.json({ error: "AI 返回的任务配置格式异常，请重试" }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        data: result.config,
        projectName: result.projectName || "",
        confirmItems: result.confirmItems || [],
      });
    }

    // --- Action: refine_agentic ---
    if (action === "refine_agentic") {
      if (!currentConfig || !feedback) {
        return NextResponse.json({ error: "缺少当前配置或反馈" }, { status: 400 });
      }
      const refineInput = `原始需求：${prompt || "未提供"}\n\n当前 Agent 任务配置：\n${JSON.stringify(currentConfig, null, 2)}\n\n用户反馈：${feedback}`;
      const refined = await callLLM(REFINE_AGENTIC_SYSTEM, refineInput);
      if (!refined?.config) {
        return NextResponse.json({ error: "AI 修改结果格式异常，请重试" }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        data: refined.config,
        projectName: refined.projectName || "",
      });
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
