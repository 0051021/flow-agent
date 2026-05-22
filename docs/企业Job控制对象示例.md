# 企业级 Job 控制对象完整示例：供应商发票三单匹配与 SAP 入账

> 本文是一个“真实感 mock”示例。企业、系统、单号、接口和人员均为虚构，但流程、风险点、控制点和字段设计按中大型企业生产环境设计。

## 1. 场景背景

某制造集团已经有一套人工为主的应付发票处理流程：

```text
供应商上传发票
  -> 财务共享中心下载发票
  -> 人工核对采购订单 PO、收货单 GR、供应商主数据
  -> 异常发票提交财务主管 / 采购 / 内控审核
  -> 人工在 SAP S/4HANA 创建应付凭证
  -> 月末审计抽查
```

FlowAgent 不改变企业原流程的业务标准，只把其中可自动化的部分结构化、自动执行、可审计。

目标不是把 80 分流程改成 100 分流程，而是把企业原本认可的 80 分流程稳定地自动跑出来。

## 2. 业务 Job 定义

```yaml
job:
  code: ap-invoice-three-way-match
  name: 供应商发票三单匹配与 SAP 应付入账
  owner_department: finance-shared-service-center
  business_owner: ap-operations-manager
  tech_owner: enterprise-automation-platform
  trigger: supplier_invoice_uploaded
  target_system: sap-s4hana-ap
```

Job 输入样例：

```yaml
job_input:
  invoice_id: INV-2026-0509-00873
  supplier_id: SUP-100238
  supplier_name: 华东精密零部件有限公司
  po_number: PO-4500098123
  invoice_file_uri: oss://finance-invoice-bucket/2026/05/INV-2026-0509-00873.pdf
  upload_channel: supplier-portal
  received_at: "2026-05-09T10:31:24+08:00"
  submitter:
    type: supplier_user
    id: supplier-user-8821
```

期望结果：

```yaml
expected_result:
  sap_ap_voucher_created: true
  sap_document_number: "5100008732"
  fiscal_year: "2026"
  audit_package_created: true
```

## 3. Task 拆分

### 3.1 Task 粒度原则

在 FlowAgent 中，Task 不应该按“技术动作”切得过细。更稳妥的定义是：

> 一个 Task = 一个最小业务验收单元。

也就是说，Task 的输出应该是业务方、审核方、技术方或审计方在真实流程中会检查、确认、追责或复用的产物。

因此，下面这些通常不应该单独成为 Task：

| 技术动作 | 更适合放在哪里 |
|---|---|
| 从对象存储读取文件 | ContextSource / Tool Call / Runtime Step |
| 查询供应商、PO、GR | 匹配 Task 内的 Tool Call 或 ContextSource |
| 数据鲜度检查 | pre_task Validator |
| dry-run | pre_commit Validator |
| 写后确认 | post_commit Validator |
| 生成 checkpoint | Runtime 内部机制 |

只有当某个中间结果会被业务方独立验收、人工修正、下游复用，或者需要单独审计追责时，才建议拆成独立 Task。

### 3.2 修正后的 Task 拆分

| 顺序 | Task code | Task 类型 | 业务验收产物 | 是否写系统 |
|---|---|---|---|---|
| 1 | `invoice-understanding` | `agentic` | 发票结构化结果 + 字段级证据 | 否 |
| 2 | `ap-match-decision` | `deterministic` | 三单匹配结论 + 异常原因 + 是否需人审 | 否 |
| 3 | `finance-exception-review` | `human_review` | 人工审批结论 + 调整原因 | 否 |
| 4 | `sap-ap-posting` | `integration` | SAP 应付凭证号 + 写入确认 | 是 |
| 5 | `audit-package-finalize` | `deterministic` | 审计包 + 复盘证据链 | 否 |

### 3.3 Runtime 内部步骤

下面这些动作仍然存在，但它们不是 FlowAgent Task，而是某个 Task 内部的 Runtime Step、Tool Call 或 Validator。

| 原动作 | 归属的新 Task | 类型 |
|---|---|---|
| 接收发票上传事件 | Job Trigger / `invoice-understanding` 输入准备 | Trigger / Context |
| 读取发票 PDF | `invoice-understanding` | Tool Call |
| OCR 识别 | `invoice-understanding` | Tool Call / Skill 内部步骤 |
| 提取字段 | `invoice-understanding` | Agentic Runtime Step |
| 字段完整性校验 | `invoice-understanding` | post_task Validator |
| 查询供应商主数据 | `ap-match-decision` | Tool Call / ContextSource |
| 查询 PO / GR | `ap-match-decision` | Tool Call / ContextSource |
| 数据质量检查 | `ap-match-decision` | pre_task Validator |
| 三单匹配规则计算 | `ap-match-decision` | Deterministic Handler |
| SAP dry-run | `sap-ap-posting` | pre_commit Validator |
| 重复发票校验 | `sap-ap-posting` | pre_commit Validator |
| SAP 正式写入 | `sap-ap-posting` | Commit Step |
| SAP 写后确认 | `sap-ap-posting` | post_commit Validator |
| 生成审计包 | `audit-package-finalize` | Deterministic Handler |

## 4. 为什么需要新增控制对象

这个 Job 不难 demo，但在生产环境中有几个高风险点：

| 风险 | 真实后果 | 需要的控制对象 |
|---|---|---|
| 发票字段提取错 | 金额、税额、供应商识别错误 | `Validator`、`AuditPolicy` |
| PO / GR 数据过期 | 用了错误的采购或收货数据 | `DataProduct` |
| 异常发票自动过账 | 财务合规事故 | `ApprovalPolicy` |
| SAP 重复入账 | 重复付款风险 | `WritePolicy` |
| 写 SAP 时网络中断 | 不知道是否已经创建凭证 | `RetryResumePolicy`、`WritePolicy`、`post_commit Validator` |
| 月末审计无法解释 | 内控无法追责 | `AuditPolicy` |

## 5. 资源注册：DataProduct

DataProduct 声明当前 Job 消费的数据资产质量、鲜度、缺失处理和责任边界。

### 5.1 供应商主数据

```yaml
data_product:
  code: supplier-master-data
  name: 供应商主数据
  owner_team: master-data-management
  source_system: sap-mdg
  schema_version: 2.1.0
  primary_key:
    - supplier_id
  freshness_sla_hours: 24
  required_fields:
    - supplier_id
    - supplier_name
    - tax_registration_no
    - payment_block
    - bank_account_status
    - review_status
  quality_rules:
    - field: review_status
      rule: equals
      value: approved
    - field: payment_block
      rule: equals
      value: false
    - field: bank_account_status
      rule: equals
      value: verified
  missing_policy:
    strategy: block
    owner_to_notify: master-data-management
  responsibility_boundary:
    producer: master-data-management
    consumer: finance-shared-service-center
    platform_role: check_freshness_and_quality_only
```

### 5.2 采购订单数据

```yaml
data_product:
  code: open-purchase-order-data
  name: 未关闭采购订单数据
  owner_team: procurement-platform-team
  source_system: sap-mm
  schema_version: 4.3.0
  primary_key:
    - po_number
    - po_item
  freshness_sla_hours: 2
  required_fields:
    - po_number
    - po_item
    - supplier_id
    - material_code
    - ordered_quantity
    - net_price
    - currency
    - open_quantity
    - po_status
  quality_rules:
    - field: po_status
      rule: in
      value:
        - open
        - partially_received
  missing_policy:
    strategy: route_to_human_review
    review_policy_code: procurement-data-exception-review
```

### 5.3 收货单数据

```yaml
data_product:
  code: goods-receipt-data
  name: 收货单数据
  owner_team: warehouse-platform-team
  source_system: sap-mm
  schema_version: 3.8.1
  primary_key:
    - po_number
    - material_document
  freshness_sla_hours: 1
  required_fields:
    - po_number
    - received_quantity
    - receipt_date
    - warehouse_code
    - quality_inspection_status
  quality_rules:
    - field: quality_inspection_status
      rule: not_in
      value:
        - rejected
        - pending
  missing_policy:
    strategy: block
    owner_to_notify: warehouse-platform-team
```

## 6. 资源注册：Validator

Validator 是平台裁判资源。Agent 可以自检，但最终采信必须由平台控制面执行。

### 6.1 发票字段完整性校验

```yaml
validator:
  code: invoice-field-completeness-validator
  name: 发票字段完整性校验
  version: 1.0.0
  type: json_schema
  default_executor: platform
  default_authority: authoritative
  phase: post_task
  input_schema:
    type: object
    required:
      - invoice_number
      - supplier_name
      - supplier_tax_no
      - total_amount
      - tax_amount
      - currency
      - invoice_date
      - evidence
  output_schema:
    type: object
    required:
      - passed
      - missing_fields
      - invalid_fields
  visibility: agent_visible_summary
```

Agent 可见摘要：

```yaml
control_projection:
  visible_validation_rules:
    - 发票号、供应商税号、总金额、税额、币种、开票日期不能为空。
    - 每个关键字段必须带来源证据，包括页码和 bounding box。
```

### 6.2 发票重复性校验

```yaml
validator:
  code: duplicate-invoice-validator
  name: SAP 发票重复校验
  version: 1.2.0
  type: http
  default_executor: external_system
  default_authority: authoritative
  endpoint: internal://sap-ap/check-duplicate-invoice
  phase: pre_commit
  input_mapping:
    supplier_id: tasks.extract-invoice-fields.output.supplier_id
    invoice_number: tasks.extract-invoice-fields.output.invoice_number
    fiscal_year: runtime.fiscal_year
  output_schema:
    type: object
    required:
      - duplicate_found
      - existing_document_number
  on_fail_default:
    strategy: block
```

### 6.3 三单匹配校验

```yaml
validator:
  code: ap-three-way-match-validator
  name: 应付发票三单匹配校验
  version: 2.4.0
  type: rules
  default_executor: platform
  default_authority: authoritative
  phase: post_task
  rules:
    supplier_must_match: true
    po_must_be_open: true
    currency_must_match: true
    amount_tolerance:
      type: percentage_or_absolute
      percentage: 0.5
      absolute_amount: 10.00
    tax_amount_tolerance:
      absolute_amount: 1.00
    received_quantity_must_cover_invoice_quantity: true
  output_schema:
    type: object
    required:
      - passed
      - exception_codes
      - requires_review
      - match_details
```

### 6.4 SAP dry-run 校验

```yaml
validator:
  code: sap-ap-dry-run-validator
  name: SAP 应付入账模拟校验
  version: 1.1.0
  type: http
  default_executor: external_system
  default_authority: authoritative
  endpoint: internal://sap-ap/simulate-voucher
  phase: pre_commit
  timeout_seconds: 20
  output_schema:
    type: object
    required:
      - simulation_passed
      - sap_messages
      - posting_payload_hash
```

### 6.5 SAP 提交后确认校验

```yaml
validator:
  code: sap-ap-voucher-exists-validator
  name: SAP 应付凭证存在性确认
  version: 1.0.0
  type: http
  default_executor: external_system
  default_authority: authoritative
  endpoint: internal://sap-ap/get-voucher-by-idempotency-key
  phase: post_commit
  output_schema:
    type: object
    required:
      - exists
      - sap_document_number
      - fiscal_year
      - posting_status
```

## 7. 资源注册：ApprovalPolicy

ApprovalPolicy 控制“什么时候必须人批准”，不是普通人工审核说明。

```yaml
approval_policy:
  code: finance-ap-posting-approval
  name: 应付发票入账审批策略
  version: 1.3.0
  applies_to:
    job_code: ap-invoice-three-way-match
    task_codes:
      - finance-exception-review
      - post-sap-ap-voucher
  triggers:
    - condition: total_amount_above
      value: 100000
      currency: CNY
    - condition: match_result_equals
      value: exception
    - condition: extraction_confidence_below
      value: 0.92
    - condition: supplier_bank_status_not_equals
      value: verified
  approver_roles:
    - finance-ap-supervisor
    - internal-control-specialist
  approval_actions:
    - approve
    - reject
    - request_more_info
    - approve_with_adjustment
  require_reason_for_adjustment: true
  timeout_seconds: 86400
  on_timeout:
    strategy: escalate
    escalate_to:
      - finance-shared-service-manager
```

真实运行时，审批单会展示：

```yaml
review_ticket:
  ticket_id: RT-AP-20260509-00031
  reason:
    - 发票总金额 128,430.00 CNY 超过自动入账阈值
    - 三单匹配存在税额差异 0.86 CNY，在容差内但需主管确认
  approver_group:
    - finance-ap-supervisor
  evidence:
    - invoice_pdf_snapshot
    - extracted_fields_with_bounding_boxes
    - po_gr_match_details
    - sap_dry_run_result
```

## 8. 资源注册：WritePolicy

WritePolicy 控制写系统防事故。

```yaml
write_policy:
  code: sap-ap-safe-write
  name: SAP 应付入账安全写入策略
  version: 1.2.0
  target_system: sap-s4hana-ap
  applies_to_task_type: integration
  effect_type: write_system
  dry_run_required: true
  require_approval_before_commit: conditional
  idempotency:
    required: true
    key_template: "{{job_run_id}}:{{supplier_id}}:{{invoice_number}}:{{fiscal_year}}"
    conflict_strategy: query_existing_then_hold
  require_pre_commit_validators:
    - duplicate-invoice-validator
    - sap-ap-dry-run-validator
  commit_confirmation:
    required: true
    validator_code: sap-ap-voucher-exists-validator
  request_snapshot:
    record_before_commit_payload: true
    record_payload_hash: true
  on_uncertain_commit:
    strategy: hold_and_human_review
    review_policy_code: sap-commit-uncertain-review
  forbidden:
    - commit_without_dry_run
    - commit_without_idempotency_key
    - commit_when_duplicate_found
```

这条策略意味着：`post-sap-ap-voucher` 不能直接调用 SAP 写入。平台必须先确认 dry-run、重复校验、审批和幂等键都满足。

## 9. 资源注册：RetryResumePolicy

RetryResumePolicy 控制中断恢复、重试条件、checkpoint 粒度和最大次数。

```yaml
retry_resume_policy:
  code: ap-invoice-safe-resume
  name: 应付发票处理安全恢复策略
  version: 1.0.0
  max_attempts_per_task: 3
  retry_on:
    - worker_crash
    - network_timeout
    - external_system_5xx
    - rate_limited
  do_not_retry_on:
    - schema_invalid
    - business_rule_failed
    - permission_denied
    - duplicate_invoice_detected
  checkpoint_required_before:
    - planning
    - tool_call
    - external_read
    - pre_commit
    - external_write
    - post_commit
  resume_from:
    strategy: latest_authoritative_checkpoint
  on_resume:
    revalidate_context_freshness: true
    revalidate_plan_hash: true
    rerun_pre_commit_validators: true
    recheck_idempotency: true
  unsafe_resume:
    when_commit_state_unknown: hold_and_human_review
  checkpoint_retention_days: 90
```

## 10. 资源注册：AuditPolicy

AuditPolicy 控制要记录什么、保留多久、是否记录前后对比。

```yaml
audit_policy:
  code: finance-ap-audit-standard
  name: 财务应付自动化审计标准
  version: 1.1.0
  record:
    job_input_snapshot: true
    source_file_digest: true
    extracted_fields: true
    field_level_evidence: true
    data_product_versions: true
    validator_results: true
    human_review_decisions: true
    approval_reason: true
    dry_run_result: true
    commit_request_response: true
    before_after_data: true
    retry_resume_events: true
    tool_call_trace: true
    secret_access_refs: true
  redaction:
    mask_bank_account: true
    mask_tax_registration_no: partial
    mask_secret_values: true
  retention_days: 2555
  export_format:
    - json
    - pdf_summary
```

## 11. JobSpec 中如何引用这些对象

JobSpec 不展开所有规则，只引用已经注册好的资源 code / version。

```yaml
spec_version: task-platform.job.v2
kind: JobSpec

metadata:
  code: ap-invoice-three-way-match
  name: 供应商发票三单匹配与 SAP 应付入账

defaults:
  context_policy_code: ap-invoice-processing-default
  audit_policy_code: finance-ap-audit-standard
  retry_resume_policy_code: ap-invoice-safe-resume

tasks:
  - code: receive-invoice
    name: 接收发票上传事件
    type: integration
    runtime_profile_code: supplier-portal-http-worker
    instruction: 接收供应商门户上传的发票事件，生成 Job 输入快照。
    output_schema:
      type: object
      required:
        - invoice_id
        - invoice_file_uri
        - source_event_id

  - code: fetch-invoice-file
    name: 读取发票文件
    type: integration
    runtime_profile_code: object-storage-worker
    tool_codes:
      - invoice-file-fetch
    secret_refs:
      - finance-oss-readonly-secret
    instruction: 从对象存储读取发票 PDF，计算文件摘要并生成只读快照。
    output_schema:
      type: object
      required:
        - file_snapshot_uri
        - file_sha256
        - page_count

  - code: extract-invoice-fields
    name: 提取发票字段
    type: agentic
    runtime_profile_code: openclaw-finance-extraction
    skill_codes:
      - invoice-field-extractor
    tool_codes:
      - pdf-reader
      - ocr-reader
    instruction: 从发票 PDF 中提取发票号、供应商、税号、金额、税额、币种、开票日期和 PO 号，每个字段必须给出页码与坐标证据。
    evidence_policy:
      required_evidence_types:
        - pdf_text_span
        - pdf_bounding_box
      min_confidence: 0.90
    control_bindings:
      validators:
        - code: invoice-field-completeness-validator
          version: 1.0.0
          phase: post_task
          executor: platform
          authority: authoritative
          on_fail:
            strategy: human_fix_and_retry
            max_attempts: 2
    output_schema:
      type: object
      required:
        - invoice_number
        - supplier_name
        - supplier_tax_no
        - total_amount
        - tax_amount
        - currency
        - invoice_date
        - confidence
        - evidence

  - code: query-reference-data
    name: 查询主数据、PO、GR
    type: integration
    runtime_profile_code: sap-readonly-http-worker
    tool_codes:
      - sap-supplier-query
      - sap-po-query
      - sap-gr-query
    secret_refs:
      - sap-readonly-api-secret
    data_product_refs:
      - supplier-master-data
      - open-purchase-order-data
      - goods-receipt-data
    instruction: 根据供应商、PO 和发票信息查询供应商主数据、采购订单和收货单。
    output_schema:
      type: object
      required:
        - supplier_master
        - purchase_order
        - goods_receipts
        - data_product_versions

  - code: data-quality-gate
    name: 数据质量门禁
    type: deterministic
    runtime_profile_code: rules-worker-default
    instruction: 检查供应商、PO、GR 数据是否满足当前发票自动匹配要求。
    data_product_refs:
      - supplier-master-data
      - open-purchase-order-data
      - goods-receipt-data
    output_schema:
      type: object
      required:
        - passed
        - data_quality_issues
        - requires_review

  - code: three-way-match
    name: 三单匹配
    type: deterministic
    runtime_profile_code: rules-worker-default
    instruction: 按企业 AP 规则匹配发票、PO、GR，输出匹配结果和异常代码。
    control_bindings:
      validators:
        - code: ap-three-way-match-validator
          version: 2.4.0
          phase: post_task
          executor: platform
          authority: authoritative
          on_fail:
            strategy: route_to_review
    output_schema:
      type: object
      required:
        - match_result
        - exception_codes
        - requires_review
        - match_details

  - code: finance-exception-review
    name: 财务异常审核
    type: human_review
    review_policy_code: finance-ap-posting-approval
    instruction: 对高金额、低置信度、匹配异常或数据质量异常发票进行人工审核。
    output_schema:
      type: object
      required:
        - decision
        - reviewer
        - reason

  - code: sap-ap-dry-run
    name: SAP 入账模拟
    type: integration
    runtime_profile_code: sap-ap-http-worker
    tool_codes:
      - sap-ap-simulate-posting
    secret_refs:
      - sap-ap-write-secret
    instruction: 生成 SAP AP 入账 payload 并调用模拟接口，不创建正式凭证。
    control_bindings:
      validators:
        - code: sap-ap-dry-run-validator
          version: 1.1.0
          phase: pre_commit
          executor: external_system
          authority: authoritative
          on_fail:
            strategy: block
    output_schema:
      type: object
      required:
        - simulation_passed
        - posting_payload
        - posting_payload_hash

  - code: post-sap-ap-voucher
    name: 创建 SAP 应付凭证
    type: integration
    runtime_profile_code: sap-ap-http-worker
    tool_codes:
      - sap-ap-create-voucher
    secret_refs:
      - sap-ap-write-secret
    write_policy_code: sap-ap-safe-write
    retry_resume_policy_code: ap-invoice-safe-resume
    audit_policy_code: finance-ap-audit-standard
    instruction: 在所有 pre_commit 校验和审批通过后，创建 SAP 应付凭证。
    control_bindings:
      validators:
        - code: duplicate-invoice-validator
          version: 1.2.0
          phase: pre_commit
          executor: external_system
          authority: authoritative
          on_fail:
            strategy: block
        - code: sap-ap-dry-run-validator
          version: 1.1.0
          phase: pre_commit
          executor: external_system
          authority: authoritative
          on_fail:
            strategy: block
        - code: sap-ap-voucher-exists-validator
          version: 1.0.0
          phase: post_commit
          executor: external_system
          authority: authoritative
          on_fail:
            strategy: hold_and_human_review
    output_schema:
      type: object
      required:
        - sap_document_number
        - fiscal_year
        - posting_status
        - idempotency_key

  - code: confirm-and-audit
    name: 确认结果并生成审计包
    type: deterministic
    runtime_profile_code: audit-package-worker
    audit_policy_code: finance-ap-audit-standard
    instruction: 汇总输入、证据、校验、审批、SAP 写入结果，生成审计包。
    output_schema:
      type: object
      required:
        - audit_package_uri
        - audit_summary

flow:
  - from: null
    to: receive-invoice
  - from: receive-invoice
    to: fetch-invoice-file
  - from: fetch-invoice-file
    to: extract-invoice-fields
  - from: extract-invoice-fields
    to: query-reference-data
  - from: query-reference-data
    to: data-quality-gate
  - from: data-quality-gate
    to: three-way-match
  - from: three-way-match
    to: finance-exception-review
    condition:
      path: requires_review
      equals: true
  - from: three-way-match
    to: sap-ap-dry-run
    condition:
      path: requires_review
      equals: false
  - from: finance-exception-review
    to: sap-ap-dry-run
    condition:
      path: decision
      equals: approve
  - from: sap-ap-dry-run
    to: post-sap-ap-voucher
  - from: post-sap-ap-voucher
    to: confirm-and-audit
```

## 12. 运行时：正常路径示例

### 12.1 `extract-invoice-fields` 输出

```yaml
task_result:
  task_code: extract-invoice-fields
  status: completed
  output:
    invoice_number: FP-20260509-3371
    supplier_name: 华东精密零部件有限公司
    supplier_tax_no: 91310000MA1K337100
    supplier_id: SUP-100238
    po_number: PO-4500098123
    total_amount: 128430.00
    tax_amount: 14773.54
    currency: CNY
    invoice_date: "2026-05-08"
    confidence: 0.96
    evidence:
      invoice_number:
        page: 1
        text_span: "发票号码：FP-20260509-3371"
        bounding_box: [104, 88, 312, 116]
      total_amount:
        page: 1
        text_span: "价税合计：壹拾贰万捌仟肆佰叁拾元整 ¥128430.00"
        bounding_box: [388, 612, 721, 646]
```

平台执行 `invoice-field-completeness-validator`：

```yaml
validator_result:
  code: invoice-field-completeness-validator
  phase: post_task
  passed: true
  authority: authoritative
```

### 12.2 `three-way-match` 输出

```yaml
task_result:
  task_code: three-way-match
  status: completed
  output:
    match_result: exception
    requires_review: true
    exception_codes:
      - AMOUNT_WITHIN_TOLERANCE_BUT_HIGH_VALUE
      - TAX_DIFF_WITHIN_TOLERANCE
    match_details:
      supplier_match: true
      currency_match: true
      invoice_total_amount: 128430.00
      po_remaining_amount: 128430.00
      gr_received_amount: 128430.00
      tax_diff: 0.86
      tolerance_passed: true
```

因为金额超过 100000 CNY，命中 `finance-ap-posting-approval`，平台创建人工审批单。

### 12.3 人工审批结果

```yaml
review_ticket_result:
  ticket_id: RT-AP-20260509-00031
  task_code: finance-exception-review
  decision: approve
  reviewer:
    id: user-finance-1027
    role: finance-ap-supervisor
  reason: 税额差异 0.86 元在容差内，PO、GR、供应商均一致，同意入账。
  reviewed_at: "2026-05-09T14:18:09+08:00"
```

### 12.4 SAP 写入前

平台生成 idempotency key：

```yaml
idempotency_key: "job-run-AP-20260509-00873:SUP-100238:FP-20260509-3371:2026"
```

pre_commit validators：

```yaml
pre_commit_results:
  - code: duplicate-invoice-validator
    passed: true
    duplicate_found: false
  - code: sap-ap-dry-run-validator
    passed: true
    simulation_passed: true
    posting_payload_hash: sha256:posting-payload-873
```

正式写入 SAP：

```yaml
commit_result:
  task_code: post-sap-ap-voucher
  status: completed
  sap_document_number: "5100008732"
  fiscal_year: "2026"
  posting_status: posted
```

post_commit validator：

```yaml
validator_result:
  code: sap-ap-voucher-exists-validator
  phase: post_commit
  passed: true
  exists: true
  sap_document_number: "5100008732"
  fiscal_year: "2026"
```

## 13. 运行时：小地方中断后如何恢复

假设中断发生在最危险的位置：

```text
Task: post-sap-ap-voucher
步骤: 已向 SAP 发送 create voucher 请求
异常: HTTP 504 Gateway Timeout
问题: 平台不知道 SAP 到底有没有创建成功
```

### 13.1 中断前 checkpoint

```yaml
checkpoint:
  checkpoint_id: cp-post-sap-004
  job_run_id: job-run-AP-20260509-00873
  task_run_id: task-run-post-sap-009
  task_code: post-sap-ap-voucher
  stage: external_write
  created_at: "2026-05-09T14:21:33+08:00"
  completed_steps:
    - build_posting_payload
    - compute_payload_hash
    - generate_idempotency_key
    - duplicate_invoice_validator
    - sap_ap_dry_run_validator
    - human_approval_verified
  pending_steps:
    - commit_confirmation
    - post_commit_validator
    - audit_record_finalize
  side_effects:
    external_write_attempted: true
    external_write_confirmed: false
    idempotency_key: "job-run-AP-20260509-00873:SUP-100238:FP-20260509-3371:2026"
  artifacts:
    posting_payload_snapshot: artifact://posting-payload-873.json
    dry_run_result: artifact://sap-dry-run-873.json
```

### 13.2 平台根据 RetryResumePolicy 判断

```yaml
interruption:
  error_type: network_timeout
  retryable: true
  but_commit_state_unknown: true

policy_decision:
  retry_resume_policy_code: ap-invoice-safe-resume
  decision: resume_with_commit_confirmation_first
  reason:
    - network_timeout 属于 retry_on
    - 当前 stage 是 external_write
    - external_write_attempted=true
    - external_write_confirmed=false
    - 必须先查 SAP，不能直接重复提交
```

### 13.3 恢复时重新生成 Runtime Pack

```yaml
resume_context:
  resume_mode: from_checkpoint
  checkpoint_id: cp-post-sap-004
  task_code: post-sap-ap-voucher
  completed_steps:
    - duplicate_invoice_validator
    - sap_ap_dry_run_validator
    - human_approval_verified
  must_do_before_retry:
    - recheck_idempotency
    - run_post_commit_confirmation
  forbidden_actions:
    - create_new_voucher_before_confirmation
    - regenerate_idempotency_key
  reusable_artifacts:
    - artifact://posting-payload-873.json
    - artifact://sap-dry-run-873.json
```

### 13.4 恢复执行结果 A：SAP 已经创建成功

平台调用 `sap-ap-voucher-exists-validator`：

```yaml
post_commit_confirmation:
  exists: true
  sap_document_number: "5100008732"
  fiscal_year: "2026"
  posting_status: posted
```

平台处理：

```yaml
resume_result:
  action: do_not_retry_commit
  task_status: completed
  completed_by: post_commit_confirmation
  audit_event:
    type: recovered_after_uncertain_commit
    message: SAP 已创建凭证，平台补齐 post_commit 和审计记录。
```

### 13.5 恢复执行结果 B：SAP 未创建

如果 SAP 查询结果为不存在：

```yaml
post_commit_confirmation:
  exists: false
```

平台处理：

```yaml
resume_result:
  action: rerun_pre_commit_then_commit
  required_steps:
    - duplicate_invoice_validator
    - sap_ap_dry_run_validator
    - create_voucher_with_same_idempotency_key
```

注意：即使重试，也必须使用同一个 `idempotency_key`，不能生成新的 key。

### 13.6 恢复执行结果 C：SAP 状态仍不确定

如果 SAP 查询接口也异常：

```yaml
post_commit_confirmation:
  status: unknown
  error_type: sap_query_timeout
```

平台处理：

```yaml
resume_result:
  action: hold_and_human_review
  reason: commit_state_unknown
  review_policy_code: sap-commit-uncertain-review
  forbidden_actions:
    - automatic_retry_commit
```

这就是企业生产环境需要的“可控恢复”：不是一出错就重跑，而是先判断副作用是否已经发生。

## 14. Control Pack 如何物化

JobSpec 里只是引用：

```yaml
write_policy_code: sap-ap-safe-write
retry_resume_policy_code: ap-invoice-safe-resume
audit_policy_code: finance-ap-audit-standard
```

TaskRun 开始时，task-platform 会物化 Control Pack：

```yaml
control_pack:
  job_run_id: job-run-AP-20260509-00873
  task_run_id: task-run-post-sap-009
  task_code: post-sap-ap-voucher
  validators:
    pre_commit:
      - duplicate-invoice-validator@1.2.0
      - sap-ap-dry-run-validator@1.1.0
    post_commit:
      - sap-ap-voucher-exists-validator@1.0.0
  write_policy:
    code: sap-ap-safe-write
    dry_run_required: true
    idempotency_required: true
    commit_confirmation_required: true
  retry_resume_policy:
    code: ap-invoice-safe-resume
    checkpoint_required_before:
      - pre_commit
      - external_write
      - post_commit
  audit_policy:
    code: finance-ap-audit-standard
    record_commit_request_response: true
    record_retry_resume_events: true
  secret_resolution:
    sap-ap-write-secret:
      provider: env
      env_key: SAP_AP_WRITE_API_KEY
      visible_to_runtime: false
```

Worker / Agent 不拿完整 Control Pack。Agent 只拿可见摘要：

```yaml
control_projection:
  visible_write_awareness:
    - 当前 Task 是写 SAP 的高风险动作。
    - 不允许在 dry-run、重复校验、审批完成前提交。
    - 如果提交状态不确定，不能自行重复提交。
  visible_validation_rules:
    - 必须保持 idempotency_key 不变。
    - 必须输出 SAP document number、fiscal year、posting_status。
```

## 15. 最终审计包

`confirm-and-audit` 生成的审计包摘要：

```yaml
audit_package:
  uri: audit://ap-invoice-three-way-match/job-run-AP-20260509-00873
  job_run_id: job-run-AP-20260509-00873
  business_key:
    invoice_number: FP-20260509-3371
    supplier_id: SUP-100238
    po_number: PO-4500098123
  result:
    sap_document_number: "5100008732"
    fiscal_year: "2026"
    posting_status: posted
  evidence_summary:
    source_invoice_file_sha256: sha256:invoice-file-873
    extraction_confidence: 0.96
    field_evidence_count: 8
    data_product_versions:
      supplier-master-data: 2.1.0
      open-purchase-order-data: 4.3.0
      goods-receipt-data: 3.8.1
    validators:
      invoice-field-completeness-validator: passed
      ap-three-way-match-validator: passed_with_review
      duplicate-invoice-validator: passed
      sap-ap-dry-run-validator: passed
      sap-ap-voucher-exists-validator: passed
    human_reviews:
      - ticket_id: RT-AP-20260509-00031
        decision: approve
        reviewer_role: finance-ap-supervisor
    retry_resume_events:
      - none
  retention_until: "2033-05-09"
```

## 16. 这份示例对应的协议结论

这几个新增对象不是为了让协议复杂，而是为了让企业生产 Job 能回答清楚：

| 对象 | 在这个 Job 中回答的问题 |
|---|---|
| `DataProduct` | PO、GR、供应商主数据是否新鲜、可信、谁负责？ |
| `Validator` | 字段提取、三单匹配、重复校验、dry-run、写后确认由谁裁判？ |
| `ApprovalPolicy` | 高金额、异常、低置信度时谁审批？ |
| `WritePolicy` | 写 SAP 前要满足什么条件，怎么防重复入账？ |
| `RetryResumePolicy` | 中断后从哪个 checkpoint 恢复，哪些情况不能自动重试？ |
| `AuditPolicy` | 审计需要哪些证据，保存多久，如何脱敏？ |

如果没有这些对象，这个 Job 仍然可以 demo 跑通；但无法稳定进入中大型企业生产环境。
