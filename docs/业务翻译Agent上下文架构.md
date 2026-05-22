# 业务翻译 Agent 上下文架构

> 版本：2026-05-19
>
> 本文档按当前 demo 的文件分类设计：流程方案、业务规则和 Know-how、文件模板、未分类文件。
>
> 这里假设底层 Agent 具备类似 Cursor Agent / Codex 的能力：可以看到文件清单，可以按文件路径读取文件，也可以按任务需要决定读哪些文件、读到什么程度。

## 1. 先明确产品边界

业务方上传文件，不是在给一次 Prompt 临时塞附件，而是在给当前 Job 补充材料。

但第一阶段不需要做复杂的企业知识库，也不需要把文件类型拆得很细。对业务老师来说，能理解并愿意选择的分类只有三类：

| 文件分类 | 业务老师怎么理解 | 常见例子 | Agent 应该怎么用 |
| --- | --- | --- | --- |
| 流程方案 | 这件事平时怎么一步步做 | SOP、流程图、操作手册、录屏转写、Excel 里的流程说明 | 优先用于生成流程节点、顺序、分支、角色交接 |
| 业务规则和 Know-how | 这件事怎么判断、有什么经验口径 | 校验规则、审批口径、字段填写规则、注意事项、常见错误案例 | 用于补充节点里的判断规则、确认边界、风险点和追问 |
| 文件模板 | 这件事要填写、提交、生成或检查的文件 | Excel 模板、申请表、证书样例、提交表单、输出报告模板 | 用于理解输入输出、字段结构、产出格式，不直接拆成流程步骤 |
| 未分类文件 | 业务老师不确定放哪类 | 说不清用途的 PDF、Excel、截图、邮件附件 | Agent 先判断用途，再决定是否当作流程、规则或模板使用 |

所以，第一阶段的上下文架构应该围绕这四类文件，不应该再扩展出一堆用户界面里不存在的分类。

## 2. 总体上下文结构

```text
BusinessTranslationAgentContext
├─ instructionContext     当前阶段 Agent 要做什么
├─ jobContext             当前 Job 的基础信息
├─ jobFileGroups          当前 Job 的文件分组和分类定义
├─ readingPolicy          Agent 如何选择和读取文件
├─ stageMemory            当前阶段已有结论、用户补充和修改记录
├─ outputContract         本阶段必须输出什么
└─ guardrails             禁止生成什么、不能误用什么
```

重点不是“把所有文件全文塞进 Prompt”，而是把文件清单、分类和使用规则交给 Agent。

Agent 可以自己读文件，但它需要知道：

- 哪些文件更像流程依据。
- 哪些文件只是规则或经验。
- 哪些文件只是模板或字段结构。
- 哪些文件还不确定，不能乱用。

## 3. Job 文件上下文

当前 demo 里，文件不需要表现成复杂文件系统。可以先抽象成一个 Job 文件池：

```json
{
  "jobId": "job-imi-001",
  "jobName": "IMI证书申请流程",
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
    },
    {
      "category": "uncategorized",
      "label": "未分类文件",
      "definition": "业务方暂时不确定用途的材料。Agent 需要先判断它更像流程、规则还是模板，再决定如何使用。",
      "files": [
        {
          "fileId": "file-004",
          "fileName": "Leader邮件样例.eml",
          "path": "/uploads/Leader邮件样例.eml"
        }
      ]
    }
  ]
}
```

这个结构对 Agent 足够了。

它不需要提前拿到每个文件的完整摘要。它只需要知道分类定义、每个分类下有哪些文件，以及文件在哪里。

## 4. 文件读取策略

Agent 有读文件能力，但不能乱读、乱推断。

### 4.1 生成业务流程图时

读取优先级：

1. 先读用户自然语言描述。
2. 如果有流程方案文件，优先读取流程方案。
3. 如果节点输入输出不清楚，再读取文件模板。
4. 如果节点判断规则不清楚，再读取业务规则和 Know-how。
5. 未分类文件只在文件名或用户描述提示它相关时读取；读取后先判断用途。

使用规则：

- 流程方案可以生成节点和顺序。
- 业务规则和 Know-how 只补充节点内规则，不直接生成节点。
- 文件模板只补充输入、输出、字段和产物，不把字段列表拆成节点。
- 未分类文件必须先判断用途，不能默认当作流程方案。

### 4.2 节点澄清时

读取优先级：

1. 当前节点已经引用或提到的文件。
2. 与当前节点输入输出相关的文件模板。
3. 与当前节点判断逻辑相关的业务规则和 Know-how。
4. 必要时回看流程方案，确认这个节点在整体流程中的位置。

节点澄清的目标不是重画整张流程图，而是补清楚这个节点：

- 这一步处理什么。
- 需要哪些输入。
- 产生什么结果。
- 怎么判断。
- 什么情况需要人工确认。
- 哪些信息还缺。

### 4.3 流程修改时

用户说“把这一步改成先查 GSDS 再填表”时，Agent 不应该重新读取所有文件。

它只需要：

- 理解用户修改意图。
- 找到目标节点或目标边。
- 如修改涉及文件依据，再读取相关文件。
- 输出局部 delta。

### 4.4 技术审阅时

技术方第一阶段不是拆 Job，也不是生成技术方案。

技术审阅 Agent 应该读取文件来判断：

- 业务流程是否真实。
- 节点输入输出是否明确。
- 判断规则是否足够。
- 文件模板是否支撑当前描述。
- 哪些地方需要业务方补充。

这个阶段可以引用文件证据，但不输出技术实现。

### 4.5 技术蓝图设计时

只有当业务流程被双方确认后，才进入技术蓝图设计。

这时 Agent 才可以更深入读取：

- 文件模板的 sheet、字段、样例行。
- 业务规则文件中的校验条件。
- 流程方案中的人机交接点。
- 未分类文件中被确认有用的材料。

这个阶段才讨论：

- 是否拆成多个技术 Job。
- 哪些节点自动化。
- 哪些节点需要人工确认。
- 需要哪些接口、脚本、解析器或系统能力。
- 是否生成时序图和导出蓝图。

## 5. 第一次业务流程生成上下文

第一次进入业务翻译阶段时，Agent 收到的上下文应该长这样：

```json
{
  "stage": "business_flow_generation",
  "instructionContext": {
    "role": "业务流程生成 Agent",
    "goal": "把用户描述和当前 Job 文件整理成真实业务流程图",
    "notGoal": [
      "不要生成技术方案",
      "不要拆分技术 Job",
      "不要生成时序图",
      "不要向业务方暴露 workflow / agentic 等技术分类"
    ]
  },
  "jobContext": {
    "userDescription": "我要申请IMI证书，首先会收到领导邮件...",
    "currentRole": "business_user",
    "currentStage": "业务流程生成"
  },
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
  ],
  "readingPolicy": {
    "workflow_plan": "优先读取，用于流程节点、顺序、分支、角色交接",
    "business_rule_knowhow": "按需读取，用于节点判断规则、确认边界、风险点",
    "file_template": "按需读取结构，用于输入输出、字段、表单产物",
    "uncategorized": "先判断用途，再决定是否使用"
  },
  "outputContract": {
    "schemeType": "business_flow_graph",
    "businessFlow": "统一的业务流程图",
    "nodeConfidence": "每个节点的信息完整度和追问",
    "fileUseLog": "说明使用了哪些文件以及用途"
  }
}
```

## 6. 给 Agent 的业务流程生成 Prompt

```text
你是业务翻译平台的业务流程生成 Agent。

你可以读取当前 Job 中的文件。你会收到 jobFileGroups，其中包含文件分类定义，以及每个分类下的文件组。

当前文件分类只有四种：
1. workflow_plan：流程方案。包括 SOP、流程图、操作手册、录屏转写等。
2. business_rule_knowhow：业务规则和 Know-how。包括判断标准、校验规则、审批口径、经验规则、注意事项。
3. file_template：文件模板。包括 Excel 模板、申请表、证书样例、系统导入模板、输出报告模板。
4. uncategorized：未分类文件。需要你先判断用途，再决定怎么使用。

你的任务是生成真实业务流程图，不是技术方案。

无论这件事更像固定流程，还是更像策略性/判断性工作，顶层都输出业务流程图。

区别只体现在节点内部：
- 固定操作节点：说明这一步怎么做、输入是什么、产出是什么、完成标准是什么。
- 策略判断节点：说明这一步要判断什么、看哪些信号、怎么形成建议、什么情况需要人工确认、风险边界是什么。

请按以下方式工作：

1. 先阅读用户自然语言描述，提取业务目标、起点、关键动作、结果。
2. 查看 jobFileGroups，先理解每个分类的 definition，再查看该分类下的 files。
3. 如果存在 workflow_plan 文件，优先读取，用它校正流程节点、顺序、分支和角色交接。
4. 如果需要理解规则、例外情况、校验标准，再读取 business_rule_knowhow 文件。
5. 如果需要确认输入输出、字段、表单结构或最终产物，再读取 file_template 文件。
6. 如果文件是 uncategorized，先根据文件名、内容开头和用户描述判断它更像哪一类，再谨慎使用。
7. 如果用户描述和文件内容冲突，保留冲突点，作为待确认问题，不要擅自覆盖。

禁止事项：

- 不要把业务规则文件直接拆成流程节点。
- 不要把 Excel 字段列表直接拆成流程节点。
- 不要把未分类文件默认当作流程方案。
- 不要补充文件里没有、用户也没说过的监管环节或专业审查环节。
- 不要生成技术 Job 拆分、接口、数据库、消息队列、时序图。

输出 JSON：

{
  "schemeType": "business_flow_graph",
  "jobName": "",
  "flow": {
    "nodes": [
      {
        "id": "node-1",
        "label": "",
        "workUnitKind": "operation_step | strategy_judgment | strategy_generation | strategy_feedback | human_gate",
        "description": "",
        "inputs": [],
        "outputs": [],
        "operationSteps": [],
        "strategySpec": {
          "decisionSubject": "",
          "focusSignals": [],
          "decisionLogic": [],
          "recommendationOutputs": [],
          "humanConfirmation": [],
          "riskBoundaries": []
        },
        "rules": [],
        "sourceFiles": [
          {
            "fileId": "",
            "fileName": "",
            "usedAs": "process | rule | template | reference",
            "reason": ""
          }
        ]
      }
    ],
    "edges": []
  },
  "nodeConfidence": [
    {
      "nodeId": "node-1",
      "confidence": "high | medium | low",
      "reason": "",
      "questions": []
    }
  ],
  "fileUseLog": [
    {
      "fileId": "",
      "fileName": "",
      "category": "workflow_plan | business_rule_knowhow | file_template | uncategorized",
      "usedAs": "process | rule | template | reference | not_used",
      "reason": ""
    }
  ],
  "globalOpenQuestions": []
}
```
