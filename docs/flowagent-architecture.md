# FlowAgent 现有架构与逻辑文档

> 最后更新：2026-04-02

## 一、产品定位

FlowAgent 是一个 **AI 驱动的业务翻译工具**，核心价值是将业务人员的自然语言描述转化为结构化、可执行的流程图，并支持业务方与技术方在同一张图上协作确认。

**一句话定义**：从业务描述到 Agent 任务的翻译平台。

---

## 二、技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Next.js (App Router) |
| UI | React 19 + Tailwind CSS + Radix UI |
| 状态管理 | Zustand + persist (localStorage) |
| 流程图渲染 | @xyflow/react (React Flow) |
| LLM 调用 | OpenAI 兼容 API (gpt-4o) |
| 部署 | Vercel |

---

## 三、页面路由

| 路由 | 文件 | 职责 |
|------|------|------|
| `/` | `src/app/page.tsx` | 首页落地页：输入框 + 示例场景卡片，跳转到 `/editor?q=...` |
| `/editor` | `src/app/editor/page.tsx` | 主工作台：左侧对话面板 + 中间流程图画布 + 右侧可选面板 |
| `POST /api/generate-flow` | `src/app/api/generate-flow/route.ts` | 唯一 API：LLM 调用，支持 draft / refine_node / refine 三种 action |

---

## 四、核心数据流

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
triggerDraft(prompt)
    ├── chatPhase → "drafting"
    ├── POST /api/generate-flow { action: "draft", prompt }
    │        │
    │        ▼
    │   LLM 返回 { flow: {...}, nodeConfidence: [...] }
    │
    ├── parseLLMResponse(flow) → { nodes, edges }
    ├── loadGeneratedFlow(nodes, edges)
    ├── 构建 nodeLabelMap
    │
    └── 判断是否有需确认节点
         ├── 有 → chatPhase → "questioning"
         │        │
         │        ▼
         │   NodeQuestionCard 逐节点展示问题
         │        │
         │        ├── 用户确认 → handleNodeConfirm
         │        │     ├── POST { action: "refine_node" }
         │        │     ├── 更新流程图
         │        │     └── 下一个节点 or finishQuestioning
         │        │
         │        ├── 跳过此节点 → handleSkipNode
         │        └── 跳过全部 → handleSkipAll
         │
         └── 无 → chatPhase → "ready"
                    │
                    ▼
              用户可自由对话修改
                    │
                    ▼
              POST { action: "refine", feedback }
              → 更新流程图 → 回到 "ready"
```

---

## 五、状态机：chatPhase

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
              ┌──────────┐    用户输入    ┌──────────────┐ │
              │   idle   │ ────────────▶ │   drafting   │ │
              └──────────┘               └──────┬───────┘ │
                    ▲                           │         │
                    │ 失败                  成功 │         │
                    │                           ▼         │
                    │                    有需确认节点？     │
                    │                    ┌───┐   ┌───┐    │
                    │                    │ 是│   │ 否│    │
                    │                    └─┬─┘   └─┬─┘    │
                    │                      ▼       ▼      │
                    │              ┌────────────┐ ┌─────┐ │
                    │              │questioning │ │ready │◀┘
                    │              └─────┬──────┘ └──┬──┘
                    │                    │           │
                    │           确认节点 │    用户修改│
                    │                    ▼           ▼
                    │           ┌──────────────┐ ┌─────────┐
                    │           │refining_node │ │refining  │
                    │           └──────┬───────┘ └────┬────┘
                    │                  │              │
                    │         还有下一个│         完成 │
                    │              ┌───┘              │
                    │              ▼                  │
                    │      回到 questioning           │
                    │      或 finishQuestioning       │
                    │              │                  │
                    └──────────────┴──────────────────┘
                                 → ready
```

### 状态说明

| 状态 | 含义 | 用户可操作 |
|------|------|-----------|
| `idle` | 初始状态，无流程图 | 输入业务描述 |
| `drafting` | 正在调用 LLM 生成草稿 | 等待 |
| `questioning` | 逐节点确认阶段 | 确认/跳过/打字补充 |
| `refining_node` | 正在根据单节点确认结果优化 | 等待 |
| `ready` | 流程图已就绪 | 自由对话修改、画布编辑 |
| `refining` | 正在根据自由对话修改流程图 | 等待 |

### 持久化恢复策略

页面刷新时，如果 `chatPhase` 处于 `drafting` / `refining_node` / `refining`（请求中间态），`onRehydrateStorage` 会自动恢复：
- 有未完成的待确认节点 → `questioning`
- 已有流程图节点 → `ready`
- 否则 → `idle`

---

## 六、API 设计

### `POST /api/generate-flow`

**通用请求字段**：

```typescript
{
  prompt?: string;          // 原始业务描述
  action: "draft" | "refine_node" | "refine";
  currentFlow?: object;     // 当前画布序列化后的 JSON
  feedback?: string;        // 自由修改意见
  nodeId?: string;          // 目标节点 ID
  nodeLabel?: string;       // 目标节点标签
  answers?: { question: string; answer: string }[];  // 节点确认回答
}
```

### 三种 Action

| Action | 触发时机 | 输入 | 输出 |
|--------|---------|------|------|
| `draft` | 首次生成 | `prompt` | `{ flow, nodeConfidence[] }` |
| `refine_node` | 单节点确认后 | `currentFlow` + `nodeId` + `answers` | 完整流程图 JSON |
| `refine` | 自由对话修改 | `currentFlow` + `feedback` | 完整流程图 JSON |

### 流程图 JSON Schema

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

---

## 七、组件架构

```
EditorPage (Suspense)
└── EditorContent
    ├── TopBar                          # 顶栏：导航、项目状态、角色切换、评审操作
    │
    ├── ChatPanel                       # 左侧对话面板（340px）
    │   ├── 消息列表 (renderMessage)
    │   ├── NodeQuestionCard            # 逐节点确认卡片
    │   ├── CompletionCard              # 确认完成提示
    │   └── 输入区域
    │
    ├── 中间区域 (flex-1)
    │   ├── FlowCanvas                  # React Flow 画布
    │   │   ├── CanvasToolbar           # 悬浮工具条（加/复制/删节点）
    │   │   └── FlowCardNode            # 自定义节点组件（nodeTypes.flowCard）
    │   └── NodeDetailPanel             # 选中节点时的底部详情面板
    │
    ├── AnnotationPanel                 # 右侧批注面板（可选）
    ├── KnowledgePanel                  # 右侧知识中心面板（可选）
    └── NodeEditDialog                  # 全屏模态节点编辑器
```

---

## 八、类型系统

### 核心类型（`src/lib/types.ts`）

```typescript
// 节点执行模式
type NodeExecutionMode = "ai_auto" | "human_confirm" | "human_manual";

// 节点执行类型
type NodeExecutionType = "deterministic" | "intelligent";

// 技术可行性评估
type NodeFeasibility = "confirmed" | "partial" | "infeasible" | "pending";

// 节点数据
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

// 项目状态流转
type ProjectStatus =
  | "draft"              // 草稿
  | "business_editing"   // 业务方编辑中
  | "pending_review"     // 待技术评审
  | "tech_reviewing"     // 技术评审中
  | "needs_revision"     // 需修改
  | "confirmed";         // 双方确认
```

### Store 类型（`src/lib/store.ts`）

```typescript
// 对话阶段
type ChatPhase = "idle" | "drafting" | "questioning" | "refining_node" | "ready" | "refining";

// 节点置信度（LLM 返回）
interface NodeConfidence {
  nodeId: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  questions: NodeQuestion[];
}

// 节点问题
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

### 9.2 协作流程（ProjectStatus 状态机）

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

### 9.3 FlowCanvas 双向同步

- React Flow 使用 `useNodesState` / `useEdgesState` 管理内部状态
- Zustand store 的 nodes/edges 变化时，通过 `useEffect` 同步到 React Flow
- 用户在画布上的拖拽/结构变更，通过 `handleNodesChange` 回写到 store（仅在结构变更或拖拽结束时）

---

## 十、当前已支持的任务类型

**仅支持 Workflow（确定性流程）**：
- 线性流程、并行分支、条件判断、循环
- 每个节点有明确的输入/输出/执行方式
- 通过逐节点问答确认细节

**尚未支持 Agentic（智能规划）**：
- 目标导向的任务定义
- Skill 选择与编排
- 评估器配置
- 动态执行计划

---

## 十一、文件清单

```
src/
├── app/
│   ├── layout.tsx                    # 根布局
│   ├── page.tsx                      # 首页
│   ├── globals.css                   # 全局样式
│   ├── editor/
│   │   └── page.tsx                  # 编辑器页
│   └── api/
│       └── generate-flow/
│           └── route.ts              # LLM API 路由
├── components/
│   ├── layout/
│   │   └── TopBar.tsx                # 顶栏
│   ├── flow/
│   │   ├── FlowCanvas.tsx            # 画布
│   │   ├── FlowCardNode.tsx          # 自定义节点
│   │   ├── CanvasToolbar.tsx          # 画布工具条
│   │   └── NodeEditDialog.tsx         # 节点编辑弹窗
│   ├── panels/
│   │   ├── ChatPanel.tsx             # 对话面板
│   │   ├── QuestionCard.tsx          # 节点确认卡片
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
    ├── store.ts                      # Zustand 全局状态
    ├── types.ts                      # TypeScript 类型定义
    ├── flow-parser.ts                # LLM 响应解析 + 画布序列化
    ├── mock-data.ts                  # Mock 数据
    └── utils.ts                      # 工具函数（cn）
```
