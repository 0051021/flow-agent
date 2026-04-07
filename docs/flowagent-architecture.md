# FlowAgent 平台架构与逻辑文档

> 最后更新：2026-04-03（v6）

## 一、产品定位

### 1.0 设计哲学

FlowAgent 的所有架构决策遵循以下原则（详见 `flowagent-product.md` 第二章）：

1. **增强而非替代**：AI 增强人的能力，不替代人的判断。产品本身如此，生成的方案也如此
2. **方案必须体现人机分工**：每个方案明确标注 Agent 步骤和人工确认节点
3. **以工作流步骤为协作单元**：节点级批注、节点级确认、节点级人工介入
4. **输出是方案蓝图，不是可运行成品**：技术方参考蓝图搭建，而非一键部署
5. **产品即知识容器**：每次使用都在沉淀企业私有的结构化业务知识，这是产品壁垒

### 1.0.1 当前阶段：技术方工具

当前处于阶段一（详见 `flowagent-product.md` 第 1.2 节），核心用户是**技术方**。业务方口述需求 → 技术方在 FlowAgent 上生成并修正方案 → 确认后参考蓝图搭建。确认后的方案自动沉淀为知识容器的一部分。

FlowAgent 平台包含两个核心产品：

### 1.1 FlowAgent — 业务翻译工具 + 知识容器

将业务人员的自然语言描述转化为结构化的方案蓝图。支持三种任务类型：

- **Workflow（工作流）**：类似 COT（思维链），有明确步骤顺序的确定性流程，追求每步准确。输出为可视化流程图
- **Agentic（智能体）**：类似 ReAct，目标导向的智能规划任务，追求目标达成。输出为 Agent 任务配置（目标/技能/约束/评估器）
- **混合型（Hybrid）**：Workflow 中部分节点为 Agentic 节点，共享整个任务执行上下文。分类已支持识别，前端暂降级为 workflow 渲染

技术方通过 FlowAgent 生成并修正方案，确认后参考蓝图在 Dify/LangGraph 等平台搭建。同时，每次确认都在沉淀知识（见 `flowagent-product.md` 第五章）。

### 1.2 角色体系

平台区分两种角色，通过不同入口 URL 进入：

| 角色 | 入口 | 职责 | 可操作 |
|------|------|------|--------|
| **业务方** | `/`（首页） | 描述需求、编辑方案、提交评审 | 编辑流程图/配置、提交至管控后台、提交技术评审 |
| **技术方** | `/tech` | 评审方案可行性、添加批注、确认后参考蓝图搭建 | 查看方案、添加批注/回复、评审通过/打回修改 |

角色切换方式：
- 首页 header 有「技术方入口」链接
- `/tech` 页 header 有「业务方入口」链接
- 编辑器 TopBar 角色标签旁有切换链接，点击跳转到对方落地页

### 1.3 管控后台（SaaS）

关注已部署 Agent 的运行状态，提供：

- 运营仪表盘（活跃 Agent 数、任务量、成功率、待处理项）
- Agent 团队管理（查看所有已部署 Agent 的状态和指标）
- 任务监控（实时任务列表、状态筛选、执行详情）
- 人工介入（确认通过/驳回/异常处理）
- 异常归因标注（技术方标注失败原因分类：搭建质量/链路设计/环境问题）

### 1.4 整体关系

```
业务方 (/)                          技术方 (/tech)
    │                                    │
    ▼                                    ▼
描述需求                             评审列表（Mock数据直接加载）
    │                                    │
    ├── [需求模糊] AI追问2-3个关键问题    │
    │                                    │
    ▼                                    │
AI翻译（参考已确认历史方案）            │
    │                                    │
    ├── Workflow → 流程图（含人工确认节点）│
    ├── Agentic → Agent配置             │
    └── 混合型 → 流程图+Agentic节点     │
    │                                    │
    ▼                                    ▼
编辑器 (/editor)  ←── 角色切换 ──→  编辑器 (/editor?role=tech)
    │                                    │
    ▼                                    ▼
"确认方案"（v4 diff摘要）           "评审通过" / "打回修改"
（confirmed + 知识沉淀）             （添加批注 + 归因标注）
    │                                    │
    │                                    ▼
    │                              技术方参考蓝图在Dify/LangGraph搭建
    │                                    │
    ▼                                    ▼
管控后台 (/console) 监控运行状态 + 人工介入
    │
    ▼
确认方案自动沉淀 → 知识库（下次翻译参考）
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
| `/` | `src/app/page.tsx` | 业务方首页：输入框 + 示例场景卡片，header 含技术方入口和管控后台链接 |
| `/tech` | `src/app/tech/page.tsx` | 技术方落地页：评审列表（4 个 Mock 场景）+ 统计卡片，链接到 `/editor?reviewId=xxx&role=tech` |
| `/editor` | `src/app/editor/page.tsx` | 主工作台：支持 `?q=`（AI 生成）和 `?reviewId=`（Mock 直接加载）两种模式 |
| `POST /api/generate-flow` | `src/app/api/generate-flow/route.ts` | LLM API：8 种 action（原 6 种 + v3 新增 unified_draft / refine_batch） |

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

### 4.1 编辑器加载模式

编辑器支持两种加载路径：

**路径 A：AI 生成（`?q=描述内容`）**
- 业务方从首页输入描述后跳转
- 触发 AI 分类 → 生成流程图/Agentic 配置

**路径 B：Mock 直接加载（`?reviewId=review-1&role=tech`）**
- 技术方从 `/tech` 评审列表点击
- 从 `mock-reviews.ts` 直接加载完整的流程图/Agentic 配置 + 聊天记录
- 不触发任何 AI API 调用
- 自动设置 `isReviewMode = true`，聊天框发消息只返回提示，不调 AI

### 4.2 FlowAgent AI 生成流程（路径 A）— v3 优化后

> v3 将 classify+draft 合并为一次 `unified_draft` 调用，将逐节点 refine_node 合并为一次 `refine_batch` 调用。

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
triggerUnifiedDraft(prompt)                ← v3: 一次调用完成分类+生成
    ├── chatPhase → "classifying"
    ├── POST /api/generate-flow { action: "unified_draft", prompt }
    │        │
    │        ▼
    │   LLM 返回 { taskType, classifyReason, flow?, agenticConfig?, nodeConfidence? }
    │
    └── 根据 taskType 分流
         │
         ├── taskType === "workflow" | "hybrid"
         │        │
         │        ▼
         │   handleWorkflowResult(result)
         │        ├── parseLLMResponse → { nodes, edges }
         │        ├── loadGeneratedFlow
         │        └── 判断是否有需确认节点 (nodeConfidence)
         │             ├── 有 → "questioning" → 分页展示所有待确认节点
         │             │        用户逐页确认 → 答案暂存 collectedAnswers
         │             │        全部完成后 → handleBatchSubmit()
         │             │            ├── POST { action: "refine_batch", nodeAnswers }
         │             │            └── 一次性优化所有节点 → "ready"
         │             └── 无 → "ready"
         │
         └── taskType === "agentic"
                  │
                  ▼
             handleAgenticResult(result)
                  ├── chatPhase → "drafting_agentic"
                  ├── POST { action: "draft_agentic", prompt }
                  ├── setAgenticConfig / setAgenticConfirmItems
                  │
                  └── 判断是否有 confirmItems
                       ├── 有 → "confirming_agentic" → 逐模块确认
                       └── 无 → "agentic_ready"
```

**v3 前后对比（4 个待确认节点场景）**：

| | 旧版 | v3 |
|---|---|---|
| 分类+生成 | classify(1次) → draft(1次) = 2次调用 | unified_draft(1次) |
| 节点确认 | 每确认一个 → refine_node(1次) × 4 = 4次调用 | 全部收集完 → refine_batch(1次) |
| **总计** | **6 次 LLM 调用** | **2 次 LLM 调用** |

### 4.3 Agentic 确认流程

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

### 4.4 提交至管控后台

```
FlowAgent (agentic_ready)
    │
    ▼
AgenticConfigPanel → "提交至管控后台" 按钮（仅业务方可见）
    │
    ├── 模拟提交（1.5s loading）
    ├── 生成结构化配置 JSON 摘要（可复制）
    ├── 项目状态变为 "tech_reviewing"
    └── "前往管控后台查看" → 跳转 /console/agents

注：技术方视角下不显示提交按钮，改为评审引导文案
```

### 4.5 管控后台数据流

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

| 状态 | 含义 | 用户可操作 | v3 变化 |
|------|------|-----------|---------|
| `idle` | 初始状态，无任务 | 输入业务描述 | — |
| `classifying` | AI 正在分类+生成（unified_draft） | 等待 | 现在同时完成分类和生成 |
| `drafting` | 正在生成 Workflow 草稿 | 等待 | 保留兼容，unified_draft 下不经过 |
| `questioning` | 分页展示所有待确认节点 | 确认/跳过/翻页/全部提交 | 改为批量收集，不再逐个调 API |
| `refining_node` | 正在根据批量确认结果优化 | 等待 | 改为一次 refine_batch 调用 |
| `ready` | Workflow 流程图已就绪 | 自由对话修改、画布编辑 | — |
| `refining` | 正在根据自由对话修改 Workflow | 等待 | — |
| `drafting_agentic` | 正在生成 Agentic 任务配置 | 等待 | — |
| `confirming_agentic` | Agentic 逐模块确认阶段 | 确认/跳过/跳过全部 | — |
| `agentic_ready` | Agentic 配置已就绪 | 自由对话修改、编辑配置、部署 | — |
| `refining_agentic` | 正在根据反馈修改 Agentic 配置 | 等待 | — |

### 5.3 持久化恢复策略

页面刷新时，如果 `chatPhase` 处于不稳定态（`drafting` / `refining_node` / `refining` / `classifying` / `drafting_agentic` / `refining_agentic` / `confirming_agentic`），`onRehydrateStorage` 会自动恢复：

- 已有 `agenticConfig` → `agentic_ready`
- 有未完成的待确认节点 → `questioning`
- 已有流程图节点 → `ready`
- 否则 → `idle`

同时清空 `agenticConfirmItems`、`agenticConfirmIdx` 和 `collectedAnswers`，防止中间态数据残留导致 UI 卡死。

注意：`annotations` 不再 persist 到 localStorage（v3 修复批注泄露问题）。

---

## 六、API 设计

### `POST /api/generate-flow`

**通用请求字段**：

```typescript
{
  prompt?: string;           // 原始业务描述
  action: "classify" | "draft" | "draft_agentic" | "refine_node" | "refine" | "refine_agentic"
        | "unified_draft" | "refine_batch";  // v3 新增
  currentFlow?: object;      // 当前画布序列化后的 JSON（Workflow）
  currentConfig?: object;    // 当前 Agentic 配置 JSON
  feedback?: string;         // 修改意见
  nodeId?: string;           // 目标节点 ID
  nodeLabel?: string;        // 目标节点标签
  answers?: { question: string; answer: string }[];  // 节点确认回答
  nodeAnswers?: { nodeId: string; nodeLabel: string; answers: { question: string; answer: string }[] }[];  // 批量确认（v3）
}
```

### Action 一览

#### 旧版（保留兼容，前端已不主动调用 classify/draft/refine_node）

| Action | 触发时机 | 输入 | 输出 |
|--------|---------|------|------|
| `classify` | 用户首次输入 | `prompt` | `{ taskType, reason, confidence }` |
| `draft` | Workflow 首次生成 | `prompt` | `{ flow, nodeConfidence[] }` |
| `draft_agentic` | Agentic 首次生成 | `prompt` | `{ config, projectName, confirmItems }` |
| `refine_node` | Workflow 单节点确认后 | `currentFlow` + `nodeId` + `answers` | 完整流程图 JSON |
| `refine` | Workflow 自由对话修改 | `currentFlow` + `feedback` | 完整流程图 JSON |
| `refine_agentic` | Agentic 自由对话修改 | `currentConfig` + `feedback` | `{ config, projectName }` |

#### v3 新增（合并调用，减少 LLM round-trip）

| Action | 触发时机 | 输入 | 输出 | 说明 |
|--------|---------|------|------|------|
| `unified_draft` | 用户首次输入 | `prompt` | `{ taskType, classifyReason, flow?, agenticConfig?, nodeConfidence? }` | 合并 classify+draft 为一次 LLM 调用 |
| `refine_batch` | 所有节点确认收集完毕后 | `currentFlow` + `nodeAnswers[]` | 完整流程图 JSON | 合并多个 refine_node 为一次 LLM 调用 |

**性能对比**：

| 场景（4 个需确认节点） | 旧版 LLM 调用次数 | v3 LLM 调用次数 | 节省 |
|----------------------|-------------------|----------------|------|
| 完整流程（分类→生成→逐个确认） | 2 + 4 = 6 次 | 1 + 1 = 2 次 | ~13 秒 |

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
    ├── TopBar                          # 顶栏：导航、项目状态、角色标签+切换、面板切换、确认方案（v4）+ diff 摘要弹窗
    │
    ├── ChatPanel                       # 左侧对话面板（340px）
    │   ├── 消息列表 (renderMessage)
    │   ├── NodeQuestionPage            # Workflow 分页确认（v3 重构，每页 ≤3 节点，批量提交）
    │   │   └── SingleNodeBlock         # 单个节点问题块（v4 新增"暂缓"按钮）
    │   ├── AgenticConfirmCard          # Agentic 逐模块确认卡片
    │   ├── CompletionCard              # 确认完成提示
    │   └── 输入区域
    │
    ├── 中间/右侧区域 (flex-1)          # 根据 taskType 条件渲染
    │   │
    │   ├── [taskType === "workflow"]
    │   │   ├── FlowCanvas              # React Flow 画布
    │   │   │   ├── CanvasToolbar       # 悬浮工具条（加/复制/删节点）
    │   │   │   └── FlowCardNode        # 自定义节点（v4 新增 confidence 黄/红点 + 暂缓"待确认"标签）
    │   │   └── NodeDetailPanel         # 选中节点时的底部详情面板
    │   │
    │   └── [taskType === "agentic"]
    │       └── AgenticConfigPanel      # Agentic 配置面板（新增）
    │           ├── GoalTab             # 目标与背景（可编辑 + 执行策略切换）
    │           ├── SkillsTab           # 技能配置（技能市场 + 自定义 + 删除）
    │           ├── ConstraintsTab      # 约束条件（新增 + 删除）
    │           ├── EvaluatorsTab       # 评估体系（完整 CRUD + 指标编辑）
    │           └── SubmitFooter         # 提交至管控后台（业务方）/ 评审提示（技术方）
    │
    ├── AnnotationPanel                 # 批注面板（与知识面板互斥）
    │   ├── Workflow 模式：按 selectedNodeId 过滤批注
    │   └── Agentic 模式：全局批注（nodeId = "__global__"）
    ├── KnowledgePanel                  # 知识面板（与批注面板互斥）
    │   ├── 业务方：仅显示"业务文档" tab
    │   └── 技术方：显示"业务文档" + "技术参考"双 tab
    └── NodeEditDialog                  # 全屏模态节点编辑器（仅 Workflow）
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
type TaskType = "workflow" | "agentic" | "hybrid";  // hybrid 为规划中
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
  | "classifying"       // v3: 现在同时完成分类+生成（unified_draft）
  | "drafting"          // 保留兼容
  | "questioning"       // v3: 改为分页展示，答案暂存 collectedAnswers
  | "refining_node"     // v3: 改为一次 refine_batch 调用
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

// v3: 批量收集节点确认答案（key 为 nodeId）
collectedAnswers: Record<string, { question: string; answer: string }[]>;

// v4 新增
initialSnapshot: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null;  // AI 初始版本快照，confirm 时 diff
allNodeConfidence: NodeConfidence[];  // 完整 confidence 数据，供 FlowCardNode 展示
deferredNodeIds: string[];            // 暂缓确认的节点 ID 列表
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
draft → business_editing → confirmed          ← 阶段一：技术方直接确认
                         → tech_reviewing → confirmed   ← 阶段二：提交评审后确认
                                ↓
                          needs_revision
                                ↓
                          business_editing（重新编辑）
                                ↓
                          tech_reviewing（重新提交）
```

- **阶段一**：技术方生成方案后直接"确认方案"（business_editing → confirmed），不经过 tech_reviewing
- **阶段二**：业务方提交后技术方评审（business_editing → tech_reviewing → confirmed）
- 角色通过 URL 参数（`?role=tech`）确定，TopBar 显示当前角色标签 + 切换链接
- 面板互斥：知识面板和批注面板同时只能打开一个
- Mock 评审模式（`?reviewId=`）下聊天框不触发 AI，仅返回提示

### 9.3.1 确认方案流程（v4 新增）

```
技术方在编辑器中修改方案至满意
    │
    ▼
TopBar "确认方案" 按钮（Workflow ready 状态下显示）
    │
    ▼
弹出确认摘要弹窗
    ├── 方案名称 / 类型 / 节点数
    ├── 人机分工统计（AI 自动 vs 人工确认）
    ├── 暂缓节点数量提醒
    └── diff 列表：最终版 vs AI 初始版（initialSnapshot）
         ├── executionMode 变更
         ├── 描述变更
         ├── 预估耗时变更
         └── 节点新增/删除
    │
    ▼
技术方点击「确认」→ projectStatus = "confirmed"
    │
    ▼
[Phase 2] diff 数据作为"关键决策"沉淀到知识库
```

### 9.3.2 反问"暂缓"机制（v4 新增）

```
AI 生成方案 + 反问问题
    │
    ▼
NodeQuestionPage 展示分页问题卡片
    │
    ├── 回答 → 答案存入 collected
    ├── 跳过 → 用 AI 默认建议
    └── 暂缓 → nodeId 加入 deferredNodeIds
                └── 该节点从 pendingNodes 移除
                └── 流程图上显示橙色"待确认"标签
                └── 方案用默认值，但标记为待补充
    │
    ▼
所有节点处理完 → refine_batch 或直接进 ready
    │
    ▼
下次打开方案时，暂缓的节点仍显示"待确认"
```

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

**CONSOLE_STATS**：`{ activeAgents: 4, monthlyTasks: 517, successRate: 96.2, pendingItems: 4 }`（首页管控后台卡片引用此数据源）

### 技术方评审 Mock（`src/lib/mock-reviews.ts`）

4 个完整的评审场景，技术方从 `/tech` 点击后直接加载，不触发 AI：

| ID | 场景 | 类型 | 状态 | 内容 |
|----|------|------|------|------|
| review-1 | 小红书账号运营 | Agentic | pending | 完整 AgenticTaskConfig（6 技能、4 约束、3 评估器） |
| review-2 | 进出口报关流程 | Workflow | pending | 6 节点流程图 + 5 条边 |
| review-3 | 财务报销审批 | Workflow | reviewed | 5 节点流程图 + 4 条边（含条件分支） |
| review-4 | 竞品分析报告 | Agentic | confirmed | 完整 AgenticTaskConfig（4 技能、3 约束、1 评估器） |

每个场景包含：完整的流程图/配置数据 + 模拟聊天记录 + 项目名称。

### 批注 Mock（`src/lib/mock-data.ts`）

3 条技术方批注（MOCK_ANNOTATIONS），在 `tech_reviewing` 状态时自动加载：
- Workflow 模式：按 nodeId 绑定到对应节点
- Agentic 模式：nodeId 自动转为 `__global__`，以全局批注形式展示

### 知识面板 Mock

- **业务文档**（MOCK_KNOWLEDGE_FILES）：6 个业务相关文件
- **技术参考**（MOCK_TECH_FILES）：4 个技术文档（系统架构、API 清单、Skill 能力清单、技术约束）

---

## 十二、文件清单

```
src/
├── app/
│   ├── layout.tsx                    # 根布局
│   ├── page.tsx                      # 业务方首页（含技术方入口 + 管控后台链接）
│   ├── globals.css                   # 全局样式
│   ├── tech/
│   │   └── page.tsx                  # 技术方落地页（评审列表 + 统计卡片）
│   ├── editor/
│   │   └── page.tsx                  # 编辑器（支持 ?q= AI生成 和 ?reviewId= Mock加载）
│   ├── api/
│   │   └── generate-flow/
│   │       └── route.ts              # LLM API（8 种 action，含 v3 unified_draft / refine_batch）
│   └── console/
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
│   │   └── TopBar.tsx                # 顶栏（角色标签+切换、面板互斥切换、评审操作）
│   ├── flow/
│   │   ├── FlowCanvas.tsx            # 画布
│   │   ├── FlowCardNode.tsx          # 自定义节点
│   │   ├── CanvasToolbar.tsx          # 画布工具条
│   │   └── NodeEditDialog.tsx         # 节点编辑弹窗
│   ├── panels/
│   │   ├── ChatPanel.tsx             # 对话面板（unified_draft + refine_batch + 评审模式拦截）
│   │   ├── QuestionCard.tsx          # Workflow 分页确认（NodeQuestionPage + SingleNodeBlock）
│   │   ├── AgenticConfirmCard.tsx    # Agentic 模块确认卡片
│   │   ├── AgenticConfigPanel.tsx    # Agentic 配置面板（4 Tab + 提交/配置JSON预览）
│   │   ├── NodeDetailPanel.tsx       # 节点详情面板
│   │   ├── AnnotationPanel.tsx       # 批注面板（支持全局批注模式）
│   │   └── KnowledgePanel.tsx        # 知识面板（业务方/技术方双 tab）
│   └── ui/                           # Radix + Tailwind 基础组件
│       ├── button.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── dialog.tsx
│       ├── tabs.tsx
│       ├── scroll-area.tsx
│       └── badge.tsx
└── lib/
    ├── store.ts                      # Zustand 全局状态（含 collectedAnswers + isReviewMode + rehydrate 修复）
    ├── types.ts                      # TypeScript 类型定义（Workflow + Agentic + Console）
    ├── flow-parser.ts                # LLM 响应解析 + 画布序列化
    ├── mock-data.ts                  # Workflow Mock + 批注 Mock + 知识文件 Mock
    ├── mock-reviews.ts               # 技术方评审 Mock（4 个完整场景）
    ├── mock-console.ts               # 管控后台 Mock + 技能市场数据
    └── utils.ts                      # 工具函数（cn）
```

---

## 十三、规划中的架构扩展

> 以下内容基于论文研究和产品讨论，尚未实现，作为后续迭代的架构参考。

### 13.1 混合型任务架构（Hybrid Task）

**核心概念**：Workflow 流程图中的节点可以标记为"Agentic 节点"。Agentic 节点共享整个任务的执行上下文，而非作为独立的外部 Agent 调用。

**数据模型扩展**：

```typescript
// FlowNodeData 扩展
interface FlowNodeData {
  // ...现有字段...
  isAgenticNode?: boolean;           // 是否为 Agentic 节点
  agenticConfig?: {                  // Agentic 节点的精简配置
    goal: string;                    // 该节点的目标
    skills: AgenticSkill[];          // 可用技能
    constraints: AgenticConstraint[]; // 约束条件
  };
}
```

**UI 设计**：
- Agentic 节点在流程图中用紫色双层边框区分
- 点击展开后显示精简版配置（目标 + 可用 Skill + 约束）
- 评估器和业务背景是任务级别的，不需要每个 Agentic 节点重复配置

**执行模型**：
```
Workflow步骤1 (确定性) → 输出: data.json
  ↓ [上下文传递]
Agentic节点 (自主规划，能看到 data.json)
  - 可用 Skill: [分析, 生成, ...]
  - 约束: [预算, 时间, ...]
  - 输出: strategy.json
  ↓ [上下文传递]
Workflow步骤3 (确定性，能拿到 strategy.json)
```

### 13.2 引导式输入流程

**AI 分类阶段增加需求清晰度判断**：

```
用户输入
  ↓
POST /api/generate-flow { action: "classify", prompt }
  ↓
LLM 返回 { taskType, reason, confidence, clarityScore }
  ↓
clarityScore >= threshold?
  ├── YES → 直接进入 drafting（快思考）
  └── NO  → 进入追问模式（慢思考）
              ├── AI 生成 2-3 个关键问题
              ├── 用户回答
              └── 合并原始输入 + 回答 → 重新 classify / draft
```

**API 扩展**：

```typescript
// classify 返回增加字段
{
  taskType: "workflow" | "agentic" | "hybrid";
  reason: string;
  confidence: number;
  clarityScore: number;          // 0-1, 需求清晰度
  clarifyQuestions?: string[];   // clarityScore < threshold 时返回
}
```

### 13.3 方案人机分工标注

**AI 生成方案时自动标注人机分工**，需要修改 prompt 工程：

Workflow 节点的 `executionMode` 字段已有三种模式：
- `ai_auto`：Agent 自动执行
- `human_confirm`：Agent 执行后人工确认
- `human_manual`：纯人工执行

当前 AI 生成时较少主动使用 `human_confirm` 和 `human_manual`。需要在 prompt 中增加指令，让 AI 在以下场景主动设置人工确认/人工执行：

| 步骤特征 | 建议的 executionMode | 理由 |
|----------|---------------------|------|
| 数据采集/处理 | `ai_auto` | Agent 擅长 |
| 数据校验/质量检查 | `human_confirm` | 防止 Agent 捏造 |
| 策略/决策类 | `human_confirm` | 需要业务判断 |
| 内容创作 | `human_confirm` | 需要审美/品牌把控 |
| 视觉设计 | `human_manual` | Agent 在设计任务质量最差 |
| 对外发布/不可逆操作 | `human_confirm` | 不可回滚 |
| 格式转换/定时执行 | `ai_auto` | 纯确定性操作 |

### 13.4 知识容器架构（核心壁垒）

> 详见 `flowagent-product.md` 第五章。知识容器是产品从"工具"变为"平台"的关键。

**双层知识模型**（参考 CogTwin 的 DKR/DIKG 架构）：

```
┌─────────────────────────────────────────┐
│          静态知识层 (DKR)                │
│  行业模板 / 最佳实践 / API 文档 / SOP    │
│  来源: 人工录入 + SOP文档提取            │
│  更新: 低频，人工审核后入库               │
└───────────────────┬─────────────────────┘
                    │ AI 翻译时检索参考
                    ▼
         ┌──────────────────┐
         │   AI 翻译引擎     │ ← 用户新需求
         └──────────────────┘
                    │ 生成方案
                    ▼
         ┌──────────────────┐
         │ 技术方评审 + 确认  │
         └──────────────────┘
                    │ 确认后自动沉淀
                    ▼
┌─────────────────────────────────────────┐
│          动态知识层 (DIKG)               │
│  执行日志 / 评审批注 / 异常归因标注       │
│  来源: 系统自动采集 + 技术方标注          │
│  更新: 自动积累                          │
└─────────────────────────────────────────┘
```

**知识容器存储的五种数据**（详见 `flowagent-product.md` 第 5.2 节）：

| 数据类型 | 来源 | 用途 |
|----------|------|------|
| 已验证方案模板 | 技术方 confirmed 后自动提取 | AI 翻译时 few-shot 参考 |
| 人机分工规则 | 从多个方案中归纳（可带行业/企业标签） | 优化 AI 生成时的 executionMode 选择 |
| 企业特化约束 | 技术方手动配置或从评审批注中提取 | 限制 AI 生成范围（如"只用内部模型"） |
| 失败记录 | 系统自动采集 + 技术方归因标注 | 避免重复犯错 |
| 企业 Skill 库 | Skill 平台 API（见 13.6 节） | AI 翻译时匹配可用 Skill，提高方案可执行性 |

**已确认方案沉淀格式**：

```json
{
  "scenario": "进出口报关自动化",
  "type": "workflow",
  "skeleton": ["单证采集", "合规校验", "申报提交", "状态跟踪", "异常处理"],
  "key_decisions": [
    {
      "node": "合规校验",
      "decision": "用规则引擎而非AI判断，因为合规标准是确定性的",
      "executionMode": "ai_auto"
    },
    {
      "node": "异常处理",
      "decision": "设了人工确认节点，因为海关驳回原因复杂需要人判断",
      "executionMode": "human_confirm"
    }
  ],
  "confirmed_by": "tech_reviewer_id",
  "confirmed_at": "2026-04-01"
}
```

**知识检索流程（Phase 2 实现）**：

```
新需求输入
  ↓
向量化 / 关键词检索 → 匹配已确认方案
  ↓
取 Top-K 方案的 skeleton + key_decisions
  ↓
注入 unified_draft prompt 作为 few-shot 参考
  ↓
AI 生成时同时输出 "参考了哪个历史方案"
  ↓
技术方审核时可对比 "AI 生成 vs 历史参考"
```

### 13.5 待确认问题集（扩展批注系统）

> 详见 `flowagent-product.md` 第 1.1.3 节。待确认问题集不是新系统，而是批注系统的适用范围扩展。

**数据模型扩展**：

```typescript
interface Annotation {
  // ...现有字段...
  source: "tech_manual" | "ai_deferred" | "business_reply";  // 来源
  status: "open" | "resolved";                                // 状态（Phase 2）
  assignee?: "tech" | "business";                             // 指派（Phase 2）
  relatedDeferredNodeId?: string;                             // 关联的暂缓节点 ID
}
```

**阶段一组件设计**：

```
FlowCardNode（已有"待确认"标签）
    │
    ▼
AnnotationPanel（已有批注列表）
    ├── 来源标记：🤖 AI 暂缓 / 👤 技术方手动
    ├── 关联节点高亮
    └── "全部复制"按钮 → 复制所有 open 状态的批注文本
         └── 粘贴到飞书/钉钉发给业务方
```

**向阶段二的过渡**：

```
阶段一（纯前端）              阶段二（有后端）
批注存 localStorage    →    批注存数据库
"全部复制"手动发送     →    平台内通知 + 业务方可直接回复
无状态追踪            →    open/resolved 状态机
无指派                →    指派给业务方/技术方
```

**与暂缓机制的联动**：

```
AI 生成方案 + 反问
    │
    ├── 用户点击"暂缓"
    │     ├── nodeId → deferredNodeIds（已实现）
    │     ├── FlowCardNode 显示"待确认"标签（已实现）
    │     └── [新增] 自动创建一条 source="ai_deferred" 的批注
    │           └── 内容 = AI 的原始问题 + 默认建议
    │
    └── 技术方手动添加批注
          └── source="tech_manual"，正常批注流程
```

### 13.6 Skill 平台集成架构（独立产品）

> 详见 `flowagent-product.md` 第六章。Skill 平台是独立产品，此处仅记录 FlowAgent 侧的集成架构。

**FlowAgent 与 Skill 平台的集成接口**：

```
FlowAgent                              Skill 平台
    │                                      │
    ├── GET /skills/search                 │
    │   { query, enterprise_id,            │
    │     visibility: ["public",           │
    │       "community", "private"] }      │
    │   → 返回匹配的 Skill 列表            │
    │                                      │
    ├── GET /skills/{id}/schema            │
    │   → 返回 Skill 的完整 I/O schema     │
    │                                      │
    ├── POST /flows/try-run                │
    │   { flow_definition, test_data }     │
    │   → 返回试运行结果                    │
    │                                      │
    └── GET /skills/enterprise/{id}        │
        → 返回企业私有 Skill 列表           │
```

**Skill 可见性模型**：

```
┌─────────────────────────────────────────────┐
│              Skill 平台                      │
│                                             │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  平台通用     │  │  社区共享     │         │
│  │  (平台维护)   │  │  (企业上传)   │         │
│  │  免费         │  │  免费/付费    │         │
│  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                 │
│         └────────┬─────────┘                 │
│                  │ 公开可见                    │
│                  ▼                            │
│         ┌──────────────┐                     │
│         │  企业 A 视角  │                     │
│         │  可见范围:    │                     │
│         │  通用 + 社区  │                     │
│         │  + A 的私有   │                     │
│         └──────────────┘                     │
│                                             │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  企业 A 私有  │  │  企业 B 私有  │         │
│  │  (仅 A 可见)  │  │  (仅 B 可见)  │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

**AI 翻译时的 Skill 匹配流程（Phase 2+）**：

```
用户输入业务描述
    │
    ▼
unified_draft prompt 中注入可用 Skill 列表
    ├── 来源: Skill 平台 API（通用 + 社区 + 企业私有）
    ├── 格式: Skill 名称 + 描述 + I/O schema 摘要
    └── 数量: Top-K 相关 Skill（避免 prompt 过长）
    │
    ▼
AI 生成方案时为每个节点推荐匹配的 Skill
    ├── 有精确匹配 → 节点关联 Skill ID + 自动填充 I/O
    ├── 有近似匹配 → 节点标注"建议使用 XX Skill，需确认"
    └── 无匹配 → 节点标注"需要新建 Skill 或手动实现"
```

### 13.7 执行层架构（Phase 2）

**三层架构**：FlowAgent 做编排层，执行下沉到成熟引擎。

```
┌──────────────────────────────────┐
│        FlowAgent 编排层          │
│  方案蓝图 → 可执行 DAG 定义      │
│  人工确认节点 → 特殊节点类型      │
└──────────────────┬───────────────┘
                   │ DAG JSON
                   ▼
┌──────────────────────────────────┐
│       执行引擎 (Dify/LangGraph)  │
│  Workflow 节点: 按脚本执行        │
│  Agentic 节点: planning loop     │
│  人工确认节点: 暂停 → 回调通知   │
└──────────────────┬───────────────┘
                   │ 执行日志 + 状态回调
                   ▼
┌──────────────────────────────────┐
│       FlowAgent 管控后台         │
│  实时任务状态 / 人工介入 / 告警   │
│  异常归因标注 / 知识沉淀          │
└──────────────────────────────────┘
```

**Skill 标准化是自动化程度的关键变量**（Skill 平台详见 13.6 节和 `flowagent-product.md` 第六章）：

| Skill 标准化程度 | Workflow 自动化 | Agentic 自动化 |
|-----------------|----------------|---------------|
| 只有名字 | 技术方手动搭建 | 技术方手动搭建 |
| 有 API schema（输入/输出/错误处理） | FlowAgent 生成 Dify JSON → 技术方审核导入 | 仍需技术方配置 Agent 参数 |
| 完整标准化（含测试用例/版本管理） | 接近全自动 | 半自动（planning 部分仍需人工调优） |

### 13.8 SOP 文档提取（Phase 3）

```
用户上传 SOP 文档 (Word/PDF/飞书)
  ↓
AI 文档理解 + 结构化提取
  ↓
生成 Workflow 草稿（节点列表 + 步骤描述）
  ↓
用户在编辑器中确认和修改
  ↓
正常进入 AI 翻译 + 确认流程
```

比从零口述效率更高，因为企业往往已有 SOP 文档只是未结构化。
