# 注册资源类型与生产控制能力说明

> 原有资源解决“Job 能不能跑”；生产控制能力解决“Job 能不能安全、稳定、可审计地进入生产”。
>
> 注意：这里的“生产控制能力”不一定在第一阶段都要新增为顶层资源类型。更稳妥的落地方式是：优先扩展现有资源和 JobSpec 的配置字段；只有当某类策略具备独立生命周期、跨多个 Job / Tool 复用、需要单独审批发布，并且现有资源无法表达时，才抽象成顶层资源。

| 资源 / 能力 | 建议落地方式 | 含义 | 解决的问题 | 例子 |
|---|---|---|---|---|
| `Secret` | 原有资源类型 | 凭证引用，不存明文 | Tool / Trigger 调外部系统时用什么凭证 | `sap-ap-write-secret`：SAP 应付写入 API Key |
| `Tool` | 原有资源类型 | 可调用的外部动作或接口 | Agent / Worker 可以调用什么系统能力 | `sap-ap-create-voucher`：创建 SAP 应付凭证 |
| `Skill` | 原有资源类型 | Agentic Task 的业务能力说明 | Agent 应按什么业务方法完成任务 | `invoice-field-extractor`：发票字段提取能力 |
| `ContextSource` | 原有资源类型 | 上下文从哪里来 | 当前 Task 能读取哪些外部/内部信息来源 | `supplier-profile-source`：供应商资料来源 |
| `ContextPolicy` | 原有资源类型 | 上下文怎么打包给 Task | Task 运行时能看到哪些输入、上游输出和数据源 | `ap-invoice-context-default`：包含发票、PO、GR、供应商资料 |
| `RuntimeProfile` | 原有资源类型 | 执行器配置 | 这个 Task 由什么 Runtime 跑、超时多久 | `openclaw-finance-extraction`：OpenClaw 发票提取执行器 |
| `ReviewPolicy` | 原有资源类型 | 人工审核派单规则 | 人审任务由谁审、多久审、超时怎么办 | `finance-exception-review`：财务异常发票审核 |
| `TriggerDefinition` | 原有资源类型 | 外部如何触发 Job | 哪个 API / webhook / schedule 可以启动 Job | `supplier-invoice-uploaded`：供应商上传发票后触发 |
| `Validator` | 先作为 JobSpec / Task 的 `control_bindings.validators`；复用后再考虑注册表 | 校验器 / 裁判能力 | 某个阶段的结果是否合格，能不能继续 | `ap-three-way-match-validator`：校验发票、PO、GR 是否匹配 |
| `ApprovalPolicy` | 优先扩展 `ReviewPolicy` 或 Task 审批字段；复杂复用后再独立 | 动作生效前的审批策略 | 什么高风险动作必须批准后才能执行 | `finance-high-value-approval`：金额超过 10 万需主管批准 |
| `AuditPolicy` | 优先作为 JobSpec / RuntimeProfile / 平台默认审计配置 | 审计记录策略 | 要记录哪些证据、保留多久、如何脱敏 | `finance-ap-audit-standard`：记录提取结果、审批、SAP 写入回执 |
| `DataProduct` | 优先扩展 `ContextSource` / `ContextPolicy` 的质量、版本、鲜度字段 | 被消费的数据资产声明 | 数据质量、版本、鲜度、缺失处理、责任人 | `open-purchase-order-data`：SAP 采购订单数据，2 小时鲜度 SLA |
| `WritePolicy` | 优先扩展 `Tool` 能力声明 + Task `effect/write_policy` 字段 | 写系统安全策略 | 写外部系统前后如何防重复、防误写 | `sap-ap-safe-write`：要求 dry-run、幂等键、写后确认 |
| `RetryResumePolicy` | 优先扩展 `RuntimeProfile` 和 Task 级 `retry_resume_policy` 字段 | 重试与中断恢复策略 | 失败后能不能重试、从哪里恢复、最多几次 | `ap-invoice-safe-resume`：网络超时可恢复，写状态不明时转人工 |

## 是否需要新增顶层资源的判断标准

不要因为某个控制能力重要，就立刻新增注册表。建议只有同时满足以下条件时，才抽象为顶层资源：

| 判断问题 | 如果答案是“是” |
|---|---|
| 是否会被多个 Job / Task / Tool 复用？ | 倾向顶层资源 |
| 是否有独立版本、发布、灰度、废弃流程？ | 倾向顶层资源 |
| 是否需要单独审批或由专门团队维护？ | 倾向顶层资源 |
| 是否现有资源字段已经表达不清？ | 倾向顶层资源 |
| 是否只是某个 Task 的局部配置？ | 先放在 JobSpec / Task 字段 |
| 是否只是某个 Tool 的能力声明？ | 先放在 Tool 配置 |
| 是否只是某个 Context 的质量要求？ | 先放在 ContextSource / ContextPolicy |

## 推荐表达

可以对工程侧这样说明：

```text
现有注册协议不需要推翻。它已经覆盖了“能力注册”和“Job 编排”。

但为了满足企业生产环境，需要补一组生产控制能力：
Validator / ApprovalPolicy / AuditPolicy / DataProduct / WritePolicy / RetryResumePolicy。

这些能力第一阶段不一定都要新增为资源类型。优先承载在现有资源和 JobSpec 字段里，例如 Tool 的 dry-run / 幂等能力、ContextSource 的数据鲜度、RuntimeProfile 的重试恢复、Task 的 validator binding。

只有当某个策略具备独立生命周期、跨多个 Job / Tool 复用、需要单独审批发布，并且现有资源无法表达时，再抽象为顶层资源。

业务翻译平台不执行这些控制逻辑，但需要识别业务风险，并在 FlowAgent Schema / JobSpec 中补充对应配置或引用。

task-platform 在 publish 阶段校验这些配置，在 TaskRun 阶段物化 Control Pack，并由平台控制面执行校验、审批、审计、写入保护和中断恢复。
```
