# 业务流程生成 Prompt

> 版本：2026-05-19
>
> 本文档只定义“第一次进入翻译阶段”时的业务流程生成 Prompt。这里先不包含准入判断、节点澄清、流程修改、技术审阅和技术蓝图设计。

## 1. 目标

业务流程生成器的任务是：

> 把业务方的自然语言描述，以及当前 Job 中的流程方案、业务规则和 Know-how、文件模板、未分类文件，翻译成一张表达真实业务过程的业务流程图。

它生成的是“业务流程共识层”，不是技术方案。

因此它只回答：

- 这件业务真实怎么发生？
- 业务人员每一步在做什么？
- 每一步需要什么输入材料？
- 每一步产出什么结果？
- 哪些地方是固定操作？
- 哪些地方是策略判断、业务规则或人工确认？
- 哪些地方还不确定，需要后续追问？

它不回答：

- 技术上拆几个 Job？
- 哪些节点异步调度？
- 用什么接口、数据库、消息队列？
- 生成什么时序图？
- 绑定什么 Skill？
- 导出什么 JobSpec？

## 2. 输入上下文

业务流程生成 Prompt 接收的是“业务理解上下文”，主要由四部分组成。

### 2.1 Job 基础信息

```json
{
  "jobId": "job-imi-001",
  "jobName": "可为空，由模型生成",
  "stage": "business_flow_generation",
  "role": "business"
}
```

说明：

- `jobId` 用于标识当前业务方案。
- `stage` 表示当前处于业务流程生成阶段。
- `role` 通常是业务方。

### 2.2 用户原始描述

```json
{
  "userBrief": "我要申请IMI证书，首先我会收到领导的邮件..."
}
```

说明：

- 用户描述可能是完整流程，也可能只是部分说明。
- 用户描述优先级高于模型常识。
- 不要用行业常识擅自补充用户没有提到、文件也没有证据的流程节点。

### 2.3 Job 文件上下文

第一次业务流程生成不是只读取样例文件，而是读取当前 Job 文件池中与业务理解相关的文件。

这些文件的作用不同，不能混成一种“附件”：

- 流程方案：提供流程骨架、步骤顺序、角色交接，是强流程证据。
- 业务规则和 Know-how：提供校验规则、例外情况、判断边界和经验口径，是强规则证据。
- 文件模板：提供输入输出字段、表单结构、结果格式，是强字段证据。
- 未分类文件：先判断用途，再决定是否作为流程、规则或模板证据使用。

它们都可以帮助生成第一版业务流程，但权重不同。

```json
{
  "jobFileGroups": [
    {
      "category": "workflow_plan",
      "label": "流程方案",
      "definition": "说明这件业务平时怎么一步步做的材料，用于识别流程节点、顺序、分支和角色交接。",
      "files": [
        {
          "fileId": "file-001",
          "fileName": "IMI申请SOP.pdf",
          "path": "/uploads/IMI申请SOP.pdf"
        }
      ]
    },
    {
      "category": "business_rule_knowhow",
      "label": "业务规则和 Know-how",
      "definition": "说明这件业务怎么判断、怎么校验、有哪些经验口径和注意事项的材料，用于补充节点规则、确认边界和追问。",
      "files": [
        {
          "fileId": "file-002",
          "fileName": "危险品字段填写规则.docx",
          "path": "/uploads/危险品字段填写规则.docx"
        }
      ]
    },
    {
      "category": "file_template",
      "label": "文件模板",
      "definition": "业务中需要填写、提交、生成或检查的表单/文件，用于识别输入输出、字段结构和产出格式。",
      "files": [
        {
          "fileId": "file-003",
          "fileName": "IMI申请大表.xlsx",
          "path": "/uploads/IMI申请大表.xlsx"
        }
      ]
    }
  ]
}
```

文件分类建议：

| 分类 | 作用 |
| --- | --- |
| `workflow_plan` | SOP、流程图、操作手册；提供流程骨架、步骤顺序、角色交接 |
| `business_rule_knowhow` | 业务规则、校验规则、例外处理；帮助识别判断规则和确认边界 |
| `file_template` | 帮助识别输入输出字段、表单结构、结果格式 |
| `uncategorized` | 用户暂时不确定文件作用；Agent 先判断用途再使用 |

文件使用优先级：

| 文件类型 | 是否可以生成流程节点 | 主要用途 |
| --- | --- | --- |
| 流程方案 | 可以，且优先级高 | 抽取流程节点、顺序、分支、角色 |
| 用户自然语言描述 | 可以，优先级高 | 补充真实操作、例外、口语化流程 |
| 业务规则和 Know-how | 通常不直接生成节点 | 生成节点内判断规则、完成标准、追问 |
| 文件模板 | 通常不直接生成节点 | 生成输入输出、字段、表单产物 |
| 未分类文件 | 先判断再使用 | 不默认当作流程方案 |

### 2.4 已知约束

```json
{
  "knownConstraints": [
    "只生成业务流程，不生成技术方案",
    "Job文件用于业务理解，不默认挂载到节点附件",
    "不向业务方暴露workflow/agentic分类"
  ]
}
```

## 3. 生成原则

### 3.1 只表达真实业务

节点必须来自以下来源之一：

- 用户明确描述的业务动作。
- 用户明确描述的业务判断。
- 用户明确描述的文件产出或结果回填。
- SOP / 流程方案文件中明确出现的流程线索。
- 为了衔接用户已描述动作而必要的中性节点，但必须标记为低置信度并提出追问。

不要因为业务名称像“申请”“审批”“证书”“评审”，就自动补充官方流程节点。

例如 IMI 证书申请场景中，如果用户没有提到，不要擅自生成：

- 形式审查
- 实质评审
- 专家评审
- 现场核查
- 受理通知书

### 3.2 不生成技术方案

禁止输出以下内容：

- Job 拆分
- 技术架构
- API
- 数据库
- 消息队列
- 定时调度
- Skill 绑定
- 执行器
- 时序图
- 资源编码
- JobSpec

如果用户描述里出现系统名称，例如“中外运系统”，可以作为业务步骤中的使用对象，但不要展开成接口或系统集成方案。

### 3.3 不暴露 workflow / agentic

业务方不需要看到：

- workflow
- agentic
- agent
- skill
- execution mode
- deterministic / intelligent

统一使用业务语言：

- 业务动作
- 业务判断
- 人工确认
- 文件产出
- 检查与返修
- 复盘沉淀

### 3.4 不同文件按不同证据类型使用

第一次生成业务流程图时，Job 文件用于帮助模型理解业务流程、规则、字段和数据走向。

但文件不应该被同等对待：

- 流程方案可以成为流程节点和顺序的主要来源。
- 用户描述可以修正 SOP 中过时或不符合实际操作的部分。
- 业务规则和 Know-how 用来补充节点内的判断规则、完成标准、经验口径和追问。
- 文件模板用来补充节点输入输出和字段，不要把字段列表当成流程。
- 未分类文件必须先判断用途，不要默认当作流程方案。

不要自动把所有 Job 文件都写进节点附件。

如果某个文件明显支撑某个节点，可以在节点里写 `suggestedFileRefs`，表示“建议后续挂载”，但不要当成正式附件。

### 3.5 不确定内容要显式标记

如果信息不足，不要硬编。

应该通过以下方式表达：

- `confidence: "low"`
- `openQuestions`
- `source: "inferred_need_confirmation"`

例如：

```json
{
  "ruleName": "证书错误处理",
  "ruleDetail": "如果证书内容有错，将错误字段和正确值重新发送给海关。",
  "source": "user_description"
}
```

如果是模型推测：

```json
{
  "ruleName": "申请编号来源",
  "ruleDetail": "申请编号可能来自中外运系统生成，但需要业务方确认。",
  "source": "inferred_need_confirmation"
}
```

## 4. 输出 Schema

```json
{
  "jobName": "业务方案名称",
  "businessFlow": {
    "flowId": "flow-001",
    "version": 1,
    "nodes": [
      {
        "nodeId": "node-1",
        "title": "节点名称",
        "nodeType": "business_action",
        "workUnitKind": "operation_step",
        "description": "用业务语言说明这一步在做什么",
        "owner": "业务人员/部门/待确认",
        "inputs": [
          {
            "name": "输入材料或信息",
            "type": "email | excel | pdf | text | system_record | structured_fields | unknown",
            "source": "user_description | sample_file | previous_node | unknown",
            "description": "输入说明"
          }
        ],
        "outputs": [
          {
            "name": "产出结果",
            "type": "excel | pdf | email | structured_fields | system_record | business_result | unknown",
            "description": "产出说明"
          }
        ],
        "operationSteps": [
          "业务人员实际会做的动作"
        ],
        "strategySpec": {
          "decisionSubject": "如果这是策略判断节点，这里写这一步要判断或决定什么",
          "focusSignals": ["需要关注的信息、材料、数据或上下文"],
          "decisionLogic": ["如何判断、如何归类、如何形成处理建议"],
          "recommendationOutputs": ["这一步会给出什么建议或判断结果"],
          "humanConfirmation": ["什么情况需要人确认或接手"],
          "riskBoundaries": ["不能越过的业务边界"]
        },
        "businessRules": [
          {
            "ruleName": "规则名称",
            "ruleDetail": "规则内容",
            "source": "user_description | sample_file | inferred_need_confirmation"
          }
        ],
        "doneCriteria": "这一步做到什么程度算完成",
        "suggestedFileRefs": [
          {
            "fileId": "file-001",
            "role": "input_sample | output_template | rule_reference | test_sample | background_reference",
            "reason": "为什么建议后续挂到这个节点"
          }
        ],
        "confidence": "high | medium | low",
        "openQuestions": [
          {
            "questionId": "q-node-1-001",
            "question": "需要业务方确认的问题",
            "reason": "为什么需要确认",
            "options": ["可选项A", "可选项B"]
          }
        ]
      }
    ],
    "edges": [
      {
        "edgeId": "edge-1",
        "sourceNodeId": "node-1",
        "targetNodeId": "node-2",
        "condition": "进入下一步的条件"
      }
    ]
  },
  "summary": "对生成流程的简短说明",
  "globalOpenQuestions": [
    {
      "questionId": "q-global-001",
      "question": "全局需要确认的问题",
      "reason": "为什么影响整个流程",
      "options": ["可选项A", "可选项B"]
    }
  ]
}
```

## 5. 节点类型定义

| nodeType | 含义 | 例子 |
| --- | --- | --- |
| `business_action` | 固定业务动作 | 查找 GSDS、填写申请大表、上传系统 |
| `business_judgment` | 业务判断 | 判断证书是否有错、判断材料是否齐全 |
| `human_confirmation` | 人工确认 | 业务人员确认申请资料无误 |
| `document_output` | 文件或结果产出 | 生成申请资料、形成校验清单 |
| `review_feedback` | 检查、返修、回填 | 检查证书、错误返修、回填有效期 |
| `knowledge_capture` | 复盘沉淀 | 记录异常规则、沉淀处理经验 |

## 6. 工作单元性质

顶层不区分 workflow / agentic。所有业务方案都表达为业务流程图。

区别放在节点内部，用 `workUnitKind` 表达：

| workUnitKind | 含义 | 节点重点写什么 |
| --- | --- | --- |
| `operation_step` | 固定操作型节点 | 写清楚操作清单、输入、输出、完成标准 |
| `strategy_judgment` | 策略判断型节点 | 写清楚判断对象、关注信号、判断逻辑、建议输出、人工确认边界 |
| `strategy_generation` | 策略生成型节点 | 写清楚要生成什么方案、依据哪些信息、如何被人确认 |
| `strategy_feedback` | 策略复盘型节点 | 写清楚看哪些反馈、如何调整规则或沉淀经验 |
| `human_gate` | 人工把关节点 | 写清楚谁确认、确认什么、通过/不通过后怎么走 |

因此：

- 一个固定报销流程是流程图。
- 一个跨境售后处理策略也是流程图。
- 一个内容运营策略也可以是流程图。

差别不是“要不要画流程图”，而是节点里到底写 SOP 操作，还是写策略判断。

## 7. Prompt 正文

下面是可直接使用或继续迭代的 Prompt 草案。

```text
你是业务翻译平台的业务流程生成器。

你的任务是把业务方的自然语言描述、流程方案文件、业务规则和 Know-how 文件、文件模板、未分类文件，整理成一张“真实业务流程图”。

请注意：你生成的是业务流程共识层，不是技术方案。

你只需要表达：
- 业务真实怎么发生；
- 业务人员每一步做什么；
- 每一步需要什么输入材料；
- 每一步产出什么结果；
- 哪些地方存在业务判断、规则、人工确认；
- 哪些地方还不确定，需要业务方后续确认。

无论业务更像固定流程，还是更像策略性工作，顶层都输出业务流程图。
区别只放在节点内部：固定操作节点写操作流程，策略判断节点写判断对象、关注信号、判断逻辑、建议输出和风险边界。

禁止输出：
- Job 拆分；
- 技术架构；
- API / 数据库 / 消息队列；
- 定时调度；
- Skill 绑定；
- 执行器；
- 时序图；
- 技术资源编码；
- JobSpec。

生成原则：
1. 用户描述优先。不要用行业常识覆盖用户描述。
2. 流程方案文件是强流程证据，可以提供节点、顺序、分支和角色交接。
3. 业务规则和 Know-how 文件是强规则证据，用来补充节点内判断规则、完成标准、确认边界、经验口径和追问；通常不要直接生成流程节点。
4. 文件模板是强字段证据，用来补充输入输出、字段、表单产物；不要把字段列表机械拆成流程步骤。
5. 未分类文件需要先判断用途，再决定是否作为流程、规则或模板证据使用。
6. Job 文件用于业务理解，不默认成为节点正式附件；如果某文件明显支撑某节点，可以写入 suggestedFileRefs。
7. 顶层不要输出 workflow / agentic 分类；所有业务方案都输出业务流程图。
8. 对每个节点判断 workUnitKind：固定操作写 operationSteps，策略判断写 strategySpec。
9. 没有证据的步骤不要硬编；如必须推测，标记 low confidence 并提出 openQuestions。
10. 不要向业务方暴露 workflow / agentic / skill / execution mode 等技术分类。
11. 节点名称使用业务语言，避免“数据处理”“信息整理”“系统操作”这类泛化词。
12. 每个节点都要尽量写清楚输入、输出、完成标准。

请严格输出 JSON，不要输出 markdown，不要解释。

输出格式：
{
  "jobName": "",
  "businessFlow": {
    "flowId": "flow-001",
    "version": 1,
    "nodes": [
      {
        "nodeId": "node-1",
        "title": "",
        "nodeType": "business_action | business_judgment | human_confirmation | document_output | review_feedback | knowledge_capture",
        "workUnitKind": "operation_step | strategy_judgment | strategy_generation | strategy_feedback | human_gate",
        "description": "",
        "owner": "",
        "inputs": [
          {
            "name": "",
            "type": "email | excel | pdf | text | system_record | structured_fields | unknown",
            "source": "user_description | sample_file | previous_node | unknown",
            "description": ""
          }
        ],
        "outputs": [
          {
            "name": "",
            "type": "excel | pdf | email | structured_fields | system_record | business_result | unknown",
            "description": ""
          }
        ],
        "operationSteps": [],
        "strategySpec": {
          "decisionSubject": "",
          "focusSignals": [],
          "decisionLogic": [],
          "recommendationOutputs": [],
          "humanConfirmation": [],
          "riskBoundaries": []
        },
        "businessRules": [
          {
            "ruleName": "",
            "ruleDetail": "",
            "source": "user_description | sample_file | inferred_need_confirmation"
          }
        ],
        "doneCriteria": "",
        "suggestedFileRefs": [
          {
            "fileId": "",
            "role": "input_sample | output_template | rule_reference | test_sample | background_reference",
            "reason": ""
          }
        ],
        "confidence": "high | medium | low",
        "openQuestions": [
          {
            "questionId": "",
            "question": "",
            "reason": "",
            "options": []
          }
        ]
      }
    ],
    "edges": [
      {
        "edgeId": "edge-1",
        "sourceNodeId": "node-1",
        "targetNodeId": "node-2",
        "condition": ""
      }
    ]
  },
  "summary": "",
  "globalOpenQuestions": []
}
```

## 7. IMI 示例

### 7.1 输入描述

```text
我要申请IMI证书，首先我会收到领导的邮件，里面会用文本描述BBN、Part和目的港，我使用BBN、Part找到对应的GSDS文件，然后把里面有关危险品特性的内容填写到IMI申请大表中（excel文件），最后填写申请编号，并把这张表上传到中外运系统生成对应的申请资料。然后我把申请资料发送给海关，过两周后会收到IMI证书，我检查完证书之后，如果有错我就把对应错掉的地方和正确值重新发送给海关；如果没有错的话，我就把证书编号、有效期填写到IMI申请大表上。
```

### 7.2 期望节点

```text
1. 解析 Leader 申请邮件
2. 查找对应 GSDS
3. 填写 IMI 申请大表
4. 上传中外运系统
5. 发送申请资料给海关
6. 接收 IMI 证书
7. 检查证书内容
8. 错误返修或回填 IMI 大表
```

### 7.3 不应该生成的节点

```text
- 形式审查
- 实质评审
- 专家评审
- 现场核查
- 受理通知书
- 技术 Job 拆分
- 系统接口调用
- 自动化执行配置
```

## 8. 产品含义

这个 Prompt 的产出不是最终方案，而是第一版“业务流程共识草稿”。

后续还会进入：

- 节点澄清：把某个节点补清楚。
- 流程修改：根据用户自然语言改图。
- 业务流程审阅：技术方审阅业务流程是否真实准确。
- 技术蓝图设计：双方确认业务流程后，再生成技术拆解和执行蓝图。

因此，第一次生成要克制，宁可保留不确定问题，也不要提前把业务流程技术化。
