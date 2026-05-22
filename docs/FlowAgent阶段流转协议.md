# FlowAgent 阶段流转协议

> 本文档定义 FlowAgent 从业务流程澄清到技术实施配置之间的阶段产物、责任边界和字段继承关系。
>
> 目标是避免把业务流程图、人机分工图、技术方案图、JobSpec 配置混成一张图。业务先确认真实流程，技术再确认人机分工和运行方案，实施方最后补资源绑定和生产控制配置。

---

## 1. 核心原则

### 1.1 先确认业务，再设计技术

FlowAgent 的阶段顺序必须遵守：

```text
业务流程事实
  -> 人机分工边界
  -> 技术运行方案
  -> 实施配置
  -> 发布运行
```

业务阶段只回答：

```text
业务现在如何发生？
每一步谁在做？
输入是什么？
产出是什么？
什么条件进入下一步？
什么情况返工、等待或终止？
```

业务阶段不回答：

```text
拆几个 Job？
绑定哪个 Skill？
调用哪个 Tool？
使用哪个 RuntimeProfile？
如何生成 JobSpec？
```

### 1.2 Job 拆分是技术运行形态

Job 拆分不属于业务流程事实。

例如 IMI 证书申请在业务上是一条连续流程：

```text
收到 Leader 邮件
-> 查找/补充 GSDS
-> 填写 IMI 申请大表
-> 业务核对
-> 提交代理/海关
-> 等待证书返回
-> 核验证书
-> 回填归档
```

后续拆成：

```text
Job A: GSDS PDF 入库
Job B: IMI 证书申请
```

这是技术方案阶段的运行设计，不应提前要求业务方理解或确认。

### 1.3 技术配置页消费前序协议

实施配置页不应该重新定义业务流程、人机分工或 Job 拆分。

实施配置页应该：

- 只读继承业务流程确认结果。
- 只读或受控继承人机分工结果。
- 继承技术方案中的 Job 拆分、触发器和系统边界。
- 只补实施阶段需要的资源绑定和生产控制配置。

---

## 2. 阶段总览

```text
BusinessFlowClarification
  -> BusinessFlowApproval
  -> ResponsibilityFlow
  -> ResponsibilityApproval
  -> TechnicalPlan
  -> SequenceDiagramSet
  -> ImplementationConfig
  -> JobSpec Release
```

| 阶段 | 主要角色 | 产物 | 目标 |
| --- | --- | --- | --- |
| 业务流程澄清 | 业务方 + 业务流程澄清 Agent | `BusinessFlowClarification` | 把真实业务流程讲清楚 |
| 业务流程确认 | 业务方 | `BusinessFlowApproval` | 确认流程事实 |
| 人机分工标注 | 技术方案方 | `ResponsibilityFlow` | 标注人 / AI / 系统 / 外部系统 / 路由 |
| 人机分工确认 | 业务方 + 技术方案方 | `ResponsibilityApproval` | 确认 AI 占比和责任边界 |
| 技术方案设计 | 技术方案方 | `TechnicalPlan` | 拆 Job、定触发、定系统边界和数据衔接 |
| 时序图生成 | 技术方案方 | `SequenceDiagramSet` | 可视化技术方案，服务评审沟通 |
| 实施配置 | 实施方 | `ImplementationConfig` | 绑定 Skill / Tool / Runtime / Policy |
| 发布运行 | 实施方 + 平台 | `JobSpec Release` | 导入、校验、发布、运行 |

---

## 3. 角色边界

### 3.1 业务方

业务方负责确认：

- 业务流程是否真实。
- 节点输入、输出、完成标准是否准确。
- 判断、审核、返工、等待、终止路径是否符合实际。
- 人机分工后 AI 占比、人工保留点和审核点是否可接受。

业务方不负责确认：

- Job 拆分。
- RuntimeProfile。
- Skill code。
- Tool code。
- ContextPolicy。
- Secret。
- JobSpec 字段细节。

### 3.2 技术方案方

技术方案方负责：

- 在业务流程图上标注执行责任。
- 判断哪些节点可由 AI、系统规则、外部系统或人工承接。
- 计算并解释 AI 占比。
- 设计 Job 拆分。
- 设计触发方式、数据边界和系统交互。
- 生成时序图用于方案评审。

技术方案方不应该直接进入：

- 具体 Skill / Tool 开发。
- 生产参数调优。
- JobSpec 逐字段配置。

### 3.3 实施方

实施方负责：

- 将已确认技术方案落成可执行配置。
- 绑定已注册资源。
- 补齐 Task input/output schema 的技术细节。
- 配置超时、重试、幂等、审计、校验、人工审核策略。
- 生成和发布 JobSpec。

实施方不应该重新判断：

- 业务流程是否应该改。
- AI/人工责任边界是否应该改。
- Job 是否应该重新拆分。

如确需修改，应触发对应阶段的变更流程。

---

## 4. 阶段产物

### 4.1 BusinessFlowClarification

来源：业务描述、业务文件、规则文件、模板、样例。

已有文档：

- `docs/业务流程澄清上下文与提示词.md`
- `docs/业务流程生成提示词.md`

核心字段：

```ts
interface BusinessFlowClarification {
  artifactType: "business_flow_clarification";
  jobName: string;
  businessFlow: {
    flowId: string;
    version: number;
    nodes: BusinessFlowNode[];
    edges: BusinessFlowEdge[];
  };
  nodeClarifications?: NodeClarification[];
  fileUseLog?: FileUseLog[];
  globalOpenQuestions?: BusinessQuestion[];
}
```

业务节点：

```ts
interface BusinessFlowNode {
  nodeId: string;
  title: string;
  workUnitKind:
    | "manual_operation"
    | "business_judgment"
    | "document_check"
    | "handoff_wait"
    | "rework_update";
  description: string;
  owner: string;
  inputs: BusinessIO[];
  outputs: BusinessIO[];
  operationSteps?: string[];
  judgmentSpec?: JudgmentSpec | null;
  businessRules?: BusinessRule[];
  doneCriteria: string;
  suggestedFileRefs?: SuggestedFileRef[];
}
```

业务边：

```ts
interface BusinessFlowEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: string;
}
```

注意：

- 业务边的 `condition` 可以是自然语言。
- 业务阶段不需要把条件拆成可执行表达式。
- 路由、返工、等待、终止都可以存在于业务图中，但只表达业务事实。

### 4.2 BusinessFlowApproval

来源：业务方确认后的 `BusinessFlowClarification`。

作用：冻结业务流程事实，作为后续责任标注和技术方案的输入。

```ts
interface BusinessFlowApproval {
  sourceFlowId: string;
  sourceVersion: number;
  status: "approved" | "revision_requested";
  approvedBy?: string;
  approvedAt?: string;
  revisionReason?: string;
  lockedBusinessNodeIds: string[];
}
```

规则：

- 业务流程确认后，后续阶段不能静默修改业务事实。
- 若技术方案发现业务流程需要拆、合、改，应回到业务流程修订。

### 4.3 ResponsibilityFlow

来源：已确认的 `BusinessFlowClarification`。

作用：在业务流程结构上标注未来由谁承接。

```ts
type ResponsibilityActor =
  | "human"
  | "ai"
  | "system_rule"
  | "external_system"
  | "router";

interface ResponsibilityFlow {
  artifactType: "responsibility_flow";
  sourceBusinessFlowId: string;
  sourceBusinessFlowVersion: number;
  version: number;
  nodes: ResponsibilityNode[];
  edges: ResponsibilityEdge[];
  metrics: ResponsibilityMetrics;
  openQuestions?: ResponsibilityQuestion[];
}
```

责任节点：

```ts
interface ResponsibilityNode {
  businessNodeId: string;
  actor: ResponsibilityActor;
  deliverables: {
    name: string;
    sourceOutputName?: string;
    owner: ResponsibilityActor;
    acceptanceHint?: string;
  }[];
  humanReviewRequired?: boolean;
  reworkAllowed?: boolean;
  reworkTargetBusinessNodeIds?: string[];
  rationale?: string;
  riskNotes?: string[];
}
```

责任边：

```ts
interface ResponsibilityEdge {
  sourceBusinessNodeId: string;
  targetBusinessNodeId: string;
  routeKind?: "normal" | "conditional" | "rework" | "terminate" | "wait";
  conditionText?: string;
}
```

AI 占比指标：

```ts
interface ResponsibilityMetrics {
  totalWorkNodes: number;
  aiWorkNodes: number;
  humanWorkNodes: number;
  systemWorkNodes: number;
  externalSystemNodes: number;
  routerNodes: number;
  aiNodeRatio: number;
  aiDeliverableRatio?: number;
  humanReviewCount: number;
  estimatedHumanEffortSavedRatio?: number;
}
```

规则：

- 责任图默认继承业务流程图的节点和边。
- 初始状态所有工作节点可为 `pending` 或待选择，技术方案方逐节点标注。
- 路由节点不进入工作交付物统计。
- 一个工作节点应有唯一最终责任主体。

### 4.4 ResponsibilityApproval

来源：业务方和技术方案方共同确认的 `ResponsibilityFlow`。

作用：确认 AI 占比、人工保留点和责任边界。

```ts
interface ResponsibilityApproval {
  sourceResponsibilityFlowId: string;
  sourceVersion: number;
  status: "approved" | "revision_requested";
  approvedByBusiness?: string;
  approvedByTech?: string;
  approvedAt?: string;
  aiRatioAccepted: boolean;
  notes?: string[];
}
```

规则：

- 修改 `actor`、`humanReviewRequired`、AI 交付物或返工路径，应重新确认 AI 占比。
- 该阶段确认的是“未来工作方式”，不是 Job 拆分。

### 4.5 TechnicalPlan

来源：已确认的 `ResponsibilityFlow`。

作用：技术方案方决定运行形态。

```ts
interface TechnicalPlan {
  artifactType: "technical_plan";
  sourceResponsibilityFlowId: string;
  sourceResponsibilityFlowVersion: number;
  version: number;
  jobs: TechnicalJobPlan[];
  dataProducts: DataProductPlan[];
  integrations: IntegrationPlan[];
  risks?: TechnicalRisk[];
  openQuestions?: TechnicalQuestion[];
}
```

Job 方案：

```ts
interface TechnicalJobPlan {
  jobId: string;
  name: string;
  purpose: string;
  includedBusinessNodeIds: string[];
  trigger: {
    type: "event" | "schedule" | "manual" | "external";
    description: string;
    candidateTriggerCode?: string;
  };
  inputDataProducts?: string[];
  outputDataProducts?: string[];
  downstreamJobIds?: string[];
  splitRationale?: string;
}
```

数据产品：

```ts
interface DataProductPlan {
  id: string;
  name: string;
  ownerJobId?: string;
  description: string;
  usedByJobIds: string[];
  storageHint?: "database" | "object_storage" | "spreadsheet" | "external_system" | "unknown";
}
```

系统集成：

```ts
interface IntegrationPlan {
  systemName: string;
  role: "source" | "sink" | "lookup" | "external_actor";
  relatedBusinessNodeIds: string[];
  accessReadiness?: "ready" | "partial" | "manual_only" | "unknown";
}
```

规则：

- Job 拆分只存在于 `TechnicalPlan`，不写回业务流程图。
- 每个 Job 必须能追溯到原始业务节点。
- 同一个业务流程可以拆成多个 Job。
- 跨 Job 自动触发不是默认假设，必须显式声明。

### 4.6 SequenceDiagramSet

来源：`TechnicalPlan`。

作用：可视化技术方案，服务技术方案评审。

```ts
interface SequenceDiagramSet {
  artifactType: "sequence_diagram_set";
  sourceTechnicalPlanId: string;
  sourceTechnicalPlanVersion: number;
  diagrams: SequenceDiagramArtifact[];
}
```

时序图：

```ts
interface SequenceDiagramArtifact {
  diagramId: string;
  scope: "global" | "job" | "exception";
  relatedJobIds: string[];
  title: string;
  participants: string[];
  messages: {
    from: string;
    to: string;
    label: string;
    type?: "sync" | "async";
    relatedBusinessNodeId?: string;
  }[];
  notes?: string[];
}
```

规则：

- 时序图不直接从业务流程图生成。
- 时序图应在技术方案草案之后生成。
- 默认至少包含：
  - 全局技术方案时序图。
  - 每个 Job 的局部时序图。
  - 关键异常或返工回路时序图。

### 4.7 ImplementationConfig

来源：已确认的 `TechnicalPlan` 和 `SequenceDiagramSet`。

作用：实施方补齐可执行配置。

```ts
interface ImplementationConfig {
  artifactType: "implementation_config";
  sourceTechnicalPlanId: string;
  sourceTechnicalPlanVersion: number;
  jobs: ImplementationJobConfig[];
  resourceGaps?: ResourceGap[];
  testRequirements?: TestRequirement[];
}
```

Job 实施配置：

```ts
interface ImplementationJobConfig {
  jobId: string;
  jobCode: string;
  taskMappings: ImplementationTaskMapping[];
  triggerBinding?: {
    triggerCode: string;
    inputSchemaRef?: string;
  };
}
```

Task 映射：

```ts
interface ImplementationTaskMapping {
  businessNodeId: string;
  responsibilityActor: ResponsibilityActor;
  taskCode: string;
  taskType: "agentic" | "integration" | "deterministic" | "human_review" | "manual_action";
  inputSchema?: unknown;
  outputSchema?: unknown;
  skillCodes?: string[];
  toolCodes?: string[];
  runtimeProfileCode?: string;
  contextPolicyCode?: string;
  reviewPolicyCode?: string;
  secretRefs?: string[];
  retryPolicy?: unknown;
  auditPolicy?: unknown;
}
```

规则：

- 实施配置页应显示字段来源。
- 继承字段默认只读。
- 推导字段允许确认或提出变更。
- 实施字段由实施方填写。

---

## 5. 字段继承关系

### 5.1 技术配置页字段来源

| 字段 | 来源 | 技术配置页行为 |
| --- | --- | --- |
| 节点名称 | `BusinessFlowNode.title` | 只读继承 |
| 节点业务描述 | `BusinessFlowNode.description` | 只读继承 |
| 输入/输出业务含义 | `BusinessFlowNode.inputs/outputs` | 继承，可补技术 schema |
| 完成标准 | `BusinessFlowNode.doneCriteria` | 只读或弱编辑 |
| 业务规则 | `BusinessFlowNode.businessRules` | 只读继承 |
| AI / 人 / 系统责任 | `ResponsibilityNode.actor` | 只读或变更需回审 |
| 是否人工审核 | `ResponsibilityNode.humanReviewRequired` | 只读或变更需回审 |
| Job 拆分 | `TechnicalPlan.jobs[]` | 继承，不应重新手拆 |
| Trigger 初始建议 | `TechnicalJobPlan.trigger` | 继承，实施方绑定 code |
| 系统边界 | `TechnicalPlan.integrations[]` | 继承，实施方绑定 Tool/Secret |
| Task 类型 | `ResponsibilityNode.actor` 推导 | 实施方确认 |
| Task code | 实施阶段 | 实施方填写 |
| Skill / Tool / Runtime | 实施阶段 | 实施方填写 |
| ContextPolicy / ReviewPolicy | 实施阶段 | 实施方填写 |
| Retry / Timeout / Audit | 实施阶段 | 实施方填写 |

### 5.2 字段分类

```text
继承字段：
  前面阶段已经确认，技术配置页不重新定义。

推导字段：
  根据前序协议自动生成初始值，实施方确认。

实施字段：
  只有实施阶段才填写。
```

### 5.3 Demo 截图标注：字段从哪里来

下面按阶段顺序标注一次字段来源。前两张从业务流程图开始：业务方只确认真实流程、节点资料与产出，不要求业务方提前理解 Job 拆分、Skill、Tool 或 Runtime。后面几张才进入技术方案和实施配置，说明前序协议如何自动流入后续界面，避免重复填写。

#### 5.3.1 业务流程确认：从业务描述到业务流程图

![IMI demo 业务流程图字段标注](/Users/yihui/Desktop/jyh/flow-agent/docs/images/flow-protocol/demo-business-imi-flow-annotated.png)

| 界面内容 | 对应协议字段 | 说明 |
| --- | --- | --- |
| 左侧业务原始描述 | `BusinessFlowClarification.source` / 业务上下文 | 业务方讲真实工作：收到邮件、查 GSDS、填写大表、提交代理、证书归档 |
| 业务流程已确认摘要 | `BusinessFlowApproval` | 表示业务事实已经冻结，后续技术阶段不能静默改写 |
| 中间业务流程图 | `businessFlow.nodes` / `businessFlow.edges` | 节点和边描述业务发生顺序，不表达 Skill / Tool / Runtime |
| 顶部角色与阶段 | 阶段元数据 | 同一流程在业务方视角下查看，处于后续技术评审阶段 |
| 技术拆分建议 | `TechnicalPlan` 的输入线索 | 技术可以建议 Job Group / Job 拆分，但这是业务流程确认之后的阶段 |

#### 5.3.2 业务节点详情：最小交付物和输入输出

![IMI demo 业务节点资料与产出字段标注](/Users/yihui/Desktop/jyh/flow-agent/docs/images/flow-protocol/demo-business-imi-node-io-annotated.png)

| 界面内容 | 对应协议字段 | 说明 |
| --- | --- | --- |
| 节点标题 | `BusinessFlowNode.title` / `nodeId` | 这是业务节点身份，后续人机分工、技术方案和实施配置都应沿用 |
| 需要提供 | `BusinessFlowNode.inputs[]` | 业务定义这个节点开始工作需要什么，不定义技术调用方式 |
| 必填标记 | `BusinessIO.required` | 进入后续 schema 编辑器时应直接体现为 required / optional |
| 来源说明 | `BusinessIO.source` 或 `sourceNodeId` | 表示来自上一步、默认值、外部材料或业务输入 |
| 会产出 | `BusinessFlowNode.outputs[]` | 节点必须承载的最小交付物，后续可成为路由条件或下游输入 |
| 输出含义说明 | `BusinessIO.description` | 后续技术 schema 可补类型和结构，但不应丢失业务语义 |

#### 5.3.3 技术配置页继承业务流程和技术方案

![GSDS demo 全局流程字段标注](/Users/yihui/Desktop/jyh/flow-agent/docs/images/flow-protocol/demo-business-flow-annotated.png)

| 界面内容 | 对应协议字段 | 说明 |
| --- | --- | --- |
| 左侧业务原始描述 | `BusinessFlowClarification.source` / 业务上下文 | 业务方只讲真实工作，不要求拆 Job 或定技术实现 |
| 左侧步骤列表 | `BusinessFlowNode[]` | 生成业务节点的 `title`、`description`、`inputs`、`outputs`、`doneCriteria` |
| 中间画布节点和边 | `businessFlow.nodes` / `businessFlow.edges` | 业务流程确认后，后续阶段沿用同一批 `nodeId` |
| 顶部阶段、角色、审批状态 | 阶段元数据 | 表示当前处于技术评审或实施配置等阶段 |
| 右侧基础信息 | `jobName`、`jobCode`、`TechnicalPlan.jobs[]` | 名称和说明应优先从业务流程与技术方案继承，实施方只确认或补 code |
| 右侧触发条件 | `TechnicalJobPlan.trigger` / `ImplementationJobConfig.triggerBinding` | 技术方案给出触发建议，实施配置页绑定已注册 Trigger code |

#### 5.3.4 单个 Task 的继承和实施补齐

![GSDS demo 人工审核节点字段标注](/Users/yihui/Desktop/jyh/flow-agent/docs/images/flow-protocol/demo-human-binding-annotated.png)

| 界面内容 | 对应协议字段 | 说明 |
| --- | --- | --- |
| 选中的画布节点 | `businessNodeId` | 同一个业务节点 ID 贯穿业务图、人机分工、技术方案和实施配置 |
| 节点标题 | `BusinessFlowNode.title` -> `Task.name` 初始值 | 实施页不重新命名业务动作；如需改名应回到业务流程阶段 |
| Task 编码 | `ImplementationTaskMapping.taskCode` | 实施字段，可由标题派生初始值，但最终要满足平台唯一性 |
| 输出字段 | `BusinessFlowNode.outputs` -> `outputSchema` | 业务阶段定义交付物语义，实施阶段补齐技术 schema |
| 审核产物字段 | `approval_decision`、`approved_record`、`review_comment` | 这些字段会成为后续路由节点可选择的前序输出 |
| Task 类型 | `ResponsibilityNode.actor` 推导 `taskType` | 人机分工确认后，实施页自动得到 `human_review` 等类型建议 |
| 人工审核策略 | `ImplementationTaskMapping.reviewPolicyCode` | 实施阶段绑定已注册 ReviewPolicy，不改变业务责任边界 |

#### 5.3.5 路由条件和返工/终止路径

![GSDS demo 路由节点字段标注](/Users/yihui/Desktop/jyh/flow-agent/docs/images/flow-protocol/demo-route-conditions-annotated.png)

| 界面内容 | 对应协议字段 | 说明 |
| --- | --- | --- |
| 路由节点标题 | `ResponsibilityNode.actor = "route"` 或技术方案 route node | 路由节点不承载交付物，不进入 `tasks[]` |
| 路由含义 | `BusinessFlowEdge.condition` 的技术化说明 | 从业务自然语言条件，翻译成可执行条件的语义说明 |
| 分支列表 | `ConditionBranch[]` | 每个分支最终编译为一条 `flow.condition` 或默认 `otherwise` |
| 全部/任一 | `ConditionGroup.logic` | 支持多个字段同时满足、或任一字段满足才进入分支 |
| 前序输出字段 | `ConditionRule.sourceNodeId/sourceOutputId/sourceOutputPath` | 字段选择来自任意前序节点的 `outputs`，并携带类型 |
| 判断方式和值 | `ConditionRule.operator` / `ConditionRule.compareValue` | 字符串、数字、布尔值应按字段类型提供不同输入控件 |
| 目标节点 | `ConditionBranch.targetNodeId` | 分支可以走向后续节点，也可以返回某个前序工作节点形成返工回路 |
| else 分支 | `otherwise` | 未命中任何条件时的兜底路径，可终止、等待或返工 |

---

## 6. 变更规则

| 变更内容 | 应回到哪个阶段 |
| --- | --- |
| 修改业务节点名称、描述、输入输出、完成标准 | 业务流程澄清 / 业务流程确认 |
| 修改流程边、返工路径、等待路径、终止路径 | 业务流程澄清 / 业务流程确认 |
| 修改 AI / 人工 / 系统责任主体 | 人机分工确认 |
| 修改 AI 占比、人工审核点、AI 交付物 | 人机分工确认 |
| 修改 Job 拆分、触发方式、跨 Job 数据依赖 | 技术方案设计 |
| 修改时序图交互中的系统边界 | 技术方案设计 |
| 修改 Skill / Tool / Runtime / Policy 绑定 | 实施配置 |
| 修改超时、重试、幂等、审计策略 | 实施配置，必要时技术方案复核 |

原则：

```text
后序阶段可以提出变更，但不能静默改写前序已确认事实。
```

---

## 7. IMI 证书申请示例

### 7.1 业务流程确认

业务方确认一条业务线：

```text
收到 Leader 邮件
-> 查找 GSDS 资料
-> 填写 IMI 申请大表
-> 业务核对申请资料
-> 提交中外运/海关
-> 等待证书返回
-> 核验证书字段
-> 回填证书信息并归档
```

### 7.2 人机分工确认

技术方案方标注：

```text
Leader 邮件解析：AI
GSDS 查找/字段抽取：AI / 系统
IMI 大表填写：AI
业务核对：人
提交代理/海关：系统或人工，视接口情况
等待证书：外部系统 / 人工跟进
证书核验：AI + 人工确认
回填归档：系统
```

业务方确认：

```text
AI/系统承接若干节点
人工保留关键审核点
高风险动作不直接自动提交
审核不通过可返工
```

### 7.3 技术方案设计

技术方案方拆分：

```text
Job A: GSDS PDF 入库
触发：SharePoint 新增 GSDS PDF
产出：GSDS 主库记录

Job B: IMI 证书申请
触发：Leader 邮件 / 人工发起
依赖：GSDS 主库
产出：IMI 申请记录、证书归档记录
```

拆分理由：

```text
GSDS 是资料沉淀型流程，可独立触发。
IMI 是按单申请流程，应复用已入库 GSDS 数据。
两个 Job 通过 GSDS 主库解耦。
```

### 7.4 时序图生成

基于技术方案生成：

```text
全局时序图：
SharePoint -> GSDS Ingest Job -> GSDS DB
Leader Email -> IMI Job -> GSDS DB -> 人工审核 -> 中外运/海关 -> 证书回传 -> 归档

Job A 局部时序图：
SharePoint -> Scheduler -> PDF Parser -> Validator -> Human Review -> GSDS DB

Job B 局部时序图：
Leader Email -> IMI Parser -> GSDS DB Lookup -> Application Sheet Generator -> Human Review -> Submit -> Certificate Check -> Archive
```

### 7.5 实施配置

实施方补齐：

```text
Job code
Task code
Skill codes
Tool codes
RuntimeProfile
ContextPolicy
ReviewPolicy
Secret refs
input_schema / output_schema
retry / timeout / audit
```

---

## 8. 与现有文档的关系

| 文档 | 关系 |
| --- | --- |
| `业务流程澄清上下文与提示词.md` | 定义业务流程澄清稿和业务侧上下文 |
| `业务流程生成提示词.md` | 定义首次业务流程生成 prompt 和输出结构 |
| `可执行Schema规范.md` | 定义最终可执行 Schema 与 JobSpec 映射 |
| `FlowAgent技术配置决策记录.md` | 记录技术配置页字段和 JobSpec 绑定决策 |
| 本文档 | 定义上述文档之间缺失的阶段流转协议 |

---

## 9. 后续落地建议

1. 在前端状态中显式引入阶段：

```text
business_flow_draft
business_flow_approved
responsibility_reviewing
responsibility_approved
technical_planning
technical_plan_approved
implementation_configuring
ready_to_publish
```

2. 技术配置页增加字段来源标记：

```text
来自业务流程确认
来自人机分工确认
来自技术方案
实施待配置
```

3. 将 Job 拆分功能从实施配置页前移到技术方案阶段。

4. 时序图从 `TechnicalPlan` 生成，而不是直接从 `BusinessFlow` 生成。

5. 实施配置页只允许对前序已确认内容提出变更请求，不直接静默修改。
