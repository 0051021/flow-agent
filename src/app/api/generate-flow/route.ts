import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

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
// Prompt: Classify（判断任务类型）— 保留向后兼容
// ============================================================

const CLASSIFY_SYSTEM = `你是一个企业级 AI 产品架构师。你需要判断用户描述的业务场景属于哪种任务类型。

**两种任务类型**：

1. **workflow（工作流）**：
   - 有明确的、固定的步骤顺序，每一步的输入输出是确定的
   - 流程可以画成流程图，重点是"准确执行每一步"
   - 典型场景：财务报销、合同审批、进出口报关、IT 工单处理

2. **agentic（智能体）**：
   - 有业务目标但执行路径不固定，需要 AI 自主规划和决策
   - 可能包含部分确定性步骤，但整体以目标驱动
   - 典型场景：账号运营涨粉、竞品分析、营销活动策划、内容营销、数据报告

**判断标准**：
- 全是流程（有步骤、有顺序、每步确定性高）→ workflow
- 有目标驱动的部分（即使也有固定流程）→ agentic
- 不确定 → agentic

请输出 JSON：
{
  "taskType": "workflow 或 agentic",
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
    "goal": "用一句话描述业务目标",
    "background": "业务背景（2-3句话）",
    "totalDays": 90,
    "globalSuccessCriteria": "全局成功标准（一句话）",
    "approvalPoints": ["需要审批的决策点摘要"],
    "fallbacks": [
      { "trigger": "触发条件（如：连续3天涨粉不足）", "action": "应对措施（如：告警+建议调整策略）", "severity": "critical 或 warning 或 info" }
    ],
    "phases": [
      {
        "id": "phase-1",
        "name": "阶段名称（动作+目标，专业简洁，如：账号冷启动与基线建立、内容策略验证与优化）",
        "dayRange": [1, 7],
        "status": "pending",
        "actions": ["具体行动1", "具体行动2"],
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
        "requiredCapabilities": ["这个阶段需要的能力（如：内容生成、定时发布）"]
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
    "riskAssessment": [
      { "risk": "风险", "likelihood": "high 或 medium 或 low", "mitigation": "应对措施" }
    ],
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

const UNIFIED_DRAFT_SYSTEM = `你是一个资深的业务流程分析师和 AI 产品架构师。

用户会用自然语言描述一个业务场景。你的任务是：
1. 判断这个场景属于哪种任务类型
2. 根据类型直接生成对应的方案草稿

**思维链**：生成前先想清楚：①核心目标和角色 ②步骤顺序和输入输出 ③哪些步骤必须人工 ④异常处理路径。只输出最终 JSON。

**两种任务类型**：
- **workflow**：有明确步骤顺序，每步输入输出确定，追求准确执行。如：财务报销、合同审批、进出口报关
- **agentic**：有目标但路径不固定，需要 AI 自主规划。包含原来的混合型场景。如：账号运营涨粉、竞品分析、营销活动策划、内容营销、数据报告

**判断标准**：
- 全是流程（有步骤、有顺序、每步确定性高）→ workflow
- 有目标驱动的部分（即使也有固定流程）→ agentic
- 不确定 → agentic

**输出格式（根据类型不同）**：

如果是 workflow，输出：
{
  "taskType": "workflow",
  "classifyReason": "一句话解释为什么是这个类型",
  "flow": ${FLOW_BIZ_SCHEMA},
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

如果是 agentic，输出：
{
  "taskType": "agentic",
  "classifyReason": "一句话解释为什么是这个类型",
  "agenticConfig": ${AGENTIC_JSON_SCHEMA}
}

**Workflow 的规则（业务侧，不生成技术字段）**：
- 节点数量 4-8 个
- label 要具体（"从ERP导出销售数据" 而非 "获取数据"）
- inputs/outputs 标明文件格式（如"报关单（Excel）"），不能为空数组
- 每个节点的 description 必须 20-40 字，只说"做什么"，不要混入执行策略
- **不要生成 executionRules、executionType 字段**（这些由技术侧后续生成）
- confidence 为 "high" 的节点 questions 必须为空数组 []
- 每个节点最多 2 个问题，问题必须包含用户描述中的业务实体名称（禁止 "这个步骤有什么要求吗？"，应该 "校验规则是只看签发日期还是也核对Part号？"）
- 必须考虑异常处理：至少有 1 个条件分支或异常处理路径

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

**关于人机分工（executionMode）— 核心要求**：
- 数据采集、格式转换、定时执行 → "ai_auto"
- 数据校验、策略确认、内容审核 → "human_confirm"
- 发布、删除、付款等不可逆操作 → "human_confirm"
- 纯人工操作 → "human_manual"
- 典型 6 节点流程应有 2-3 个 human_confirm 或 human_manual

**Agentic 的规则（核心：阶段驱动）**：

**阶段规划（phases）是核心，必须生成 3-7 个阶段**：
- 阶段名称用"动作+目标"格式，专业简洁，非技术人员也能理解（如"账号冷启动与基线建立"而不是"Phase 1"，"内容策略验证与优化"而不是"测试"）
- 每个阶段代表一个时间段内的工作重点
- 阶段之间有时间先后关系，dayRange 不能重叠
- 每个阶段包含：做什么（actions）、判断标准（successCriteria 三档）、结束条件（exitCondition）
- 对不确定的阶段生成追问（questions），每个阶段最多 2 个问题
- 标记需要人工审批的阶段（requiresApproval），至少有 1 个阶段需要审批
- requiredCapabilities 列出这个阶段需要的能力（技术侧会据此生成 Skill）

**业务侧内容（必填）**：
- goalMetrics：核心KPI + 推理依据 + 过程指标 + 底线指标 + 行业基准
- executionRules：按类别分组的执行规则
- permissions：自主权限 + 审批事项 + 兜底机制
- reporting：日报周报（含 sampleContent 示例）+ 告警 + 里程碑
- executionOverview：2-3句通俗描述 Agent 的工作方式
- riskAssessment：2-3个风险及应对
- contentPreview：2-3条示例内容（如适用）
- fallbacks：2-3个兜底机制（触发条件+应对措施+严重程度）
- approvalPoints：需要审批的决策点摘要
- globalSuccessCriteria：全局成功标准

**技术侧内容（首次不生成，留空）**：
- skills 留空数组 []
- evaluators 留空数组 []
- executionStrategy 默认 "adaptive"
- humanCheckpoints 填 1-2 条关键的人工确认点

规则：
- 直接输出合法 JSON，不要用 markdown 代码块包裹
- 确保 JSON 格式严格正确`;

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
6. **不要生成 executionRules、executionType 字段**（这些由技术侧后续生成）
7. 修改后的 JSON 格式必须和原来一致
8. 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字

质量要求：
- label 必须具体（"比对证书编号与申请大表" 而非 "数据校验"）
- description 禁止套话（禁止 "进行全面的XX"、"确保XX准确性"，只写动作+对象+产出）
- inputs/outputs 必须带格式（"申请大表（Excel）" 而非 "处理结果（文本）"）

输出格式：
${FLOW_BIZ_SCHEMA}`;

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
5. **不要生成 executionRules、executionType 字段**（这些由技术侧后续生成）
6. 修改后的 JSON 格式必须和原来一致
7. 直接输出合法 JSON，不要用 markdown 代码块包裹，不要有任何解释文字

质量要求：
- label 必须具体（"比对证书编号与申请大表" 而非 "数据校验"）
- description 禁止套话（禁止 "进行全面的XX"、"确保XX准确性"，只写动作+对象+产出）
- inputs/outputs 必须带格式（"申请大表（Excel）" 而非 "处理结果（文本）"）

输出格式：
${FLOW_BIZ_SCHEMA}`;

// ============================================================
// LLM 调用
// ============================================================

async function callLLM(
  systemPrompt: string,
  userContent: string,
  options?: { temperature?: number; expectJson?: boolean; maxTokens?: number }
) {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL || "gpt-4o";

  const isClaude = model.toLowerCase().includes("claude");

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 8192,
  };

  if (options?.expectJson !== false && !isClaude) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

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
    try {
      const repaired = jsonrepair(jsonStr);
      return JSON.parse(repaired);
    } catch (repairErr) {
      const truncated = jsonStr.length > 200 ? `${jsonStr.slice(-200)}...` : jsonStr;
      throw new Error(`JSON 解析失败（可能是输出被截断）。末尾内容：${truncated}`);
    }
  }
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
    keyTraits: `好的方案特征（Agentic类型，阶段驱动）：
- 目标明确：3个月涨粉5万，附推理依据（coreReasoning）
- 阶段清晰：账号冷启动与基线建立（1-7天）→ 内容策略验证与优化（8-21天）→ 规模化内容产出（22-60天）→ 增长冲刺与目标达成（61-90天）
- 每个阶段有明确的 actions、successCriteria（三档）、exitCondition
- 至少1个阶段 requiresApproval（如策略调整阶段）
- 每个阶段有 requiredCapabilities（如：内容生成、定时发布、数据采集）
- fallbacks：连续3天涨粉不足→告警、合规连续失败→暂停
- executionOverview：用通俗语言描述Agent每天的工作流程
- contentPreview：2-3条像真实帖子的示例内容
- permissions.needApproval 每项带 risk 等级和 consequence
- riskAssessment：2-3个风险及应对措施

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
    const { prompt, action = "draft", currentFlow, currentConfig, feedback, nodeId, nodeLabel, answers, nodeAnswers } = body;

    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL;
    if (!apiKey || !baseUrl) {
      return NextResponse.json({ error: "LLM 配置缺失" }, { status: 500 });
    }

    // --- Action: unified_draft (classify + draft in one call) ---
    if (action === "unified_draft") {
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "请输入业务描述" }, { status: 400 });
      }
      const fewShotHint = selectFewShotExample(prompt);
      const enrichedPrompt = fewShotHint ? `${prompt}${fewShotHint}` : prompt;
      const result = await callLLM(UNIFIED_DRAFT_SYSTEM, enrichedPrompt, { temperature: 0.3 });
      if (!result?.taskType) {
        return NextResponse.json({ error: "AI 返回格式异常" }, { status: 502 });
      }

      let taskType = result.taskType as string;
      if (taskType === "hybrid") taskType = "agentic";

      if (taskType === "agentic") {
        const agConfig = result.agenticConfig;
        if (!agConfig?.config) {
          return NextResponse.json({ error: "AI 返回的 Agentic 配置异常" }, { status: 502 });
        }
        return NextResponse.json({
          success: true,
          taskType,
          classifyReason: result.classifyReason || "",
          data: agConfig.config,
          projectName: agConfig.projectName || "",
        });
      }

      // workflow
      if (!result.flow?.nodes || !Array.isArray(result.flow.nodes)) {
        return NextResponse.json({ error: "AI 返回的流程图异常" }, { status: 502 });
      }
      if (!Array.isArray(result.flow.edges)) {
        result.flow.edges = [];
      }
      return NextResponse.json({
        success: true,
        taskType,
        classifyReason: result.classifyReason || "",
        data: result.flow,
        nodeConfidence: result.nodeConfidence || [],
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

      const refined = await callLLM(REFINE_BATCH_SYSTEM, refineInput);
      if (!refined?.nodes || !Array.isArray(refined.nodes)) {
        return NextResponse.json({ error: "AI 批量优化结果格式异常" }, { status: 502 });
      }
      if (!Array.isArray(refined.edges)) {
        refined.edges = currentFlow.edges || [];
      }
      return NextResponse.json({ success: true, data: refined });
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
      const refined = await callLLM(REFINE_SYSTEM, refineInput);
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
      const refined = await callLLM(REFINE_BUSINESS_SYSTEM, refineInput);
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
