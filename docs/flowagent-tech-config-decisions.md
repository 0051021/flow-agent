# FlowAgent 技术配置与注册协议边界决策记录

本文用于记录 FlowAgent 平台技术配置工作台、平台注册协议、JobSpec、Runtime Pack 之间的边界判断和产品决策。

它不是对《注册协议具体实现》的重写稿，而是后续协议、产品页面和 demo 迭代时的决策依据。后续讨论产生的新结论应继续追加到本文。

## 1. 当前核心共识

### 1.1 注册协议暂不重写顶层结构

当前注册协议的核心原则是正确的：

- 先发现和注册可复用资源。
- 再用 JobSpec 引用资源 code 来定义 Job / Task / Flow。
- JobSpec 不承载所有复杂配置，而是引用 Runtime、Context、Skill、Tool、Secret、ReviewPolicy、Trigger 等资源。

因此目前不建议新增一批顶层资源类型，也不建议把 Validator、WritePolicy、RetryResumePolicy 等直接扩成新的注册资源。

更稳妥的方向是：

- 优先使用现有资源的配置字段表达生产控制能力。
- 只有当某类策略具备独立生命周期、跨多个 Job/Tool 复用、需要单独审批发布，且现有资源无法表达时，再考虑抽象成顶层资源。

## 2. FlowAgent 技术配置页到底配置什么

FlowAgent 技术配置页不是资源注册平台本身。

它的主要职责是生成和维护 JobSpec 草稿，并帮助技术方完成资源绑定。

### 2.1 FlowAgent 应配置的内容

FlowAgent 主要配置：

- Job 元信息：`metadata.code`、`metadata.name`、`metadata.description`。
- Job 启动入口引用：`triggers`。
- Job 输入结构预览：`input_schema`。
- Task 列表：`tasks`。
- Task 流转关系：`flow`。
- Task 类型：`agentic`、`integration`、`deterministic`、`human_review`。
- Task 指令：`instruction`。
- Task 输出结构：`output_schema`。
- Task 资源绑定：`runtime_profile_code`、`context_policy_code`、`skill_codes`、`tool_codes`、`secret_refs`、`review_policy_code`。
- 缺失资源提示：缺 Tool、Secret、Skill、ContextPolicy、RuntimeProfile、ReviewPolicy、Trigger 时，提示待注册清单。

### 2.2 FlowAgent 不应承载的内容

FlowAgent 不应重复维护资源注册平台里的完整资源定义：

- 不在 FlowAgent 里完整定义 Tool 的 URL、鉴权、Secret 解析方式。
- 不在 FlowAgent 里完整定义 Trigger 的外部监听细节。
- 不在 FlowAgent 里保存 Secret 明文。
- 不直接表达 Runtime loop 内部执行细节。
- 不绕过平台注册、发布、readiness 校验。

FlowAgent 可以展示资源摘要、配置状态和缺失项，但真实资源本体仍归资源注册平台维护。

## 3. Trigger 与 Job 输入结构

### 3.1 发布态 Job 应该有启动入口

企业级场景中，发布态 Job 应至少有一个启动入口。这个启动入口可以统一抽象为 TriggerDefinition。

Trigger 不只代表外部系统自动触发，也可以代表：

- API 调用。
- Webhook。
- 定时任务。
- 平台上传文件。
- 人工表单提交。
- 上游 Job 完成事件。
- 平台内部事件。

因此，发布态 Job 没有 Trigger 通常表示“启动入口未确定”，应被标记为不可发布或待补齐。

### 3.2 输入数据结构如何生成

FlowAgent 技术配置页里的“输入数据结构”对应 JobSpec 的 `input_schema`。

推荐生成逻辑：

```text
如果已绑定 TriggerDefinition
  优先使用 TriggerDefinition.input_schema，并映射成 Job 标准 input_schema
否则
  显示 {}
  并提示：未绑定启动入口，暂无可推导输入结构，发布前必须补齐
```

早期 demo 中曾从首节点用户输入自动推导 `input_schema`，例如从“获取 PDF 文件”节点推导出 `sharepoint_file_url`。这适合作为草稿阶段的临时推导，但发布态应优先以 TriggerDefinition 的 `input_schema` 为准。

### 3.3 多个 Trigger 的语义

JobSpec 中多个 `triggers` 默认语义应为 OR：

```text
任一 Trigger 到达，即可启动 Job。
```

例如 GSDS 入库 Job 可以有多个启动入口：

- SharePoint 文件夹新增 PDF。
- 平台手动上传 PDF。
- 定时扫描漏处理文件。

这些 Trigger 的原始 payload 可以不同，但进入 Job 之前必须映射成一致的 Job 标准 `input_schema`。

示例标准输入：

```json
{
  "file_id": "string",
  "file_name": "string",
  "file_url": "string",
  "source": "sharepoint | platform_upload | scheduled_scan",
  "uploaded_at": "date-time"
}
```

### 3.4 AND 型触发条件不要直接写多个 Trigger

如果业务语义是“两个条件都满足才启动”，不要简单把两个 Trigger 同时挂到一个 Job 上。

例如：

```text
发票 PDF 已上传
并且
对应 PO 已审批通过
```

这种情况更适合三种建模方式：

1. 注册一个 Composite Trigger。
2. 一个 Trigger 启动 Job，另一个条件作为数据依赖或等待门。
3. 两个上游 Job 分别维护状态，下游汇聚 Job 在条件齐备后启动。

决策原则：

- 两个事件共同表达“启动条件”时，注册 Composite Trigger。
- 其中一个只是运行中所需数据是否准备好时，不合并 Trigger，应建模为 data dependency / gate。

## 4. IMI 与 GSDS 的 Job Group 决策

业务老师描述的是一个业务事项：IMI 证书申请流程。

技术方案可以将其拆成多个 Job，形成 Job Group。

当前 demo 中：

- `IMI 证书申请主流程` 是一个 Job。
- `GSDS PDF 自动入库 Job` 是另一个 Job。
- 两者属于同一个 Job Group。

### 4.1 GSDS Job 不是 IMI 的子过程

GSDS 入库 Job 不应该被 IMI 主流程直接触发。

更合理的关系是：

- GSDS 入库 Job 由文件到达触发，例如 SharePoint 文件夹新增 GSDS PDF。
- GSDS 入库 Job 维护共享数据资产：GSDS 主库。
- IMI 主 Job 消费 GSDS 主库。
- 如果 IMI 查询 GSDS 缺失，IMI 暂停等待，并提醒用户补充 GSDS PDF。
- 等 GSDS 入库 Job 独立完成并更新主库后，IMI 从等待点继续。

### 4.2 Job Group 页面如何展示

Job Group 层展示：

- 一个业务方案被拆成几个 Job。
- 每个 Job 的启动入口。
- Job 之间的共享数据资产关系。
- 哪个 Job 生产数据，哪个 Job 消费数据。

单个 Job 配置页不需要过度显性展示所有跨 Job 数据依赖，只需要在上层 Job Group 中说明。

## 5. Validator 的当前建模方式

当前不建议新增顶层 Validator 资源。

优先使用两种方式表达校验：

### 5.1 简单结构校验

使用 Task 的 `output_schema`。

例如 GSDS 解析结果必须包含：

- `bbn`
- `part`
- `density`
- `hazard_class`
- `composition`

### 5.2 复杂业务校验

建模为一个独立 `deterministic` Task。

示例：

```yaml
- code: validate-gsds-record
  name: 校验 GSDS 解析结果
  type: deterministic
  instruction: 校验 GSDS 解析结果字段完整性、格式、枚举和值域。
  runtime_profile_code: rules-worker-default
  input_schema: {}
  output_schema:
    type: object
    required:
      - passed
      - errors
      - requires_review
```

这种设计符合“Task 是最小验收单元”的原则。业务或技术方可以明确看到“校验 GSDS 解析结果”这一步是否通过。

## 5.3 路由节点与 flow.condition

FlowAgent 画布允许存在一种特殊节点：路由节点 / Condition Gateway。

它的产品形态可以长得像一个节点，建议使用菱形，以区别普通工作节点。

但它不是 JobSpec Task：

- 不进入 `tasks[]`。
- 不运行 Runtime。
- 不产出 TaskRun.output。
- 不作为用户验收单元。

它只用于表达 if / else 分支，导出 JobSpec 时编译为 `flow.condition`。

示例：

```text
识别目的港 Task
-> 目的港分流 路由节点
-> 台湾目的港处理 / 香港目的港处理 / 人工确认目的港
```

导出为：

```yaml
flow:
  - from: identify-destination
    to: taiwan-processing
    condition:
      path: destination_region
      equals: taiwan
  - from: identify-destination
    to: hongkong-processing
    condition:
      path: destination_region
      equals: hongkong
```

当前产品决策：

- 添加节点时区分“工作节点”和“路由节点”。
- 工作节点进入 `tasks[]`，视觉上使用圆角矩形。
- 路由节点不进入 `tasks[]`，视觉上使用菱形。
- Task 协议类型仍然保持四类：`agentic`、`integration`、`deterministic`、`human_review`。
- “Job 拆分”不是建议列表，而是技术方显式进入拆分模式：在画布上点选要拆成另一份 Job 的工作节点，填写新 Job 名称后确认生成 Job Group。
- 路由节点不参与点选拆分；拆分后需要在 JobSpec 预览中检查跨 Job 的 `flow.condition`，必要时提升为事件触发或数据依赖。

## 6. 写库安全策略的当前建模方式

当前不建议新增顶层 WritePolicy。

写库安全应优先由现有对象组合表达：

- Tool 的能力声明和配置：是否支持 dry-run、幂等键、写后查询。
- RuntimeProfile 的重试配置：可重试错误、最大次数、退避策略。
- JobSpec 的 Task 拆分：写前准备、写入、写后确认可以拆成独立 Task。
- Task output_schema：强制写回外部回执、影响行数、操作类型。
- ReviewPolicy：高风险或不确定场景进入人工审核。

### 6.1 GSDS 写库建议

GSDS 入库写库节点应至少具备：

- 幂等键：`bbn + part + file_hash` 或 `bbn + part + source_file_id`。
- 写前查重：确认当前记录是否存在。
- 差异预览：已有记录和新解析记录的字段差异。
- 写入模式：`insert` 或 `update`。
- 写后确认：read-back 校验数据库最终值。
- 失败处理：写状态不明时转人工，不盲目重试。

建议输出结构：

```json
{
  "operation": "insert | update | skipped | failed",
  "affected_rows": 1,
  "bbn": "string",
  "part": "string",
  "external_receipt_id": "string",
  "read_back_verified": true
}
```

## 7. Runtime Pack 与长等待

Runtime Pack 的粒度是一次 RuntimeRun，不是整个 Job。

因此，运行中如果遇到需要等待几小时、几天甚至一周的情况，不应该让 RuntimeRun 一直挂着。

正确方式是：

- 当前 RuntimeRun 结束。
- 平台 TaskRun / JobInstance 进入 `blocked`、`waiting_human` 或 `waiting_dependency` 状态。
- 平台根据数据依赖、人工补充或事件到达恢复 Job。
- 恢复时创建新的 RuntimeRun，从对应 Task 或等待点继续。

以 IMI 查询 GSDS 缺失为例：

```text
IMI Job 查询 GSDS 主库
-> 记录缺失
-> IMI Job 暂停等待
-> 提醒用户上传 GSDS PDF
-> GSDS 入库 Job 被文件上传触发
-> GSDS 主库补齐
-> IMI Job 从等待点恢复
```

这不是 Runtime Pack 的职责，而是平台调度和 Job 状态机的职责。

## 8. GSDS Job 当前推荐 Task 拆分

GSDS PDF 自动入库 Job 可以拆成：

```yaml
tasks:
  - code: fetch-gsds-pdf
    name: 获取 GSDS PDF
    type: integration
    tool_codes:
      - sharepoint-file-download

  - code: parse-gsds-pdf
    name: 解析 GSDS PDF
    type: agentic
    skill_codes:
      - gsds-pdf-parser

  - code: validate-gsds-record
    name: 校验 GSDS 解析结果
    type: deterministic
    runtime_profile_code: rules-worker-default

  - code: approve-gsds-ingest
    name: 人工确认入库
    type: human_review
    review_policy_code: gsds-data-steward-review

  - code: upsert-gsds-master
    name: 写入 GSDS 主库
    type: integration
    tool_codes:
      - gsds-db-upsert
```

说明：

- 当前 demo 固定保留 `approve-gsds-ingest`，目的是让技术工作区覆盖 `human_review` Task 的配置形态。
- `approve-gsds-ingest` 只绑定 `review_policy_code`，不绑定 Runtime、ContextPolicy、Skill、Tool 或 Secret。
- 真实生产中，如果某些低风险文件可以免人审，应通过 Flow 条件或 ReviewPolicy 规则控制，而不是把人工确认写成普通 Task 的字段。
- `upsert-gsds-master` 必须有幂等、写后确认和异常兜底。

## 9. FlowAgent 当前 demo 需要继续改进的点

当前 demo 已表达：

- Job Group。
- IMI 主 Job 与 GSDS 入库 Job 分开配置。
- GSDS Job 独立事件触发。
- 技术配置页可以切换不同 Job。
- Task 只绑定 `context_policy_code`，并展示只读 ContextPolicy 摘要。
- Job `input_schema` 从 TriggerDefinition.input_schema 做只读预览。
- “外部系统”“自适应配置”“资源策略摘要”都不再作为技术工作区主 tab。

仍需继续补齐：

- Trigger 摘要应来自资源注册平台，而不是仅展示 code。
- 多 Trigger 时，展示每个 Trigger 到 Job 标准输入的映射兼容性。
- 节点绑定应补齐到 100%，尤其是获取 PDF、校验、写库节点。
- 写库节点应展示幂等键、写后确认、失败处理摘要。
- Validator 应体现为 output_schema 或 deterministic Task，而不是新增顶层资源。

### 9.1 ContextPolicy 在 FlowAgent 中的配置边界

重新阅读注册协议后，当前结论是：

FlowAgent 技术配置不负责编辑 ContextSource / ContextPolicy 资源本体。

原因是资源注册协议已经明确：

- ContextSource 是“上下文从哪里来”，属于资源注册层。
- ContextPolicy 是“上下文怎么打包给 Task”，也属于资源注册层。
- JobSpec Task 上只引用 `context_policy_code`。

所以 FlowAgent 在 Task 面板里的正确动作是：

- 选择当前 Task 使用哪个 `context_policy_code`。
- 展示该 ContextPolicy 的只读摘要，帮助技术同学判断是否选对。
- 如果没有合适的 ContextPolicy，只生成“缺失资源待注册”的提示或草稿，不直接把 ContextPolicy 规则写进 JobSpec。

映射关系应保持为：

```text
资源注册平台
  ContextSource / ContextPolicy
        ↓
FlowAgent 技术配置
  JobSpec.tasks[].context_policy_code
        ↓
平台运行时
  ContextEngine 按 ContextPolicy 生成 Runtime Pack context.package
```

这也意味着 UI 上不应该让用户误解为“Task 直接绑定多个文档”。文档、数据源、上游输出、必填字段、脱敏、大小限制等，都是 ContextPolicy 的内容，不是 JobSpec Task 的直接字段。

当前 demo 已调整为：

- 全局配置不再放“文档资源”主 tab。
- 单个 Task 中只选择 `context_policy_code`。
- 选择后展示只读 ContextPolicy 摘要：是否包含 Job 输入、是否包含上游输出、包含哪些 ContextSource、必填字段、脱敏规则和最大上下文包大小。
- 摘要来自 mock 的资源注册清单，表达“这里是选择资源 code，不是编辑资源定义”。

### 9.2 Job input_schema 的来源

JobSpec 顶层 `input_schema` 不应该再从首节点用户输入临时猜测。

更准确的来源是已注册 TriggerDefinition 的 `input_schema`：

```text
TriggerDefinition.input_schema
-> FlowAgent 全局配置只读预览
-> JobSpec.input_schema
-> Trigger Gateway / Job 启动时校验入参
```

当前 demo 已调整为：

- 选择触发器后，从 mock 资源注册清单读取该 Trigger 的 `inputSchema`。
- 没有选择触发器时，预览显示 `{}`，并提示发布前必须绑定已注册 Trigger。
- 多个触发器时，默认语义是“任一触发器都可启动 Job”；它们的输入结构应一致。
- 如果多个 Trigger 的 `input_schema` 不一致，UI 提示需要合并为统一 Trigger，或补充 Trigger 到标准 Job 输入的映射后再发布。

### 9.3 外部系统与自适应配置的收口

FlowAgent 技术配置不应该提供“外部系统配置”和“自适应配置”的编辑入口。

原因是这些内容实际属于资源注册层：

- 外部 API 地址、鉴权、Secret、写库幂等、dry-run、写后确认，属于 Tool / Secret。
- 超时、重试、最大步数、最大工具调用、运行护栏，属于 RuntimeProfile。
- 上下文裁剪、资料来源、脱敏和大小限制，属于 ContextPolicy。
- 人审条件、审核组、SLA，属于 ReviewPolicy。

FlowAgent 应该做的是：

- 在 Task 上选择 `runtime_profile_code`、`context_policy_code`、`tool_codes`、`secret_refs`、`review_policy_code`。
- 汇总这些资源引用，展示发布前治理摘要。
- 如果缺资源，提示去资源注册平台补齐，或生成资源注册草稿。

当前 demo 曾短暂调整为只读“资源策略摘要”，但进一步讨论后认为该摘要页也没有必要，因为它只是解释资源注册平台的职责，并不承载配置动作。

最终 demo 已调整为：

- 移除“外部系统”可编辑 tab。
- 移除“自适应配置”可编辑 tab。
- 不再保留“资源策略摘要”tab。
- 技术工作区只保留 Job 全局配置；Task 级资源绑定通过点击画布节点进入单节点面板配置。
- 资源注册平台职责不在 FlowAgent 工作区里做独立页面解释，只在具体字段旁以只读摘要或缺失提示体现。

### 9.4 GSDS demo 的 Task 级技术配置口径

GSDS PDF 自动入库 Job 的 demo 已按当前协议口径补齐为 5 个 Task：

```text
获取 PDF 文件
-> 解析 GSDS PDF
-> 校验解析结果
-> 人工确认入库
-> 写入主数据库
```

每个 Task 只填写 JobSpec Task 会承载或引用的字段：

- `task.code`
- `task.type`
- `instruction`
- `input_schema`
- `output_schema`
- `runtime_profile_code`
- `context_policy_code`
- `skill_codes`
- `tool_codes`
- `secret_refs`
- `review_policy_code`

字段是否出现在 FlowAgent 技术配置中的判断：

- `Skill` 只对 `agentic` Task 展示并要求绑定；`integration` 和 `deterministic` Task 不强制也不默认展示 Skill。
- `ContextPolicy` 对非人工 Task 必填，但只选择 `context_policy_code`，不编辑 ContextSource / ContextPolicy 规则。
- `Tool` 和 `SecretRef` 只表示当前 Task 允许调用哪些已注册能力，不编辑 API 地址、鉴权、Secret 明文或写库策略。
- `RuntimeProfile` 只选择执行器 code，不编辑 retry、timeout、最大步数等资源配置。
- `ReviewPolicy` 只对 `human_review` Task 展示并要求绑定；普通 Task 如果需要人工确认，应在 Flow 中拆出一个独立的人审 Task，而不是给当前 Task 加“人工放行”字段。
- 解析结果校验作为 `deterministic` Task 存在，不新增 Validator 资源；它的输出 `passed / validated_record / validation_errors` 用于写库前门禁和审计。

当前 mock 绑定：

```yaml
fetch-pdf:
  type: integration
  runtime_profile_code: integration-default
  context_policy_code: gsds-pdf-fetch-context
  tool_codes: [sharepoint-file-download]
  secret_refs: [sharepoint-api-credential]

parse-pdf:
  type: agentic
  runtime_profile_code: agentic-default
  context_policy_code: gsds-pdf-parse-context
  skill_codes: [skill-gsds-pdf-parser]

validate-gsds-record:
  type: deterministic
  runtime_profile_code: script-fast
  context_policy_code: gsds-parse-validation-context

approve-gsds-ingest:
  type: human_review
  review_policy_code: gsds-data-steward-review

upsert-gsds-master:
  type: integration
  runtime_profile_code: integration-default
  context_policy_code: gsds-db-write-context
  tool_codes: [gsds-db-upsert]
  secret_refs: [gsds-db-credential]
```

## 10. 后续追加区

后续关于 FlowAgent 技术配置、JobSpec、Runtime Pack、注册协议边界的讨论结论，继续追加到本节。

### 10.1 全局配置中的时区字段

FlowAgent 技术配置页中的“时区”不应默认理解为 JobSpec 的核心字段。

当前注册协议的 JobSpec 顶层字段中没有 `timezone`，因此不要为了这个 UI 字段新增顶层协议字段。

时区的实际作用应分场景处理：

- 对 schedule Trigger 有意义：应归属于 TriggerDefinition 的调度配置，例如每天 09:00 按哪个时区触发。
- 对人工审核 SLA 有意义：应归属于 ReviewPolicy 或平台工单系统，用于计算截止时间和展示本地时间。
- 对审计和运行事件有展示意义：平台底层应统一存 UTC，控制台按用户或租户时区展示。
- 对普通事件触发 Job 意义较弱：例如 GSDS 文件上传触发，事件时间应来自 trigger payload，平台统一归一化为 UTC。

因此 FlowAgent 中的“时区”更适合定位为“控制台展示 / 调度默认时区摘要”，而不是 JobSpec 必填字段。

如果当前 Job 绑定的是 schedule Trigger，FlowAgent 可以展示该 Trigger 的 timezone 摘要。

如果当前 Job 不是 schedule Trigger，时区字段可以弱化、隐藏，或仅作为展示默认值，不参与 JobSpec 导出。

当前 demo 已决定从技术工作区的“全局配置”中移除独立时区输入，避免误导为 JobSpec 字段。后续如果需要展示时区，应在 schedule Trigger 摘要、ReviewPolicy SLA 摘要或控制台展示设置中体现。

### 10.2 技术配置字段必须使用 JobSpec 协议值

FlowAgent 技术配置界面不能把内部执行实现值展示成协议字段值。

已确认的修正：

- `Task.type` 只允许展示和保存协议枚举：`agentic`、`integration`、`deterministic`、`human_review`。
- `human-bridge` 这类内部执行桥接值不能出现在 JobSpec Task 配置中。
- 人审节点应展示 `type: human_review` 和 `review_policy_code`。
- 非人审节点才展示 `runtime_profile_code`、`context_policy_code`、`tool_codes`、`secret_refs`。
- 只有 `agentic` 节点展示 `skill_codes`。
- GSDS demo seed 不再加载全局文档资源、外部系统配置或自适应配置；这些属于资源注册平台或后续治理配置，不属于当前 JobSpec 技术配置页。

因此当前技术配置页的责任是：把业务流程节点翻译为 JobSpec Task/Flow，并选择已注册资源 code；不编辑资源定义，也不展示与 JobSpec 字段命名冲突的旧 schema 字段。

### 10.3 FlowAgent 技术配置字段到 JobSpec 的映射

FlowAgent 技术配置页本质上是 JobSpec 草稿编辑器。界面中允许技术方填写或确认的字段，必须能明确映射到当前注册协议里的 JobSpec 字段。

#### Job 全局配置映射

| FlowAgent 字段 | JobSpec 字段 | 说明 |
|---|---|---|
| Job 名称 | `metadata.name` | 控制台展示名称。 |
| Job 唯一编码 | `metadata.code` | JobTemplate code，发布时全局唯一校验。 |
| 业务说明 | `metadata.description` | Job 级说明。 |
| 触发器选择 | `triggers[]` | 只保存已注册 TriggerDefinition 的 code。触发器鉴权、幂等、限流不在 FlowAgent 编辑。 |
| 输入数据结构只读预览 | `input_schema` | 从所选 TriggerDefinition.input_schema 预览/派生；FlowAgent 不编辑 TriggerDefinition 本体。 |
| 画布节点连线 | `flow[]` | 从 React Flow 的边导出为 `from / to / condition / sort_order`。 |

#### Task 配置映射

| FlowAgent 字段 | JobSpec Task 字段 | 是否资源引用 | 说明 |
|---|---|---:|---|
| 节点标题 | `tasks[].name` | 否 | Task 展示名称，来自业务流程节点，可在技术侧适度修正。 |
| Task 编码 | `tasks[].code` | 否 | Job 内唯一 code，用于 flow edge 的 `from / to`。 |
| Task 类型 | `tasks[].type` | 否 | 只能是 `agentic / integration / deterministic / human_review`。 |
| 本步说明 | `tasks[].instruction` | 否 | 当前 Task 给执行器的任务说明；精细 Agent 方法写在 Skill 中。 |
| 输入字段 | `tasks[].input_schema` | 否 | 当前 Task 的输入验收契约。 |
| 输出字段 | `tasks[].output_schema` | 否 | 当前 Task 的输出验收契约，运行后用于严格校验。 |
| 执行器配置 | `tasks[].runtime_profile_code` | 是 | 非 `human_review` Task 必填；只选择已注册 RuntimeProfile code。 |
| 上下文策略 | `tasks[].context_policy_code` | 是 | 非 `human_review` Task 必填；只选择已注册 ContextPolicy code。 |
| Skill 绑定 | `tasks[].skill_codes[]` | 是 | 仅 `agentic` Task 展示；选择已注册 Skill code。 |
| Tool 绑定 | `tasks[].tool_codes[]` | 是 | 非人工 Task 可选；选择已注册 Tool code。 |
| 凭证引用 | `tasks[].secret_refs[]` | 是 | 选择已注册 Secret code；选中 Tool 时可自动补齐 Tool 依赖的 Secret。 |
| 人工审核策略 | `tasks[].review_policy_code` | 是 | 仅 `human_review` Task 展示并要求绑定。 |

#### 不在 FlowAgent 技术配置中编辑的内容

以下内容虽然会影响运行，但不属于 JobSpec 技术配置页的编辑职责：

- Tool 的 API 地址、method、auth、dry-run、写后确认。
- Secret 的 provider、env_key、external_ref、scope、状态。
- RuntimeProfile 的 provider_type、timeout、重试、最大步数、handler。
- ContextSource 的来源类型、URL、对象存储路径、敏感级别。
- ContextPolicy 的 include_sources、required_fields、脱敏、max_payload_kb。
- ReviewPolicy 的审核组、SLA、触发条件、超时处理。
- TriggerDefinition 的鉴权、幂等、限流、真实入口配置。

这些都属于资源注册平台或发布 readiness 校验，不应在 FlowAgent 中重复编辑。

#### `input_schema` 和 `context_policy_code` 的区别

`input_schema` 是 Task 的输入契约。它回答的是：

> 当前 Task 理论上需要哪些输入字段，字段类型是什么，哪些字段是必填。

例如 GSDS 解析 Task 的输入契约可以是：

```yaml
input_schema:
  type: object
  required:
    - pdf_file_path
  properties:
    pdf_file_path:
      type: string
```

`context_policy_code` 是运行时上下文打包策略。它回答的是：

> 平台在启动当前 Task 前，实际要把哪些 Job 输入、上游输出、ContextSource、规则资料打包成 ContextPackage，并且如何脱敏、限流和校验必填上下文字段。

例如同一个 GSDS 解析 Task 选择：

```yaml
context_policy_code: gsds-pdf-parse-context
```

背后的 ContextPolicy 可能包含：

```yaml
include_job_input: true
include_upstream_outputs: true
include_sources:
  - cs-gsds-field-map
required_fields:
  - upstream.fetch-pdf.pdf_file_path
redaction:
  patterns:
    - token
    - authorization
max_payload_kb: 1024
```

所以两者不是重复字段：

| 字段 | 作用 | 类比 |
|---|---|---|
| `input_schema` | 定义这个 Task 需要什么输入结构才算合法 | 验收单 |
| `context_policy_code` | 定义运行时怎么把输入、上游输出、资料和规则打包给执行器 | 打包规则 |
| `output_schema` | 定义这个 Task 产出什么结构才算完成 | 交付物标准 |

因此 FlowAgent 中可以编辑 `input_schema / output_schema`，因为它们属于 Task 的验收契约；但 ContextPolicy 细节只在资源注册平台维护，FlowAgent 只选择 `context_policy_code`。
