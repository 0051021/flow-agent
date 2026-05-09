# FlowAgent 可执行 JSON Schema 规范

> 版本：v2.5 | 最后更新：2026-04-30
>
> 本文档定义 FlowAgent **Workflow 类型项目**的可执行 JSON Schema 规范。
> 它是整个产品从"业务描述"走向"可执行 Job"的 **中间表示（IR）**——
> 最终目标是**自动映射为 task-platform 的 JobSpec**，经 validate → import → publish 后由执行层运行。
>
> **与 Agent Runtime Protocol 对齐**：task-platform 将 Job/Task 物化为 Runtime Pack（`execution-envelope.json`、`context.json`、`skills/`、`tools/`、`mcp.json`）。本文档字段映射目标包含 JobSpec/Task，以及向下游 Runtime Pack 中 **Task 扩展字段**（如 `task.type`、`deliverables`、`acceptance_criteria`、`context.execution_plan.skill_contracts`、`policies.timeout`）所需的结构化来源。
>
> 相关文档：
>
> - 产品 PRD → `[flowagent-product.md](./flowagent-product.md)`（含 **§1.1.4 业务一体化与技术多 Job 导出**：业务一条线、技术方可拆多 Job 的平台要求）
> - 架构全景 → `[architecture-panorama.md](./architecture-panorama.md)`
> - 上下文架构 → `[context-architecture.md](./context-architecture.md)`
> - Skill 平台架构 → `[skill-architecture-thinking.md](./skill-architecture-thinking.md)`
> - 产品矩阵（含执行层架构）→ `[product-matrix.md](./product-matrix.md)`

---

## 一、设计原则

### 1.1 定位

FlowAgent Schema 不是执行层直接消费的运行时配置，也不是喂给 LLM 生成代码的规范。

它的定位是：

```
自然语言 SOP
    ↓ ① AI 业务翻译
FlowAgent Schema 骨架（业务方确认）
    ↓ ② 技术方介入
        在 task-platform 注册 Skill/Tool/Secret/Runtime/ReviewPolicy/ContextPolicy
        把资源 code 回填到 Schema 的 binding 字段
    ↓ ③ 导出 JobSpec（纯搬运映射）
task-platform validate → import → publish
    ↓ ④ Runtime 调度执行
```

**Schema 是 FlowAgent 和 task-platform 之间的桥梁**，它需要：

1. **对业务方友好** — 业务翻译阶段产出的骨架，业务方能看懂每个节点做什么
2. **对技术方可操作** — 技术方看着骨架就能决定绑什么 Skill/Tool/Runtime，并把确认结果回填
3. **对映射器纯搬运** — 技术方确认后，映射器直接引用 Schema 中的 code 生成 JobSpec，不推断、不猜

### 1.2 核心原则


| 原则              | 说明                                                                         |
| --------------- | -------------------------------------------------------------------------- |
| **两阶段分离**       | 阶段 1（业务翻译）只有业务骨架，阶段 2（技术确认）补全所有 binding；映射器只消费阶段 2 的完整 Schema              |
| **binding 即真相** | Schema 中的 `xxxBinding` 字段是技术方已确认、已在平台注册的资源 code，不是建议、不是推断                  |
| **分层架构**        | 项目级声明全局共享资源（文档、外部系统），节点级引用资源并描述业务意图                                        |
| **单一来源**        | 同一份文档/外部系统只定义一次，节点通过 `docRef` / `externalRef` 引用                           |
| **业务意图而非执行指令**  | `businessIntent` 描述"做什么"（业务意图），不描述"怎么做"（Skill/Tool 内部逻辑）                   |
| **不越界**         | Schema 不管 runtime/dependencies/secret 注入/Skill 内部实现——这些是 task-platform 的职责 |


### 1.3 与 task-platform 注册协议的关系


| FlowAgent Schema 负责   | task-platform 注册协议负责                  |
| --------------------- | ------------------------------------- |
| 描述业务流程（节点、数据流、人机分工）   | 注册可复用资源（Secret、Tool、Skill、Runtime...） |
| 标注每个节点的业务意图和数据契约      | 定义 JobSpec 的 Task 如何引用这些资源            |
| 声明文档 schema 和样本       | 注册 ContextSource                      |
| 声明外部系统的对接信息           | 注册 Tool + Secret                      |
| 记录技术方确认的资源绑定（binding） | 提供资源注册 API + 资源发现                     |
| 描述人机交互需求              | 注册 ReviewPolicy                       |


### 1.4 分层架构总览

```
ExecutableProjectSchema
│
├── meta                        # 项目元信息 → JobSpec.metadata
│
├── documents[]                 # 全局文档注册表
│   ├── schema                  #   文档结构定义
│   ├── samples[]               #   真实数据样本
│   └── contextBinding?         #   已注册的 ContextSource code（技术方填）
│
├── externalSystems[]           # 全局外部系统注册表
│   ├── integration             #   对接方式和状态
│   ├── auth                    #   认证信息
│   ├── toolBinding?            #   已注册的 Tool code（技术方填）
│   └── secretBinding?          #   已注册的 Secret code（技术方填）
│
├── globalConfig                # 全局配置
│   ├── orchestration           #   编排方式 → JobSpec.flow
│   └── contextPolicyBinding?   #   已注册的 ContextPolicy code（技术方填）
│
├── adaptiveConfig?             # v2.4 新增：运行时自适应配置 → JobSpec v2 扩展字段
│   ├── runtimeAdjustable[]     #   运行时可调整参数声明 → JobSpec.runtime_adjustable
│   ├── envAssumptions[]        #   环境假设声明 → JobSpec.env_assumptions
│   └── adjustmentPolicies[]    #   调整策略声明 → JobSpec.adjustment_policies
│
└── nodes[]                     # 节点列表 → JobSpec.tasks
    ├── identity                #   基本信息 → Task.name + instruction
    ├── dataContract            #   数据契约 → Task.input_schema + output_schema
    ├── businessIntent[]        #   业务意图步骤 → 参与生成 context.execution_plan.skill_contracts（与 binding 等拼装）

---
JobGroup（v2.5 新增，FlowAgent 前端专用，不映射到 JobSpec）
│
├── meta                        # 组元信息（名称、来源 Schema ID）
├── jobs[]                      # 拆分后的子 Job 列表（各自引用独立 Schema）
├── sharedResources[]           # 多 Job 共享的数据源 code
└── relatedJobs[]               # 上下游关系标注（仅文档性质）
    ├── taskType?               #   阶段 1 AI 预标注 → 阶段 2 技术方确认 → Task.type（Runtime envelope）
    ├── skillBinding?           #   已注册的 Skill code（技术方填）→ Task.skill_codes
    ├── runtimeBinding?         #   已注册的 RuntimeProfile code（技术方填）
    ├── humanInteraction?       #   人机交互 + reviewBinding（技术方填）
    ├── qualityHint?            #   过程校验 skillValidations + 最终验收 acceptanceCriteria（对齐 Runtime）
    ├── errorStrategy           #   错误策略
    └── edges[]                 #   出边 → JobSpec.flow
```

### 1.5 与 Agent Runtime Protocol 的字段对应（摘要）


| FlowAgent（节点级）                              | Runtime Pack / Task 扩展中的典型落点                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `taskType`                                  | `execution-envelope.task.type`                                                        |
| `dataContract.outputs[].kind` / `intent`    | `task.deliverables[].kind` / `nl_intent`                                              |
| `qualityHint.skillValidations`              | `context.json` → `execution_plan.skill_contracts[].expected_output.validation_rules`  |
| `qualityHint.acceptanceCriteria`            | `execution-envelope.task.acceptance_criteria`                                         |
| `businessIntent` + `skillBinding` + `edges` | `context.json` → `execution_plan.skill_contracts`（编排语义由映射器按约定拼装）                      |
| `errorStrategy.timeout` / `retryPolicy`     | `execution-envelope.policies.timeout`；Skill 级失败策略可与 `skill_contracts[].on_failure` 对齐 |
| `dataContract.inputs[].kind` / `sourceType` | `context.json` → `inputs[]`（`InputSlot.kind` / `source_type`）                         |



| FlowAgent（项目级 v2.4 新增）              | JobSpec v2 / Runtime 落点                  |
| ----------------------------------- | ---------------------------------------- |
| `adaptiveConfig.runtimeAdjustable`  | `JobSpec.runtime_adjustable`（运行时可调整参数声明） |
| `adaptiveConfig.envAssumptions`     | `JobSpec.env_assumptions`（环境假设声明）        |
| `adaptiveConfig.adjustmentPolicies` | `JobSpec.adjustment_policies`（调整策略声明）    |


跨 Task 的最终一致性校验由 **Infra/Job 编排层**完成，不在单节点 Runtime Pack 内声明。

### 1.6 Job 组与多 Job 导出（v2.5）

#### 背景

业务方描述的是一个完整业务流程，但技术方评审时可能发现：为了提效、复用或解耦调度，应拆分为多个**独立 Job**。例如：

- 「GSDS 信息入库」可以定时批量跑
- 「IMI 证书申请」按单触发，依赖入库后的数据

拆分后的每个 Job 各自独立导出为完整 JobSpec，各自配置触发方式，在 task-platform 中互不知道对方存在。

#### 设计原则

| 原则 | 说明 |
|------|------|
| **JobGroup 是产品概念** | 仅存在于 FlowAgent 前端，不映射到 JobSpec，不影响执行 |
| **触发完全隔离** | 每个 Job 有自己的 Trigger，不存在 "Job A 跑完自动触发 Job B" 的隐含耦合 |
| **数据关联仅做标注** | `relatedJobs` 和 `sharedResources` 是文档性质的元数据，方便人理解上下游 |
| **连续性约束** | 技术方拆分时，选入同一个 Job 的节点必须在原始流程中**连续**（连通子图） |

#### 定位

```
                  FlowAgent 前端（设计态）
┌──────────────────────────────────────────┐
│  JobGroup（逻辑分组，仅管理视图）            │
│    ├── Schema A（节点 1-3）               │
│    └── Schema B（节点 4-7）               │
└──────────────────────────────────────────┘
                      ↓ 各自独立导出
┌──────────────────────────────────────────┐
│  task-platform（执行态）                   │
│    ├── JobSpec A（独立调度）               │
│    └── JobSpec B（独立调度）               │
└──────────────────────────────────────────┘
```

#### 数据结构概览

```
JobGroup（FlowAgent 前端存储）
│
├── meta
│   ├── id                  # 组 ID
│   ├── name                # 组名称（如"IMI 证书全流程"）
│   └── sourceSchemaId      # 原始单一 Schema 的 ID
│
├── jobs[]
│   ├── schemaId            # 拆分后的子 Schema ID
│   ├── name                # Job 名称（如"GSDS 信息入库"）
│   ├── nodeRange           # 原始节点范围 [from, to]
│   └── triggerConfig       # 触发配置预设（导出时填入 JobSpec.triggers）
│
├── sharedResources[]       # 多个 Job 共享的数据源 code
│
└── relatedJobs[]           # 上下游关系标注（纯文档性质）
    ├── from                # 上游 Job schemaId
    ├── to                  # 下游 Job schemaId
    └── relation            # upstream_producer / downstream_consumer
```

---

## 二、TypeScript 接口定义

### 2.1 顶层结构

```typescript
interface ExecutableProjectSchema {
  meta: ProjectMeta;
  documents: DocumentRegistry[];
  externalSystems: ExternalSystemRegistry[];
  globalConfig: GlobalConfig;
  nodes: ExecutableNode[];
  adaptiveConfig?: AdaptiveConfig;  // v2.4 新增 → 映射到 JobSpec v2 运行时调整字段
}
```

### 2.1b jobGroup — Job 组（v2.5 新增，FlowAgent 前端专用）

**不参与 JobSpec 映射**。仅在 FlowAgent 前端持久化，用于管理多 Job 拆分后的逻辑分组。

```typescript
interface JobGroup {
  id: string;
  name: string;                        // "IMI 证书全流程"
  sourceSchemaId: string;              // 拆分前的原始 Schema ID
  createdAt: string;                   // 拆分操作时间
  createdBy: string;                   // 操作人（技术方）

  jobs: JobGroupEntry[];
  sharedResources: string[];           // 多个 Job 共享的 ContextSource code
  relatedJobs: JobRelation[];
}

interface JobGroupEntry {
  schemaId: string;                    // 拆分后生成的子 Schema ID
  name: string;                        // "GSDS 信息入库"
  nodeRange: [number, number];         // 原始节点序号范围 [from, to]（含两端）
  triggerConfig?: {
    type: "schedule" | "manual" | "event" | "api";
    params?: Record<string, string>;   // 如 { cron: "0 9 * * *" }
  };
}

interface JobRelation {
  from: string;                        // 上游 Job 的 schemaId
  to: string;                          // 下游 Job 的 schemaId
  relation: "upstream_producer" | "downstream_consumer";
  sharedResource?: string;             // 通过哪个数据源关联
  description?: string;                // 人可读说明
}
```

**与映射的关系**：

- 导出时，mapper 遍历 `jobGroup.jobs[]`，对每个 entry 的 `schemaId` 各自独立执行 Schema → JobSpec 映射
- `triggerConfig` 如果填写了，映射时写入对应 JobSpec 的 `triggers` 字段
- `relatedJobs` 和 `sharedResources` **不映射**，仅 FlowAgent 前端消费

### 2.2 meta — 项目元信息

映射目标：`JobSpec.metadata`

```typescript
interface ProjectMeta {
  id: string;                          // → metadata.code（自动转 kebab-case）
  name: string;                        // → metadata.name
  version: string;
  taskType: "workflow";
  createdAt: string;                   // ISO 8601
  updatedAt: string;
  totalNodes: number;
  estimatedDuration: string;           // 人类可读
  businessContext: string;             // → metadata.description
  tags?: string[];
}
```

### 2.3 documents — 全局文档注册表

文档是**一等公民**，独立于节点存在。节点通过 `docRef` 引用。

映射目标：**ContextSource** 注册 + Skill 的 `examples/`

```typescript
type DocumentFileType =
  | "xlsx" | "csv" | "pdf" | "docx" | "json"
  | "database" | "email" | "image" | "other";

type DocumentRole =
  | "working"           // 流程中被读写的核心文件
  | "reference"         // 只读参考数据
  | "archive"           // 归档存储
  | "external_input"    // 外部输入（如邮件附件）
  | "external_output";  // 需交付给外部的产出

interface DocumentColumnDef {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "enum" | "json";
  description?: string;
  required?: boolean;
  enumValues?: string[];
  format?: string;
  example?: string | number;
}

// ─── 结构化文档 Schema ───

interface DocumentTableSchema {
  type: "table";
  columns: DocumentColumnDef[];
  primaryKey?: string[];
  sheetName?: string;
}

interface DocumentObjectSchema {
  type: "object";
  fields: DocumentColumnDef[];
}

interface DocumentArraySchema {
  type: "array";
  items: DocumentObjectSchema | DocumentTableSchema;
}

// ─── 非结构化文档 Schema ───

interface DocumentUnstructuredSchema {
  type: "unstructured";
  contentType: "text" | "rich_text" | "scanned_image" | "mixed";
  extractionHints: ExtractionHint[];
  structureDescription?: string;
}

interface ExtractionHint {
  field: string;
  type: "string" | "number" | "date" | "boolean" | "enum";
  description: string;
  example?: string;
  required?: boolean;
}

// ─── 半结构化文档 Schema ───

interface DocumentSemiStructuredSchema {
  type: "semi_structured";
  knownFields?: DocumentColumnDef[];
  extractionHints?: ExtractionHint[];
  formatDescription: string;
}

// ─── 二进制文档 Schema ───

interface DocumentBinarySchema {
  type: "binary";
  mediaType: "image" | "video" | "audio" | "archive" | "other";
  processingHint: "ocr" | "transcription" | "extraction" | "passthrough";
  extractionHints?: ExtractionHint[];
}

type DocumentSchema =
  | DocumentTableSchema
  | DocumentObjectSchema
  | DocumentArraySchema
  | DocumentUnstructuredSchema
  | DocumentSemiStructuredSchema
  | DocumentBinarySchema;

interface DocumentSample {
  description: string;
  data: Record<string, unknown>;
}

// ─── ContextSource 绑定（技术方确认后填入）───

interface ContextSourceBinding {
  code: string;               // 已在 task-platform 注册的 ContextSource code
  sourceType: "manual" | "static" | "http" | "object_storage";
  sensitivity: "public" | "internal" | "confidential" | "restricted";
}

interface DocumentRegistry {
  id: string;
  name: string;
  fileType: DocumentFileType;
  role: DocumentRole;
  schema: DocumentSchema;
  samples: DocumentSample[];
  constraints?: string[];
  versionStrategy?: "immutable" | "append_only" | "overwrite";
  contextBinding?: ContextSourceBinding;  // 技术方确认后填入，阶段 1 为空
}
```

### 2.4 externalSystems — 全局外部系统注册表

技术方在 task-platform 注册 Tool 和 Secret 后，把 code 回填到这里。

```typescript
type ExternalSystemType =
  | "web_portal" | "api" | "email" | "database"
  | "file_system" | "message_queue" | "other";

type IntegrationMethod = "manual" | "api" | "email" | "file_transfer" | "database_query";
type IntegrationReadiness = "ready" | "partial" | "not_available";

interface ExternalSystemConstraint {
  type: "availability" | "rate_limit" | "file_size" | "response_time" | "quota" | "format";
  detail: string;
}

// ─── Tool 绑定（技术方确认后填入）───

interface ToolBinding {
  code: string;                     // 已在 task-platform 注册的 Tool code
}

// ─── Secret 绑定（技术方确认后填入）───

interface SecretBinding {
  code: string;                     // 已在 task-platform 注册的 Secret code
}

interface ExternalSystemRegistry {
  id: string;
  name: string;
  type: ExternalSystemType;
  integration: {
    current: IntegrationMethod;
    target: IntegrationMethod;
    readiness: IntegrationReadiness;
  };
  auth: {
    type: "none" | "bearer_token" | "api_key" | "username_password"
      | "oauth2" | "smtp_credentials" | "certificate" | "unknown";
    secretBinding?: SecretBinding;    // 技术方确认后填入，阶段 1 为空
  };
  capabilities: string[];
  constraints: ExternalSystemConstraint[];
  humanFallback?: string;
  apiSpec?: {
    baseUrl?: string;
    docUrl?: string;
    endpoints?: ApiEndpoint[];
  };
  toolBinding?: ToolBinding;          // 技术方确认后填入，阶段 1 为空
}

interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  headers?: Record<string, string>;
}
```

### 2.5 globalConfig — 全局配置

大幅精简：删除了 `envVars`（在 task-platform 注册 Secret）、`retryPolicy`（在 RuntimeProfile 配置）、`defaultTimeout`（同）。

> **重要：`edges[]` 是 DAG 调度的唯一真相源。**
> Infra/Scheduler 应以 `nodes[].edges[]` 构建的有向图作为唯一调度依据。
> `orchestration` 中的 `type`、`conditionalBranches`、`parallelGroups` 是**辅助性概述标注**，供人类阅读和校验用，不作为调度逻辑的输入。
> 如果 `orchestration` 标注与 `edges` 实际拓扑不一致，以 `edges` 为准。

```typescript
interface OrchestrationConfig {
  type: "sequential" | "parallel" | "conditional";
  conditionalBranches?: string[];     // 辅助标注：哪些 node id 包含条件出边（以 edges 为准）
  parallelGroups?: string[][];        // 辅助标注：可并行执行的节点分组（以 edges 入度分析为准）
}

// ─── ContextPolicy 绑定（技术方确认后填入）───

interface ContextPolicyBinding {
  code: string;                       // 已在 task-platform 注册的 ContextPolicy code
}

interface GlobalConfig {
  orchestration: OrchestrationConfig;
  timezone?: string;
  contextPolicyBinding?: ContextPolicyBinding;  // 技术方确认后填入，阶段 1 为空
}
```

### 2.6 adaptiveConfig — 运行时自适应配置（v2.4 新增）

**v2.4 新增**：支持声明运行时可调整参数、环境假设和调整策略，映射到 JobSpec v2 的扩展字段。

这些字段的作用是：

1. **让技术方声明**哪些参数可以在运行时动态调整（如预算、并发数）
2. **让技术方声明**业务依赖的外部环境假设（如平台 API 可用、算法效果稳定）
3. **让技术方预定义**当假设被打破或收到特定事件时的自动响应策略

> **阶段说明**：这些字段由技术方在阶段 2 填入，业务方在阶段 1 无需关注。

```typescript
// ─── 运行时可调整参数声明 ───

type AdjustScope = "hot" | "warm" | "cold";

interface RuntimeAdjustableParam {
  path: string;                       // 参数路径，如 "input.monthly_budget"
  type: "number" | "string" | "boolean" | "enum";
  description: string;                // 参数含义说明
  min?: number;                       // 数值型下限
  max?: number;                       // 数值型上限
  enumValues?: string[];              // 枚举型可选值
  adjustScope: AdjustScope;           // hot=立即生效 warm=下次Task生效 cold=需重启Job
  requiresApproval?: boolean;         // 调整是否需要审批，默认 false
  approvalRoles?: string[];           // 需要哪些角色审批
}

// ─── 环境假设声明 ───

type MonitorType = "metric" | "event" | "api_health" | "external_signal";

interface EnvAssumption {
  id: string;                         // 假设唯一标识
  description: string;                // 假设描述，如"小红书 API 正常可用"
  monitorType: MonitorType;           // 监控方式
  monitorConfig: {
    source?: string;                  // 数据源，如 "prometheus", "platform_event"
    query?: string;                   // 查询表达式
    checkInterval?: string;           // 检查间隔，如 "5m"
    endpoint?: string;                // API 健康检查端点
    [key: string]: unknown;
  };
  warningThreshold?: unknown;         // 警告阈值
  criticalThreshold?: unknown;        // 严重阈值（触发调整策略）
}

// ─── 调整策略声明 ───

type TriggerType = "assumption_violated" | "event" | "metric_threshold" | "manual";
type ActionType = "scale" | "pause" | "resume" | "switch_strategy" | "notify" | "abort" | "adjust_param";

interface AdjustmentPolicyTrigger {
  type: TriggerType;
  ref?: string;                       // 关联的 assumption id 或 event type
  condition?: string;                 // 触发条件表达式
}

interface AdjustmentPolicyAction {
  type: ActionType;
  config: {
    targetParam?: string;             // adjust_param 时的目标参数路径
    newValue?: unknown;               // adjust_param 时的新值
    scaleRatio?: number;              // scale 时的缩放比例
    notifyChannels?: string[];        // notify 时的通知渠道
    notifyRoles?: string[];           // notify 时的通知角色
    fallbackStrategy?: string;        // switch_strategy 时的备选策略
    [key: string]: unknown;
  };
}

interface AdjustmentPolicy {
  id: string;                         // 策略唯一标识
  name: string;                       // 策略名称
  description?: string;               // 策略描述
  trigger: AdjustmentPolicyTrigger;   // 触发条件
  actions: AdjustmentPolicyAction[];  // 执行动作列表（按顺序执行）
  requiresApproval: boolean;          // 执行是否需要审批
  approvalRoles?: string[];           // 需要哪些角色审批
  cooldownSeconds?: number;           // 冷却时间，防止频繁触发
}

// ─── 自适应配置顶层结构 ───

interface AdaptiveConfig {
  runtimeAdjustable?: RuntimeAdjustableParam[];  // 运行时可调整参数
  envAssumptions?: EnvAssumption[];              // 环境假设
  adjustmentPolicies?: AdjustmentPolicy[];       // 调整策略
}
```

#### adjustScope 说明


| 值      | 含义                    | 示例        |
| ------ | --------------------- | --------- |
| `hot`  | 立即生效，当前执行中的 Task 即可感知 | 通知频率、日志级别 |
| `warm` | 下一个 Task 开始时生效        | 单次预算、批次大小 |
| `cold` | 需要重启 Job 才能生效         | 目标账号、核心策略 |


#### 与 JobSpec v2 的映射


| Schema 字段                           | →   | JobSpec v2 字段         |
| ----------------------------------- | --- | --------------------- |
| `adaptiveConfig.runtimeAdjustable`  | →   | `runtime_adjustable`  |
| `adaptiveConfig.envAssumptions`     | →   | `env_assumptions`     |
| `adaptiveConfig.adjustmentPolicies` | →   | `adjustment_policies` |


> 详细的 JobSpec v2 运行时调整协议见 `[jobspec-v2-runtime-adjustment.md](./jobspec-v2-runtime-adjustment.md)`

### 2.7 nodes — 节点

映射目标：`JobSpec.tasks[]`

```typescript
type NodeExecutionMode = "ai_auto" | "human_confirm" | "human_manual";

// ─── 2.7.1 节点顶层 ───

interface ExecutableNode {
  id: string;
  identity: NodeIdentity;
  dataContract: NodeDataContract;
  businessIntent: BusinessIntentStep[];
  taskType?: TaskType;                    // 阶段 1 AI 预标注；阶段 2 技术方确认 → Task.type（对齐 Runtime envelope）
  skillBinding?: SkillBinding;            // 技术方确认的 Skill 绑定，阶段 1 为空
  runtimeBinding?: RuntimeBinding;        // 技术方确认的 Runtime 绑定，阶段 1 为空
  humanInteraction?: HumanInteraction;
  qualityHint?: QualityHint;
  errorStrategy: NodeErrorStrategy;
  edges: NodeEdge[];
}

// ─── 2.7.2 identity — 节点基本信息 ───

interface NodeIdentity {
  label: string;                          // → Task.name
  icon: string;
  description: string;                    // → Task.instruction（核心映射）
  stepIndex: number;
  totalSteps: number;
  executionMode: NodeExecutionMode;
  estimatedTime: string;
  tags?: string[];
}
```

### 2.8 dataContract — 数据契约

映射目标：`Task.input_schema` + `Task.output_schema`；并向 Runtime Protocol 的 `context.json.inputs[]` / `task.deliverables[]` 提供结构化来源。

```typescript
type InputKind =
  | "text"
  | "structured"
  | "document"
  | "image"
  | "audio"
  | "identifier"
  | "binary"
  | "secret_ref";

type InputSourceType =
  | "inline"
  | "file_path"
  | "url"
  | "tool_fetch";

interface ContractInput {
  id: string;
  name: string;
  docRef?: string | null;
  externalRef?: string;
  schema?: InlineSchema;
  source: "user" | "previous_step" | "external_system" | "default";
  sourceNodeId?: string;
  required: boolean;
  /** 对齐 Runtime：InputSlot.kind */
  kind?: InputKind;
  /** 对齐 Runtime：InputSlot.source_type */
  sourceType?: InputSourceType;
  /** 对齐 Runtime：InputSlot.media_type（如 application/pdf） */
  mediaType?: string;
  /** 跨模态预处理：对齐 Runtime InputProcessing（须在 capabilities.skills 内） */
  processing?: {
    skillCode: string;
    outputKey: string;
    fallbackAction?: "skip" | "block" | "use_raw";
  };
}

type DeliverableKind =
  | "text"
  | "structured"
  | "document"
  | "action"
  | "notification";

interface ContractOutput {
  id: string;
  name: string;
  docRef?: string | null;
  schema?: InlineSchema;
  mutations?: string[];
  flowsTo?: string[];
  /** 对齐 Runtime：DeliverableSpec.kind */
  kind?: DeliverableKind;
  /** 对齐 Runtime：DeliverableSpec.nl_intent */
  intent?: string;
  /** 对齐精确结构：DeliverableSpec.shape_ref（JSON Schema 引用或内嵌锚点） */
  shapeRef?: string;
  /** 复合交付物：DeliverableSpec.part_of */
  partOf?: string;
}

interface InlineSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  properties?: Record<string, InlineSchemaField>;
  items?: InlineSchema;
  description?: string;
  example?: unknown;
}

interface InlineSchemaField {
  type: "string" | "number" | "boolean" | "date" | "enum";
  description?: string;
  required?: boolean;
  example?: unknown;
}

interface NodeDataContract {
  inputs: ContractInput[];
  outputs: ContractOutput[];
}
```

### 2.9 businessIntent — 业务意图步骤

**v2 核心变更**：原 `processingSteps` 重命名为 `businessIntent`，定位从"执行指令"改为"业务意图标注"。

它的作用是：

1. **让技术方理解**这个节点要做什么操作，从而决定该注册什么 Skill/Tool/Runtime
2. **给技术方开发 Skill 时做参考** — 步骤描述是 Skill 的需求说明
3. **映射材料** — 与 `skillBinding`、`edges`、`qualityHint.skillValidations` 等共同用于生成 Runtime Pack 中的 `context.json.execution_plan.skill_contracts`（映射器按约定拼装执行顺序、依赖 hints；不在 Schema 中嵌入可执行代码）

不包含执行级参数（具体的 field mapping、SQL 查询、正则表达式等），这些是 Skill 和 Tool 内部的事。

```typescript
type IntentType =
  | "query"           // 查询数据源
  | "transform"       // 数据转换
  | "validate"        // 校验
  | "write"           // 写入文件/数据库
  | "call_api"        // 调用外部 API
  | "send_message"    // 发送邮件/通知
  | "parse"           // 解析非结构化内容
  | "compare"         // 对比数据
  | "conditional"     // 条件分支
  | "aggregate"       // 汇总统计
  | "wait"            // 等待外部事件
  | "human_action"    // 纯人工操作
  | "loop"            // 循环处理
  | "sub_flow";       // 嵌套子流程

interface BusinessIntentStep {
  stepIndex: number;
  type: IntentType;
  description: string;                    // 业务意图的自然语言描述
  target?: {
    docRef?: string;                      // 操作哪个文档
    externalRef?: string;                 // 涉及哪个外部系统
  };
  keyFields?: string[];                   // 涉及的关键字段名（帮助技术方理解）
  onError?: "skip" | "retry" | "abort" | "human_fallback";
}
```

**和 v1 `processingSteps` 的对比：**


| 维度     | v1 processingSteps              | v2.3 businessIntent              |
| ------ | ------------------------------- | -------------------------------- |
| 定位     | 执行指令（给 LLM/Runtime）             | 业务意图标注 + skill_contracts 映射材料    |
| params | `Record<string, unknown>` 含具体参数 | **删除** — 不包含执行级参数                |
| 复杂度    | 每步 10-30 行                      | 每步 3-5 行                         |
| 消费者    | LLM 生成代码                        | 技术方；映射器（拼装 skill_contracts 语义骨架） |


### 2.10 taskType — Task 类型（AI 预标注 + 技术方确认）

阶段 1：AI 根据 `businessIntent` 的特征自动填入 `taskType`，供技术方参考。
阶段 2：技术方**必须确认或修正**（导出前置条件），映射到 task-platform Task 的 `**type`** 字段，并进入 Agent Runtime 的 `execution-envelope.task.type`。

与 `runtimeBinding` 的关系：`taskType` 表达任务语义分类（agentic / integration / …）；`runtimeBinding` 指向已注册的 **RuntimeProfile**（执行器配置）。二者配合使用，互不替代。

```typescript
type TaskType = "agentic" | "integration" | "deterministic" | "human_review";
```


| 标签值             | 含义                 | 技术方据此选择的方向                                       |
| --------------- | ------------------ | ------------------------------------------------ |
| `agentic`       | 需要 LLM 理解/推理       | 开发 LLM 类 Skill，选 llm 类 RuntimeProfile            |
| `integration`   | 调 API / 查 DB / 发邮件 | 开发 API 调用类 Skill，选 http 类 RuntimeProfile         |
| `deterministic` | 纯规则/脚本/转换          | 开发脚本类 Skill，选 script 类 RuntimeProfile            |
| `human_review`  | 必须人工完成             | 配置 ReviewPolicy，选 human_gateway 类 RuntimeProfile |


### 2.11 skillBinding / runtimeBinding — 资源绑定

技术方在 task-platform 注册完 Skill 和 RuntimeProfile 后，把 code 回填到这里。
阶段 1（业务翻译）为空，阶段 2 技术方填入。

映射目标：`Task.skill_codes` + `Task.runtime_profile_code`

```typescript
interface SkillBinding {
  code: string;                           // 已在 task-platform 注册的 Skill code
  version?: string;                       // 指定版本，不填则用最新
}

interface RuntimeBinding {
  profileCode: string;                    // 已在 task-platform 注册的 RuntimeProfile code
}
```

Skill 是技术方手动开发并注册的，AI 不做推断。
Runtime 由技术方根据节点需要选择对应的 RuntimeProfile。

#### RuntimeProfile 设计说明

RuntimeProfile 是 task-platform 中一个**完整的执行方案**，包含两部分：

1. **workerType** — 执行者的类型（决定用什么 Worker 来执行 Task）
2. **config** — 该 Worker 的运行参数

```
┌─────────────────────────────────────────────────────┐
│ RuntimeProfile                                      │
│                                                     │
│  workerType: llm | http | script | human_gateway    │
│                                                     │
│  config:                                            │
│    timeout, maxRetry, retryBackoff,                 │
│    model(仅 llm), temperature(仅 llm),             │
│    concurrency, slaHours(仅 human_gateway)...       │
│                                                     │
└─────────────────────────────────────────────────────┘
```


| workerType      | 适用场景               | 典型 config                                      |
| --------------- | ------------------ | ---------------------------------------------- |
| `llm`           | 需要 LLM 理解/推理的 Task | model, temperature, maxTokens, timeout         |
| `http`          | 调 API、查数据库、发邮件     | timeout, maxRetry, retryBackoff                |
| `script`        | 纯规则引擎/脚本/数据转换      | timeout, memoryLimit                           |
| `human_gateway` | 推给人，等回调            | slaHours, escalationAfter, notificationChannel |


常用 RuntimeProfile 示例：

```yaml
# LLM 类 —— 用于解析、推理、对比等 agentic 场景
- code: agentic-default
  workerType: llm
  config:
    model: gpt-4o
    temperature: 0.2
    maxTokens: 8192
    timeout: 60s
    maxRetry: 3

# API 调用类 —— 用于数据库查询、HTTP 接口调用
- code: integration-default
  workerType: http
  config:
    timeout: 30s
    maxRetry: 5
    retryBackoff: exponential

# 脚本类 —— 用于纯规则/确定性逻辑
- code: script-fast
  workerType: script
  config:
    timeout: 10s
    memoryLimit: 256MB

# 人工类 —— 用于必须人完成的节点
- code: human-bridge
  workerType: human_gateway
  config:
    slaHours: 48
    escalationAfter: 72h
    notificationChannel: email
```

技术方根据节点的 `taskType`（已与 Skill 语义一致）和实际需求，选择合适的 RuntimeProfile code 填入 `runtimeBinding`。

### 2.12 humanInteraction — 人机交互契约

技术方在 task-platform 注册 ReviewPolicy 后，把 code 回填到 `reviewBinding`。

映射目标：`Task.review_policy_code`

```typescript
type HumanInteractionType =
  | "verify"
  | "input"
  | "decision"
  | "manual_action";

type ReviewLayout =
  | "card"
  | "compare"
  | "match"
  | "form"
  | "checklist";

// ─── ReviewPolicy 绑定（技术方确认后填入）───

interface ReviewPolicyBinding {
  code: string;                           // 已在 task-platform 注册的 ReviewPolicy code
}

interface HumanInteraction {
  type: HumanInteractionType;
  description: string;
  reviewLayout: ReviewLayout;
  checkItems?: string[];
  inputFields?: {
    name: string;
    type: "text" | "select" | "file" | "date";
    options?: string[];
    required: boolean;
  }[];
  timeout: {
    value: number;
    unit: "seconds" | "hours" | "days";
  };
  timeoutAction: "pause_and_notify" | "auto_approve" | "escalate" | "abort";
  escalation?: {
    after: number;
    to: string;
  };
  reviewBinding?: ReviewPolicyBinding;    // 技术方确认后填入，阶段 1 为空
}
```

### 2.13 qualityHint — 业务质量标准（两层）

**v2.3**：拆分为 **过程校验**（Skill 级）与 **最终验收**（Task 级），对齐 Agent Runtime Protocol。

- `**skillValidations`** → `context.json` → `execution_plan.skill_contracts[].expected_output.validation_rules`（过程每一步可验证）
- `**acceptanceCriteria`** → `execution-envelope.task.acceptance_criteria`（任务结束时的质量兜底）
- 跨 Task 一致性校验由 Infra/Job 编排层完成，不在此重复声明

```typescript
type SkillValidationRuleType =
  | "not_empty"
  | "matches_pattern"
  | "in_range"
  | "equals_input"
  | "cross_check"
  | "type_check";

interface SkillValidation {
  /** 对应哪个 Skill（通常为 skillBinding.code；多 Skill 节点可有多条） */
  skillCode: string;
  field: string;
  rule: SkillValidationRuleType;
  params?: Record<string, unknown>;
  severity: "error" | "warning";
  description: string;
}

type AcceptanceCheckType =
  | "deterministic_rule"
  | "tool_test"
  | "llm_rubric"
  | "human";

interface AcceptanceCriterionDef {
  id: string;
  title: string;
  description: string;
  checkType: AcceptanceCheckType[];
  checkConfig?: Record<string, unknown>;
  severity?: "error" | "warning";
  blocking?: boolean;
}

interface QualityHint {
  skillValidations?: SkillValidation[];
  acceptanceCriteria?: AcceptanceCriterionDef[];
  issueCategories?: string[];
  onFailure: {
    strategy: "retry" | "human_fallback" | "abort";
    notifyRoles: ("business" | "tech")[];
  };
}
```

### 2.14 errorStrategy — 节点级错误策略

映射目标：task-platform / Job 编排的降级与通知；并向 Runtime 的 `**policies.timeout**`、**外部调用超时策略**、以及（与 `qualityHint` 联合时）**Skill 失败处置语义**对齐。

```typescript
interface NodeErrorStrategy {
  strategy: "retry" | "human_fallback" | "skip" | "abort";
  retryPolicy?: {
    maxRetries: number;
    backoff?: "fixed" | "exponential";
    delayMs?: number;
  };
  timeout?: {
    totalSeconds: number;
    externalCallSeconds?: number;
    onExternalTimeout?: "fail" | "skip_and_continue" | "use_cached";
  };
  notifyRoles?: ("business" | "tech")[];
  fallbackDescription?: string;
}
```

`**strategy` 各值对 DAG 路由的影响：**


| strategy         | Infra/Scheduler 行为                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `retry`          | 按 `retryPolicy` 重试；全部耗尽后视为失败，走 `abort` 语义                                                                                            |
| `human_fallback` | 将该 Task 推入人工队列，等待人工完成后继续下游                                                                                                           |
| `skip`           | **跳过该节点**，直接激活该节点所有出边的目标节点。下游节点收到的 `dataFlow` 中，来自被 skip 节点的输出项值为 `null`。下游节点需自行处理缺失输入（建议将依赖 skip 节点输出的 input 标记为 `required: false`） |
| `abort`          | 终止整个 Job，标记为失败                                                                                                                       |


### 2.15 edges — 节点连接与数据流声明

映射目标：`JobSpec.flow[]` + `Task.input_schema`/`output_schema` 的兼容性校验

```typescript
interface ConditionExpression {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
    | "contains" | "not_contains" | "is_empty" | "is_not_empty"
    | "in" | "not_in";
  value: unknown;
}

interface CompoundCondition {
  logic: "and" | "or";
  conditions: (ConditionExpression | CompoundCondition)[];
}

interface EdgeDataFlow {
  sourceOutput: string;
  targetInput: string;
  description?: string;
}

interface NodeEdge {
  targetNodeId: string;
  condition?: ConditionExpression | CompoundCondition;
  dataFlow: EdgeDataFlow[];
}
```

---

## 三、完整示例：IMI 证书申请流程

以下是 IMI 证书申请业务的完整 Schema 实例（v2.3 格式，含与 Runtime Protocol 对齐的输入/输出/质量/超时字段）。

```json
{
  "meta": {
    "id": "project-imi-certificate",
    "name": "IMI证书申请流程",
    "version": "2.0.0",
    "taskType": "workflow",
    "createdAt": "2026-04-23T10:00:00Z",
    "updatedAt": "2026-04-28T10:00:00Z",
    "totalNodes": 7,
    "estimatedDuration": "约3周（含海关审批等待期）",
    "businessContext": "进出口贸易中IMI危险品证书的申请、审核、归档全流程",
    "tags": ["进出口", "危险品", "证书", "合规"]
  },

  "documents": [
    {
      "id": "doc-leader-email",
      "name": "Leader 申请邮件",
      "fileType": "email",
      "role": "external_input",
      "schema": {
        "type": "semi_structured",
        "knownFields": [
          { "name": "subject", "type": "string", "description": "邮件主题" }
        ],
        "extractionHints": [
          { "field": "bbn", "type": "string", "description": "邮件正文中的产品编号", "example": "BBN-003", "required": true },
          { "field": "part", "type": "string", "description": "邮件正文中的零件号", "example": "Z-5590", "required": true },
          { "field": "destination", "type": "string", "description": "目的港", "example": "Tokyo", "required": true }
        ],
        "formatDescription": "邮件正文中以列表形式列出 BBN、Part、目的港，格式不固定"
      },
      "samples": [
        {
          "description": "典型申请邮件",
          "data": {
            "subject": "IMI证书申请 - BBN-003/Z-5590",
            "body": "请申请以下IMI证书：\n1. BBN-003, Part Z-5590, 目的港 Tokyo\n2. BBN-007, Part A-1234, 目的港 Hamburg"
          }
        }
      ],
      "constraints": ["邮件格式不固定，需 AI/人工提取关键信息"],
      "contextBinding": {
        "code": "imi-leader-email-source",
        "sourceType": "manual",
        "sensitivity": "internal"
      }
    },
    {
      "id": "doc-imi-table",
      "name": "IMI申请大表",
      "fileType": "xlsx",
      "role": "working",
      "schema": {
        "type": "table",
        "columns": [
          { "name": "A-标记", "type": "string", "description": "绿色填充=本次待申请" },
          { "name": "BBN", "type": "string", "description": "产品编号", "required": true },
          { "name": "Part", "type": "string", "description": "零件号", "required": true },
          { "name": "目的港", "type": "string", "required": true },
          { "name": "中文名称", "type": "string", "description": "从GSDS获取" },
          { "name": "英文名称", "type": "string", "description": "从GSDS获取" },
          { "name": "样品性状", "type": "string", "description": "从GSDS获取" },
          { "name": "组分", "type": "string", "description": "从GSDS获取" },
          { "name": "正式运输名称", "type": "string", "description": "从GSDS获取" },
          { "name": "联合国编号", "type": "string", "description": "从GSDS获取" },
          { "name": "危险货物类别", "type": "string", "description": "从GSDS获取" },
          { "name": "简易包装类别", "type": "string", "description": "从GSDS获取" },
          { "name": "GHS分类", "type": "string", "description": "从GSDS获取" },
          { "name": "签发日期", "type": "date", "description": "证书下发后回填", "format": "YYYY-MM-DD" },
          { "name": "证书编号", "type": "string", "description": "证书下发后回填" },
          { "name": "有效期", "type": "date", "description": "证书下发后回填", "format": "YYYY-MM-DD" }
        ],
        "primaryKey": ["BBN", "Part"],
        "sheetName": "申请表"
      },
      "samples": [
        {
          "description": "一行典型的待申请数据（GSDS信息已补全）",
          "data": {
            "A-标记": "green",
            "BBN": "BBN-003",
            "Part": "Z-5590",
            "目的港": "Tokyo",
            "中文名称": "工业乙醇",
            "英文名称": "Industrial Ethanol",
            "样品性状": "无色透明液体",
            "组分": "乙醇≥95%",
            "正式运输名称": "ETHANOL",
            "联合国编号": "UN1170",
            "危险货物类别": "3",
            "简易包装类别": "II",
            "GHS分类": "易燃液体 类别2"
          }
        }
      ],
      "constraints": ["单次申请行数通常 5-30 行", "A列标绿表示本次待申请", "同一 BBN+Part 不应重复申请"],
      "versionStrategy": "overwrite",
      "contextBinding": {
        "code": "imi-application-sheet",
        "sourceType": "object_storage",
        "sensitivity": "confidential"
      }
    },
    {
      "id": "doc-gsds",
      "name": "GSDS 产品数据",
      "fileType": "database",
      "role": "reference",
      "schema": {
        "type": "table",
        "columns": [
          { "name": "BBN", "type": "string", "required": true },
          { "name": "Part", "type": "string", "required": true },
          { "name": "中文名称", "type": "string" },
          { "name": "英文名称", "type": "string" },
          { "name": "样品性状", "type": "string" },
          { "name": "组分", "type": "string" },
          { "name": "正式运输名称", "type": "string" },
          { "name": "联合国编号", "type": "string" },
          { "name": "危险货物类别", "type": "string" },
          { "name": "简易包装类别", "type": "string" },
          { "name": "GHS分类", "type": "string" },
          { "name": "版本号", "type": "number", "description": "文件版本，取最新" }
        ],
        "primaryKey": ["BBN", "Part"]
      },
      "samples": [
        {
          "description": "GSDS数据库中一条典型记录",
          "data": {
            "BBN": "BBN-003", "Part": "Z-5590",
            "中文名称": "工业乙醇", "英文名称": "Industrial Ethanol",
            "样品性状": "无色透明液体", "组分": "乙醇≥95%",
            "正式运输名称": "ETHANOL", "联合国编号": "UN1170",
            "危险货物类别": "3", "简易包装类别": "II",
            "GHS分类": "易燃液体 类别2", "版本号": 3
          }
        }
      ],
      "constraints": ["GSDS 文件按 BBN 命名，更新时文件名不变版本号递增", "取最新版本号的记录"],
      "versionStrategy": "append_only",
      "contextBinding": {
        "code": "imi-gsds-db",
        "sourceType": "http",
        "sensitivity": "confidential"
      }
    },
    {
      "id": "doc-imi-list",
      "name": "IMI List 归档表",
      "fileType": "xlsx",
      "role": "archive",
      "schema": {
        "type": "table",
        "columns": [
          { "name": "BBN", "type": "string", "required": true },
          { "name": "Part", "type": "string", "required": true },
          { "name": "目的港", "type": "string" },
          { "name": "中文名称", "type": "string" },
          { "name": "英文名称", "type": "string" },
          { "name": "签发日期", "type": "date", "format": "YYYY-MM-DD" },
          { "name": "证书编号", "type": "string" },
          { "name": "有效期", "type": "date", "format": "YYYY-MM-DD" }
        ],
        "sheetName": "归档"
      },
      "samples": [],
      "constraints": ["只追加、不修改已有记录"],
      "versionStrategy": "append_only",
      "contextBinding": {
        "code": "imi-list-archive",
        "sourceType": "object_storage",
        "sensitivity": "confidential"
      }
    },
    {
      "id": "doc-certificate",
      "name": "海关 IMI 证书",
      "fileType": "pdf",
      "role": "external_input",
      "schema": {
        "type": "unstructured",
        "contentType": "mixed",
        "extractionHints": [
          { "field": "证书编号", "type": "string", "description": "证书顶部的编号", "required": true },
          { "field": "签发日期", "type": "date", "description": "签发日期", "required": true },
          { "field": "有效期", "type": "date", "description": "有效截止日期", "required": true },
          { "field": "中文名称", "type": "string", "description": "产品中文名称", "required": true },
          { "field": "英文名称", "type": "string", "description": "产品英文名称", "required": true },
          { "field": "样品性状", "type": "string", "description": "样品外观性状" },
          { "field": "组分", "type": "string", "description": "化学组分" },
          { "field": "正式运输名称", "type": "string", "description": "UN 正式运输名称" },
          { "field": "联合国编号", "type": "string", "description": "UN 编号" },
          { "field": "危险货物类别", "type": "string", "description": "危险品分类" },
          { "field": "简易包装类别", "type": "string", "description": "包装等级" },
          { "field": "GHS分类", "type": "string", "description": "GHS 危险性分类" }
        ],
        "structureDescription": "海关签发的 PDF 格式 IMI 证书，包含产品信息和证书有效期"
      },
      "samples": [],
      "constraints": ["PDF 格式，需解析提取字段", "约2周后由海关返回"],
      "contextBinding": {
        "code": "imi-certificate-manual",
        "sourceType": "manual",
        "sensitivity": "confidential"
      }
    }
  ],

  "externalSystems": [
    {
      "id": "sys-email",
      "name": "企业邮箱",
      "type": "email",
      "integration": { "current": "manual", "target": "api", "readiness": "partial" },
      "auth": {
        "type": "smtp_credentials",
        "secretBinding": { "code": "imi-smtp-credentials" }
      },
      "capabilities": ["收取 Leader 申请邮件", "发送申报材料给海关", "接收海关证书回复"],
      "constraints": [
        { "type": "rate_limit", "detail": "每分钟最多发送 30 封" }
      ],
      "humanFallback": "用户手动收发邮件",
      "toolBinding": { "code": "imi-email-gateway" }
    },
    {
      "id": "sys-gsds-db",
      "name": "GSDS 结构化数据库",
      "type": "database",
      "integration": { "current": "database_query", "target": "database_query", "readiness": "ready" },
      "auth": {
        "type": "username_password",
        "secretBinding": { "code": "imi-gsds-db-credentials" }
      },
      "capabilities": ["按 BBN+Part 查询产品安全数据"],
      "constraints": [
        { "type": "availability", "detail": "内网可用，7x24" }
      ],
      "toolBinding": { "code": "imi-gsds-query" }
    },
    {
      "id": "sys-zhongwaiyun",
      "name": "中外运报关系统",
      "type": "web_portal",
      "integration": { "current": "manual", "target": "manual", "readiness": "not_available" },
      "auth": { "type": "username_password" },
      "capabilities": ["上传Excel申请文件", "下载生成的申报材料"],
      "constraints": [
        { "type": "availability", "detail": "工作日 9:00-18:00" },
        { "type": "file_size", "detail": "上传文件不超过 20MB" }
      ],
      "humanFallback": "用户手动登录网页上传 Excel、下载材料"
    },
    {
      "id": "sys-customs",
      "name": "海关",
      "type": "email",
      "integration": { "current": "email", "target": "email", "readiness": "ready" },
      "auth": { "type": "none" },
      "capabilities": ["接收申报材料", "返回 IMI 证书"],
      "constraints": [
        { "type": "response_time", "detail": "约 2 周返回证书" }
      ],
      "humanFallback": "邮件沟通"
    }
  ],

  "globalConfig": {
    "orchestration": {
      "type": "sequential"
    },
    "timezone": "Asia/Shanghai",
    "contextPolicyBinding": { "code": "imi-processing-default" }
  },

  "adaptiveConfig": {
    "runtimeAdjustable": [
      {
        "path": "input.priority",
        "type": "enum",
        "description": "申请优先级，影响处理顺序",
        "enumValues": ["normal", "urgent", "critical"],
        "adjustScope": "warm",
        "requiresApproval": false
      },
      {
        "path": "input.batch_size",
        "type": "number",
        "description": "单次处理的申请数量上限",
        "min": 1,
        "max": 100,
        "adjustScope": "warm",
        "requiresApproval": false
      }
    ],
    "envAssumptions": [
      {
        "id": "gsds-api-available",
        "description": "GSDS 数据库 API 正常可用",
        "monitorType": "api_health",
        "monitorConfig": {
          "endpoint": "sys-gsds-db",
          "checkInterval": "5m",
          "timeout": "10s"
        },
        "warningThreshold": { "error_rate": 0.05 },
        "criticalThreshold": { "error_rate": 0.2 }
      },
      {
        "id": "email-service-available",
        "description": "企业邮箱服务正常",
        "monitorType": "api_health",
        "monitorConfig": {
          "endpoint": "sys-email",
          "checkInterval": "10m"
        },
        "criticalThreshold": { "consecutive_failures": 3 }
      }
    ],
    "adjustmentPolicies": [
      {
        "id": "gsds-fallback",
        "name": "GSDS 不可用时暂停并通知",
        "trigger": {
          "type": "assumption_violated",
          "ref": "gsds-api-available"
        },
        "actions": [
          {
            "type": "pause",
            "config": { "scope": "job" }
          },
          {
            "type": "notify",
            "config": {
              "notifyChannels": ["email", "webhook"],
              "notifyRoles": ["tech", "business"]
            }
          }
        ],
        "requiresApproval": false,
        "cooldownSeconds": 300
      },
      {
        "id": "email-fallback",
        "name": "邮件服务不可用时切换人工模式",
        "trigger": {
          "type": "assumption_violated",
          "ref": "email-service-available"
        },
        "actions": [
          {
            "type": "notify",
            "config": {
              "notifyChannels": ["email"],
              "notifyRoles": ["business"]
            }
          },
          {
            "type": "switch_strategy",
            "config": {
              "fallbackStrategy": "manual_email",
              "affectedNodes": ["node-5"]
            }
          }
        ],
        "requiresApproval": true,
        "approvalRoles": ["tech"]
      }
    ]
  },

  "nodes": [
    {
      "id": "node-1",
      "identity": {
        "label": "解析 Leader 申请邮件",
        "icon": "Mail",
        "description": "从 Leader 发来的邮件中提取本次需要申请的 BBN、Part、目的港清单",
        "stepIndex": 1,
        "totalSteps": 7,
        "executionMode": "human_confirm",
        "estimatedTime": "5-10 分钟"
      },
      "dataContract": {
        "inputs": [
          {
            "id": "in-1-1",
            "name": "Leader 申请邮件",
            "docRef": "doc-leader-email",
            "source": "user",
            "required": true,
            "kind": "document",
            "sourceType": "inline",
            "mediaType": "message/rfc822"
          }
        ],
        "outputs": [
          {
            "id": "out-1-1",
            "name": "申请清单",
            "docRef": null,
            "kind": "structured",
            "intent": "从邮件解析得到的本次待申请 BBN/Part/目的港清单",
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "bbn": { "type": "string", "description": "产品编号", "example": "BBN-003" },
                  "part": { "type": "string", "description": "零件号", "example": "Z-5590" },
                  "destination": { "type": "string", "description": "目的港", "example": "Tokyo" }
                }
              }
            },
            "flowsTo": ["node-2"]
          }
        ]
      },
      "businessIntent": [
        {
          "stepIndex": 1,
          "type": "parse",
          "description": "解析邮件正文，提取 BBN、Part、目的港信息",
          "target": { "docRef": "doc-leader-email" },
          "keyFields": ["bbn", "part", "destination"]
        },
        {
          "stepIndex": 2,
          "type": "validate",
          "description": "校验提取结果：BBN、Part、目的港不能为空",
          "onError": "human_fallback"
        }
      ],
      "taskType": "agentic",
      "skillBinding": { "code": "imi-email-parser" },
      "runtimeBinding": { "profileCode": "agentic-default" },
      "humanInteraction": {
        "type": "verify",
        "description": "确认 AI 从邮件中提取的 BBN/Part/目的港信息是否正确",
        "reviewLayout": "card",
        "checkItems": ["BBN 编号是否正确", "Part 号是否匹配", "目的港是否准确", "是否有遗漏项"],
        "timeout": { "value": 24, "unit": "hours" },
        "timeoutAction": "pause_and_notify",
        "reviewBinding": { "code": "imi-email-extraction-review" }
      },
      "qualityHint": {
        "skillValidations": [
          {
            "skillCode": "imi-email-parser",
            "field": "bbn",
            "rule": "matches_pattern",
            "params": { "pattern": "^BBN-\\d{3}$" },
            "severity": "warning",
            "description": "BBN 建议符合 BBN-NNN 形式"
          },
          {
            "skillCode": "imi-email-parser",
            "field": "part",
            "rule": "not_empty",
            "severity": "error",
            "description": "每条记录的 Part 不得为空"
          }
        ],
        "acceptanceCriteria": [
          {
            "id": "ac-node1-list-nonempty",
            "title": "申请清单可交付",
            "description": "至少解析出一行待申请项，或进入人工补录",
            "checkType": ["deterministic_rule"],
            "checkConfig": { "rule": "not_empty", "path": "out-1-1" },
            "blocking": true
          }
        ],
        "onFailure": { "strategy": "human_fallback", "notifyRoles": ["business"] }
      },
      "errorStrategy": {
        "strategy": "human_fallback",
        "retryPolicy": { "maxRetries": 0, "backoff": "fixed", "delayMs": 0 },
        "timeout": { "totalSeconds": 600, "externalCallSeconds": 60, "onExternalTimeout": "fail" },
        "notifyRoles": ["business"],
        "fallbackDescription": "AI 无法识别邮件内容时，由用户手动输入申请清单"
      },
      "edges": [
        {
          "targetNodeId": "node-2",
          "dataFlow": [
            { "sourceOutput": "out-1-1", "targetInput": "in-2-1", "description": "申请清单传递给 GSDS 补全节点" }
          ]
        }
      ]
    },

    {
      "id": "node-2",
      "identity": {
        "label": "按 BBN/Part 从 GSDS 补全申请大表",
        "icon": "Database",
        "description": "根据申请清单中的 BBN 和 Part，查询 GSDS 数据库获取产品安全数据，补全 IMI 申请大表",
        "stepIndex": 2,
        "totalSteps": 7,
        "executionMode": "ai_auto",
        "estimatedTime": "1-3 分钟"
      },
      "dataContract": {
        "inputs": [
          {
            "id": "in-2-1",
            "name": "申请清单",
            "docRef": null,
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "bbn": { "type": "string" },
                  "part": { "type": "string" },
                  "destination": { "type": "string" }
                }
              }
            },
            "source": "previous_step",
            "sourceNodeId": "node-1",
            "required": true,
            "kind": "structured",
            "sourceType": "inline"
          },
          {
            "id": "in-2-2",
            "name": "GSDS 结构化数据",
            "docRef": "doc-gsds",
            "externalRef": "sys-gsds-db",
            "source": "external_system",
            "required": true,
            "kind": "structured",
            "sourceType": "tool_fetch"
          },
          {
            "id": "in-2-3",
            "name": "IMI 申请大表模板",
            "docRef": "doc-imi-table",
            "source": "default",
            "required": true,
            "kind": "document",
            "sourceType": "file_path",
            "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        ],
        "outputs": [
          {
            "id": "out-2-1",
            "name": "补全后的 IMI 申请大表",
            "docRef": "doc-imi-table",
            "kind": "document",
            "intent": "已根据 GSDS 写入危险品字段并将待申请行 A 列标绿的 Excel",
            "mutations": ["写入中文名称、英文名称、样品性状、组分等 GSDS 字段", "匹配到的行 A 列标绿"],
            "flowsTo": ["node-3"]
          }
        ]
      },
      "businessIntent": [
        {
          "stepIndex": 1,
          "type": "query",
          "description": "用 BBN+Part 查询 GSDS 数据库，获取最新版本的产品安全数据",
          "target": { "docRef": "doc-gsds", "externalRef": "sys-gsds-db" },
          "keyFields": ["BBN", "Part", "中文名称", "英文名称", "联合国编号"]
        },
        {
          "stepIndex": 2,
          "type": "validate",
          "description": "检查是否所有 BBN+Part 都匹配到了 GSDS 数据",
          "onError": "human_fallback"
        },
        {
          "stepIndex": 3,
          "type": "transform",
          "description": "将 GSDS 查询结果映射写入 IMI 申请大表对应列",
          "target": { "docRef": "doc-imi-table" },
          "keyFields": ["中文名称", "英文名称", "样品性状", "组分", "正式运输名称", "联合国编号", "危险货物类别", "简易包装类别", "GHS分类"]
        },
        {
          "stepIndex": 4,
          "type": "write",
          "description": "将已填充数据的行 A 列标绿",
          "target": { "docRef": "doc-imi-table" }
        }
      ],
      "taskType": "integration",
      "skillBinding": { "code": "imi-gsds-enricher" },
      "runtimeBinding": { "profileCode": "integration-default" },
      "qualityHint": {
        "skillValidations": [
          {
            "skillCode": "imi-gsds-enricher",
            "field": "联合国编号",
            "rule": "matches_pattern",
            "params": { "pattern": "^UN\\d{4}$" },
            "severity": "warning",
            "description": "UN 编号形如 UN1234"
          }
        ],
        "acceptanceCriteria": [
          {
            "id": "ac-node2-match-rate",
            "title": "GSDS 匹配率达到企业要求",
            "description": "本次清单行的 GSDS 匹配成功率不低于 95%",
            "checkType": ["deterministic_rule"],
            "checkConfig": { "rule": "threshold", "metric": "match_rate", "min": 0.95 },
            "severity": "error",
            "blocking": true
          }
        ],
        "issueCategories": ["GSDS数据缺失", "BBN/Part格式不匹配", "GSDS版本过旧"],
        "onFailure": { "strategy": "human_fallback", "notifyRoles": ["tech"] }
      },
      "errorStrategy": {
        "strategy": "retry",
        "retryPolicy": { "maxRetries": 3, "backoff": "exponential", "delayMs": 500 },
        "timeout": { "totalSeconds": 900, "externalCallSeconds": 45, "onExternalTimeout": "fail" },
        "notifyRoles": ["tech"],
        "fallbackDescription": "数据库查询失败时重试，3次后转人工处理"
      },
      "edges": [
        {
          "targetNodeId": "node-3",
          "dataFlow": [
            { "sourceOutput": "out-2-1", "targetInput": "in-3-1", "description": "补全后的 IMI 申请大表传递给人工确认" }
          ]
        }
      ]
    },

    {
      "id": "node-3",
      "identity": {
        "label": "人工确认补全结果",
        "icon": "UserCheck",
        "description": "人工检查 GSDS 补全后的 IMI 申请大表是否正确，确认无误后提交",
        "stepIndex": 3,
        "totalSteps": 7,
        "executionMode": "human_confirm",
        "estimatedTime": "10-30 分钟"
      },
      "dataContract": {
        "inputs": [
          {
            "id": "in-3-1",
            "name": "补全后的 IMI 申请大表",
            "docRef": "doc-imi-table",
            "source": "previous_step",
            "sourceNodeId": "node-2",
            "required": true,
            "kind": "document",
            "sourceType": "file_path",
            "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        ],
        "outputs": [
          {
            "id": "out-3-1",
            "name": "确认后的 IMI 申请大表",
            "docRef": "doc-imi-table",
            "kind": "document",
            "intent": "人工核对后可提交的 IMI 申请大表",
            "mutations": ["人工确认或修正后的版本"],
            "flowsTo": ["node-4"]
          }
        ]
      },
      "businessIntent": [
        {
          "stepIndex": 1,
          "type": "human_action",
          "description": "人工逐行检查申请大表中的产品信息是否与 GSDS 原始数据一致"
        }
      ],
      "taskType": "human_review",
      "runtimeBinding": { "profileCode": "human-bridge" },
      "humanInteraction": {
        "type": "verify",
        "description": "逐行核对 GSDS 补全的数据是否准确",
        "reviewLayout": "compare",
        "checkItems": ["中英文名称是否与 GSDS 一致", "组分描述是否完整", "危险货物类别是否正确", "是否有遗漏的申请项"],
        "timeout": { "value": 24, "unit": "hours" },
        "timeoutAction": "pause_and_notify",
        "escalation": { "after": 172800, "to": "leader" },
        "reviewBinding": { "code": "imi-gsds-verify-review" }
      },
      "qualityHint": {
        "acceptanceCriteria": [
          {
            "id": "ac-node3-human-done",
            "title": "人工核对已完成",
            "description": "业务员在审核界面完成确认或退回修改",
            "checkType": ["human"],
            "checkConfig": { "reviewer_role": "business_owner" },
            "blocking": true
          }
        ],
        "onFailure": { "strategy": "human_fallback", "notifyRoles": ["business"] }
      },
      "errorStrategy": {
        "strategy": "human_fallback",
        "timeout": { "totalSeconds": 172800, "onExternalTimeout": "fail" },
        "notifyRoles": ["business"],
        "fallbackDescription": "超时未确认则暂停并通知"
      },
      "edges": [
        {
          "targetNodeId": "node-4",
          "dataFlow": [
            { "sourceOutput": "out-3-1", "targetInput": "in-4-1", "description": "确认后的大表传递给中外运上传" }
          ]
        }
      ]
    },

    {
      "id": "node-4",
      "identity": {
        "label": "上传中外运系统",
        "icon": "Upload",
        "description": "将确认后的 IMI 申请大表上传到中外运报关系统",
        "stepIndex": 4,
        "totalSteps": 7,
        "executionMode": "human_manual",
        "estimatedTime": "5-10 分钟"
      },
      "dataContract": {
        "inputs": [
          {
            "id": "in-4-1",
            "name": "确认后的 IMI 申请大表",
            "docRef": "doc-imi-table",
            "source": "previous_step",
            "sourceNodeId": "node-3",
            "required": true,
            "kind": "document",
            "sourceType": "file_path",
            "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        ],
        "outputs": [
          {
            "id": "out-4-1",
            "name": "中外运生成的申报材料",
            "docRef": null,
            "kind": "structured",
            "intent": "从中外运系统下载的报关用申报材料包引用",
            "schema": {
              "type": "object",
              "properties": {
                "materials": { "type": "string", "description": "申报材料文件（PDF/ZIP）" },
                "submissionId": { "type": "string", "description": "中外运系统提交编号" }
              }
            },
            "flowsTo": ["node-5"]
          }
        ]
      },
      "businessIntent": [
        {
          "stepIndex": 1,
          "type": "human_action",
          "description": "登录中外运系统，上传 IMI 申请大表 Excel 文件",
          "target": { "externalRef": "sys-zhongwaiyun" }
        },
        {
          "stepIndex": 2,
          "type": "human_action",
          "description": "下载中外运系统生成的申报材料"
        }
      ],
      "taskType": "human_review",
      "runtimeBinding": { "profileCode": "human-bridge" },
      "humanInteraction": {
        "type": "manual_action",
        "description": "手动操作中外运报关系统",
        "reviewLayout": "checklist",
        "checkItems": ["已上传正确的 Excel 文件", "已确认提交", "已下载生成的材料"],
        "timeout": { "value": 48, "unit": "hours" },
        "timeoutAction": "pause_and_notify",
        "reviewBinding": { "code": "imi-zhongwaiyun-upload-review" }
      },
      "qualityHint": {
        "acceptanceCriteria": [
          {
            "id": "ac-node4-materials-ready",
            "title": "申报材料已下载",
            "description": "检查清单确认：已上传、已提交、已下载材料包",
            "checkType": ["human"],
            "blocking": true
          }
        ],
        "onFailure": { "strategy": "human_fallback", "notifyRoles": ["business"] }
      },
      "errorStrategy": {
        "strategy": "human_fallback",
        "timeout": { "totalSeconds": 86400, "onExternalTimeout": "fail" },
        "notifyRoles": ["business"],
        "fallbackDescription": "中外运系统不可用时，联系中外运客服"
      },
      "edges": [
        {
          "targetNodeId": "node-5",
          "dataFlow": [
            { "sourceOutput": "out-4-1", "targetInput": "in-5-1", "description": "中外运生成的申报材料传递给邮件发送" }
          ]
        }
      ]
    },

    {
      "id": "node-5",
      "identity": {
        "label": "发送申报材料给海关",
        "icon": "Mail",
        "description": "将中外运生成的申报材料通过邮件发送给海关",
        "stepIndex": 5,
        "totalSteps": 7,
        "executionMode": "ai_auto",
        "estimatedTime": "1-2 分钟"
      },
      "dataContract": {
        "inputs": [
          {
            "id": "in-5-1",
            "name": "申报材料",
            "docRef": null,
            "source": "previous_step",
            "sourceNodeId": "node-4",
            "required": true,
            "kind": "structured",
            "sourceType": "inline"
          }
        ],
        "outputs": [
          {
            "id": "out-5-1",
            "name": "邮件发送确认",
            "docRef": null,
            "kind": "structured",
            "intent": "向海关发送邮件的结果回执",
            "schema": {
              "type": "object",
              "properties": {
                "sent": { "type": "boolean" },
                "messageId": { "type": "string" },
                "sentAt": { "type": "string" }
              }
            },
            "flowsTo": ["node-6"]
          }
        ]
      },
      "businessIntent": [
        {
          "stepIndex": 1,
          "type": "send_message",
          "description": "通过邮件将申报材料发送给海关",
          "target": { "externalRef": "sys-customs" }
        }
      ],
      "taskType": "integration",
      "skillBinding": { "code": "imi-email-sender" },
      "runtimeBinding": { "profileCode": "integration-default" },
      "qualityHint": {
        "skillValidations": [
          {
            "skillCode": "imi-email-sender",
            "field": "messageId",
            "rule": "not_empty",
            "severity": "error",
            "description": "SMTP/API 返回有效 messageId 视为发送成功"
          }
        ],
        "acceptanceCriteria": [
          {
            "id": "ac-node5-sent",
            "title": "海关收件邮件已送出",
            "description": "sent=true 且 messageId 存在",
            "checkType": ["deterministic_rule"],
            "blocking": true
          }
        ],
        "onFailure": { "strategy": "retry", "notifyRoles": ["tech"] }
      },
      "errorStrategy": {
        "strategy": "retry",
        "retryPolicy": { "maxRetries": 3, "backoff": "exponential", "delayMs": 1000 },
        "timeout": { "totalSeconds": 300, "externalCallSeconds": 120, "onExternalTimeout": "fail" },
        "notifyRoles": ["business", "tech"],
        "fallbackDescription": "邮件发送失败时，用户手动发送邮件给海关"
      },
      "edges": [
        {
          "targetNodeId": "node-6",
          "dataFlow": [
            { "sourceOutput": "out-5-1", "targetInput": "in-6-1", "description": "邮件发送确认传递给等待证书节点" }
          ]
        }
      ]
    },

    {
      "id": "node-6",
      "identity": {
        "label": "等待并接收海关证书",
        "icon": "Clock",
        "description": "等待约两周，海关返回 IMI 证书后接收并解析",
        "stepIndex": 6,
        "totalSteps": 7,
        "executionMode": "human_confirm",
        "estimatedTime": "约 2 周"
      },
      "dataContract": {
        "inputs": [
          {
            "id": "in-6-1",
            "name": "邮件发送确认",
            "docRef": null,
            "source": "previous_step",
            "sourceNodeId": "node-5",
            "required": true,
            "kind": "structured",
            "sourceType": "inline"
          }
        ],
        "outputs": [
          {
            "id": "out-6-1",
            "name": "海关证书解析数据",
            "docRef": "doc-certificate",
            "kind": "structured",
            "intent": "从海关返回 PDF 证书抽取的结构化字段",
            "flowsTo": ["node-7"]
          }
        ]
      },
      "businessIntent": [
        {
          "stepIndex": 1,
          "type": "wait",
          "description": "等待海关通过邮件返回 IMI 证书（约 2 周）",
          "target": { "externalRef": "sys-customs" }
        },
        {
          "stepIndex": 2,
          "type": "parse",
          "description": "解析证书 PDF，提取签发日期、证书编号、有效期等字段",
          "target": { "docRef": "doc-certificate" },
          "keyFields": ["证书编号", "签发日期", "有效期", "中文名称", "英文名称", "样品性状", "组分", "正式运输名称", "联合国编号", "危险货物类别", "简易包装类别", "GHS分类"]
        }
      ],
      "taskType": "agentic",
      "skillBinding": { "code": "imi-cert-parser" },
      "runtimeBinding": { "profileCode": "agentic-default" },
      "humanInteraction": {
        "type": "verify",
        "description": "确认 AI 解析的证书信息是否正确",
        "reviewLayout": "compare",
        "checkItems": ["证书编号是否正确", "有效期是否合理", "产品信息是否与申请一致"],
        "timeout": { "value": 48, "unit": "hours" },
        "timeoutAction": "pause_and_notify",
        "reviewBinding": { "code": "imi-cert-parse-review" }
      },
      "qualityHint": {
        "skillValidations": [
          {
            "skillCode": "imi-cert-parser",
            "field": "证书编号",
            "rule": "not_empty",
            "severity": "error",
            "description": "证书编号必填"
          },
          {
            "skillCode": "imi-cert-parser",
            "field": "联合国编号",
            "rule": "matches_pattern",
            "params": { "pattern": "^UN\\d{4}$" },
            "severity": "warning",
            "description": "UN 编号格式检查"
          }
        ],
        "acceptanceCriteria": [
          {
            "id": "ac-node6-fields-complete",
            "title": "证书关键字段解析完整",
            "description": "签发日期、有效期、中英文名称等必填字段齐全",
            "checkType": ["deterministic_rule"],
            "blocking": true
          }
        ],
        "onFailure": { "strategy": "human_fallback", "notifyRoles": ["business"] }
      },
      "errorStrategy": {
        "strategy": "human_fallback",
        "retryPolicy": { "maxRetries": 2, "backoff": "fixed", "delayMs": 2000 },
        "timeout": { "totalSeconds": 3600, "externalCallSeconds": 300, "onExternalTimeout": "fail" },
        "notifyRoles": ["business"],
        "fallbackDescription": "AI 无法解析证书时，由用户手动录入证书信息"
      },
      "edges": [
        {
          "targetNodeId": "node-7",
          "dataFlow": [
            { "sourceOutput": "out-6-1", "targetInput": "in-7-1", "description": "证书解析数据传递给核验归档节点" }
          ]
        }
      ]
    },

    {
      "id": "node-7",
      "identity": {
        "label": "证书核验与归档",
        "icon": "ShieldCheck",
        "description": "将证书内容与 IMI 申请大表对比核验，无误则回填证书信息并归档到 IMI List",
        "stepIndex": 7,
        "totalSteps": 7,
        "executionMode": "ai_auto",
        "estimatedTime": "2-5 分钟"
      },
      "dataContract": {
        "inputs": [
          {
            "id": "in-7-1",
            "name": "证书解析数据",
            "docRef": "doc-certificate",
            "source": "previous_step",
            "sourceNodeId": "node-6",
            "required": true,
            "kind": "structured",
            "sourceType": "inline"
          },
          {
            "id": "in-7-2",
            "name": "IMI 申请大表",
            "docRef": "doc-imi-table",
            "source": "previous_step",
            "sourceNodeId": "node-2",
            "required": true,
            "kind": "document",
            "sourceType": "file_path",
            "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        ],
        "outputs": [
          {
            "id": "out-7-1",
            "name": "更新后的 IMI 申请大表",
            "docRef": "doc-imi-table",
            "kind": "document",
            "intent": "回填签发日期、证书编号、有效期后的工作副本",
            "partOf": "deliverable-imi-package",
            "mutations": ["回填签发日期、证书编号、有效期"]
          },
          {
            "id": "out-7-2",
            "name": "IMI List 归档记录",
            "docRef": "doc-imi-list",
            "kind": "document",
            "intent": "追加到 IMI List 的一行归档记录",
            "partOf": "deliverable-imi-package",
            "mutations": ["追加本次申请的完整记录"]
          }
        ]
      },
      "businessIntent": [
        {
          "stepIndex": 1,
          "type": "compare",
          "description": "对比证书内容与 IMI 申请大表，核验关键字段是否一致",
          "target": { "docRef": "doc-certificate" },
          "keyFields": ["中文名称", "英文名称", "样品性状", "组分", "正式运输名称", "联合国编号", "危险货物类别", "简易包装类别", "GHS分类"]
        },
        {
          "stepIndex": 2,
          "type": "conditional",
          "description": "核验通过 → 正常归档；核验不通过 → 纠错流程"
        },
        {
          "stepIndex": 3,
          "type": "write",
          "description": "【正常】回填签发日期、证书编号、有效期到 IMI 申请大表",
          "target": { "docRef": "doc-imi-table" }
        },
        {
          "stepIndex": 4,
          "type": "write",
          "description": "【正常】将本次申请的完整记录追加到 IMI List 归档表",
          "target": { "docRef": "doc-imi-list" }
        },
        {
          "stepIndex": 5,
          "type": "send_message",
          "description": "【异常】将差异信息发给海关，要求重新出证",
          "target": { "externalRef": "sys-customs" },
          "onError": "human_fallback"
        }
      ],
      "taskType": "agentic",
      "skillBinding": { "code": "imi-cert-verifier" },
      "runtimeBinding": { "profileCode": "agentic-default" },
      "qualityHint": {
        "skillValidations": [
          {
            "skillCode": "imi-cert-verifier",
            "field": "证书编号",
            "rule": "not_empty",
            "severity": "error",
            "description": "回填前证书编号不得为空"
          },
          {
            "skillCode": "imi-cert-verifier",
            "field": "签发日期",
            "rule": "not_empty",
            "severity": "error",
            "description": "签发日期必填"
          },
          {
            "skillCode": "imi-cert-verifier",
            "field": "中文名称",
            "rule": "cross_check",
            "params": { "source_a": "certificate.zh_name", "source_b": "imi_table.zh_name", "comparator": "eq" },
            "severity": "warning",
            "description": "证书与申请大表中文名称一致（示例路径，实现以 Skill 为准）"
          }
        ],
        "acceptanceCriteria": [
          {
            "id": "ac-node7-first-pass",
            "title": "证书核验一次通过率",
            "description": "关键字段自动对齐通过率不低于 90%，否则进入人工核对",
            "checkType": ["llm_rubric", "deterministic_rule"],
            "checkConfig": { "min_score": 0.9, "scale": 1 },
            "severity": "warning",
            "blocking": false
          },
          {
            "id": "ac-node7-archive-complete",
            "title": "归档动作完成",
            "description": "IMI List 成功追加记录且大表已回填",
            "checkType": ["deterministic_rule"],
            "blocking": true
          }
        ],
        "issueCategories": ["证书信息与申请不符", "证书日期异常", "缺少必要字段"],
        "onFailure": { "strategy": "human_fallback", "notifyRoles": ["business", "tech"] }
      },
      "errorStrategy": {
        "strategy": "human_fallback",
        "retryPolicy": { "maxRetries": 1, "backoff": "fixed", "delayMs": 0 },
        "timeout": { "totalSeconds": 1800, "externalCallSeconds": 120, "onExternalTimeout": "fail" },
        "notifyRoles": ["business"],
        "fallbackDescription": "自动核验失败时，由人工逐项比对证书与申请信息"
      },
      "edges": []
    }
  ]
}
```

---

## 四、Schema → JobSpec 自动映射规则

### 4.1 映射总览

映射器的工作是**纯搬运**——所有 binding 字段都是技术方在阶段 2 已确认的 code，映射器不做推断、不做选择。

```
FlowAgent Schema（阶段 2 完整版）
    ↓ ① 读取 externalSystems[].auth.secretBinding.code → 填入 Task.secret_refs
    ↓ ② 读取 externalSystems[].toolBinding.code → 填入 Task.tool_codes
    ↓ ③ 读取 nodes[].skillBinding.code → 填入 Task.skill_codes
    ↓ ④ 读取 documents[].contextBinding.code → 填入 Task.context_source_codes
    ↓ ⑤ 读取 globalConfig.contextPolicyBinding.code → 填入 JobSpec.defaults.context_policy_code
    ↓ ⑥ 读取 nodes[].runtimeBinding.profileCode → 填入 Task.runtime_profile_code
    ↓ ⑦ 读取 nodes[].humanInteraction.reviewBinding.code → 填入 Task.review_policy_code
    ↓ ⑧ 读取 nodes[].taskType → 填入 Task.type（并对齐 execution-envelope.task.type）
    ↓ ⑨ 读取 nodes[].dataContract.outputs（kind/intent/shapeRef/partOf）→ Task.deliverables（如有该扩展字段）
    ↓ ⑩ 读取 nodes[].qualityHint.skillValidations / acceptanceCriteria → skill_contracts 校验规则 / acceptance_criteria
    ↓ ⑪ 读取 nodes[].errorStrategy.timeout / retryPolicy → Task 超时与重试策略（对齐 policies.timeout 等）
    ↓ ⑫ 读取 nodes[].businessIntent + edges → 生成 execution_plan.skill_contracts 语义骨架（与 skillBinding 拼装）
    ↓ ⑬ 组装 JobSpec（metadata + tasks + flow）
    ↓ ────────── v2.4 新增：运行时自适应配置 ──────────
    ↓ ⑭ 读取 adaptiveConfig.runtimeAdjustable → 填入 JobSpec.runtime_adjustable（v2 字段）
    ↓ ⑮ 读取 adaptiveConfig.envAssumptions → 填入 JobSpec.env_assumptions（v2 字段）
    ↓ ⑯ 读取 adaptiveConfig.adjustmentPolicies → 填入 JobSpec.adjustment_policies（v2 字段）
    ↓ ──────────────────────────────────────────────
    ↓ ⑰ validate → import → publish（并由 Infra 物化为 Runtime Pack）
```

**导出前置条件**：Schema 中所有 binding 字段不为空；每个节点 `taskType` 已由技术方确认（即将映射到 `Task.type`）。验证未通过则中止导出，报告缺失字段。

### 4.2 每个 Task 的资源聚合算法

映射器需要为每个节点聚合它引用的所有全局资源 code。以下是确定性的聚合逻辑（伪代码）：

```python
def aggregate_resources(node, schema):
    """对一个节点，收集它需要的所有 context_source / tool / secret codes"""

    # 1. context_source_codes — 从该节点引用的所有 docRef 解析
    doc_refs = set()
    for inp in node.dataContract.inputs:
        if inp.docRef:
            doc_refs.add(inp.docRef)
    for out in node.dataContract.outputs:
        if out.docRef:
            doc_refs.add(out.docRef)
    for step in node.businessIntent:
        if step.target and step.target.docRef:
            doc_refs.add(step.target.docRef)

    context_source_codes = dedupe([
        schema.documents[ref].contextBinding.code
        for ref in doc_refs
        if schema.documents[ref].contextBinding
    ])

    # 2. tool_codes + secret_refs — 从该节点引用的所有 externalRef 解析
    ext_refs = set()
    for inp in node.dataContract.inputs:
        if inp.externalRef:
            ext_refs.add(inp.externalRef)
    for step in node.businessIntent:
        if step.target and step.target.externalRef:
            ext_refs.add(step.target.externalRef)

    tool_codes = dedupe([
        schema.externalSystems[ref].toolBinding.code
        for ref in ext_refs
        if schema.externalSystems[ref].toolBinding
    ])

    secret_refs = dedupe([
        schema.externalSystems[ref].auth.secretBinding.code
        for ref in ext_refs
        if schema.externalSystems[ref].auth.secretBinding
    ])

    return context_source_codes, tool_codes, secret_refs
```

> 规则：遍历节点的 `dataContract.inputs`、`dataContract.outputs`、`businessIntent[].target` 三处引用源，解引用到全局注册表后取出 binding code。**不做推断**——如果某个 externalSystem 没有 `toolBinding`（如 `sys-zhongwaiyun`），则不为该节点生成 `tool_codes` 条目。

### 4.3 项目级映射


| FlowAgent Schema                               | →   | JobSpec 字段                             | 映射方式                             |
| ---------------------------------------------- | --- | -------------------------------------- | -------------------------------- |
| `meta.id`                                      | →   | `JobSpec.metadata.code`                | 转 kebab-case                     |
| `meta.name`                                    | →   | `JobSpec.metadata.name`                | 直接搬运                             |
| `meta.businessContext`                         | →   | `JobSpec.metadata.description`         | 直接搬运                             |
| `documents[].contextBinding.code`              | →   | 各 Task 的 `context_source_codes[]`      | 节点通过 docRef 引用文档 → 解析出 code      |
| `externalSystems[].toolBinding.code`           | →   | 各 Task 的 `tool_codes[]`                | 节点通过 externalRef 引用系统 → 解析出 code |
| `externalSystems[].auth.secretBinding.code`    | →   | 各 Task 的 `secret_refs[]`               | 跟随 Tool 所属 ExternalSystem        |
| `globalConfig.contextPolicyBinding.code`       | →   | `JobSpec.defaults.context_policy_code` | 直接搬运                             |
| `globalConfig.orchestration` + `nodes[].edges` | →   | `JobSpec.flow[]`                       | 拼接有向图                            |
| **v2.4 新增**                                    |     |                                        |                                  |
| `adaptiveConfig.runtimeAdjustable`             | →   | `JobSpec.runtime_adjustable`           | 直接搬运（v2 字段）                      |
| `adaptiveConfig.envAssumptions`                | →   | `JobSpec.env_assumptions`              | 直接搬运（v2 字段）                      |
| `adaptiveConfig.adjustmentPolicies`            | →   | `JobSpec.adjustment_policies`          | 直接搬运（v2 字段）                      |


### 4.4 节点级映射


| FlowAgent 节点字段                                                                        | →   | JobSpec Task / Runtime 落点                                                          | 映射方式                                                         |
| ------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `taskType`                                                                            | →   | `Task.type`；`execution-envelope.task.type`                                         | 技术方确认后**直接搬运**（与 Runtime Protocol 枚举一致）                      |
| `identity.label`                                                                      | →   | `Task.name`                                                                        | 直接搬运                                                         |
| `identity.description`                                                                | →   | `Task.instruction`                                                                 | 直接搬运                                                         |
| `skillBinding.code`                                                                   | →   | `Task.skill_codes[]`；`capabilities.skills`；`skill_contracts[].skill_code` 主引用      | 直接搬运                                                         |
| `runtimeBinding.profileCode`                                                          | →   | `Task.runtime_profile_code`；`execution-envelope.runtime.id`                        | 直接搬运                                                         |
| `dataContract.inputs` + `kind` / `sourceType` / `mediaType` + 合并 docRef schema        | →   | `Task.input_schema`；`context.json.inputs[]`                                        | 合并生成 JSON Schema；`kind`→`InputSlot.kind` 等**按字段搬运**          |
| `dataContract.outputs` + `kind` / `intent` / `shapeRef` / `partOf` + 合并 docRef schema | →   | `Task.output_schema`；`task.deliverables[]`                                         | 结构入 `output_schema`；`kind`/`intent`→`deliverables` **按字段搬运** |
| `qualityHint.skillValidations`                                                        | →   | `context.json` `execution_plan.skill_contracts[].expected_output.validation_rules` | 按 `skillCode` 归并到对应合同                                        |
| `qualityHint.acceptanceCriteria`                                                      | →   | `execution-envelope.task.acceptance_criteria`                                      | 直接搬运（id/title/description/checkType…）                        |
| `errorStrategy.timeout` / `retryPolicy`                                               | →   | `policies.timeout`；外部重试参数                                                          | **按字段搬运**（总时长、外部调用时长、onExternalTimeout 等）                    |
| `errorStrategy.strategy` 等                                                            | →   | Job/flow 级失败处置；可与 `skill_contracts[].on_failure` 策略对齐                              | 见平台约定                                                        |
| `humanInteraction.reviewBinding.code`                                                 | →   | `Task.review_policy_code`                                                          | 直接搬运                                                         |
| 节点 `externalRef` → 对应系统的 `toolBinding.code`                                           | →   | `Task.tool_codes[]`                                                                | 解引用后搬运                                                       |
| Tool 所属系统的 `secretBinding.code`                                                       | →   | `Task.secret_refs[]`                                                               | 跟随 Tool 搬运                                                   |
| `businessIntent` + `edges` + `skillBinding`                                           | →   | `context.json` `execution_plan.skill_contracts`                                    | **确定性拼装**（阶段顺序、依赖提示）；不推断未声明的 Skill                           |
| `edges[]`                                                                             | →   | `JobSpec.flow[]`                                                                   | from/to + condition                                          |


### 4.5 edges → flow 映射

```
Schema edges:                        JobSpec flow:
node-1.edges[0].targetNodeId: node-2  →  { from: "node-1", to: "node-2" }
node-2.edges[0].targetNodeId: node-3  →  { from: "node-2", to: "node-3" }
...
首节点（无入边）                       →  { from: null, to: "node-1" }

有 condition 的 edge:
edge.condition: { field, operator, value }
→ flow: { from: "node-7", to: "write-back", condition: { path: field, equals: value } }
```

### 4.6 映射示例：node-2 → JobSpec Task

```
Schema node-2（阶段 2 完整版）:
  taskType: "integration"              → Task.type = integration（技术方已确认）
  skillBinding.code: "imi-gsds-enricher"
  runtimeBinding.profileCode: "integration-default"
  businessIntent[0].target.externalRef: "sys-gsds-db"
  → sys-gsds-db.toolBinding.code: "imi-gsds-query"
  → sys-gsds-db.auth.secretBinding.code: "imi-gsds-db-credentials"

映射器输出 JobSpec Task:
  - code: node-2
    name: 按 BBN/Part 从 GSDS 补全申请大表
    instruction: 根据申请清单中的 BBN 和 Part，查询 GSDS 数据库获取产品安全数据，补全 IMI 申请大表
    runtime_profile_code: integration-default
    context_policy_code: imi-processing-default
    skill_codes:
      - imi-gsds-enricher
    tool_codes:
      - imi-gsds-query
    secret_refs:
      - imi-gsds-db-credentials
    output_schema: { ... 从 dataContract.outputs 合并生成 ... }

所有资源（Skill、Tool、Secret、RuntimeProfile）已由技术方在阶段 2 预先注册。
映射器只做引用，不做注册。
```

---

## 五、渐进完善：三阶段

Schema 在三个阶段逐步填充，阶段 2 结束后所有 binding 字段不为空，阶段 3 才能导出。

### 阶段 1：业务翻译（业务方 + AI）

AI 根据用户的自然语言描述生成骨架。**所有 binding 字段此阶段为空**。


| 字段                                            | 填充程度                                                  |
| --------------------------------------------- | ----------------------------------------------------- |
| meta                                          | 完整                                                    |
| documents                                     | 骨架（name, fileType, role），schema 可能不完整                 |
| documents[].contextBinding                    | **空**                                                 |
| externalSystems                               | 骨架（name, type, integration.current）                   |
| externalSystems[].toolBinding / secretBinding | **空**                                                 |
| globalConfig.orchestration                    | 完整                                                    |
| globalConfig.contextPolicyBinding             | **空**                                                 |
| adaptiveConfig                                | **空**（v2.4 新增，阶段 1 不填）                                |
| nodes[].identity                              | 完整                                                    |
| nodes[].dataContract                          | 部分（name, source, docRef）；可选初步填写 `kind` / `sourceType` |
| nodes[].businessIntent                        | 完整（type + description）                                |
| nodes[].taskType                              | AI 自动标注                                               |
| nodes[].skillBinding                          | **空**                                                 |
| nodes[].runtimeBinding                        | **空**                                                 |
| nodes[].humanInteraction                      | 完整（checkItems, timeout 等），reviewBinding **空**         |
| nodes[].qualityHint                           | `skillValidations` / `acceptanceCriteria` 空或草稿        |
| nodes[].errorStrategy                         | 默认策略（可缺省 timeout/retryPolicy，阶段 2 补全）                 |
| edges                                         | 完整                                                    |


### 阶段 2：技术确认（技术方手动填入）

技术方完成以下工作：

1. 在 task-platform 注册所有资源（Skill、Tool、Secret、RuntimeProfile、ReviewPolicy、ContextPolicy、ContextSource）
2. 把注册得到的 code 回填到 Schema 的 binding 字段


| 字段                                     | 技术方操作                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| documents[].contextBinding             | 填入已注册的 ContextSource code                                                            |
| documents[].schema                     | 补全完整列定义、类型、约束                                                                        |
| documents[].samples                    | 填入真实样本数据                                                                             |
| externalSystems[].toolBinding          | 填入已注册的 Tool code                                                                     |
| externalSystems[].auth.secretBinding   | 填入已注册的 Secret code                                                                   |
| externalSystems[].apiSpec              | 补全 endpoints（有 API 时）                                                                |
| globalConfig.contextPolicyBinding      | 填入已注册的 ContextPolicy code                                                            |
| **adaptiveConfig（v2.4 新增）**            | 按需填入运行时自适应配置：                                                                        |
| adaptiveConfig.runtimeAdjustable       | 声明哪些输入参数可在运行时动态调整（如预算、并发数）                                                           |
| adaptiveConfig.envAssumptions          | 声明业务依赖的外部环境假设（如平台 API 可用、算法效果稳定）                                                     |
| adaptiveConfig.adjustmentPolicies      | 预定义当假设被打破或收到特定事件时的自动响应策略                                                             |
| nodes[].taskType                       | **确认或修正** AI 预标注（**必填**，映射到 `Task.type`）                                             |
| nodes[].skillBinding                   | 填入已注册的 Skill code                                                                    |
| nodes[].runtimeBinding                 | 填入已注册的 RuntimeProfile code                                                           |
| nodes[].humanInteraction.reviewBinding | 填入已注册的 ReviewPolicy code                                                             |
| nodes[].qualityHint                    | 补全 `skillValidations`（过程校验）与 `acceptanceCriteria`（最终验收）                              |
| nodes[].errorStrategy                  | 补全 `timeout`、`retryPolicy`（对齐 Runtime `TimeoutPolicy`）                               |
| nodes[].dataContract                   | 补全 inline schema；为 Runtime 补充 `inputs[].kind`/`sourceType`、`outputs[].kind`/`intent` |
| nodes[].businessIntent                 | 校对步骤顺序与依赖表述，确保可生成 `skill_contracts` 骨架                                               |


### 阶段 3：JobSpec 导出（自动映射器）

**前置条件**：所有 binding 字段不为空；所有节点 `taskType` 已确认（映射器启动时先校验）。

```
① 校验 Schema 完整性（所有 binding 不为空）
② 按第四章规则纯搬运生成 JobSpec
③ validate → import → publish
```

映射器不注册资源、不推断、不选择——如果有 binding 为空则直接报错。

---

## 六、FlowAgent Schema → task-platform 映射表


| FlowAgent Schema 字段                             | →   | JobSpec / 资源字段                                                   | 映射方式                         |
| ----------------------------------------------- | --- | ---------------------------------------------------------------- | ---------------------------- |
| `meta.id`                                       | →   | `JobSpec.metadata.code`                                          | 转 kebab-case                 |
| `meta.name`                                     | →   | `JobSpec.metadata.name`                                          | 直接搬运                         |
| `meta.businessContext`                          | →   | `JobSpec.metadata.description`                                   | 直接搬运                         |
| `documents[].contextBinding.code`               | →   | `Task.context_source_codes[]`                                    | 按节点 docRef 解引用               |
| `externalSystems[].toolBinding.code`            | →   | `Task.tool_codes[]`                                              | 按节点 externalRef 解引用          |
| `externalSystems[].auth.secretBinding.code`     | →   | `Task.secret_refs[]`                                             | 跟随 Tool 所属系统                 |
| `globalConfig.contextPolicyBinding.code`        | →   | `JobSpec.defaults.context_policy_code`                           | 直接搬运                         |
| `globalConfig.orchestration` + `edges`          | →   | `JobSpec.flow[]`                                                 | DAG 拼接                       |
| `nodes[].taskType`                              | →   | `Task.type`；`execution-envelope.task.type`                       | 技术方确认后直接搬运                   |
| `nodes[].identity.label`                        | →   | `Task.name`                                                      | 直接搬运                         |
| `nodes[].identity.description`                  | →   | `Task.instruction`                                               | 直接搬运                         |
| `nodes[].skillBinding.code`                     | →   | `Task.skill_codes[]`                                             | 直接搬运                         |
| `nodes[].runtimeBinding.profileCode`            | →   | `Task.runtime_profile_code`                                      | 直接搬运                         |
| `nodes[].humanInteraction.reviewBinding.code`   | →   | `Task.review_policy_code`                                        | 直接搬运                         |
| `nodes[].dataContract`                          | →   | `Task.input_schema` + `Task.output_schema`；`context.json` inputs | 合并 docRef；**输入 kind 等**按字段搬运 |
| `nodes[].dataContract.outputs`（`kind`/`intent`） | →   | `task.deliverables[]`                                            | 按字段搬运                        |
| `nodes[].qualityHint.skillValidations`          | →   | `skill_contracts` 内 `validation_rules`                           | 按 skillCode 归并               |
| `nodes[].qualityHint.acceptanceCriteria`        | →   | `task.acceptance_criteria`                                       | 直接搬运                         |
| `nodes[].errorStrategy`                         | →   | `policies.timeout` 等                                             | 按字段搬运                        |
| `nodes[].businessIntent`                        | →   | `execution_plan.skill_contracts` 骨架                              | 与 skillBinding/edges 确定性拼装   |
| `nodes[].edges[]`                               | →   | `JobSpec.flow[]` 的一条边                                            | from/to + condition          |
| **v2.4 新增**                                     |     |                                                                  |                              |
| `adaptiveConfig.runtimeAdjustable`              | →   | `JobSpec.runtime_adjustable`                                     | 直接搬运（v2 字段）                  |
| `adaptiveConfig.envAssumptions`                 | →   | `JobSpec.env_assumptions`                                        | 直接搬运（v2 字段）                  |
| `adaptiveConfig.adjustmentPolicies`             | →   | `JobSpec.adjustment_policies`                                    | 直接搬运（v2 字段）                  |


---

## 七、验证清单

导出 JobSpec 前，映射器自动校验以下清单。任何一项不通过即中止导出。

### Binding 完整性（阶段 2 交付标准）

- 每个 `documents[]` 都有 `contextBinding.code`
- 每个有 API 的 `externalSystems[]` 都有 `toolBinding.code`
- 每个需要认证的 `externalSystems[]` 都有 `auth.secretBinding.code`
- `globalConfig.contextPolicyBinding.code` 不为空
- 每个非 `human_review` 节点都有 `skillBinding.code`
- 每个节点都有 `runtimeBinding.profileCode`
- 每个有 `humanInteraction` 的节点都有 `reviewBinding.code`

### 业务逻辑完整性

- 每个节点都有经技术方确认的 `taskType`（与将导出的 `Task.type` 一致）
- 每个节点的 `businessIntent` 至少有一步
- `identity.description` 足够详细（将直接成为 Task.instruction）
- 结构化文档有 `schema` 且字段级完整
- 需要 Runtime 精确定位的输入/输出已补充 `dataContract.inputs[].kind` / `sourceType` 与 `outputs[].kind` / `intent`（若留空，映射器仅生成最小默认）

### 数据流完整性

- 每条 `edge.dataFlow[].sourceOutput` 在当前节点的 outputs 中存在
- 每条 `edge.dataFlow[].targetInput` 在目标节点的 inputs 中存在
- 目标节点 `required: true` 的 input 至少有一条 dataFlow 指向它（或 source 为 user/default）

### 引用完整性

- `businessIntent` 中引用的 `docRef` / `externalRef` 在全局注册表中存在
- 所有 binding code 在 task-platform 已注册（可通过 API 校验）
- 没有孤立节点（非首节点无入边、非尾节点无出边）
- 没有循环依赖

### 自适应配置完整性（v2.4 新增，可选）

若 `adaptiveConfig` 存在，校验以下规则：

- `runtimeAdjustable[].path` 引用的参数路径在 `input_schema` 或 `nodes[].dataContract` 中存在
- `runtimeAdjustable[].adjustScope` 为有效枚举值（`hot` / `warm` / `cold`）
- `envAssumptions[].id` 全局唯一
- `envAssumptions[].monitorType` 为有效枚举值
- `adjustmentPolicies[].id` 全局唯一
- `adjustmentPolicies[].trigger.ref` 引用的 assumption id 在 `envAssumptions` 中存在（若 `trigger.type` 为 `assumption_violated`）
- `adjustmentPolicies[].actions[].type` 为有效枚举值
- 若 `actions[].type` 为 `adjust_param`，则 `config.targetParam` 在 `runtimeAdjustable` 中存在

