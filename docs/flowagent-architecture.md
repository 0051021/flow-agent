# FlowAgent 平台架构与逻辑文档

> 最后更新：2026-04-20（v12）

## 一、产品定位

### 1.0 设计哲学

FlowAgent 的所有架构决策遵循以下原则（详见 `flowagent-product.md` 第二章）：

1. **增强而非替代**：AI 增强人的能力，不替代人的判断。产品本身如此，生成的方案也如此
2. **方案必须体现人机分工**：每个方案明确标注 Agent 步骤和人工确认节点
3. **以工作流步骤为协作单元**：节点级批注、节点级确认、节点级人工介入
4. **输出是方案蓝图，不是可运行成品**：技术方参考蓝图搭建，而非一键部署
5. **产品即知识容器**：每次使用都在沉淀企业私有的结构化业务知识，这是产品壁垒
6. **知识双形态**：知识按"控制密度"而非"文档完整性"设计——Human Doc 给人看，Model Gene（~200 token）给模型用
7. **Gene 优于 Skill 文档**：给模型注入的经验对象应是紧凑的策略+AVOID 控制片段，而非完整文档（来源：EvoMap/清华 Gene 研究 2026）

### 1.0.1 当前阶段：技术方工具

当前处于阶段一（详见 `flowagent-product.md` 第 1.2 节），核心用户是**技术方**。业务方口述需求 → 技术方在 FlowAgent 上生成并修正方案 → 确认后参考蓝图搭建。确认后的方案自动沉淀为知识容器的一部分。

FlowAgent 平台包含两个核心产品：

### 1.1 FlowAgent — 业务翻译工具 + 知识容器

将业务人员的自然语言描述转化为结构化的方案蓝图。支持两种任务类型，统一以可视化方案呈现：

- **Workflow（工作流）**：步骤明确的确定性流程，输出为详细流程图（节点 + 连线）
- **Agentic（智能体）**：目标导向的灵活规划任务，输出为**策略卡片**（目标 + 简化流程图 + 约束 + 成功标准），技术配置可展开查看

混合型不再是第三种类型，而是常态——大部分真实业务场景都是"部分步骤确定、部分步骤自主"，在流程图中用不同节点样式区分即可

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

> v12 重设计：管控后台根据 Workflow 和 Agentic 两种任务类型提供差异化的管控体验。

运行时的"治理控制塔 + 上帝视角"，提供：

**通用能力**：
- 运营总览（AI 助手数量、任务量、成功率、待处理事项）
- 事务中心（所有任务状态、进度、筛选）
- 异常处理（重试 / 人工接管 / 跳过）

**Workflow 专属**：
- 流程全景图（节点状态可视化）
- 三种确认类型：verify（AI 结果检查）、input（人工输入数据）、decision（人工判断）
- 三种审核视图：card（内嵌信息卡）、compare（双栏对比弹窗）、match（三栏匹配弹窗）
- 批量审核面板

**Agentic 专属**：
- 四 Tab 结构：总览（健康 + KPI）、分析（趋势 + 支出）、策略（参数 + AI 建议）、日志（错误 + 事件）
- 干预面板（高层主动改变运行时参数）
- 策略进化时间线

### 1.4 整体关系

```
业务方 (/)                          技术方 (/tech)
    │                                    │
    ▼                                    ▼
描述需求                             评审列表（Mock数据直接加载）
    │                                    │
    ├── [需求模糊] 澄清卡片(理解摘要+1-3个问题) │
    │                                    │
    ▼                                    │
AI翻译（参考已确认历史方案）            │
    │                                    │
    ├── Workflow → 详细流程图             │
    ├── Agentic → 策略卡片（含简化流程图）│
    └── 混合型 → 流程图+Agent自主节点    │
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

### 4.2 FlowAgent AI 生成流程（路径 A）— v6 设计

> v3 将 classify+draft 合并为一次 `unified_draft` 调用，将逐节点 refine_node 合并为一次 `refine_batch` 调用。
> v6 重设计反问机制：去掉强制反问卡片，改为标记提醒 + 按需查看。

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
[v6 新增] 引导式输入判断
    ├── 需求清晰 → 直接进入 unified_draft
    └── 需求模糊 → 弹出澄清卡片（AI 理解摘要 + 1-3 个问题）
                     ├── 用户补充 → 合并为增强 prompt → unified_draft
                     └── 用户跳过 → 用原始 prompt → unified_draft
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
         │        ├── loadGeneratedFlow + saveInitialSnapshot
         │        └── [v6] 直接进入 "ready"，不拦截
         │             ├── 不确定节点通过 confidence 黄/红点标记
         │             ├── ChatPanel 输出摘要提示（列出标记节点及原因）
         │             └── 用户按需：画布编辑 / 对话修改 / 点击标记节点查看 AI 疑问
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

**v6 vs v3 对比（Workflow 流程）**：

| 环节 | v3（当前实现） | v6（目标设计） |
|------|--------------|--------------|
| 生成前 | 无引导 | 澄清卡片（需求模糊时） |
| 生成后 | 强制反问卡片 → 必须回答/跳过 | 直接展示流程图 + 标记提醒 |
| 用户修正 | 先回答反问 → 再画布编辑 | 统一在画布/对话/节点面板中完成 |
| 确认方案 | diff 摘要 | diff 摘要 + 未处理标记检查 |

**v3 前后对比（4 个待确认节点场景）**：

| | 旧版 | v3 |
|---|---|---|
| 分类+生成 | classify(1次) → draft(1次) = 2次调用 | unified_draft(1次) |
| 节点确认 | 每确认一个 → refine_node(1次) × 4 = 4次调用 | 全部收集完 → refine_batch(1次) |
| **总计** | **6 次 LLM 调用** | **2 次 LLM 调用** |

### 4.3 Agentic 确认流程

> v9 重设计：Agentic 方案以策略卡片呈现，确认流程围绕卡片的四个区域进行。

```
drafting_agentic
    │
    ▼
AI 生成策略卡片（目标 + 简化流程图 + 约束 + 成功标准）
    │
    ▼
confirming_agentic
    │
    ▼
StrategyCard 展示完整策略卡片
    │
    ├── 用户逐区域审查
    │     ├── 目标：确认/编辑目标描述
    │     ├── 执行策略：确认/调整大步骤和人机分工
    │     ├── 约束：确认/增删约束条件
    │     └── 成功标准：确认/修改成功指标
    │
    ├── 整体确认 → agentic_ready
    │
    └── 展开技术配置（技术方）
          ├── 查看/编辑可用技能列表
          ├── 调整执行参数（迭代轮次、策略）
          └── 查看/编辑三层评估配置
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

> v12 更新：Workflow 和 Agentic 任务详情页完全差异化。

```
/console（运营总览）
    ├── 统计卡片：动态 AI 助手数 / 月任务量 / 成功率 / 待处理
    ├── 待处理事项：pending_confirm + error 任务列表
    ├── 最近任务：前 6 条任务
    └── AI 助手概览：运行中的 Agent 卡片

/console/agents（我的 AI 助手）
    └── 所有 Agent 卡片：状态/成功率/任务数/均耗时/版本/部门

/console/tasks（事务中心）
    ├── 筛选 Tab：全部/进行中/等你确认/已完成/异常
    ├── 任务表格：ID/Agent/当前节点/进度/状态/耗时
    └── 批量审核面板（"等你确认" Tab 下可批量处理 pending 任务）

/console/tasks/[id]（任务详情 — Workflow）
    ├── 流程全景图（FlowPanorama）：节点状态可视化
    ├── 人工确认区：
    │   ├── confirmType=verify → "没问题" / "不对，我来改" / "稍后再看"
    │   ├── confirmType=input → InputForm（人工填写数据）
    │   └── confirmType=decision → DecisionForm（从选项中决策）
    ├── 审核视图：
    │   ├── reviewLayout=card → 内嵌信息卡（默认）
    │   ├── reviewLayout=compare → CompareReviewDialog（双栏对比弹窗）
    │   └── reviewLayout=match → MatchReviewDialog（三栏匹配弹窗）
    ├── 异常处理区：重试 / 人工接管 / 跳过
    └── 执行时间线

/console/tasks/[id]（任务详情 — Agentic）
    └── AgenticTabs 组件（agentic-tabs.tsx）
        ├── 总览 Tab：健康指标 + KPI + 快捷操作 + 近期事件
        ├── 分析 Tab：目标达成 + 趋势 + 内容表现 + 支出 + 周报
        ├── 策略 Tab：参数调整 + 进化时间线 + AI 建议 + 自由指令
        ├── 日志 Tab：错误升级 + 事件筛选 + 时间线
        └── 干预面板（InterventionPanel）：改变运行时参数
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
| `drafting_agentic` | 正在生成 Agentic 策略卡片 | 等待 | — |
| `confirming_agentic` | 策略卡片审查阶段（逐区域确认） | 编辑目标/策略/约束/成功标准 | — |
| `agentic_ready` | 策略卡片已就绪 | 自由对话修改、展开技术配置、部署 | — |
| `refining_agentic` | 正在根据反馈修改策略卡片 | 等待 | — |

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
  currentConfig?: object;    // 当前 Agentic 策略卡片配置 JSON
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
| `draft_agentic` | Agentic 策略卡片生成 | `prompt` | `{ config, projectName, confirmItems }` |
| `refine_node` | Workflow 单节点确认后 | `currentFlow` + `nodeId` + `answers` | 完整流程图 JSON |
| `refine` | Workflow 自由对话修改 | `currentFlow` + `feedback` | 完整流程图 JSON |
| `refine_agentic` | 策略卡片自由对话修改 | `currentConfig` + `feedback` | `{ config, projectName }` |

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

> v9 重设计：新增 `strategySteps`（简化流程图数据）和三层评估体系。底层 config 结构保持兼容，策略卡片是其可视化表达。

```json
{
  "projectName": "项目名称",
  "config": {
    "goal": "业务目标（一句话）",
    "background": "业务背景（2-3句话）",
    "strategySteps": [{
      "id": "step-1",
      "name": "步骤名称",
      "description": "步骤描述",
      "executor": "ai | human | hybrid",
      "nextSteps": ["step-2"],
      "isLoop": false
    }],
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
      "toolEvaluator": {
        "checks": ["输出格式校验", "字段完整性", "数据质量"]
      }
    }],
    "stepEvaluators": [{
      "stepId": "step-1",
      "criteria": ["评估标准1", "评估标准2"],
      "source": "derived_from_constraints | custom"
    }],
    "goalEvaluators": [{
      "id": "ev-1",
      "name": "成功标准名称",
      "description": "评估说明",
      "metrics": [{ "name": "指标名", "threshold": "阈值", "weight": 0.0-1.0 }]
    }],
    "executionStrategy": "sequential | parallel | adaptive",
    "maxIterations": 5,
    "humanCheckpoints": ["人工确认节点描述"]
  },
  "confirmItems": [{
    "id": "confirm-1",
    "section": "goal | strategy | constraints | success_criteria",
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
    │   ├── StrategyCard                # Agentic 策略卡片（目标+流程图+约束+成功标准）
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
    │       └── StrategyCard            # 策略卡片（v9 重设计）
    │           ├── GoalSection         # 目标描述（内联编辑）
    │           ├── StrategyFlowSection # 简化流程图（大步骤 + 人机分工 + 循环）
    │           ├── ConstraintsSection  # 约束条件（增删编辑）
    │           ├── SuccessCriteriaSection # 成功标准（通俗指标，AI 转化为评估配置）
    │           ├── [展开技术配置]
    │           │   ├── SkillsConfig    # 可用技能（技能市场 + 工具级评估只读）
    │           │   ├── ExecutionConfig # 执行参数（策略/迭代/人工确认点）
    │           │   └── EvaluationConfig # 三层评估详细配置
    │           └── SubmitFooter        # 提交至管控后台（业务方）/ 评审提示（技术方）
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

> v12 更新：管控后台术语业务化，任务详情 Workflow/Agentic 完全分离。

```
ConsoleLayout
├── Sidebar                             # 固定左侧边栏（200px）
│   ├── Logo + 返回首页链接
│   ├── 动态问候（"早上好，N 个 AI 助手正在为你处理业务"）
│   └── 导航项
│       ├── 总览 (/console)
│       ├── AI 助手 (/console/agents)
│       └── 事务中心 (/console/tasks)
│
└── Main Content Area
    │
    ├── ConsoleDashboard (/console)
    │   ├── StatCard x4                 # 动态助手数/月任务量/成功率/待处理
    │   ├── 待处理事项列表              # pending_confirm + error 任务
    │   ├── 最近任务表格                # 前6条任务
    │   └── AI 助手概览卡片             # 运行中的 Agent
    │
    ├── AgentsPage (/console/agents)
    │   └── Agent 卡片网格 (2列)
    │       ├── 状态指示（运行中/草稿/异常/已暂停）
    │       ├── 类型标签（工作流/智能体）
    │       ├── 运营指标（成功率/任务数/均耗时）
    │       └── 版本 + 最后活跃时间
    │
    ├── TasksPage (/console/tasks)
    │   ├── 筛选 Tab（全部/进行中/等你确认/已完成/异常）
    │   ├── 任务表格（同前）
    │   └── BatchReviewPanel             # "等你确认" 下的批量审核面板
    │       ├── 步进浏览 pending 任务
    │       └── 快捷操作按钮
    │
    ├── TaskDetailPage — Workflow (/console/tasks/[id])
    │   ├── FlowPanorama                 # 流程全景图（节点状态可视化）
    │   ├── ConfirmDetails               # 结构化审核内容（aiResult + sourceFiles）
    │   ├── 确认按钮区（根据 confirmType 分型）
    │   │   ├── verify → "没问题" / "不对，我来改" / "稍后再看"
    │   │   ├── input → InputForm
    │   │   └── decision → DecisionForm
    │   ├── 审核视图弹窗（根据 reviewLayout 分型）
    │   │   ├── compare → CompareReviewDialog
    │   │   └── match → MatchReviewDialog
    │   ├── 异常处理区
    │   └── 执行时间线
    │
    └── TaskDetailPage — Agentic (/console/tasks/[id])
        └── AgenticTabs (agentic-tabs.tsx)
            ├── OverviewTab               # 健康指标 + KPI + 快捷操作
            ├── AnalyticsTab              # 趋势 + 内容表现 + 支出 + 周报
            ├── StrategyTab               # 参数调整 + 进化时间线 + AI 建议
            ├── LogsTab                   # 错误升级 + 事件筛选
            └── InterventionPanel         # 干预面板（running 状态）
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

> v9 重设计：新增策略步骤（StrategyStep）和三层评估体系。

```typescript
// ===== 策略步骤（策略卡片中的简化流程图） =====

type StepExecutor = "ai" | "human" | "hybrid";

interface StrategyStep {
  id: string;
  name: string;
  description: string;
  executor: StepExecutor;
  nextSteps: string[];            // 后续步骤 ID
  isLoop?: boolean;               // 是否形成循环（如 复盘→调整→执行）
}

// ===== 三层评估体系 =====

// 第一层：工具级评估（自动，Skill 自带）
interface ToolEvaluator {
  checks: string[];               // 自动检查项（格式/完整性/质量）
}

// 第二层：步骤级评估（LLM 从约束推导）
interface StepEvaluator {
  stepId: string;
  criteria: string[];             // 评估标准
  source: "derived_from_constraints" | "custom";
}

// 第三层：目标级评估（用户定义成功标准）
interface GoalEvaluatorMetric {
  name: string;
  threshold: string;
  weight: number;                 // 0.0 - 1.0
}

interface GoalEvaluator {
  id: string;
  name: string;
  description: string;
  metrics: GoalEvaluatorMetric[];
}

// ===== Skill 和约束 =====

interface AgenticSkill {
  id: string;
  name: string;
  description: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  toolEvaluator?: ToolEvaluator;  // 工具级评估（Skill 自带）
}

type AgenticConstraintType = "budget" | "time" | "quality" | "compliance" | "custom";

interface AgenticConstraint {
  id: string;
  type: AgenticConstraintType;
  description: string;
  value?: string;
}

// ===== 任务配置（底层数据模型，策略卡片是其可视化表达） =====

type AgenticExecutionStrategy = "sequential" | "parallel" | "adaptive";

interface AgenticTaskConfig {
  goal: string;
  background: string;
  strategySteps: StrategyStep[];         // 策略卡片中的简化流程图
  constraints: AgenticConstraint[];
  skills: AgenticSkill[];
  stepEvaluators: StepEvaluator[];       // 步骤级评估
  goalEvaluators: GoalEvaluator[];       // 目标级评估
  executionStrategy: AgenticExecutionStrategy;
  maxIterations: number;
  humanCheckpoints: string[];
}

// ===== 确认项（策略卡片审查） =====

interface AgenticConfirmItem {
  id: string;
  section: "goal" | "strategy" | "constraints" | "success_criteria";
  question: string;
  context: string;
  options?: string[];
}
```

### 8.4 管控后台类型（`src/lib/types.ts`）

> v12 更新：新增 intervention 事件、人工确认分型、审核视图模板、流程全景图节点定义。

```typescript
type AgentStatus = "running" | "draft" | "error" | "paused";
type ConsoleTaskStatus = "queued" | "running" | "pending_confirm" | "completed" | "error";
type TaskEventType = "node_start" | "node_complete" | "node_error" | "human_confirm" | "system" | "intervention";
type HumanConfirmType = "verify" | "input" | "decision";
type ReviewLayout = "card" | "compare" | "match";
type FlowNodeStatus = "completed" | "running" | "pending" | "error" | "skipped";

interface ConsoleAgent { /* 同前 */ }

interface ConsoleTask {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  currentNode: string;
  progress: number;
  status: ConsoleTaskStatus;
  startedAt: string;
  completedAt?: string;
  duration: string;
  priority?: "normal" | "high" | "urgent";
  description: string;
  flowNodes?: FlowNodeDef[];          // v12: Workflow 流程全景图节点
}

interface FlowNodeDef {
  id: string;
  label: string;
  status: FlowNodeStatus;
  isCurrent?: boolean;
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
  confirmType?: HumanConfirmType;     // v12: 人工确认分型
  reviewLayout?: ReviewLayout;        // v12: 审核视图模板
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

### 8.7 技术协作层类型（v12 新增，设计稿）

> 以下类型定义已在技术侧方案计划中确认，代码尚未实现。

```typescript
interface DataMapping {
  fromNodeId: string;
  fromField: string;
  fromType: string;
  toField: string;
  toType: string;
  transform?: string;
}

interface SkillBinding {
  skillId: string;
  skillName: string;
  source: "existing" | "extend" | "new";
  reason: string;
  inputContract: { name: string; type: string; required: boolean }[];
  outputContract: { name: string; type: string }[];
  avgLatency?: string;
  successRate?: string;
  alternatives?: { skillId: string; name: string; tradeoff: string }[];
  gap?: string;
}

interface ErrorChain {
  steps: ErrorStep[];
  finalFallback: "abort" | "human_takeover" | "skip_with_default";
}

interface ErrorStep {
  strategy: "retry" | "fallback_skill" | "human_confirm";
  config: {
    maxRetries?: number;
    retryInterval?: string;
    fallbackSkillId?: string;
    timeoutOverride?: string;
  };
}

interface SystemConstraints {
  slaTarget?: string;
  concurrencyLimit?: number;
  totalTimeoutBudget?: string;
  nodeTimeoutBudget?: Record<string, string>;
  resourceEstimate?: string;
  observability?: {
    logLevel: "minimal" | "standard" | "verbose";
    metricsEnabled: boolean;
    alertRules?: string[];
  };
}

interface Annotation {
  id: string;
  anchorType: "node" | "edge" | "call";
  anchorId: string;
  author: "business" | "tech";
  content: string;
  status: "open" | "replied" | "resolved";
  createdAt: string;
  replies?: { author: string; content: string; createdAt: string }[];
  distilledGene?: DistilledGeneFragment;
}

interface SkillGene {
  assetId: string;
  skillId: string;
  version: number;
  keywords: string[];
  summary: string;
  strategy: string[];
  avoid: string[];
  validation?: string;
  scope: "skill" | "scenario" | "global";
  source: "existing" | "extend" | "new";
  status: "draft" | "validated" | "deprecated";
  evolvedFrom?: string[];
}

interface DistilledGeneFragment {
  type: "strategy" | "avoid";
  content: string;
  sourceType: "annotation" | "execution_failure" | "manual";
  sourceId: string;
  confirmed: boolean;
  targetSkillId?: string;
  targetScope?: "skill" | "scenario" | "global";
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

### 9.2 Agentic 方案编辑能力

> v9 重设计：从 4-Tab 配置面板改为策略卡片 + 可展开技术配置。

**策略卡片（所有人可见）**：

| 区域 | 编辑能力 |
|------|---------|
| 目标 | 内联编辑目标描述 |
| 执行策略 | 简化流程图编辑：增删步骤、调整顺序、切换人机分工（AI/人工/协作）、设置循环 |
| 约束 | 增删约束条件，选择类型（预算/时间/质量/合规/自定义） |
| 成功标准 | 用通俗语言编辑成功指标，AI 自动转化为结构化评估配置 |

**可展开技术配置（技术方）**：

| 区域 | 编辑能力 |
|------|---------|
| 可用技能 | 技能市场集成 + 自定义技能 + 查看工具级评估（自动检查项） |
| 执行参数 | 执行策略切换（sequential/parallel/adaptive）、最大迭代次数、人工确认节点 |
| 三层评估 | 查看工具级（只读）、编辑步骤级标准、编辑目标级指标（名称/阈值/权重） |

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

### 9.3.2 标记提醒机制（v6 重设计）

> v4 的强制反问卡片在 v6 中被替换为标记提醒 + 按需查看。详见 `flowagent-product.md` 第 1.1.2 节。

**当前实现（v3/v4）**：生成后强制弹出反问卡片 → 用户必须逐个回答/跳过/暂缓 → 才能看到流程图。

**目标设计（v6）**：

```
AI 生成方案（unified_draft 返回 nodeConfidence）
    │
    ▼
直接展示流程图（不拦截）
    ├── confidence=high 的节点：不显示标记
    ├── confidence=medium 的节点：黄点标记，hover 显示原因
    └── confidence=low 的节点：红点标记，hover 显示原因
    │
    ▼
ChatPanel 输出摘要提示
    "已生成方案，共 N 个节点。
     其中 M 个节点我不太确定，已标记在流程图上：
     • 「节点A」— 原因
     • 「节点B」— 原因
     你可以点击节点查看详情，或者直接告诉我怎么调整。"
    │
    ▼
用户点击标记节点时
    └── NodeDetailPanel 中显示 AI 的疑问和建议选项
         ├── 用户在面板中回答 → 通过对话或直接编辑修正
         └── 用户不处理 → 标记保留
    │
    ▼
确认方案时
    └── 如有未处理的 medium/low 节点 → 弹出提醒
         "还有 N 个节点 AI 标记为不确定，确定要提交吗？"
```

### 9.4 FlowCanvas 双向同步

- React Flow 使用 `useNodesState` / `useEdgesState` 管理内部状态
- Zustand store 的 nodes/edges 变化时，通过 `useEffect` 同步到 React Flow
- 用户在画布上的拖拽/结构变更，通过 `handleNodesChange` 回写到 store（仅在结构变更或拖拽结束时）

### 9.5 管控后台交互逻辑

> v12 更新：Workflow 和 Agentic 任务详情交互完全分离。

**Workflow 任务详情**：
- 流程全景图（FlowPanorama）展示节点状态，当前节点高亮
- 人工确认根据 `confirmType` 分型：
  - `verify`：展示 AI 结果 + 源文件引用 → "没问题" / "不对，我来改" / "稍后再看"
  - `input`：展示 InputForm → 用户填写数据 → 提交
  - `decision`：展示 DecisionForm → 用户从选项中选择 → 提交
- 审核视图根据 `reviewLayout` 分型：
  - `card`：内嵌显示审核信息（默认）
  - `compare`：CompareReviewDialog 双栏对比弹窗（左右各一栏）
  - `match`：MatchReviewDialog 三栏匹配弹窗（源文件 / 匹配结果 / 待匹配内容）
- 批量审核：TasksPage 下 "等你确认" Tab 提供 BatchReviewPanel

**Agentic 任务详情**：
- AgenticTabs 四 Tab 结构：
  - 总览：健康信号灯（正常/警告/严重）+ KPI 卡片 + 快捷操作
  - 分析：目标达成趋势 + 粉丝/内容/支出图表 + 可展开周报
  - 策略：当前策略参数（可编辑）+ 进化时间线 + AI 建议 + 自由指令输入
  - 日志：错误升级区 + 事件类型筛选 + 时间线
- 干预面板：仅 `running` 状态显示，支持修改预算/方向/约束参数

**执行时间线**：
- 事件类型用不同图标和颜色区分：
  - `node_start`：蓝色 Play 图标
  - `node_complete`：绿色 CheckCircle 图标
  - `node_error`：红色 XCircle 图标
  - `human_confirm`：琥珀色 UserCheck 图标
  - `intervention`：紫色 ShieldAlert 图标（v12 新增）
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

集成方式：策略卡片 → 展开技术配置 → SkillsConfig → "技能市场"按钮 → 搜索 + 点击添加。

---

## 十一、Mock 数据

### 管控后台 Mock（`src/lib/mock-console.ts`）

> v12 更新：新增 HR Agent、扩展 human_confirm 分型数据、新增 Agentic Dashboard 数据。

**MOCK_AGENTS**（6 个）：

| Agent | 类型 | 状态 | 部门 |
|-------|------|------|------|
| 报关 Agent | workflow | 运行中 | 外贸部 |
| 合同审核 Agent | workflow | 运行中 | 法务部 |
| 竞品分析 Agent | agentic | 运行中 | 产品部 |
| 财务报销 Agent | workflow | 运行中 | 财务部 |
| 小红书运营 Agent | agentic | 草稿 | 市场部 |
| HR 入职 Agent | workflow | 运行中 | 人力资源部 |

**MOCK_TASKS**：覆盖全部 5 种状态，Workflow 任务带 `flowNodes`（流程全景图数据）

**MOCK_TASK_EVENTS**：
- T-2849（报关）：`confirmType: "verify"`, `reviewLayout: "match"`（三栏匹配审核）
- T-2848（合同审核）：`confirmType: "verify"`, `reviewLayout: "compare"`（双栏对比审核）
- T-7001（HR 入职）：`confirmType: "input"`（人工输入数据）
- T-6104（报销单）：`confirmType: "decision"`（人工判断决策）
- 含 `intervention` 类型事件

**MOCK_AGENTIC_DASHBOARD**：为 T-8001/T-8002 提供完整的 Agentic 管控数据（health、spending、strategyParams、weeklyReports）

**CONSOLE_STATS**：动态计算 `MOCK_AGENTS.filter(a => a.status === "running").length`

### 技术方评审 Mock（`src/lib/mock-reviews.ts`）

4 个完整的评审场景，技术方从 `/tech` 点击后直接加载，不触发 AI：

| ID | 场景 | 类型 | 状态 | 内容 |
|----|------|------|------|------|
| review-1 | 小红书账号运营 | Agentic | pending | 完整策略卡片（5 策略步骤、6 技能、4 约束、3 层评估） |
| review-2 | 进出口报关流程 | Workflow | pending | 6 节点流程图 + 5 条边 |
| review-3 | 财务报销审批 | Workflow | reviewed | 5 节点流程图 + 4 条边（含条件分支） |
| review-4 | 竞品分析报告 | Agentic | confirmed | 完整策略卡片（4 策略步骤、4 技能、3 约束、3 层评估） |

每个场景包含：完整的流程图/配置数据 + 模拟聊天记录 + 项目名称。

### 批注 Mock（`src/lib/mock-data.ts`）

3 条技术方批注（MOCK_ANNOTATIONS），在 `tech_reviewing` 状态时自动加载：
- Workflow 模式：按 nodeId 绑定到对应节点
- Agentic 模式：nodeId 自动转为 `__global__`，以全局批注形式展示（可按策略步骤筛选）

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
│               ├── page.tsx          # 任务详情（Workflow: 全景图+分型确认 / Agentic: 跳转 AgenticTabs）
│               └── agentic-tabs.tsx  # v12: Agentic 四 Tab 详情（总览/分析/策略/日志+干预面板）
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
│   │   ├── StrategyCard.tsx          # Agentic 策略卡片（目标+简化流程图+约束+成功标准）
│   │   ├── AgenticConfigPanel.tsx    # Agentic 技术配置（策略卡片展开后的详细配置）
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
│       ├── badge.tsx
│       └── select.tsx               # v12: shadcn Select 组件
└── lib/
    ├── store.ts                      # Zustand 全局状态（含 collectedAnswers + isReviewMode + rehydrate 修复）
    ├── types.ts                      # TypeScript 类型定义（Workflow + Agentic策略卡片 + 三层评估 + Console）
    ├── flow-parser.ts                # LLM 响应解析 + 画布序列化
    ├── mock-data.ts                  # Workflow Mock + 批注 Mock + 知识文件 Mock
    ├── mock-reviews.ts               # 技术方评审 Mock（4 个完整场景）
    ├── mock-console.ts               # 管控后台 Mock + 技能市场数据
    └── utils.ts                      # 工具函数（cn）
```

---

## 十三、规划中的架构扩展

> 以下内容基于论文研究和产品讨论，尚未实现，作为后续迭代的架构参考。

### 13.1 统一方案架构（Unified Scheme）

> v9 重设计：所有任务类型统一以"有结构的方案"呈现，区别只是节点内部的确定性程度。

**核心认知**：人类做任何任务都有结构。Agentic 任务不是"没有步骤"，而是"步骤不是预先固定的，每步的选择取决于上步的结果"。

**数据模型扩展**：

```typescript
// FlowNodeData 扩展——支持 Agent 自主节点
interface FlowNodeData {
  // ...现有字段...
  isAgenticNode?: boolean;           // 是否为 Agent 自主节点
  agenticConfig?: {                  // Agent 自主节点的精简配置
    goal: string;                    // 该节点的目标
    skills: AgenticSkill[];          // 可用技能
    constraints: AgenticConstraint[]; // 约束条件
    stepEvaluator?: StepEvaluator;   // 步骤级评估
  };
}
```

**UI 设计**：
- Agent 自主节点在流程图中用紫色双层边框区分
- 点击展开后显示精简版配置（目标 + 可用 Skill + 约束 + 步骤评估标准）
- 目标级评估是任务级别的，不需要每个节点重复配置

**纯 Agentic 方案**：以策略卡片呈现（见产品文档 3.2.3），底层数据仍为 AgenticTaskConfig，策略卡片是其可视化表达。

**执行模型**：
```
Workflow步骤1 (确定性) → 输出: data.json
  ↓ [上下文传递]
Agent自主节点 (自主规划，能看到 data.json)
  - 可用 Skill: [分析, 生成, ...]
  - 约束: [预算, 时间, ...]
  - 步骤评估: [结果与主题相关, 数据完整]
  - 输出: strategy.json
  ↓ [上下文传递]
Workflow步骤3 (确定性，能拿到 strategy.json)
```

### 13.2 引导式输入流程

> 详见 `flowagent-product.md` 第七章。v6 细化了 UI 形式（澄清卡片）和完整串联流程。

**AI 分类阶段增加需求清晰度判断**：

```
用户输入
  ↓
POST /api/generate-flow { action: "unified_draft", prompt }
  ↓
LLM 返回 { taskType, classifyReason, clarityScore, clarifyQuestions?, ... }
  ↓
clarityScore >= threshold?
  ├── YES → 直接展示生成结果（快思考）
  └── NO  → 弹出澄清卡片（慢思考）
              ├── 卡片上半部：AI 理解摘要（"我理解你想要..."）
              ├── 卡片下半部：1-3 个关键问题（只问影响方案结构的）
              ├── 用户补充 → 合并为增强 prompt → 重新 unified_draft
              └── 用户跳过 → AI 用默认假设生成
```

**澄清卡片组件设计**：

```typescript
interface ClarifyCard {
  understanding: string;           // AI 的理解摘要
  keyElements: string[];           // AI 识别出的关键环节
  questions: ClarifyQuestion[];    // 1-3 个追问
}

interface ClarifyQuestion {
  id: string;
  question: string;
  context: string;                 // 为什么要问这个
  options?: string[];              // 可选的快速选择项
  answer?: string;                 // 用户的回答
}
```

**API 扩展**：

```typescript
// unified_draft 返回增加字段
{
  taskType: "workflow" | "agentic" | "hybrid";
  classifyReason: string;
  clarityScore: number;            // 0-1, 需求清晰度
  clarifyCard?: ClarifyCard;       // clarityScore < threshold 时返回
  // ...其余字段不变
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

> v12 更新：知识容器采用双形态存储（Human Doc + Model Gene），详见 `product-strategy.md` 和 `skill-architecture-thinking.md`。

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
| 企业 Skill 库 | Skill 平台 API（见 13.7 节） | AI 翻译时匹配可用 Skill，提高方案可执行性 |

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

### 13.5 自进化架构

> 详见 `flowagent-product.md` 第 5.7 节。此处记录技术实现架构。

**数据采集层**：

```typescript
interface SchemeRecord {
  id: string;
  scenario: string;                    // 场景描述
  scenarioTags: string[];              // 场景标签（审批类/数据处理类/客服类/监控类）
  taskType: TaskType;
  initialVersion: {                    // AI 初始版本
    nodes: SerializedNode[];
    edges: SerializedEdge[];
  };
  finalVersion: {                      // 用户确认版本
    nodes: SerializedNode[];
    edges: SerializedEdge[];
  };
  diff: SchemeDiff[];                  // 结构化差异
  confirmedBy: string;
  confirmedAt: string;
  enterpriseId: string;
}

interface SchemeDiff {
  nodeId: string;
  nodeLabel: string;
  changeType: "added" | "removed" | "modified";
  field?: string;                      // executionMode / description / estimatedTime / ...
  oldValue?: string;
  newValue?: string;
  reason?: string;                     // 技术方修改原因（从批注中提取）
}
```

**知识提炼层（定期任务）**：

```
每积累 N 条 SchemeRecord 后触发
    │
    ▼
LLM 归纳任务：
  输入：最近 N 条 SchemeDiff
  输出：通用规则列表
    │
    ▼
人工审核规则 → 写入 prompt 模板库
```

**生成增强层（动态 prompt 组装）**：

```
用户输入 + 场景分类
    │
    ▼
检索匹配的已确认方案（向量化 / 关键词）
    │
    ▼
组装 prompt:
  base_instruction                     // 基础指令（含思维链 + 负面示例）
  + matched_few_shots[]                // 匹配的场景模板
  + applicable_rules[]                 // 适用的通用规则
  + enterprise_constraints[]           // 企业特有约束
  + available_skills[]                 // 可用 Skill 列表
    │
    ▼
unified_draft 调用
```

### 13.6 待确认问题集（扩展批注系统）

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

### 13.7 Skill 平台集成架构（独立产品）

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

### 13.8 执行层架构（Phase 2）

> v10 更新：明确 FlowAgent 输出为方案蓝图（非可执行代码），试运行定位为业务体验预览。详见 `flowagent-product.md` 第四章。

**行业现实**：AI 生成可执行工作流在企业生产环境中不可靠（单步准确率 85-90%，10 步工作流成功率仅 35%）。FlowAgent 的输出是方案蓝图，技术方参考蓝图在执行引擎中搭建，每个阶段都有人工审核。

**三层架构**：

```
┌──────────────────────────────────┐
│        FlowAgent 编排层          │
│  方案蓝图（结构化 JSON）          │
│  ├── Workflow: DAG + Skill 建议  │
│  └── Agentic: 策略配置 + Skill 列表 │
└──────────────────┬───────────────┘
                   │ 方案蓝图 JSON（非可执行代码）
                   │
          ┌────────┴────────┐
          ▼                 ▼
┌─────────────────┐ ┌─────────────────┐
│   试运行引擎     │ │ 生产执行引擎     │
│ （模拟演练）     │ │ (Dify/LangGraph) │
│ 模拟数据 + 交互  │ │ 技术方手动搭建   │
│ 预览             │ │ 真实 Skill 调用  │
│ 受众：业务方     │ │ 受众：技术方     │
└────────┬────────┘ └────────┬────────┘
         │ 交互预览报告       │ 执行日志 + 状态回调
         ▼                   ▼
┌──────────────────────────────────┐
│       FlowAgent 管控后台         │
│  试运行：交互预览 / 业务方反馈    │
│  生产：任务状态 / 人工介入 / 告警 │
│  共用：异常归因标注 / 知识沉淀    │
└──────────────────────────────────┘
```

**Skill 标准化是自动化程度的关键变量**（Skill 平台详见 13.7 节和 `flowagent-product.md` 第六章）：

| Skill 标准化程度 | Workflow | Agentic |
|-----------------|---------|---------|
| 只有名字 | 技术方手动搭建 | 技术方手动搭建 |
| 有 API schema | 蓝图 + Skill 绑定建议，技术方审核微调后导入 | 策略配置 + Skill 列表建议，技术方审核后配置 |
| 完整标准化 | 蓝图 + 预绑定 + 试运行报告，技术方确认后部署 | 策略配置 + 试运行报告，技术方确认后部署 |

**试运行架构**：

```typescript
interface TrialRun {
  id: string;
  schemeId: string;
  schemeVersion: number;
  status: "running" | "completed" | "failed";
  mockData: Record<string, unknown>;     // 模拟输入数据
  steps: TrialRunStep[];                 // 每步的模拟结果
  createdBy: string;
  createdAt: string;
}

interface TrialRunStep {
  nodeId: string;
  nodeName: string;
  executor: "ai" | "human" | "hybrid";
  mockOutput: string;                    // 模拟输出（展示用）
  interactionType: "auto" | "confirm" | "input";  // 交互类型
  interactionPrompt?: string;            // 需要用户做什么
}
```

### 13.9 SOP 文档提取（Phase 3）

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

### 13.10 知识工作台架构

> 详见 `flowagent-product.md` 第八章。知识面板从静态文件展示升级为支持 AI 代码生成 + 沙箱执行的数据工作台。

**整体架构**：

```
┌─────────────────────────────────────────────────────┐
│                    编辑器                             │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ ChatPanel │  │  FlowCanvas  │  │  知识工作台    │  │
│  │          │  │              │  │               │  │
│  │ 分析交互  │  │   流程图      │  │  文件管理层    │  │
│  │ 结果展示  │◀─┼── 应用到方案 ─┤  │  ├ 上传/预览   │  │
│  │ 代码查看  │  │              │  │  ├ 通用/专属   │  │
│  │          │  │              │  │  └ 权限控制    │  │
│  │          │  │              │  │               │  │
│  │          │──┼──────────────┼─▶│  AI 分析入口   │  │
│  └──────────┘  └──────────────┘  └───────┬───────┘  │
│                                          │          │
└──────────────────────────────────────────┼──────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │   沙箱执行层     │
                                  │                 │
                                  │  AI 生成代码     │
                                  │  ↓              │
                                  │  沙箱运行        │
                                  │  ↓              │
                                  │  结构化结果      │
                                  └─────────────────┘
```

**文件管理数据模型**：

```typescript
interface KnowledgeFile {
  id: string;
  name: string;
  type: "excel" | "csv" | "pdf" | "word" | "markdown" | "json";
  size: number;
  scope: "enterprise" | "scheme";      // 通用文件 vs 方案专属
  schemeId?: string;                    // scope=scheme 时绑定的方案 ID
  enterpriseId: string;
  uploadedBy: string;
  uploadedAt: string;
  tags?: string[];
}

interface AnalysisRecord {
  id: string;
  schemeId: string;                     // 绑定的方案
  fileIds: string[];                    // 分析涉及的文件
  task: string;                         // 用户描述的分析任务
  generatedCode: string;               // AI 生成的代码
  result: AnalysisResult;              // 执行结果
  appliedToScheme: boolean;            // 是否已应用到方案
  createdAt: string;
}

interface AnalysisResult {
  status: "success" | "error";
  summary: string;                     // 结构化摘要
  findings: AnalysisFinding[];         // 发现的问题/边界情况
  suggestions: AnalysisSuggestion[];   // 方案优化建议
  rawOutput?: string;                  // 原始输出
  error?: string;
}

interface AnalysisFinding {
  type: "anomaly" | "uncovered_case" | "data_quality" | "pattern";
  description: string;
  severity: "high" | "medium" | "low";
  affectedCount: number;
  affectedPercentage: number;
  examples?: string[];
}

interface AnalysisSuggestion {
  description: string;
  suggestedNodeChanges?: {
    action: "add" | "modify" | "add_branch";
    nodeLabel: string;
    details: string;
  }[];
}
```

**沙箱执行方案**：

| 阶段 | 方案 | 安全机制 | 能力范围 |
|------|------|---------|---------|
| **Demo** | 无代码执行，文件内容拼入 LLM prompt | 文件不离开浏览器 | 仅 LLM 推理分析 |
| **Phase 1** | Pyodide（浏览器端 WebAssembly Python） | 浏览器沙箱天然隔离 | pandas/numpy 数据分析，文件 < 50MB |
| **Phase 2** | Docker 容器（服务端） | 网络隔离 + 资源限制 + 执行超时 + 审计日志 | 完整 Python 生态，大文件支持 |

**Pyodide 沙箱约束（Phase 1）**：

```
✅ 允许：
  - 读取用户上传的文件（通过虚拟文件系统）
  - pandas / numpy / openpyxl 等数据分析库
  - 标准 Python 计算

❌ 禁止：
  - 网络访问（无 requests / urllib）
  - 文件系统写入（除指定输出目录）
  - 子进程调用
  - 执行时间 > 30 秒自动终止
  - 内存 > 256MB 自动终止
```

**分析流程（API 扩展）**：

```typescript
// 新增 action
POST /api/generate-flow {
  action: "analyze_files",
  prompt: string,                      // 用户描述的分析任务
  fileContents: {                      // 文件内容（Demo 阶段直接传内容）
    fileName: string;
    content: string;                   // CSV/JSON 文本内容，或 base64
  }[],
  currentFlow?: object                 // 当前方案（用于生成"应用到方案"建议）
}

// 返回
{
  analysisCode: string,                // AI 生成的 Python 代码
  result: AnalysisResult,              // 结构化结果（Demo 阶段由 LLM 直接生成）
  codeLanguage: "python"
}
```

**"应用到方案"机制**：

```
分析结果中的 suggestions
    │
    ▼
用户点击"应用到方案"
    │
    ▼
将 suggestions 转化为 refine 请求：
POST /api/generate-flow {
  action: "refine",
  currentFlow: ...,
  feedback: "根据数据分析结果，需要做以下调整：
    1. 新增数据清洗节点（处理金额为 0 的异常记录）
    2. 新增币种判断分支（外币换算）
    3. 新增免审条件校验节点"
}
    │
    ▼
AI 修改流程图 → 更新画布
```

### 13.11 方案管理与版本控制

> 详见 `flowagent-product.md` 第 3.5-3.6 节、第 4.4-4.5 节。

**方案数据模型**：

```typescript
interface Scheme {
  id: string;
  name: string;
  description?: string;
  taskType: TaskType;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  enterpriseId: string;
  departmentId: string;
  assignedReviewer?: string;           // 指定的技术方审核人
  currentVersion: number;              // 当前版本号（乐观锁依据）
  templateSourceId?: string;           // 如果从模板创建，记录模板来源
  archivedAt?: string;                 // 归档时间（长期不使用自动标记）
}

interface SchemeVersion {
  id: string;
  schemeId: string;
  version: number;
  trigger: "ai_generated" | "manual_save" | "submit_review" | "rejected" | "confirmed";
  label: string;                       // 版本标签（如"AI 初始版本"、"提交评审"）
  note?: string;                       // 用户备注（手动保存时）
  data: {
    nodes: SerializedNode[];
    edges: SerializedEdge[];
    agenticConfig?: AgenticTaskConfig;  // 含 strategySteps + 三层评估
  };
  createdBy: string;
  createdAt: string;
}
```

**执行实例数据模型**（Phase 2，对接执行层后）：

```typescript
interface Execution {
  id: string;
  schemeId: string;
  schemeVersion: number;               // 基于哪个版本执行
  status: "pending" | "running" | "paused" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  trajectory: ExecutionStep[];         // 实际执行轨迹
  goalEvaluation?: GoalEvaluationResult;  // 目标级评估结果
}

interface ExecutionStep {
  stepId: string;
  stepName: string;
  skillUsed?: string;                  // 实际调用的 Skill
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  stepEvaluation?: StepEvaluationResult;  // 步骤级评估结果
  startedAt: string;
  completedAt?: string;
  status: "completed" | "failed" | "skipped" | "human_override";
}

interface GoalEvaluationResult {
  overallScore: number;                // 0-1
  metrics: { name: string; actual: string; target: string; score: number }[];
  aiSuggestion?: string;              // AI 的调整建议（用于复盘报告）
}

interface StepEvaluationResult {
  passed: boolean;
  criteria: { name: string; met: boolean; detail?: string }[];
}
```

**方案与执行的关系**：Scheme : Execution = 1 : N。Workflow 每次执行路径基本一致，Agentic 每次执行路径可能完全不同。方案可以根据多次执行的评估结果迭代优化（见产品文档 3.2.6 复盘-调整循环）。

**乐观锁机制**：

```typescript
// 保存方案时的冲突检测
async function saveScheme(schemeId: string, data: SchemeData, expectedVersion: number) {
  const current = await db.scheme.findById(schemeId);
  if (current.currentVersion !== expectedVersion) {
    // 版本冲突
    return {
      conflict: true,
      currentVersion: current.currentVersion,
      lastModifiedBy: current.updatedBy,
      lastModifiedAt: current.updatedAt,
    };
  }
  // 正常保存，版本号 +1
  await db.scheme.update(schemeId, { ...data, currentVersion: expectedVersion + 1 });
  return { conflict: false };
}
```

前端收到冲突响应后，弹出提示让用户选择"查看最新版"或"强制覆盖"。强制覆盖会创建新版本，被覆盖的版本仍在历史中可回滚。

**方案列表页路由**：

| 路由 | 角色 | 数据筛选 |
|------|------|---------|
| `/` | 业务方 | `createdBy = currentUser` |
| `/tech` | 技术方 | Tab 切换：我创建的 / 待我审核 / 全部 |

两个页面复用同一个 `SchemeListPage` 组件，通过角色参数控制筛选和操作按钮。新用户首次进入时展示预置的示例方案（只读，可复制为自己的方案）。

### 13.12 模板市场

> 详见 `flowagent-product.md` 第 3.7 节。

**模板数据模型**：

```typescript
interface SchemeTemplate {
  id: string;
  name: string;
  description: string;
  scenarioType: string;                // 场景分类标签（审批类/数据处理类/...）
  taskType: TaskType;
  skeleton: {
    nodes: SerializedNode[];
    edges: SerializedEdge[];
  };
  keyDecisions: {
    nodeLabel: string;
    decision: string;
    executionMode: NodeExecutionMode;
  }[];
  sourceSchemeId: string;              // 来源方案 ID
  createdBy: string;
  createdAt: string;
  usageCount: number;                  // 被使用次数
  enterpriseId: string;                // 企业级模板
}
```

**模板和 AI 生成的双通道**：

```
新建方案
    │
    ├── 用户选择模板 → 复制为草稿 → 编辑器
    │
    └── 用户描述需求 → AI 生成（后台自动检索匹配模板作为 few-shot）→ 编辑器
```

### 13.13 通知系统

> 详见 `flowagent-product.md` 第 3.8 节。

**通知数据模型**：

```typescript
interface Notification {
  id: string;
  userId: string;                      // 接收者
  type: NotificationType;
  title: string;
  content: string;
  relatedSchemeId?: string;
  relatedTaskId?: string;
  read: boolean;
  createdAt: string;
}

type NotificationType =
  | "review_submitted"                 // 业务方提交评审
  | "review_approved"                  // 技术方通过
  | "review_rejected"                  // 技术方打回
  | "annotation_replied"               // 批注被回复
  | "scheme_confirmed"                 // 方案确认
  | "agent_error"                      // Agent 执行异常
  | "human_confirm_required"           // 人工确认节点触发
  | "scheme_updated";                  // 方案有新版本
```

**API**：

```
GET  /api/notifications?unread=true    → 获取未读通知
POST /api/notifications/:id/read       → 标记已读
POST /api/notifications/read-all       → 全部标记已读
```

**外部通知扩展（Phase 2）**：通知服务发出事件后，由适配器层分发到站内 + 飞书/钉钉。

### 13.14 权限模型

> 详见 `flowagent-product.md` 第 3.9 节。

**RBAC 数据模型**：

```typescript
type UserRole = "business" | "business_lead" | "tech" | "admin";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  enterpriseId: string;
  departmentId: string;
}

// 权限矩阵
const PERMISSIONS: Record<UserRole, Permission[]> = {
  business: [
    "scheme:create", "scheme:edit_own", "scheme:submit_review",
    "console:view_own_dept", "console:human_confirm_own_dept"
  ],
  business_lead: [
    ...PERMISSIONS.business,
    "console:pause_resume_own_dept"
  ],
  tech: [
    "scheme:create", "scheme:edit_own", "scheme:review",
    "scheme:confirm", "annotation:create",
    "console:view_all", "console:handle_error", "console:annotate_cause"
  ],
  admin: [
    ...PERMISSIONS.tech,
    "user:manage", "permission:configure", "settings:global"
  ]
};
```

**管控后台数据过滤**：

```
GET /api/console/agents
  → role=business → WHERE departmentId = user.departmentId
  → role=tech/admin → 不过滤（返回全部）
```

### 13.15 技术协作层架构（v12 新增）

> 业务确认后，并行调 LLM 生成技术方案。技术协作层是编辑器的一部分（Tab 切换），不是独立平台。

**三个技术视图**：

| 视图 | 内容 | 渲染方式 |
|------|------|---------|
| 技术时序图 | 参与者间调用顺序、数据传递、条件分支 | Mermaid sequenceDiagram |
| 接口/能力清单 | "需要的能力" vs "已有的能力"，缺口分析 | 表格 |
| 节点级技术详情 | Skill 契约、数据映射、错误链路、系统约束 | 面板 |

**Workflow vs Agentic 时序图差异**：

| | Workflow | Agentic |
|---|---------|---------|
| 性质 | 确定性——调用顺序固定 | 代表性——展示可能的调用模式 |
| Skill 关系 | 绑定（设计时确定，1:1） | 授权（设计时授权，执行时 Agent 选） |

**协作机制**：
- 锚定批注：技术方在时序图上标注质疑 → 业务方在流程图上可见对应节点的红点
- 变更传播：业务方改流程图 → 技术时序图标记受影响区域（不自动重新生成）
- 批注蒸馏：技术批注 → LLM 蒸馏为 Gene 片段（strategy/AVOID） → 沉淀到 Gene 池 → 反哺下次 AI 生成

**Gene 进化循环（贯穿全链路）**：

```
方案确认 → Diff 沉淀 → Gene 池
批注 resolved → LLM 蒸馏 → AVOID/strategy → Gene 池
执行成功 → Gene strategy 标记 validated
执行失败 → 蒸馏为 AVOID 警告 → Gene 池
AI 生成 → 匹配 Gene → 注入 prompt（≤ 500 token）
```
