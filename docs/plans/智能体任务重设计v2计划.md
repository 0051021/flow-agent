# Agentic 任务体验重设计 — Demo 实现计划

## 背景

当前 Agentic 任务在 Demo 中体验薄弱：策略卡片是技术语言堆砌（技能列表、约束、评估器），业务方看不懂；追问机制是扁平的逐条确认，没有优先级；Console 中 Agentic 任务缺少执行感和数据看板。

本次改动基于产品讨论的结论：
- 策略卡片 = 授权书 + 作战手册（目标 / 执行规则 / 权限边界 / 汇报机制）
- 追问按主题 + 优先级组织（P0 必须问 / P1 建议问 / P2 不主动问）
- Console 增加实时状态、趋势看板、策略演进三个执行期视角

## 改动范围

### 1. 策略卡片 v2 — 重写 StrategyCard 组件

**文件**: [src/components/panels/StrategyCard.tsx](src/components/panels/StrategyCard.tsx)

**当前状态**: 展示 goal(文字) + skills(列表) + humanCheckpoints + constraints(折叠) + evaluators(折叠) + techConfig(折叠)

**改为四个业务区域 + 折叠技术配置**:

1. **目标区域**: 核心指标 + 过程指标 + 底线指标（带行业基准对比）
2. **执行规则区域**: 分类展示用户给的规则（内容方向、发布节奏、合规红线等）
3. **权限边界区域**: 可自主决定的 vs 需审批的 + 兜底机制
4. **汇报机制区域**: 日报/周报/告警/里程碑
5. **内容预览区域**: Agent 生成的示例内容（mock）
6. **技术配置折叠**: 可用技能 + 三层评估器 + 执行参数

**顶部信息**: 预计周期 + 预计节省人力

**数据来源**: 从现有 `AgenticTaskConfig` 映射。需要扩展 `AgenticTaskConfig` 类型以支持新字段。

### 2. 区域置信度标记 — 扩展类型 + 卡片标记

**文件**: [src/lib/types.ts](src/lib/types.ts), [src/components/panels/StrategyCard.tsx](src/components/panels/StrategyCard.tsx)

新增类型:
```typescript
interface AgenticSectionConfidence {
  section: "goal" | "rules" | "permissions" | "reporting";
  confidence: "high" | "medium" | "low";
  reason: string;
  questions: AgenticConfirmItem[];
}
```

每个区域右上角根据 confidence 显示标记:
- low (红色) = 必须确认
- medium (黄色) = 建议确认
- high (绿色/无标记) = AI 有把握

点击标记展开该区域的追问卡片（内联展示，不跳转）。

### 3. 追问机制重做 — 替代 AgenticConfirmCard

**文件**: [src/components/panels/AgenticConfirmCard.tsx](src/components/panels/AgenticConfirmCard.tsx) (重写), [src/components/panels/ChatPanel.tsx](src/components/panels/ChatPanel.tsx)

**当前状态**: 逐条确认，按 section 分色，无优先级

**改为**:
- 追问内联在策略卡片的对应区域内展开
- AI 先给推断结果，用户确认/修改
- P0 问题（权限边界、合规红线）必须确认才能进入 ready
- P1 问题（规则细节、汇报偏好）可跳过用默认值
- 确认后标记变绿，内容回写到策略卡片

ChatPanel 中 `confirming_agentic` 阶段的逻辑需要适配：不再逐条弹出 AgenticConfirmCard，而是在策略卡片上标记待确认区域。

### 4. AgenticTaskConfig 类型扩展

**文件**: [src/lib/types.ts](src/lib/types.ts)

在现有 `AgenticTaskConfig` 基础上扩展:
```typescript
interface AgenticGoalMetrics {
  core: string;           // "3个月涨粉5万"
  process: string[];      // ["日均互动率 > 5%"]
  baseline: string[];     // ["月涨粉 < 1万 → 告警"]
  benchmarks?: string[];  // ["行业均值3%"]
}

interface AgenticExecutionRule {
  category: string;       // "内容方向" / "发布节奏" / "合规红线"
  rules: string[];
  source: "user_confirmed" | "ai_inferred";
}

interface AgenticPermission {
  autonomous: string[];   // Agent 可自主决定的
  needApproval: { trigger: string; description: string }[];
  safeguards: string[];   // 兜底机制
}

interface AgenticReporting {
  daily: { enabled: boolean; auto: boolean };
  weekly: { enabled: boolean; content: string };
  alerts: { triggers: string[] };
  milestones: string[];
  channel?: string;
}

interface AgenticContentPreview {
  samples: { title: string; summary: string; type: string }[];
}
```

在 `AgenticTaskConfig` 中新增:
```typescript
goalMetrics?: AgenticGoalMetrics;
executionRules?: AgenticExecutionRule[];
permissions?: AgenticPermission;
reporting?: AgenticReporting;
contentPreview?: AgenticContentPreview;
estimatedDuration?: string;
estimatedEfficiency?: string;
sectionConfidence?: AgenticSectionConfidence[];
```

### 5. UNIFIED_DRAFT_SYSTEM prompt 更新

**文件**: [src/app/api/generate-flow/route.ts](src/app/api/generate-flow/route.ts)

更新 `AGENTIC_JSON_SCHEMA` 以包含新字段（goalMetrics, executionRules, permissions, reporting, contentPreview, sectionConfidence）。

更新 `UNIFIED_DRAFT_SYSTEM` 中 Agentic 的规则说明，指导 AI:
- 从用户描述中提取目标指标并分层（核心/过程/底线）
- 推断执行规则并分类
- 推断权限边界（哪些可自主、哪些需审批）
- 设置汇报机制
- 生成 2-3 条示例内容预览
- 对每个区域评估置信度

### 6. Console 实时状态时间线 — 丰富 Agentic 任务 mock

**文件**: [src/lib/mock-console.ts](src/lib/mock-console.ts)

为小红书运营 Agent 新增一个运行中的 mock 任务（T-8001），包含丰富的时间线事件:
- 内容生成 → 合规扫描 → 发布成功（多轮）
- 数据采集事件
- 异常告警事件
- AI 建议事件（新事件类型）

新增事件类型 `ai_suggestion` 和 `data_report`。

### 7. Console 趋势看板 — Agentic 任务详情页增加看板区域

**文件**: [src/app/console/tasks/[id]/page.tsx](src/app/console/tasks/[id]/page.tsx), [src/lib/mock-console.ts](src/lib/mock-console.ts)

在任务详情页中，当 `taskType === "agentic"` 时，在时间线上方增加:
- 数据看板（涨粉趋势、互动率、内容效果对比）— mock 数据
- AI 建议卡片（采纳/忽略按钮）
- 一句话周报摘要

### 8. 策略演进时间线 — Agentic 任务详情页增加版本历史

**文件**: [src/app/console/tasks/[id]/page.tsx](src/app/console/tasks/[id]/page.tsx), [src/lib/mock-console.ts](src/lib/mock-console.ts)

在任务详情页底部增加"策略演进"区域:
- 水平时间线展示版本节点（v1 → v2 → v3）
- 每个版本显示调整摘要
- 点击可展开该版本的策略快照

Mock 数据: 3 个版本，展示从初始策略到数据驱动调整的过程。

## 实现顺序

1. 类型扩展（types.ts）— 基础依赖
2. Prompt 更新（route.ts）— AI 生成新格式
3. 策略卡片 v2（StrategyCard.tsx）— 核心 UI
4. 区域置信度 + 追问机制（StrategyCard + AgenticConfirmCard + ChatPanel）
5. Mock 数据扩展（mock-console.ts）— Console 依赖
6. Console 实时状态 + 看板 + 演进（tasks/[id]/page.tsx）

## 不在本次范围

- 真实的 AI 内容预览生成（用 mock）
- 真实的数据看板（用 mock 数据）
- 三层评估器的完整技术配置 UI（技术折叠区先用简化展示）
- REFINE_AGENTIC_SYSTEM prompt 的对应更新（后续跟进）
