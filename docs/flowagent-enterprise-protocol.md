# FlowAgent 企业级业务翻译与执行协议

> 本文档是一份完整协议说明，用于解释 FlowAgent 如何把企业已有业务方案翻译成可执行、可审计、可复盘的自动化 Job。
>
> 目标不是让 AI 重写企业流程，而是把企业已经验证过的 80 分流程，稳定地自动化成 80 分，并让执行过程更可控、更透明、更容易复盘。

---

## 目录

1. 协议总览
2. 核心概念
3. 四类产物
4. 字段应该由谁填写
5. FlowAgent Schema 完整结构
6. 资源平台协议
7. JobSpec Release 协议
8. Runtime Pack 与 Control Pack
9. 执行分层
10. Validator、审批与审计规则如何分发
11. 运行时上下文调整
12. Agent Planning：Agent 意图识别与执行规划
13. on_fail：校验失败后的处理策略
14. 状态机
15. Hard Gates：生产硬约束
16. 中断恢复与重试
17. 审计、证据链与失败归因
18. 示例一：Workflow 类型 Job
19. 示例二：Agentic 类型 Job
20. 发布前检查清单
21. 总结

---

## 1. 协议总览

FlowAgent 的完整链路不是“一份 JSON 直接给 Agent 跑”，而是一个从设计态到执行态的编译过程：

```text
企业自然语言业务方案
  ↓
FlowAgent Schema
  ↓
技术方 binding 与生产策略确认
  ↓
JobSpec Release
  ↓
task-platform 发布
  ↓
Runtime Pack + Control Pack
  ↓
Worker / Agent 执行
  ↓
Execution Result
  ↓
审计、复盘、持续改进
```

这条链路有一个核心原则：

> 业务方案、人类确认、执行配置、平台控制、运行结果，必须分层。不要让一份 JSON 同时承担所有责任。

---

## 2. 核心概念

### 2.1 业务方案

企业原本就在使用的业务流程、SOP、规则和人工经验。

例如：

- 财务发票三单匹配。
- GSDS PDF 入库。
- 员工离职权限回收。
- 合同风险审查。
- 客户投诉处理。

FlowAgent 的职责不是改写业务方案，而是把它结构化。

### 2.2 FlowAgent Schema

业务翻译后的中间表示，也可以叫 **FlowAgent IR**。

它记录：

- 这个业务流程有哪些节点。
- 每个节点做什么。
- 输入输出是什么。
- 哪些地方需要人。
- 技术方最终绑定了哪些 Skill / Tool / Runtime。
- 当前业务场景下有哪些风险、证据、重试、写入保护要求。

FlowAgent Schema 是设计态，不直接等于 Runtime 执行配置。

### 2.3 Job

一个可独立触发、独立运行、独立审计的业务自动化流程。

例如：

```text
Job: 发票三单匹配与 ERP 入账
触发: 收到供应商发票
结果: ERP 应付模块创建入账记录
```

### 2.4 Task / Node

Job 中的一个可执行步骤。

例如发票 Job 中：

```text
接收发票
提取字段
查询 PO / GR
执行匹配规则
人工审核异常
ERP 入账
```

### 2.5 Skill

可复用能力单元。

Skill 不等于某个业务节点。Skill 是技术能力：

- 解析发票字段。
- 对比合同条款。
- 查询法规知识。
- 生成回复草稿。

一个 Task 可以绑定一个或多个 Skill。

### 2.6 Tool

具体系统能力或接口。

例如：

- 查询 ERP。
- 下载 SharePoint 文件。
- 调用 OCR。
- 发送邮件。
- 写数据库。

### 2.7 RuntimeProfile

执行器配置，描述这个 Task 由什么 Worker 执行，以及默认超时、重试、资源限制。

例如：

- `agentic-stable`
- `integration-safe-write`
- `script-fast`
- `human-gateway`

### 2.8 ReviewPolicy

人工审核策略。

包括：

- 谁审核。
- 多久超时。
- 超时后升级还是失败。
- 哪些字段可编辑。
- 是否必须填写修改原因。

### 2.9 Runtime Pack

每个 Task 执行时，分发给 Worker / Agent 的最小上下文。

它包含 Worker 执行任务需要知道的东西，不应该包含平台裁判规则的全部内容。

### 2.10 Control Pack

平台控制面使用的规则包。

包括：

- validators。
- 审批规则。
- 写入安全规则。
- 审计规则。
- 失败归因规则。
- Secret 解析策略。

Agent 不一定能看到 Control Pack。

---

## 3. 四类产物

### 3.1 总览

| 产物 | 所处阶段 | 主要作用 | 消费者 |
|---|---|---|---|
| FlowAgent Schema | 设计态 | 记录业务方案和技术确认结果 | 业务方、技术方、编译器 |
| JobSpec Release | 发布态 | 冻结可执行 Job 定义 | task-platform / Scheduler |
| Runtime Pack | 执行态 | 给 Worker / Agent 执行任务 | Runtime / Worker / Agent |
| Control Pack | 控制态 | 给平台执行校验、审批、审计 | 平台控制面 |
| Execution Result | 复盘态 | 记录结果、证据、审计引用、失败归因 | 业务方、技术方、复盘系统 |

### 3.2 关键边界

FlowAgent Schema：

```text
记录“我们设计并确认了什么”。
```

JobSpec Release：

```text
记录“这次正式发布要怎么跑”。
```

Runtime Pack：

```text
记录“这个 Worker 此刻完成这个 Task 需要什么”。
```

Control Pack：

```text
记录“平台如何判定它是否合格、安全、可提交”。
```

Execution Result：

```text
记录“最后发生了什么，为什么成功或失败”。
```

---

## 4. 字段应该由谁填写

### 4.1 总表

| 内容 | 最适合放在哪里 | 谁维护 |
|---|---|---|
| Skill 输入输出 schema | 资源平台 | 技术方 |
| Skill 能否提供 evidence | 资源平台 | 技术方 |
| Skill 已知限制 | 资源平台 | 技术方 |
| Tool 参数 schema | 资源平台 | 技术方 |
| Tool 是否写系统 | 资源平台 | 技术方 |
| Tool 是否支持 dry-run / 幂等 / 快照 | 资源平台 | 技术方 |
| Runtime 默认 timeout / retry | 资源平台 | 技术方 |
| ReviewPolicy 审批角色和默认超时 | 资源平台 | 技术方 / 管理员 |
| 业务流程节点 | FlowAgent Schema | AI + 业务方 |
| 当前节点业务意图 | FlowAgent Schema | AI + 业务方 |
| 当前节点输入输出 | FlowAgent Schema | AI + 业务方 + 技术方 |
| 当前节点绑定哪个 Skill / Tool | FlowAgent Schema | 技术方 |
| 当前业务下幂等键怎么组成 | FlowAgent Schema | 技术方 |
| 当前业务下哪些字段必须有证据 | FlowAgent Schema | 业务方 + 技术方 |
| 当前业务下什么情况必须人工审核 | FlowAgent Schema | 业务方 + 技术方 |
| Validator 绑定、执行阶段、失败策略 | JobSpec / Task `control_bindings.validators` | 技术方 |
| 复杂且可复用的 Validator 实现 | 资源平台，后续资源化 | 技术方 / 管理员 |
| 审批触发条件 | ReviewPolicy 或 Task 审批字段 | 业务方 + 技术方 |
| 审计记录范围 | JobSpec / RuntimeProfile / 平台默认配置 | 技术方 / 管理员 |
| 数据质量、版本、鲜度要求 | ContextSource / ContextPolicy | 数据负责人 + 技术方 |
| 写系统保护策略 | Tool 能力声明 + Task `effect/write_policy` | 技术方 |
| 中断恢复与重试策略 | RuntimeProfile + Task `retry_resume_policy` | 技术方 |
| 运行时哪些字段允许被用户或 AI 调整 | JobSpec Release | 技术方 / 业务方 |
| 运行时调整请求和审批记录 | Runtime Context / Audit | 平台 |
| 编译后的可执行配置 | JobSpec Release | 编译器 |
| validators / 审批 / 审计规则分发 | Control Pack | task-platform |

### 4.2 原则

资源平台回答：

> 这个能力本身能做什么、怎么安全地做、有什么限制。

FlowAgent 回答：

> 当前业务流程里，如何使用这个能力、允许做到什么程度、什么情况必须拦住。

JobSpec Release 回答：

> 这次生产发布具体锁定了哪些版本和策略。

Runtime / Control Pack 回答：

> 这次 Task Run 给谁看什么、执行时如何控制。

### 4.3 生产控制字段的归属原则

不要因为某个控制能力重要，就立刻新增一个顶层资源类型。第一阶段更推荐“扩展现有资源字段 + JobSpec / Task 引用”，等复用和治理需求真实出现后再资源化。

| 控制能力 | 第一阶段放在哪里 | 什么时候再抽成顶层资源 |
|---|---|---|
| Validator | Task 的 `control_bindings.validators` | 多个 Job 复用同一校验器，且需要独立版本、发布、审批 |
| ApprovalPolicy | 先扩展 `ReviewPolicy` 或 Task 审批字段 | 审批规则跨多个 Job / 高风险动作复用，且由专门团队维护 |
| AuditPolicy | JobSpec、RuntimeProfile 或平台默认审计配置 | 不同业务线有独立审计标准、留存周期、发布流程 |
| DataProduct | ContextSource / ContextPolicy 的质量、版本、鲜度字段 | 数据资产由数据团队独立维护，并被多个 Job 消费 |
| WritePolicy | Tool 的能力声明 + Task `effect/write_policy` 字段 | 同一写入策略跨多个 Tool / Job 复用，且需要单独审批 |
| RetryResumePolicy | RuntimeProfile 默认策略 + Task `retry_resume_policy` 覆盖 | 多个 Runtime / Job 共用同一恢复策略，且需要灰度和版本管理 |

判断口诀：

```text
局部配置，放 Task。
能力属性，放 Tool / Skill / Runtime / Context。
业务审核，优先放 ReviewPolicy。
跨 Job 复用、有独立生命周期、需要单独发布，才抽成资源。
```

---

## 5. FlowAgent Schema 完整结构

### 5.1 顶层结构

```yaml
schema_version: flowagent.ir.v3

meta: {}
business_context: {}

documents: []
external_systems: []
external_data_dependencies: []

global_config: {}

nodes: []
edges: []

project_policies:
  privacy_policy: {}
  audit_policy: {}
  failure_classification: {}

technical_bindings:
  resource_lock: {}
```

### 5.2 meta

```yaml
meta:
  id: ap-three-way-match
  name: 应付发票三单匹配与 ERP 入账
  version: 1.0.0
  job_type: workflow
  owner:
    business: finance-ap-team
    tech: automation-platform-team
  business_context: "收到供应商发票后，自动完成 PO / GR / Invoice 三单匹配，并在合规后写入 ERP 应付模块"
```

### 5.3 documents

记录业务流程中用到的文件和文档。

```yaml
documents:
  - id: invoice-pdf
    name: 供应商发票 PDF
    role: external_input
    file_type: pdf
    schema:
      type: unstructured
      extraction_hints:
        - field: invoice_number
          required: true
        - field: total_amount
          required: true
    context_binding:
      code: invoice-pdf-context
      version: 1.0.0
```

### 5.4 external_systems

记录外部系统以及技术方绑定的 Tool / Secret。

```yaml
external_systems:
  - id: erp-ap
    name: ERP 应付模块
    type: erp
    integration:
      current: api
      readiness: ready
    tool_binding:
      code: erp-ap-posting
      version: 3.0.0
    secret_binding:
      code: erp-ap-secret
```

### 5.5 external_data_dependencies

当当前 Job 依赖外部长期数据资产时声明。

注意：这里不是把另一个 Job 的规则塞进当前 Schema，而是声明当前 Job 对某个数据资产的使用要求。

```yaml
external_data_dependencies:
  - code: supplier-master-data
    purpose: "发票入账前校验供应商身份、税号和银行账户"
    required_schema_version: ">=2.0 <3.0"
```

### 5.6 nodes

每个节点是一份 Task 设计。

```yaml
nodes:
  - id: extract-invoice-fields
    identity: {}
    task_type: agentic
    agent_task_mode: extract_with_evidence
    agent_execution: {}
    data_contract: {}
    business_intent: []
    technical_binding: {}
    effect: {}
    risk: {}
    evidence_policy: {}
    control_bindings: {}
    write_policy: {}          # 仅 write_system / external_commit 必填
    retry_resume_policy: {}
    human_gate: {}
    agentic_controls: {}
    data_dependency: {}
    quality_hint: {}
    edges: []
```

`job_type` 描述整个 Job 的形态；`task_type` 描述节点由哪类执行器处理；`agent_task_mode` 只对 `agentic` Task 生效，并会被编译进 Runtime Pack。

推荐枚举：

```yaml
job_type:
  - workflow
  - agentic
  - hybrid

task_type:
  - deterministic
  - integration
  - agentic
  - human_review
  - manual_action

agent_task_mode:
  - extract_with_evidence
  - review_and_recommend
  - reason_and_plan
  - draft_only
  - execute_fixed_instruction
```

### 5.7 identity

```yaml
identity:
  label: 提取发票字段
  description: "从供应商发票 PDF 中提取发票号、供应商、税额、总金额、行项目等字段"
  step_index: 2
  execution_mode: ai_auto
```

### 5.8 data_contract

```yaml
data_contract:
  inputs:
    - id: invoice_file_path
      name: invoice_file_path
      source: previous_step
      required: true
      kind: document
      media_type: application/pdf
  outputs:
    - id: invoice_record
      name: invoice_record
      kind: structured
      schema:
        type: object
        required:
          - invoice_number
          - supplier_id
          - total_amount
        properties:
          invoice_number:
            type: string
          supplier_id:
            type: string
          total_amount:
            type: number
```

### 5.9 business_intent

业务意图只描述做什么，不描述 Skill 内部怎么实现。

```yaml
business_intent:
  - type: parse
    description: "识别发票基础信息和行项目"
    key_fields:
      - invoice_number
      - total_amount
      - tax_amount
```

### 5.10 technical_binding

技术方选择已注册资源。

```yaml
technical_binding:
  skill_codes:
    - code: invoice-field-extractor
      version: 1.4.2
  tool_codes:
    - code: pdf-reader
      version: 2.0.0
  runtime_profile:
    code: agentic-extraction-stable
    version: 1.0.3
```

### 5.11 effect

声明 Task 是否有副作用。

```yaml
effect:
  type: generate_artifact
```

可选值：

```text
read_only
generate_artifact
notify
write_system
external_commit
```

### 5.12 risk

```yaml
risk:
  level: medium
  reason: "提取结果会影响后续财务入账"
  required_controls:
    - evidence_required
    - human_review_on_low_confidence
```

### 5.13 evidence_policy

```yaml
evidence_policy:
  required: true
  required_for_fields:
    - invoice_number
    - supplier_id
    - total_amount
  accepted_sources:
    - pdf_text_span
    - pdf_bounding_box
    - human_review
  require_human_review_when:
    - confidence_below: 0.9
    - evidence_missing: true
```

### 5.14 write_policy

只有写系统或外部提交时必须填写。

```yaml
write_policy:
  operation: create
  idempotency_key: supplier_id + invoice_number + invoice_date + total_amount
  dry_run_required: true
  max_affected_rows: 1
  require_before_after_snapshot: true
  conflict_detection:
    fields:
      - invoice_number
      - supplier_id
      - total_amount
    on_conflict: abort
  commit_confirmation:
    method: query_by_idempotency_key
    timeout_seconds: 30
    on_unknown: human_review
  rollback:
    supported: true
    strategy: create_reversal_entry
  retry_semantics: retry_safe_with_idempotency_key
```

### 5.15 retry_resume_policy

```yaml
retry_resume_policy:
  max_attempts: 3
  retry_on:
    - runtime_crash
    - network_timeout
    - rate_limited
    - transient_external_error
  do_not_retry_on:
    - validation_failed
    - business_rule_failed
    - permission_denied
    - human_rejected
    - evidence_missing
  backoff:
    type: exponential
    initial_delay_seconds: 10
    max_delay_seconds: 300
  checkpoint_policy:
    enabled: true
    checkpoint_after:
      - input_validated
      - dry_run_passed
      - external_commit_requested
      - external_commit_confirmed
    resume_from_checkpoint: true
```

### 5.16 human_gate

```yaml
human_gate:
  required: true
  trigger:
    - risk_level_at_or_above: high
    - confidence_below: 0.85
    - evidence_missing: true
  review_policy_code: finance-exception-review
  editable_fields:
    - total_amount
    - tax_amount
    - approval_decision
  timeout:
    seconds: 86400
    on_timeout: escalate
  audit:
    require_reason_for_change: true
    record_old_new_value: true
```

### 5.17 agentic_controls

只有 agentic Task 必须填写。

```yaml
agentic_controls:
  max_steps: 8
  max_tool_calls: 20
  max_tokens: 30000
  allowed_tools:
    - pdf-reader
    - ocr-reader
  forbidden_actions:
    - write_database
    - send_external_email
  ask_human_when:
    - confidence_below: 0.75
    - policy_missing: true
```

### 5.18 data_dependency

当一个 Task 消费共享数据资产时填写。

```yaml
data_dependency:
  data_product_code: supplier-master-data
  lookup_key:
    - supplier_id
  required_quality:
    review_status: approved
    max_age_days: 365
    required_fields:
      - tax_id
      - bank_account_status
  on_missing: human_fallback
  on_stale: human_confirm
  on_schema_incompatible: abort
```

---

## 6. 资源平台协议

### 6.1 Skill 注册

```yaml
skill:
  code: invoice-field-extractor
  version: 1.4.2
  digest: sha256:skill-invoice-extractor-142
  summary: "从发票 PDF 或图片中提取结构化字段"
  input_schema: {}
  output_schema: {}
  provides_evidence:
    - pdf_text_span
    - pdf_bounding_box
  required_tools:
    - pdf-reader
    - ocr-reader
  known_limitations:
    - low_resolution_scanned_pdf
    - handwritten_invoice
```

### 6.2 Tool 注册

```yaml
tool:
  code: erp-ap-posting
  version: 3.0.0
  type: external_api
  effect_type: write_system
  target_system: erp-ap-module
  parameters_schema: {}
  supports_dry_run: true
  supports_idempotency_key: true
  supports_snapshot: true
  supports_commit_confirmation: true
  supported_operations:
    - create
```

### 6.3 RuntimeProfile 注册

```yaml
runtime_profile:
  code: integration-safe-write
  version: 1.3.0
  worker_type: http
  timeout_seconds: 60
  max_retry: 3
  checkpoint_supported: true
  default_retry_policy:
    retry_on:
      - network_timeout
      - rate_limited
```

### 6.4 ReviewPolicy 注册

```yaml
review_policy:
  code: finance-exception-review
  version: 1.2.0
  approver_roles:
    - finance_manager
  timeout_seconds: 86400
  on_timeout: escalate
  require_reason_for_change: true
```

### 6.5 数据资产质量字段

```yaml
context_source:
  code: supplier-master-data-source
  owner: master-data-team
  source_system: erp
  data_contract:
    schema_version: 2.1.0
    primary_key:
      - supplier_id
    freshness_sla_hours: 24
    quality_rules:
      - field: review_status
        rule: equals
        value: approved
    missing_policy:
      strategy: block
```

这里不要求第一阶段单独新增 `DataProduct` 注册表。更轻的做法是先把数据质量、版本、鲜度、缺失处理、责任人放进 `ContextSource` / `ContextPolicy`。只有当这些数据资产被多个 Job 复用、由数据团队独立维护、需要单独发布和治理时，才考虑抽成顶层 `DataProduct`。

### 6.6 Validator 配置

Validator 是平台裁判能力。它可以由平台、Worker、外部系统或人执行，但调度、采信、失败处理和审计必须归平台控制面。

常见 Validator 有三类：

1. 平台内置 Validator，例如 `not_empty`、`regex`、`enum`、`json_schema`。
2. Tool / Skill / RuntimeProfile 声明的能力型校验，例如 `supports_dry_run`、`supports_idempotency_key`、`output_schema`。
3. JobSpec / Task 中绑定的业务校验，例如三单匹配、重复发票、写后确认。

第一阶段不一定需要新增 Validator 注册表。可以先由 JobSpec / Task 的 `control_bindings.validators` 声明校验 code、phase、executor、authority 和 on_fail：

```yaml
control_bindings:
  validators:
    - code: ap-three-way-match-validator
      phase: post_task
      executor: platform
      authority: authoritative
      input_mapping:
        invoice: tasks.invoice-understanding.result
        reference_data: context.ap_reference_data
      on_fail:
        strategy: route_to_review
```

当某个 Validator 需要跨多个 Job 复用、独立版本、独立发布和审批时，再提升为资源平台中的 Validator：

```yaml
validator:
  code: ap-three-way-match-validator
  version: 1.0.0
  type: script
  default_executor: platform
  default_authority: authoritative
  runtime: node20
  entrypoint: validate.js
  artifact_digest: sha256:validator-ap-match-100
  input_schema:
    type: object
    required:
      - invoice
      - po_records
      - gr_records
  output_schema:
    type: object
    required:
      - passed
      - details
  default_timeout_seconds: 30
  visibility: platform_only
```

HTTP 型 Validator 也一样，只有在它具备独立生命周期时才建议资源化：

```yaml
validator:
  code: erp-ap-dry-run-validator
  version: 1.0.0
  type: http
  default_executor: external_system
  default_authority: authoritative
  endpoint: internal://erp-ap/dry-run
  auth:
    secret_ref: validator-service-secret
  visibility: platform_only
```

无论 Validator 是否资源化，FlowAgent 当前节点都只表达“这个 Task 在哪个阶段需要什么裁判，以及失败后怎么办”：

```yaml
control_bindings:
  validators:
    - code: ap-three-way-match-validator
      version: 1.0.0
      phase: post_task
      executor: platform
      authority: authoritative
      on_fail:
        strategy: block
```

### 6.7 审批策略字段

第一阶段优先扩展 `ReviewPolicy` 或 Task 审批字段，不建议立刻新增 `ApprovalPolicy` 顶层资源。

`ReviewPolicy` 回答：

> 人审任务由谁审、多久审、超时怎么办。

审批字段回答：

> 什么高风险动作必须在生效前得到批准。

```yaml
review_policy:
  code: finance-high-value-review
  approver_roles:
    - finance_manager
    - internal_control
  trigger:
    - total_amount_above: 100000
    - write_system: sap-ap
  timeout_seconds: 86400
  on_timeout: escalate
```

如果同一套审批策略跨多个 Job、多个高风险动作复用，并且需要独立版本和发布流程，再考虑抽成顶层 `ApprovalPolicy`。

### 6.8 审计策略字段

第一阶段优先把审计要求放在 JobSpec、RuntimeProfile 或平台默认配置中：

```yaml
audit:
  record_tool_calls: true
  record_secret_access_refs: true
  record_validator_results: true
  record_human_review_diff: true
  record_before_after_data: true
  retention_days: 365
```

如果不同业务线有独立审计标准、独立留存周期、单独审批发布需求，再抽成顶层 `AuditPolicy`。

---

## 7. JobSpec Release 协议

JobSpec Release 是编译器从完整 FlowAgent Schema 生成的正式执行版本。

### 7.1 Release 头

```yaml
spec_version: task-platform.job.v2
kind: JobSpec

release:
  id: ap-three-way-match-2026-05-r1
  status: published
  source_schema_id: ap-three-way-match
  source_schema_version: 1.0.0
  compiler_version: 0.5.0
  runtime_pack_protocol: 1.1.0
  artifact_digest: sha256:ap-release-001
  approved_by:
    business_owner: finance-ap-manager
    tech_owner: platform-architect
```

### 7.2 Job 元数据

```yaml
metadata:
  code: ap-three-way-match
  name: 应付发票三单匹配与 ERP 入账
  description: 自动处理供应商发票，完成三单匹配并在合规后写入 ERP 应付模块
```

### 7.3 资源锁定

```yaml
resource_lock:
  skills:
    - code: invoice-field-extractor
      version: 1.4.2
      digest: sha256:skill-invoice-extractor-142
  tools:
    - code: erp-ap-posting
      version: 3.0.0
  runtime_profiles:
    - code: integration-safe-write
      version: 1.3.0
```

### 7.4 tasks

JobSpec 中每个 Task 是编译后的执行定义。

`type` 是设计态 `task_type` 的发布态字段，必须由编译器固定，不能让 Runtime 或 Agent 临时推断。

```yaml
tasks:
  - code: extract-invoice-fields
    name: 提取发票字段
    type: agentic
    agent_task_mode: extract_with_evidence
    instruction: "从供应商发票 PDF 中提取结构化字段"
    runtime_profile_code: agentic-extraction-stable
    skill_codes:
      - invoice-field-extractor
    tool_codes:
      - pdf-reader
      - ocr-reader
    input_schema: {}
    output_schema: {}
    effect:
      type: generate_artifact
    evidence_policy: {}
    retry_resume_policy: {}
    agentic_controls: {}
    agent_execution:
      intent_recognition_required: true
      planning_required: true
      plan_validation:
        required: true
      plan_must_respect:
        - output_schema
        - allowed_tools
        - forbidden_actions
        - evidence_policy
```

### 7.5 flow

```yaml
flow:
  - from: null
    to: receive-invoice
  - from: receive-invoice
    to: extract-invoice-fields
  - from: extract-invoice-fields
    to: query-po-gr
```

---

## 8. Runtime Pack 与 Control Pack

### 8.1 Runtime Pack

Runtime Pack 给 Worker / Agent。

```yaml
execution-envelope:
  protocol_version: 1.1.0
  job_run_id: job-run-001
  task_run_id: task-run-002
  task:
    code: extract-invoice-fields
    type: agentic
    agent_task_mode: extract_with_evidence
    instruction: "从供应商发票 PDF 中提取结构化字段"
    output_schema: {}
    skill_codes:
      - invoice-field-extractor
    agent_execution:
      intent_recognition_required: true
      planning_required: true
      plan_validation:
        required: true
      plan_must_respect:
        - output_schema
        - allowed_tools
        - forbidden_actions
        - evidence_policy
  policies:
    timeout_seconds: 600
    max_tool_calls: 20
    max_tokens: 30000

context:
  inputs:
    invoice_file_path: /inputs/invoice.pdf
  upstream_outputs: {}
  configuration: {}

skills:
  - SKILL.md
  - skill.yaml

tools:
  allowed:
    - pdf-reader
    - ocr-reader
```

### 8.2 Control Pack

Control Pack 给平台控制面。

```yaml
control-pack:
  task_run_id: task-run-002
  validators: []
  evidence_policy: {}
  approval_policy: {}
  write_policy: {}
  retry_resume_policy: {}
  audit_policy: {}
  failure_classification_rules: {}
  secret_resolution: {}
```

Control Pack 不是手写文件，而是 task-platform 根据 JobSpec Release 中的引用，在每次 Task Run 时物化出来。

例如 JobSpec 中有：

```yaml
control_bindings:
  validators:
    - code: ap-three-way-match-validator
      version: 1.0.0
      phase: post_task
      executor: platform
      authority: authoritative
      input_mapping:
        invoice: tasks.extract-invoice-fields.result.invoice_record
        po_records: tasks.query-po-gr.result.po_records
        gr_records: tasks.query-po-gr.result.gr_records
      on_fail:
        strategy: block
  approval_policy:
    code: finance-high-value-approval
    version: 1.0.0
```

运行时 task-platform 会从资源平台解析这些 code/version，生成：

```yaml
control-pack:
  task_run_id: task-run-three-way-match-001
  validators:
    - code: ap-three-way-match-validator
      version: 1.0.0
      type: script
      artifact_digest: sha256:validator-ap-match-100
      phase: post_task
      executor: platform
      authority: authoritative
      input_mapping:
        invoice: tasks.extract-invoice-fields.result.invoice_record
        po_records: tasks.query-po-gr.result.po_records
        gr_records: tasks.query-po-gr.result.gr_records
      execution:
        engine: platform-validator-runner
        timeout_seconds: 30
      on_fail:
        strategy: block
  approval_policy:
    code: finance-high-value-approval
    version: 1.0.0
  audit_policy:
    record_validator_results: true
    retention_days: 365
```

关键原则：

> Validator 是平台裁判资源。FlowAgent 只声明当前 Task 用哪个 Validator、在哪个阶段执行、由谁执行、谁有裁判权、失败后怎么办；Agent 可以做 advisory 自检，但不能绕过平台裁判。

### 8.3 可见性

```yaml
visibility:
  agent_visible:
    - task.instruction
    - task.output_schema
    - context.inputs
    - allowed_skills
    - allowed_tools
  platform_only:
    - validators
    - approval_policy
    - write_policy
    - audit_policy
    - secret_resolution
    - failure_classification_rules
```

### 8.4 Runtime Pack 的上下文分配

Runtime Pack 不应该作为一个大上下文一次性塞给 Agent。对于 `agentic` Task，task-platform 需要通过 Context Assembler 生成分层上下文视图：

```text
Runtime Pack + Control Pack
  ↓
Context Assembler
  ↓
Understanding Context
Planning Context
Execution Context
Feedback Context
```

这四个上下文视图分别服务于 Agent Runtime 的不同阶段：

| 上下文视图 | 主要消费者 | 作用 | 典型内容 |
|---|---|---|---|
| Understanding Context | 理解层 | 把任务翻译成 Agent 可理解的目标、标准、风险 | instruction、output_schema、输入摘要、Skill/Tool 摘要、证据要求摘要、可见控制投影 |
| Planning Context | 规划层 | 生成可执行计划 | TaskUnderstanding、完整 allowed_skills / allowed_tools、Skill/Tool schema、agentic_controls、plan_must_respect |
| Execution Context | 执行层 | 调用 Skill / Tool 并产生结果 | ExecutionPlan、原始输入、上游输出、工具句柄、checkpoint、工作记忆 |
| Feedback Context | 反馈层 / 平台控制面 | 校验、诊断、审计、重试或回环 | TaskUnderstanding、ExecutionPlan、TaskResult、Trace、validators、on_fail、audit_policy |

推荐结构：

```yaml
context_distribution:
  understanding_context:
    include:
      - task.instruction
      - task.agent_task_mode
      - task.output_schema
      - context.inputs_summary
      - capabilities.skill_summaries
      - capabilities.tool_summaries
      - control_projection.semantic_success_criteria
      - control_projection.visible_validation_rules
      - evidence_policy.visible_summary
      - agentic_controls.forbidden_actions
      - agentic_controls.ask_human_when

  planning_context:
    include:
      - task_understanding
      - capabilities.allowed_skills
      - capabilities.allowed_tools
      - capabilities.skill_input_output_schemas
      - capabilities.tool_input_schemas
      - agentic_controls
      - evidence_policy
      - human_gate.visible_trigger
      - task.agent_execution.plan_output_schema
      - task.agent_execution.plan_must_respect

  execution_context:
    include:
      - execution_plan
      - context.inputs
      - context.upstream_outputs
      - resolved_tool_handles
      - checkpoint_policy
      - working_memory

  feedback_context:
    include:
      - task_understanding
      - execution_plan
      - task_result
      - execution_trace
      - validators
      - on_fail
      - retry_resume_policy
      - failure_classification_rules
      - audit_policy
```

核心原则：

> Agent 看到的是 Context View；平台持有的是 Control Truth。

#### 8.4.1 Control Projection

Control Pack 中的完整裁判规则不应该直接暴露给 Agent。Context Assembler 需要生成 `control_projection`，只把可见、可解释、能帮助 Agent 主动遵守的语义摘要给理解层和规划层。

```yaml
control_projection:
  semantic_success_criteria:
    - "必须返回指定来源的最新三条信息"
    - "每条分析结论必须引用来源 URL"
  visible_validation_rules:
    - "items.length == 3"
    - "item.url 必须属于 allowed_domains"
    - "items 必须按 published_at 倒序"
  visible_write_awareness:
    - "本 Task 不允许写系统"
  hidden_controls:
    - validator_source_code
    - secret_resolution
    - internal_risk_scoring_rule
```

`control_projection` 不是业务人员手写字段，而是由平台根据 Control Pack、visibility 和当前 Task 的风险策略生成。

#### 8.4.2 Effective Scope

一些能力边界可以在 Skill 中注册，一些边界来自当前 Task。Runtime 执行时必须合成为 `effective_scope`。

例如专用网站抓取 Skill：

```yaml
skill:
  code: xxx-site-top-news-fetcher
  version: 1.0.0
  allowed_domains:
    - xxx.com
  supported_sections:
    - 政策公告
    - 新闻动态
  default_sort_rule: published_at_desc
```

当前 Task 再给出本次运行参数：

```yaml
context:
  inputs:
    section: 政策公告
    item_limit: 3
    analysis_dimensions:
      - 对我司产品准入是否有影响
      - 是否需要销售或法务跟进
```

Context Assembler 合成：

```yaml
effective_scope:
  source:
    skill_code: xxx-site-top-news-fetcher
    allowed_domains:
      - xxx.com
    section: 政策公告
    item_limit: 3
    sort_rule: published_at_desc
  provenance:
    allowed_domains: skill_registry
    item_limit: task_input
    sort_rule: skill_default
```

如果 Skill 是通用网页抓取能力，`allowed_domains`、`entry_url`、`section` 等边界必须由 JobSpec / Runtime Pack 明确提供。

#### 8.4.3 Agentic Task 示例

固定网站取前三条信息并分析，可以作为一个 `agentic` Task，但 Runtime Pack 必须能分配出足够上下文：

```yaml
task:
  code: fetch-and-analyze-top3
  type: agentic
  agent_task_mode: retrieve_and_analyze
  instruction: "从指定网站政策公告栏目获取最新前三条信息，并分析对公司产品的影响。"
  output_schema:
    required:
      - items
      - analysis
      - evidence

capabilities:
  allowed_skills:
    - xxx-site-top-news-fetcher
    - policy-impact-analyzer
  allowed_tools:
    - browser-reader

agentic_controls:
  max_steps: 8
  max_tool_calls: 10
  forbidden_actions:
    - login
    - form_submit
    - write_database
    - send_external_email

ambiguity_policy:
  if_source_unreachable: ask_human
  if_less_than_required_items: ask_human
  if_sort_order_unclear: ask_human
  if_date_missing: mark_uncertain_and_review

evidence_policy:
  required: true
  required_for_fields:
    - title
    - url
    - published_at
    - impact_summary
```

其中：

- `allowed_domains` 可以来自专用 Skill。
- `item_limit`、`section`、`analysis_dimensions` 通常来自当前 Task。
- `ambiguity_policy` 可以有 Skill 默认建议，但当前 Job 可以覆盖。
- `plan_validation_result` 是运行时产物，不能预先写在 Skill 或 Runtime Pack 中。

---

## 9. 执行分层

### L1 Scheduler：调度层

负责：

- 读取 JobSpec Release。
- 根据 `flow` 激活 Task。
- 注入上游输出。
- 判断 Task 成功、失败、跳过或等待人工。

### L2 Runtime Router：执行器路由层

根据：

```yaml
task.type
runtime_profile_code
```

路由到：

- LLM Agent Worker。
- HTTP Integration Worker。
- Script Worker。
- Human Gateway。

这里的 `task.type` 来自 JobSpec Release，不是 Agent 自己判断出来的意图。Agent 可以在自己的执行边界内做 planning，但不能改变 Task 的执行类型。

### L3 Worker / Agent：任务执行层

Worker 只拿 Runtime Pack。

负责：

- 读取输入。
- 调用允许的 Tool。
- 使用允许的 Skill。
- 生成 result。
- 生成 evidence。
- 写 output。

### L4 Platform Guard：平台护栏层

执行前：

- 输入 schema 校验。
- 权限检查。
- Secret 注入。
- 风险检查。
- 人工门检查。

执行中：

- timeout。
- 工具调用上限。
- token 上限。
- checkpoint。
- secret 访问审计。

执行后：

- output_schema 校验。
- evidence 校验。
- validators 执行。
- 审批门。

### L5 Commit / Write Safety：提交层

只对 `write_system` 和 `external_commit` 生效。

负责：

- dry-run。
- idempotency check。
- commit confirmation。
- before / after snapshot。
- conflict detection。
- rollback / compensation。

### L6 Audit / Learning：审计和复盘层

负责：

- 平台 trace。
- 工具调用记录。
- Secret 使用记录。
- 人工修改记录。
- 失败归因。
- 样本沉淀。
- Skill 能力改进建议。

---

## 10. Validator、审批与审计规则如何分发

### 10.1 分发链路

validators、审批、审计规则不应该由 FlowAgent 直接塞脚本给 Runtime，而是走 JobSpec 字段、现有资源能力声明和平台物化。

第一阶段推荐链路：

```text
技术方扩展现有资源字段
  例如 Tool.supports_dry_run、ContextSource.data_contract、RuntimeProfile.retry
  ↓
FlowAgent 当前节点声明需要哪些控制能力
  例如 control_bindings.validators、write_policy、retry_resume_policy、audit
  ↓
编译器写入 JobSpec Release
  ↓
Job Run 时 task-platform 读取 JobSpec 和资源能力声明
  ↓
task-platform 生成 Control Pack
  ↓
平台调度 Validator 执行，采信结果，并由 Review / Approval / Audit / RetryResume / Write Guard 完成控制
```

后续如果某类控制策略出现跨 Job 复用和独立发布需求，可以升级为资源化链路：

```text
技术方在资源平台注册 Validator / ApprovalPolicy / AuditPolicy
  ↓
FlowAgent 当前节点引用这些资源 code/version
  ↓
编译器写入 JobSpec Release 并锁定版本
  ↓
TaskRun 时物化 Control Pack
```

### 10.2 Validator 阶段

Validator 可以在不同阶段执行：

```yaml
phase:
  - pre_task
  - post_task
  - pre_commit
  - post_commit
  - post_job
```

| 阶段 | 用途 | 示例 |
|---|---|---|
| `pre_task` | Task 执行前检查 | 数据是否过期、输入是否完整 |
| `post_task` | Task 输出后检查 | evidence 是否完整、字段是否合规 |
| `pre_commit` | 写系统前检查 | dry-run、重复提交检查 |
| `post_commit` | 写系统后检查 | ERP 是否真的创建成功 |
| `post_job` | 整个 Job 完成后检查 | 全局一致性、交付物完整性 |

### 10.3 FlowAgent 中的引用方式

```yaml
control_bindings:
  validators:
    - code: duplicate-invoice-validator
      version: 1.0.0
      phase: pre_commit
      executor: platform
      authority: authoritative
      on_fail:
        strategy: block

    - code: erp-ap-dry-run-validator
      version: 1.0.0
      phase: pre_commit
      executor: external_system
      authority: authoritative
      input_mapping:
        posting_payload: task.input.posting_payload
      on_fail:
        strategy: human_fix_and_retry
        max_attempts: 2

  approval_policy:
    code: finance-posting-approval
    version: 1.0.0
    trigger:
      - total_amount_above: 100000

  audit_policy:
    code: enterprise-default-audit
    version: 1.0.0
    overrides:
      record_before_after_data: true
      retention_days: 1095
```

### 10.4 执行位置与裁判权

Validator 的执行位置可以不同，但调度、采信、失败处理和审计必须由平台控制面掌握。

```yaml
validator_binding:
  code: erp-ap-dry-run-validator
  version: 1.0.0
  phase: pre_commit
  executor: external_system
  authority: authoritative
  on_fail:
    strategy: block
```

| 阶段 | 推荐 executor | 说明 |
|---|---|---|
| `pre_task` | platform | Task 开始前检查输入、权限、数据依赖 |
| `post_task` | platform，必要时 worker 先本地自检 | Task 输出后检查 schema、evidence、业务字段 |
| `pre_commit` | platform + external_system | 写系统前做 dry-run、重复提交检查、审批检查 |
| `post_commit` | platform + external_system | 写系统后确认是否真的提交成功 |
| `post_job` | platform | Job 完成后做全局一致性和审计完整性检查 |

推荐枚举：

```yaml
executor:
  - platform
  - worker
  - external_system
  - human

authority:
  - advisory        # 建议或自检，不是最终裁判
  - provisional     # 临时采信，平台可复验
  - authoritative   # 最终裁判
```

核心原则：

> 执行可以分布式，裁判权必须集中在平台控制面。Worker / Agent 是运动员，Validator / Approval / Audit 是裁判和赛事系统。

---

## 11. 运行时上下文调整

运行时上下文调整用于处理 Job Run 过程中的条件变化。

例如：

- 运营主动增加投放额度。
- Agent 发现效果好，建议增加预算。
- 物流经理输入港口拥堵信息。
- 合规人员要求临时禁用某个渠道。

这些变化通常只影响当前 Job Run，或者当前 Task 之后的下游 Task。它不等于修改 Job 模板。

### 11.1 三种作用范围

| 作用范围 | 含义 | 示例 |
|---|---|---|
| Task Run | 只影响当前 Task | 人补充一个缺失字段 |
| Job Run | 影响当前 Job 后续 Task | 当前营销活动预算从 10 万调到 15 万 |
| Job Template | 影响以后所有运行 | 以后所有新品活动默认预算上限改成 15 万 |

Job Template 变更必须回到 FlowAgent 重新确认和发布新 JobSpec Release，不能通过 runtime update 偷偷修改。

### 11.2 JobSpec 中声明哪些字段可调

```yaml
runtime_adjustable:
  constraints:
    monthly_budget:
      adjustable: true
      min: 50000
      max: 300000
      approval_required: true
      approval_roles:
        - marketing_director
        - finance_manager

    daily_budget_cap:
      adjustable: true
      min: 1000
      max: 20000
      approval_required: true

  parameters:
    paid_ads_enabled:
      adjustable: true
      approval_required: true
      unlock_skills:
        - paid-ad-optimizer
```

这个声明决定前端能展示哪些可调字段，平台能接受哪些运行时变更。

### 11.3 用户主动调整

运营经理主动提高当前活动投放额度：

```yaml
runtime_context_update_request:
  id: rcu-002
  source: user_initiated
  job_run_id: campaign-run-2026-001
  submitted_by: marketing_manager
  target_scope: current_job_run
  changed_fields:
    - path: constraints.monthly_budget
      old_value: 100000
      new_value: 150000
    - path: constraints.daily_budget_cap
      old_value: 5000
      new_value: 8000
    - path: parameters.paid_ads_enabled
      old_value: false
      new_value: true
  reason: "线下渠道反馈好，管理层决定追加投放"
```

平台处理顺序：

```text
检查字段是否 adjustable
  ↓
检查新值是否在 min / max 内
  ↓
判断是否需要审批
  ↓
判断是否解锁新 Skill
  ↓
审批通过后更新当前 Job Run 的 runtime_context
  ↓
后续 Task 使用新上下文
```

### 11.4 Agent 主动建议

Agent 发现数据表现好，提出调整建议：

```yaml
interaction_request:
  type: runtime_context_update_proposal
  source: agent_proposal
  reason: performance_above_expectation
  proposed_changes:
    - path: constraints.monthly_budget
      from: 100000
      to: 180000
    - path: parameters.paid_ads_enabled
      from: false
      to: true
```

用户确认或修改后，仍然转成正式的 `runtime_context_update_request`，由平台统一校验和审批。

### 11.5 审批结果和生效记录

```yaml
runtime_context_update_approval:
  request_id: rcu-002
  approved: true
  approved_by:
    - marketing_director
    - finance_manager
  approved_at: "2026-05-11T15:30:00+08:00"
```

```yaml
runtime_context:
  version: 2
  effective_scope: current_job_run
  effective_from_task: reallocate-campaign-budget
  constraints:
    monthly_budget: 150000
    daily_budget_cap: 8000
  parameters:
    paid_ads_enabled: true
  authorized_skills:
    - organic-content-optimizer
    - brand-safety-check
    - paid-ad-optimizer
```

### 11.6 是否需要重跑下游 Task

某些调整只影响未来 Task，某些调整会使已经生成的中间方案失效。

```yaml
runtime_adjustment_effect:
  on_change:
    - field: parameters.paid_ads_enabled
      invalidate_outputs:
        - organic_only_budget_plan
      rerun_tasks:
        - reallocate-campaign-budget
        - paid-ad-compliance-check
```

### 11.7 审计历史

```yaml
adjustment_history:
  - id: adj-002
    source: user_initiated
    requested_by: marketing_manager
    approved_by:
      - marketing_director
      - finance_manager
    changes:
      - path: constraints.monthly_budget
        from: 100000
        to: 150000
    reason: "线下渠道反馈好，管理层决定追加投放"
    effective_scope: current_job_run
    affected_tasks:
      - reallocate-campaign-budget
      - submit-paid-ad-budget
```

核心原则：

> 人或 AI 可以发起运行时调整，但调整本身必须被协议化、审批化、审计化。它改变的是当前 Job Run 的 runtime context，不应绕过发布流程去修改 Job 模板。

---

## 12. Agent Planning：Agent 意图识别与执行规划

分发给 Agent 的 Task 可以先做意图识别和执行规划，但这一步不能替代平台已经固化的 `task_type`、`effect`、`allowed_tools` 和 `forbidden_actions`。

平台先决定：

```text
这个 Task 能不能交给 Agent
Agent 可以使用哪些工具
Agent 禁止做哪些动作
输出必须满足什么 schema
哪些字段必须有 evidence
```

Agent 再在这些边界内规划怎么做。

### 12.1 Runtime Pack 中的 Agent Planning 配置

Agent Planning 消费的是 Planning Context，而不是完整 Runtime Pack。Planning Context 由 Context Assembler 从 Runtime Pack、Skill Registry、Tool Registry 和 Control Projection 中组装。

```yaml
agent_execution:
  intent_recognition_required: true
  planning_required: true
  plan_output_schema:
    required:
      - task_intent
      - planned_steps
      - needed_tools
      - evidence_plan
      - risk_flags
      - selected_skills
      - selected_tools
      - source_selection_strategy
  plan_validation:
    required: true
    on_fail:
      strategy: revise_plan
      max_attempts: 2
  plan_must_respect:
    - output_schema
    - allowed_tools
    - forbidden_actions
    - evidence_policy
    - max_steps
    - max_tool_calls
```

计划生成后，Runtime 必须记录 `plan_validation_result`：

```yaml
plan_validation_result:
  passed: true
  plan_hash: sha256:plan-001
  checked_at: "2026-05-13T10:00:00+08:00"
  violations: []
```

### 12.2 Agent 计划示例

```json
{
  "task_intent": "review_contract_risk",
  "planned_steps": [
    "读取合同条款索引",
    "检索相关 playbook 条款",
    "逐条对比偏离项",
    "为高风险条款生成建议",
    "为每条结论附上合同原文和 playbook 引用"
  ],
  "needed_tools": [
    "contract-clause-reader",
    "legal-playbook-search"
  ],
  "selected_skills": [
    "contract-risk-reviewer",
    "clause-comparison"
  ],
  "selected_tools": [
    "contract-clause-reader",
    "legal-playbook-search"
  ],
  "evidence_plan": {
    "risk_level": "contract_clause_span + playbook_policy_id",
    "recommendation": "playbook_policy_id"
  },
  "source_selection_strategy": {
    "allowed_sources": [
      "contract_document",
      "legal_playbook"
    ],
    "fallback_when_missing": "ask_human"
  },
  "risk_flags": [
    "playbook 未覆盖时请求人工审核"
  ],
  "will_not_do": [
    "不会发送客户邮件",
    "不会接受合同条款",
    "不会更新 CRM"
  ]
}
```

### 12.3 Plan 校验

平台或 Agent Runtime 需要检查：

- 是否使用未授权工具。
- 是否包含 forbidden action。
- 是否遗漏 evidence 要求。
- 是否超过 max steps。
- 是否试图写系统或外部提交。

核心原则：

> Agent 可以先读战术、判断打法、写出计划；但比赛规则、禁区和裁判权由平台提前确定。

---

## 13. on_fail：校验失败后的处理策略

`on_fail` 处理的是“系统正常运行，但校验、dry run、审批或业务规则明确失败”的情况。

它不同于 Runtime 意外中断。Runtime 意外中断由 `retry_resume_policy`、checkpoint 和 commit confirmation 处理。

### 13.1 推荐策略

```yaml
on_fail:
  strategy:
    - block
    - abort_job
    - human_review
    - human_fix_and_retry
    - retry_same_task
    - fallback_path
    - skip_with_warning
    - return_partial
    - manual_override
    - create_ticket
    - escalate
```

| 策略 | 含义 | 适合场景 |
|---|---|---|
| `block` | 阻断当前 Task | 高风险校验失败 |
| `abort_job` | 终止整个 Job | 核心业务规则失败 |
| `human_review` | 进入人工审核 | 需要人判断 |
| `human_fix_and_retry` | 人修正后重试当前阶段 | 字段可修正 |
| `retry_same_task` | 自动重试当前 Task | 结构化输出不稳定 |
| `fallback_path` | 走备用路径 | 自动流程失败转人工 |
| `skip_with_warning` | 跳过并告警 | 非关键节点 |
| `return_partial` | 返回部分结果 | 分析报告类任务 |
| `manual_override` | 高权限人工强制放行 | 少数例外处理 |
| `create_ticket` | 创建工单 | IT / 运维问题 |
| `escalate` | 升级 | 超时或多次失败 |

### 13.2 dry run 失败示例

```yaml
dry_run:
  validator_code: erp-ap-dry-run-validator
  on_fail:
    strategy: human_fix_and_retry
    max_attempts: 2
    review_policy_code: finance-dry-run-fix-review
    fallback_after_max_attempts: abort_job
```

核心区别：

```text
on_fail:
  裁判已经判定不通过，接下来怎么处理。

retry_resume_policy:
  运行过程意外中断，先确认状态，再决定是否恢复或重试。
```

---

## 14. 状态机

生产协议必须有状态机，否则无法稳定处理等待、审批、中断、恢复和复盘。

### 14.1 Job 状态

```text
draft
  -> reviewed
  -> approved
  -> published
  -> running
  -> succeeded
  -> failed
  -> paused
  -> cancelled
  -> rolled_back
```

### 14.2 Task 状态

```text
pending
  -> pre_task_checking
  -> ready
  -> running
  -> post_task_validating
  -> waiting_human
  -> pre_commit_checking
  -> committing
  -> post_commit_confirming
  -> succeeded
  -> failed
  -> blocked
  -> skipped
```

### 14.3 Runtime Context Update 状态

```text
requested
  -> validating
  -> waiting_approval
  -> approved
  -> applied
  -> rejected
  -> expired
```

状态机回答：

```text
任务卡在哪里？
人审是否完成？
写系统前还是写系统后中断？
运行时调整有没有生效？
失败后是否还能恢复？
```

---

## 15. Hard Gates：生产硬约束

Hard Gates 是不可绕过的发布和执行规则。

如果这些规则不满足，系统必须阻断发布或执行。

```text
release.status != published -> block
skill/tool/runtime/validator version missing -> block
effect = write_system/external_commit 且 write_policy missing -> block
risk >= high 且 human_gate missing -> block
agentic task 且 agentic_controls missing -> block
Agent plan contains forbidden_action -> revise_plan or block
dry_run_required = true 但 Tool 不支持 dry run 且无补偿措施 -> block
write_system/external_commit 缺少 idempotency_key -> block
commit status unknown -> human_review
runtime update approval_required = true 但未审批 -> block apply
```

Hard Gates 的目标不是保证 AI 永远正确，而是保证：

> AI 可以犯错，但不能越权；系统可以失败，但不能静默失败。

---

## 16. 中断恢复与重试

### 16.1 不能只写 retry: 3

Runtime 中断后，必须判断：

- 这个 Task 有没有副作用？
- 写请求是否已经发出？
- 外部系统是否已经提交成功？
- 是否有幂等键？
- 是否有 checkpoint？
- 失败是不是临时故障？

### 16.2 重试决策依赖字段

```text
effect.type
retry_resume_policy
write_policy.idempotency_key
checkpoint_policy
commit_confirmation
failure_classification
```

### 16.3 处理流程

```text
Runtime 中断
  ↓
读取 task_run 状态和 checkpoint
  ↓
判断 effect.type
  ↓
read_only / generate_artifact:
  按 retry_policy 重试或从 checkpoint 恢复
  ↓
write_system / external_commit:
  查询 commit_confirmation
  已提交 -> 补 output，不重复提交
  未提交 -> 重试提交
  状态不明 -> human_review
```

### 16.4 可重试与不可重试

可重试：

```yaml
retry_on:
  - runtime_crash
  - network_timeout
  - rate_limited
  - transient_external_error
```

不可重试：

```yaml
do_not_retry_on:
  - validation_failed
  - business_rule_failed
  - permission_denied
  - human_rejected
  - evidence_missing
```

---

## 17. 审计、证据链与失败归因

### 17.1 Execution Result

```json
{
  "status": "succeeded",
  "result": {},
  "evidence": {},
  "quality": {
    "validation": {},
    "confidence": {}
  },
  "platform_trace_ref": "trace-001",
  "failure": null
}
```

### 17.2 evidence

```json
{
  "invoice_number": {
    "source_type": "pdf_text_span",
    "page": 1,
    "text": "Invoice No: INV-2026-001",
    "confidence": 0.97
  }
}
```

### 17.3 failure

```yaml
failure:
  category: skill_capability_gap
  failed_at_task: extract-invoice-fields
  failed_field: tax_amount
  reason: "扫描件税额区域无法稳定识别"
  suggested_improvement:
    - 增加高精度 OCR Skill
    - 对税额字段强制人工复核
```

推荐分类：

```text
input_quality_issue
skill_capability_gap
business_rule_missing
external_system_failure
validation_rule_gap
human_review_timeout
runtime_budget_exceeded
write_conflict
permission_denied
policy_violation
```

---

## 18. 示例一：Workflow 类型 Job

### 18.1 场景

应付发票三单匹配与 ERP 入账。

```text
收到供应商发票
  -> 提取发票字段
  -> 查询 PO / GR
  -> 执行匹配规则
  -> 异常人工审核
  -> ERP 入账
```

### 18.2 FlowAgent Schema 片段

```yaml
meta:
  id: ap-three-way-match
  name: 应付发票三单匹配与 ERP 入账
  job_type: workflow

nodes:
  - id: receive-invoice
    task_type: integration
    identity:
      label: 接收发票
      description: "读取邮件附件中的供应商发票"
    effect:
      type: read_only

  - id: extract-invoice-fields
    task_type: agentic
    agent_task_mode: extract_with_evidence
    identity:
      label: 提取发票字段
      description: "从发票 PDF 提取供应商、发票号、金额、税额和行项目"
    technical_binding:
      skill_codes:
        - code: invoice-field-extractor
          version: 1.4.2
      runtime_profile:
        code: agentic-extraction-stable
        version: 1.0.3
    effect:
      type: generate_artifact
    evidence_policy:
      required: true
      required_for_fields:
        - invoice_number
        - supplier_id
        - total_amount
        - tax_amount
    agent_execution:
      intent_recognition_required: true
      planning_required: true
      plan_must_respect:
        - output_schema
        - allowed_tools
        - forbidden_actions
        - evidence_policy
      plan_validation:
        required: true
    agentic_controls:
      max_steps: 6
      max_tool_calls: 12
      forbidden_actions:
        - erp-ap-posting
        - send_external_email

  - id: post-to-erp-ap
    task_type: integration
    identity:
      label: ERP 入账
      description: "在 ERP 应付模块创建应付账款记录"
    technical_binding:
      tool_codes:
        - code: erp-ap-posting
          version: 3.0.0
      runtime_profile:
        code: integration-safe-write
        version: 1.3.0
    effect:
      type: write_system
      target_system: erp-ap-module
    risk:
      level: critical
      reason: "创建财务应付记录"
    write_policy:
      operation: create
      idempotency_key: supplier_id + invoice_number + invoice_date + total_amount
      dry_run_required: true
      max_affected_rows: 1
      require_before_after_snapshot: true
      commit_confirmation:
        method: query_by_idempotency_key
        on_unknown: human_review
      rollback:
        supported: true
        strategy: create_reversal_entry
    human_gate:
      required: true
      trigger:
        - total_amount_above: 100000
        - exception_review_required: true
```

### 18.3 JobSpec Release 片段

```yaml
release:
  id: ap-three-way-match-2026-05-r1
  status: published
  source_schema_id: ap-three-way-match
  compiler_version: 0.5.0

tasks:
  - code: extract-invoice-fields
    type: agentic
    agent_task_mode: extract_with_evidence
    runtime_profile_code: agentic-extraction-stable
    skill_codes:
      - invoice-field-extractor
    input_schema: {}
    output_schema: {}
    evidence_policy: {}
    agentic_controls: {}
    agent_execution:
      intent_recognition_required: true
      planning_required: true
      plan_validation:
        required: true
      plan_must_respect:
        - output_schema
        - allowed_tools
        - forbidden_actions
        - evidence_policy

  - code: post-to-erp-ap
    type: integration
    runtime_profile_code: integration-safe-write
    tool_codes:
      - erp-ap-posting
    effect:
      type: write_system
    write_policy: {}
    human_gate: {}

flow:
  - from: null
    to: receive-invoice
  - from: receive-invoice
    to: extract-invoice-fields
  - from: extract-invoice-fields
    to: query-po-gr
  - from: query-po-gr
    to: three-way-match
  - from: three-way-match
    to: finance-exception-review
    condition:
      match_status: exception
  - from: three-way-match
    to: post-to-erp-ap
    condition:
      match_status: pass
```

### 18.4 执行重点

- 发票提取可重试，但两次输出不一致要进入人工审核。
- ERP 入账不能直接重试，必须先用 idempotency key 查询是否已提交。
- 金额超过阈值必须人审。
- 所有关键金额字段必须有 PDF 来源证据。

---

## 19. 示例二：Agentic 类型 Job

### 19.1 场景

合同风险审查与红线建议。

```text
销售上传客户合同
  -> 格式化合同条款
  -> 检索公司 playbook
  -> Agentic 审查风险
  -> 生成红线建议
  -> 法务审核
  -> 如需回复客户，草拟回复并审批后外发
```

### 19.2 FlowAgent Schema 片段

```yaml
meta:
  id: contract-risk-review
  name: 合同风险审查与红线建议
  job_type: agentic

nodes:
  - id: review-contract-risk
    task_type: agentic
    agent_task_mode: review_and_recommend
    identity:
      label: 审查合同风险
      description: "对照公司合同 playbook 审查客户合同条款，识别偏离项和风险等级"
    technical_binding:
      skill_codes:
        - code: contract-risk-reviewer
          version: 2.1.0
        - code: clause-comparison
          version: 1.5.0
      runtime_profile:
        code: agentic-legal-review
        version: 1.0.0
    effect:
      type: generate_artifact
    risk:
      level: high
      reason: "法律风险判断会影响客户谈判"
    agent_execution:
      intent_recognition_required: true
      planning_required: true
      plan_must_respect:
        - allowed_tools
        - forbidden_actions
        - evidence_policy
        - max_steps
      plan_validation:
        required: true
    agentic_controls:
      max_steps: 14
      max_tool_calls: 40
      max_tokens: 70000
      allowed_tools:
        - legal-playbook-search
        - clause-similarity-search
        - contract-clause-reader
      forbidden_actions:
        - send_external_email
        - update_crm_stage
        - accept_contract
        - submit_redline_to_customer
      ask_human_when:
        - confidence_below: 0.75
        - playbook_policy_missing: true
        - risk_level_at_or_above: high
    evidence_policy:
      required: true
      required_for_fields:
        - clause_id
        - risk_level
        - risk_reason
        - recommended_action
      accepted_sources:
        - contract_clause_span
        - playbook_policy_id
        - historical_case_id

  - id: legal-review
    task_type: human_review
    identity:
      label: 法务审核
      description: "法务确认风险等级、红线建议和客户回复草稿"
    human_gate:
      required: true
      review_policy_code: legal-contract-review
      editable_fields:
        - risk_level
        - recommended_action
        - redline_suggestion
        - external_response_draft
      timeout:
        seconds: 172800
        on_timeout: escalate

  - id: send-approved-response
    task_type: integration
    identity:
      label: 外发客户回复
      description: "审批通过后向客户联系人发送回复"
    effect:
      type: external_commit
      target_system: customer-email
    risk:
      level: critical
      reason: "对外客户沟通可能形成商业承诺"
    write_policy:
      operation: submit
      idempotency_key: deal_id + response_version + recipient_email
      dry_run_required: true
      commit_confirmation:
        method: query_delivery_status
        on_unknown: human_review
    human_gate:
      required: true
      trigger:
        - always: true
    recipient_policy:
      allowed_recipients_source: crm_deal_contacts
      block_if_recipient_not_verified: true
```

### 19.3 执行重点

- Agent 可以审查和建议，但不能接受合同、更新 CRM 阶段、外发邮件。
- 每个风险结论必须引用合同原文和 playbook。
- 高风险条款必须法务审核。
- 客户回复必须审批后外发。
- 邮件发送超时不能直接重发，必须先查询投递状态。

---

## 20. 发布前检查清单

发布 JobSpec Release 前，平台必须检查：

### 20.1 资源完整性

- `meta.job_type` 是否明确为 `workflow`、`agentic` 或 `hybrid`。
- FlowAgent 中每个 Task 是否明确 `task_type`，JobSpec 中每个 Task 是否明确 `type`，且只能是 `deterministic`、`integration`、`agentic`、`human_review`、`manual_action`。
- 每个非人工 Task 是否绑定 RuntimeProfile。
- 每个需要 Skill 的 Task 是否绑定 Skill。
- 每个 Tool 是否已注册并锁定版本。
- 每个 Secret 是否已注册。
- 每个 ReviewPolicy 是否存在。
- Task 中声明的 Validator 是否具备 `phase`、`executor`、`authority` 和 `on_fail`。
- 如果 Validator / ApprovalPolicy / AuditPolicy 已资源化，引用的 code/version 是否存在并锁定版本。

### 20.2 数据完整性

- 每个 required input 是否有来源。
- 每条 edge 的 sourceOutput / targetInput 是否存在。
- output_schema 是否完整。
- 外部数据依赖是否在 ContextSource / ContextPolicy 中声明质量、版本、鲜度和缺失处理。
- 如果 DataProduct 已资源化，引用的数据产品 code/version 是否存在并锁定版本。

### 20.3 风险控制

- `write_system` 是否有 `write_policy`。
- `external_commit` 是否有审批和收件人/目标校验。
- 高风险 Task 是否有 `human_gate`。
- Agentic Task 是否有 `agentic_controls`。
- Agentic Task 若允许 planning，是否有 `agent_execution`、`plan_validation` 和 `plan_must_respect`。
- Agentic Task 是否能生成 Understanding / Planning / Execution / Feedback 四个 Context View。
- Control Pack 是否通过 `control_projection` 暴露给 Agent，而不是完整下发。
- 检索类或网页类 Agentic Task 是否能生成 `effective_scope`，并记录来源来自 Skill 默认、Task 输入还是平台策略。
- 检索类或网页类 Agentic Task 是否声明 `ambiguity_policy`。
- Agent plan 是否被检查过未授权 Tool、forbidden action、缺失 evidence、越权写系统。
- Agent plan 是否记录 `plan_hash` 和 `plan_validation_result`。
- 关键字段是否有 `evidence_policy`。
- 写系统 Tool 是否声明 dry-run、幂等、快照、提交确认等能力；Task 是否声明当前业务下的 `write_policy`。
- RuntimeProfile 是否声明默认 retry / timeout / checkpoint 能力；Task 是否声明当前业务下的 `retry_resume_policy` 覆盖。
- 高风险 `manual_override` 是否要求审批人、原因、影响范围和审计留痕。

### 20.4 中断恢复

- 每个 Task 是否有 retry 策略。
- 写系统 Task 是否有 idempotency key。
- 写系统 Task 是否有 commit confirmation。
- 是否定义不可重试错误。
- 会触发提交或预算变化的运行时调整是否有审批策略。

### 20.5 运行时调整

- `runtime_adjustable` 中声明的字段是否存在于输入、配置或运行上下文。
- 每个可调整字段是否有范围、枚举或布尔约束。
- 需要审批的调整是否绑定 ApprovalPolicy。
- 动态解锁 Skill 的调整是否绑定技术或业务审批。
- 调整是否声明作用范围：Task Run、Job Run 还是 Job Template。
- 会影响已生成中间结果的调整是否声明重跑或失效策略。

### 20.6 审计复盘

- 是否开启平台 trace。
- 是否记录 Tool 调用。
- 是否记录 Secret 访问。
- 是否记录人工修改 diff。
- 是否记录 runtime_context_update 的 old/new value、申请人、审批人和影响范围。
- 是否记录 Validator 执行结果。
- 是否启用失败归因。

### 20.7 Hard Gates

- 未发布的 Release 不能执行。
- 资源版本或 digest 缺失不能发布。
- 写系统或外部提交缺少 idempotency key 不能执行。
- `dry_run_required = true` 但 Tool 不支持 dry run 且无替代控制时不能执行。
- commit 状态不明必须进入人工确认，不能静默重试。
- 需要审批的运行时调整未获批不能生效。

---

## 21. 总结

FlowAgent 企业级协议的核心不是让 AI 自由执行，而是把企业业务方案变成一个可发布、可控制、可审计、可复盘的自动化系统。

最重要的分工是：

```text
资源平台：
  定义能力本身，包括 Skill / Tool / Runtime / Context / ReviewPolicy 等。
  生产控制能力优先作为这些资源的扩展字段，例如 Tool 的 dry-run / 幂等能力、Runtime 的 checkpoint / retry 能力、Context 的数据质量字段。

FlowAgent Schema：
  定义当前业务怎么使用这些能力，以及当前业务下的风险、证据、人审、校验、写入保护、恢复要求。

JobSpec Release：
  冻结这次正式发布的执行配置，包括可运行的资源版本、Task 控制字段、必要的控制策略引用、runtime_adjustable 声明。

Runtime Pack：
  给 Worker / Agent 最小必要执行信息。

Control Pack：
  由 task-platform 根据 JobSpec 和资源能力声明物化，给平台裁判、审批、审计、写入保护、运行时调整校验和失败归因规则。

Execution Result：
  给业务方和技术方结果、证据、审计引用和复盘线索。
```

用比赛类比：

> FlowAgent Schema 是赛前战术板；JobSpec Release 是正式比赛名单和规则确认；Runtime Pack 是运动员上场时能看的打法提示；Control Pack 是裁判、鹰眼和赛事纪律；Execution Result 是比分、录像、技术统计和赛后复盘。

企业生产环境真正需要的是：

```text
可复现
可解释
可校验
可审批
可回滚
可复盘
```
