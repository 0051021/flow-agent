# FlowAgent 生产可用性协议补充与深度测试

> 目标：不是验证“AI 能不能完成任务”，而是验证：
>
> 1. 业务方案能不能被稳定编译成可执行 Job。
> 2. Job 执行时能不能做到高准确性、稳定性和可控。
> 3. 出错后能不能定位：是业务方案问题、Skill 能力问题、输入质量问题、外部系统问题，还是管控规则问题。
>
> 本文档使用少量但复杂的企业场景做深度压力测试。

---

## 一、为什么还要补协议

当前主链路是：

```text
自然语言业务方案
  -> FlowAgent Schema
  -> 技术 binding
  -> JobSpec
  -> Runtime Pack
  -> Runtime 执行
  -> output.json
```

这条链路可以把“业务怎么做”描述清楚，但要判断它是否能进入中大型企业生产，还需要回答更细的问题：

- 这个 Job 是不是正式发布版本，还是草稿？
- 每个 Skill / Tool / Runtime 到底锁定到哪个版本？
- Agent 能看什么？平台裁判规则是不是对 Agent 隐藏？
- 这个 Task 只是读数据，还是会写数据库、发邮件、提交外部系统？
- 写错了能不能回滚？重试会不会重复提交？
- 关键字段有没有来源证据？
- 人工审核什么时候必须发生？超时怎么办？
- 外部系统失败时，是 abort、重试、跳过，还是挂工单补偿？
- 最后失败了，应该归因到哪里？

所以，除了原来的 Schema / JobSpec / Runtime Pack，还需要补充一组“生产判定协议”。

---

## 二、需要新增或明确的协议块

### 2.1 Release Protocol：正式发布协议

作用：区分“设计草稿”和“生产可执行版本”。

```yaml
release:
  id: ap-three-way-match-2026-05-11-r1
  status: draft | approved | published | deprecated | rolled_back
  source_schema_id: ap-three-way-match-schema
  source_schema_version: 2.6.0
  compiler_version: 0.5.0
  jobspec_version: task-platform.job.v2
  runtime_pack_protocol: 1.1.0
  artifact_digest: sha256:...
  approved_by:
    business_owner: finance.ap.manager
    tech_owner: platform.architect
    risk_owner: internal.control
  approved_at: "2026-05-11T10:00:00+08:00"
  change_summary:
    - 首次发布 AP 三单匹配自动化
```

没有 Release Protocol，就无法回答：

> 这次运行到底用的是哪一版业务方案？

### 2.2 Resource Lock Protocol：资源锁定协议

作用：锁定 Skill、Tool、Runtime、ReviewPolicy、ContextSource 的版本。

```yaml
resource_lock:
  skills:
    - code: invoice-field-extractor
      version: 1.4.2
      digest: sha256:...
  tools:
    - code: erp-po-query
      version: 2.1.0
  runtime_profiles:
    - code: agentic-low-temperature
      version: 1.0.3
  review_policies:
    - code: finance-exception-review
      version: 1.2.0
  context_sources:
    - code: ap-policy-playbook
      version: 2026.05
```

这里的 `digest` 是内容指纹。它不一定给 Agent 看，但平台审计必须能记录。

### 2.3 Visibility Protocol：可见性协议

作用：区分 Agent 可见信息和平台控制面信息。

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

核心原则：

> Agent 可以知道要交付什么，但不应该自己掌握完整裁判规则。

### 2.4 Effect Protocol：副作用协议

作用：声明 Task 对真实世界的影响。

```yaml
effect:
  type: read_only | generate_artifact | notify | write_system | external_commit
  target_system: erp-ap-module
  business_impact: creates_financial_liability
```

不同 effect 对应不同管控强度。

| effect | 例子 | 管控要求 |
|---|---|---|
| read_only | 查询 ERP、读取 PDF | 基础审计 |
| generate_artifact | 生成报告、提取 JSON | schema + evidence |
| notify | 内部飞书提醒 | 收件人校验 |
| write_system | 写数据库、更新 ERP | 幂等、快照、dry-run |
| external_commit | 发客户邮件、提交监管平台 | 人工审批、外发校验 |

### 2.5 Write Safety Protocol：写入安全协议

作用：控制数据库、ERP、CRM、外部系统写入。

```yaml
write_policy:
  operation: upsert | create | update | delete | submit
  idempotency_key: supplier_id + invoice_number + invoice_total
  dry_run_required: true
  max_affected_rows: 1
  require_before_after_snapshot: true
  conflict_detection:
    fields:
      - version
      - updated_at
    on_conflict: human_review
  rollback:
    supported: true
    strategy: restore_snapshot
  retry_semantics: retry_safe_with_idempotency_key
```

没有它，企业生产环境最容易出事故：重复入账、重复发邮件、覆盖主数据。

### 2.6 Evidence Protocol：证据链协议

作用：要求关键字段必须可追溯来源。

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
    - erp_api_response
    - human_review
  require_human_review_when:
    - evidence_missing: true
    - confidence_below: 0.85
```

输出建议结构：

```json
{
  "result": {
    "invoice_number": "INV-2026-001",
    "total_amount": 12000.5
  },
  "evidence": {
    "invoice_number": {
      "source_type": "pdf_text_span",
      "page": 1,
      "text": "Invoice No: INV-2026-001",
      "confidence": 0.97
    },
    "total_amount": {
      "source_type": "pdf_bounding_box",
      "page": 2,
      "bbox": [120, 680, 260, 710],
      "confidence": 0.92
    }
  }
}
```

### 2.7 Human Gate Protocol：人工门协议

作用：把“问人”和“人作为执行者”规范化。

```yaml
human_gate:
  required: true
  trigger:
    - risk_level_at_or_above: high
    - confidence_below: 0.85
    - evidence_missing: true
    - write_system: true
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

高风险生产环境不建议默认 `auto_approve`。

### 2.8 Data Product Contract：跨 Job 数据产品协议

作用：当 Job A 的产出会被 Job B 消费时，声明数据版本、唯一键、鲜度和质量要求。

```yaml
data_product_contract:
  code: supplier-invoice-record
  producer_job: invoice-ingestion
  consumer_jobs:
    - ap-posting
    - cashflow-forecast
  primary_key:
    - supplier_id
    - invoice_number
  freshness_sla_minutes: 30
  schema_version: 1.2.0
  quality_rules:
    - field: total_amount
      rule: greater_than
      value: 0
    - field: currency
      rule: in_enum
      values: [CNY, USD, EUR]
```

如果没有它，多 Job 拆分后会出现“下游消费旧数据却不知道”的问题。

### 2.9 Agentic Control Protocol：Agentic 有限自主协议

作用：控制 Agentic Task 的自主边界。

```yaml
agentic_controls:
  max_steps: 12
  max_tool_calls: 40
  max_tokens: 60000
  allowed_tools:
    - contract-parser
    - legal-playbook-search
  forbidden_actions:
    - send_external_email
    - submit_to_erp
    - accept_contract
  ask_human_when:
    - confidence_below: 0.75
    - policy_missing: true
    - risk_level_at_or_above: high
```

Agentic 不是自由发挥，而是在边界内自主判断。

### 2.10 Observability / Audit Protocol：观测与审计协议

作用：平台侧记录真实执行轨迹，而不是只信 Agent 自述。

```yaml
audit_policy:
  platform_trace_required: true
  record_tool_calls: true
  record_tool_inputs_hash: true
  record_tool_outputs_hash: true
  record_secret_access: true
  record_before_after_data: true
  record_human_review_diff: true
  retention_days: 365
```

Agent 写的 `trace` 可以作为辅助说明，但平台 trace 才是审计事实。

### 2.11 Failure Classification Protocol：失败归因协议

作用：失败后能复盘，不只是看到 failed。

```yaml
failure_classification:
  enabled: true
  categories:
    - input_quality_issue
    - skill_capability_gap
    - business_rule_missing
    - external_system_failure
    - validation_rule_gap
    - human_review_timeout
    - runtime_budget_exceeded
    - write_conflict
    - permission_denied
    - policy_violation
```

输出示例：

```yaml
failure:
  category: skill_capability_gap
  failed_at_task: extract-invoice-fields
  failed_field: tax_amount
  reason: 发票税额区域为扫描图片，当前 OCR Skill 无法稳定识别
  suggested_improvement:
    - 增加高精度 OCR Skill
    - 对税额字段强制人工复核
```

---

## 三、统一判定标准

一个复杂 Job 被认为“生产可跑通”，至少要满足：

| 判断项 | 必须回答的问题 |
|---|---|
| 发布可追溯 | 能否知道运行的是哪版业务方案、哪版 compiler、哪版 JobSpec？ |
| 资源可复现 | Skill / Tool / Runtime 是否锁定版本？ |
| 权限最小化 | Agent 是否只看到必要信息？validators 是否平台独占？ |
| 副作用明确 | 每个 Task 是 read、generate、write 还是 external commit？ |
| 写入安全 | 写系统是否有幂等、dry-run、快照、冲突处理和回滚？ |
| 证据链 | 关键字段是否能追溯到源文件、API 响应或人工审核？ |
| 人工门 | 高风险、不确定、证据缺失时是否强制人审？ |
| 失败可归因 | 出错后能否定位到输入、Skill、规则、外部系统、权限或写入冲突？ |
| 审计可信 | 真实工具调用和数据改动是否由平台记录？ |
| 多 Job 连续性 | 下游消费上游数据时，是否有数据产品契约？ |

---

## 四、深度测试 1：应付发票三单匹配与 ERP 入账

### 4.1 业务背景

中大型制造企业的财务共享中心每天收到大量供应商发票。原流程是人工收邮件、下载发票、对照采购订单 PO、收货记录 GR、合同条款和付款条件，确认无误后在 ERP 里创建应付账款。

目标不是把企业的财务规则“变聪明”，而是把现有 80 分流程自动化，提高效率，同时保持可控。

### 4.2 Job 定义

```yaml
job:
  code: ap-three-way-match
  name: 应付发票三单匹配与 ERP 入账
  type: workflow
  trigger:
    type: email_or_api_event
    source: ap-invoice-inbox
  business_goal: 自动处理供应商发票，完成 PO / GR / Invoice 三单匹配，合规后写入 ERP 应付模块
  risk_level: critical
```

### 4.3 Release

```yaml
release:
  id: ap-three-way-match-2026-05-r1
  status: published
  source_schema_id: ap-three-way-match-schema
  source_schema_version: 2.6.0
  compiler_version: 0.5.0
  jobspec_version: task-platform.job.v2
  runtime_pack_protocol: 1.1.0
  artifact_digest: sha256:ap-release-001
  approved_by:
    business_owner: finance.ap.manager
    tech_owner: platform.architect
    risk_owner: internal.control
```

### 4.4 Resource Lock

```yaml
resource_lock:
  skills:
    - code: invoice-field-extractor
      version: 1.4.2
      digest: sha256:skill-invoice-extractor-142
    - code: ap-match-explainer
      version: 1.1.0
      digest: sha256:skill-ap-match-explainer-110
  tools:
    - code: email-attachment-reader
      version: 2.0.0
    - code: erp-po-query
      version: 2.1.0
    - code: erp-gr-query
      version: 2.1.0
    - code: erp-ap-posting
      version: 3.0.0
  runtime_profiles:
    - code: agentic-extraction-stable
      version: 1.0.3
    - code: deterministic-fast
      version: 1.2.0
    - code: integration-safe-write
      version: 1.3.0
  review_policies:
    - code: finance-exception-review
      version: 1.2.0
```

### 4.5 Task 详细拆解

#### Task 1：接收并登记发票

```yaml
task:
  code: receive-invoice
  type: integration
  effect:
    type: read_only
    target_system: ap-invoice-inbox
  input_schema:
    required:
      - email_id
  output_schema:
    required:
      - invoice_file_path
      - sender_email
      - received_at
      - attachment_hash
  evidence_policy:
    required: true
    required_for_fields:
      - sender_email
      - attachment_hash
```

Runtime Pack 给 Worker：

- 邮件 ID。
- 附件读取工具。
- 输出字段要求。

Control Pack 给平台：

- 附件 hash 校验。
- 发件人白名单校验。
- 邮件重复事件校验。

#### Task 2：提取发票字段

```yaml
task:
  code: extract-invoice-fields
  type: agentic
  effect:
    type: generate_artifact
  runtime_profile_code: agentic-extraction-stable
  skill_codes:
    - invoice-field-extractor
  input_schema:
    required:
      - invoice_file_path
  output_schema:
    required:
      - supplier_name
      - supplier_id
      - invoice_number
      - invoice_date
      - currency
      - total_amount
      - tax_amount
      - line_items
  evidence_policy:
    required: true
    required_for_fields:
      - supplier_name
      - invoice_number
      - total_amount
      - tax_amount
      - line_items
    accepted_sources:
      - pdf_text_span
      - pdf_bounding_box
  human_gate:
    required: false
    trigger:
      - confidence_below: 0.9
      - evidence_missing: true
  agentic_controls:
    max_steps: 6
    max_tool_calls: 12
    max_tokens: 20000
    allowed_tools:
      - pdf-reader
      - ocr-reader
    forbidden_actions:
      - erp-ap-posting
      - send_external_email
```

关键判断：

- Agent 只能提取和解释，不能写 ERP。
- 每个关键字段必须有 PDF 位置或文本证据。
- 低置信度直接进人审。

#### Task 3：查询 PO 和收货记录

```yaml
task:
  code: query-po-gr
  type: integration
  effect:
    type: read_only
    target_system: erp
  input_schema:
    required:
      - supplier_id
      - po_number
      - line_items
  output_schema:
    required:
      - po_records
      - goods_receipt_records
      - payment_terms
  audit_policy:
    record_tool_calls: true
    record_secret_access: true
```

#### Task 4：执行三单匹配和容差规则

```yaml
task:
  code: three-way-match
  type: deterministic
  effect:
    type: generate_artifact
  deterministic_rules:
    - id: supplier_match
      description: 发票供应商必须与 PO 供应商一致
    - id: quantity_match
      description: 发票数量不能超过已收货数量
    - id: price_tolerance
      description: 单价差异不能超过 PO 单价的 2%
    - id: tax_total_check
      description: 税额和价税合计必须符合税率规则
  output_schema:
    required:
      - match_status
      - failed_rules
      - exception_reasons
      - posting_candidate
```

#### Task 5：异常人工审核

```yaml
task:
  code: finance-exception-review
  type: human_review
  effect:
    type: generate_artifact
  human_gate:
    required: true
    trigger:
      - match_status: exception
      - total_amount_above: 50000
      - supplier_bank_changed: true
    editable_fields:
      - approved_amount
      - exception_decision
      - reviewer_comment
    timeout:
      seconds: 86400
      on_timeout: escalate
    audit:
      require_reason_for_change: true
      record_old_new_value: true
```

#### Task 6：ERP 入账

```yaml
task:
  code: post-to-erp-ap
  type: integration
  effect:
    type: write_system
    target_system: erp-ap-module
    business_impact: creates_financial_liability
  risk:
    level: critical
    reason: 创建财务应付记录
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
    rollback:
      supported: true
      strategy: create_reversal_entry
    retry_semantics: retry_safe_with_idempotency_key
  human_gate:
    required: true
    trigger:
      - total_amount_above: 100000
      - exception_review_required: true
```

### 4.6 边缘情况测试结果

| 边缘情况 | 协议是否能判断 | 处理结果 |
|---|---|---|
| 同一封邮件重复触发两次 | 能 | attachment_hash + idempotency_key 阻断重复 |
| 发票 PDF 是扫描件，税额识别低置信度 | 能 | `evidence_policy` 触发人工审核 |
| PO 存在，但 GR 缺失 | 能 | 三单匹配失败，进入异常人审 |
| ERP 入账 API 超时，但实际已创建记录 | 能 | retry 前用幂等键查询，避免重复入账 |
| 供应商银行信息变更 | 能 | 触发高风险人工审批 |
| ERP 入账影响超过 1 条记录 | 能 | `max_affected_rows` 阻断，归因为 `write_conflict` |
| 人工审核超时 | 能 | escalate，不自动通过 |

### 4.7 结论

增强协议可以跑通该复杂 workflow。

关键必需协议：

- Release Protocol
- Resource Lock Protocol
- Evidence Protocol
- Write Safety Protocol
- Human Gate Protocol
- Audit Protocol
- Failure Classification Protocol

没有这些，旧协议只能说明“流程怎么走”，无法保证财务入账的生产安全。

---

## 五、深度测试 2：员工离职权限回收

### 5.1 业务背景

员工离职后，企业必须在规定时间内回收系统权限，防止数据泄露。流程涉及 HRIS、IdP、邮箱、CRM、代码仓库、财务系统、门禁系统。某些系统可能不可用，某些账号可能匹配不确定。

### 5.2 Job 定义

```yaml
job:
  code: employee-offboarding-access-revocation
  name: 员工离职权限回收
  type: workflow
  trigger:
    type: event
    source: hris.employee_terminated
  business_goal: 在 SLA 内回收离职员工关键访问权限，并对失败项创建补偿工单
  risk_level: critical
```

### 5.3 Task 详细拆解

#### Task 1：接收 HR 离职事件

```yaml
task:
  code: receive-termination-event
  type: integration
  effect:
    type: read_only
    target_system: hris
  output_schema:
    required:
      - termination_event_id
      - employee_id
      - termination_effective_at
      - termination_type
  data_product_contract:
    primary_key:
      - termination_event_id
    freshness_sla_minutes: 1
```

#### Task 2：解析员工身份和账号映射

```yaml
task:
  code: resolve-identities
  type: integration
  effect:
    type: read_only
  output_schema:
    required:
      - identity_confidence
      - accounts
  evidence_policy:
    required: true
    required_for_fields:
      - employee_id
      - accounts
    accepted_sources:
      - hris_api_response
      - idp_api_response
      - app_directory_response
  human_gate:
    required: false
    trigger:
      - confidence_below: 0.95
      - multiple_possible_identities: true
```

#### Task 3：回收核心身份权限

```yaml
task:
  code: revoke-idp-access
  type: integration
  effect:
    type: write_system
    target_system: identity-provider
    business_impact: removes_core_access
  risk:
    level: critical
    reason: 移除核心身份权限
  write_policy:
    operation: update
    idempotency_key: termination_event_id + employee_id + "idp"
    dry_run_required: false
    max_affected_rows: 1
    require_before_after_snapshot: true
    conflict_detection:
      fields:
        - account_status
        - updated_at
      on_conflict: use_latest
    rollback:
      supported: false
      strategy: manual_reactivation_only
  sla_policy:
    deadline_seconds: 300
    on_breach: escalate
```

#### Task 4：并行回收应用权限

```yaml
task:
  code: revoke-application-access
  type: integration
  effect:
    type: write_system
    target_system: multiple-business-apps
  parallel_targets:
    - crm
    - code_repository
    - finance_system
    - email
    - physical_access
  partial_failure_policy:
    allow_partial_success: true
    must_succeed:
      - identity-provider
      - email
      - code_repository
    create_ticket_for_failed_targets: true
    block_job_completion_if_must_succeed_failed: true
```

#### Task 5：创建异常工单

```yaml
task:
  code: create-exception-ticket
  type: integration
  effect:
    type: external_commit
    target_system: it-service-management
  trigger_condition:
    failed_targets_count_gt: 0
  output_schema:
    required:
      - ticket_id
      - failed_targets
      - owner_team
      - due_at
```

#### Task 6：安全复核

```yaml
task:
  code: security-review
  type: human_review
  effect:
    type: generate_artifact
  human_gate:
    required: true
    trigger:
      - must_succeed_target_failed: true
      - identity_confidence_below: 0.95
      - privileged_account_found: true
    timeout:
      seconds: 3600
      on_timeout: escalate
```

### 5.4 边缘情况测试结果

| 边缘情况 | 协议是否能判断 | 处理结果 |
|---|---|---|
| HRIS 重复发送离职事件 | 能 | termination_event_id + employee_id 幂等 |
| 员工存在两个相似账号 | 能 | 身份置信度低，进入 security-review |
| CRM API 失败 | 能 | 允许部分失败，创建异常工单 |
| IdP 回收失败 | 能 | must_succeed 失败，阻断完成并升级 |
| 离职后收到 rehire 事件 | 能，但需要额外冲突策略 | 进入人工决策 |
| 门禁系统只能人工处理 | 能 | 转 human_review / manual_action |
| 安全审核超时 | 能 | escalate 到 security_lead |

### 5.5 结论

增强协议可以跑通。

这个场景证明，仅有 `retry / skip / abort` 不够，必须有：

- SLA Protocol
- Partial Failure Protocol
- Compensation / Ticket Protocol
- Human Gate Protocol
- Audit Protocol

---

## 六、深度测试 3：合同风险审查、红线建议与客户回复

### 6.1 业务背景

销售上传客户合同。系统按公司 playbook 审查合同条款，识别风险，给出红线建议。部分高风险条款需要法务审核。若客户要求回复，系统可以草拟回复，但必须审批后才能外发。

这是一个复杂 Agentic + Workflow 混合 Job：

- Agentic 做法律文本理解、检索、对比和建议。
- Workflow 控制审批、外发和审计。

### 6.2 Job 定义

```yaml
job:
  code: contract-risk-review-and-response
  name: 合同风险审查与客户回复
  type: hybrid_agentic_workflow
  trigger:
    type: manual_or_crm_event
    source: sales_contract_upload
  business_goal: 按公司合同 playbook 审查客户合同，生成风险清单和红线建议，并在审批后回复客户
  risk_level: high
```

### 6.3 Task 详细拆解

#### Task 1：合同接收与格式化

```yaml
task:
  code: normalize-contract
  type: deterministic
  effect:
    type: generate_artifact
  input_schema:
    required:
      - contract_file_path
      - customer_id
      - deal_id
  output_schema:
    required:
      - contract_text
      - clause_index
      - document_hash
  evidence_policy:
    required: true
    required_for_fields:
      - clause_index
    accepted_sources:
      - docx_paragraph_id
      - pdf_text_span
```

#### Task 2：检索公司 playbook 和历史案例

```yaml
task:
  code: retrieve-legal-playbook
  type: integration
  effect:
    type: read_only
    target_system: legal-knowledge-base
  resource_lock:
    context_sources:
      - code: master-services-agreement-playbook
        version: 2026.05
      - code: fallback-clause-library
        version: 2026.04
  output_schema:
    required:
      - playbook_sections
      - fallback_clauses
      - policy_version
```

#### Task 3：Agentic 条款风险审查

```yaml
task:
  code: review-contract-risk
  type: agentic
  effect:
    type: generate_artifact
  skill_codes:
    - contract-risk-reviewer
    - clause-comparison
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
  output_schema:
    required:
      - overall_risk
      - clause_findings
      - missing_playbook_coverage
      - recommended_actions
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
```

#### Task 4：生成红线建议

```yaml
task:
  code: generate-redline-suggestions
  type: agentic
  effect:
    type: generate_artifact
  input_schema:
    required:
      - clause_findings
      - fallback_clauses
  output_schema:
    required:
      - redline_suggestions
      - rationale
      - citation_map
  evidence_policy:
    required: true
    required_for_fields:
      - redline_suggestions
      - rationale
    accepted_sources:
      - contract_clause_span
      - fallback_clause_id
      - playbook_policy_id
  human_gate:
    required: true
    trigger:
      - any_risk_level_at_or_above: high
      - customer_requested_non_standard_terms: true
```

#### Task 5：法务审核

```yaml
task:
  code: legal-review
  type: human_review
  effect:
    type: generate_artifact
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
    audit:
      require_reason_for_change: true
      record_old_new_value: true
```

#### Task 6：草拟客户回复

```yaml
task:
  code: draft-customer-response
  type: agentic
  effect:
    type: generate_artifact
  trigger_condition:
    customer_response_required: true
  agentic_controls:
    max_steps: 6
    max_tool_calls: 10
    max_tokens: 20000
    forbidden_actions:
      - send_external_email
      - accept_contract
      - make_legal_commitment
  output_schema:
    required:
      - response_draft
      - approved_claims_used
      - unresolved_legal_points
```

#### Task 7：审批后外发客户回复

```yaml
task:
  code: send-approved-response
  type: integration
  effect:
    type: external_commit
    target_system: customer-email
    business_impact: external_customer_communication
  risk:
    level: critical
    reason: 向客户发送合同谈判回复
  human_gate:
    required: true
    trigger:
      - always: true
    review_policy_code: legal-external-response-approval
  write_policy:
    operation: submit
    idempotency_key: deal_id + response_version + recipient_email
    dry_run_required: true
    max_affected_rows: 1
    require_before_after_snapshot: true
    retry_semantics: do_not_retry_without_delivery_status_check
  recipient_policy:
    allowed_recipients_source: crm_deal_contacts
    block_if_recipient_not_verified: true
```

### 6.4 边缘情况测试结果

| 边缘情况 | 协议是否能判断 | 处理结果 |
|---|---|---|
| 合同出现 playbook 未覆盖条款 | 能 | 标记 policy_missing，强制法务审核 |
| Agent 给出风险结论但没有引用合同原文 | 能 | evidence validation fail |
| Agent 试图发送邮件给客户 | 能 | forbidden_actions 阻断 |
| 法务修改红线建议 | 能 | review_audit 记录 old/new/reason |
| 客户邮箱不在 CRM 联系人里 | 能 | recipient_policy 阻断外发 |
| 外发 API 超时 | 能 | 查询 delivery status 后再决定是否重试 |
| playbook 后续升级 | 能 | release 和 resource_lock 记录当时版本 |
| 合同 PDF 扫描质量差 | 能 | 低证据质量触发人工审核 |

### 6.5 结论

增强协议可以跑通复杂 Agentic + Workflow 混合场景。

关键是：

- Agentic Task 只能做审查、建议和草拟。
- 外部承诺和外发必须由 workflow + human gate 控制。
- 证据链是法律类任务的必要条件。
- Agent 的 trace 不是审计事实，平台审计才是。

---

## 七、综合测试结果

| 协议块 | 发票入账 | 离职权限回收 | 合同审查与客户回复 | 是否生产必需 |
|---|---|---|---|---|
| Release Protocol | 必需 | 必需 | 必需 | 是 |
| Resource Lock Protocol | 必需 | 必需 | 必需 | 是 |
| Visibility Protocol | 必需 | 必需 | 必需 | 是 |
| Effect Protocol | 必需 | 必需 | 必需 | 是 |
| Write Safety Protocol | 必需 | 必需 | 必需 | 是，只要有写入或外发 |
| Evidence Protocol | 必需 | 中等 | 必需 | 是，尤其 AI 提取/推理 |
| Human Gate Protocol | 必需 | 必需 | 必需 | 是 |
| Data Product Contract | 推荐 | 推荐 | 可选 | 多 Job 时必需 |
| Agentic Control Protocol | 必需 | 可选 | 必需 | Agentic 场景必需 |
| Audit Protocol | 必需 | 必需 | 必需 | 是 |
| Failure Classification Protocol | 必需 | 必需 | 必需 | 是 |
| SLA / Partial Failure | 可选 | 必需 | 可选 | 安全/时效场景必需 |
| Privacy / Recipient Policy | 可选 | 可选 | 必需 | 外发/隐私场景必需 |

---

## 八、最终判断

如果只使用原来的 FlowAgent Schema、JobSpec 和 Runtime Pack：

- 可以表达复杂业务流程。
- 可以让技术方绑定 Skill / Tool / Runtime。
- 可以生成可执行 Job。
- 但无法充分判断生产风险。

如果加入本文定义的生产协议块：

- 发票三单匹配和 ERP 入账可以跑通。
- 员工离职权限回收可以跑通。
- 合同审查、红线建议和客户回复可以跑通。

真正的协议边界应该是：

```text
FlowAgent Schema
  负责：业务方案、数据契约、业务意图、技术 binding 留痕

JobSpec Release
  负责：冻结可执行版本、资源版本、DAG、Task 策略

Agent Runtime Pack
  负责：给 Worker 最小必要上下文、任务说明、输出 schema、允许能力

Platform Control Pack
  负责：validators、审批、审计、写入安全、证据校验、失败归因

Execution Result Contract
  负责：result、evidence、quality、platform_trace_ref、failure_classification
```

羽毛球比赛类比：

> FlowAgent Schema 是赛前战术板；JobSpec Release 是正式比赛名单和规则确认；Runtime Pack 是运动员上场时能看的打法提示；Platform Control Pack 是裁判、鹰眼和赛事纪律；Execution Result Contract 是比分、录像、技术统计和赛后复盘。

企业生产环境真正需要的不是“AI 更自由”，而是：

> 每一次自动化执行都可复现、可解释、可校验、可审批、可回滚、可复盘。

