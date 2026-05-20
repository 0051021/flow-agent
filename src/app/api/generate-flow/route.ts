import { NextRequest, NextResponse } from "next/server";
import { callLLM, streamViaCursorSDK, type StreamEvent, type CallLLMOptions } from "@/lib/llm";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const maxDuration = 300;

// ============================================================
// JSON Schema — Business side (Step 1)
// ============================================================

const FLOW_BIZ_SCHEMA = `{
  "projectName": "项目名称（简短）",
  "nodes": [
    {
      "id": "node-1",
      "label": "节点名称（2-6个字）",
      "icon": "图标名（从以下选择：BarChart3, Target, PenTool, ShieldCheck, Clock, Activity, RefreshCw, Search, FileText, Mail, Database, Zap, Eye, Settings, Upload, Download, Users, Globe, Lock, Bell）",
      "description": "用一句话描述这个节点做什么（20-40字）",
      "workUnitKind": "manual_operation 或 business_judgment 或 document_check 或 handoff_wait 或 rework_update",
      "executionMode": "pending 或 ai_auto 或 human_confirm 或 human_manual",
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
      "operationSteps": ["人工业务动作1", "人工业务动作2"],
      "judgmentSpec": {
        "decisionSubject": "如果是业务判断/文件检查节点，这里写原人工流程要判断什么",
        "informationUsed": ["业务人员会看的信息、材料或上下文"],
        "judgmentRules": ["原人工流程遵循的判断口径或规则"],
        "judgmentOutputs": ["判断完成后形成的业务结果"],
        "escalationConditions": ["原人工流程里升级、交接或找主管/专岗处理的条件"],
        "riskBoundaries": ["业务人员不能越过的边界"]
      },
      "doneCriteria": "这一步做到什么程度算完成",
      "isCondition": false,
      "conditionBranches": null
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
// JSON Schema — Full (backward compat for refine/serialize)
// ============================================================

const FLOW_JSON_SCHEMA = `{
  "projectName": "项目名称（简短）",
  "nodes": [
    {
      "id": "node-1",
      "label": "节点名称（2-6个字）",
      "icon": "图标名（从以下选择：BarChart3, Target, PenTool, ShieldCheck, Clock, Activity, RefreshCw, Search, FileText, Mail, Database, Zap, Eye, Settings, Upload, Download, Users, Globe, Lock, Bell）",
      "description": "用一句话描述这个节点做什么（20-40字）",
      "executionMode": "pending 或 ai_auto 或 human_confirm 或 human_manual",
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
      "executionRules": [
        {
          "rule": "规则名称（2-6字）",
          "detail": "具体说明这个规则的内容和处理方式（15-40字）",
          "source": "ai_inferred 或 user_confirmed"
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
// JSON Schema — Tech side (Step 2)
// ============================================================

const FLOW_TECH_SCHEMA = `{
  "nodes": [
    {
      "id": "node-1",
      "executionType": "deterministic 或 intelligent",
      "executionRules": [
        {
          "rule": "规则名称（2-6字）",
          "detail": "具体说明这个规则的内容和处理方式（15-40字）",
          "source": "ai_inferred"
        }
      ],
      "errorHandling": [
        {
          "strategy": "retry 或 human_fallback 或 skip 或 abort",
          "enabled": true,
          "config": {}
        }
      ],
      "techConfig": {
        "executionType": "deterministic 或 intelligent",
        "boundSkill": "绑定的 Skill 名称（可选）",
        "evaluator": "评估器名称（可选）",
        "timeout": 300
      },
      "inputDataTypes": { "输入名称": "string 或 json 或 file 或 number 等" },
      "outputDataTypes": { "输出名称": "string 或 json 或 file 或 number 等" }
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

questions 反面例子（禁止）→ 正面例子（应该）：
- "这个步骤有什么特殊要求吗？" → "校验规则是只看签发日期，还是也要核对Part号？"
- "数据来源是什么？" → "BOM清单是从SAP导出还是Leader邮件里附带？"
- "需要什么格式？" → "最终提交给海关的是Excel还是PDF？"
原则：问题必须包含用户描述中的业务实体名称，不能只有泛化词汇

**关于草稿流程图**：
- 即使信息不完整也要出图，用最常见的业务做法填充不确定的部分
- 节点数量 4-8 个
- label 要具体（"从ERP导出销售数据" 而非 "获取数据"）
- inputs/outputs 标明文件格式（"报关单（Excel）"）
- 支持并行分支和条件判断
- 节点 id 从 node-1 开始递增

**质量红线（以下特征 = 低质量输出，必须避免）**：

label 反面例子（禁止）→ 正面例子（应该）：
- "数据处理" → "从SAP导出BOM清单"
- "信息整理" → "按Part号匹配GSDS文件"
- "结果审核" → "比对证书与申请大表一致性"
- "系统提交" → "上传IM申请大表至中外运系统"

description 禁止出现的套话：
- "进行全面的XX" / "确保XX的准确性" / "根据XX进行综合XX"
- "对相关数据进行处理" / "完成必要的XX操作"
- 正确写法：只写具体动作 + 操作对象 + 产出物，不加修饰词

inputs/outputs 必须具体：
- 禁止："处理结果（文本）"、"输出数据"、"相关信息"
- 必须带格式："IM申请大表（Excel）"、"GSDS文件（PDF）"、"校验报告（文本）"
- 如果不确定格式，写"（待确认）"比瞎猜强

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

质量要求：
- label 必须具体（"比对证书编号与申请大表" 而非 "数据校验"）
- description 禁止套话（禁止 "进行全面的XX"、"确保XX准确性"，只写动作+对象+产出）
- executionRules 禁止套话（禁止 "确保数据完整性"、"遵循行业规范"，必须写可执行的规则如 "A列有值的行才标绿"、"超过3个工作日未回复自动催办"）
- inputs/outputs 必须带格式（"申请大表（Excel）" 而非 "处理结果（文本）"）

输出格式：
${FLOW_JSON_SCHEMA}`;

// ============================================================
// Prompt: Refine（自由对话修改）
// ============================================================

// ============================================================
// Prompt: Readiness Check（业务方案准入判断）
// ============================================================

const READINESS_CHECK_SYSTEM = `你是业务方案准入判断器。你的任务不是生成流程图，也不是判断 workflow / agentic，而是判断当前 Job 信息是否足够先生成一版业务方案草稿。

业务方案可以是固定流程、策略判断、持续运营、复盘沉淀或混合型工作。业务方不需要感知这些分类，统一按“业务方案/业务流程图”处理。

**你只做三件事**：
1. 判断用户是不是在描述一件业务工作或希望整理业务材料。
2. 判断当前信息是否足够先生成第一版草稿。
3. 如果不够，最多问 5 个准入问题；默认 1-3 个，只有缺口很多才问到 4-5 个。

**低门槛准入原则**：
- 只有“业务目标 + 材料名称”不够生成流程草稿。必须至少满足下面任一条件：
  1) 用户自然语言里描述了 2 个以上连续业务动作或关键处理关系，例如“收到邮件 → 查找 GSDS → 填写大表 → 上传系统”。
  2) 用户真实上传了流程方案/SOP/流程图文件，且材料摘要里能看到流程线索。
  3) 用户明确给出了起点和最终结果，并描述了中间至少一个处理动作。
- 不要因为缺少角色、系统、规则、异常处理、完整步骤就阻止生成。
- 如果用户只是说“我要申请 IMI 证书，手上有邮件、GSDS 文件和 Excel 表，想整理一下”，这只有主题和材料，没有流程动作，必须 canDraft=false。
- 如果用户只是口头提到“我手上有某些文件”，但没有真实上传文件，不要当作材料已可用。
- 如果用户只说“帮我看看这个”，或只列材料名/文件名，且看不出处理链路，必须 canDraft=false。
- 例外：如果用户明确说“先按你的理解生成草稿”或“先生成草稿”，说明用户接受不完整草稿，可以 canDraft=true。

**准入问题优先级**：
1. 业务目标：希望整理哪件业务工作？
2. 处理对象：这件事主要处理什么材料、请求、客户、订单、表单或内容？
3. 起点：通常从什么事件开始？
4. 最终结果：最后要产出什么？
5. 关键判断或规则：中间有没有必须遵守的判断条件？

请输出 JSON：
{
  "isBusinessPlanRequest": true,
  "canDraft": true,
  "confidence": "high 或 medium 或 low",
  "known": {
    "businessGoal": "已知业务目标；未知则为 null",
    "object": "已知处理对象；未知则为 null",
    "start": "已知起点；未知则为 null",
    "end": "已知最终结果；未知则为 null",
    "keyRules": ["已知关键规则"]
  },
  "missing": ["仍缺的信息"],
  "nextAction": "generate_business_plan 或 ask_readiness_questions",
  "questions": [
    {
      "id": "q1",
      "question": "给业务方看的自然语言问题",
      "examples": ["示例A", "示例B", "示例C"]
    }
  ],
  "reason": "一句话说明判断原因"
}

规则：
- questions 最多 5 个。
- canDraft=true 时 questions 必须为空数组。
- canDraft=false 时 nextAction 必须为 ask_readiness_questions。
- 直接输出合法 JSON，不要用 markdown 代码块包裹。`;

// ============================================================
// Prompt: Draft Agentic（生成 Agentic 任务配置草稿）
// ============================================================

const AGENTIC_JSON_SCHEMA = `{
  "projectName": "项目名称（简短）",
  "config": {
    "goal": "用一句话描述业务目标",
    "background": "业务背景（2-3句话）",
    "totalDays": 90,
    "globalSuccessCriteria": "全局成功标准（一句话）",
    "approvalPoints": ["需要审批的决策点摘要"],
    "fallbacks": [
      { "trigger": "跨模块异常触发条件（如：客户连续不满意、系统不可用、金额超出普通处理上限）", "action": "业务处理动作（如：进入异常工单、只说明状态、不承诺具体结果）", "severity": "critical 或 warning 或 info" }
    ],
    "phases": [
      {
        "id": "phase-1",
        "name": "阶段名称（动作+目标，专业简洁，如：账号冷启动与基线建立、内容策略验证与优化）",
        "dayRange": [1, 7],
        "status": "pending",
        "responsibility": "模块职责：说明这个模块在持续业务里负责哪类判断、生成或运营事项",
        "actions": ["业务动作1", "业务动作2"],
        "focusSignals": ["关注信号：运行中需要关注的业务变化、反馈、机会、风险或策略失效迹象"],
        "successCriteria": {
          "good": "表现好的标准（如：播放>1000）",
          "warning": "需关注的标准（如：播放500-1000）",
          "bad": "表现差的标准及对策（如：播放<500，换模板）"
        },
        "exitCondition": "进入下一阶段的条件（如：发满3条，选出最佳模板）",
        "requiresApproval": false,
        "approvalDescription": "如需审批，说明审批内容",
        "questions": [
          {
            "id": "phase-1-q1",
            "question": "用通俗语言提问（针对这个阶段的不确定点）",
            "context": "为什么要问这个",
            "options": ["选项A", "选项B"]
          }
        ],
        "requiredCapabilities": ["业务侧需要说明的资料、规则文件、表格、模板、素材库、时效口径或结果要求（如：选题库、素材库、账号清单、日报模板、输出脚本/标题/发布时间建议）"]
      }
    ],
    "constraints": [
      { "id": "c-1", "type": "budget 或 time 或 quality 或 compliance 或 custom", "description": "约束条件描述", "value": "具体数值" }
    ],
    "goalMetrics": {
      "core": "核心目标指标",
      "coreReasoning": "为什么设定这个目标（推理依据）",
      "process": ["过程指标"],
      "baseline": ["底线指标"],
      "benchmarks": ["行业基准"]
    },
    "executionRules": [
      { "category": "规则类别", "rules": ["具体规则"], "source": "ai_inferred" }
    ],
    "permissions": {
      "autonomous": [{ "action": "可自主决定的事项", "reason": "原因" }],
      "needApproval": [{ "trigger": "触发条件", "description": "审批事项", "risk": "high 或 medium 或 low", "consequence": "后果" }],
      "safeguards": ["兜底机制"]
    },
    "reporting": {
      "daily": { "enabled": true, "auto": true, "sampleContent": "示例日报" },
      "weekly": { "enabled": true, "content": "周报内容", "sampleContent": "示例周报" },
      "alerts": { "triggers": [{ "condition": "告警条件", "severity": "critical 或 warning 或 info" }] },
      "milestones": ["里程碑"],
      "channel": "飞书"
    },
    "executionOverview": "用2-3句通俗的话描述Agent的整体工作方式",
    "estimatedDuration": "预计周期",
    "estimatedEfficiency": "预计效率提升",
    "contentPreview": {
      "samples": [
        { "title": "示例标题", "summary": "示例摘要", "type": "类型", "tags": ["标签"], "expectedMetrics": "预期效果" }
      ],
      "generationLogic": "内容生成逻辑"
    },
    "skills": [],
    "evaluators": [],
    "executionStrategy": "adaptive",
    "maxIterations": 5,
    "humanCheckpoints": ["人工确认节点"]
  }
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
// Prompt: Generate Tech Config（根据已确认的业务配置生成技术侧）
// ============================================================

const GENERATE_TECH_SYSTEM = `你是一个 AI 系统架构师。你会收到一个已经由业务方确认的 Agent 任务配置（包含目标、执行规则、权限、汇报机制等业务侧内容）。

你的任务是：根据业务侧配置，生成对应的技术实现方案。

**必须生成以下字段**：

1. **skills**（3-6个）：每个技能包含 id(sk-1格式)、name、description、inputs、outputs、evaluator
2. **evaluators**（1-2个）：目标级评估器，包含 id(ev-1格式)、name、description、metrics
3. **executionStrategy**：sequential / parallel / adaptive
4. **maxIterations**：最大迭代轮数
5. **humanCheckpoints**：人工检查点列表
6. **decisionLoop**：Agent 决策循环
   - observe：观察什么数据/信号（2-4条）
   - evaluate：怎么判断/决策（2-3条）
   - act：采取什么行动（2-4条）
   - feedback：结果怎么回流（2-3条）
7. **skillOrchestration**：Skill 编排
   - dependencies：Skill 间数据流向（用 skill id 引用）
   - parallelGroups：可并行的 Skill 分组
   - failurePolicy：每个 Skill 的失败策略（retry/skip/abort/fallback）
8. **contextArchitecture**：上下文架构
   - shortTerm：运行时短期记忆（2-3条）
   - longTerm：持久化长期记忆（2-3条）
   - external：外部上下文依赖（1-2条）
9. **schedule**：触发与调度
   - triggers：触发机制列表，每个含 type(cron/event/threshold)、description、config
   - cooldown：冷却间隔

直接输出合法 JSON，格式：
{
  "skills": [...],
  "evaluators": [...],
  "executionStrategy": "...",
  "maxIterations": 5,
  "humanCheckpoints": [...],
  "decisionLoop": { "observe": [...], "evaluate": [...], "act": [...], "feedback": [...] },
  "skillOrchestration": { "dependencies": [...], "parallelGroups": [...], "failurePolicy": [...] },
  "contextArchitecture": { "shortTerm": [...], "longTerm": [...], "external": [...] },
  "schedule": { "triggers": [...], "cooldown": "..." }
}`;

// ============================================================
// Prompt: Generate Workflow Tech（根据已确认的业务流程生成技术配置）
// ============================================================

const GENERATE_WORKFLOW_TECH_SYSTEM = `你是一个 AI 系统架构师。你会收到一个已经由业务方确认的工作流流程图（包含节点名称、描述、执行模式、输入输出等业务侧内容）。

你的任务是：为每个节点生成技术实现配置。

**对每个节点，必须生成**：

1. **executionType**："deterministic"（确定性逻辑，如规则匹配、数据转换）或 "intelligent"（需要 AI 推理，如内容生成、智能分类）
2. **executionRules**（0-3条）：该节点的执行规则
   - rule：规则名称（2-6字）
   - detail：具体说明（15-40字）
   - source："ai_inferred"
3. **errorHandling**：异常处理策略列表
   - strategy："retry" / "human_fallback" / "skip" / "abort"
   - enabled：true/false
   - config：策略配置（如 maxRetries, retryInterval, notifyRole 等）
4. **techConfig**：
   - executionType：同上
   - boundSkill：建议绑定的 Skill 名称（如"发票OCR识别"、"邮件发送"，可为空）
   - evaluator：建议的评估器（如"准确率检查"，可为空）
   - timeout：超时秒数
5. **inputDataTypes**：每个输入的数据类型映射，key 是输入名称，value 是类型（string/json/file/number/boolean/enum）
6. **outputDataTypes**：每个输出的数据类型映射

**判断 executionType 的依据**：
- 规则匹配、数据校验、格式转换、数据库查询 → deterministic
- 内容生成、智能分类、语义理解、决策推理 → intelligent
- 不确定 → intelligent

直接输出合法 JSON，格式：
${FLOW_TECH_SCHEMA}`;

// ============================================================
// Prompt: Unified Draft（分类 + 生成一次完成）
// ============================================================

// ============================================================
// Prompt: Workflow Draft（专属 workflow 生成）
// ============================================================

const WORKFLOW_DRAFT_SYSTEM = `你是业务翻译平台的业务流程生成 Agent。用户会描述一个原本由业务人员人工完成的业务过程，可能附带文件（PPT/PPTX、Excel、PDF、Word、图片等）。

**你的任务**：把用户描述和当前 Job 文件整理成一份“业务流程澄清稿”的流程图 JSON。

这份产物只用于帮助业务方把原人工业务流程讲清楚，不是最终技术方案，不是可执行 JobSpec，也不是自动化蓝图。

**核心原则**：
- 先还原原人工业务，不预设 AI 或系统后续怎么做。
- 先澄清业务事实，不判断技术可行性，不判断哪些节点应该自动化。
- 有流程方案文件时：流程方案是强流程证据。文件里有几个明确业务步骤，就优先按这些步骤生成节点。
- 没有流程方案文件时：根据用户描述生成合理的业务流程澄清稿（通常 4-8 个节点）。
- 专有名词原样保留（系统名、文件名、公司名、表格名等）
- inputs/outputs 尽量标明格式（如"IMI申请大表（Excel）"）

**Job 文件池读取规则**：
- 用户上传的文件属于当前 Job 文件池，不只是 prompt 附件摘要。
- 如果材料是 PPT/PPTX、Word、图片、流程图 PDF 等复杂文件，你必须把它当作原始业务材料读取，提取页面标题、正文、表格、箭头/图形关系、备注和流程线索。
- 如果原文是英文，最终流程节点、说明、输入输出、判断规则和追问都要用中文表达。
- quick brief 只是索引和路标，不能替代原文件内容；复杂文件必须基于原文件读取结果生成流程。
- 如果文件里是流程图，优先还原流程图中的节点、顺序、分支、角色和产物，不要只按用户一句话猜。

**工作单元性质 workUnitKind**：
- 不要按整个 Job 判断 workflow/agentic；必须逐个节点判断 workUnitKind。一个固定流程里也可能包含业务判断节点，一个目标导向工作里也可能包含固定操作节点。
- 业务侧不暴露 workflow / agentic 术语；业务侧只看到“固定操作、业务判断、文件检查、人工确认、交接等待、返修回填”等业务语义。
- manual_operation：人工操作型节点。业务人员实际做某个动作，例如查找文件、填写表格、上传资料、发送邮件。
- business_judgment：业务判断型节点。业务人员根据材料、规则或经验作判断，例如判断问题类型、判断是否升级。
- document_check：文件检查型节点。业务人员对照文件/表格/证书检查字段或一致性。
- handoff_wait：交接等待型节点。业务人员把材料交给他人/外部机构/系统后等待结果。
- rework_update：返修回填型节点。业务人员发现错误后返修，或收到结果后回填、归档。

**节点字段规则**：
- 所有节点 executionMode 统一填 "pending"。执行方式由后续技术评审阶段判断。
- manual_operation / rework_update 节点必须填写 operationSteps。
- business_judgment / document_check 节点必须填写 judgmentSpec，表达“原本业务人员怎么判断/检查”，不要写成 AI 推荐。
- 判断型节点中：
  - decisionSubject 写“这一步要决定什么”，例如“判断桶/袋泄漏最可能的根因类别”。
  - informationUsed 写“用于判断的关键依据”，例如偏差记录、泄漏照片、批次、包装完整性、处理/仓储条件、历史相似案例；它不是规则本身。
  - judgmentRules 写“如何根据依据做判断”，例如“若同批次多点渗漏且封口异常，优先怀疑包装完整性；若搬运后集中发生，优先检查 handling”。
  - judgmentOutputs 写“判断完成后的结论字段”，例如 Top 3 probable RCA、推荐 CAPA、置信度、需补充数据。
  - escalationConditions / humanConfirmation 写“原人工流程里需要人工处理的情况”，例如资料缺失要补材料、根因无法判断要找 RCA owner、CAPA 涉及供应商争议要质量负责人确认。
  - doneCriteria 写“这一步何时可以停止并进入下一步”，例如已给出带证据链的 Top 3 根因和 CAPA，且需人审项已标记。
- handoff_wait 节点要写清楚交给谁、等待什么结果、多久后跟进。
- 不适用的字段可以为空数组或 null。

**条件分支拆解规则（非常重要）**：
- 当用户描述或文件中出现条件表达时，不要把条件压进单个节点 description。
- 条件表达包括但不限于：“如果/若/如需/缺失则/没有则/否则/有错则/无错则/不一致则/不满足则/超过则/通过则/失败则/退回则/补齐后/收到后”。
- 这类内容优先拆成：判断/检查节点 → 条件分支 edge → 对应处理节点 → 必要时回到主线。
- 判断/检查节点的 workUnitKind 通常是 business_judgment 或 document_check。
- 分支 edge 必须有业务标签，例如“已有 MSDS”“缺失 MSDS”“证书无误”“证书有错”“材料齐全”“材料缺失”。
- 分支处理节点必须写成真实人工动作，例如“邮件联系品控补 MSDS”“重新发送错误字段给海关”“补齐订单号后再查询”。
- 如果分支处理后会回到原主线，使用 loop 或 normal edge 连回后续节点，不要省略回流关系。
- 判断/检查节点只能产出判断结果或差异清单；不要同时产出成功分支才会产生的归档、回填、提交结果。
- 例如“校对 IMI 证书，有错就反馈，没错才回填归档”必须拆成“证书校对”→ 证书有错：“反馈错误并等待重出证”→ 回到接收/校对；证书无误：“回填证书字段并归档”。
- 只有当条件只是节点内部很小的操作备注、不会影响流程走向时，才可以留在 operationSteps 中。
- 示例：“从公盘取 MSDS 并打印盖章备用，缺失则邮件品控并取得”应拆为“查找 MSDS”→“判断 MSDS 是否存在”→ 已存在：“打印盖章 MSDS”；缺失：“邮件联系品控补 MSDS”→“打印盖章 MSDS”。

**材料锚定规则（非常重要）**：
- 如果 JobMaterialBrief 中存在「流程方案」材料，并且其中有 processHints，流程节点必须优先逐条来自 processHints。
- 不要因为业务名称像“证书申请/审批/评审”就自行补充官方审批节点。
- 禁止新增未在用户描述或流程方案材料中出现的节点，例如“形式审查”“实质评审”“专家评审”“现场核查”“受理通知书”等。
- 如果你认为流程缺少一步，但材料里没有证据，不要把它生成成节点；请放到 nodeConfidence.questions 里作为待确认问题。
- 文件模板只作为输入、输出或字段依据；不要把模板字段拆成流程步骤。
- 业务规则和 Know-how 只作为节点说明、判断口径或追问依据；不要把规则本身拆成流程步骤。

**输出 JSON 格式**：
{
  "taskType": "workflow",
  "flow": ${FLOW_BIZ_SCHEMA},
  "nodeConfidence": [
    {
      "nodeId": "node-1",
      "confidence": "high 或 medium 或 low",
      "reason": "一句话说明",
      "questions": [
        {
          "id": "node-1-q1",
          "question": "针对这个节点的具体问题",
          "context": "为什么要问",
          "defaultSuggestion": "建议的做法",
          "options": ["方案A", "方案B"]
        }
      ]
    }
  ]
}

confidence 为 "high" 的节点 questions 留空数组。直接输出 JSON。`;

// ============================================================
// Prompt: Agentic Draft（专属 agentic 生成）
// ============================================================

const AGENTIC_DRAFT_SYSTEM = `你是一个资深的 AI 产品架构师。用户描述一个业务目标（可能附带文件），你直接生成 Agent 任务配置。

**思维链**：生成前先想清楚：①核心目标 ②阶段划分 ③每阶段的行动和判断标准 ④哪些阶段需要人工审批。只输出最终 JSON。

**输出格式**：
{
  "taskType": "agentic",
  "agenticConfig": ${AGENTIC_JSON_SCHEMA}
}

**阶段规划（phases）是核心，3-7 个阶段**：
- 阶段名称用"动作+目标"格式（"账号冷启动与基线建立"而非"Phase 1"）
- 每个阶段包含：responsibility、actions、focusSignals、requiredCapabilities、successCriteria（三档）、exitCondition
- responsibility 写这个模块在持续业务里负责哪类判断、生成或运营事项
- focusSignals 写业务运行中要关注的变化、反馈、机会、风险或策略失效迹象，避免写技术监控指标
- 至少 1 个阶段 requiresApproval
- requiredCapabilities 只写业务侧资料、规则文件、表格、模板、素材库、时效口径或结果要求，不写技术能力或 Agent 执行动作

**业务侧必填**：goalMetrics、executionRules、permissions、fallbacks、approvalPoints、globalSuccessCriteria
**业务侧可选**：reporting（持续运行、指标追踪、异常通知场景才生成）、executionOverview（仅作导出或技术交接摘要，不作为业务主界面板块）
**不要生成独立 riskAssessment**：如果风险影响某个模块规则，转化为该模块 questions；如果是跨模块异常，放进 fallbacks。
**技术侧留空**：skills []、evaluators []、executionStrategy "adaptive"、humanCheckpoints 1-2条

**文件内容映射规则**：
如果用户上传了文件，文件内容是核心参考，阶段划分和目标设定必须基于文件内容。

规则：直接输出合法 JSON，不要用 markdown 代码块包裹。`;

// ============================================================
// Prompt: Refine Batch（批量优化多个节点）
// ============================================================

const REFINE_BATCH_SYSTEM = `你是一个业务流程优化专家。你会收到：
1. 当前的流程图 JSON（业务侧内容）
2. 多个节点的确认回答（每个节点可能有 1-2 个问题的回答）
3. 用户的原始需求（供参考）

请根据所有回答，一次性修改相关节点，输出修改后的完整流程图 JSON。

修改规则：
1. 区分回答的类型：
   - **结构性回答**（揭示新步骤/分支）→ 修改节点结构、拆分节点、调整 edges
   - **参数性回答**（具体路径、格式、配置）→ 更新 inputs/outputs
   - **执行模式回答**（谁来做）→ 更新 executionMode
2. description 只描述"做什么"，不要把策略性信息塞进 description
3. 如果某个回答揭示了新的子步骤，可以将该节点拆分（新节点 id 接着最大 id 递增）
4. 如果修改影响了相邻节点的 inputs/outputs 衔接，也要同步修改
5. **不要动没有收到回答的节点**
6. 如果回答包含“如果/缺失则/有错则/无错则/不一致则/退回则/补齐后”等条件或例外处理，优先拆成判断节点、分支 edge 和对应处理节点；不要只追加到 description。
7. 分支 edge 必须有清楚标签；分支处理后回到主线时，要补回流 edge。
8. **不要生成 executionRules、executionType 字段**（这些由技术侧后续生成）
9. 修改后的 JSON 格式必须和原来一致
10. 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字

质量要求：
- label 必须具体（"比对证书编号与申请大表" 而非 "数据校验"）
- description 禁止套话（禁止 "进行全面的XX"、"确保XX准确性"，只写动作+对象+产出）
- inputs/outputs 必须带格式（"申请大表（Excel）" 而非 "处理结果（文本）"）

输出格式：
${FLOW_BIZ_SCHEMA}`;

// ============================================================
// Prompt: Refine Batch Delta（仅更新已回答节点；必要时回退全量）
// ============================================================

const REFINE_BATCH_DELTA_SYSTEM = `你是一个业务流程优化专家。你会收到：
1. 当前流程图的局部上下文（只含待更新节点及其相邻节点）
2. 需要更新的节点回答（每个节点 1-2 个回答）
3. 原始需求（供参考）

你的目标是：**仅返回被回答节点的字段更新**，用于前端快速局部合并。

严格输出 JSON：
{
  "requiresFullRefine": false,
  "reason": "一句话原因",
  "updates": [
    {
      "nodeId": "node-1",
      "label": "可选，若需改名才返回",
      "description": "可选",
      "executionMode": "pending 或 ai_auto 或 human_confirm 或 human_manual（可选）",
      "estimatedTime": "可选",
      "inputs": [{ "name": "...", "icon": "📄", "description": "...", "required": true, "source": "user 或 previous_step 或 default", "sourceDetail": "可选" }],
      "outputs": [{ "name": "...", "icon": "✅", "description": "..." }],
      "operationSteps": ["步骤1", "步骤2"],
      "requiredCheckFields": ["字段A", "字段B"],
      "doneCriteria": "一句话完成标准"
    }
  ]
}

规则：
1) 只允许更新用户回答涉及的节点；不要返回未回答节点。
2) 不要新增/删除节点，不要修改 edges。
3) 如果回答需要改流程结构（新增步骤、改分支、改连线），或者回答里出现“如果/缺失则/有错则/无错则/不一致则/退回则/补齐后”等条件或例外处理，则返回：
   {
     "requiresFullRefine": true,
     "reason": "需要结构调整的原因",
     "updates": []
   }
4) 字段最小化返回：没变化就不返回该字段。
5) 文案避免套话，字段名尽量沿用原节点术语。
6) 直接输出合法 JSON，不要 markdown 包裹。`;

// ============================================================
// Prompt: Refine（技术方自由对话修改 Workflow — 含技术字段）
// ============================================================

const REFINE_SYSTEM = `你是一个业务流程优化专家。你会收到：
1. 当前的流程图（结构化 JSON，反映用户在画布上的最新修改）
2. 用户的修改意见（来自技术方，可能涉及执行方式、执行规则、技术实现等）
3. 用户的原始需求（供参考）

请根据用户意见修改流程图，输出修改后的完整 JSON。

修改规则：
1. **只改用户提到的部分**，不要动其他已经合理的节点
2. 如果需要新增节点，id 接着当前最大 id 递增
3. 如果需要删除节点，同时删除相关的 edges
4. 如果用户在画布上已经做了修改，尊重这些修改
5. 修改后的 JSON 格式必须和原来一致
6. 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字

质量要求：
- label 必须具体（"比对证书编号与申请大表" 而非 "数据校验"）
- description 禁止套话（禁止 "进行全面的XX"、"确保XX准确性"，只写动作+对象+产出）
- executionRules 禁止套话（禁止 "确保数据完整性"、"遵循行业规范"，必须写可执行的规则如 "Part号格式必须为xxx-xxxx"、"超过3个工作日未回复自动催办"）
- inputs/outputs 必须带格式（"申请大表（Excel）" 而非 "处理结果（文本）"）

输出格式：
${FLOW_JSON_SCHEMA}`;

// ============================================================
// Prompt: Refine Business（业务方自由对话修改 Workflow — 不含技术字段）
// ============================================================

const REFINE_BUSINESS_SYSTEM = `你是一个业务流程优化专家。你会收到：
1. 当前的流程图 JSON（业务侧内容）
2. 用户的修改意见（来自业务方，通常是业务逻辑调整、步骤增删等）
3. 用户的原始需求（供参考）

请根据用户意见修改流程图，输出修改后的完整 JSON。

修改规则：
1. **只改用户提到的部分**，不要动其他已经合理的节点
2. 如果需要新增节点，id 接着当前最大 id 递增
3. 如果需要删除节点，同时删除相关的 edges
4. 如果用户在画布上已经做了修改，尊重这些修改
5. 如果用户反馈包含“如果/若/缺失则/没有则/否则/有错则/无错则/不一致则/不满足则/超过则/退回则/补齐后/收到后”等条件或例外处理，优先新增判断/检查节点、条件分支 edge 和处理节点；不要只把条件写进 description。
6. 分支 edge 必须写清楚业务标签，例如“已有文件”“文件缺失”“核对无误”“发现错误”。
7. 如果分支处理后会继续原流程，要补回流 edge。
8. 判断/检查节点只能产出判断结果或差异清单；不要同时产出成功分支才会产生的归档、回填、提交结果。
9. 例如“校对 IMI 证书，有错就反馈，没错才回填归档”必须拆成“证书校对”→ 证书有错：“反馈错误并等待重出证”→ 回到接收/校对；证书无误：“回填证书字段并归档”。
10. **不要生成 executionRules、executionType 字段**（这些由技术侧后续生成）
11. 修改后的 JSON 格式必须和原来一致
12. 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字

质量要求：
- label 必须具体（"比对证书编号与申请大表" 而非 "数据校验"）
- description 禁止套话（禁止 "进行全面的XX"、"确保XX准确性"，只写动作+对象+产出）
- inputs/outputs 必须带格式（"申请大表（Excel）" 而非 "处理结果（文本）"）
- 不要出现“从公盘取 MSDS 并打印盖章备用，缺失则邮件品控并取得”这种把多个动作和条件塞在一个节点里的描述；应该拆成查找、判断、已有处理、缺失处理等节点。

输出格式：
${FLOW_BIZ_SCHEMA}`;

// ============================================================
// Prompt: Enrich Node Details（业务侧节点内补全：短说明 + SOP + 必对字段 + 完成标准）
// ============================================================

const ENRICH_NODE_DETAILS_SYSTEM = `你是业务流程分析助手。你会收到：
1) 原始业务需求
2) 完整流程图（仅供上下文）
3) 需要补全的节点列表

你的任务：仅为每个节点补全 4 个业务字段，不修改流程结构。

输出格式（严格 JSON）：
{
  "nodes": [
    {
      "nodeId": "node-1",
      "briefDescription": "20-40字，一句话写清本步目标结果，不写具体步骤",
      "operationSteps": ["步骤1", "步骤2", "步骤3"],
      "requiredCheckFields": ["字段A", "字段B", "字段C"],
      "doneCriteria": "一句话，明确什么情况下算完成"
    }
  ]
}

规则：
- 只输出上述 JSON，不要其他文字。
- operationSteps 3-6 条，动词开头，具备可执行性。
- requiredCheckFields 3-8 项，只写字段名/校对项，短语即可。
- 不得臆造流程外的系统名或文件；若不确定，使用通用业务表述。`;

// ============================================================
// Prompt: Enrich Node Context（节点材料依据 + 规则依据 + 置信度 + 追问）
// ============================================================

const NODE_CONTEXT_ENRICH_SYSTEM = `你是节点上下文分析助手。你会收到：
1) 用户原始业务描述
2) 当前已经生成的流程图 JSON
3) 当前业务方案的材料理解层 JobMaterialBrief

你的任务：不要修改流程结构，只给每个节点补充“材料依据、规则依据、置信度和追问”。

严格输出 JSON：
{
  "nodePatches": [
    {
      "nodeId": "node-1",
      "attachedMaterials": [
        {
          "fileName": "文件名",
          "category": "workflow_plan 或 business_rule_knowhow 或 file_template 或 uncategorized",
          "reason": "为什么这份材料和该节点相关"
        }
      ],
      "relatedRules": [
        {
          "title": "规则或口径标题",
          "reason": "为什么这条规则影响该节点"
        }
      ],
      "confidence": "high 或 medium 或 low",
      "reason": "一句话说明置信度依据",
      "questions": [
        {
          "id": "node-1-material-q1",
          "question": "需要业务方确认的具体问题",
          "context": "为什么要问",
          "defaultSuggestion": "如果没有特别要求，建议怎么处理",
          "options": ["选项A", "选项B"]
        }
      ]
    }
  ]
}

规则：
- 只返回 nodePatches，不要返回完整流程。
- 不要新增、删除、重排节点。
- attachedMaterials 只放确实与节点相关的材料，每个节点最多 3 个。
- relatedRules 只放影响该节点判断口径的规则，每个节点最多 3 条。
- 文件模板主要用于 inputs/outputs 或字段依据，不要把字段当成流程步骤。
- 业务规则和 Know-how 主要用于置信度和追问，不要直接当成流程节点。
- 如果材料能回答的问题，不要再问用户。
- 每个节点最多 1 个问题；只问会影响流程理解、文件使用、字段核对或责任边界的问题。
- 问题必须绑定具体节点，避免“这个流程有什么特殊要求吗”这类泛泛问题。
- 如果没有上传材料，nodePatches 可以为空数组。
- 直接输出合法 JSON，不要 markdown 包裹。`;

// ============================================================
// Prompt: Clarification Questions（基于已生成流程图生成追问）
// ============================================================

const CLARIFICATION_QUESTIONS_SYSTEM = `你是业务流程澄清助手。你会收到：
1) 业务方原始描述
2) 当前已经生成的业务流程澄清稿 JSON
3) 当前 Job 的材料理解层 JobMaterialBrief
4) 已经问过或已经确认过的信息

你的任务：只生成业务方容易回答、且能明显提升流程图准确性的追问。不要修改流程图，不要生成 Review，不要判断技术可行性。

严格输出 JSON：
{
  "artifactType": "business_flow_clarification_questions",
  "summary": "一句话说明为什么需要这些问题；如果没有问题，说明当前暂时没有高价值追问",
  "questions": [
    {
      "id": "clarify-node-1-q1",
      "nodeId": "node-1",
      "nodeLabel": "节点名称",
      "priority": "high 或 medium 或 low",
      "question": "问业务方的问题",
      "reason": "为什么这个问题会影响流程理解",
      "options": ["选项A", "选项B", "选项C"],
      "answerType": "single_choice 或 multi_choice 或 free_text"
    }
  ]
}

提问原则：
1. 最多 5 个问题，默认只问 1-3 个真正高价值的问题。
2. 每个问题必须绑定一个具体 nodeId；除非是流程起点/终点这种全局缺口，才允许 nodeId 为空字符串。
3. 优先问会影响节点顺序、输入输出、判断规则、返修路径、文件使用依据的问题。
4. 如果某个节点 description 或 operationSteps 中出现“如果/缺失则/有错则/无错则/不一致则/退回则/补齐后”等条件，但流程图没有对应分支，优先追问这个条件应该怎么走。
5. 如果问题可以从已上传材料中读到，不要再问业务方。
6. 如果只是字段文案不够漂亮，不要提问。
7. 问题必须用业务语言，不要出现 workflow、agentic、schema、executionMode、Skill、JobSpec 等技术词。
8. 每个问题尽量提供 2-3 个可点击选项；无法列选项时 answerType 用 free_text，options 为空数组。
9. 不要要求业务方一次性补完整方案；只问当前最影响准确性的内容。

直接输出合法 JSON，不要 markdown 包裹。`;

// callLLM is imported from @/lib/llm (supports Cursor SDK + raw API)

type JobMaterialCategory = "workflow_plan" | "business_rule_knowhow" | "file_template" | "uncategorized";

interface RequestFileContext {
  path: string;
  originalName?: string;
  ext?: string;
  type?: string;
  jobMaterialCategory?: JobMaterialCategory;
}

interface JobMaterialBrief {
  sourceId: string;
  fileName: string;
  category: JobMaterialCategory;
  fileType: string;
  summary: string;
  processHints: string[];
  ruleHints: string[];
  templateFields: string[];
  sampleRows: string[];
  parseStatus: "ok" | "partial" | "failed";
}

const JOB_MATERIAL_CATEGORY_LABEL: Record<JobMaterialCategory, string> = {
  workflow_plan: "流程方案",
  business_rule_knowhow: "业务规则和 Know-how",
  file_template: "文件模板",
  uncategorized: "未分类/待识别",
};

const AGENT_READ_EXTENSIONS = new Set([
  ".ppt",
  ".pptx",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
]);

function getRequestFileExt(file: RequestFileContext) {
  return (file.ext || path.extname(file.path)).toLowerCase();
}

function requiresAgentFileReading(file: RequestFileContext) {
  return AGENT_READ_EXTENSIONS.has(getRequestFileExt(file));
}

function isJobMaterialCategory(value: unknown): value is JobMaterialCategory {
  return value === "workflow_plan"
    || value === "business_rule_knowhow"
    || value === "file_template"
    || value === "uncategorized";
}

function normalizeRequestFiles(files: unknown, filePaths: unknown): RequestFileContext[] {
  if (Array.isArray(files)) {
    return files
      .filter((file): file is Record<string, unknown> => !!file && typeof file === "object")
      .map((file) => ({
        path: typeof file.path === "string" ? file.path : "",
        originalName: typeof file.originalName === "string" ? file.originalName : undefined,
        ext: typeof file.ext === "string" ? file.ext : undefined,
        type: typeof file.type === "string" ? file.type : undefined,
        jobMaterialCategory: isJobMaterialCategory(file.jobMaterialCategory) ? file.jobMaterialCategory : "uncategorized",
      }))
      .filter((file) => file.path);
  }

  if (Array.isArray(filePaths)) {
    return filePaths
      .filter((path): path is string => typeof path === "string" && path.length > 0)
      .map((path) => ({ path, jobMaterialCategory: "uncategorized" }));
  }

  return [];
}

function truncateText(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function getFileDisplayName(file: RequestFileContext, index = 0) {
  return file.originalName || file.path.split("/").pop() || `文件${index + 1}`;
}

function pickMeaningfulLines(text: string, maxItems: number) {
  return text
    .split(/\r?\n|[。；;]/)
    .map((line) => line.replace(/^\s*[-*•\d一二三四五六七八九十]+[.)、，:：\s-]*/u, "").trim())
    .filter((line) => line.length >= 4)
    .slice(0, maxItems);
}

function buildTextMaterialBrief(file: RequestFileContext, text: string, parseStatus: JobMaterialBrief["parseStatus"] = "ok"): JobMaterialBrief {
  const ext = (file.ext || path.extname(file.path)).toLowerCase();
  const category = file.jobMaterialCategory ?? "uncategorized";
  const lines = pickMeaningfulLines(text, 10);
  const isWorkflow = category === "workflow_plan";
  const isRule = category === "business_rule_knowhow";

  return {
    sourceId: file.path,
    fileName: getFileDisplayName(file),
    category,
    fileType: ext || file.type || "unknown",
    summary: truncateText(text, 1200),
    processHints: isWorkflow || category === "uncategorized" ? lines.slice(0, 8) : [],
    ruleHints: isRule ? lines.slice(0, 8) : [],
    templateFields: [],
    sampleRows: [],
    parseStatus,
  };
}

async function buildJobMaterialBrief(file: RequestFileContext): Promise<JobMaterialBrief> {
  const ext = getRequestFileExt(file);
  const category = file.jobMaterialCategory ?? "uncategorized";
  const fileName = getFileDisplayName(file);

  try {
    if (ext === ".xlsx" || ext === ".xls") {
      const XLSX = await import("xlsx");
      const buf = await readFile(file.path);
      const wb = XLSX.read(buf, { type: "buffer" });
      const templateFields: string[] = [];
      const sampleRows: string[] = [];
      const processHints: string[] = [];
      const sheetBriefs = wb.SheetNames.slice(0, 5).map((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", blankrows: false });
        const nonEmptyRows = rows
          .map((row, rowIndex) => ({
            rowNumber: rowIndex + 1,
            values: row.map((cell) => String(cell || "").trim()),
          }))
          .filter((row) => row.values.some(Boolean));
        const headers = nonEmptyRows[0]?.values.filter(Boolean).slice(0, 18) || [];
        const samples = nonEmptyRows.slice(1, 4).map((row) => row.values.slice(0, 8).join(" | "));
        templateFields.push(...headers);
        sampleRows.push(...samples);
        if (category === "workflow_plan" || category === "uncategorized") {
          processHints.push(
            ...nonEmptyRows
              .slice(0, 12)
              .map((row) => {
                const text = row.values.slice(0, 6).filter(Boolean).join(" ");
                return text ? `${sheetName} 第${row.rowNumber}行：${text}` : "";
              })
              .filter(Boolean)
          );
        }
        return [
          `Sheet「${sheetName}」`,
          headers.length > 0 ? `列头：${headers.join("、")}` : "列头：未识别",
          samples.length > 0 ? `样例行：${samples.join("；")}` : "",
        ].filter(Boolean).join("；");
      });
      return {
        sourceId: file.path,
        fileName,
        category,
        fileType: ext,
        summary: sheetBriefs.join("\n   "),
        processHints: category === "workflow_plan" ? processHints.slice(0, 8) : [],
        ruleHints: category === "business_rule_knowhow" ? processHints.slice(0, 8) : [],
        templateFields: Array.from(new Set(templateFields.filter(Boolean))).slice(0, 30),
        sampleRows: sampleRows.slice(0, 8),
        parseStatus: "ok",
      };
    }

    if (ext === ".csv" || ext === ".tsv") {
      const content = await readFile(file.path, "utf-8");
      const rows = content.split(/\r?\n/).filter(Boolean).slice(0, 5);
      const delimiter = ext === ".tsv" ? "\t" : ",";
      const headers = rows[0]?.split(delimiter).map((item) => item.trim()).filter(Boolean) || [];
      const textBrief = buildTextMaterialBrief(file, rows.join("\n"));
      return {
        ...textBrief,
        templateFields: headers.slice(0, 30),
        sampleRows: rows.slice(1, 5),
      };
    }

    if (ext === ".txt" || ext === ".md" || ext === ".json") {
      const content = await readFile(file.path, "utf-8");
      return buildTextMaterialBrief(file, content);
    }

    if (ext === ".pdf") {
      const { PDFParse } = await import("pdf-parse");
      const buf = await readFile(file.path);
      const parser = new PDFParse({ data: buf });
      const pdf = await parser.getText();
      await parser.destroy();
      return buildTextMaterialBrief(file, pdf.text);
    }

    if (ext === ".pptx" || ext === ".ppt") {
      return {
        sourceId: file.path,
        fileName,
        category,
        fileType: ext,
        summary: "演示文稿已进入 Job 文件池；流程生成阶段会交给具备工具能力的 Agent 读取原文件，提取页面文字、流程图结构、图形/箭头关系和备注，并整理为中文流程线索。",
        processHints: category === "workflow_plan" || category === "uncategorized"
          ? ["由 Agent 读取 PPT/PPTX 原文件后提取流程节点、顺序、分支、角色和产物"]
          : [],
        ruleHints: category === "business_rule_knowhow"
          ? ["由 Agent 读取 PPT/PPTX 原文件后提取业务规则、判断口径和注意事项"]
          : [],
        templateFields: [],
        sampleRows: [],
        parseStatus: "partial",
      };
    }

    if (ext === ".docx" || ext === ".doc") {
      return {
        sourceId: file.path,
        fileName,
        category,
        fileType: ext,
        summary: "Word 文档已进入 Job 文件池；流程生成阶段会交给具备工具能力的 Agent 读取原文件正文、标题和表格，再提取业务流程线索。",
        processHints: category === "workflow_plan" || category === "uncategorized"
          ? ["由 Agent 读取 Word 原文件后提取流程节点、顺序、分支、角色和产物"]
          : [],
        ruleHints: category === "business_rule_knowhow"
          ? ["由 Agent 读取 Word 原文件后提取业务规则、判断口径和注意事项"]
          : [],
        templateFields: [],
        sampleRows: [],
        parseStatus: "partial",
      };
    }

    if ([".png", ".jpg", ".jpeg"].includes(ext)) {
      return {
        sourceId: file.path,
        fileName,
        category,
        fileType: ext,
        summary: "图片已进入 Job 文件池；流程生成阶段会交给具备工具能力的 Agent 做视觉理解/OCR，提取流程图结构、文字和箭头关系。",
        processHints: category === "workflow_plan" || category === "uncategorized"
          ? ["由 Agent 读取图片后提取流程图节点、顺序、分支、角色和产物"]
          : [],
        ruleHints: [],
        templateFields: [],
        sampleRows: [],
        parseStatus: "partial",
      };
    }

    return {
      sourceId: file.path,
      fileName,
      category,
      fileType: ext || file.type || "unknown",
      summary: "已上传，暂未生成内容摘要。",
      processHints: [],
      ruleHints: [],
      templateFields: [],
      sampleRows: [],
      parseStatus: "partial",
    };
  } catch (err) {
    return {
      sourceId: file.path,
      fileName,
      category,
      fileType: ext || file.type || "unknown",
      summary: `quick brief 解析失败：${(err as Error).message}`,
      processHints: [],
      ruleHints: [],
      templateFields: [],
      sampleRows: [],
      parseStatus: "failed",
    };
  }
}

async function buildFileContextBlock(files: RequestFileContext[]) {
  if (files.length === 0) return "";

  const materialBriefs = await Promise.all(files.slice(0, 8).map((file) => buildJobMaterialBrief(file)));
  const agentReadableFiles = files.filter(requiresAgentFileReading);

  const lines = materialBriefs.map((brief, index) => {
    const detailLines = [
      `${index + 1}. ${brief.fileName}`,
      `   - 材料分类：${JOB_MATERIAL_CATEGORY_LABEL[brief.category]}`,
      `   - 文件类型：${brief.fileType}`,
      `   - 解析状态：${brief.parseStatus}`,
      `   - 摘要：${brief.summary || "未生成摘要"}`,
      brief.processHints.length > 0 ? `   - 可作为流程线索：${brief.processHints.join("；")}` : "",
      brief.ruleHints.length > 0 ? `   - 可作为业务规则/Know-how：${brief.ruleHints.join("；")}` : "",
      brief.templateFields.length > 0 ? `   - 可作为模板字段：${brief.templateFields.join("、")}` : "",
      brief.sampleRows.length > 0 ? `   - 样例行：${brief.sampleRows.join("；")}` : "",
    ];
    return detailLines.filter(Boolean).join("\n");
  });

  const agentFilePoolBlock = agentReadableFiles.length > 0
    ? `\n\n--- 需要 Agent 读取原文件的 Job 文件池 ---\n${agentReadableFiles.map((file, index) => [
        `${index + 1}. ${getFileDisplayName(file)}`,
        `   - 路径：${file.path}`,
        `   - 分类：${JOB_MATERIAL_CATEGORY_LABEL[file.jobMaterialCategory ?? "uncategorized"]}`,
        `   - 类型：${getRequestFileExt(file) || file.type || "unknown"}`,
        "   - 处理方式：不要只依赖 quick brief；请由 Agent 读取原文件，提取文本、页面结构、图形/箭头关系和流程线索。",
      ].join("\n")).join("\n")}`
    : "";

  return `\n\n--- 当前业务方案的材料理解层 JobMaterialBrief ---\n${lines.join("\n")}${agentFilePoolBlock}\n\n材料使用规则：\n- 「流程方案」中的 processHints 优先用于抽取流程步骤、顺序、角色和分支。\n- 「业务规则和 Know-how」中的 ruleHints 用于理解判断口径、校验标准、注意事项，不要直接当成流程节点。\n- 「文件模板」中的 templateFields / sampleRows 用于理解输入输出、字段结构、表格/表单用途，不要把字段列表误当成流程步骤。\n- 「未分类/待识别」需要根据摘要和内容自行判断角色。\n- PPT/PPTX、Word、图片、流程图 PDF 等复杂材料必须回到原文件读取；quick brief 只提供索引，不代表完整内容。\n- 如果材料是英文，输出给业务方的流程图和说明必须是中文。\n- 如果用户描述与材料冲突，优先保留用户描述，并把冲突作为待确认点。`;
}

function buildReadinessGuard(prompt: string, files: RequestFileContext[]) {
  if (files.length > 0) return null;

  const text = prompt.replace(/\s+/g, "");
  if (text.includes("先按你的理解生成草稿") || text.includes("先生成草稿")) return null;
  const processMarkers = [
    "首先", "然后", "接着", "再", "最后", "如果", "否则", "之后", "过", "收到", "提交",
    "查找", "找到", "使用", "填写", "上传", "生成", "发送", "检查", "核对", "更新",
    "导出", "导入", "审批", "确认", "回填", "补充", "归档", "流转", "转交",
  ];
  const weakMaterialOnly = /(手上有|有一些|有.*文件|相关材料|帮我看看|整理一下)/u.test(text);
  const markerCount = processMarkers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0);
  const hasConnectorChain = /(首先|然后|接着|最后|如果|否则).*(然后|接着|最后|如果|否则|之后)/u.test(text);
  const enoughProcessText = markerCount >= 3 || hasConnectorChain;

  if (!enoughProcessText && (weakMaterialOnly || text.length < 60)) {
    return {
      isBusinessPlanRequest: true,
      canDraft: false,
      confidence: "high",
      known: {
        businessGoal: text.includes("IMI") ? "可能是 IMI 证书申请" : null,
        object: "用户提到的业务材料",
        start: null,
        end: null,
        keyRules: [],
      },
      missing: ["缺少业务动作链路", "缺少流程起点", "缺少最终产出或后续处理方式"],
      nextAction: "ask_readiness_questions",
      questions: [
        {
          id: "q1",
          question: "这件事通常从什么事件开始？",
          examples: ["收到领导邮件", "客户提交申请", "系统生成工单"],
        },
        {
          id: "q2",
          question: "拿到这些材料后，你会先做哪一步？",
          examples: ["按 BBN/Part 查找 GSDS", "核对申请表字段", "先确认目的港要求"],
        },
        {
          id: "q3",
          question: "中间有哪些必须完成的业务动作？",
          examples: ["填写申请大表", "上传中外运系统", "发送申请资料给海关"],
        },
        {
          id: "q4",
          question: "最后希望得到什么结果，收到结果后还要做什么？",
          examples: ["生成申请资料", "收到 IMI 证书并检查", "回填证书编号和有效期"],
        },
      ],
      reason: "当前只有业务主题和材料名称，没有足够的流程动作，直接生成会导致系统脑补步骤。",
    };
  }

  return null;
}

// ============================================================
// Few-shot examples for dynamic prompt injection
// ============================================================

interface FewShotExample {
  keywords: string[];
  category: string;
  userInput: string;
  keyTraits: string;
}

const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    keywords: ["审批", "报销", "报关", "申请", "审核", "合同", "签字", "流转", "工单"],
    category: "审批类",
    userInput: "自动化费用报销流程，员工提交后自动校验发票，按规则审批，通过后打款归档",
    keyTraits: `好的方案特征：
- 6个节点：提交申请→自动校验发票→审批流转→部门主管审批→财务打款→归档记录
- executionMode分布：ai_auto(2) + human_confirm(3) + human_manual(1)
- 条件分支：校验不通过→退回修改；金额>5000→增加总监审批
- 每个节点有具体输入输出：报销单(PDF)、发票照片(JPG)、审批意见(文本)

常见错误（不要这样）：
- label 写"数据校验"而不是"比对发票金额与报销单一致性"
- description 写"对提交的数据进行全面校验确保准确性"
- inputs 写"相关数据（文本）"而不是"发票照片（JPG）"
- question 写"这个步骤有什么要求吗？"而不是"发票校验是只查重还是也验真伪？"`,
  },
  {
    keywords: ["数据", "报告", "分析", "汇总", "统计", "导出", "清洗", "ETL", "报表"],
    category: "数据处理类",
    userInput: "每月自动汇总各部门销售数据，生成月度分析报告",
    keyTraits: `好的方案特征：
- 6个节点：从ERP导出数据→数据清洗转换→多维度统计→生成可视化报告→人工审核→邮件分发
- executionMode分布：ai_auto(3) + human_confirm(2) + human_manual(1)
- 数据格式明确：CSV→结构化JSON→PDF报告+Excel附件
- 异常处理：数据源连接失败→告警通知；数据异常→标记待人工核查

常见错误（不要这样）：
- label 写"数据处理"而不是"按部门维度汇总销售额"
- description 写"对数据进行全面的清洗和转换处理"
- outputs 写"处理结果（文本）"而不是"月度销售报告（PDF）+ 明细表（Excel）"
- question 写"数据来源是什么？"而不是"销售数据是从SAP导出还是从飞书多维表格？"`,
  },
  {
    keywords: ["运营", "内容", "发布", "涨粉", "营销", "推广", "账号", "社交", "小红书", "抖音", "矩阵", "批量"],
    category: "运营类",
    userInput: "小红书账号运营，分析竞品制定策略，生成内容并发布，监控数据调整",
    keyTraits: `好的方案特征（Agentic类型，信号驱动）：
- 目标明确：3个月涨粉5万，附推理依据（coreReasoning）
- 阶段清晰：账号冷启动与基线建立（1-7天）→ 内容策略验证与优化（8-21天）→ 规模化内容产出（22-60天）→ 增长冲刺与目标达成（61-90天）
- 每个阶段有明确的 responsibility、actions、focusSignals、requiredCapabilities、successCriteria（三档）、exitCondition
- focusSignals 写业务信号：内容表现、用户反馈、平台风险、机会信号、资源消耗、策略失效迹象
- 至少1个阶段 requiresApproval（如策略调整阶段）
- 每个阶段有 requiredCapabilities，但只放业务资料/规则文件/时效口径/结果要求（如：内容规范文档、选题库、素材库、发布时间口径、数据表字段、脚本/标题输出标准），不要写技术能力或 Agent 执行动作
- fallbacks：跨模块异常情况怎么处理，例如连续3天涨粉不足→策略复盘，合规连续失败→暂停发布
- executionOverview：用通俗语言描述Agent每天的工作流程
- contentPreview：2-3条像真实帖子的示例内容
- permissions.needApproval 每项带 risk 等级和 consequence

常见错误（不要这样）：
- 阶段名写"Phase 1"或"测试阶段"而不是"账号冷启动与基线建立"
- actions 写"进行相关运营操作"而不是"每天发布1条图文，测试3种封面风格"
- successCriteria 写"数据表现良好"而不是"单条播放>1000，互动率>3%"
- question 写"这个阶段有什么要求吗？"而不是"冷启动期每天发几条？图文还是视频？"`,
  },
];

function selectFewShotExample(prompt: string): string {
  const lower = prompt.toLowerCase();
  let bestMatch: FewShotExample | null = null;
  let bestScore = 0;

  for (const ex of FEW_SHOT_EXAMPLES) {
    const score = ex.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = ex;
    }
  }

  if (!bestMatch || bestScore === 0) return "";

  return `\n\n**参考（${bestMatch.category}场景）**：
用户输入："${bestMatch.userInput}"
${bestMatch.keyTraits}
请参考以上特征生成方案，但要根据用户的实际描述调整。`;
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
    const { prompt, action = "draft", currentFlow, currentConfig, feedback, nodeId, nodeLabel, answers, nodeAnswers, filePaths, files, strictTerminology, history, confirmedFacts, maxQuestions } = body;
    const requestFiles = normalizeRequestFiles(files, filePaths);
    const requestFilePaths = requestFiles.map((file) => file.path);
    const fileContextBlock = await buildFileContextBlock(requestFiles);
    const fileOpts = requestFilePaths.length > 0 ? { filePaths: requestFilePaths } : {};
    const needsAgentFileReading = requestFiles.some(requiresAgentFileReading);

    const hasCursor = !!process.env.CURSOR_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasRaw = !!(process.env.LLM_API_KEY && process.env.LLM_BASE_URL);
    if (!hasCursor && !hasOpenAI && !hasRaw) {
      return NextResponse.json({ error: "LLM 配置缺失（需要 CURSOR_API_KEY，或 OPENAI_API_KEY，或 LLM_API_KEY + LLM_BASE_URL）" }, { status: 500 });
    }

    // --- Action: unified_draft (SSE stream: readiness → generate) ---
    if (action === "unified_draft") {
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "请输入业务描述" }, { status: 400 });
      }

      const encoder = new TextEncoder();
      const sse = (data: Record<string, unknown>) =>
        encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // ── Step 1: 准入判断（走原始 API，快速短回复） ──
            controller.enqueue(sse({ type: "stage", stage: "classify_start" }));
            controller.enqueue(sse({ type: "progress", message: "正在理解业务场景..." }));

            let readiness = {
              isBusinessPlanRequest: true,
              canDraft: true,
              confidence: "medium",
              known: {},
              missing: [] as string[],
              nextAction: "generate_business_plan",
              questions: [] as Array<{ id?: string; question?: string; examples?: string[] }>,
              reason: "",
            };
            try {
              const guardedReadiness = buildReadinessGuard(prompt, requestFiles);
              if (guardedReadiness) {
                readiness = guardedReadiness;
              } else {
                const readinessInput = fileContextBlock ? `${prompt}${fileContextBlock}` : prompt;
                const readinessResult = await callLLM(READINESS_CHECK_SYSTEM, readinessInput, {
                  temperature: 0.1,
                  maxTokens: 1200,
                  expectJson: true,
                  preferChannel: "raw",
                });
                readiness = {
                  ...readiness,
                  ...readinessResult,
                  canDraft: readinessResult?.canDraft !== false,
                  questions: Array.isArray(readinessResult?.questions) ? readinessResult.questions.slice(0, 5) : [],
                };
              }
              if (readiness.canDraft) {
                readiness.questions = [];
                readiness.nextAction = "generate_business_plan";
              }
              console.log("[readiness]", readiness.canDraft, readiness.reason);
            } catch (err) {
              console.warn("[readiness] failed:", (err as Error).message);
            }

            controller.enqueue(sse({
              type: "readiness",
              readiness,
            }));
            controller.enqueue(sse({ type: "stage", stage: "classify_done" }));

            if (!readiness.canDraft) {
              controller.enqueue(sse({
                type: "done",
                success: false,
                action: "ask_readiness_questions",
                taskType: "workflow",
                readiness,
                data: {
                  questions: readiness.questions,
                  missing: readiness.missing,
                  known: readiness.known,
                  reason: readiness.reason,
                },
              }));
              return;
            }

            // ── Step 2: 流式生成（走 Cursor Agent） ──
            controller.enqueue(sse({ type: "stage", stage: "draft_start" }));
            const hasFiles = requestFiles.length > 0;
            const fewShotHint = hasFiles ? "" : selectFewShotExample(prompt);
            const enrichedPrompt = `${prompt}${fileContextBlock}${fewShotHint || ""}`;
            const taskType = "workflow";
            const classifyReason = readiness.reason || "";
            const systemPrompt = WORKFLOW_DRAFT_SYSTEM;

            const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
            const preferOpenAI = (provider === "codex" || provider === "openai") && !!process.env.OPENAI_API_KEY;
            const hasCursorSDK = !!process.env.CURSOR_API_KEY;
            const shouldUseCursorAgent = hasCursorSDK && (needsAgentFileReading || !preferOpenAI);

            if (hasFiles) {
              controller.enqueue(sse({
                type: "progress",
                message: needsAgentFileReading
                  ? "文件已进入 Job 文件池，正在交给 Agent 读取原文件..."
                  : "正在读取 Job 文件池材料...",
              }));
            }

            // PPTX/Word/图片等复杂材料需要具备工具能力的 Agent 读取原文件；
            // 其他场景仅当明确不偏好 OpenAI/Codex 且存在 Cursor key 时走 Cursor 流式；
            // 否则统一走 callLLM（按 provider 选路并自动兜底）
            if (shouldUseCursorAgent) {
              const streamOpts: CallLLMOptions = { temperature: 0.3, ...fileOpts };
              for await (const event of streamViaCursorSDK(systemPrompt, enrichedPrompt, streamOpts)) {
                if (event.type === "progress") {
                  controller.enqueue(sse({ type: "progress", message: event.message }));
                } else if (event.type === "text") {
                  controller.enqueue(sse({ type: "text", content: event.message }));
                } else if (event.type === "done") {
                  controller.enqueue(sse({ type: "stage", stage: "draft_done" }));
                  const result = event.result;
                  const flow = result?.flow || result;
                  if (!Array.isArray(flow?.edges)) {
                    if (flow) flow.edges = [];
                  }
                  controller.enqueue(sse({
                    type: "done",
                    success: true,
                    taskType,
                    classifyReason,
                    data: flow,
                    nodeConfidence: result?.nodeConfidence || [],
                  }));
                } else if (event.type === "error") {
                  controller.enqueue(sse({ type: "error", error: event.message }));
                }
              }
            } else {
              controller.enqueue(sse({
                type: "progress",
                message: needsAgentFileReading
                  ? "未检测到 Cursor Agent，正在用可用模型读取文件索引并生成流程图..."
                  : "正在生成流程图...",
              }));
              const result = await callLLM(systemPrompt, enrichedPrompt, {
                temperature: 0.3,
                preferChannel: needsAgentFileReading && hasCursorSDK ? "cursor" : undefined,
                ...fileOpts,
              });
              controller.enqueue(sse({ type: "stage", stage: "draft_done" }));
              const flow = result?.flow || result;
              if (!Array.isArray(flow?.edges)) {
                if (flow) flow.edges = [];
              }
              controller.enqueue(sse({
                type: "done",
                success: true,
                taskType,
                classifyReason,
                data: flow,
                nodeConfidence: result?.nodeConfidence || [],
              }));
            }
          } catch (err) {
            console.error("[unified_draft stream]", err);
            controller.enqueue(sse({ type: "error", error: (err as Error).message }));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // --- Action: refine_batch_delta (fast path: update answered nodes only) ---
    if (action === "refine_batch_delta") {
      if (!currentFlow || !Array.isArray(currentFlow.nodes) || !Array.isArray(nodeAnswers) || nodeAnswers.length === 0) {
        return NextResponse.json({ error: "缺少流程图或节点回答" }, { status: 400 });
      }

      const targetNodeIds = new Set(
        nodeAnswers
          .filter((na: { nodeId?: string; answers?: unknown[] }) => typeof na?.nodeId === "string" && Array.isArray(na.answers))
          .map((na: { nodeId: string }) => na.nodeId)
      );
      if (targetNodeIds.size === 0) {
        return NextResponse.json({ error: "未找到有效的节点回答" }, { status: 400 });
      }

      const nodes = Array.isArray(currentFlow.nodes) ? currentFlow.nodes : [];
      const edges = Array.isArray(currentFlow.edges) ? currentFlow.edges : [];
      const nodeById = new Map(nodes.map((n: Record<string, unknown>) => [String(n.id || ""), n]));

      const relatedNodeIds = new Set<string>(targetNodeIds);
      for (const e of edges) {
        const source = String((e as Record<string, unknown>).source || "");
        const target = String((e as Record<string, unknown>).target || "");
        if (targetNodeIds.has(source) || targetNodeIds.has(target)) {
          if (source) relatedNodeIds.add(source);
          if (target) relatedNodeIds.add(target);
        }
      }

      const contextNodes = Array.from(relatedNodeIds)
        .map((id) => nodeById.get(id))
        .filter(Boolean);
      const contextEdges = edges.filter((e: Record<string, unknown>) => {
        const source = String(e.source || "");
        const target = String(e.target || "");
        return relatedNodeIds.has(source) && relatedNodeIds.has(target);
      });

      const allAnswersText = nodeAnswers
        .filter((na: { nodeId?: string; answers?: unknown[] }) => na?.nodeId && Array.isArray(na.answers))
        .map((na: { nodeId: string; nodeLabel: string; answers: { question: string; answer: string }[] }) => {
          const qaText = (na.answers || [])
            .map((a) => `  问：${a.question || "（未知问题）"}\n  答：${a.answer || "（未回答）"}`)
            .join("\n");
          return `节点：${na.nodeId}（${na.nodeLabel || "未命名"}）\n${qaText}`;
        })
        .join("\n\n");

      const nodeSummary = nodes
        .map((n: Record<string, unknown>) => `- ${String(n.id || "")}: ${String(n.label || "")}`)
        .join("\n");

      const deltaInput = [
        `原始需求：${prompt || "未提供"}`,
        `\n当前流程节点总览（仅供命名对齐）：\n${nodeSummary}`,
        `\n局部上下文（目标节点及相邻节点）：\n${JSON.stringify({ nodes: contextNodes, edges: contextEdges }, null, 2)}`,
        `\n待更新节点回答：\n${allAnswersText}`,
      ].join("\n");

      const delta = await callLLM(REFINE_BATCH_DELTA_SYSTEM, deltaInput, {
        temperature: 0.2,
        ...fileOpts,
      });

      const requiresFullRefine = !!delta?.requiresFullRefine;
      const reason = typeof delta?.reason === "string" ? delta.reason : "";
      const updates = Array.isArray(delta?.updates) ? delta.updates : [];

      return NextResponse.json({
        success: true,
        data: {
          requiresFullRefine,
          reason,
          updates,
        },
      });
    }

    // --- Action: refine_batch (batch refine multiple nodes) ---
    if (action === "refine_batch") {
      if (!currentFlow || !Array.isArray(nodeAnswers) || nodeAnswers.length === 0) {
        return NextResponse.json({ error: "缺少流程图或节点回答" }, { status: 400 });
      }

      const allAnswersText = nodeAnswers
        .filter((na: { nodeId?: string; answers?: unknown[] }) => na?.nodeId && Array.isArray(na.answers))
        .map((na: { nodeId: string; nodeLabel: string; answers: { question: string; answer: string }[] }) => {
          const qaText = (na.answers || [])
            .map((a) => `  问：${a.question || "（未知问题）"}\n  答：${a.answer || "（未回答）"}`)
            .join("\n");
          return `节点：${na.nodeId}（${na.nodeLabel || "未命名"}）\n${qaText}`;
        })
        .join("\n\n");

      const refineInput = [
        `当前流程图：\n${JSON.stringify(currentFlow, null, 2)}`,
        `\n用户对以下节点的确认：\n${allAnswersText}`,
        prompt ? `\n原始需求（供参考）：${prompt}` : "",
      ].join("\n");

      const refined = await callLLM(REFINE_BATCH_SYSTEM, refineInput, fileOpts);
      if (!refined?.nodes || !Array.isArray(refined.nodes)) {
        return NextResponse.json({ error: "AI 批量优化结果格式异常" }, { status: 502 });
      }
      if (!Array.isArray(refined.edges)) {
        refined.edges = currentFlow.edges || [];
      }
      return NextResponse.json({ success: true, data: refined });
    }

    // --- Action: clarification_questions (ask only; do not mutate flow) ---
    if (action === "clarification_questions") {
      if (!currentFlow || !Array.isArray(currentFlow.nodes) || currentFlow.nodes.length === 0) {
        return NextResponse.json({ error: "缺少当前流程图节点" }, { status: 400 });
      }

      const questionLimit = Math.max(1, Math.min(5, Number(maxQuestions) || 5));
      const clarificationInput = [
        `原始业务描述：${prompt || "未提供"}`,
        `\n当前业务流程澄清稿：\n${JSON.stringify(currentFlow, null, 2)}`,
        fileContextBlock || "\n当前业务方案未上传材料。",
        `\n已经问过或已经回答过的信息：\n${JSON.stringify({ history: history || [], confirmedFacts: confirmedFacts || [] }, null, 2)}`,
        `\n本次最多生成 ${questionLimit} 个追问。`,
      ].join("\n");

      const clarified = await callLLM(CLARIFICATION_QUESTIONS_SYSTEM, clarificationInput, {
        temperature: 0.2,
        expectJson: true,
        preferChannel: "raw",
      });

      const questions = Array.isArray(clarified?.questions)
        ? clarified.questions.slice(0, questionLimit)
        : [];

      return NextResponse.json({
        success: true,
        data: {
          artifactType: "business_flow_clarification_questions",
          summary: typeof clarified?.summary === "string" ? clarified.summary : "",
          questions,
        },
      });
    }

    // --- Action: enrich_node_context (material evidence/rules/confidence/questions) ---
    if (action === "enrich_node_context") {
      if (!currentFlow || !Array.isArray(currentFlow.nodes) || currentFlow.nodes.length === 0) {
        return NextResponse.json({ error: "缺少流程图节点" }, { status: 400 });
      }

      const enrichInput = [
        `原始需求：${prompt || "未提供"}`,
        `\n当前流程图：\n${JSON.stringify(currentFlow, null, 2)}`,
        fileContextBlock || "\n当前业务方案未上传材料。",
      ].join("\n");

      const enriched = await callLLM(NODE_CONTEXT_ENRICH_SYSTEM, enrichInput, {
        temperature: 0.2,
        expectJson: true,
        preferChannel: "raw",
      });

      if (!enriched?.nodePatches || !Array.isArray(enriched.nodePatches)) {
        return NextResponse.json({ error: "节点上下文增强结果格式异常" }, { status: 502 });
      }

      return NextResponse.json({ success: true, data: enriched });
    }

    // --- Action: enrich_node_details_batch (async enrich SOP/check fields/done criteria) ---
    if (action === "enrich_node_details_batch") {
      if (!currentFlow || !Array.isArray(currentFlow.nodes) || currentFlow.nodes.length === 0) {
        return NextResponse.json({ error: "缺少流程图节点" }, { status: 400 });
      }
      const strictMode = strictTerminology === true;
      const targets = (currentFlow.nodes as Array<Record<string, unknown>>).map((n) => ({
        nodeId: String(n.id || ""),
        label: String(n.label || ""),
        description: String(n.description || ""),
        inputs: Array.isArray(n.inputs) ? n.inputs : [],
        outputs: Array.isArray(n.outputs) ? n.outputs : [],
      }));

      const enrichInput = [
        `原始需求：${prompt || "未提供"}`,
        `\n完整流程图（上下文）：\n${JSON.stringify(currentFlow, null, 2)}`,
        `\n需要补全的节点：\n${JSON.stringify(targets, null, 2)}`,
        strictMode
          ? `\n术语约束（必须遵守）：只允许复用该节点已有的 label / description / inputs / outputs 中出现过的术语来写补全内容；禁止新增系统名、角色名、表单名、文件名、步骤名。若信息不足，使用“待确认”。`
          : "",
      ].join("\n");

      const enriched = await callLLM(ENRICH_NODE_DETAILS_SYSTEM, enrichInput, {
        temperature: 0.2,
        preferChannel: "raw",
      });

      if (!enriched?.nodes || !Array.isArray(enriched.nodes)) {
        return NextResponse.json({ error: "节点补全结果格式异常" }, { status: 502 });
      }
      return NextResponse.json({ success: true, data: enriched });
    }

    // --- DEPRECATED: classify, draft_agentic — use unified_draft instead ---
    if (action === "classify" || action === "draft_agentic") {
      return NextResponse.json(
        { error: `Action "${action}" is deprecated. Use "unified_draft" instead.` },
        { status: 410 }
      );
    }

    // --- Action: generate_workflow_tech (generate tech config for workflow nodes) ---
    if (action === "generate_workflow_tech") {
      if (!currentFlow) {
        return NextResponse.json({ error: "缺少当前流程图" }, { status: 400 });
      }
      const techInput = `已确认的业务流程图：\n${JSON.stringify(currentFlow, null, 2)}\n\n请为每个节点生成技术配置。`;
      const techResult = await callLLM(GENERATE_WORKFLOW_TECH_SYSTEM, techInput, { temperature: 0.3 });
      if (!techResult?.nodes || !Array.isArray(techResult.nodes)) {
        return NextResponse.json({ error: "Workflow 技术配置生成失败，请重试" }, { status: 502 });
      }
      return NextResponse.json({ success: true, data: techResult });
    }

    // --- Action: generate_tech (generate tech config from confirmed business config) ---
    if (action === "generate_tech") {
      if (!currentConfig) {
        return NextResponse.json({ error: "缺少当前业务配置" }, { status: 400 });
      }
      const techInput = `已确认的业务配置：\n${JSON.stringify(currentConfig, null, 2)}`;
      const techResult = await callLLM(GENERATE_TECH_SYSTEM, techInput, { temperature: 0.3 });
      if (!techResult?.skills) {
        return NextResponse.json({ error: "技术配置生成失败，请重试" }, { status: 502 });
      }
      return NextResponse.json({ success: true, data: techResult });
    }

    // --- Action: refine_agentic ---
    if (action === "refine_agentic") {
      if (!currentConfig || !feedback) {
        return NextResponse.json({ error: "缺少当前配置或反馈" }, { status: 400 });
      }
      const refineInput = `原始需求：${prompt || "未提供"}\n\n当前 Agent 任务配置：\n${JSON.stringify(currentConfig, null, 2)}\n\n用户反馈：${feedback}`;
      const refined = await callLLM(REFINE_AGENTIC_SYSTEM, refineInput, fileOpts);
      if (!refined?.config) {
        return NextResponse.json({ error: "AI 修改结果格式异常，请重试" }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        data: refined.config,
        projectName: refined.projectName || "",
      });
    }

    // --- DEPRECATED: draft, refine_node — use unified_draft + refine_batch instead ---
    if (action === "draft" || action === "refine_node") {
      return NextResponse.json(
        { error: `Action "${action}" is deprecated. Use "unified_draft" or "refine_batch" instead.` },
        { status: 410 }
      );
    }

    // --- Action: refine (tech role — full schema with executionRules/executionType) ---
    if (action === "refine") {
      if (!currentFlow || !feedback) {
        return NextResponse.json({ error: "缺少流程图或反馈" }, { status: 400 });
      }
      const refineInput = `原始需求：${prompt || "未提供"}\n\n当前流程图：\n${JSON.stringify(currentFlow, null, 2)}\n\n用户反馈：${feedback}`;
      const refined = await callLLM(REFINE_SYSTEM, refineInput, fileOpts);
      if (!refined?.nodes || !Array.isArray(refined.nodes)) {
        return NextResponse.json({ error: "AI 修改结果格式异常，请重试" }, { status: 502 });
      }
      if (!Array.isArray(refined.edges)) {
        refined.edges = currentFlow.edges || [];
      }
      return NextResponse.json({ success: true, data: refined });
    }

    // --- Action: refine_business (business role — biz schema without executionRules/executionType) ---
    if (action === "refine_business") {
      if (!currentFlow || !feedback) {
        return NextResponse.json({ error: "缺少流程图或反馈" }, { status: 400 });
      }
      const refineInput = `原始需求：${prompt || "未提供"}\n\n当前流程图：\n${JSON.stringify(currentFlow, null, 2)}\n\n用户反馈：${feedback}`;
      const refined = await callLLM(REFINE_BUSINESS_SYSTEM, refineInput, fileOpts);
      if (!refined?.nodes || !Array.isArray(refined.nodes)) {
        return NextResponse.json({ error: "AI 修改结果格式异常，请重试" }, { status: 502 });
      }
      if (!Array.isArray(refined.edges)) {
        refined.edges = currentFlow.edges || [];
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
