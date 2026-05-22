# FlowAgent JSON Schema 技术评审说明

> 版本：v1.2 | 日期：2026-04-28
>
> 配套文档：[`可执行Schema规范.md`](./可执行Schema规范.md)（v2.3，完整接口定义 + IMI 示例；对齐 Agent Runtime Protocol）

---

## 一、Schema 是什么

FlowAgent JSON Schema 是一份**中间表示（IR）**，它的位置在整个系统中是：

```
自然语言 SOP（业务方描述的操作流程）
    ↓ ① 业务翻译（业务方 + AI）
FlowAgent Schema 骨架（业务方确认）
    ↓ ② 技术确认（技术方注册资源 + 回填 binding）
FlowAgent Schema 完整版
    ↓ ③ 映射器（纯搬运，不推断）
task-platform JobSpec
    ↓ ④ validate → import → publish
可执行 Job → Scheduler 调度 → Infra 物化 Runtime Pack → Runtime 执行
```

**Schema 不是 JobSpec。** JobSpec 是 task-platform 消费的纯执行配置；任务运行时 Infra 再将其展开为 **Runtime Pack**（`execution-envelope.json`、`context.json` 等）。Schema 比 JobSpec "胖"——它包含执行配置 + 业务上下文 + 可读性信息。映射器的工作是从 Schema 中提取出 JobSpec / Task 扩展字段所需的结构化来源（并与 Runtime Protocol 对齐）。

---

## 二、Schema 的三重角色

Schema 同时服务三个读者：

| 读者 | Schema 给它什么 | 对应字段 |
|------|----------------|---------|
| **映射器 / task-platform** | 可确定性搬运的执行配置 | 所有 `xxxBinding` 字段、`dataContract`（含 inputs/outputs 的 kind/intent）、`edges`、`identity.label/description`、`taskType`、`businessIntent`（拼装 skill_contracts 骨架） |
| **Runtime** | Task 的输入输出契约、两层质量、超时策略 | `input_schema`/`output_schema`、`qualityHint.skillValidations` + `acceptanceCriteria`、`errorStrategy.timeout`/`retryPolicy` |
| **人（业务方 / 技术方 / 维护者）** | 可读的业务知识 | `businessIntent`、`taskType`（预标注→确认）、`qualityHint`、`documents.samples`、`externalSystems.capabilities/constraints` |

设计原则：**每个字段都有明确的消费者。没有"只是写着好看"的字段。**

---

## 三、系统分层与职责边界

### 3.1 三层架构

| 层 | 职责 | 保证什么 |
|----|------|---------|
| **FlowAgent 层** | 业务翻译 + 技术确认 + 导出 JobSpec | 方案设计正确 |
| **Infra 层**（task-platform） | 存储 JobSpec + 按 DAG 调度 Task + 管理 Task 间数据传递 | 整个 Job 跑完 |
| **Runtime 层** | 加载 Skill + 注入 Tool/Secret + 执行 + 校验产出 | 每个 Task 做对 |

各层不越界：

- FlowAgent 不管 Task 怎么执行（Runtime 的事）
- Runtime 不管 Task 的执行顺序（Scheduler 的事）
- Infra 不管 Skill 内部逻辑（Skill 的事）

### 3.2 Job → Task → Skill 三层

| 层 | 是什么 | 关心什么 |
|----|--------|---------|
| **Job** | 一个完整的业务流程 | 有哪些 Task、怎么编排 |
| **Task** | 一个有独立交付物的工作单元 | 输入什么、输出什么、用什么 Skill、做对了没有 |
| **Skill** | Task 的实际执行逻辑 | 怎么做（LLM 推理 / API 调用 / 脚本） |

**Task 是一个黑盒契约**：不关心 Skill 内部用了什么方法，只关心交付物是否符合 `output_schema` + **`qualityHint` 两层**（过程 `skillValidations` + 最终 `acceptanceCriteria`）。

**Task 的边界判断标准**：这个中间结果需要独立验收吗？需要 → 独立 Task。不需要 → 放在一个 Task 内部（`businessIntent` 的多个步骤；这些步骤仍参与生成该 Task 的 `skill_contracts` 语义骨架）。

---

## 四、Schema 分层结构

```
ExecutableProjectSchema
│
├── meta                          # 项目身份证
│
├── documents[]                   # 全局文档注册表（定义一次，节点通过 docRef 引用）
│   ├── schema                    #   文档结构定义
│   ├── samples[]                 #   真实数据样本
│   └── contextBinding?           #   已注册的 ContextSource code（技术方填）
│
├── externalSystems[]             # 全局外部系统注册表
│   ├── integration               #   对接方式和状态
│   ├── auth.secretBinding?       #   已注册的 Secret code（技术方填）
│   ├── toolBinding?              #   已注册的 Tool code（技术方填）
│   └── capabilities/constraints  #   系统能力和限制（给人看）
│
├── globalConfig                  # 全局配置
│   ├── orchestration             #   编排方式
│   └── contextPolicyBinding?     #   已注册的 ContextPolicy code（技术方填）
│
└── nodes[]                       # 节点列表
    ├── identity                  #   基本信息（label → Task.name, description → Task.instruction）
    ├── dataContract              #   数据契约（inputs/outputs → input_schema/output_schema）
    ├── businessIntent[]          #   业务意图步骤 → 参与 skill_contracts 骨架拼装
    ├── taskType?                 #   AI 预标注 → 技术方确认 → Task.type（Runtime envelope）
    ├── skillBinding?             #   已注册的 Skill code（技术方填）
    ├── runtimeBinding?           #   已注册的 RuntimeProfile code（技术方填）
    ├── humanInteraction?         #   人机交互契约 + reviewBinding
    ├── qualityHint?              #   skillValidations（过程）+ acceptanceCriteria（最终）
    ├── errorStrategy             #   错误策略
    └── edges[]                   #   出边 → JobSpec.flow
```

### 4.1 全局资源为什么独立

`documents[]` 和 `externalSystems[]` 放在项目级而非节点级，因为：

- 同一份文档可能被多个节点引用（如 IMI 申请大表被 node-2 写入、node-3 确认、node-7 回填）
- 同一个外部系统可能被多个节点使用（如邮箱被 node-1 收件、node-5 发件）
- 定义一次，引用多次，保证单一来源

### 4.2 字段分类：映射 vs 主要给人看

| 映射到 JobSpec / Runtime Pack 来源 | 主要给人看 / 辅助说明 |
|-----------------------------------|----------------------|
| 所有 `xxxBinding.code` | `documents.samples` |
| `taskType`（阶段 2 确认）→ `Task.type` | `identity.executionMode` / `estimatedTime` |
| `dataContract` → `input_schema` / `output_schema`；`inputs[].kind` 等 → Runtime `InputSlot` | — |
| `outputs[].kind` / `intent` → `deliverables` | — |
| `qualityHint.skillValidations` → `validation_rules`；`acceptanceCriteria` → `acceptance_criteria` | — |
| `errorStrategy` → `policies.timeout` 等 | — |
| `businessIntent` + `skillBinding` + `edges` → `skill_contracts` **确定性拼装** | 步骤可读说明仍面向人 |
| `edges` → `flow[]` | `externalSystems.capabilities/constraints/humanFallback` |
| `orchestration` | — |

---

## 五、Binding 机制

### 5.1 核心原则：binding 即真相

所有 `xxxBinding` 字段是技术方**已在 task-platform 注册的资源 code**，不是建议、不是推断。

### 5.2 两阶段分离

| 阶段 | 谁做 | binding 状态 |
|------|------|-------------|
| 阶段 1：业务翻译 | 业务方 + AI | 所有 binding **为空** |
| 阶段 2：技术确认 | 技术方 | 所有 binding **填入已注册的 code** |

阶段 2 的工作流：

```
技术方看 Schema 骨架（businessIntent 描述了每个节点要做什么）
    ↓
判断需要什么资源（Skill、Tool、Secret、RuntimeProfile、ReviewPolicy...）
    ↓
在 task-platform 注册这些资源
    ↓
把注册得到的 code 回填到 Schema 的 binding 字段
```

### 5.3 映射器的工作

**纯搬运**——读取 binding 字段的 code，填入 JobSpec 对应位置。

导出前置条件：所有 binding 字段不为空；每个节点 `taskType` 已由技术方确认。任何一项不满足即中止导出，报告缺失字段。

### 5.4 全部 Binding 字段清单

| Binding 字段 | 所在位置 | 映射到 JobSpec |
|-------------|---------|---------------|
| `contextBinding.code` | `documents[]` | `Task.context_source_codes[]` |
| `toolBinding.code` | `externalSystems[]` | `Task.tool_codes[]` |
| `secretBinding.code` | `externalSystems[].auth` | `Task.secret_refs[]` |
| `contextPolicyBinding.code` | `globalConfig` | `JobSpec.defaults.context_policy_code` |
| `skillBinding.code` | `nodes[]` | `Task.skill_codes[]` |
| `runtimeBinding.profileCode` | `nodes[]` | `Task.runtime_profile_code` |
| `reviewBinding.code` | `nodes[].humanInteraction` | `Task.review_policy_code` |

---

## 六、RuntimeProfile 设计

RuntimeProfile 是 task-platform 中一个**完整的执行方案**，包含：

- **workerType** — 执行者类型（决定用什么 Worker）
- **config** — 运行参数

| workerType | 适用场景 | 典型 config |
|---|---|---|
| `llm` | 需要 LLM 理解/推理 | model, temperature, maxTokens, timeout, maxIterations |
| `http` | API 调用、数据库查询 | timeout, maxRetry, retryBackoff |
| `script` | 纯规则/脚本/数据转换 | timeout, memoryLimit |
| `human_gateway` | 推给人、等回调 | slaHours, escalationAfter, notificationChannel |

技术方根据节点已确认的 `taskType`（与 Skill 语义一致）和实际需求，选择合适的 RuntimeProfile。

### Agentic 节点的额外护栏

对于 `workerType: llm` 的 RuntimeProfile，config 中的以下参数起护栏作用：

| 参数 | 防什么 |
|------|-------|
| `maxIterations` | 防 LLM 死循环 |
| `tokenBudget` | 防烧钱 |
| `timeout` | 防单次推理超时 |

---

## 七、Task 的质量保障体系

### 7.1 检验顺序（结构 → 过程 → 终验 → 人）

Runtime 建议按以下顺序校验产出（具体以实现为准）：

```
Skill 返回结果
    │
    ▼
① output_schema 校验（结构对不对）
    │  不通过 → errorStrategy
    ▼
② qualityHint.skillValidations（过程校验，对齐 skill_contracts.validation_rules）
    │  severity=error 不通过 → errorStrategy / on_failure
    │  severity=warning 不通过 → 记录告警，继续
    ▼
③ qualityHint.acceptanceCriteria（最终验收，对齐 acceptance_criteria）
    │  blocking 未通过 → 标记失败或触发人工
    ▼
④ humanInteraction 人工审核（人说对不对）
    │  有 → 推给人，人拒绝 → errorStrategy
    │  无 → 直接继续
    ▼
⑤ Task 通过，输出流转到下游节点
```

### 7.2 校验分层定位

| 标准 | 验什么 | 由谁执行 | 严格程度 |
|------|--------|---------|---------|
| `output_schema` | 数据结构是否符合 JSON Schema | Runtime 自动 | 最严格，必须通过 |
| `qualityHint.skillValidations` | 每步 Skill 输出字段规则（正则、非空、交叉检查） | Runtime / Skill | 过程失败可快速止损 |
| `qualityHint.acceptanceCriteria` | Task 结束时的综合达标（规则 / 工具探针 / LLM rubric / 人工门槛） | Runtime / 人 | 最终兜底 |
| `humanInteraction` | 人的主观判断 | 人 | 最可靠但最慢 |

### 7.3 确定性规则的三种放法

| 规则类型 | 放哪里 | 例子 |
|---------|--------|------|
| JSON Schema 能表达的（非空、类型、正则、范围、枚举） | `output_schema` | BBN 格式 `^BBN-\d{3}$`、UN 编号 `^UN\d{4}$` |
| 跨字段 / 跨数据源的确定性规则 | Skill 内部代码 | 有效期 > 签发日期、证书名称和大表名称一致 |
| 机器无法判断的 | `humanInteraction` | GHS 分类描述是否等价 |

最佳实践：简单规则在 `output_schema` 和 Skill 内部都写——Skill 先自检（快速失败），Runtime 再验一遍（防 Skill bug）。

### 7.4 五层质量防线

| 层 | 名称 | 做什么 | 对应机制 |
|----|------|--------|---------|
| L1 | Skill 内部质量 | Skill 自检、内部重试、格式校验 | Skill 代码 |
| L2 | Task 级质量门 | output_schema + qualityHint 两层（过程 + 终验） | Schema 定义，Runtime 执行 |
| L3 | 人工审核 | 关键节点人工确认 | `humanInteraction` + `reviewBinding` |
| L4 | 跨节点一致性 | 上下游数据比对 | 专门的核验节点（如 node-7） |
| L5 | 持续改进 | Issue Registry + 样本回归测试 + 指标监控 | 运营阶段 |

---

## 八、Workflow 与 Agentic 的统一

### 8.1 为什么同一套 Schema

本产品面向 ToB 大企业。即使是 Agentic 流程，也是**有方案的**——先设计好流程，再通过 Agent 方式提效执行。

| | Workflow 节点 | Agentic 节点 |
|---|---|---|
| 方案层面 | 有固定方案 | 也有固定方案 |
| 节点之间 | DAG 确定流转 | DAG 确定流转（一样） |
| 节点内部 | 确定性执行（脚本/API/规则） | AI 自主执行（多轮推理、自检、重试） |

**DAG 结构一样，区别在 Skill 和 RuntimeProfile。** Schema 层面不需要区分。

### 8.2 差异被谁吸收

| 差异 | 吸收层 |
|------|--------|
| 执行方式（确定性 vs LLM 推理） | Skill |
| 执行参数（超时、重试、模型选择） | RuntimeProfile |
| 过程护栏（迭代上限、token 预算） | RuntimeProfile.config |
| Loop / 多轮重试 | Skill 内部 |

Schema 层面的 `output_schema`、`qualityHint`、`humanInteraction`、`errorStrategy` 对两种类型**完全通用**。

### 8.3 taskType 的作用

`taskType` 在阶段 1 由 AI 自动标注，阶段 2 由技术方**必填确认**，映射到 **`Task.type`**（并进入 `execution-envelope.task.type`）。它与 `runtimeBinding`（RuntimeProfile）配合：`taskType` 表达语义分类，RuntimeProfile 表达执行器配置。

| 标签 | 含义 | 技术方据此选择 |
|------|------|---------------|
| `agentic` | 需要 LLM 理解/推理 | LLM 类 Skill + llm 类 RuntimeProfile |
| `integration` | 调 API / 查 DB | API 类 Skill + http 类 RuntimeProfile |
| `deterministic` | 纯规则/脚本 | 脚本类 Skill + script 类 RuntimeProfile |
| `human_review` | 必须人做 | ReviewPolicy + human_gateway 类 RuntimeProfile |

---

## 九、完整执行链路

| 阶段 | 所在层 | 执行者 | 输入 → 输出 |
|------|--------|--------|------------|
| ① 业务翻译 | FlowAgent | 业务方 + AI | 自然语言 SOP → Schema 骨架 |
| ② 技术确认 | FlowAgent | 技术方 | Schema 骨架 → 完整 Schema（所有 binding 不为空） |
| ③ 导出 | FlowAgent → Infra | 映射器（纯搬运 + 确定性拼装） | Schema → JobSpec（含 Task 扩展字段来源） |
| ④ 导入 | Infra | task-platform | JobSpec → 系统内部表示 |
| ⑤ 验证 | Infra | task-platform | 校验所有资源引用存在、flow 拓扑无环 |
| ⑥ 发布 | Infra | task-platform | Job 变为可执行状态 |
| ⑦ 调度 | Infra | Scheduler | 按 flow 拓扑依次分发 Task |
| ⑧ 分发 | Runtime | Scheduler → Worker | 根据 runtime_profile_code 选择 Worker |
| ⑨ 执行 | Runtime | Worker + Skill | 加载 Skill + 注入 Tool/Secret + 执行 |
| ⑩ 检验 | Runtime | Worker | output_schema + qualityHint（两层）+ humanInteraction |

### 9.1 Infra 分发 Task 的决策依据

Scheduler 收到一个待执行 Task 时，按以下字段做分发决策：

| 决策维度 | 读取字段 | 说明 |
|----------|---------|------|
| **Worker Pool 选择** | `runtimeBinding.profileCode` | 主要依据。RuntimeProfile 中的 `workerType` 决定分发到 llm / http / script / human_gateway 哪个 Worker Pool |
| **队列路由** | `taskType` | 辅助路由。如 `human_review` 进入人工审核队列，`integration` 可进入高优先级 API 队列 |
| **Task 级 SLA** | `errorStrategy.timeout.totalSeconds` | 设置 Task 超时告警与强制终止阈值 |
| **重试策略** | `errorStrategy.retryPolicy` | 控制 Worker 失败后的自动重试次数与退避策略 |
| **跳过语义** | `errorStrategy.strategy = "skip"` | 跳过该 Task，直接激活下游节点；下游收到的来源输出为 null |
| **DAG 拓扑** | `edges[]` | **唯一的调度真相源**。Scheduler 按 edges 构建有向图，拓扑排序后按入度激活 |

> **`edges[]` 是调度的唯一真相源。** `globalConfig.orchestration` 中的 `type`、`conditionalBranches`、`parallelGroups` 是辅助性概述标注，供校验和人类阅读用，不作为调度逻辑的输入。

---

## 十、节点级映射规则

映射器对每个节点做以下搬运；`businessIntent` 仅参与 **skill_contracts 的确定性拼装**，不发明新的 Skill。

| Schema 字段 | → JobSpec / Runtime 落点 | 映射方式 |
|------------|-------------------------|---------|
| `taskType` | `Task.type`；`execution-envelope.task.type` | 阶段 2 确认后直接搬运 |
| `identity.label` | `Task.name` | 直接搬运 |
| `identity.description` | `Task.instruction` | 直接搬运 |
| `skillBinding.code` | `Task.skill_codes[]`；`capabilities.skills`；`skill_contracts[].skill_code` | 直接搬运 |
| `runtimeBinding.profileCode` | `Task.runtime_profile_code`；`execution-envelope.runtime.id` | 直接搬运 |
| `humanInteraction.reviewBinding.code` | `Task.review_policy_code` | 直接搬运 |
| `dataContract` + `docRef` schema | `Task.input_schema` / `Task.output_schema` | 合并生成 JSON Schema |
| `dataContract.inputs[].kind` / `sourceType` / `mediaType` | `context.json` `inputs[]` | 按字段搬运 |
| `dataContract.outputs[].kind` / `intent` / `partOf` | `task.deliverables[]` | 按字段搬运 |
| `qualityHint.skillValidations` | `skill_contracts[].expected_output.validation_rules` | 按 `skillCode` 归并 |
| `qualityHint.acceptanceCriteria` | `task.acceptance_criteria` | 直接搬运 |
| `errorStrategy.timeout` / `retryPolicy` | `policies.timeout` 等 | 按字段搬运 |
| `businessIntent` + `edges` | `execution_plan.skill_contracts`（骨架） | 与 `skillBinding` 拼装 |
| 节点 `externalRef` → `toolBinding.code` | `Task.tool_codes[]` | 解引用后搬运 |
| Tool 所属系统的 `secretBinding.code` | `Task.secret_refs[]` | 跟随 Tool 搬运 |
| `edges[]` | `JobSpec.flow[]` | 拼接 from/to + condition |

**主要仅给人看的字段**：`documents.samples`、`externalSystems.capabilities/constraints/humanFallback`、`identity.executionMode/estimatedTime`（不进入 JobSpec）。

---

## 十一、导出前验证清单

映射器启动前自动校验，任何一项不通过即中止导出：

### Binding 完整性

- [ ] 每个 `documents[]` 都有 `contextBinding.code`
- [ ] 每个有 API 的 `externalSystems[]` 都有 `toolBinding.code`
- [ ] 每个需要认证的 `externalSystems[]` 都有 `auth.secretBinding.code`
- [ ] `globalConfig.contextPolicyBinding.code` 不为空
- [ ] 每个非 `human_review` 节点都有 `skillBinding.code`
- [ ] 每个节点都有 `runtimeBinding.profileCode`
- [ ] 每个有 `humanInteraction` 的节点都有 `reviewBinding.code`

### 业务逻辑完整性

- [ ] 每个节点都有经技术方确认的 `taskType`
- [ ] 每个节点的 `businessIntent` 至少有一步
- [ ] `identity.description` 足够详细（将直接成为 Task.instruction）
- [ ] 结构化文档有 `schema` 且字段级完整
- [ ] 需要对齐 Runtime 的输入/输出已补充 `kind`/`intent` 等（详见规范验证清单）

### 数据流完整性

- [ ] 每条 `edge.dataFlow[].sourceOutput` 在当前节点的 outputs 中存在
- [ ] 每条 `edge.dataFlow[].targetInput` 在目标节点的 inputs 中存在
- [ ] 目标节点 `required: true` 的 input 至少有一条 dataFlow 指向它

### 引用完整性

- [ ] `businessIntent` 中引用的 `docRef` / `externalRef` 在全局注册表中存在
- [ ] 所有 binding code 在 task-platform 已注册（可通过 API 校验）
- [ ] 没有孤立节点（非首节点无入边、非尾节点无出边）
- [ ] 没有循环依赖
