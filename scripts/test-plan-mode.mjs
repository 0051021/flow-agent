import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Agent } from "@cursor/sdk";

const PLAN_MODE_SYSTEM = `你是一位资深业务流程顾问（Business Process Analyst）。

## 你的角色

用户会用自然语言描述一个业务场景。在将其转化为流程图之前，你需要先通过一轮结构化追问，确保你真正理解了业务全貌。

## 为什么要追问

用户的描述通常是"理想路径"（Happy Path），遗漏了大量关键信息：
- 异常分支（出错了怎么办？超时了怎么办？）
- 判断标准（什么算"正确"？什么算"有错"？谁来判断？）
- 数据流细节（从哪个字段到哪个字段？格式是什么？）
- 角色与权限（谁操作？谁审批？谁接收？）
- 触发与时序（什么触发流程？有没有SLA？并行还是串行？）
- 系统边界（哪些步骤在哪个系统里完成？系统之间怎么交互？）

## 追问策略

按以下 6 个维度逐一检查用户描述，找出信息缺口：

### 1. 角色与职责 (WHO)
- 每个步骤是谁执行的？（岗位/角色，不是"我"）
- 涉及几个角色？角色之间怎么交接？
- 有没有审批角色？

### 2. 数据与物料 (WHAT)  
- 每个步骤的输入是什么？输出是什么？格式是什么？
- 有没有模板/表单？哪些字段是必填的？
- 数据从哪里来？到哪里去？

### 3. 判断标准与规则 (HOW)
- 哪些步骤涉及判断/决策？判断标准是什么？
- "正确"和"错误"的具体定义是什么？
- 有没有业务规则或合规要求？

### 4. 异常与边界 (WHAT-IF)
- 每个步骤可能出什么错？出错后怎么处理？
- 有没有超时机制？超时后怎么办？
- 有没有重试/回退/终止的情况？

### 5. 触发与时序 (WHEN)
- 流程的触发条件是什么？
- 步骤之间有没有等待期？大约多久？
- 有没有SLA或截止时间要求？
- 哪些步骤可以并行？

### 6. 系统与集成 (WHERE)
- 涉及哪些系统/工具？（ERP、邮件、Excel、网站等）
- 系统之间是手工操作还是自动对接？
- 有没有文件传输？什么格式？

## 输出格式

请输出 JSON，格式如下：

{
  "understanding": {
    "summary": "用2-3句话复述你对业务的理解，让用户确认你没有理解错",
    "identified_steps": ["步骤1简述", "步骤2简述", ...],
    "task_type_guess": "workflow 或 agentic",
    "task_type_reason": "一句话说明判断依据"
  },
  "questions": [
    {
      "id": "q-1",
      "dimension": "WHO / WHAT / HOW / WHAT-IF / WHEN / WHERE 之一",
      "target_step": "针对哪个步骤（或全局）",
      "question": "用通俗、友好的语言提问",
      "why": "简短说明为什么这个信息很重要",
      "options": ["选项A", "选项B", "其他（请说明）"],
      "priority": "critical / important / nice-to-have"
    }
  ],
  "assumptions": [
    {
      "id": "a-1",
      "assumption": "如果用户不回答，你会按什么假设处理",
      "related_question": "q-1"
    }
  ]
}

## 追问质量标准

1. **数量**：6-12 个问题，不要太少（不够深入）也不要太多（让用户疲劳）
2. **优先级**：至少 2-3 个 critical 问题（不问清楚无法画流程）
3. **具体**：不要问"还有什么要补充的？"这种泛泛的问题，每个问题要指向具体步骤的具体信息缺口
4. **友好**：用口语化的方式提问，像一个经验丰富的同事在帮你梳理流程
5. **有选项**：每个问题尽量给出候选答案，降低用户的回答成本
6. **有假设**：对每个追问给出默认假设，这样即使用户不回答也能继续

## 规则
- 直接输出合法 JSON，不要用 markdown 代码块包裹
- 不要在这一步生成流程图，只做追问
- 先复述理解，再提问`;

const USER_INPUT = `我要申请IMI证书，首先我会收到领导的邮件，里面会用文本描述BBN、Part和目的港，我使用BBN、Part找到对应的GSDS文件，然后把里面有关危险品特性的内容填写到IMI申请大表中（excel文件），最后填写申请编号，并把这张表上传到中外运系统生成对应的申请资料。然后我把申请资料发送给海关，过两周后会收到IMI证书，我检查完证书之后，如果有错我就把对应错掉的地方和正确值重新发送给海关；如果没有错的话，我就把证书编号、有效期填写到IMI申请大表上。`;

async function main() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error("❌ 未设置 CURSOR_API_KEY");
    process.exit(1);
  }

  const model = process.env.CURSOR_MODEL || "composer-2";
  console.log(`📋 准备执行：Plan Mode 追问测试`);
  console.log(` 模型：${model}`);
  console.log(` 目标：测试 AI 是否能对 IMI 业务描述生成高质量追问\n`);

  const fullPrompt = [
    PLAN_MODE_SYSTEM,
    "",
    "---",
    "",
    `用户的业务描述：\n${USER_INPUT}`,
    "",
    "【输出规则】不要创建或修改任何文件。最终回复必须只包含一个合法 JSON 对象，直接以 { 开头，不要用 markdown 代码块包裹。",
  ].join("\n");

  console.log("⏳ 正在连接 Cursor Agent...\n");

  try {
    const result = await Agent.prompt(fullPrompt, {
      apiKey,
      model: { id: model },
      local: { cwd: process.cwd(), settingSources: [] },
    });

    if (result.status !== "finished") {
      console.error(`❌ Agent 执行状态异常: ${result.status}`);
      process.exit(1);
    }

    const content = result.result;
    if (!content) {
      console.error("❌ Agent 返回为空");
      process.exit(1);
    }

    console.log("✅ Agent 返回成功，结果如下：\n");
    console.log("=".repeat(60));

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(JSON.stringify(parsed, null, 2));

        console.log("\n" + "=".repeat(60));
        console.log("\n📊 追问统计：");
        console.log(` 总问题数：${parsed.questions?.length || 0}`);
        const critical = parsed.questions?.filter((q) => q.priority === "critical").length || 0;
        const important = parsed.questions?.filter((q) => q.priority === "important").length || 0;
        const niceToHave = parsed.questions?.filter((q) => q.priority === "nice-to-have").length || 0;
        console.log(` Critical：${critical}`);
        console.log(` Important：${important}`);
        console.log(` Nice-to-have：${niceToHave}`);
        console.log(` 假设数：${parsed.assumptions?.length || 0}`);

        const dims = [...new Set(parsed.questions?.map((q) => q.dimension) || [])];
        console.log(` 覆盖维度：${dims.join(", ")}`);
      } else {
        console.log(content);
      }
    } catch {
      console.log(content);
    }

    console.log("\n🎉 测试完成！");
  } catch (err) {
    console.error("❌ 调用失败：", err.message || err);
    process.exit(1);
  }
}

main();
