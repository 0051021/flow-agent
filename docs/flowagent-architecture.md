# FlowAgent 平台架构与逻辑文档

> 最后更新：2026-04-02

## 一、产品定位

FlowAgent 平台包含两个核心产品：

### 1.1 FlowAgent — 业务翻译工具

将业务人员的自然语言描述转化为结构化、可执行的任务定义。支持两种任务类型：

- **Workflow（工作流）**：有明确步骤顺序的确定性流程，输出为可视化流程图
- **Agentic（智能体）**：目标导向的智能规划任务，输出为 Agent 任务配置（目标/技能/约束/评估器）

业务方通过 FlowAgent 了解哪些场景可以做，技术方通过业务方留在上面的内容进行技术确认。

### 1.2 管控后台（SaaS）

关注已部署 Agent 的运行状态，提供：

- 运营仪表盘（活跃 Agent 数、任务量、成功率、待处理项）
- Agent 团队管理（查看所有已部署 Agent 的状态和指标）
- 任务监控（实时任务列表、状态筛选、执行详情）
- 人工介入（确认通过/驳回/异常处理）

### 1.3 两者关系

```
业务方描述需求
    │
    ▼
FlowAgent 翻译为结构化任务定义
    │
    ├── Workflow → 流程图（逐节点确认 → 就绪）
    └── Agentic → Agent 配置（目标/技能/约束/评估器 → 就绪）
    │
    ▼
"部署为 Agent" → 交付到管控后台
    │
    ▼
管控后台监控运行状态 + 人工介入
```

---

## 二、技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS + Radix UI |
| 状态管理 | Zustand + persist (localStorage) |
| 流程图渲染 | @xyflow/react (React Flow) |
| LLM 调用 | OpenAI 兼容 API (gpt-4o) |
| 部署 | Vercel |

---

## 三、页面路由

### FlowAgent（业务翻译工具）

| 路由 | 文件 | 职责 |
|------|------|------|
| `/` | `src/app/page.tsx` | 首页落地页：输入框 + 示例场景卡片（Workflow + Agentic），跳转到 `/editor?q=...` |
| `/editor` | `src/app/editor/page.tsx` | 主工作台：左侧对话面板 + 右侧根据 `taskType` 渲染 FlowCanvas 或 AgenticConfigPanel |
| `POST /api/generate-flow` | `src/app/api/generate-flow/route.ts` | LLM API：支持 classify / draft / draft_agentic / refine_node / refine / refine_agentic 六种 action |

### 管控后台（SaaS）

| 路由 | 文件 | 职责 |
|------|------|------|
| `/console` | `src/app/console/page.tsx` | 仪表盘：统计卡片 + 待处理事项 + 最近任务 + Agent 概览 |
| `/console/agents` | `src/app/console/agents/page.tsx` | Agent 团队：所有已部署 Agent 的卡片列表（状态/成功率/任务数/类型） |
| `/console/tasks` | `src/app/console/tasks/page.tsx` | 任务监控：可筛选的任务表格（全部/执行中/待确认/已完成/异常） |
| `/console/tasks/[id]` | `src/app/console/tasks/[id]/page.tsx` | 任务详情：基本信息 + 进度条 + 执行时间线 + 人工确认/异常处理 |

管控后台使用独立布局 `src/app/console/layout.tsx`，包含固定左侧边栏导航。

---

## 四、核心数据流

### 4.1 FlowAgent 主流程

```
用户在首页输入业务描述
    │
    ▼
/editor?q=描述内容
    │
    ▼
EditorContent 读取 ?q 参数
    ├── resetAll() 清空旧状态
    ├── addChatMessage(用户消息)
    └── setInitQuery(q)
         │
         ▼
ChatPanel 检测到 initQuery + idle 状态
    │
    ▼
triggerClassify(prompt)                    ← 新增：AI 分类
    ├── chatPhase → "classifying"
    ├── POST /api/generate-flow { action: "classify", prompt }
    │        │
    │        ▼
    │   LLM 返回 { taskType, reason, confidence }
    │
    └── 根据 taskType 分流
         │
         ├── taskType === "workflow"
         │        │
         │        ▼
         │   triggerDraft(prompt)           ← 原有 Workflow 流程
         │        ├── chatPhase → "drafting"
         │        ├── POST { action: "draft", prompt }
         │        ├── parseLLMResponse → { nodes, edges }
         │        ├── loadGeneratedFlow
         │        └── 判断是否有需确认节点
         │             ├── 有 → "questioning" → 逐节点确认
         │             └── 无 → "ready"
         │
         └── taskType === "agentic"
                  │
                  ▼
             triggerAgenticDraft(prompt)    ← 新增 Agentic 流程
                  ├── chatPhase → "drafting_agentic"
                  ├── POST { action: "draft_agentic", prompt }
                  │        │
                  │        ▼
                  │   LLM 返回 { config, confirmItems }
                  │
                  ├── setAgenticConfig(config)
                  ├── setAgenticConfirmItems(confirmItems)
                  │
                  └── 判断是否有 confirmItems
                       ├── 有 → "confirming_agentic" → 逐模块确认
                       └── 无 → "agentic_ready"
```

### 4.2 Agentic 确认流程

```
confirming_agentic
    │
    ▼
AgenticConfirmCard 展示当前 confirmItem
    │
    ├── 用户确认（选择选项或自定义输入）
    │     ├── handleAgenticConfirm(answer)
    │     ├── 将确认内容作为 refine 反馈发送
    │     └── agenticConfirmIdx++ → 下一个 or agentic_ready
    │
    ├── 跳过此项 → handleAgenticSkipConfirm
    │     └── agenticConfirmIdx++ → 下一个 or agentic_ready
    │
    └── 跳过全部 → handleAgenticSkipAllConfirm
          └── → agentic_ready
```

### 4.3 部署衔接

```
FlowAgent (agentic_ready)
    │
    ▼
AgenticConfigPanel → "部署为 Agent" 按钮
    │
    ├── 模拟部署（1.5s loading）
    ├── 显示"已部署"状态
    └── "前往管控后台查看" → 跳转 /console/agents
```

### 4.4 管控后台数据流

```
/console（仪表盘）
    ├── 统计卡片：activeAgents / monthlyTasks / successRate / pendingItems
    ├── 待处理事项：pending_confirm + error 任务列表
    ├── 最近任务：前 6 条任务
    └── Agent 概览：运行中的 Agent 卡片

/console/agents（Agent 团队）
    └── 所有 Agent 卡片：状态/成功率/任务数/均耗时/版本/部门

/console/tasks（任务监控）
    ├── 筛选 Tab：全部/执行中/待确认/已完成/异常
    └── 任务表格：ID/Agent/当前节点/进度/状态/耗时

/console/tasks/[id]（任务详情）
    ├── 基本信息 + 进度条
    ├── 人工确认区（pending_confirm 状态）
    │   ├── 确认通过 → 任务继续
    │   └── 驳回（需填原因）→ 任务暂停
    ├── 异常处理区（error 状态）
    │   ├── 重试 → 从当前节点重新执行
    │   ├── 人工接管 → 通知相关人员
    │   └── 跳过 → 跳过当前节点继续
    └── 执行时间线：按时间顺序展示每个节点的事件
```

---

## 五、状态机：chatPhase

### 5.1 完整状态图

```
              ┌──────────────────────────────────────────────────────────┐
              │                                                          │
              ▼                                                          │
        ┌──────────┐    用户输入    ┌──────────────┐                    │
        │   idle   │ ────────────▶ │ classifying  │                    │
        └──────────┘               └──────┬───────┘                    │
              ▲                           │                             │
              │ 失败               分类完成 │                             │
              │                           ▼                             │
              │                    taskType 是？                         │
              │              ┌─────────┐   ┌──────────┐                │
              │              │workflow │   │ agentic  │                │
              │              └────┬────┘   └────┬─────┘                │
              │                   ▼              ▼                      │
              │            ┌──────────┐  ┌─────────────────┐           │
              │            │ drafting │  │drafting_agentic │           │
              │            └────┬─────┘  └───────┬─────────┘           │
              │                 │                 │                      │
              │                 ▼                 ▼                      │
              │          有需确认节点？      有 confirmItems？            │
              │          ┌──┐  ┌──┐       ┌──┐  ┌──┐                   │
              │          │是│  │否│       │是│  │否│                   │
              │          └┬─┘  └┬─┘       └┬─┘  └┬─┘                   │
              │           ▼     ▼           ▼     ▼                     │
              │     questioning ready  confirming  agentic_ready ◀──┐  │
              │          │       │     _agentic        │            │  │
              │          │       │         │            │            │  │
              │    确认节点│  修改 │    确认项 │       修改 │            │  │
              │          ▼       ▼         ▼            ▼            │  │
              │    refining   refining  下一项或    refining         │  │
              │    _node                agentic    _agentic          │  │
              │       │         │       _ready        │              │  │
              │       │         │                     │              │  │
              │       └─────────┴─────────────────────┘              │  │
              │                    → ready / agentic_ready ──────────┘  │
              └────────────────────────────────────────────────────────┘
```

### 5.2 状态说明

| 状态 | 含义 | 用户可操作 |
|------|------|-----------|
| `idle` | 初始状态，无任务 | 输入业务描述 |
| `classifying` | AI 正在判断任务类型 | 等待 |
| `drafting` | 正在生成 Workflow 草稿 | 等待 |
| `questioning` | Workflow 逐节点确认阶段 | 确认/跳过/打字补充 |
| `refining_node` | 正在根据单节点确认结果优化 | 等待 |
| `ready` | Workflow 流程图已就绪 | 自由对话修改、画布编辑 |
| `refining` | 正在根据自由对话修改 Workflow | 等待 |
| `drafting_agentic` | 正在生成 Agentic 任务配置 | 等待 |
| `confirming_agentic` | Agentic 逐模块确认阶段 | 确认/跳过/跳过全部 |
| `agentic_ready` | Agentic 配置已就绪 | 自由对话修改、编辑配置、部署 |
| `refining_agentic` | 正在根据反馈修改 Agentic 配置 | 等待 |

### 5.3 持久化恢复策略

页面刷新时，如果 `chatPhase` 处于请求中间态（`drafting` / `refining_node` / `refining` / `classifying` / `drafting_agentic` / `refining_agentic`），`onRehydrateStorage` 会自动恢复：

- 已有 `agenticConfig` → `agentic_ready`
- 有未完成的待确认节点 → `questioning`
- 已有流程图节点 → `ready`
- 否则 → `idle`

---

## 六、API 设计

### `POST /api/generate-flow`

**通用请求字段**：

```typescript
{
  prompt?: string;           // 原始业务描述
  action: "classify" | "draft" | "draft_agentic" | "refine_node" | "refine" | "refine_agentic";
  currentFlow?: object;      // 当前画布序列化后的 JSON（Workflow）
  currentConfig?: object;    // 当前 Agentic 配置 JSON
  feedback?: string;         // 修改意见
  nodeId?: string;           // 目标节点 ID
  nodeLabel?: string;        // 目标节点标签
  answers?: { question: string; answer: string }[];  // 节点确认回答
}
```

### 六种 Action

| Action | 触发时机 | 输入 | 输出 |
|--------|---------|------|------|
| `classify` | 用户首次输入 | `prompt` | `{ taskType, reason, confidence }` |
| `draft` | Workflow 首次生成 | `prompt` | `{ flow, nodeConfidence[] }` |
| `draft_agentic` | Agentic 首次生成 | `prompt` | `{ config, projectName, confirmItems }` |
| `refine_node` | Workflow 单节点确认后 | `currentFlow` + `nodeId` + `answers` | 完整流程图 JSON |
| `refine` | Workflow 自由对话修改 | `currentFlow` + `feedback` | 完整流程图 JSON |
| `refine_agentic` | Agentic 自由对话修改 | `currentConfig` + `feedback` | `{ config, projectName }` |

### Workflow 流程图 JSON Schema

```json
{
  "projectName": "项目名称",
  "nodes": [{
    "id": "node-1",
    "label": "节点名称（2-6字）",
    "icon": "图标名",
    "description": "一句话描述（20-40字）",
    "executionMode": "ai_auto | human_confirm | human_manual",
    "estimatedTime": "预计耗时",
    "inputs": [{ "name", "icon", "description", "required", "source", "sourceDetail" }],
    "outputs": [{ "name", "icon", "description" }],
    "isCondition": false,
    "conditionBranches": null,
    "executionType": "deterministic | intelligent"
  }],
  "edges": [{
    "source": "node-1",
    "target": "node-2",
    "label": "连线标签",
    "style": "normal | success | error | loop"
  }]
}
```

### Agentic 任务配置 JSON Schema

```json
{
  "projectName": "项目名称",
  "config": {
    "goal": "业务目标（一句话）",
    "background": "业务背景（2-3句话）",
    "constraints": [{
      "id": "c-1",
      "type": "budget | time | quality | compliance | custom",
      "description": "约束条件描述",
      "value": "具体标准"
    }],
    "skills": [{
      "id": "sk-1",
      "name": "技能名称",
      "description": "技能描述",
      "inputs": [{ "name", "type" }],
      "outputs": [{ "name", "type" }],
      "evaluator": "评估标准"
    }],
    "evaluators": [{
      "id": "ev-1",
      "name": "评估器名称",
      "description": "评估说明",
      "metrics": [{ "name": "指标名", "threshold": "阈值", "weight": 0.0-1.0 }]
    }],
    "executionStrategy": "sequential | parallel | adaptive",
    "maxIterations": 5,
    "humanCheckpoints": ["人工确认节点描述"]
  },
  "confirmItems": [{
    "id": "confirm-1",
    "section": "goal | skills | constraints | evaluators",
    "question": "确认问题",
    "context": "为什么要确认",
    "options": ["选项A", "选项B"]
  }]
}
```

---

## 七、组件架构

### 7.1 FlowAgent 编辑器

```
EditorPage (Suspense)
└── EditorContent
    ├── TopBar                          # 顶栏：导航、项目状态、角色切换、评审操作
    │
    ├── ChatPanel                       # 左侧对话面板（340px）
    │   ├── 消息列表 (renderMessage)
    │   ├── NodeQuestionCard            # Workflow 逐节点确认卡片
    │   ├── AgenticConfirmCard          # Agentic 逐模块确认卡片（新增）
    │   ├── CompletionCard              # 确认完成提示
    │   └── 输入区域
    │
    ├── 中间/右侧区域 (flex-1)          # 根据 taskType 条件渲染
    │   │
    │   ├── [taskType === "workflow"]
    │   │   ├── FlowCanvas              # React Flow 画布
    │   │   │   ├── CanvasToolbar       # 悬浮工具条（加/复制/删节点）
    │   │   │   └── FlowCardNode        # 自定义节点组件
    │   │   └── NodeDetailPanel         # 选中节点时的底部详情面板
    │   │
    │   └── [taskType === "agentic"]
    │       └── AgenticConfigPanel      # Agentic 配置面板（新增）
    │           ├── GoalTab             # 目标与背景（可编辑 + 执行策略切换）
    │           ├── SkillsTab           # 技能配置（技能市场 + 自定义 + 删除）
    │           ├── ConstraintsTab      # 约束条件（新增 + 删除）
    │           ├── EvaluatorsTab       # 评估体系（完整 CRUD + 指标编辑）
    │           └── DeployFooter        # 部署入口 → 管控后台
    │
    ├── AnnotationPanel                 # 右侧批注面板（可选）
    ├── KnowledgePanel                  # 右侧知识中心面板（可选）
    └── NodeEditDialog                  # 全屏模态节点编辑器
```

### 7.2 管控后台

```
ConsoleLayout
├── Sidebar                             # 固定左侧边栏（200px）
│   ├── Logo + 返回首页链接
│   └── 导航项
│       ├── 仪表盘 (/console)
│       ├── Agent 团队 (/console/agents)
│       └── 任务监控 (/console/tasks)
│
└── Main Content Area
    │
    ├── ConsoleDashboard (/console)
    │   ├── StatCard x4                 # 活跃Agent/月任务量/成功率/待处理
    │   ├── 待处理事项列表              # pending_confirm + error 任务
    │   ├── 最近任务表格                # 前6条任务
    │   └── Agent 概览卡片              # 运行中的 Agent
    │
    ├── AgentsPage (/console/agents)
    │   └── Agent 卡片网格 (2列)
    │       ├── 状态指示（运行中/草稿/异常/已暂停）
    │       ├── 类型标签（工作流/智能体）
    │       ├── 运营指标（成功率/任务数/均耗时）
    │       └── 版本 + 最后活跃时间
    │
    ├── TasksPage (/console/tasks)
    │   ├── 筛选 Tab（全部/执行中/待确认/已完成/异常）
    │   └── 任务表格
    │       ├── 任务ID（可点击跳转详情）
    │       ├── Agent（图标+名称）
    │       ├── 当前节点
    │       ├── 进度条 + 百分比
    │       ├── 状态 Badge + 优先级
    │       └── 耗时
    │
    └── TaskDetailPage (/console/tasks/[id])
        ├── 返回链接
        ├── 操作结果 Banner（确认/驳回/重试后显示）
        ├── Header（任务ID + 状态 + 优先级 + 操作按钮）
        ├── 人工确认区（pending_confirm 状态时显示）
        │   ├── 确认通过按钮
        │   └── 驳回按钮 → 展开原因表单
        ├── 异常处理区（error 状态时显示）
        │   ├── 重试
        │   ├── 人工接管
        │   └── 跳过
        ├── 信息卡片 x4（Agent/当前节点/进度/耗时）
        ├── 进度条
        ├── 人工确认详情（显示需确认的具体内容和上下文）
        ├── 执行时间线（按时间顺序的事件列表）
        └── 任务元信息（ID/Agent/开始时间/完成时间/耗时）
```

---

## 八、类型系统

### 8.1 任务类型

```typescript
type TaskType = "workflow" | "agentic";
```

### 8.2 Workflow 核心类型（`src/lib/types.ts`）

```typescript
type NodeExecutionMode = "ai_auto" | "human_confirm" | "human_manual";
type NodeExecutionType = "deterministic" | "intelligent";
type NodeFeasibility = "confirmed" | "partial" | "infeasible" | "pending";

interface FlowNodeData {
  label: string;
  icon: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  executionMode: NodeExecutionMode;
  estimatedTime: string;
  inputs: FlowNodeInput[];
  outputs: FlowNodeOutput[];
  errorHandling: ErrorHandling[];
  techConfig: TechConfig;
  isCondition?: boolean;
  conditionBranches?: { label: string; icon: string; targetLabel: string }[];
}

type ProjectStatus =
  | "draft"
  | "business_editing"
  | "pending_review"
  | "tech_reviewing"
  | "needs_revision"
  | "confirmed";
```

### 8.3 Agentic 核心类型（`src/lib/types.ts`）

```typescript
interface AgenticSkill {
  id: string;
  name: string;
  description: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  evaluator?: string;
}

type AgenticConstraintType = "budget" | "time" | "quality" | "compliance" | "custom";

interface AgenticConstraint {
  id: string;
  type: AgenticConstraintType;
  description: string;
  value?: string;
}

interface AgenticEvaluatorMetric {
  name: string;
  threshold: string;
  weight: number;  // 0.0 - 1.0
}

interface AgenticEvaluator {
  id: string;
  name: string;
  description: string;
  metrics: AgenticEvaluatorMetric[];
}

type AgenticExecutionStrategy = "sequential" | "parallel" | "adaptive";

interface AgenticTaskConfig {
  goal: string;
  background: string;
  constraints: AgenticConstraint[];
  skills: AgenticSkill[];
  evaluators: AgenticEvaluator[];
  executionStrategy: AgenticExecutionStrategy;
  maxIterations: number;
  humanCheckpoints: string[];
}

interface AgenticConfirmItem {
  id: string;
  section: "goal" | "skills" | "constraints" | "evaluators";
  question: string;
  context: string;
  options?: string[];
}
```

### 8.4 管控后台类型（`src/lib/types.ts`）

```typescript
type AgentStatus = "running" | "draft" | "error" | "paused";
type ConsoleTaskStatus = "queued" | "running" | "pending_confirm" | "completed" | "error";
type TaskEventType = "node_start" | "node_complete" | "node_error" | "human_confirm" | "system";

interface ConsoleAgent {
  id: string;
  name: string;
  icon: string;
  sceneId: string;
  sceneName: string;
  taskType: TaskType;           // "workflow" | "agentic"
  status: AgentStatus;
  successRate: number;
  taskCount: number;
  avgDuration: string;
  version: string;
  department: string;
  lastActiveAt: string;
  description: string;
}

interface ConsoleTask {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  currentNode: string;
  progress: number;             // 0-100
  status: ConsoleTaskStatus;
  startedAt: string;
  completedAt?: string;
  duration: string;
  priority?: "normal" | "high" | "urgent";
  description: string;
}

interface TaskEvent {
  id: string;
  taskId: string;
  nodeId?: string;
  nodeName?: string;
  type: TaskEventType;
  content: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
```

### 8.5 技能市场类型（`src/lib/mock-console.ts`）

```typescript
interface MarketSkill {
  id: string;
  name: string;
  description: string;
  category: "general" | "industry" | "custom";
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  evaluator?: string;
  callCount: number;
  avgDuration: string;
  status: "available" | "beta" | "deprecated";
}
```

### 8.6 Store 类型（`src/lib/store.ts`）

```typescript
type ChatPhase =
  | "idle"
  | "classifying"
  | "drafting"
  | "questioning"
  | "refining_node"
  | "ready"
  | "refining"
  | "drafting_agentic"
  | "confirming_agentic"
  | "agentic_ready"
  | "refining_agentic";

interface NodeConfidence {
  nodeId: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  questions: NodeQuestion[];
}

interface NodeQuestion {
  id: string;
  question: string;
  context: string;
  defaultSuggestion: string;
  options?: string[];
}
```

---

## 九、关键模块逻辑

### 9.1 flow-parser.ts

**`parseLLMResponse(data)`**：
1. 从 LLM 返回的节点列表提取 ID 集合
2. 调用 `computeDAGLayout` 进行拓扑排序 + 分层布局（忽略 loop 边）
3. 每个节点映射为 React Flow 的 `Node<FlowNodeData>`，自动补充默认的 errorHandling 和 techConfig
4. 过滤无效边（source/target 不存在的），用 uuid 生成边 ID

**`serializeFlowForLLM(nodes, edges)`**：
1. 将画布当前状态序列化为两种格式：
   - `json`：与 LLM 输出格式一致的结构化 JSON（用于 API 请求）
   - `readable`：Markdown 格式的人类可读描述（含并行起点、汇聚节点标注）

**`computeDAGLayout(nodeIds, edges)`**：
1. 构建有向无环图（忽略 loop 边）
2. Kahn 算法拓扑排序，按最长路径分层
3. 层内按父节点 x 坐标重心排序（减少交叉）
4. 未参与拓扑的节点放到最后一层

### 9.2 AgenticConfigPanel 编辑能力

**GoalTab**：
- 目标和背景支持内联编辑（Textarea + 保存/取消）
- 执行策略可点击循环切换（sequential → parallel → adaptive）
- 显示人工确认节点列表和最大迭代次数

**SkillsTab**：
- 技能市场集成：从 8 个预设技能中搜索和添加
- 自定义技能：添加空白技能模板
- 删除已有技能
- 每个技能展示输入/输出类型和评估标准

**ConstraintsTab**：
- 新增约束：选择类型（预算/时间/质量/合规/自定义）+ 描述 + 具体标准
- 删除已有约束
- 每个约束展示类型图标和标签

**EvaluatorsTab**：
- 新增评估器：名称 + 说明 + 多个指标（名称/阈值/权重）
- 编辑已有评估器：内联编辑表单
- 删除评估器
- 指标权重可视化（进度条）

### 9.3 协作流程（ProjectStatus 状态机）

```
draft → business_editing → tech_reviewing → confirmed
                                ↓
                          needs_revision
                                ↓
                          business_editing（重新编辑）
                                ↓
                          tech_reviewing（重新提交）
```

- **业务方**可以：编辑流程图、提交技术评审、重新提交
- **技术方**可以：评审通过、打回修改、添加批注
- 角色切换通过 TopBar 的角色按钮实现，切换后视图模式同步变化

### 9.4 FlowCanvas 双向同步

- React Flow 使用 `useNodesState` / `useEdgesState` 管理内部状态
- Zustand store 的 nodes/edges 变化时，通过 `useEffect` 同步到 React Flow
- 用户在画布上的拖拽/结构变更，通过 `handleNodesChange` 回写到 store（仅在结构变更或拖拽结束时）

### 9.5 管控后台交互逻辑

**任务详情页人工确认**：
- `pending_confirm` 状态时显示"确认通过"和"驳回"按钮
- 驳回需填写原因（Textarea 表单），提交后显示结果 Banner
- 确认通过后显示"已确认通过，任务将继续执行"

**任务详情页异常处理**：
- `error` 状态时显示"异常处理"下拉菜单
- 三种处理方式：重试（从当前节点重新执行）、人工接管（通知相关人员）、跳过（跳过当前节点继续）
- 操作后显示结果 Banner

**执行时间线**：
- 按时间顺序展示 `TaskEvent` 列表
- 事件类型用不同图标和颜色区分：
  - `node_start`：蓝色 Play 图标
  - `node_complete`：绿色 CheckCircle 图标
  - `node_error`：红色 XCircle 图标
  - `human_confirm`：琥珀色 UserCheck 图标
  - `system`：灰色 Settings 图标

---

## 十、技能市场

技能市场为 Agentic 任务配置提供预设的原子能力选择。当前为 Mock 数据，包含 8 个技能：

| 技能 | 分类 | 调用次数 | 均耗时 |
|------|------|---------|--------|
| 网页数据采集 | 通用 | 12,840 | 30秒 |
| 文本内容生成 | 通用 | 28,350 | 15秒 |
| 图片生成 | 通用 | 9,420 | 25秒 |
| 数据分析报告 | 通用 | 5,670 | 45秒 |
| 小红书内容发布 | 行业 | 3,210 | 10秒 |
| 竞品数据监控 | 行业 | 1,890 | 2分钟 |
| 合规审查 | 行业 | 7,650 | 5秒 |
| PDF 解析 | 通用 | 4,320 | 20秒 |

集成方式：AgenticConfigPanel → SkillsTab → "技能市场"按钮 → 搜索 + 点击添加。

---

## 十一、Mock 数据

### 管控后台 Mock（`src/lib/mock-console.ts`）

**MOCK_AGENTS**（5 个）：

| Agent | 类型 | 状态 | 部门 |
|-------|------|------|------|
| 报关 Agent | workflow | 运行中 | 外贸部 |
| 合同审核 Agent | workflow | 运行中 | 法务部 |
| 竞品分析 Agent | agentic | 运行中 | 产品部 |
| 财务报销 Agent | workflow | 运行中 | 财务部 |
| 小红书运营 Agent | agentic | 草稿 | 市场部 |

**MOCK_TASKS**（8 个）：覆盖全部 5 种状态（queued/running/pending_confirm/completed/error）

**MOCK_TASK_EVENTS**：为 T-2849（报关）和 T-2848（合同审核）提供了完整的执行时间线事件

**CONSOLE_STATS**：`{ activeAgents: 4, monthlyTasks: 517, successRate: 96.2, pendingItems: 3 }`

---

## 十二、文件清单

```
src/
├── app/
│   ├── layout.tsx                    # 根布局
│   ├── page.tsx                      # 首页（Workflow + Agentic 示例）
│   ├── globals.css                   # 全局样式
│   ├── editor/
│   │   └── page.tsx                  # 编辑器页（根据 taskType 条件渲染）
│   ├── api/
│   │   └── generate-flow/
│   │       └── route.ts              # LLM API（6 种 action）
│   └── console/                      # 管控后台（新增）
│       ├── layout.tsx                # 管控后台布局（侧边栏 + 主区域）
│       ├── page.tsx                  # 仪表盘
│       ├── agents/
│       │   └── page.tsx              # Agent 团队
│       └── tasks/
│           ├── page.tsx              # 任务监控（筛选表格）
│           └── [id]/
│               └── page.tsx          # 任务详情（时间线 + 人工介入）
├── components/
│   ├── layout/
│   │   └── TopBar.tsx                # 顶栏
│   ├── flow/
│   │   ├── FlowCanvas.tsx            # 画布
│   │   ├── FlowCardNode.tsx          # 自定义节点
│   │   ├── CanvasToolbar.tsx          # 画布工具条
│   │   └── NodeEditDialog.tsx         # 节点编辑弹窗
│   ├── panels/
│   │   ├── ChatPanel.tsx             # 对话面板（分类 + Workflow/Agentic 双流程）
│   │   ├── QuestionCard.tsx          # Workflow 节点确认卡片
│   │   ├── AgenticConfirmCard.tsx    # Agentic 模块确认卡片（新增）
│   │   ├── AgenticConfigPanel.tsx    # Agentic 配置面板（新增，4 Tab + 部署）
│   │   ├── NodeDetailPanel.tsx       # 节点详情面板
│   │   ├── AnnotationPanel.tsx       # 批注面板
│   │   └── KnowledgePanel.tsx        # 知识中心面板
│   └── ui/                           # Radix + Tailwind 基础组件
│       ├── button.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── dialog.tsx
│       ├── tabs.tsx
│       ├── scroll-area.tsx
│       └── badge.tsx
└── lib/
    ├── store.ts                      # Zustand 全局状态（含 Agentic 状态 + v2 迁移）
    ├── types.ts                      # TypeScript 类型定义（Workflow + Agentic + Console）
    ├── flow-parser.ts                # LLM 响应解析 + 画布序列化
    ├── mock-data.ts                  # Workflow Mock 数据
    ├── mock-console.ts               # 管控后台 Mock 数据 + 技能市场数据（新增）
    └── utils.ts                      # 工具函数（cn）
```
