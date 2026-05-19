# FlowAgent Schema 字段填写与运行时分发流向图

> 这张图说明：业务翻译平台产出的 FlowAgent Schema 里，各类字段应该由谁填写；发布后，这些字段如何被编译进 JobSpec；运行时又如何分别进入 Runtime Pack、Control Pack、control_projection 和审计复盘。

## 1. 总体流向图

```mermaid
flowchart TD
  A["业务输入\nSOP / 业务规则 / 人工经验 / 企业原流程"]
  B["FlowAgent Schema\n设计态业务翻译结果"]
  C["技术 Binding\n技术方确认资源、字段映射、风险控制"]
  D["JobSpec\n发布前业务编排定义"]
  E["Publish Readiness\n发布校验"]
  F["JobSpec Release / JobTemplate\n已发布可运行版本"]
  G["JobRun / TaskRun\n运行实例"]
  H["Runtime Pack\n给 Worker / Agent"]
  I["Control Pack\n给 task-platform 控制面"]
  J["control_projection\n给 Agent 的控制摘要"]
  K["Execution Result\n执行结果 / 审计 / 复盘"]

  A --> B
  B --> C
  C --> D
  D --> E
  E --> F
  F --> G
  G --> H
  G --> I
  I --> J
  H --> K
  I --> K
  J --> H
```

## 2. FlowAgent Schema 里应该填写什么

```mermaid
flowchart LR
  subgraph FA["FlowAgent Schema：设计态"]
    N1["业务流程结构\njob_type / nodes / edges"]
    N2["Task 业务定义\nname / intent / instruction / input / output"]
    N3["Task 类型\ntask_type: agentic / integration / deterministic / human_review"]
    N4["资源引用建议\nskill_codes / tool_codes / context_policy_code / runtime_profile_code"]
    N5["证据要求\nevidence_policy"]
    N6["人工介入\nhuman_gate / review_policy_code"]
    N7["写系统保护\nTask effect / write_policy"]
    N8["校验绑定\ncontrol_bindings.validators"]
    N9["重试恢复\nretry_resume_policy"]
    N10["审计要求\naudit"]
    N11["运行时可调字段\nruntime_adjustable"]
  end

  U["业务方 / AI"] --> N1
  U --> N2
  U --> N5
  U --> N6

  T["技术方"] --> N3
  T --> N4
  T --> N7
  T --> N8
  T --> N9
  T --> N10
  T --> N11

  R["资源注册中心\nSkill / Tool / Runtime / Context / ReviewPolicy / Secret / Trigger"] --> N4
```

## 3. 编译成 JobSpec 后，哪些字段去哪里

```mermaid
flowchart TD
  JS["JobSpec / JobSpec Release\n发布态业务编排定义"]

  subgraph JF["JobSpec 中保留"]
    J1["metadata / input_schema"]
    J2["tasks[]\ncode / name / type / instruction"]
    J3["flow[]\nTask 连线和条件"]
    J4["resource refs\nruntime_profile_code / skill_codes / tool_codes / secret_refs / context_policy_code / review_policy_code"]
    J5["control fields\neffect / write_policy / retry_resume_policy / control_bindings / audit"]
  end

  subgraph RP["Runtime Pack 来源"]
    R1["task instruction"]
    R2["task type / agent_task_mode"]
    R3["output_schema"]
    R4["allowed skills / tools"]
    R5["context package\ninputs / upstream outputs / allowed context"]
    R6["runtime limits\ntimeout / max_tool_calls / token limits"]
  end

  subgraph CP["Control Pack 来源"]
    C1["validators\nphase / executor / authority / on_fail"]
    C2["write guard\ndry_run / idempotency / commit confirmation"]
    C3["retry resume\ncheckpoint / retry_on / unsafe resume"]
    C4["approval / review gates"]
    C5["audit rules"]
    C6["secret resolution\nplatform only"]
  end

  JS --> JF
  J2 --> R1
  J2 --> R2
  J2 --> R3
  J4 --> R4
  J4 --> R5
  J4 --> R6
  J5 --> C1
  J5 --> C2
  J5 --> C3
  J5 --> C4
  J5 --> C5
  J4 --> C6
```

## 4. 运行时分发图

```mermaid
sequenceDiagram
  participant Trigger as Trigger / Scheduler
  participant Platform as task-platform
  participant Registry as Resource Registry
  participant Runtime as Worker / Agent
  participant Control as Control Plane
  participant Human as Human Reviewer
  participant Audit as Audit / Replay

  Trigger->>Platform: 触发 JobRun
  Platform->>Registry: 读取 JobSpec Release 和资源配置
  Registry-->>Platform: 返回 Runtime / Tool / Skill / Context / ReviewPolicy 等配置

  Platform->>Platform: 创建 TaskRun
  Platform->>Runtime: 分发 Runtime Pack
  Platform->>Control: 物化 Control Pack
  Control-->>Runtime: 下发 control_projection 摘要

  Runtime->>Platform: 上报 tool calls / partial output / checkpoint
  Control->>Control: 执行 pre_task / post_task / pre_commit / post_commit validators

  alt 需要人工审核
    Control->>Human: 创建 ReviewTicket
    Human-->>Control: 审核结论
  end

  alt 写系统 Task
    Control->>Control: dry-run / 幂等 / pre_commit 校验
    Runtime->>Platform: 请求提交外部系统
    Control->>Control: post_commit 确认
  end

  Platform->>Audit: 写入执行结果、校验结果、审批记录、checkpoint、失败归因
```

## 5. 一句话理解

```text
FlowAgent Schema 负责表达“当前业务怎么做、怎么验收、哪里有风险”。
JobSpec 负责冻结“这次发布具体怎么编排、引用哪些资源、有哪些控制字段”。
Runtime Pack 负责告诉 Worker / Agent “当前 Task 怎么执行”。
Control Pack 负责告诉平台控制面 “当前 Task 怎么校验、审批、审计、防事故和恢复”。
Execution Result 负责记录 “最后发生了什么，以及为什么”。
```

