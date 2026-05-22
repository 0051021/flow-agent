# FlowAgent 协议压力测试

> 目的：用真实企业级复杂业务，验证增强版协议是否能跑通：
>
> `FlowAgent Schema -> 编译后的 JobSpec Release -> Agent Runtime Pack + Platform Control Pack -> 执行 -> 校验 -> 审计 -> 复盘改进`
>
> 这份文档不是在验证“旧协议是否已经够用”。它是按我们刚刚讨论的**增强版协议**去跑，然后反推：哪些字段是生产必需，哪些只是后续增强。

---

## 1. 测试基线：按哪版协议跑

本次压力测试使用的是“增强版协议”，不是最早那版只包含 Schema / JobSpec / Runtime Pack 的协议。

旧协议已经有的能力：

- 业务翻译生成 FlowAgent Schema。
- 技术方确认 Skill / Tool / Secret / Runtime / ReviewPolicy binding。
- 映射器生成 JobSpec。
- Runtime Pack 给 Agent 或 Worker 执行。
- `output_schema`、`qualityHint`、`humanInteraction`、`errorStrategy` 等基础质量控制。

本次测试额外假设新增这些生产护栏：

```yaml
release:
  id: string
  source_schema_id: string
  source_schema_version: string
  compiler_version: string
  jobspec_version: string
  runtime_pack_protocol: string
  approved_by:
    business: string
    tech: string
  artifact_digest: string

resource_lock:
  skills:
    - code: string
      version: string
      digest?: string
  tools:
    - code: string
      version: string
  runtime_profiles:
    - code: string
      version: string
  review_policies:
    - code: string
      version: string

visibility:
  agent_visible:
    - task
    - context
    - output_schema
    - skills
  platform_only:
    - validation_rules
    - validators
    - approval_policy
    - audit_policy

risk:
  level: low | medium | high | critical
  reason: string
  required_controls: string[]

effect:
  type: read_only | generate_artifact | notify | write_system | external_commit
  target_system?: string

write_policy:
  idempotency_key?: string
  dry_run_required?: boolean
  max_affected_rows?: number
  require_before_after_snapshot?: boolean
  on_conflict?: abort | human_review | use_latest | create_new_version
  rollback?: { strategy: string }

evidence_policy:
  required: boolean
  required_for_fields?: string[]
  accepted_sources?: string[]
  require_human_review_when?: object[]

audit_policy:
  platform_trace_required: boolean
  record_tool_calls: boolean
  record_secret_access: boolean
  record_before_after_data: boolean
  retention_days: number

failure_classification:
  enabled: boolean
  categories:
    - input_quality_issue
    - skill_capability_gap
    - business_rule_missing
    - external_system_failure
    - validation_rule_gap
    - human_review_timeout
    - runtime_budget_exceeded
    - write_conflict
```

所以答案先说清楚：

> 我是按增强版协议去跑的。结论不是“跑完才发现缺生产护栏”，而是：如果把这些生产护栏纳入协议，大部分复杂业务可以跑通；如果只用旧协议，只能描述流程，但生产可控性不够。

---

## 2. 四层产物怎么分工

为了避免“什么都塞进 Schema 或 Runtime Pack”，本次测试按四层分工。

| 层 | 作用 | 谁看 | 典型内容 |
|---|---|---|---|
| FlowAgent Schema | 业务方案和技术 binding 的设计态记录 | 业务方、技术方、编译器 | 节点、数据契约、资源 binding、业务意图 |
| JobSpec Release | 可执行发布版本 | task-platform / Scheduler | 冻结后的任务、版本、资源、DAG、策略 |
| Agent Runtime Pack | Worker 执行所需最小信息 | Agent / Worker | 任务说明、输入、输出 schema、可用 Skill / Tool |
| Platform Control Pack | 平台控制面规则 | 平台校验器、审计、审批系统 | validators、审批规则、审计规则、写入保护、失败归因 |

关键原则：

- Agent 不是裁判，validators 不应该作为 Agent 可读可改的内容暴露。
- Skill 能声明“我能提供什么证据”，但 Task / 平台决定“哪些证据是必须的”。
- JobSpec Release 必须冻结版本，不应该依赖 `latest`。
- 写系统、发外部邮件、提交外部平台这类动作必须显式声明 `effect` 和 `write_policy`。

---

## 3. 测试场景总览

| ID | 场景 | 类型 | 主要风险 | 增强协议下是否能跑 |
|---|---|---|---|---|
| S1 | GSDS PDF 入库主数据库 | Workflow + 单点 Agentic | AI 提取、证据链、写主库 | 能跑，需要 evidence + write_policy |
| S2 | 应付发票三单匹配 | Workflow | 重复发票、ERP 入账、金额容差 | 能跑，需要幂等和审批门 |
| S3 | 员工离职权限回收 | Workflow | 时效、安全、部分系统失败 | 能跑，需要 SLA 和部分失败策略 |
| S4 | 合同风险审查和红线建议 | Agentic | 法律推理、引用证据、幻觉 | 能跑，需要引用证据和人工审批 |
| S5 | 受监管客户投诉处理 | Agentic + Workflow 外壳 | PII、监管时限、外部回复 | 能跑，需要隐私和外发审批 |
| S6 | 长期营销活动优化 | Hybrid Agentic | 动态调整、预算、Skill 授权 | 可跑，但必须强化变更控制 |

---

## 4. S1：GSDS PDF 入库主数据库

### 业务描述

企业上传 GSDS / SDS PDF。系统下载文件，解析化学品安全字段，人工审核关键字段，然后按 `BBN + PART` 写入 GSDS 主数据库。

### Job 类型

Workflow。中间的 PDF 解析是 Agentic Task，前后是 integration / human_review。

### Task 拆解

| Task | 类型 | effect | 说明 |
|---|---|---|---|
| 下载 PDF | integration | read_only | 从 SharePoint 下载文件 |
| 解析 GSDS PDF | agentic | generate_artifact | 提取结构化字段和证据 |
| 人工审核 | human_review | generate_artifact | 对照源 PDF 修正 |
| 写入主数据库 | integration | write_system | 按 BBN + PART upsert |

### 需要的协议字段

```yaml
tasks:
  - code: parse-gsds
    evidence_policy:
      required: true
      required_for_fields:
        - bbn
        - part
        - un_number
        - hazard_class
        - density
      accepted_sources:
        - document_text_span
        - pdf_bounding_box
      require_human_review_when:
        - confidence_below: 0.85
        - evidence_missing: true

  - code: upsert-gsds-master
    risk:
      level: high
      reason: 写入 GSDS 主数据库
      required_controls:
        - idempotency_key
        - dry_run
        - before_after_snapshot
    effect:
      type: write_system
      target_system: gsds-master-db
    write_policy:
      idempotency_key: source_file_hash + bbn + part
      dry_run_required: true
      max_affected_rows: 1
      require_before_after_snapshot: true
      on_conflict: human_review
      rollback:
        strategy: restore_previous_record_snapshot
```

### 边缘情况

| 边缘情况 | 增强协议下的处理 |
|---|---|
| PDF 是扫描件，OCR 置信度低 | 解析结果标记 partial，强制 human_review |
| PDF 里缺少必填字段 | 输出 missing_reason，阻止写库 |
| 同一个 PDF 被重复上传 | idempotency_key 防止重复写入 |
| 数据库里已有更新版本 | 触发 conflict，进入人工确认 |
| upsert 影响超过 1 行 | 平台阻断，归因为 `write_conflict` |
| Agent 给出字段值但没有来源证据 | 校验失败，进入人工审核或失败归因 |

### 结论

增强协议能跑通。旧协议能表达流程，但对写主库和证据链控制不够。

---

## 5. S2：应付发票三单匹配

### 业务描述

财务收到供应商发票。系统提取发票字段，匹配采购订单 PO 和收货记录 GR，按容差规则判断是否可入账，异常进入人工审核，最终写入 ERP 应付模块。

### Job 类型

Workflow。PDF 提取可能是 Agentic，其余多为 deterministic / integration。

### Task 拆解

| Task | 类型 | effect | 说明 |
|---|---|---|---|
| 收取发票邮件/PDF | integration | read_only | 拉取附件和邮件元数据 |
| 提取发票字段 | agentic / deterministic | generate_artifact | OCR 或结构化解析 |
| 查询 PO 和收货记录 | integration | read_only | 访问 ERP |
| 执行容差规则 | deterministic | generate_artifact | 金额、数量、税率校验 |
| 人工异常审核 | human_review | generate_artifact | 处理不匹配项 |
| ERP 入账 | integration | write_system | 创建应付账款记录 |

### 需要的协议字段

```yaml
data_product_contract:
  invoice_identity:
    unique_key:
      - supplier_id
      - invoice_number
      - invoice_date
      - invoice_total
    duplicate_window_days: 365

tasks:
  - code: apply-tolerance-rules
    deterministic_rules:
      - id: price_tolerance
        expression: abs(invoice.unit_price - po.unit_price) <= po.unit_price * 0.02
      - id: quantity_tolerance
        expression: invoice.quantity <= goods_receipt.received_quantity

  - code: post-invoice
    risk:
      level: critical
      reason: 创建财务入账记录
      required_controls:
        - duplicate_check
        - approval_gate
        - dry_run
        - idempotency_key
    effect:
      type: write_system
      target_system: erp-ap-module
    write_policy:
      idempotency_key: supplier_id + invoice_number + invoice_date + invoice_total
      dry_run_required: true
      max_affected_rows: 1
      require_before_after_snapshot: true
      on_conflict: abort
```

### 边缘情况

| 边缘情况 | 增强协议下的处理 |
|---|---|
| 同一张发票被邮件重复发送 | duplicate check 阻断第二次入账 |
| 供应商更换发票格式 | 解析失败归因为 `input_quality_issue` 或 `skill_capability_gap` |
| PO 存在但收货记录缺失 | 进入人工异常审核，不允许自动入账 |
| 税额有小数误差 | deterministic tolerance rule 判定 |
| ERP API 超时但实际已入账 | retry 前先用 idempotency_key 查询，防止重复入账 |
| 人工改了应付金额 | review_audit 记录 old/new value 和修改原因 |

### 结论

增强协议能跑通。关键是 `effect`、`write_policy`、`data_product_contract`。旧协议的普通 retry 不足以保护财务写入。

---

## 6. S3：员工离职权限回收

### 业务描述

HR 标记员工离职后，系统在规定时间内回收身份系统、邮箱、CRM、代码仓库、财务系统、门禁系统等权限。部分系统可能失败或需要人工确认。

### Job 类型

Workflow。主要是 integration / deterministic，强调 SLA、部分失败和补偿。

### Task 拆解

| Task | 类型 | effect | 说明 |
|---|---|---|---|
| 接收 HR 离职事件 | integration | read_only | HRIS 事件触发 |
| 解析员工身份 | integration | read_only | 映射 employee_id 到各系统账号 |
| 回收 IdP / SSO | integration | write_system | 最高优先级 |
| 回收应用权限 | integration | write_system | 多系统并行 |
| 禁用邮箱转发 | integration | write_system | 防止数据泄露 |
| 创建异常工单 | integration | external_commit | 失败项进入 IT 工单 |
| 安全复核 | human_review | generate_artifact | 确认关键权限已移除 |

### 需要的协议字段

```yaml
sla_policy:
  critical_deadline_seconds: 900
  escalation_roles:
    - security_lead
    - it_ops_manager

tasks:
  - code: revoke-idp
    risk:
      level: critical
      reason: 移除员工核心访问权限
      required_controls:
        - idempotency_key
        - platform_audit
        - compensation_plan
    effect:
      type: write_system
      target_system: identity-provider
    write_policy:
      idempotency_key: employee_id + termination_event_id + "idp"
      dry_run_required: false
      require_before_after_snapshot: true
      on_conflict: use_latest

  - code: revoke-app-access
    partial_failure_policy:
      allow_partial_success: true
      must_succeed:
        - identity-provider
        - email
      create_ticket_for_failed_targets: true
```

### 边缘情况

| 边缘情况 | 增强协议下的处理 |
|---|---|
| HR 发送重复离职事件 | 幂等键防止重复执行造成异常 |
| 员工有多个身份账号 | 低置信度身份匹配进入安全人工审核 |
| CRM API 不可用 | 核心权限回收继续，CRM 创建异常工单 |
| IdP 回收失败 | 立即升级，不允许静默部分成功 |
| 离职后又收到 rehire 事件 | 冲突进入人工决策 |
| 门禁系统只能人工操作 | 生成 human_review / manual_action |

### 结论

增强协议能跑通。旧协议里的 `errorStrategy` 太粗，无法表达“哪些系统必须成功、哪些可以挂工单补偿”。

---

## 7. S4：合同风险审查和红线建议

### 业务描述

法务上传客户合同。系统按公司合同 playbook 审查条款，识别偏离项，生成风险等级和红线建议，高风险条款交给法务确认。

### Job 类型

Agentic。需要检索、理解、推理、引用证据和人审。

### Task 拆解

| Task | 类型 | effect | 说明 |
|---|---|---|---|
| 合同格式化 | deterministic | generate_artifact | DOCX/PDF 转条款结构 |
| 检索 playbook | integration | read_only | 拉取公司标准条款 |
| 审查条款 | agentic | generate_artifact | 多步法律推理 |
| 生成红线建议 | agentic | generate_artifact | 必须引用条款和 playbook |
| 法务审核 | human_review | generate_artifact | 高风险必须人工确认 |

### 需要的协议字段

```yaml
agentic_controls:
  max_steps: 12
  max_tool_calls: 40
  max_tokens: 60000
  allowed_tools:
    - contract-parser
    - legal-playbook-search
    - clause-comparison
  forbidden_actions:
    - send_external_email
    - accept_contract
    - update_crm_stage
  ask_human_when:
    - confidence_below: 0.75
    - playbook_policy_missing: true
    - risk_level_at_or_above: high

evidence_policy:
  required: true
  required_for_fields:
    - clause_id
    - risk_level
    - recommendation
    - proposed_redline
  accepted_sources:
    - contract_clause_span
    - playbook_policy_id

human_review:
  required_for:
    - high
    - critical
```

### 边缘情况

| 边缘情况 | 增强协议下的处理 |
|---|---|
| 合同出现 playbook 没覆盖的新条款 | 标记 `playbook_policy_missing`，交给法务 |
| Agent 给红线建议但没有引用条款 | validation fail |
| 合同是扫描 PDF | 低置信度字段强制人审 |
| playbook 审查后升级了版本 | release 记录当时使用的 playbook version |
| Agent 尝试代表公司接受条款 | forbidden_actions 阻断 |
| 法务修改了建议 | review_audit 记录 override |

### 结论

增强协议能跑通。Agentic 任务不能被看成自由聊天，而是“有限自主”：目标明确、工具受限、证据必需、高风险问人。

---

## 8. S5：受监管客户投诉处理

### 业务描述

企业从邮件、网页表单、电话转写中收到客户投诉。系统识别投诉类型和监管时限，查询客户事实，起草回复，敏感或受监管投诉必须审批后才能外发。

### Job 类型

Agentic + Workflow 外壳。

### Task 拆解

| Task | 类型 | effect | 说明 |
|---|---|---|---|
| 接收投诉 | integration | read_only | 邮件、表单、电话转写 |
| 检测和处理 PII | deterministic / agentic | generate_artifact | 脱敏或限制访问 |
| 投诉分类 | agentic | generate_artifact | 类型、严重程度、监管要求 |
| 查询政策和账户事实 | integration | read_only | CRM / 知识库 |
| 起草回复 | agentic | generate_artifact | 必须引用事实和政策 |
| 合规审批 | human_review | generate_artifact | 监管类投诉必需 |
| 发送回复 | integration | external_commit | 审批后外发 |

### 需要的协议字段

```yaml
privacy_policy:
  pii_handling: redact_for_agent_when_possible
  allowed_pii_fields:
    - customer_id
    - case_id
  forbidden_pii_fields:
    - full_card_number
    - government_id

deadline_policy:
  response_due_field: regulatory_due_at
  breach_escalation_roles:
    - compliance_manager

tasks:
  - code: send-response
    risk:
      level: critical
      reason: 发送受监管的外部客户沟通
      required_controls:
        - human_approval
        - approved_template
        - recipient_check
    effect:
      type: external_commit
      target_system: customer-email
```

### 边缘情况

| 边缘情况 | 增强协议下的处理 |
|---|---|
| 投诉包含禁止暴露的 PII | 进入 Agent 前脱敏，原文访问由平台审计 |
| 监管回复期限临近 | SLA 升级提醒 |
| 客户要求法律/医疗/金融建议 | Agent 只能草拟批准模板，必须人审 |
| CRM 事实和客户描述冲突 | 分类为 conflict，询问人工 |
| 收件人与账户邮箱不一致 | 阻断外发，进入人工确认 |
| 审批超时 | escalation，绝不 auto-send |

### 结论

增强协议能跑通，但必须新增 `privacy_policy`、`deadline_policy` 和外发审批门。旧协议没有足够表达数据敏感性。

---

## 9. S6：长期营销活动优化

### 业务描述

活动运行数周或数月。系统持续监控投放效果，诊断波动原因，提出预算、内容比例、渠道策略调整。部分调整需要审批，部分会动态授权新的 Skill。

### Job 类型

Hybrid Agentic。Workflow 外壳 + Agentic 诊断 + 运行时调整。

### Task 拆解

| Task | 类型 | effect | 说明 |
|---|---|---|---|
| 收集活动指标 | integration | read_only | 广告、社媒、CRM 指标 |
| 诊断表现变化 | agentic | generate_artifact | 解释效果变化 |
| 提出调整方案 | agentic | generate_artifact | 预算、内容、渠道建议 |
| 审批调整 | human_review | generate_artifact | 按风险层级审批 |
| 应用调整 | integration | external_commit | 更新广告平台或内容日历 |
| 监控调整效果 | integration | read_only | 反馈闭环 |

### 需要的协议字段

```yaml
runtime_adjustable:
  constraints:
    monthly_budget:
      adjustable: true
      min: 1000
      max: 1000000
      layer: 1
      approval_required: true
    prohibited_topics:
      adjustable: false
  parameters:
    paid_ratio:
      adjustable: true
      layer: 2
      approval_required: true
  skills:
    dynamically_authorizable:
      - paid-promotion
      - video-content-generation
    fixed:
      - brand-safety-check
      - compliance-copy-review
    layer: 3
    approval_required: true

adjustment_change_control:
  require_plan_id: true
  require_before_after_config_diff: true
  require_approval_for_layers:
    - 1
    - 2
    - 3
  cooldown_seconds: 86400
  rollback_window_hours: 24
```

### 边缘情况

| 边缘情况 | 增强协议下的处理 |
|---|---|
| Agent 建议预算超过上限 | constraint 阻断 |
| Agent 想授权 paid-promotion Skill | Layer 3 审批 |
| 平台政策变化 | env_assumption violation 触发诊断 |
| 指标改善其实来自季节性 | 需要证据，否则低置信度进入人审 |
| 策略每小时反复触发 | cooldown 防止策略抖动 |
| 调整后效果变差 | rollback window 内回滚 |

### 结论

这是最难的场景。增强协议能跑，但前提是把 JobSpec v2 运行时调整当成“变更控制”，而不是简单配置热更新。

---

## 10. 横向结论

### 结论 1：旧协议能描述流程，增强协议才能支撑生产

旧协议已经可以表达：

- 节点怎么串。
- 每步输入输出是什么。
- 绑定哪个 Skill / Tool / Runtime。
- 有哪些人工审核。

但生产环境还必须表达：

- 这个 Task 会不会改变真实系统。
- 改错了能不能回滚。
- 重试是否安全。
- 关键字段有没有来源证据。
- Agent 能看什么，平台独占什么。
- 失败后应该归因到哪类问题。

### 结论 2：Agentic Task 应该是“有限自主”

Agentic 任务不能只是“AI 自己想办法”。协议必须约束：

- 可用工具。
- 禁止动作。
- 最大步数。
- 最大工具调用。
- token / 时间预算。
- 什么时候必须问人。
- 哪些字段必须有证据。

### 结论 3：写入动作必须有自己的合约

任何 `write_system` 或 `external_commit` 都必须声明：

- 幂等键。
- dry-run。
- 冲突处理。
- 最大影响范围。
- 写前写后快照。
- 回滚或补偿策略。

### 结论 4：validators 属于平台控制面，不属于 Agent

Agent 可以知道输出格式和显性的质量要求，但不应该掌握完整裁判规则。

平台负责：

- validators。
- 脚本校验。
- 审批门。
- 证据检查。
- 写入检查。

### 结论 5：证据链不是 Skill 自己说了算

合理分工是：

```yaml
skill_metadata:
  code: gsds-pdf-parser
  provides_evidence:
    - pdf_page
    - text_span
    - bounding_box

task_policy:
  evidence_policy:
    required: true
    required_for_fields:
      - bbn
      - part
      - un_number
```

Skill 说“我能提供哪些证据”。Task / 平台说“哪些证据是必须的”。

### 结论 6：失败必须分类，才能持续提升

不要只输出：

```yaml
status: failed
```

要能输出：

```yaml
failure:
  category: input_quality_issue
  failed_at_task: parse-gsds
  failed_field: un_number
  reason: PDF 扫描质量低，OCR 无法稳定识别 UN 编号
  suggested_improvement:
    - 要求上传更高清 PDF
    - 对 UN 编号增加人工审核
```

推荐失败分类：

- `input_quality_issue`：源数据质量差。
- `skill_capability_gap`：Skill 能力不足。
- `business_rule_missing`：业务规则没写清楚。
- `external_system_failure`：外部系统失败。
- `validation_rule_gap`：校验规则不足。
- `human_review_timeout`：人工审核超时。
- `runtime_budget_exceeded`：时间、步数、token 超预算。
- `write_conflict`：写入目标系统时发生冲突。

---

## 11. 最小升级建议

如果只做一轮协议升级，优先补这些：

```yaml
resource_lock: {}
visibility: {}
effect: {}
write_policy: {}
evidence_policy: {}
failure_classification: {}
```

第二轮再补：

```yaml
release: {}
risk: {}
audit_policy: {}
approval_policy: {}
privacy_policy: {}
sla_policy: {}
data_product_contract: {}
agentic_controls: {}
```

---

## 12. 最终判断

按增强版协议跑，六类复杂业务基本能跑通。

但要注意：真正跑通的不是“旧的 Schema + JobSpec + Runtime Pack”，而是：

- Schema 保留业务方案和技术 binding。
- JobSpec Release 冻结执行版本。
- Agent Runtime Pack 只给执行者必要信息。
- Platform Control Pack 掌握校验、审批、审计、写入保护。
- 输出必须能带证据链。
- 失败必须能归因。

换成羽毛球比赛的说法：

> 旧协议已经能写赛前战术和安排谁上场；增强协议补上了裁判、鹰眼、装备锁定、比分记录、关键球回放和赛后复盘。企业生产环境真正需要的是后者。
