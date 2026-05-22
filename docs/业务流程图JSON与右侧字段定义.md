# 业务流程图 JSON 与右侧字段定义

> MVP 版本。
>
> 本文档定义业务流程生成 Agent 的输出 JSON schema，以及业务方在右侧节点详情面板中看到的 tab、字段、字段含义和 schema 映射。
>
> 这里讨论的是业务流程澄清阶段，不是技术方案阶段，也不是最终 JobSpec。Agent 和业务方只需要表达真实业务流程、节点输入输出、操作步骤、业务规则和策略判断规则。

---

## 1. 设计结论

MVP 阶段只保留两类 `workUnitKind`：

```ts
type WorkUnitKind = "sop_step" | "strategy_step";
```

`workUnitKind` 只决定右侧第三个 tab 的表单结构，不表示这一步未来由人、AI、脚本还是系统执行。

| workUnitKind | 适用节点 | 第三个 tab |
| --- | --- | --- |
| `sop_step` | 固定业务步骤、SOP、填表、查资料、发邮件、打印盖章、等待回传、回填归档 | 操作与规则 |
| `strategy_step` | 需要根据多项依据形成判断、分类、建议或处理策略的节点 | 策略判断 |

业务流程图里的条件分支优先放在线上表达，例如“MSDS/SDS 缺失”“证书核对无误”。后续技术阶段再把这些自然语言条件翻译成结构化 route condition 或技术流程图里的条件分支节点。

MVP 约束：

- `businessFlow.edges` 是流程流向的唯一权威。
- `outputs[].flowsTo` 只作为数据依赖备注，不作为流程图连线来源。
- 业务 DSL 不定义 `start` / `end` 节点。所有节点统一是业务步骤，开始和结束由前端布局或后端渲染层根据入度、出度推导。
- 后端保存前应规范化 `stepIndex` 和 `totalSteps`，不要完全信任 Agent 生成值。
- `sop_step` 必须有 `sopSpec`；`strategy_step` 必须有 `strategySpec`。
- `style: "loop"` 的线用于回流或周期性续办，布局时应走主流程外侧，避免打乱主链路。

---

## 2. Agent 输出 JSON Schema

业务流程生成 Agent 必须输出一个完整 JSON 对象。Agent 不输出 ReactFlow 的 `position`，前端负责布局。Agent 也不输出节点 `type`，例如 `start`、`end`、`task`、`decision`；业务图节点统一是业务步骤。

```ts
interface BusinessFlowAgentOutput {
  artifactType: "business_flow_clarification";
  projectName: string;
  originalPrompt?: string;
  businessFlow: {
    flowId: string;
    version: number;
    nodes: BusinessFlowNode[];
    edges: BusinessFlowEdge[];
  };
  summary?: string;
  openQuestions?: OpenQuestion[];
}
```

### 2.1 节点 Schema

```ts
interface BusinessFlowNode {
  nodeId: string;
  label: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  workUnitKind: "sop_step" | "strategy_step";
  estimatedTime?: string;
  inputs: BusinessInput[];
  outputs: BusinessOutput[];
  sopSpec?: SopSpec;
  strategySpec?: StrategySpec;
  confidence?: "high" | "medium" | "low";
  openQuestions?: OpenQuestion[];
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `nodeId` | 是 | 节点稳定 ID，例如 `imi-node-1` |
| `label` | 是 | 节点短名称，显示在画布卡片和右侧标题 |
| `description` | 是 | 用业务语言说明这一步做什么，不写技术实现 |
| `stepIndex` | 是 | 当前第几步；后端保存前按 `nodes` 数组顺序重算 |
| `totalSteps` | 是 | 总步骤数；后端保存前按 `nodes.length` 重算 |
| `workUnitKind` | 是 | 第三个 tab 的表单结构类型 |
| `estimatedTime` | 否 | 业务人员感知的耗时或等待时间 |
| `inputs` | 是 | 本步开始前需要的资料、文件、字段或上游结果 |
| `outputs` | 是 | 本步完成后形成的交付物或业务结果 |
| `sopSpec` | `sop_step` 必填 | SOP 型节点的操作步骤和业务规则；`workUnitKind = "sop_step"` 时 validator 必须校验存在 |
| `strategySpec` | `strategy_step` 必填 | 策略型节点的判断依据、判断流程、升级条件；`workUnitKind = "strategy_step"` 时 validator 必须校验存在 |
| `confidence` | 否 | Agent 对该节点的把握程度 |
| `openQuestions` | 否 | 需要业务方确认的问题 |

### 2.2 输入 Schema

```ts
interface BusinessInput {
  inputId: string;
  name: string;
  description?: string;
  required: boolean;
  source: "user" | "previous_step" | "default";
  sourceDetail?: string;
  dataType?: "email" | "xlsx" | "pdf" | "file" | "file_bundle" | "folder" | "json" | "text" | "unknown";
  subFields?: BusinessSubField[];
  exampleFileRefs?: FileRef[];
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `inputId` | 是 | 输入项稳定 ID |
| `name` | 是 | 输入名称，例如 `IMI 申请大表` |
| `description` | 否 | 输入说明 |
| `required` | 是 | 缺失时是否不能进入本节点 |
| `source` | 是 | 输入来自用户、上一步还是默认资料 |
| `sourceDetail` | 否 | 来源补充说明，例如“来自上一节点的证书核对结果” |
| `dataType` | 否 | 业务侧格式提示 |
| `subFields` | 否 | 复合输入内部字段 |
| `exampleFileRefs` | 否 | 样例文件引用 |

### 2.3 输出 Schema

```ts
interface BusinessOutput {
  outputId: string;
  name: string;
  description?: string;
  dataType?: "email" | "xlsx" | "pdf" | "file" | "file_bundle" | "folder" | "json" | "text" | "unknown";
  subFields?: BusinessSubField[];
  flowsTo?: string[];
  exampleFileRefs?: FileRef[];
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `outputId` | 是 | 输出项稳定 ID |
| `name` | 是 | 输出名称，例如 `MSDS/SDS 查找结果` |
| `description` | 否 | 输出内容说明 |
| `dataType` | 否 | 输出格式提示 |
| `subFields` | 否 | 复合输出内部字段 |
| `flowsTo` | 否 | 数据依赖备注：该输出会被哪些下游节点使用；不作为流程图连线权威 |
| `exampleFileRefs` | 否 | 产出样例文件引用 |

### 2.4 SOP 型节点 Schema

```ts
interface SopSpec {
  operationSteps: string[];
  businessRules: string[];
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `operationSteps` | 是 | 业务人员实际怎么做，按步骤写 |
| `businessRules` | 是 | 本步遵守的业务规则、例外处理、注意事项 |

### 2.5 策略型节点 Schema

```ts
interface StrategySpec {
  basis: string[];
  judgmentProcess: string[];
  escalationConditions: string[];
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `basis` | 是 | 策略/判断依据：做判断时看哪些材料、字段、信号或上下文 |
| `judgmentProcess` | 是 | 判断流程：按什么顺序判断，什么条件对应什么结论或分支 |
| `escalationConditions` | 是 | 异常/升级条件：资料不足、规则冲突、高风险、超权限、无法判断时怎么办 |

策略型节点的判断结果不放在 `strategySpec` 中，而是放在第二个 tab 的 `outputs` 里，例如 `根因判断结果`、`处理策略建议`、`风险等级判断`。

### 2.6 边 Schema

```ts
interface BusinessFlowEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: string;
  style?: "normal" | "success" | "error" | "loop";
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `edgeId` | 是 | 连线稳定 ID |
| `sourceNodeId` | 是 | 起点节点 ID |
| `targetNodeId` | 是 | 终点节点 ID |
| `label` | 否 | 显示在线上的业务标签 |
| `condition` | 否 | 进入该分支的业务条件 |
| `style` | 否 | 线条语义，成功/失败/回流等 |

`businessFlow.edges` 是流程图连线的唯一权威。前端画线、后端生成技术流程时，都应以 `edges` 为准。

`outputs[].flowsTo` 只说明某个输出可能被哪些节点消费，用于辅助人理解数据依赖。后端 validator 只需要校验 `flowsTo` 中引用的节点 ID 存在，不要求它完全等于 `edges` 的目标节点集合。

`style: "loop"` 表示回流、返工或周期性续办。渲染时应把 loop 线走主流程外侧；不要把 loop 当成普通向下连线，否则会拉乱主流程布局。

### 2.7 公共子结构

```ts
interface BusinessSubField {
  key: string;
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
}

interface FileRef {
  fileId: string;
  name?: string;
  role?: "input_sample" | "output_template" | "rule_reference" | "background_reference";
}

interface OpenQuestion {
  questionId: string;
  question: string;
  reason?: string;
  options?: string[];
}
```

### 2.8 后端保存与校验规则

后端接收 Agent 输出后，保存前需要做一次规范化和校验。

#### 规范化

| 规则 | 说明 |
| --- | --- |
| 重算 `stepIndex` | 按 `businessFlow.nodes` 数组顺序，从 1 开始重算 |
| 重算 `totalSteps` | 统一设为 `businessFlow.nodes.length` |
| 布局字段不入库为业务事实 | `position` 由前端或渲染层生成，不属于业务 DSL |
| 不生成 start/end 节点 | 开始节点 = 入度为 0 的节点；结束节点 = 出度为 0 的节点，由渲染层推导 |

#### 校验

| 规则 | 说明 |
| --- | --- |
| 节点 ID 唯一 | `nodes[].nodeId` 不可重复 |
| 边引用节点存在 | `edges[].sourceNodeId` 和 `edges[].targetNodeId` 必须存在于节点集合 |
| `flowsTo` 引用节点存在 | 只校验存在性，不要求与 `edges` 完全一致 |
| `sop_step` 必须有 `sopSpec` | 且 `operationSteps`、`businessRules` 至少各有一项 |
| `strategy_step` 必须有 `strategySpec` | 且 `basis`、`judgmentProcess`、`escalationConditions` 至少各有一项 |
| 节点至少一个输出 | 每个节点必须有 `outputs.length > 0` |
| loop 线只用于回流 | `style = "loop"` 表示回流、返工或周期性续办，前端布局走主流程外侧 |

---

## 3. 右侧面板 Tab 与 Schema 映射

业务方选中一个节点后，右侧面板分为三个 tab。

### 3.1 Tab 1：本步说明

| UI 字段 | Schema 路径 | 含义 | 示例 |
| --- | --- | --- | --- |
| 节点名称 | `node.label` | 这一步业务动作的短名称 | `查找 MSDS/SDS` |
| 节点描述 | `node.description` | 用一句话说明这一步做什么 | `在公盘或 SharePoint SDS 文件夹中查找对应 MSDS/SDS，找到后打印盖章备用` |
| 预计耗时 | `node.estimatedTime` | 业务人员感知的处理时间或等待时间 | `10 分钟/品名` |
| 节点类型 | `node.workUnitKind` | 决定第三个 tab 是 SOP 表单还是策略表单 | `sop_step` |

填写原则：

- `description` 只写业务事实，不写技术方案。
- 如果出现“如果/否则/缺失/有错/无错/不一致”等会改变流程走向的条件，应拆到线上的 `label` 或 `condition`。

### 3.2 Tab 2：资料与产出

#### 输入

| UI 字段 | Schema 路径 | 含义 | 示例 |
| --- | --- | --- | --- |
| 输入名称 | `node.inputs[].name` | 本步开始前需要什么 | `IMI 申请需求信息` |
| 输入说明 | `node.inputs[].description` | 输入内容说明 | `品名、目的港、运输方式、BBN、Part 等字段` |
| 是否必填 | `node.inputs[].required` | 缺失时是否不能继续 | `true` |
| 来源 | `node.inputs[].source` | 来自用户、上一步或默认资料 | `previous_step` |
| 来源补充 | `node.inputs[].sourceDetail` | 对来源的自然语言补充 | `来自明确需求内容节点` |
| 数据类型 | `node.inputs[].dataType` | 格式提示 | `xlsx`、`pdf`、`email` |
| 子字段 | `node.inputs[].subFields` | 复合输入内部字段 | `BBN`、`Part`、`目的港` |
| 样例文件 | `node.inputs[].exampleFileRefs` | 可供业务方或 Agent 参考的样例 | `IMI申请大表.xlsx` |

#### 输出

| UI 字段 | Schema 路径 | 含义 | 示例 |
| --- | --- | --- | --- |
| 输出名称 | `node.outputs[].name` | 本步完成后形成什么 | `MSDS/SDS 查找结果` |
| 输出说明 | `node.outputs[].description` | 输出中包含哪些业务信息 | `是否找到、是否已打印盖章、是否需要品控补充` |
| 数据类型 | `node.outputs[].dataType` | 格式提示 | `json`、`file_bundle` |
| 子字段 | `node.outputs[].subFields` | 复合输出内部字段 | `is_found`、`need_qc_followup` |
| 数据依赖备注 | `node.outputs[].flowsTo` | 该输出可能被哪些下游节点消费；不是流程图连线权威 | `["imi-node-4"]` |
| 样例文件 | `node.outputs[].exampleFileRefs` | 产出样例 | `IMI证书样例.pdf` |

填写原则：

- `inputs` 描述“开始本步需要什么”。
- `outputs` 描述“完成本步交付什么”。
- 每个节点至少要有一个明确输出。
- 会驱动分支的输出要尽量结构化，例如 `is_found`、`verification_passed`。
- 流程流向只看 `businessFlow.edges`；`outputs[].flowsTo` 仅用于辅助说明数据依赖。

### 3.3 Tab 3A：操作与规则（sop_step）

当 `node.workUnitKind = "sop_step"` 时，第三个 tab 显示“操作与规则”。

| UI 字段 | Schema 路径 | 含义 | 示例 |
| --- | --- | --- | --- |
| 操作步骤 | `node.sopSpec.operationSteps[]` | 业务人员实际按什么步骤做 | `在公盘或 SharePoint SDS 文件夹中查找相关 MSDS/SDS` |
| 业务规则 | `node.sopSpec.businessRules[]` | 本步遵守的规则、例外处理、注意事项 | `找不到 MSDS/SDS 时，需要邮件联系品控提供` |
SOP 型节点可以包括查资料、检查文件、发邮件、等待回传、回填归档。只要第三个 tab 本质上仍然是“操作步骤 + 业务规则”，都归为 `sop_step`。

SOP 节点的完成状态通过 Tab 2 的 `outputs` 和 `outputs[].description` 表达，不在第三个 tab 另设完成标准字段。

### 3.4 Tab 3B：策略判断（strategy_step）

当 `node.workUnitKind = "strategy_step"` 时，第三个 tab 显示“策略判断”。

| UI 字段 | Schema 路径 | 含义 | 示例 |
| --- | --- | --- | --- |
| 策略/判断依据 | `node.strategySpec.basis[]` | 做判断时看哪些材料、字段、信号或上下文 | `偏差记录`、`泄漏照片`、`批次信息` |
| 判断流程 | `node.strategySpec.judgmentProcess[]` | 按什么顺序判断，什么条件对应什么结论或分支 | `先看是否有明显包装破损，再看是否集中发生在同批次` |
| 异常/升级条件 | `node.strategySpec.escalationConditions[]` | 资料不足、规则冲突、高风险、超权限、无法判断时怎么办 | `涉及供应商责任时升级质量负责人` |

策略型节点的“输出结果”放在 Tab 2 的 `outputs` 里，不放在第三个 tab。例如：

```ts
outputs: [
  {
    outputId: "out-rca-1",
    name: "根因判断结果",
    description: "Top 3 可能根因、判断依据、推荐 CAPA、是否需要升级",
    dataType: "json"
  }
]
```

---

## 4. IMI 申请流程示例

IMI 申请流程是 SOP 型流程。虽然里面有查找、发邮件、核对、回填、续申请等不同动作，但右侧第三个 tab 都是在填写“操作步骤 + 业务规则”，因此节点统一使用 `sop_step`。

```json
{
  "artifactType": "business_flow_clarification",
  "projectName": "IMI 证书申请流程",
  "businessFlow": {
    "flowId": "flow-imi-certificate",
    "version": 1,
    "nodes": [
      {
        "nodeId": "imi-node-1",
        "label": "明确需求内容",
        "description": "收到可乐邮件或最新 loading plan 后，确认危险品中英文品名、目的港和适用运输方式。",
        "stepIndex": 1,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "10 分钟/品名",
        "inputs": [
          {
            "inputId": "in-1-1",
            "name": "可乐邮件或最新 loading plan",
            "description": "通知有新的危险品需要申请 IMI 证书",
            "required": true,
            "source": "user",
            "dataType": "email"
          }
        ],
        "outputs": [
          {
            "outputId": "out-1-1",
            "name": "IMI 申请需求信息",
            "description": "危险品中英文品名、目的港、适用运输方式、BBN、Part 等申请信息",
            "dataType": "json",
            "flowsTo": ["imi-node-2"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "查看可乐邮件通知或最新 loading plan",
            "确认危险品中文品名和英文品名",
            "确认目的港和适用运输方式",
            "整理 BBN、Part 等后续填写 IMI 大表所需信息"
          ],
          "businessRules": [
            "品名、目的港或运输方式不明确时，不能直接进入 IMI 申请资料填写"
          ]
        }
      },
      {
        "nodeId": "imi-node-2",
        "label": "查找 MSDS/SDS",
        "description": "在公盘或 SharePoint SDS 文件夹中查找对应 MSDS/SDS，找到后打印盖章备用。",
        "stepIndex": 2,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "10 分钟/品名",
        "inputs": [
          {
            "inputId": "in-2-1",
            "name": "IMI 申请需求信息",
            "required": true,
            "source": "previous_step",
            "sourceDetail": "来自明确需求内容节点",
            "dataType": "json"
          },
          {
            "inputId": "in-2-2",
            "name": "公盘或 SharePoint SDS 文件夹",
            "description": "The Coca-Cola Company\\Greater China Bottler Sharepoint - SDS",
            "required": true,
            "source": "default",
            "dataType": "folder"
          }
        ],
        "outputs": [
          {
            "outputId": "out-2-1",
            "name": "MSDS/SDS 查找结果",
            "description": "是否找到对应 MSDS/SDS、是否已打印盖章、是否需要品控补充",
            "dataType": "json",
            "subFields": [
              {
                "key": "is_found",
                "name": "是否找到",
                "type": "boolean",
                "required": true
              },
              {
                "key": "need_qc_followup",
                "name": "是否需要品控补充",
                "type": "boolean",
                "required": true
              }
            ],
            "flowsTo": ["imi-node-3", "imi-node-4"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "在公盘或 SharePoint SDS 文件夹中查找相关 MSDS/SDS",
            "找到后打印并盖章备用",
            "找不到时记录缺失情况",
            "确认该 BBN 对应的饮料主剂大类"
          ],
          "businessRules": [
            "公盘中找不到 MSDS/SDS 时，需要邮件联系品控提供",
            "业务侧不把这一步抽象成查询某个技术主库"
          ]
        }
      },
      {
        "nodeId": "imi-node-3",
        "label": "邮件品控补 MSDS",
        "description": "公盘找不到 MSDS/SDS 时，邮件联系品控提供资料，并确认 BBN 对应的饮料主剂大类。",
        "stepIndex": 3,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "待品控反馈",
        "inputs": [
          {
            "inputId": "in-3-1",
            "name": "MSDS/SDS 缺失记录",
            "required": true,
            "source": "previous_step",
            "sourceDetail": "来自查找 MSDS/SDS 节点",
            "dataType": "json"
          }
        ],
        "outputs": [
          {
            "outputId": "out-3-1",
            "name": "品控提供的 MSDS/SDS",
            "description": "品控回复的 MSDS/SDS 文件及饮料主剂大类确认信息",
            "dataType": "file",
            "flowsTo": ["imi-node-4"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "写邮件给品控说明缺失的品名、BBN、Part",
            "要求品控提供对应 MSDS/SDS",
            "同步确认该 BBN 对应的饮料主剂大类",
            "收到资料后回到 IMI 申请资料填写"
          ],
          "businessRules": [
            "品控未提供 MSDS/SDS 前，不应继续生成正式申请资料"
          ]
        }
      },
      {
        "nodeId": "imi-node-4",
        "label": "填写 IMI 申请大表",
        "description": "在 IMI 申请大表中生成新编号，并录入物料、运输、目的港、品名、BBN、Part 和 MSDS/SDS 字段。",
        "stepIndex": 4,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "10 分钟/品名",
        "inputs": [
          {
            "inputId": "in-4-1",
            "name": "IMI 申请需求信息",
            "required": true,
            "source": "previous_step",
            "dataType": "json"
          },
          {
            "inputId": "in-4-2",
            "name": "MSDS/SDS 文件",
            "required": true,
            "source": "previous_step",
            "dataType": "file"
          },
          {
            "inputId": "in-4-3",
            "name": "IMI 申请大表",
            "required": true,
            "source": "default",
            "dataType": "xlsx"
          }
        ],
        "outputs": [
          {
            "outputId": "out-4-1",
            "name": "已填写的 IMI 申请大表",
            "description": "已按流水号生成新编号，并填入申请字段和 MSDS/SDS 相关内容",
            "dataType": "xlsx",
            "flowsTo": ["imi-node-5"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "在 IMI 申请大表中按流水号生成新的编号",
            "录入物料号、运输方式、目的港、中英文品名、BBN、Part",
            "根据 MSDS/SDS 填写颜色、状态等信息",
            "检查当前品名行的必填字段是否完整"
          ],
          "businessRules": [
            "颜色、状态等信息应来自 MSDS/SDS",
            "编号应按 IMI 申请大表现有流水号继续生成"
          ]
        }
      },
      {
        "nodeId": "imi-node-5",
        "label": "生成 IMI 申请资料",
        "description": "完成 IMI 申请大表录入后，通过系统生成 6 个 IMI 申请资料附件。",
        "stepIndex": 5,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "10 分钟/品名",
        "inputs": [
          {
            "inputId": "in-5-1",
            "name": "已填写的 IMI 申请大表",
            "required": true,
            "source": "previous_step",
            "dataType": "xlsx"
          }
        ],
        "outputs": [
          {
            "outputId": "out-5-1",
            "name": "IMI 申请资料",
            "description": "附件1委托鉴定申请表、附件2成分保密说明、附件3成分自负声明、附件4机密成分无CAS、附件5无样品声明、附件6无害声明",
            "dataType": "file_bundle",
            "flowsTo": ["imi-node-6"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "确认 IMI 申请大表已完成信息录入",
            "通过业务使用的系统生成 IMI 申请资料",
            "检查 6 个附件是否均已生成",
            "准备后续打印盖章"
          ],
          "businessRules": [
            "业务侧只表达通过系统生成申请资料，不提前假设具体系统接口或自动化方式"
          ]
        }
      },
      {
        "nodeId": "imi-node-6",
        "label": "发恒创申请 IMI",
        "description": "打印盖章 IMI 申请资料和对应 MSDS/SDS，扫描件邮件发给恒创申请 IMI 证书。",
        "stepIndex": 6,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "10 分钟/品名",
        "inputs": [
          {
            "inputId": "in-6-1",
            "name": "IMI 申请资料",
            "required": true,
            "source": "previous_step",
            "dataType": "file_bundle"
          },
          {
            "inputId": "in-6-2",
            "name": "盖章 MSDS/SDS",
            "required": true,
            "source": "previous_step",
            "dataType": "file"
          }
        ],
        "outputs": [
          {
            "outputId": "out-6-1",
            "name": "代理回传 IMI 证书电子档",
            "description": "恒创或代理后续发回的 IMI 证书电子档",
            "dataType": "file",
            "flowsTo": ["imi-node-7"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "打印并盖章 IMI 申请资料",
            "打印并盖章对应 MSDS/SDS",
            "扫描盖章件",
            "邮件发送给恒创进行 IMI 证书申请",
            "等待代理或恒创回传 IMI 证书电子档"
          ],
          "businessRules": [
            "业务侧应写清楚收件对象是恒创，不应泛化成海关或未确认的系统接口"
          ]
        }
      },
      {
        "nodeId": "imi-node-7",
        "label": "核对 IMI 证书",
        "description": "收到代理发来的 IMI 证书电子档后，核对证书内容与当初申请资料是否一致。",
        "stepIndex": 7,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "10 分钟/品名",
        "inputs": [
          {
            "inputId": "in-7-1",
            "name": "代理回传 IMI 证书电子档",
            "required": true,
            "source": "previous_step",
            "dataType": "file"
          },
          {
            "inputId": "in-7-2",
            "name": "IMI 申请资料",
            "required": true,
            "source": "previous_step",
            "dataType": "file_bundle"
          }
        ],
        "outputs": [
          {
            "outputId": "out-7-1",
            "name": "证书核对结果",
            "description": "证书内容是否与申请资料一致，以及可回填的大表字段",
            "dataType": "json",
            "flowsTo": ["imi-node-8"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "打开代理发来的 IMI 证书电子档",
            "对照当初申请资料核对证书内容",
            "确认可回填的证书编号、签发日和有效期",
            "核对无误后进入回填和存档"
          ],
          "businessRules": [
            "证书内容与当初申请资料不一致时，不应进入无误归档",
            "是否需要反馈重出证应由业务补充确认"
          ]
        }
      },
      {
        "nodeId": "imi-node-8",
        "label": "回填并命名存档",
        "description": "证书核对无误后，在 IMI 申请大表登记证书编号、签发日、有效期，并按规则命名存档。",
        "stepIndex": 8,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "10 分钟/品名",
        "inputs": [
          {
            "inputId": "in-8-1",
            "name": "证书核对结果",
            "required": true,
            "source": "previous_step",
            "dataType": "json"
          },
          {
            "inputId": "in-8-2",
            "name": "IMI 申请大表",
            "required": true,
            "source": "default",
            "dataType": "xlsx"
          }
        ],
        "outputs": [
          {
            "outputId": "out-8-1",
            "name": "更新后的 IMI 申请大表",
            "description": "已登记 IMI 证书编号、签发日、有效期",
            "dataType": "xlsx",
            "flowsTo": ["imi-node-9"]
          },
          {
            "outputId": "out-8-2",
            "name": "已归档 IMI 证书",
            "description": "按申请编号+证书编号+BBN 命名，并存放到对应海运/公路 IMI 证书文件夹",
            "dataType": "file",
            "flowsTo": ["imi-node-9"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "在 IMI 申请大表中登记 IMI 证书编号",
            "登记签发日和有效期",
            "按申请编号+证书编号+BBN 命名证书文件",
            "把证书放入对应的海运或公路 IMI 证书文件夹"
          ],
          "businessRules": [
            "只有证书核对无误后才回填和归档",
            "文件命名和存放位置应符合业务文件夹规则"
          ]
        }
      },
      {
        "nodeId": "imi-node-9",
        "label": "续申请准备",
        "description": "旧证书到期前两个月进行大批量续申请，先确认新一年申请内容是否变化，再复用前述申请流程。",
        "stepIndex": 9,
        "totalSteps": 9,
        "workUnitKind": "sop_step",
        "estimatedTime": "一个月（按 300 份证书量）",
        "inputs": [
          {
            "inputId": "in-9-1",
            "name": "已归档 IMI 证书和申请记录",
            "required": true,
            "source": "previous_step",
            "dataType": "file"
          }
        ],
        "outputs": [
          {
            "outputId": "out-9-1",
            "name": "续申请清单",
            "description": "到期前两个月需要续申请的证书和需确认变化的申请内容",
            "dataType": "xlsx",
            "flowsTo": ["imi-node-1"]
          }
        ],
        "sopSpec": {
          "operationSteps": [
            "在旧证书到期前两个月筛选需要续申请的证书",
            "按批量证书量整理续申请清单",
            "确认新一年申请内容是否变化，例如品名或运输方式变更",
            "确认后按前述步骤重新申请"
          ],
          "businessRules": [
            "续申请不是单次新申请的末尾动作，而是到期前触发的新一轮批量申请入口"
          ]
        }
      }
    ],
    "edges": [
      {
        "edgeId": "imi-e1",
        "sourceNodeId": "imi-node-1",
        "targetNodeId": "imi-node-2",
        "label": "需求已明确",
        "condition": "需求信息已确认",
        "style": "normal"
      },
      {
        "edgeId": "imi-e2",
        "sourceNodeId": "imi-node-2",
        "targetNodeId": "imi-node-4",
        "label": "MSDS/SDS 已找到",
        "condition": "已在公盘或 SharePoint SDS 文件夹中找到对应 MSDS/SDS",
        "style": "success"
      },
      {
        "edgeId": "imi-e3",
        "sourceNodeId": "imi-node-2",
        "targetNodeId": "imi-node-3",
        "label": "MSDS/SDS 缺失",
        "condition": "公盘或 SharePoint SDS 文件夹中找不到对应 MSDS/SDS",
        "style": "error"
      },
      {
        "edgeId": "imi-e4",
        "sourceNodeId": "imi-node-3",
        "targetNodeId": "imi-node-4",
        "label": "品控提供后",
        "condition": "品控已提供可用于申请的 MSDS/SDS",
        "style": "normal"
      },
      {
        "edgeId": "imi-e5",
        "sourceNodeId": "imi-node-4",
        "targetNodeId": "imi-node-5",
        "label": "大表已填写",
        "condition": "IMI 申请大表当前品名行已完整填写",
        "style": "normal"
      },
      {
        "edgeId": "imi-e6",
        "sourceNodeId": "imi-node-5",
        "targetNodeId": "imi-node-6",
        "label": "申请资料已生成",
        "condition": "6 个 IMI 申请资料附件已生成",
        "style": "normal"
      },
      {
        "edgeId": "imi-e7",
        "sourceNodeId": "imi-node-6",
        "targetNodeId": "imi-node-7",
        "label": "收到证书电子档",
        "condition": "已收到代理或恒创回传的 IMI 证书电子档",
        "style": "normal"
      },
      {
        "edgeId": "imi-e8",
        "sourceNodeId": "imi-node-7",
        "targetNodeId": "imi-node-8",
        "label": "证书核对无误",
        "condition": "IMI 证书内容与当初申请资料一致",
        "style": "success"
      },
      {
        "edgeId": "imi-e9",
        "sourceNodeId": "imi-node-8",
        "targetNodeId": "imi-node-9",
        "label": "进入到期管理",
        "condition": "证书已回填并归档",
        "style": "normal"
      },
      {
        "edgeId": "imi-e10",
        "sourceNodeId": "imi-node-9",
        "targetNodeId": "imi-node-1",
        "label": "到期前两个月续申请",
        "condition": "旧证书到期前两个月，需要发起续申请",
        "style": "loop"
      }
    ]
  },
  "summary": "IMI 申请流程是一条 SOP 型业务流程：明确需求、查找或补齐 MSDS/SDS、填写申请大表、生成申请资料、发恒创申请、核对证书、回填归档，并在旧证书到期前两个月发起续申请。"
}
```

---

## 5. 业务字段流向后续技术阶段

| 业务字段 | 后续用途 |
| --- | --- |
| `node.label` | Task 名称初稿 |
| `node.description` | Task instruction 初稿 |
| `node.inputs` | input schema 初稿 |
| `node.outputs` | output schema 初稿，也可被路由条件读取 |
| `node.inputs[].required` | schema required / optional |
| `node.inputs[].source` / `sourceDetail` | 数据依赖和上下游映射 |
| `node.workUnitKind` | 判断第三个 tab 表单结构；技术阶段可作为理解节点语义的参考 |
| `node.sopSpec.operationSteps` | SOP、Prompt、Skill 需求说明 |
| `node.sopSpec.businessRules` | 规则校验、审核策略、测试用例依据 |
| `node.strategySpec` | 策略型 Skill / 判断节点的需求说明 |
| `edges[].condition` | 后续翻译成 route condition 或条件分支节点 |

---

## 6. 业务方填写边界

业务方应该填写：

- 真实业务步骤。
- 每一步的输入资料。
- 每一步的输出交付物。
- 操作步骤。
- 业务规则。
- 策略/判断依据、判断流程、异常/升级条件。
- 条件分支和回流路径。

业务方不应该填写：

- Skill code。
- Tool code。
- RuntimeProfile。
- JobSpec task code。
- Secret。
- 重试、超时、幂等、审计等生产控制参数。
- 技术拆几个 Job。

一句话总结：

```text
业务流程图 JSON 记录“业务事实和交付物”；
右侧业务面板补齐“节点输入、输出、SOP 或策略判断字段”；
后续技术配置页消费这些字段，再生成技术流程、条件分支和执行配置。
```
