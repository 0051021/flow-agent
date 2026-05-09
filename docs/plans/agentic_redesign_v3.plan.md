# Agentic 体验重设计 v3 — 阶段画布 + 两阶段生成

## 背景与问题

v2 的策略卡片虽然内容更丰富了，但暴露了根本性的体验问题：

1. **业务方不会看**：一张长卡片，信息密度太高，滚动下来全是文字，没有交互感
2. **内容空洞无逻辑**：按字段类型平铺（目标/规则/权限/汇报），没有叙事主线，业务方不知道"所以呢？"
3. **业务技术混杂**：首次生成就包含技术字段（skills/evaluators），业务方没确认策略就生成技术配置没有意义
4. **缺少追问机制**：Workflow 有节点级置信度+追问，Agentic 没有，AI 在猜业务方也在猜
5. **hybrid 是伪概念**：Agentic 任务内部天然有流程（决策循环），不需要单独的 hybrid 类型
6. **prompt 架构混乱**：一个巨大的 system prompt 混合了分类/业务/技术三种职责

## 核心设计决策

### 决策 1：去掉 hybrid，只保留 workflow 和 agentic

- workflow：有明确步骤顺序，每步输入输出确定
- agentic：有目标但路径不固定，需要 AI 自主规划（包含原来的 hybrid）

### 决策 2：Agentic 右侧面板从"策略卡片"变为"阶段画布"

与 Workflow 的流程图画布对称：
- Workflow 右侧 = 节点+箭头的流程图
- Agentic 右侧 = 阶段+时间线的看板画布

### 决策 3：两阶段生成（业务侧 → 技术侧）

- 阶段 1：AI 生成业务方案（阶段规划+决策点+兜底），业务方逐阶段确认
- 阶段 2：业务确认后，点击按钮生成技术配置（Skill/编排/调度）

### 决策 4：prompt 按角色分两套

- 业务方 prompt：业务分析师角色，只生成业务侧内容
- 技术方 prompt：系统架构师角色，基于已确认的业务配置生成技术侧
- 两套 prompt 通过 agenticConfig 作为桥梁连接，保留完整上下文

### 决策 5：AI 先追问再生成

不是"用户输入 → 直接生成方案"，而是"用户输入 → AI 追问 3-5 个关键问题 → 再生成方案"。
追问嵌在阶段详情里，不是单独的问题列表。

## 用户旅程

```
用户输入业务描述
    ↓
AI 判断类型（workflow / agentic）
    ↓ agentic
AI 生成阶段规划（业务侧）
    ↓
右侧画布展示阶段看板
    ↓
用户逐阶段确认（每个阶段可展开编辑、回答追问）
    ↓
全部确认 → 画布切换为总览模式
    ↓
用户/技术方点击"生成技术配置"
    ↓
AI 基于已确认的业务配置生成技术侧
    ↓
技术配置展示在总览模式下方
    ↓
提交审阅 / 导出方案
```

## 数据结构

### AgenticPhase（新增，核心类型）

```typescript
interface AgenticPhase {
  id: string;                    // "phase-1"
  name: string;                  // "冷启动"
  dayRange: [number, number];    // [3, 5]
  status: "confirmed" | "reviewing" | "pending";

  // 业务方关心的
  actions: string[];             // ["每天生成1条内容", "隔天发布", "不挂车"]
  successCriteria: {             // 阶段评估（业务方定义）
    good: string;                // "播放>1000"
    warning: string;             // "播放500-1000"
    bad: string;                 // "播放<500，换模板"
  };
  exitCondition: string;         // "发满3条，选出最佳模板"
  requiresApproval: boolean;     // 是否需要人工审批才能进入下一阶段
  approvalDescription?: string;  // "选品方案需确认"

  // AI 追问
  questions?: AgenticPhaseQuestion[];

  // 技术方关心的（阶段 2 生成）
  requiredCapabilities?: string[];  // ["内容生成", "定时发布", "数据采集"]
  // → 技术侧会把这些映射为具体的 Skill
}

interface AgenticPhaseQuestion {
  id: string;
  question: string;
  context: string;
  options?: string[];
  answer?: string;
}
```

### AgenticTaskConfig（重构）

```typescript
interface AgenticTaskConfig {
  // === 业务侧（阶段 1 生成）===
  goal: string;                    // 总目标
  background: string;              // 背景
  totalDays: number;               // 总周期
  phases: AgenticPhase[];          // 阶段列表（核心）
  globalSuccessCriteria: string;   // 全局成功标准
  approvalPoints: string[];        // 需要审批的决策点摘要
  fallbacks: AgenticFallback[];    // 兜底机制
  constraints: AgenticConstraint[];

  // === 技术侧（阶段 2 生成）===
  skills: AgenticSkill[];
  evaluators: AgenticEvaluator[];
  executionStrategy: AgenticExecutionStrategy;
  maxIterations: number;
  humanCheckpoints: string[];
  decisionLoop?: AgenticDecisionLoop;
  skillOrchestration?: AgenticSkillOrchestration;
  contextArchitecture?: AgenticContextLayer;
  schedule?: AgenticSchedule;
}

interface AgenticFallback {
  trigger: string;      // "连续3天涨粉不足"
  action: string;       // "告警 + 建议调整策略"
  severity: "critical" | "warning" | "info";
}
```

### 评估器三层架构

```
第一层：阶段评估（业务方定义）
  → AgenticPhase.successCriteria
  → 在阶段画布的每个阶段里展示
  → 业务方可直接编辑

第二层：Skill 评估（技术方定义）
  → AgenticSkill.evaluator
  → 在技术配置区域展示
  → 技术方在生成后调整

第三层：全局评估（双方共同定义）
  → AgenticTaskConfig.globalSuccessCriteria + evaluators
  → 在画布顶部的目标区域展示
  → 业务方定目标，技术方定衡量方式
```

## Prompt 架构

### 分类 prompt（轻量，复用现有）

```
输入：用户描述
输出：{ taskType: "workflow" | "agentic", reason: string }
```

### 业务方 prompt（新增）

```
角色：资深业务分析师
输入：用户描述 + 追问回答（如有）
输出：{
  goal, background, totalDays,
  phases: AgenticPhase[],
  globalSuccessCriteria,
  approvalPoints,
  fallbacks,
  constraints
}

规则：
- 把业务描述拆解为 3-7 个阶段
- 每个阶段包含：做什么、判断标准、结束条件
- 标记需要人工审批的阶段
- 对不确定的阶段生成追问
- 不生成任何技术字段（skills/evaluators 等）
```

### 技术方 prompt（新增）

```
角色：AI 系统架构师
输入：已确认的业务配置（完整 agenticConfig 的业务侧字段）
输出：{
  skills, evaluators, executionStrategy, maxIterations,
  humanCheckpoints, decisionLoop, skillOrchestration,
  contextArchitecture, schedule
}

规则：
- 根据每个阶段的 actions 和 requiredCapabilities 推导 Skill
- 根据阶段间的关系推导 Skill 编排
- 根据阶段的 successCriteria 推导评估器
- 根据阶段的时间安排推导调度触发器
```

### Refine prompt（保持独立）

- 业务侧 refine：修改阶段内容
- 技术侧 refine：修改技术配置

## UI 组件结构

### 右侧面板：AgenticCanvas（新组件）

替代现有的 StrategyCard，与 FlowCanvas 对称。

```
AgenticCanvas
├── PhaseTimeline          // 顶部阶段条（横向）
│   └── PhaseNode          // 每个阶段节点（状态标记）
├── PhaseDetail            // 下方展开的阶段详情
│   ├── ActionList         // 做什么（可编辑）
│   ├── SuccessCriteria    // 判断标准（可编辑）
│   ├── ExitCondition      // 结束条件（可编辑）
│   ├── PhaseQuestion      // AI 追问（嵌入式）
│   └── ConfirmButton      // 确认按钮
├── OverviewMode           // 全部确认后的总览视图
│   ├── GoalBanner         // 目标横幅
│   ├── PhaseFlowChart     // 阶段流程图（可视化）
│   ├── ApprovalPoints     // 决策点摘要
│   ├── FallbackList       // 兜底机制
│   └── TechConfigPanel    // 技术配置（折叠，含生成按钮）
└── ActionBar              // 底部操作栏（提交/导出/继续调整）
```

### 左侧聊天面板

角色变化：从"主要交互区"变为"辅助对话区"
- 初始输入仍在左侧
- AI 的阶段生成结果提示在左侧（"已生成5个阶段，请在右侧确认"）
- 全局性的修改对话在左侧（"我想加一个阶段"、"整体方向要调"）
- 阶段级别的编辑和追问在右侧画布内完成

## 实现顺序

### Phase 1：基础重构
1. types.ts — 新增 AgenticPhase 等类型，重构 AgenticTaskConfig
2. store.ts — 新增阶段管理方法（updatePhase, confirmPhase 等）
3. 去掉 hybrid 类型（types.ts, route.ts, ChatPanel.tsx）

### Phase 2：Prompt 拆分
4. route.ts — 拆分为业务方 prompt + 技术方 prompt
5. route.ts — 新增 generate_phases action（业务侧生成）
6. route.ts — 保留 generate_tech action（技术侧生成）

### Phase 3：阶段画布
7. AgenticCanvas.tsx — 新组件，替代 StrategyCard 在 agentic 场景的角色
8. PhaseTimeline.tsx — 阶段时间线
9. PhaseDetail.tsx — 阶段详情（含编辑、追问）
10. OverviewMode.tsx — 总览视图

### Phase 4：串联
11. ChatPanel.tsx — 适配新的阶段生成流程
12. editor/page.tsx — 根据 taskType 切换 FlowCanvas / AgenticCanvas
13. mock-reviews.ts — 更新 mock 数据适配新结构

### Phase 5：打磨
14. 超时 fallback 修复
15. 内联编辑体验优化
16. 技术配置生成按钮交互

## 不在本次范围

- Console 执行期视图（Day 1-N 的执行日报）— 后续迭代
- 真实的 AI 内容生成 — 用 mock
- 多实例/矩阵运营支持 — 等真实业务需求明确后再设计
- Workflow 的两阶段拆分 — Agentic 做好标杆后再参照
