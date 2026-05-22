# JobSpec v2 运行时调整协议

> 最后更新：2026-04-29
>
> 本文档是《注册协议具体实现》的扩展，定义 JobSpec v2 新增的运行时调整能力。
>
> 相关文档：
>
> - 注册协议基础 → 原《注册协议具体实现》文档
> - 上下文架构 → `[上下文架构.md](./上下文架构.md)`
> - 架构全景 → `[架构全景.md](./架构全景.md)`

---

## 一、概述

### 1.1 为什么需要 v2

v1 协议假设：**任务开始时参数确定，跑完就结束**。

但企业真实场景不是这样的：

- 营销活动要跑 3 个月
- 数据变好了要追加预算
- 平台政策变了要调整策略
- 负面舆情要紧急响应

v2 协议新增三个声明，让 Agent 系统能够「**边跑边调**」：


| 声明                    | 解决的问题             |
| --------------------- | ----------------- |
| `runtime_adjustable`  | 什么能改、怎么改、谁能批      |
| `env_assumptions`     | 依赖什么外部条件、条件变了怎么发现 |
| `adjustment_policies` | 遇到某种情况按什么预案处理     |


### 1.2 协议层级

```
┌─────────────────────────────────────────────────────────────────┐
│                        协议层级                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  业务方                        技术方                            │
│  ────────                      ────────                         │
│  口述业务流程                   填写完整 JobSpec                  │
│  确认方案                       包括 v2 新增声明                  │
│  运行时审批                     维护和调试                        │
│                                                                  │
│                                    │                             │
│                                    ▼                             │
│                           ┌─────────────────┐                   │
│                           │   JobSpec v2    │                   │
│                           │                 │                   │
│                           │ • 基础定义      │                   │
│                           │ • runtime_adj   │ ← 新增            │
│                           │ • env_assumpt   │ ← 新增            │
│                           │ • adj_policies  │ ← 新增            │
│                           └─────────────────┘                   │
│                                    │                             │
│                                    ▼                             │
│                           ┌─────────────────┐                   │
│                           │  Task Platform  │                   │
│                           │                 │                   │
│                           │ • 解析声明      │                   │
│                           │ • 运行时执行    │                   │
│                           │ • 环境监控      │                   │
│                           │ • 动态调整      │                   │
│                           └─────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 四层热更新模型


| 层级          | 调整内容     | 风险  | 更新方式  | 示例           |
| ----------- | -------- | --- | ----- | ------------ |
| **Layer 1** | 约束/红线    | 最低  | 立即热生效 | 预算上限变更       |
| **Layer 2** | 策略参数     | 低   | 下轮生效  | 内容:投放比例调整    |
| **Layer 3** | Skill 授权 | 中   | 需技术确认 | 授权付费投放能力     |
| **Layer 4** | 编排结构     | 高   | 需回编辑器 | 增加新的 Task 节点 |


---

## 二、JobSpec v2 完整结构

```yaml
spec_version: task-platform.job.v2
kind: JobSpec

metadata:
  code: xiaohongshu-food-launch
  name: 小红书美食账号起号
  description: 从 0 开始运营小红书美食账号

input_schema:
  type: object
  required:
    - account_id
    - monthly_budget
  properties:
    account_id:
      type: string
    monthly_budget:
      type: number
      default: 5000

defaults:
  runtime_profile_code: openclaw-default
  context_policy_code: xiaohongshu-operation-context
  review_policy_code: null
  skill_codes: []
  tool_codes: []
  secret_refs: []

tasks: []
flow: []
triggers: []

# ============================================================
# v2 新增字段（均为可选）
# ============================================================
runtime_adjustable: {}
env_assumptions: []
adjustment_policies: []
```

### 2.1 顶层字段说明


| 字段                      | 必填  | 类型 / 枚举                                         | 默认值  | 说明                       |
| ----------------------- | --- | ----------------------------------------------- | ---- | ------------------------ |
| spec_version            | 是   | `task-platform.job.v1` / `task-platform.job.v2` | 无    | 协议版本。v2 支持运行时调整声明。       |
| kind                    | 是   | `JobSpec`                                       | 无    | 固定类型，JobSpec schema 强校验。 |
| metadata.code           | 是   | code string                                     | 无    | JobTemplate code，全局唯一。   |
| metadata.name           | 是   | string                                          | 无    | 展示名称。                    |
| metadata.description    | 否   | string                                          | null | Job 描述。                  |
| input_schema            | 否   | object                                          | {}   | Job 输入 JSON Schema。      |
| defaults                | 否   | object                                          | {}   | Task 默认配置。               |
| tasks                   | 是   | Task[]                                          | 无    | 至少 1 个 Task。             |
| flow                    | 是   | FlowEdge[]                                      | 无    | 至少 1 条边。                 |
| triggers                | 否   | code string[]                                   | []   | 关联 Trigger code。         |
| **runtime_adjustable**  | 否   | object                                          | {}   | **v2 新增**。运行时可调整声明。      |
| **env_assumptions**     | 否   | EnvAssumption[]                                 | []   | **v2 新增**。环境假设声明。        |
| **adjustment_policies** | 否   | AdjustmentPolicy[]                              | []   | **v2 新增**。调整策略声明。        |


---

## 三、runtime_adjustable：运行时可调整声明

### 3.1 作用

告诉系统：**这个 Job 在运行时，哪些东西可以被动态修改，修改的边界和审批要求是什么。**

### 3.2 完整结构

```yaml
runtime_adjustable:
  constraints:
    monthly_budget:
      adjustable: true
      min: 1000
      max: 1000000
      layer: 1
      approval_required: false
    
    daily_posts:
      adjustable: true
      min: 1
      max: 10
      layer: 1
      approval_required: false
    
    prohibited_topics:
      adjustable: false
  
  parameters:
    content_ratio:
      adjustable: true
      layer: 2
      approval_required: false
    
    paid_ratio:
      adjustable: true
      layer: 2
      approval_required: true
      unlock_skills:
        - paid-promotion
  
  skills:
    dynamically_authorizable:
      - paid-promotion
      - video-content-generation
      - ad-copywriting
    fixed:
      - xiaohongshu-copywriting
      - content-compliance-check
    layer: 3
    approval_required: true
```

### 3.3 constraints 字段

约束是 Layer 1 级别的调整，通常可以即时生效。


| 字段                | 必填  | 类型 / 枚举       | 默认值   | 说明                 |
| ----------------- | --- | ------------- | ----- | ------------------ |
| adjustable        | 是   | boolean       | -     | 该约束是否可在运行时调整。      |
| min               | 否   | number        | null  | 调整下限（仅 number 类型）。 |
| max               | 否   | number        | null  | 调整上限（仅 number 类型）。 |
| allowed_values    | 否   | any[]         | null  | 允许的取值列表（仅枚举类型）。    |
| layer             | 否   | 1 / 2 / 3 / 4 | 1     | 调整风险层级。            |
| approval_required | 否   | boolean       | false | 是否需要人工审批。          |
| approval_roles    | 否   | string[]      | []    | 有权审批的角色列表。         |


### 3.4 parameters 字段

参数是 Layer 2 级别的调整，通常下一执行轮次生效。


| 字段                | 必填  | 类型 / 枚举       | 默认值   | 说明                   |
| ----------------- | --- | ------------- | ----- | -------------------- |
| adjustable        | 是   | boolean       | -     | 该参数是否可在运行时调整。        |
| min               | 否   | number        | null  | 调整下限。                |
| max               | 否   | number        | null  | 调整上限。                |
| layer             | 否   | 1 / 2 / 3 / 4 | 2     | 调整风险层级。              |
| approval_required | 否   | boolean       | false | 是否需要人工审批。            |
| unlock_skills     | 否   | code string[] | []    | 调整该参数时需要同时授权的 Skill。 |


### 3.5 skills 字段

Skill 授权是 Layer 3 级别的调整，通常需要技术确认。


| 字段                       | 必填  | 类型 / 枚举       | 默认值  | 说明                        |
| ------------------------ | --- | ------------- | ---- | ------------------------- |
| dynamically_authorizable | 否   | code string[] | []   | 可动态授权的 Skill code 列表。     |
| fixed                    | 否   | code string[] | []   | 不可取消授权的 Skill（核心能力/安全底线）。 |
| layer                    | 否   | 1 / 2 / 3 / 4 | 3    | Skill 授权变更的风险层级。          |
| approval_required        | 否   | boolean       | true | 是否需要审批。默认需要。              |


---

## 四、env_assumptions：环境假设声明

### 4.1 作用

告诉系统：**这个 Job 的方案是基于什么外部条件设计的，如果这些条件变了，系统应该怎么发现和响应。**

### 4.2 完整结构

```yaml
env_assumptions:
  - id: ea-ctr-baseline
    claim: "美食类 CTR ≥ 8%"
    baseline: 8.0
    field_path: summary.avg_ctr
    monitoring:
      interval: daily
      source: performance-analysis
    violation:
      threshold: 0.5
      action: trigger_diagnosis
      review_policy_code: strategy-adjustment-review

  - id: ea-budget-sufficient
    claim: "月预算足够完成计划"
    field_path: metrics.budget_utilization
    monitoring:
      interval: daily
      source: data-collection
    violation:
      threshold: 0.9
      comparison: gte
      action: alert_human
      alert_channels:
        - operations-team

  - id: ea-platform-stable
    claim: "小红书平台算法稳定"
    monitoring:
      type: external_signal
    violation:
      action: trigger_diagnosis
```

### 4.3 EnvAssumption 字段


| 字段         | 必填  | 类型 / 枚举 | 默认值  | 说明                       |
| ---------- | --- | ------- | ---- | ------------------------ |
| id         | 是   | string  | -    | 假设唯一标识，建议格式 `ea-<name>`。 |
| claim      | 是   | string  | -    | 用自然语言描述该假设。              |
| baseline   | 否   | number  | null | 基线值（数值类假设）。              |
| field_path | 否   | string  | null | 从哪个字段读取当前值，支持点号路径。       |
| monitoring | 否   | object  | {}   | 监控配置。                    |
| violation  | 否   | object  | {}   | 违反时的响应配置。                |


### 4.4 monitoring 字段


| 字段              | 必填  | 类型 / 枚举                                      | 默认值         | 说明              |
| --------------- | --- | -------------------------------------------- | ----------- | --------------- |
| interval        | 否   | `realtime` / `hourly` / `daily` / `weekly`   | daily       | 监控检查频率。         |
| source          | 否   | code string                                  | null        | 数据来源 Task code。 |
| type            | 否   | `task_output` / `external_signal` / `manual` | task_output | 监控类型。           |
| external_source | 否   | string                                       | null        | 外部数据源标识。        |


### 4.5 violation 字段


| 字段                  | 必填  | 类型 / 枚举                                                              | 默认值  | 说明                                                 |
| ------------------- | --- | -------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| threshold           | 否   | number                                                               | null | 违反阈值。配合 baseline：`current < baseline * threshold`。 |
| comparison          | 否   | `lt` / `lte` / `gt` / `gte` / `eq` / `neq`                           | lt   | 比较方式。                                              |
| action              | 是   | `trigger_diagnosis` / `alert_human` / `pause_job` / `trigger_policy` | -    | 响应动作。                                              |
| review_policy_code  | 否   | code string                                                          | null | 人工审核时的 ReviewPolicy。                               |
| alert_channels      | 否   | string[]                                                             | []   | 告警通知目标。                                            |
| trigger_policy_code | 否   | code string                                                          | null | 触发的 adjustment_policy code。                        |


### 4.6 violation.action 枚举


| 值                   | 说明                       |
| ------------------- | ------------------------ |
| `trigger_diagnosis` | 触发自动诊断，分析原因，生成调整建议。      |
| `alert_human`       | 发送告警，不自动执行调整。            |
| `pause_job`         | 暂停 Job，等待人工介入。           |
| `trigger_policy`    | 触发指定的 adjustment_policy。 |


---

## 五、adjustment_policies：调整策略声明

### 5.1 作用

告诉系统：**当某种事件发生时，按什么预案自动响应。**

### 5.2 完整结构

```yaml
adjustment_policies:
  - code: budget-increase-response
    name: 预算追加响应
    trigger:
      type: business_event
      event_type: budget_adjustment
      condition:
        field: new_value
        comparison: gt
        value_field: original_value
        multiplier: 2
    impact_assessment:
      enabled: true
    actions:
      layer1:
        - type: update_constraint
          field: monthly_budget
          source: event.new_value
      layer2:
        - type: update_parameter
          field: paid_ratio
          value: 0.3
      layer3:
        - type: authorize_skill
          skill_code: paid-promotion
    approval:
      layer1: auto
      layer2: auto
      layer3: tech_review
      layer3_roles:
        - tech-lead
    notification:
      on_trigger:
        - operations-team
      on_complete:
        - management

  - code: performance-decline-response
    name: 业绩下滑响应
    trigger:
      type: env_assumption_violated
      assumption_id: ea-ctr-baseline
    impact_assessment:
      enabled: true
      diagnosis_required: true
    actions:
      - type: diagnose_environment
      - type: generate_adjustment_plan
      - type: request_human_decision
    approval: human_review
    review_policy_code: strategy-adjustment-review
    sla_hours: 24
```

### 5.3 AdjustmentPolicy 顶层字段


| 字段                 | 必填  | 类型 / 枚举                                          | 默认值  | 说明                  |
| ------------------ | --- | ------------------------------------------------ | ---- | ------------------- |
| code               | 是   | code string                                      | -    | 策略唯一标识。             |
| name               | 是   | string                                           | -    | 策略名称。               |
| trigger            | 是   | object                                           | -    | 触发条件。               |
| impact_assessment  | 否   | object                                           | {}   | 影响评估配置。             |
| actions            | 是   | object / Action[]                                | -    | 触发后的动作。             |
| approval           | 否   | `auto` / `tech_review` / `human_review` / object | auto | 审批方式。               |
| review_policy_code | 否   | code string                                      | null | 人工审核的 ReviewPolicy。 |
| sla_hours          | 否   | number                                           | null | 响应 SLA（小时）。         |
| notification       | 否   | object                                           | {}   | 通知配置。               |


### 5.4 trigger 字段


| 字段            | 必填                             | 类型 / 枚举                                                                   | 默认值  | 说明             |
| ------------- | ------------------------------ | ------------------------------------------------------------------------- | ---- | -------------- |
| type          | 是                              | `business_event` / `env_assumption_violated` / `task_output` / `schedule` | -    | 触发类型。          |
| event_type    | 当 type=business_event          | string                                                                    | null | 业务事件类型。        |
| assumption_id | 当 type=env_assumption_violated | string                                                                    | null | 被违反的假设 ID。     |
| task_code     | 当 type=task_output             | code string                                                               | null | 监控的 Task code。 |
| condition     | 否                              | object                                                                    | {}   | 具体触发条件。        |


### 5.5 trigger.condition 字段


| 字段          | 必填  | 类型 / 枚举                                    | 默认值  | 说明          |
| ----------- | --- | ------------------------------------------ | ---- | ----------- |
| field       | 否   | string                                     | null | 检查的字段路径。    |
| comparison  | 否   | `lt` / `lte` / `gt` / `gte` / `eq` / `neq` | eq   | 比较方式。       |
| value       | 否   | any                                        | null | 比较目标（固定值）。  |
| value_field | 否   | string                                     | null | 比较目标（动态字段）。 |
| multiplier  | 否   | number                                     | 1    | 目标值乘数。      |


### 5.6 actions 字段

**格式一：分层动作对象**（推荐）

```yaml
actions:
  layer1:
    - type: update_constraint
      field: monthly_budget
      source: event.new_value
  layer2:
    - type: update_parameter
      field: paid_ratio
      value: 0.3
  layer3:
    - type: authorize_skill
      skill_code: paid-promotion
```

**格式二：动作数组**

```yaml
actions:
  - type: diagnose_environment
  - type: generate_adjustment_plan
  - type: request_human_decision
```

### 5.7 Action 类型枚举


| type                       | 说明          | 必填参数                    |
| -------------------------- | ----------- | ----------------------- |
| `update_constraint`        | 更新约束值       | field, value/source     |
| `update_parameter`         | 更新策略参数      | field, value/source     |
| `authorize_skill`          | 授权 Skill    | skill_code              |
| `revoke_skill`             | 取消 Skill 授权 | skill_code              |
| `diagnose_environment`     | 触发环境诊断      | -                       |
| `generate_adjustment_plan` | 生成调整方案      | -                       |
| `request_human_decision`   | 请求人工决策      | review_policy_code (可选) |
| `pause_job`                | 暂停 Job      | -                       |
| `resume_job`               | 恢复 Job      | -                       |
| `alert_human`              | 发送告警        | channels                |
| `trigger_task`             | 触发指定 Task   | task_code               |


### 5.8 approval 字段

当 approval 为 object 时：


| 字段           | 必填  | 类型 / 枚举                                 | 默认值          | 说明            |
| ------------ | --- | --------------------------------------- | ------------ | ------------- |
| layer1       | 否   | `auto` / `tech_review` / `human_review` | auto         | Layer 1 审批方式。 |
| layer2       | 否   | `auto` / `tech_review` / `human_review` | auto         | Layer 2 审批方式。 |
| layer3       | 否   | `auto` / `tech_review` / `human_review` | tech_review  | Layer 3 审批方式。 |
| layer4       | 否   | `auto` / `tech_review` / `human_review` | human_review | Layer 4 审批方式。 |
| layer1_roles | 否   | string[]                                | []           | Layer 1 审批角色。 |
| layer2_roles | 否   | string[]                                | []           | Layer 2 审批角色。 |
| layer3_roles | 否   | string[]                                | []           | Layer 3 审批角色。 |
| layer4_roles | 否   | string[]                                | []           | Layer 4 审批角色。 |


---

## 六、运行时数据模型

### 6.1 JobInstance 扩展

v2 的 JobInstance 新增 `runtime_context` 和 `adjustment_history` 字段：

```yaml
JobInstance:
  id: uuid
  job_template_code: xiaohongshu-food-launch
  status: running
  input_payload:
    account_id: "xhs_food_2026"
    monthly_budget: 5000          # 原始值
  created_at: "2026-04-01T00:00:00Z"
  
  # v2 新增：运行时上下文（可动态修改）
  runtime_context:
    constraints:
      monthly_budget: 50000       # 已调整
      daily_posts: 2
    parameters:
      content_ratio: 0.6
      paid_ratio: 0.4
    authorized_skills:
      - xiaohongshu-copywriting
      - paid-promotion            # 动态授权
    env_assumptions:
      - id: ea-ctr-baseline
        status: violated
        current_value: 3.2
        violated_at: "2026-05-10T00:00:00Z"
  
  # v2 新增：调整历史（审计）
  adjustment_history:
    - id: adj-001
      timestamp: "2026-04-20T10:30:00Z"
      event_type: business_event
      changes:
        - layer: 1
          field: constraints.monthly_budget
          from: 5000
          to: 50000
      requestor: "运营总监"
      approved_by: "技术负责人"
```

### 6.2 执行引擎读取逻辑

```
TaskRun 执行时：
  1. 优先从 runtime_context 读取当前生效值
  2. 如果 runtime_context 没有，fallback 到 input_payload
  3. Skill 列表从 runtime_context.authorized_skills 读取
  4. 检查 env_assumptions 状态，决定是否触发诊断
```

---

## 七、新增 API

### 7.1 业务事件接收 API

```
POST /api/job-instances/:id/events
```

请求：

```json
{
  "event_type": "business_event",
  "payload": {
    "type": "budget_adjustment",
    "new_value": 50000,
    "original_value": 5000,
    "reason": "数据超预期，追加预算"
  },
  "requestor": "运营总监"
}
```

响应：

```json
{
  "event_id": "evt-001",
  "status": "processing",
  "matched_policy": "budget-increase-response",
  "adjustment_plan": {
    "layer1_changes": [...],
    "layer2_changes": [...],
    "layer3_changes": [...]
  },
  "approval_required": true,
  "approval_url": "/api/adjustments/adj-001/approve"
}
```

### 7.2 动态调整 API

```
PATCH /api/job-instances/:id/adjustments
```

请求：

```json
{
  "adjustment_plan_id": "adj-001",
  "approved_changes": {
    "layer1": [
      {"field": "constraints.monthly_budget", "value": 50000}
    ],
    "layer2": [
      {"field": "parameters.paid_ratio", "value": 0.4}
    ],
    "layer3": [
      {"action": "authorize_skill", "skill_code": "paid-promotion"}
    ]
  },
  "approver": "技术负责人",
  "comment": "批准预算追加和投放能力授权"
}
```

### 7.3 环境假设更新 API

```
PATCH /api/job-instances/:id/env-assumptions/:assumption_id
```

请求：

```json
{
  "current_value": 3.2,
  "status": "violated",
  "source": "monitoring"
}
```

### 7.4 调整历史查询 API

```
GET /api/job-instances/:id/adjustment-history
```

---

## 八、版本兼容性


| spec_version           | 支持的字段                                                           | 说明         |
| ---------------------- | --------------------------------------------------------------- | ---------- |
| `task-platform.job.v1` | 基础字段                                                            | 现有功能，完全兼容。 |
| `task-platform.job.v2` | v1 + runtime_adjustable + env_assumptions + adjustment_policies | 新增字段均为可选。  |


**向后兼容规则**：

- v1 JobSpec 在 v2 系统中正常运行，新增字段使用默认值。
- v2 新增字段均为可选，技术方可渐进式采用。

**系统默认行为**（未配置声明时）：


| 场景          | 默认行为                              |
| ----------- | --------------------------------- |
| 收到业务事件      | 拒绝，提示需要人工处理或配置 runtime_adjustable |
| 环境指标异常      | 不自动检测，等人发现                        |
| 需要授权新 Skill | 拒绝，提示需要重新发布                       |


---

## 九、完整示例

见附录或独立示例文件：`examples/xiaohongshu-food-launch-v2.yaml`

---

## 十、文档索引

```
JobSpec-v2运行时调整.md   ← 你在这里（v2 运行时调整协议）
    │
    │  依赖：
    ├── 注册协议具体实现             基础协议定义
    │
    │  被引用于：
    ├── 上下文架构.md     上下文架构（四层热更新、业务事件）
    ├── 架构全景.md    架构全景（执行引擎）
    │
    │  相关 API：
    ├── POST /api/job-instances/:id/events
    ├── PATCH /api/job-instances/:id/adjustments
    └── PATCH /api/job-instances/:id/env-assumptions/:id
```

