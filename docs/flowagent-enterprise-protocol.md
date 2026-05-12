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
12. 中断恢复与重试
13. 审计、证据链与失败归因
14. 示例一：Workflow 类型 Job
15. 示例二：Agentic 类型 Job
16. 发布前检查清单
17. 总结

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
| Validator / ApprovalPolicy / AuditPolicy 定义 | 资源平台 | 技术方 / 管理员 |
| 当前 Task 使用哪些 Validator / 审批 / 审计策略 | FlowAgent Schema | 技术方 |
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
  task_type: workflow
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
    data_contract: {}
    business_intent: []
    technical_binding: {}
    effect: {}
    risk: {}
    evidence_policy: {}
    write_policy: {}
    retry_resume_policy: {}
    human_gate: {}
    agentic_controls: {}
    quality_hint: {}
    error_strategy: {}
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

### 6.5 DataProduct 注册

```yaml
data_product:
  code: supplier-master-data
  owner: master-data-team
  source_system: erp
  schema_version: 2.1.0
  primary_key:
    - supplier_id
  freshness_sla_days: 365
  quality_rules:
    - field: review_status
      rule: equals
      value: approved
```

### 6.6 Validator 注册

Validator 是平台裁判资源，不是 Agent 自己执行的检查。

常见 Validator 有三类：

1. 平台内置 Validator，例如 `not_empty`、`regex`、`enum`、`json_schema`。
2. Skill / Tool 注册时附带的推荐 Validator。
3. 技术方为企业业务单独注册的自定义 Validator。

自定义脚本型 Validator：

```yaml
validator:
  code: ap-three-way-match-validator
  version: 1.0.0
  type: script
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

HTTP 型 Validator：

```yaml
validator:
  code: erp-ap-dry-run-validator
  version: 1.0.0
  type: http
  endpoint: internal://erp-ap/dry-run
  auth:
    secret_ref: validator-service-secret
  visibility: platform_only
```

Validator 注册在资源平台。FlowAgent 当前节点只引用它：

```yaml
control_bindings:
  validators:
    - code: ap-three-way-match-validator
      version: 1.0.0
      phase: post_task
      on_fail: block
```

### 6.7 ApprovalPolicy 注册

ReviewPolicy 更偏“人如何审核一个 Task”。ApprovalPolicy 更偏“某类变更或提交是否允许生效”。

```yaml
approval_policy:
  code: finance-high-value-approval
  version: 1.0.0
  approver_roles:
    - finance_manager
    - internal_control
  timeout_seconds: 86400
  on_timeout: escalate
```

### 6.8 AuditPolicy 注册

```yaml
audit_policy:
  code: enterprise-default-audit
  version: 1.0.0
  record_tool_calls: true
  record_secret_access: true
  record_validator_results: true
  record_human_review_diff: true
  retention_days: 365
```

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

```yaml
tasks:
  - code: extract-invoice-fields
    name: 提取发票字段
    type: agentic
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
    instruction: "从供应商发票 PDF 中提取结构化字段"
    output_schema: {}
    skill_codes:
      - invoice-field-extractor
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
      input_mapping:
        invoice: tasks.extract-invoice-fields.result.invoice_record
        po_records: tasks.query-po-gr.result.po_records
        gr_records: tasks.query-po-gr.result.gr_records
      on_fail: block
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
      input_mapping:
        invoice: tasks.extract-invoice-fields.result.invoice_record
        po_records: tasks.query-po-gr.result.po_records
        gr_records: tasks.query-po-gr.result.gr_records
      execution:
        engine: platform-validator-runner
        timeout_seconds: 30
      on_fail: block
  approval_policy:
    code: finance-high-value-approval
    version: 1.0.0
  audit_policy:
    record_validator_results: true
    retention_days: 365
```

关键原则：

> Validator 是平台裁判资源。FlowAgent 只声明当前 Task 用哪个 Validator、在哪个阶段执行、失败后怎么办；Agent 不自己运行 Validator。

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

validators、审批、审计规则不应该由 FlowAgent 直接塞脚本给 Runtime，而是走资源引用和平台物化：

```text
技术方在资源平台注册 Validator / ApprovalPolicy / AuditPolicy
  ↓
FlowAgent 当前节点引用这些资源
  ↓
编译器写入 JobSpec Release
  ↓
Job Run 时 task-platform 读取 JobSpec
  ↓
task-platform 生成 Control Pack
  ↓
平台 Validator Engine / Approval Engine / Audit Engine 执行
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
      on_fail: block

    - code: erp-ap-dry-run-validator
      version: 1.0.0
      phase: pre_commit
      input_mapping:
        posting_payload: task.input.posting_payload
      on_fail: block

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

### 10.4 运行时谁执行

| 内容 | 执行者 |
|---|---|
| Validator | 平台 Validator Engine |
| ApprovalPolicy | 平台 Approval / Review Engine |
| AuditPolicy | 平台 Audit Logger |
| Skill / Tool 任务逻辑 | Worker / Agent |

核心原则：

> Worker / Agent 是运动员，Validator / Approval / Audit 是裁判和赛事系统。两者不能混在一起。

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

## 12. 中断恢复与重试

### 12.1 不能只写 retry: 3

Runtime 中断后，必须判断：

- 这个 Task 有没有副作用？
- 写请求是否已经发出？
- 外部系统是否已经提交成功？
- 是否有幂等键？
- 是否有 checkpoint？
- 失败是不是临时故障？

### 12.2 重试决策依赖字段

```text
effect.type
retry_resume_policy
write_policy.idempotency_key
checkpoint_policy
commit_confirmation
failure_classification
```

### 12.3 处理流程

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

### 12.4 可重试与不可重试

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

## 13. 审计、证据链与失败归因

### 13.1 Execution Result

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

### 13.2 evidence

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

### 13.3 failure

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

## 14. 示例一：Workflow 类型 Job

### 14.1 场景

应付发票三单匹配与 ERP 入账。

```text
收到供应商发票
  -> 提取发票字段
  -> 查询 PO / GR
  -> 执行匹配规则
  -> 异常人工审核
  -> ERP 入账
```

### 14.2 FlowAgent Schema 片段

```yaml
meta:
  id: ap-three-way-match
  name: 应付发票三单匹配与 ERP 入账
  task_type: workflow

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

### 14.3 JobSpec Release 片段

```yaml
release:
  id: ap-three-way-match-2026-05-r1
  status: published
  source_schema_id: ap-three-way-match
  compiler_version: 0.5.0

tasks:
  - code: extract-invoice-fields
    type: agentic
    runtime_profile_code: agentic-extraction-stable
    skill_codes:
      - invoice-field-extractor
    input_schema: {}
    output_schema: {}
    evidence_policy: {}
    agentic_controls: {}

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

### 14.4 执行重点

- 发票提取可重试，但两次输出不一致要进入人工审核。
- ERP 入账不能直接重试，必须先用 idempotency key 查询是否已提交。
- 金额超过阈值必须人审。
- 所有关键金额字段必须有 PDF 来源证据。

---

## 15. 示例二：Agentic 类型 Job

### 15.1 场景

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

### 15.2 FlowAgent Schema 片段

```yaml
meta:
  id: contract-risk-review
  name: 合同风险审查与红线建议
  task_type: agentic

nodes:
  - id: review-contract-risk
    task_type: agentic
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

### 15.3 执行重点

- Agent 可以审查和建议，但不能接受合同、更新 CRM 阶段、外发邮件。
- 每个风险结论必须引用合同原文和 playbook。
- 高风险条款必须法务审核。
- 客户回复必须审批后外发。
- 邮件发送超时不能直接重发，必须先查询投递状态。

---

## 16. 发布前检查清单

发布 JobSpec Release 前，平台必须检查：

### 16.1 资源完整性

- 每个非人工 Task 是否绑定 RuntimeProfile。
- 每个需要 Skill 的 Task 是否绑定 Skill。
- 每个 Tool 是否已注册并锁定版本。
- 每个 Secret 是否已注册。
- 每个 ReviewPolicy 是否存在。
- 引用的 Validator / ApprovalPolicy / AuditPolicy 是否存在并锁定版本。

### 16.2 数据完整性

- 每个 required input 是否有来源。
- 每条 edge 的 sourceOutput / targetInput 是否存在。
- output_schema 是否完整。
- 外部数据依赖是否有数据产品注册。

### 16.3 风险控制

- `write_system` 是否有 `write_policy`。
- `external_commit` 是否有审批和收件人/目标校验。
- 高风险 Task 是否有 `human_gate`。
- Agentic Task 是否有 `agentic_controls`。
- 关键字段是否有 `evidence_policy`。
- 引用的 Validator 是否声明执行阶段和失败处理。

### 16.4 中断恢复

- 每个 Task 是否有 retry 策略。
- 写系统 Task 是否有 idempotency key。
- 写系统 Task 是否有 commit confirmation。
- 是否定义不可重试错误。
- 会触发提交或预算变化的运行时调整是否有审批策略。

### 16.5 运行时调整

- `runtime_adjustable` 中声明的字段是否存在于输入、配置或运行上下文。
- 每个可调整字段是否有范围、枚举或布尔约束。
- 需要审批的调整是否绑定 ApprovalPolicy。
- 动态解锁 Skill 的调整是否绑定技术或业务审批。
- 调整是否声明作用范围：Task Run、Job Run 还是 Job Template。
- 会影响已生成中间结果的调整是否声明重跑或失效策略。

### 16.6 审计复盘

- 是否开启平台 trace。
- 是否记录 Tool 调用。
- 是否记录 Secret 访问。
- 是否记录人工修改 diff。
- 是否记录 runtime_context_update 的 old/new value、申请人、审批人和影响范围。
- 是否记录 Validator 执行结果。
- 是否启用失败归因。

---

## 17. 总结

FlowAgent 企业级协议的核心不是让 AI 自由执行，而是把企业业务方案变成一个可发布、可控制、可审计、可复盘的自动化系统。

最重要的分工是：

```text
资源平台：
  定义能力本身，包括 Skill / Tool / Runtime / ReviewPolicy / DataProduct / Validator / ApprovalPolicy / AuditPolicy。

FlowAgent Schema：
  定义当前业务怎么使用这些能力，以及当前业务下的风险、证据、人审、写入保护要求。

JobSpec Release：
  冻结这次正式发布的执行配置，包括可运行的资源版本、控制策略引用、runtime_adjustable 声明。

Runtime Pack：
  给 Worker / Agent 最小必要执行信息。

Control Pack：
  给平台裁判、审批、审计、写入保护、运行时调整校验和失败归因规则。

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
