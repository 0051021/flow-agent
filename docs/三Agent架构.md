# FlowAgent 三类 Agent 设计

> 最后更新：2026-05-11
>
> 本文档聚焦 FlowAgent 中三类 Agent 的产品与架构边界：业务流程澄清 Agent、批注理解 Agent、技术评审 Agent。
>
> 相关文档：
> - 上下文架构：[`上下文架构.md`](./上下文架构.md)
> - Skill 平台架构：[`Skill架构思考.md`](./Skill架构思考.md)
> - FlowAgent 产品说明：[`FlowAgent产品说明.md`](./FlowAgent产品说明.md)

---

## 1. 核心判断

FlowAgent 里的 Agent 不应该被理解成三个不同的聊天框，而应该被理解成三个协作阶段里的不同工作角色。

一个 Agent 的成立，不只取决于 prompt，而取决于四件事：

```text
Agent = Context Architecture + Skills/Tools + Decision Boundary + Output Contract
```

- Context Architecture：它能看到什么上下文。
- Skills/Tools：它能调用什么能力。
- Decision Boundary：它不能替谁做什么判断。
- Output Contract：它输出什么格式，以及输出是否能成为结论。

其中，Context Architecture 和 Skills/Tools 决定 Agent 的能力上限；Decision Boundary 和 Output Contract 决定 Agent 的可信度。

---

## 2. 三类 Agent 总览

| Agent | 使用者 | 协作阶段 | 核心任务 | 输出权限 |
| --- | --- | --- | --- | --- |
| 业务流程澄清 Agent | 业务方 | 方案生成前 / 草稿阶段 | 把业务流程讲清楚、结构化 | 业务草案，不是技术结论 |
| 批注理解 Agent | 业务方 | 技术评审后 / 待处理阶段 | 把技术反馈翻译成业务动作 | 解释、待办、回复草稿 |
| 技术评审 Agent | 技术方 | 技术评审阶段 | 判断业务规则、技术可行性和资源缺口 | 评审建议，需技术确认 |

三者共享相似的聊天 UI，但背后的上下文、工具权限、边界和输出契约不同。

---

## 3. Agent 1：业务流程澄清 Agent

### 3.1 产品定位

业务流程澄清 Agent 的目标不是让业务方设计技术方案，而是帮助业务方把自己的流程阐述清楚。

业务方应该负责：

- 业务流程是什么。
- 每一步谁做。
- 每一步需要哪些材料、字段、文件。
- 正常流程和异常情况怎么处理。
- 业务判断规则是什么。
- 什么时候算完成。
- 哪些地方必须人工确认。

业务方不应该负责：

- 能不能自动化。
- 用什么接口。
- 绑定什么 Skill。
- 如何部署。
- 怎么写代码。
- 系统如何集成。
- 评测器怎么设计。

因此，Agent 1 的输出更准确地说是：业务流程草案、业务规则说明、待技术评审方案，而不是“技术方案”。

### 3.2 上下文架构

Agent 1 应看到的上下文：

| 上下文层 | 内容 | 用途 |
| --- | --- | --- |
| 当前会话 | 业务方自然语言描述、追问回答 | 澄清业务流程 |
| 上传材料 | Excel、PDF、邮件、截图、表格 | 抽取字段和步骤 |
| 当前流程草案 | 节点、输入输出、规则、完成标准 | 迭代结构化结果 |
| 组织/领域知识 | 常见术语、模板、历史业务模式 | 帮助归纳，但不能替代业务确认 |
| 缺口清单 | 未确认字段、异常路径、规则冲突 | 继续追问业务方 |

Agent 1 不应默认看到：

- 技术资源库细节。
- 部署环境。
- 代码仓库。
- Skill 内部实现。
- 技术平台 Job 编排细节。

### 3.3 Skills/Tools

Agent 1 允许的 Skill：

| Skill | 作用 | 输出 |
| --- | --- | --- |
| 文件解析 | 从业务文件中提取字段、表头、样例 | 字段候选、文件摘要 |
| 流程抽取 | 从描述中抽取步骤 | 业务节点草案 |
| 规则归纳 | 总结业务判断条件 | 业务规则草案 |
| 缺口提问 | 找出不清楚的业务点 | 待确认问题 |
| 节点改写 | 根据用户补充修改节点 | 更新后的业务流程 |

Agent 1 不允许的 Skill：

- 代码执行。
- 资源匹配。
- 接口探测。
- 部署判断。
- 技术可行性打分。
- 自动生成最终 JobSpec。

### 3.4 决策边界

Agent 1 可以说：

- “我理解你的流程是……”
- “这里还缺少业务规则……”
- “这个字段来源还不清楚……”
- “建议补充异常情况……”

Agent 1 不应该说：

- “这个节点可以自动化。”
- “这个系统有接口。”
- “这个方案可以上线。”
- “这个 Skill 可以直接复用。”
- “这个 Job 不需要开发。”

如果必须出现自动化相关内容，应使用弱表达：

```text
待技术判断
```

或：

```text
AI 初步提示：这一步可能具备自动化条件，但需要技术方评审确认。
```

### 3.5 输出契约

Agent 1 的主输出是业务草案：

```ts
type BusinessDraft = {
  title: string;
  description: string;
  nodes: BusinessNode[];
  edges: BusinessEdge[];
  openQuestions: BusinessQuestion[];
  confidenceFlags: ConfidenceFlag[];
};
```

节点重点表达业务信息：

```ts
type BusinessNode = {
  id: string;
  label: string;
  description: string;
  inputs: BusinessIO[];
  outputs: BusinessIO[];
  businessRules: string[];
  exceptionCases: string[];
  doneCriteria?: string;
  needsHumanConfirmation?: boolean;
  technicalReviewStatus: "pending";
};
```

Agent 1 不输出最终人机分工结论。人机分工应由技术评审 Agent 和技术方确认后写入。

---

## 4. Agent 2：批注理解 Agent

### 4.1 产品定位

批注理解 Agent 面向业务方，出现在技术方已经评审并留下批注之后。

它不是技术评审助手，而是业务理解助手。

它的任务是把技术反馈翻译成业务动作：

- 解释技术批注里的专业词。
- 总结业务需要补充什么。
- 帮业务方写回复技术方的草稿。
- 将批注关联到节点、字段、输入输出。
- 判断用户问题是否需要转给技术方。

### 4.2 上下文架构

Agent 2 应看到的上下文：

| 上下文层 | 内容 | 用途 |
| --- | --- | --- |
| 当前方案 | 已提交方案、节点、输入输出、完成标准 | 定位批注对应业务位置 |
| 当前节点 | 用户选中的节点、节点字段、节点状态 | 针对性解释 |
| 技术批注 | 技术方留下的节点批注、businessTodo、严重程度 | 生成待办和回复 |
| 流转历史 | 第几轮、谁当前持有、上一次反馈时间 | 解释当前状态 |
| 用户问题 | 当前输入内容 | 做意图判断 |

Agent 2 不应看到或不应使用：

- 技术后台细节。
- 代码仓库。
- 部署配置。
- 评测器实现。
- 未经技术方确认的可行性推断。

### 4.3 Skills/Tools

Agent 2 允许的 Skill：

| Skill | 作用 | 输出 |
| --- | --- | --- |
| 意图判断 | 判断问题是否可答、需谨慎、需转技术 | intent + policy |
| 批注解释 | 用业务语言解释技术批注 | 解释文本 |
| 术语翻译 | 翻译技术专业词 | 术语解释 |
| 待办汇总 | 从批注中汇总 businessTodo | 业务待补充项 |
| 回复草稿 | 帮业务方起草回复技术方的话 | 回复草稿 |
| 追问生成 | 对不能回答的问题生成追问技术方的话 | 技术追问草稿 |

Agent 2 不允许的 Skill：

- 代码执行。
- 技术方案生成。
- 资源匹配。
- 接口判断。
- 自动化可行性确认。
- 上线风险确认。

### 4.4 意图判断

Agent 2 必须先判断用户问题属于哪一类。

```ts
type CommentAssistantIntent =
  | "explain_comment"
  | "summarize_todo"
  | "draft_reply"
  | "locate_fields"
  | "status_summary"
  | "technical_reasoning"
  | "technical_decision";
```

处理策略：

| 意图 | 是否可答 | 处理方式 |
| --- | --- | --- |
| explain_comment | 可以 | 基于批注解释 |
| summarize_todo | 可以 | 汇总待补充项 |
| draft_reply | 可以 | 生成回复草稿 |
| locate_fields | 可以 | 指出相关节点和字段 |
| status_summary | 可以 | 总结当前流转状态 |
| technical_reasoning | 谨慎 | 只解释技术方已写内容，不做扩展判断 |
| technical_decision | 不可直接回答 | 转成追问技术方的话 |

示例：

用户问：

```text
为什么这个节点不能完全自动化？
```

如果技术批注里没有明确原因，Agent 2 应回答：

```text
当前技术批注没有明确说明不能完全自动化的原因，我不能替技术方判断。
我可以帮你整理一条追问：
“这个节点目前被标为人工处理，主要限制是系统登录权限、验证码、接口缺失，还是业务规则不稳定？”
```

### 4.5 决策边界

Agent 2 可以说：

- “这条批注的意思是……”
- “业务上你需要补充……”
- “可以这样回复技术方……”
- “这个问题当前批注没有说明，需要追问技术方……”

Agent 2 不应该说：

- “这个可以自动化。”
- “这个不能自动化。”
- “技术上一定是因为没有接口。”
- “这个可以跳过。”
- “这样改不会影响安全。”
- “可以直接上线。”

### 4.6 输出契约

Agent 2 的输出不是技术结论，而是解释与协作草稿：

```ts
type CommentAssistantOutput = {
  intent: CommentAssistantIntent;
  answerMode: "answer" | "cautious_answer" | "redirect_to_tech";
  explanation?: string;
  businessTodos?: string[];
  relatedNodeIds?: string[];
  relatedFields?: string[];
  draftReply?: string;
  questionForTech?: string;
  boundaryNotice?: string;
};
```

---

## 5. Agent 3：技术评审 Agent

### 5.1 产品定位

技术评审 Agent 面向技术方，目标是帮助技术方判断业务规则是否完整、技术上如何落地、已有资源能否复用、还需要开发哪些资源。

它是技术方的副驾，不是技术负责人。

它可以主动做验证、写代码、跑脚本、匹配资源，但它的输出是评审建议和资源缺口草案，最终仍需技术方确认。

### 5.2 上下文架构

Agent 3 的上下文是工作型上下文，不是普通聊天上下文。

| 上下文层 | 内容 | 用途 |
| --- | --- | --- |
| 业务方案 | 业务节点、输入输出、规则、异常路径 | 判断业务规则完整性 |
| 样例文件 | Excel、PDF、邮件、历史数据 | 验证字段和格式 |
| 技术资源库 | 已有 Skill、Job、接口、脚本、模板 | 匹配可复用资源 |
| 代码仓库 | 现有实现、测试、schema、配置 | 判断开发缺口 |
| 运行沙箱 | 可执行脚本、解析样例、跑测试 | 验证假设 |
| 组织技术规范 | 安全、合规、部署、监控标准 | 约束技术建议 |
| 历史案例 | 已确认方案、已上线 Job、失败经验 | 提升复用和风险识别 |

### 5.3 Skills/Tools

Agent 3 允许的 Skill：

| Skill | 作用 | 输出 |
| --- | --- | --- |
| 业务规则校验 | 检查规则冲突、字段缺失、异常路径缺失 | 规则问题清单 |
| 样例解析 | 读取 Excel/PDF/邮件样例 | 字段结构、数据质量 |
| 代码执行 | 写脚本、跑解析、验证 schema | 可复现验证结果 |
| 资源匹配 | 匹配已有 Skill、Job、接口、模板 | 复用候选 |
| 缺口分析 | 判断需要新开发的资源 | 资源缺口清单 |
| 人机分工建议 | 判断 AI 自动、AI 后人工确认、人工处理 | 人机分工建议 |
| 批注生成 | 将技术问题转成业务可理解批注 | 节点批注 |
| Job 手册草案 | 生成该 Job 需要的资源手册 | 技术资源手册草案 |

### 5.4 决策边界

Agent 3 可以做：

- 提出技术评审建议。
- 生成资源匹配结果。
- 指出规则缺失和风险。
- 写代码验证样例。
- 生成节点批注草案。
- 生成资源手册草案。

Agent 3 不能直接做：

- 最终批准方案。
- 直接上线。
- 绕过技术方确认修改生产配置。
- 将未验证推断标记为事实。
- 将评审建议直接转成已确认结论。

### 5.5 输出契约

Agent 3 的主输出是技术评审包：

```ts
type TechReviewPackage = {
  reviewSummary: string;
  feasibility: "pass" | "needs_revision" | "blocked";
  nodeReviews: TechNodeReview[];
  resourceMatches: ResourceMatch[];
  resourceGaps: ResourceGap[];
  businessQuestions: BusinessQuestion[];
  runnableEvidence: RunnableEvidence[];
  jobResourceManualDraft?: JobResourceManual;
};
```

节点评审：

```ts
type TechNodeReview = {
  nodeId: string;
  executionMode: "ai_auto" | "human_confirm" | "human_manual";
  reason: string;
  confidence: "high" | "medium" | "low";
  commentsForBusiness: TechComment[];
  requiredResources: string[];
  missingResources: string[];
};
```

技术批注：

```ts
type TechComment = {
  nodeId: string;
  content: string;
  businessTodo: string;
  severity: "info" | "needs_input" | "blocking";
  source: "tech_manual" | "agent_suggested";
};
```

资源手册草案：

```ts
type JobResourceManual = {
  jobName: string;
  existingResources: ResourceMatch[];
  newResourcesNeeded: ResourceGap[];
  requiredSkills: string[];
  requiredSchemas: string[];
  requiredTests: string[];
  openTechnicalQuestions: string[];
};
```

---

## 6. 关于“输出”和 Skill 配置的关系

用户提出的判断是对的：除了右侧面板固定展示的结构化输出，如果用户有额外要求，可以通过配置对应 Skill 来生成额外输出。

但需要加三个约束。

### 6.1 Skill 可以扩展输出，但不能绕过 Agent 边界

例如：

- Agent 2 可以配置“回复草稿 Skill”。
- Agent 2 可以配置“批注术语解释 Skill”。
- Agent 2 不应该配置“自动化可行性确认 Skill”。

因为后者属于技术评审权限，应该交给 Agent 3。

### 6.2 Skill 的输出必须有契约

Skill 不能只是自由文本生成器。每个 Skill 至少要声明：

```ts
type SkillContract = {
  id: string;
  name: string;
  allowedAgents: string[];
  inputSchema: unknown;
  outputSchema: unknown;
  outputAuthority: "draft" | "suggestion" | "confirmed_after_human_review";
  boundaryNotes: string[];
};
```

这样可以避免 Skill 输出被误当成最终结论。

### 6.3 右侧展示是主输出，不等于全部输出

右侧面板展示的是当前阶段的主输出：

- Agent 1：业务流程草案。
- Agent 2：当前节点的业务补充内容、批注理解结果。
- Agent 3：技术评审结论、资源匹配、缺口清单。

用户额外要求可以由 Skill 生成附加输出，例如：

- 导出给飞书的沟通摘要。
- 生成回复技术方的消息草稿。
- 生成技术资源手册。
- 生成测试用例。
- 生成 JobSpec 草案。

但这些附加输出必须标注来源和权限级别。

---

## 7. 推荐代码组织

建议未来将三个 Agent 拆成同构目录：

```text
src/agents/
  business-clarifier/
    context.ts
    skills.ts
    policy.ts
    output-schema.ts
    prompt.ts

  comment-interpreter/
    context.ts
    skills.ts
    policy.ts
    output-schema.ts
    prompt.ts

  tech-reviewer/
    context.ts
    skills.ts
    policy.ts
    output-schema.ts
    prompt.ts
```

每个目录职责：

| 文件 | 职责 |
| --- | --- |
| context.ts | 构造该 Agent 可见的上下文 |
| skills.ts | 声明允许调用的 Skill |
| policy.ts | 判断能不能回答、能不能调用某个 Skill |
| output-schema.ts | 定义结构化输出格式 |
| prompt.ts | 将上下文、边界和输出契约组织成模型指令 |

---

## 8. 产品文案建议

### 8.1 Agent 1 文案

不建议：

```text
AI 已生成自动化方案
```

建议：

```text
AI 已整理出业务流程草案，等待技术方判断落地方式。
```

### 8.2 Agent 2 文案

建议：

```text
我可以帮你理解技术批注、整理待补充项、起草回复。
涉及技术可行性的问题，我会帮你转成追问技术方的话。
```

### 8.3 Agent 3 文案

建议：

```text
我会基于业务方案、样例数据和现有技术资源生成评审建议。
最终结论需要技术方确认。
```

---

## 9. 下一步落地优先级

### P0：先收紧当前业务侧体验

- 将 Agent 1 里的“自动化方案”措辞改为“业务流程草案”。
- Agent 1 阶段隐藏或弱化人机分工结论。
- Agent 2 增加意图判断，拒绝越权技术判断。

### P1：结构化技术批注

- 技术批注增加 `businessTodo`。
- 技术批注增加 `severity`。
- 技术批注区分 `tech_manual` 和 `agent_suggested`。

### P2：技术评审 Agent 工作台

- 接入样例文件解析。
- 接入资源库匹配。
- 接入代码执行沙箱。
- 输出技术评审包和资源手册草案。

---

## 10. 结论

这三个 Agent 的设计重点不是“做三个聊天机器人”，而是为三个协作阶段配置不同的上下文、工具、边界和输出契约。

- 业务流程澄清 Agent：帮助业务把流程说清楚。
- 批注理解 Agent：帮助业务把技术反馈变成可执行补充动作。
- 技术评审 Agent：帮助技术判断规则正误、资源复用和开发缺口。

只有当 Agent 的边界清楚，用户才会信任它；只有当输出契约清楚，系统才能把对话变成可协作、可流转、可沉淀的结构化资产。
