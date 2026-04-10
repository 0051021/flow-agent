import type { FlowNodeData } from "./types";
import type { AgenticTaskConfig } from "./types";
import type { Node, Edge } from "@xyflow/react";
import type { ChatMessage, NodeConfidence } from "./store";

export interface MockReview {
  id: string;
  title: string;
  type: "workflow" | "agentic";
  submittedBy: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "confirmed";
  description: string;
  nodeCount: number;
  prompt: string;
  projectName: string;
  // Workflow data
  nodes?: Node<FlowNodeData>[];
  edges?: Edge[];
  // Agentic data
  agenticConfig?: AgenticTaskConfig;
  // Chat history
  chatMessages: ChatMessage[];
}

const defaultErrorHandling = [
  { strategy: "retry" as const, enabled: true, config: { maxRetries: 3, retryInterval: 30 } },
  { strategy: "human_fallback" as const, enabled: true, config: { notifyRole: "负责人" } },
  { strategy: "skip" as const, enabled: false },
  { strategy: "abort" as const, enabled: false },
];

const defaultTechConfig = { executionType: "deterministic" as const, feasibility: "pending" as const };
const intelligentTechConfig = { executionType: "intelligent" as const, feasibility: "pending" as const };

export const MOCK_REVIEWS: MockReview[] = [
  // ============================================================
  // review-1: 小红书账号运营 (Agentic)
  // ============================================================
  {
    id: "review-1",
    title: "小红书账号运营",
    type: "agentic",
    submittedBy: "市场部 · 李经理",
    submittedAt: "30 分钟前",
    status: "pending",
    description: "3个月从1万涨到5万粉丝，美妆测评+穿搭教程为主，每日3条图文",
    nodeCount: 4,
    prompt: "我们市场部要做小红书账号运营，目标是3个月从1万涨到5万粉丝。我们的运营方法是：每天发3条图文，内容以美妆测评为主（60%），穿搭教程（30%），互动话题（10%）。发布时间是早8点、中午12点、晚8点。合规红线：不提竞品品牌名、不做功效承诺、图片必须原创。每月预算不超过5000元。需要Agent按这个策略执行，每周给我数据报告，数据不好的时候给调整建议，但改方向需要我批准。",
    projectName: "小红书账号涨粉运营",
    agenticConfig: {
      goal: "3个月内小红书账号从1万涨到5万粉丝，按既定内容策略执行运营",
      background: "市场部已有明确的运营方法论，当前账号粉丝约1万，内容方向为美妆测评和穿搭教程。需要Agent作为执行者按策略稳定产出内容，并通过数据反馈持续优化执行细节。",
      totalDays: 90,
      globalSuccessCriteria: "90天内净增4万粉丝，互动率稳定在5%以上",
      approvalPoints: ["策略方向调整需运营负责人审批", "新增内容类型需审批", "预算超支时暂停并通知"],
      fallbacks: [
        { trigger: "连续3天涨粉<500", action: "触发策略复盘告警，暂停当前策略等待人工确认", severity: "warning" },
        { trigger: "合规审查连续失败>3次", action: "暂停发布，进入人工排查模式", severity: "critical" },
        { trigger: "互动率连续下降超过20%", action: "自动降低发布频率，生成内容调整建议", severity: "info" },
      ],
      phases: [
        {
          id: "phase-1",
          name: "账号冷启动与基线建立",
          dayRange: [1, 7] as [number, number],
          status: "confirmed" as const,
          actions: ["每天生成1条测评内容", "测试3种标题风格", "不挂购物车", "收集基线数据"],
          successCriteria: { good: "单篇平均播放>1000，互动率>3%", warning: "播放500-1000，互动率2-3%", bad: "播放<500，换内容模板和标题风格" },
          exitCondition: "发满7条，选出最佳标题风格和内容模板",
          requiresApproval: false,
          questions: [],
          requiredCapabilities: ["内容生成", "数据监控", "合规审查"],
        },
        {
          id: "phase-2",
          name: "内容策略验证与优化",
          dayRange: [8, 21] as [number, number],
          status: "confirmed" as const,
          actions: ["每天2条（测评1+教程1）", "A/B测试发布时间", "开始互动话题", "监控各类型表现"],
          successCriteria: { good: "互动率>5%，日均涨粉>300", warning: "互动率3-5%，日均涨粉150-300", bad: "互动率<3%，调整内容比例" },
          exitCondition: "确定最优内容比例和发布时间组合",
          requiresApproval: true,
          approvalDescription: "内容比例和发布时间确认",
          questions: [{ id: "phase-2-q1", question: "A/B测试期间，是否允许Agent自主调整发布时间？", context: "当前设定为早8/中12/晚8，但最优时间可能不同", options: ["允许Agent在6:00-22:00范围内自主调整", "保持固定时间，测试结果由我确认后再调"] }],
          requiredCapabilities: ["内容生成", "定时发布", "数据监控", "A/B测试"],
        },
        {
          id: "phase-3",
          name: "规模化内容产出",
          dayRange: [22, 60] as [number, number],
          status: "pending" as const,
          actions: ["每日3条（测评60%/教程30%/互动10%）", "按确定的最优时间发布", "评论区互动运营", "每周数据复盘"],
          successCriteria: { good: "周均涨粉>3,300，互动率>5%", warning: "周均涨粉2,000-3,300，互动率3-5%", bad: "周均涨粉<2,000 → 触发策略调整" },
          exitCondition: "累计粉丝达到3.5万，或进入第61天",
          requiresApproval: false,
          questions: [{ id: "phase-3-q1", question: "稳定期如果发现某类内容表现特别好，是否允许Agent自主提高该类比例（±10%以内）？", context: "当前设定为比例调整超过±10%需审批", options: ["允许±10%以内自主调整", "任何比例调整都需要我确认"] }],
          requiredCapabilities: ["内容生成", "定时发布", "数据监控", "互动回复", "报告生成"],
        },
        {
          id: "phase-4",
          name: "增长冲刺与目标达成",
          dayRange: [61, 90] as [number, number],
          status: "pending" as const,
          actions: ["维持日均3条+增加1条热点追踪", "尝试合作互推", "优化高转化内容模板", "冲刺5万粉丝目标"],
          successCriteria: { good: "周均涨粉>5,000，总粉丝达5万", warning: "周均涨粉3,300-5,000", bad: "周均涨粉<3,300 → 评估是否需要付费推广" },
          exitCondition: "粉丝达到5万或90天到期",
          requiresApproval: true,
          approvalDescription: "是否启用付费推广（薯条投放）",
          questions: [{ id: "phase-4-q1", question: "冲刺阶段是否考虑付费推广（如薯条投放）？", context: "付费推广可加速增长但会消耗预算", options: ["可以，日预算200元以内", "不用付费推广，纯靠内容", "看情况再说，先不决定"] }],
          requiredCapabilities: ["内容生成", "定时发布", "数据监控", "付费推广", "合作管理"],
        },
      ],
      executionOverview: "Agent 每天早上分析昨日数据表现，根据内容排期自动生成 3 条图文（早 8 点/中午 12 点/晚 8 点），每条内容经合规扫描通过后定时发布。晚间汇总当日数据生成简报，每周日生成详细周报并给出下周优化建议。",
      constraints: [
        { id: "c-1", type: "time", description: "3个月内完成涨粉目标", value: "90天" },
        { id: "c-2", type: "budget", description: "每月运营预算控制", value: "不超过5000元/月" },
        { id: "c-3", type: "quality", description: "内容质量标准", value: "图片原创，合规通过率>95%" },
        { id: "c-4", type: "compliance", description: "合规红线", value: "不提竞品品牌名、不做功效承诺" },
      ],
      skills: [
        { id: "sk-content-gen", name: "内容生成", description: "根据选题和风格指南生成小红书图文内容（标题+正文+标签）", inputs: [{ name: "选题方向", type: "text" }, { name: "风格指南", type: "json" }], outputs: [{ name: "图文内容", type: "markdown" }, { name: "推荐标签", type: "string[]" }], evaluator: "内容质量评估" },
        { id: "sk-compliance", name: "合规审查", description: "检查内容是否违反平台规则和品牌红线（竞品提及、功效承诺、敏感词）", inputs: [{ name: "待审内容", type: "markdown" }], outputs: [{ name: "审查结果", type: "boolean" }, { name: "违规项", type: "string[]" }], evaluator: "合规通过率" },
        { id: "sk-publish", name: "定时发布", description: "按排期将审核通过的内容发布到小红书平台", inputs: [{ name: "内容", type: "markdown" }, { name: "发布时间", type: "datetime" }], outputs: [{ name: "发布状态", type: "boolean" }, { name: "笔记ID", type: "string" }] },
        { id: "sk-data-monitor", name: "数据监控", description: "采集笔记的阅读/点赞/收藏/评论数据，计算互动率", inputs: [{ name: "笔记ID", type: "string" }], outputs: [{ name: "数据报告", type: "json" }, { name: "互动率", type: "number" }], evaluator: "数据表现评估" },
        { id: "sk-report-gen", name: "报告生成", description: "汇总周期内数据生成日报/周报，包含趋势分析和优化建议", inputs: [{ name: "数据集", type: "json" }, { name: "报告类型", type: "enum" }], outputs: [{ name: "报告", type: "markdown" }] },
      ],
      evaluators: [
        { id: "ev-content", name: "内容质量评估", description: "评估生成内容的质量和吸引力", metrics: [{ name: "标题吸引力", threshold: "点击率>5%", weight: 0.3 }, { name: "内容原创度", threshold: ">90%", weight: 0.3 }, { name: "标签相关性", threshold: "匹配度>80%", weight: 0.2 }, { name: "合规通过率", threshold: ">95%", weight: 0.2 }] },
        { id: "ev-growth", name: "增长效果评估", description: "评估涨粉和互动效果是否达标", metrics: [{ name: "周涨粉量", threshold: "≥3,300", weight: 0.4 }, { name: "平均互动率", threshold: "≥3.5%", weight: 0.3 }, { name: "内容发布完成率", threshold: "≥95%", weight: 0.3 }] },
        { id: "ev-compliance", name: "合规评估", description: "确保内容符合平台规则和品牌红线", metrics: [{ name: "合规通过率", threshold: ">95%", weight: 0.5 }, { name: "零违规天数占比", threshold: ">90%", weight: 0.3 }, { name: "敏感词拦截率", threshold: "100%", weight: 0.2 }] },
      ],
      executionStrategy: "adaptive",
      maxIterations: 12,
      humanCheckpoints: ["策略方向调整需运营负责人审批", "预算超支时暂停并通知"],
      decisionLoop: {
        observe: ["采集每篇笔记的阅读/点赞/收藏/评论数据", "监控粉丝增长趋势和取关率", "追踪竞品账号热门内容"],
        evaluate: ["对比各内容类型的互动率表现", "分析涨粉速度是否达标", "识别高转化内容特征"],
        act: ["调整内容比例（向高互动类型倾斜）", "优化发布时间（根据粉丝活跃时段）", "更新标题和标签策略"],
        feedback: ["生成日报/周报反馈给运营负责人", "标记需要人工确认的策略调整", "记录A/B测试结果用于后续优化"],
      },
      skillOrchestration: {
        dependencies: [
          { from: "sk-content-gen", to: "sk-compliance", dataFlow: "生成内容 → 合规审查" },
          { from: "sk-compliance", to: "sk-publish", dataFlow: "审查通过 → 定时发布" },
          { from: "sk-publish", to: "sk-data-monitor", dataFlow: "发布后 → 数据采集" },
          { from: "sk-data-monitor", to: "sk-report-gen", dataFlow: "数据汇总 → 生成报告" },
        ],
        parallelGroups: [["sk-content-gen", "sk-data-monitor"]],
        failurePolicy: [
          { skillId: "sk-compliance", action: "retry" as const, maxRetries: 2 },
          { skillId: "sk-publish", action: "retry" as const, maxRetries: 3 },
          { skillId: "sk-data-monitor", action: "skip" as const },
        ],
      },
      contextArchitecture: {
        shortTerm: ["当日已发布内容列表", "最近7天互动数据", "待发布内容队列"],
        longTerm: ["历史内容表现数据库", "粉丝画像和偏好模型", "竞品内容趋势库"],
        external: ["小红书API（发布/数据采集）", "合规词库（定期更新）"],
      },
      schedule: {
        triggers: [
          { type: "cron" as const, description: "每日内容生成", config: "0 6 * * *" },
          { type: "cron" as const, description: "定时发布（早8/午12/晚8）", config: "0 8,12,20 * * *" },
          { type: "cron" as const, description: "每日数据汇总", config: "0 22 * * *" },
          { type: "cron" as const, description: "每周日生成周报", config: "0 18 * * 0" },
          { type: "threshold" as const, description: "互动率异常告警", config: "互动率连续3天<2%" },
        ],
        cooldown: "同一技能调用间隔≥5分钟",
      },
      goalMetrics: {
        core: "3个月内从1万涨到5万粉丝（净增4万）",
        coreReasoning: "基于同体量美妆账号月均涨粉 8,000-12,000 的行业数据，当前账号基数 1 万，按月均 13,000+ 的增速目标设定（高于行业均值 60%），需要通过高频优质内容 + 数据驱动优化来实现。",
        process: ["日均发布3条内容", "内容比例：美妆60%/穿搭30%/互动10%", "合规通过率>95%"],
        baseline: ["周均涨粉<3,300 → 触发策略复盘", "单篇平均互动<200 → 内容质量告警", "粉丝取关率>8% → 暂停发布排查"],
        benchmarks: ["同体量美妆账号月均涨粉 8,000-12,000", "行业平均互动率 3.2%，头部账号 5-8%", "小红书图文平均完播率 45%"],
      },
      executionRules: [
        { category: "内容策略", rules: ["美妆测评占60%，穿搭教程30%，互动话题10%", "标题控制在20字以内，必须含emoji", "每篇至少5个相关标签"], source: "user_confirmed" },
        { category: "发布节奏", rules: ["每日3条：早8:00、中午12:00、晚20:00", "周末可增加1条互动话题", "节假日提前1天准备专题内容"], source: "user_confirmed" },
        { category: "合规红线", rules: ["不提及竞品品牌名", "不做功效承诺（如\"美白\"\"祛痘\"等）", "图片必须原创，禁止盗图", "不使用夸大/绝对化用语"], source: "user_confirmed" },
        { category: "互动运营", rules: ["评论区24小时内回复", "负面评论优先处理", "置顶高互动评论"], source: "ai_inferred" },
      ],
      permissions: {
        autonomous: [
          { action: "按排期生成和发布内容", reason: "有合规扫描兜底，且内容方向已确定" },
          { action: "回复评论区常规互动", reason: "标准话术回复，不涉及品牌承诺" },
          { action: "生成每日/每周数据报告", reason: "纯数据汇总，无决策风险" },
          { action: "微调标题和标签风格", reason: "不改变内容方向，仅优化表达" },
        ],
        needApproval: [
          { trigger: "内容比例调整超过±10%", description: "如美妆从60%调到45%，需要负责人确认", risk: "medium" as const, consequence: "可能偏离品牌定位，影响目标人群精准度" },
          { trigger: "新增内容类型", description: "如想尝试视频内容或直播，需审批", risk: "high" as const, consequence: "视频制作成本高，失败则浪费预算且影响账号权重" },
          { trigger: "单日预算超过200元", description: "付费推广超出日常额度时", risk: "medium" as const, consequence: "可能快速消耗月度预算，导致后期无预算可用" },
          { trigger: "策略方向性调整", description: "如从美妆转向生活方式", risk: "high" as const, consequence: "方向性错误可能导致已有粉丝流失，且难以逆转" },
        ],
        safeguards: ["单日发布不超过5条", "月度预算硬上限5000元", "合规审查未通过的内容自动拦截不发布"],
      },
      reporting: {
        daily: { enabled: true, auto: true, sampleContent: "4月2日日报：发布3条（测评2+教程1），涨粉+156，互动率4.8%，测评类「平价粉底液实测」表现最佳（赞420/藏380），无异常。" },
        weekly: { enabled: true, content: "涨粉趋势、内容表现Top5、互动率变化、下周建议", sampleContent: "第5周周报：发布21条，涨粉+2,958（累计15,500/50,000，完成31%）。\n\n表现最佳：「油皮亲测粉底液」赞1,200，带动当日涨粉+380。\n测评类互动率5.6%（环比+8%），教程类3.1%（持平）。\n\n建议：下周尝试「成分解析」子类型，竞品账号该类内容近期流量上升明显。" },
        alerts: { triggers: [
          { condition: "连续3天涨粉<500", severity: "warning" as const },
          { condition: "单篇内容被举报", severity: "critical" as const },
          { condition: "合规审查连续失败>3次", severity: "critical" as const },
          { condition: "预算使用超80%", severity: "warning" as const },
          { condition: "互动率连续下降超过20%", severity: "info" as const },
        ] },
        milestones: ["粉丝突破2万", "粉丝突破3万", "粉丝突破4万", "目标达成5万"],
        channel: "飞书群通知",
      },
      contentPreview: {
        samples: [
          { title: "🌸 平价粉底液实测｜油皮亲妈找到了！", summary: "横评3款百元内粉底液（花西子/完美日记/橘朵），从8小时持妆、遮瑕力、肤感三个维度实测对比，附上妆前后对比图", type: "美妆测评", tags: ["平价彩妆", "粉底液测评", "油皮推荐", "学生党"], expectedMetrics: "预计互动率5%+，收藏率8%+" },
          { title: "👗 一衣多穿｜基础款白T的5种搭配", summary: "用一件69元白T搭出通勤、约会、休闲、运动、度假5种风格，每套搭配标注单品链接和价格", type: "穿搭教程", tags: ["一衣多穿", "基础款搭配", "平价穿搭"], expectedMetrics: "预计互动率3.5%，收藏率6%" },
          { title: "💬 姐妹们！你们化妆第一步是什么？", summary: "发起投票话题：防晒 vs 隔离 vs 妆前乳，引导粉丝在评论区分享自己的化妆习惯，置顶精选回复", type: "互动话题", tags: ["化妆日常", "美妆讨论"], expectedMetrics: "预计评论数50+，互动率6%+" },
        ],
        generationLogic: "基于竞品热门话题 + 品牌调性（平价、实用、真实测评）+ 目标人群兴趣标签（18-28岁女性、学生党、职场新人）生成内容",
      },
      estimatedDuration: "持续运营 90 天",
      estimatedEfficiency: "相比人工运营，内容产出效率提升约 3 倍，数据分析响应从 1 天缩短到实时",
      riskAssessment: [
        { risk: "平台算法变化导致自然流量下降", likelihood: "medium" as const, mitigation: "每周监控流量趋势，连续3天下降超20%触发告警，暂停当前策略并分析原因" },
        { risk: "内容同质化导致互动率持续走低", likelihood: "medium" as const, mitigation: "每两周分析内容表现分布，低互动内容类型自动降低比例，同时参考竞品新内容形式" },
        { risk: "合规误判导致优质内容被拦截", likelihood: "low" as const, mitigation: "合规扫描设置白名单机制，被误拦截的内容进入人工复核队列而非直接丢弃" },
      ],
    },
    chatMessages: [
      { id: "r1-u1", role: "user", content: "我们市场部要做小红书账号运营，目标是3个月从1万涨到5万粉丝。我们的运营方法是：每天发3条图文，内容以美妆测评为主（60%），穿搭教程（30%），互动话题（10%）。发布时间是早8点、中午12点、晚8点。合规红线：不提竞品品牌名、不做功效承诺、图片必须原创。每月预算不超过5000元。需要Agent按这个策略执行，每周给我数据报告，数据不好的时候给调整建议，但改方向需要我批准。", timestamp: "2026-04-02T10:00:00Z" },
      { id: "r1-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n您已有清晰的运营策略，Agent 的角色是忠实执行者 + 数据观察者 + 优化建议者。核心是按您的方法论稳定产出内容，同时通过数据反馈发现优化机会。", timestamp: "2026-04-02T10:00:05Z" },
      { id: "r1-a2", role: "assistant", content: "已生成「小红书账号涨粉运营」策略草稿：\n\n**核心目标**：3个月从1万涨到5万粉丝\n**执行规则**：美妆60%/穿搭30%/互动10%，每日3条定时发布\n**合规红线**：不提竞品、不做功效承诺、图片原创\n**权限边界**：日常执行自主，方向调整需审批\n**汇报机制**：每日自动简报 + 每周详细周报\n\n右侧策略卡片中有 2 处需要您确认（🟡 标记），请查看。", timestamp: "2026-04-02T10:00:15Z" },
    ],
  },

  // ============================================================
  // review-2: 进出口报关 (Workflow)
  // ============================================================
  {
    id: "review-2",
    title: "进出口报关流程",
    type: "workflow",
    submittedBy: "外贸部 · 张主管",
    submittedAt: "2 小时前",
    status: "pending",
    description: "从收到委托到海关放行的全流程自动化，涉及单据审核、编码归类、关税计算",
    nodeCount: 6,
    prompt: "我想自动化进出口报关流程，收到委托后先审核报关单据的完整性，然后根据商品描述进行海关编码归类，计算关税，填制报关单，提交海关申报，等待审核放行后通知客户",
    projectName: "进出口报关自动化",
    nodes: [
      { id: "node-1", type: "flowCard", position: { x: 300, y: 0 }, data: { label: "接收委托", icon: "Mail", description: "接收客户报关委托，验证委托信息和货物基本资料", stepIndex: 1, totalSteps: 6, executionMode: "ai_auto", estimatedTime: "约 30 秒", inputs: [{ id: "i1", name: "委托书", icon: "📋", description: "客户报关委托书", required: true, source: "user" }, { id: "i2", name: "货物清单", icon: "📦", description: "货物品名、数量、金额", required: true, source: "user" }], outputs: [{ id: "o1", name: "委托信息", icon: "✅", description: "验证后的委托数据", flowsTo: ["node-2"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
      { id: "node-2", type: "flowCard", position: { x: 300, y: 220 }, data: { label: "单据审核", icon: "FileText", description: "审核报关单据完整性：发票、装箱单、合同、产地证等", stepIndex: 2, totalSteps: 6, executionMode: "ai_auto", estimatedTime: "约 2 分钟", inputs: [{ id: "i1", name: "委托信息", icon: "📋", description: "来自上一步", required: true, source: "previous_step", sourceDetail: "自动从「接收委托」获取" }], outputs: [{ id: "o1", name: "审核结果", icon: "📄", description: "单据完整性报告", flowsTo: ["node-3"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
      { id: "node-3", type: "flowCard", position: { x: 300, y: 440 }, data: { label: "海关编码归类", icon: "Search", description: "根据商品描述匹配HS编码，AI建议+人工确认", stepIndex: 3, totalSteps: 6, executionMode: "human_confirm", estimatedTime: "约 3 分钟", inputs: [{ id: "i1", name: "商品描述", icon: "📦", description: "货物详细描述", required: true, source: "previous_step", sourceDetail: "自动从「单据审核」获取" }], outputs: [{ id: "o1", name: "HS编码", icon: "🏷️", description: "确认后的海关编码", flowsTo: ["node-4"], dataType: "string" }], errorHandling: defaultErrorHandling, techConfig: intelligentTechConfig } },
      { id: "node-4", type: "flowCard", position: { x: 300, y: 660 }, data: { label: "关税计算与填单", icon: "BarChart3", description: "根据HS编码计算关税税率和金额，自动填制报关单", stepIndex: 4, totalSteps: 6, executionMode: "ai_auto", estimatedTime: "约 1 分钟", inputs: [{ id: "i1", name: "HS编码", icon: "🏷️", description: "确认后的编码", required: true, source: "previous_step", sourceDetail: "自动从「编码归类」获取" }, { id: "i2", name: "货物金额", icon: "💰", description: "货物申报金额", required: true, source: "previous_step" }], outputs: [{ id: "o1", name: "报关单", icon: "📋", description: "填制完成的报关单", flowsTo: ["node-5"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
      { id: "node-5", type: "flowCard", position: { x: 300, y: 880 }, data: { label: "提交海关申报", icon: "Upload", description: "将报关单提交至海关H2018系统，等待审核", stepIndex: 5, totalSteps: 6, executionMode: "human_confirm", estimatedTime: "约 5-15 分钟", inputs: [{ id: "i1", name: "报关单", icon: "📋", description: "待提交的报关单", required: true, source: "previous_step", sourceDetail: "自动从「关税计算」获取" }], outputs: [{ id: "o1", name: "申报回执", icon: "📨", description: "海关受理回执", flowsTo: ["node-6"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
      { id: "node-6", type: "flowCard", position: { x: 300, y: 1100 }, data: { label: "放行通知", icon: "Bell", description: "收到海关放行通知后，自动通知客户提货", stepIndex: 6, totalSteps: 6, executionMode: "ai_auto", estimatedTime: "约 30 秒", inputs: [{ id: "i1", name: "申报回执", icon: "📨", description: "海关审核结果", required: true, source: "previous_step", sourceDetail: "自动从「海关申报」获取" }], outputs: [{ id: "o1", name: "通知记录", icon: "📤", description: "客户通知状态", flowsTo: [], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
    ],
    edges: [
      { id: "e1-2", source: "node-1", target: "node-2", label: "委托信息", animated: true, style: { stroke: "#94a3b8" } },
      { id: "e2-3", source: "node-2", target: "node-3", label: "审核通过", animated: true, style: { stroke: "#22c55e" } },
      { id: "e3-4", source: "node-3", target: "node-4", label: "HS编码", animated: true, style: { stroke: "#94a3b8" } },
      { id: "e4-5", source: "node-4", target: "node-5", label: "报关单", animated: true, style: { stroke: "#94a3b8" } },
      { id: "e5-6", source: "node-5", target: "node-6", label: "放行", animated: true, style: { stroke: "#22c55e" } },
    ],
    chatMessages: [
      { id: "r2-u1", role: "user", content: "我想自动化进出口报关流程，收到委托后先审核报关单据的完整性，然后根据商品描述进行海关编码归类，计算关税，填制报关单，提交海关申报，等待审核放行后通知客户", timestamp: "2026-04-02T08:00:00Z" },
      { id: "r2-a1", role: "assistant", content: "分析完成，判断为 **工作流（Workflow）** 类型。\n\n报关流程有明确的步骤顺序和固定规则，每一步的输入输出是确定的，适合用流程图表达。", timestamp: "2026-04-02T08:00:05Z" },
      { id: "r2-a2", role: "assistant", content: "已生成「进出口报关自动化」流程图草稿，共 6 个节点：\n\n1. 接收委托\n2. 单据审核\n3. 海关编码归类（需人工确认）\n4. 关税计算与填单\n5. 提交海关申报（需人工确认）\n6. 放行通知\n\n请在右侧画布查看完整流程图。", timestamp: "2026-04-02T08:00:15Z" },
    ],
  },

  // ============================================================
  // review-3: 财务报销审批 (Workflow)
  // ============================================================
  {
    id: "review-3",
    title: "财务报销审批",
    type: "workflow",
    submittedBy: "财务部 · 王会计",
    submittedAt: "昨天",
    status: "reviewed",
    description: "员工报销从提交到打款的全流程，涉及发票校验、多级审批、自动打款",
    nodeCount: 5,
    prompt: "我想自动化财务报销流程，员工提交报销申请后，系统自动校验发票和金额，然后按审批规则流转给对应审批人，审批通过后自动发起打款，最后归档记录",
    projectName: "财务报销自动化",
    nodes: [
      { id: "node-1", type: "flowCard", position: { x: 300, y: 0 }, data: { label: "提交报销", icon: "Upload", description: "员工填写报销单，上传发票照片和费用明细", stepIndex: 1, totalSteps: 5, executionMode: "human_manual", estimatedTime: "约 5 分钟", inputs: [{ id: "i1", name: "报销单", icon: "📋", description: "费用类型、金额、事由", required: true, source: "user" }, { id: "i2", name: "发票照片", icon: "📸", description: "电子或纸质发票", required: true, source: "user" }], outputs: [{ id: "o1", name: "报销申请", icon: "📄", description: "待审核的报销单", flowsTo: ["node-2"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
      { id: "node-2", type: "flowCard", position: { x: 300, y: 220 }, data: { label: "发票校验", icon: "ShieldCheck", description: "AI自动识别发票信息，校验真伪、金额一致性和重复报销", stepIndex: 2, totalSteps: 5, executionMode: "ai_auto", estimatedTime: "约 30 秒", inputs: [{ id: "i1", name: "报销申请", icon: "📄", description: "来自上一步", required: true, source: "previous_step", sourceDetail: "自动从「提交报销」获取" }], outputs: [{ id: "o1", name: "校验结果", icon: "✅", description: "发票校验报告", flowsTo: ["node-3"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig, isCondition: true, conditionBranches: [{ label: "校验通过", icon: "✅", targetLabel: "审批流转" }, { label: "校验失败", icon: "❌", targetLabel: "退回修改" }] } },
      { id: "node-3", type: "flowCard", position: { x: 300, y: 440 }, data: { label: "审批流转", icon: "Users", description: "根据金额和费用类型自动匹配审批人，支持多级审批", stepIndex: 3, totalSteps: 5, executionMode: "human_confirm", estimatedTime: "约 1-24 小时", inputs: [{ id: "i1", name: "校验通过的报销单", icon: "📄", description: "已通过发票校验", required: true, source: "previous_step", sourceDetail: "自动从「发票校验」获取" }], outputs: [{ id: "o1", name: "审批结果", icon: "📝", description: "审批通过/驳回", flowsTo: ["node-4"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
      { id: "node-4", type: "flowCard", position: { x: 300, y: 660 }, data: { label: "自动打款", icon: "Zap", description: "审批通过后自动发起银行转账，打款到员工账户", stepIndex: 4, totalSteps: 5, executionMode: "ai_auto", estimatedTime: "约 1-3 个工作日", inputs: [{ id: "i1", name: "审批结果", icon: "📝", description: "审批通过的报销单", required: true, source: "previous_step", sourceDetail: "自动从「审批流转」获取" }], outputs: [{ id: "o1", name: "打款记录", icon: "💰", description: "转账凭证", flowsTo: ["node-5"], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
      { id: "node-5", type: "flowCard", position: { x: 300, y: 880 }, data: { label: "归档记录", icon: "Database", description: "将报销全流程数据归档，生成财务凭证", stepIndex: 5, totalSteps: 5, executionMode: "ai_auto", estimatedTime: "约 10 秒", inputs: [{ id: "i1", name: "打款记录", icon: "💰", description: "转账完成凭证", required: true, source: "previous_step", sourceDetail: "自动从「自动打款」获取" }], outputs: [{ id: "o1", name: "归档凭证", icon: "🗂️", description: "财务归档记录", flowsTo: [], dataType: "json" }], errorHandling: defaultErrorHandling, techConfig: defaultTechConfig } },
    ],
    edges: [
      { id: "e1-2", source: "node-1", target: "node-2", label: "报销申请", animated: true, style: { stroke: "#94a3b8" } },
      { id: "e2-3", source: "node-2", target: "node-3", label: "校验通过", animated: true, style: { stroke: "#22c55e" } },
      { id: "e3-4", source: "node-3", target: "node-4", label: "审批通过", animated: true, style: { stroke: "#22c55e" } },
      { id: "e4-5", source: "node-4", target: "node-5", label: "打款完成", animated: true, style: { stroke: "#94a3b8" } },
    ],
    chatMessages: [
      { id: "r3-u1", role: "user", content: "我想自动化财务报销流程，员工提交报销申请后，系统自动校验发票和金额，然后按审批规则流转给对应审批人，审批通过后自动发起打款，最后归档记录", timestamp: "2026-04-01T14:00:00Z" },
      { id: "r3-a1", role: "assistant", content: "分析完成，判断为 **工作流（Workflow）** 类型。\n\n报销流程有标准的步骤和规则，从提交到打款每一步都是确定的。", timestamp: "2026-04-01T14:00:05Z" },
      { id: "r3-a2", role: "assistant", content: "已生成「财务报销自动化」流程图，共 5 个节点：\n\n1. 提交报销（人工操作）\n2. 发票校验（AI自动）\n3. 审批流转（需人工确认）\n4. 自动打款\n5. 归档记录", timestamp: "2026-04-01T14:00:15Z" },
    ],
  },

  // ============================================================
  // review-4: 竞品分析报告 (Agentic)
  // ============================================================
  {
    id: "review-4",
    title: "竞品分析报告",
    type: "agentic",
    submittedBy: "产品部 · 赵总监",
    submittedAt: "3 天前",
    status: "confirmed",
    description: "每周自动采集5个竞品数据，从功能/价格/口碑/市场4个维度对比，生成结构化报告",
    nodeCount: 3,
    prompt: "我们产品部需要定期做竞品分析。目标竞品是：飞书、钉钉、企业微信、Slack、Teams。分析维度固定为：产品功能更新、定价变化、用户评价趋势、市场份额变化。每周一出一份报告，格式要统一（摘要+各维度详情+结论建议）。数据来源限定为官网、应用商店评价、36氪/虎嗅等科技媒体。报告终稿需要我确认后才能发给团队。",
    projectName: "竞品分析",
    agenticConfig: {
      goal: "每周产出一份结构化竞品分析报告，覆盖5个目标竞品的4个核心维度，为产品决策提供数据支撑",
      background: "产品部需要定期跟踪竞品动态，当前依赖人工收集和整理，效率低且容易遗漏。已有固定的分析框架和竞品列表，需要Agent按框架执行采集和分析。",
      totalDays: 90,
      globalSuccessCriteria: "每周准时产出报告，数据准确率>95%，分析维度全覆盖",
      approvalPoints: ["报告终稿需产品总监确认后发布", "竞品列表变更需审批"],
      fallbacks: [
        { trigger: "数据源采集失败", action: "自动重试3次，仍失败则标注缺失并通知", severity: "warning" },
        { trigger: "报告延迟超过4小时", action: "告警通知产品总监", severity: "critical" },
        { trigger: "数据准确率<95%", action: "暂停发布并进入人工复核", severity: "critical" },
      ],
      phases: [
        {
          id: "phase-1",
          name: "分析框架搭建与校准",
          dayRange: [1, 7] as [number, number],
          status: "confirmed" as const,
          actions: ["配置5个竞品的数据采集源", "建立统一报告模板", "手动采集一次验证数据质量", "确认分析维度和指标"],
          successCriteria: { good: "5个竞品数据源全部配通，模板确认", warning: "3-4个竞品配通，模板基本可用", bad: "配通<3个，需排查数据源问题" },
          exitCondition: "首份手动报告完成并通过产品总监确认",
          requiresApproval: true,
          approvalDescription: "首份报告模板和数据源确认",
          questions: [],
          requiredCapabilities: ["网页数据采集", "报告撰写"],
        },
        {
          id: "phase-2",
          name: "周报自动化与质量达标",
          dayRange: [8, 30] as [number, number],
          status: "confirmed" as const,
          actions: ["每周日晚自动采集数据", "周一上午生成报告草稿", "与上周数据对比标注变化", "提交产品总监确认后分发"],
          successCriteria: { good: "连续4周准时产出，数据准确率>95%", warning: "偶尔延迟但不超过4小时", bad: "连续2周延迟或数据错误>5%" },
          exitCondition: "连续4周稳定运行无重大问题",
          requiresApproval: false,
          questions: [{ id: "phase-2-q1", question: "报告确认后发给哪些人？是整个产品部还是特定人员？", context: "当前设定为产品总监确认后发布", options: ["发给整个产品部", "发给产品总监+产品经理", "发给指定人员列表"] }],
          requiredCapabilities: ["网页数据采集", "维度分析", "报告撰写", "趋势对比"],
        },
        {
          id: "phase-3",
          name: "深度洞察与预警能力建设",
          dayRange: [31, 90] as [number, number],
          status: "pending" as const,
          actions: ["增加重大动态即时告警", "优化分析深度（每维度3+洞察）", "积累趋势数据库", "根据反馈优化报告结构"],
          successCriteria: { good: "报告被采纳建议数>3条/周", warning: "建议数1-3条/周", bad: "建议缺乏可操作性，需调整分析框架" },
          exitCondition: "季度评估：报告对产品决策有实质贡献",
          requiresApproval: false,
          questions: [],
          requiredCapabilities: ["网页数据采集", "维度分析", "报告撰写", "趋势对比", "即时告警"],
        },
      ],
      executionOverview: "Agent 每周日晚自动启动数据采集，从官网、应用商店、科技媒体等渠道抓取 5 个竞品的最新动态。周一上午完成多维度对比分析，生成报告草稿并与上周数据对比标注变化。草稿提交产品总监确认后，自动分发给团队。",
      constraints: [
        { id: "c-1", type: "time", description: "单次分析完成时间", value: "不超过2小时" },
        { id: "c-2", type: "quality", description: "竞品覆盖", value: "5个目标竞品全部覆盖" },
        { id: "c-3", type: "quality", description: "数据时效性", value: "数据不超过7天" },
        { id: "c-4", type: "compliance", description: "数据来源限制", value: "仅限官网、应用商店、指定媒体" },
      ],
      skills: [
        { id: "sk-web-scrape", name: "网页数据采集", description: "从指定数据源（官网/应用商店/媒体）抓取竞品最新动态", inputs: [{ name: "竞品列表", type: "string[]" }, { name: "数据源URL", type: "string[]" }], outputs: [{ name: "原始数据", type: "json" }, { name: "采集时间", type: "datetime" }] },
        { id: "sk-review-parse", name: "评价解析", description: "解析应用商店评价，提取评分趋势和差评热词", inputs: [{ name: "评价数据", type: "json" }], outputs: [{ name: "评分趋势", type: "json" }, { name: "热词分析", type: "json" }], evaluator: "数据准确率评估" },
        { id: "sk-dimension-analyze", name: "维度分析", description: "按4个维度（功能/定价/评价/份额）对竞品数据进行结构化分析", inputs: [{ name: "原始数据", type: "json" }, { name: "分析维度", type: "string[]" }], outputs: [{ name: "维度报告", type: "json" }, { name: "变化标注", type: "json" }], evaluator: "分析覆盖率评估" },
        { id: "sk-report-compose", name: "报告撰写", description: "按统一模板生成结构化竞品分析报告（摘要+详情+趋势+建议）", inputs: [{ name: "维度报告", type: "json" }, { name: "历史报告", type: "json" }], outputs: [{ name: "报告文档", type: "markdown" }] },
        { id: "sk-source-verify", name: "来源验证", description: "验证报告中每个数据点的来源链接有效性", inputs: [{ name: "报告文档", type: "markdown" }], outputs: [{ name: "验证结果", type: "json" }, { name: "失效链接", type: "string[]" }] },
      ],
      evaluators: [
        { id: "ev-accuracy", name: "数据准确率评估", description: "评估采集数据的准确性和时效性", metrics: [{ name: "数据准确率", threshold: ">95%", weight: 0.4 }, { name: "数据时效性", threshold: "≤7天", weight: 0.3 }, { name: "来源可追溯率", threshold: "100%", weight: 0.3 }] },
        { id: "ev-coverage", name: "分析覆盖率评估", description: "评估竞品和维度的覆盖完整度", metrics: [{ name: "竞品覆盖率", threshold: "5/5 = 100%", weight: 0.5 }, { name: "维度覆盖率", threshold: "4/4 = 100%", weight: 0.3 }, { name: "变化检测率", threshold: ">90%", weight: 0.2 }] },
        { id: "ev-report-quality", name: "报告质量评估", description: "评估报告的结构完整性和建议价值", metrics: [{ name: "结构完整度", threshold: "4个必需章节全部包含", weight: 0.3 }, { name: "建议可操作性", threshold: "≥3条具体建议", weight: 0.4 }, { name: "与上周对比标注", threshold: "变化项全部标注", weight: 0.3 }] },
      ],
      executionStrategy: "sequential",
      maxIterations: 5,
      humanCheckpoints: ["报告终稿需产品总监确认后发布"],
      decisionLoop: {
        observe: ["采集5个竞品在4个维度的最新数据", "对比上周数据识别变化项", "监控指定媒体的竞品相关报道"],
        evaluate: ["判断数据变化是否显著（需标注）", "评估数据完整性（是否有缺失竞品/维度）", "验证数据来源的可靠性"],
        act: ["生成结构化分析报告", "标注重大变化并生成告警", "对缺失数据标注原因并尝试补采"],
        feedback: ["报告提交产品总监审核", "记录审核反馈用于优化下期报告", "更新竞品动态基线数据"],
      },
      skillOrchestration: {
        dependencies: [
          { from: "sk-web-scrape", to: "sk-review-parse", dataFlow: "原始数据 → 评价解析" },
          { from: "sk-web-scrape", to: "sk-dimension-analyze", dataFlow: "原始数据 → 维度分析" },
          { from: "sk-review-parse", to: "sk-dimension-analyze", dataFlow: "评价分析 → 补充维度数据" },
          { from: "sk-dimension-analyze", to: "sk-report-compose", dataFlow: "维度报告 → 撰写报告" },
          { from: "sk-report-compose", to: "sk-source-verify", dataFlow: "报告 → 来源验证" },
        ],
        parallelGroups: [["sk-review-parse", "sk-dimension-analyze"]],
        failurePolicy: [
          { skillId: "sk-web-scrape", action: "retry" as const, maxRetries: 3 },
          { skillId: "sk-source-verify", action: "skip" as const },
        ],
      },
      contextArchitecture: {
        shortTerm: ["本周采集的原始数据", "上周报告（用于对比）", "待验证的数据点"],
        longTerm: ["历史竞品分析报告库", "竞品功能变更时间线", "媒体报道索引"],
        external: ["竞品官网API/RSS", "App Store Connect API", "媒体RSS订阅"],
      },
      schedule: {
        triggers: [
          { type: "cron" as const, description: "每周一凌晨启动数据采集", config: "0 2 * * 1" },
          { type: "event" as const, description: "竞品重大动态即时触发", config: "关键词监控命中（融资/发布/下线）" },
        ],
        cooldown: "同一竞品数据采集间隔≥6小时",
      },
      goalMetrics: {
        core: "每周一产出一份覆盖5个竞品×4个维度的结构化分析报告",
        coreReasoning: "产品决策需要及时的竞品情报支撑，当前人工分析周期为 2 天且覆盖率仅 60%。按周频率产出可确保不遗漏重大竞品动态，5×4 的覆盖矩阵是产品部已验证的最小有效分析框架。",
        process: ["5个竞品数据全部采集完成", "4个分析维度全部覆盖", "报告格式符合统一模板"],
        baseline: ["数据准确率<95% → 暂停发布并人工复核", "缺失任一竞品数据 → 标注缺失原因并补采", "报告延迟超过4小时 → 告警通知"],
        benchmarks: ["人工分析通常需要 2 天，Agent 目标 2 小时内完成", "人工覆盖率约 60%，Agent 目标 95%+"],
      },
      executionRules: [
        { category: "竞品范围", rules: ["固定竞品：飞书、钉钉、企业微信、Slack、Teams", "如有新竞品需纳入，需产品总监审批"], source: "user_confirmed" },
        { category: "分析维度", rules: ["产品功能更新：新功能、功能改进、下线功能", "定价变化：套餐调整、优惠活动、免费额度变化", "用户评价趋势：应用商店评分变化、差评热词", "市场份额变化：公开报告数据、媒体报道"], source: "user_confirmed" },
        { category: "数据来源", rules: ["官方网站和产品更新日志", "App Store / Google Play 评价", "36氪、虎嗅、极客公园等科技媒体", "禁止使用未经验证的第三方数据"], source: "user_confirmed" },
        { category: "报告格式", rules: ["统一结构：执行摘要 → 各维度详情 → 趋势对比 → 结论建议", "每个维度配数据表格和关键变化标注", "结论部分需包含对我方产品的建议"], source: "user_confirmed" },
      ],
      permissions: {
        autonomous: [
          { action: "按固定框架采集和分析数据", reason: "数据源和维度已锁定，无决策风险" },
          { action: "生成报告草稿", reason: "草稿需人工确认后才会发布" },
          { action: "标注与上周对比的变化项", reason: "纯数据对比，无主观判断" },
          { action: "补充公开渠道的辅助信息", reason: "限定在指定媒体范围内" },
        ],
        needApproval: [
          { trigger: "新增或移除竞品", description: "竞品列表变更需产品总监确认", risk: "high" as const, consequence: "错误的竞品范围会导致分析方向偏差，浪费团队阅读和决策时间" },
          { trigger: "调整分析维度", description: "如增加\"技术架构\"维度", risk: "medium" as const, consequence: "新维度可能缺乏数据支撑，导致报告质量下降" },
          { trigger: "报告发布", description: "终稿需确认后才能发给团队", risk: "high" as const, consequence: "未经审核的报告可能包含错误数据，误导产品决策" },
        ],
        safeguards: ["不使用付费数据源", "不爬取需要登录的页面", "引用数据必须标注来源"],
      },
      reporting: {
        daily: { enabled: false, auto: false },
        weekly: { enabled: true, content: "竞品分析报告（摘要+详情+趋势+建议）", sampleContent: "第12周竞品周报摘要：\n\n重大变化：飞书发布 AI 会议纪要功能（直接对标我方核心场景），钉钉企业版降价 15%。\n\n功能维度：飞书 +3 项新功能，Slack +1 项，其余无重大更新。\n定价维度：钉钉降价可能引发价格战，建议关注。\n评价维度：企业微信 App Store 评分上升 0.2 至 4.6，差评减少。\n\n建议：①优先跟进 AI 会议纪要能力 ②评估钉钉降价对我方续费率影响 ③学习企业微信近期的用户体验优化方向。" },
        alerts: { triggers: [
          { condition: "竞品发布重大功能更新", severity: "critical" as const },
          { condition: "竞品大幅调价（变动>10%）", severity: "warning" as const },
          { condition: "竞品出现重大负面舆情", severity: "info" as const },
        ] },
        milestones: ["首份报告完成", "连续4周报告产出", "累计产出12份报告（季度）"],
        channel: "飞书文档 + 群通知",
      },
      contentPreview: {
        samples: [
          { title: "第12周竞品分析报告 - 执行摘要", summary: "本周飞书发布AI会议纪要功能（对标我方核心场景），钉钉调整企业版定价下降15%（可能引发价格战），企业微信App Store评分上升0.2分至4.6", type: "周报摘要", tags: ["竞品动态", "AI功能", "定价变化"], expectedMetrics: "覆盖5竞品×4维度" },
          { title: "功能更新维度 - 飞书", summary: "新增AI会议纪要（自动生成会议摘要+待办提取）、多维表格自动化（支持脚本触发）、审批流程模板市场（200+模板）。重点关注：AI会议纪要直接对标我方产品核心卖点", type: "维度详情", tags: ["飞书", "功能对比"], expectedMetrics: "3个洞察点+1条建议" },
        ],
        generationLogic: "按固定模板从采集数据中提取关键变化，与上周数据对比标注趋势，结合我方产品定位生成针对性建议",
      },
      estimatedDuration: "每周一次，持续运行",
      estimatedEfficiency: "从人工2天缩短到2小时，分析覆盖度从60%提升到95%",
      riskAssessment: [
        { risk: "数据源网站结构变化导致采集失败", likelihood: "medium" as const, mitigation: "采集失败自动重试3次，仍失败则标注缺失并通知，不影响其他竞品的分析产出" },
        { risk: "AI分析产生幻觉数据（捏造不存在的功能更新）", likelihood: "low" as const, mitigation: "所有数据点必须附带来源链接，终稿人工确认时可一键验证来源" },
        { risk: "竞品发布重大动态但在非采集周期内", likelihood: "medium" as const, mitigation: "设置关键词监控，竞品官网/媒体出现重大关键词时触发即时告警，不等周报" },
      ],
    },
    chatMessages: [
      { id: "r4-u1", role: "user", content: "我们产品部需要定期做竞品分析。目标竞品是：飞书、钉钉、企业微信、Slack、Teams。分析维度固定为：产品功能更新、定价变化、用户评价趋势、市场份额变化。每周一出一份报告，格式要统一（摘要+各维度详情+结论建议）。数据来源限定为官网、应用商店评价、36氪/虎嗅等科技媒体。报告终稿需要我确认后才能发给团队。", timestamp: "2026-03-30T10:00:00Z" },
      { id: "r4-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n您已有明确的分析框架和竞品列表，Agent 的角色是按框架执行数据采集和分析，稳定产出标准化报告。", timestamp: "2026-03-30T10:00:05Z" },
      { id: "r4-a2", role: "assistant", content: "已生成「竞品分析」策略草稿：\n\n**核心目标**：每周一产出结构化竞品分析报告\n**竞品范围**：飞书、钉钉、企业微信、Slack、Teams\n**分析维度**：功能更新、定价变化、用户评价、市场份额\n**权限边界**：采集分析自主，终稿发布需审批\n\n右侧策略卡片中有 1 处需要您确认（🟡 标记），请查看。", timestamp: "2026-03-30T10:00:15Z" },
    ],
  },

  // ============================================================
  // review-5: App 改版项目管理 (Agentic — 项目阶段驱动)
  // ============================================================
  {
    id: "review-5",
    title: "App 改版项目管理",
    type: "agentic" as const,
    submittedBy: "PMO · 陈经理",
    submittedAt: "1 小时前",
    status: "pending",
    description: "App 2.0 改版项目，Agent 协调跟进需求→开发→测试→上线全流程，自动催办和风险预警",
    nodeCount: 4,
    prompt: "我们要做 App 2.0 改版，涉及3个前端+2个后端+1个设计师+1个测试，总周期35天。需要Agent帮我管项目：跟进每个人的任务进度（从飞书项目拉数据），每天早上给我站会摘要，识别延期风险自动催办，每周五出周报。需求变更和上线需要我审批。",
    projectName: "App 2.0 改版项目管理",
    agenticConfig: {
      goal: "确保 App 2.0 改版项目在35天内按质量交付上线，通过自动化跟进和风险预警减少项目管理人力",
      background: "App 2.0 改版涉及7人团队，跨前端/后端/设计/测试四个角色。当前项目管理依赖 PM 手动在飞书项目中跟进，信息同步滞后，风险发现晚。需要 Agent 作为项目助理自动采集进度、生成报告、催办延期任务。",
      totalDays: 35,
      globalSuccessCriteria: "35天内完成上线，延期任务不超过总任务数的10%，无P0级线上事故",
      approvalPoints: ["需求变更需 PM 审批", "上线发布需 PM + 技术负责人双重审批", "预算追加需审批"],
      fallbacks: [
        { trigger: "关键路径任务延期超过2天", action: "升级通知技术负责人，同时生成影响分析报告", severity: "critical" as const },
        { trigger: "同一人连续3天未更新任务状态", action: "自动发送催办消息，抄送 PM", severity: "warning" as const },
        { trigger: "测试阶段 Bug 数超过预期200%", action: "建议延长测试周期，通知 PM 评估", severity: "warning" as const },
      ],
      phases: [
        {
          id: "phase-1",
          name: "需求对齐与计划确认",
          dayRange: [1, 5] as [number, number],
          status: "confirmed" as const,
          actions: ["收集各方需求并整理为结构化文档", "识别需求间的依赖和冲突", "与设计师确认交互方案", "生成需求优先级排序建议"],
          successCriteria: { good: "需求文档完成且各方签字确认，无遗留争议", warning: "有1-2个低优先级需求待确认", bad: "核心需求有分歧未解决，需要额外会议" },
          exitCondition: "需求文档 v1.0 发布且各角色确认",
          requiresApproval: true,
          approvalDescription: "需求文档终版确认",
          questions: [],
          requiredCapabilities: ["进度同步", "文档生成", "催办通知"],
        },
        {
          id: "phase-2",
          name: "开发跟进与风险管控",
          dayRange: [6, 25] as [number, number],
          status: "pending" as const,
          actions: ["每日早9点从飞书项目拉取任务进度", "生成站会摘要（谁在做什么/阻塞项/风险）", "识别延期任务并自动催办", "跟踪关键路径任务的完成情况", "每周五生成周报"],
          successCriteria: { good: "任务完成率>90%，无关键路径延期", warning: "完成率80-90%，有1-2个非关键任务延期", bad: "完成率<80%或关键路径延期 → 升级通知" },
          exitCondition: "所有开发任务标记为「已完成」或「待测试」",
          requiresApproval: false,
          questions: [
            { id: "phase-2-q1", question: "站会摘要发到哪里？飞书群还是单独通知你？", context: "需要确定信息分发渠道", options: ["发到项目飞书群", "单独发给我", "群里发摘要，延期风险单独通知我"] },
            { id: "phase-2-q2", question: "催办消息的语气和频率怎么定？", context: "太频繁会引起反感，太少起不到效果", options: ["每天一次温和提醒", "延期第1天提醒，第2天升级语气", "只在延期超过1天时提醒"] },
          ],
          requiredCapabilities: ["进度同步", "站会摘要生成", "催办通知", "周报生成", "风险识别"],
        },
        {
          id: "phase-3",
          name: "测试验收与缺陷收敛",
          dayRange: [26, 32] as [number, number],
          status: "pending" as const,
          actions: ["跟踪测试用例执行进度", "汇总 Bug 数量和严重程度分布", "跟进 Bug 修复进度", "生成测试报告"],
          successCriteria: { good: "P0/P1 Bug 全部修复，测试通过率>95%", warning: "P0 修复但有1-2个P1待修复", bad: "有P0 Bug 未修复 → 不允许进入上线阶段" },
          exitCondition: "测试报告通过，P0/P1 Bug 清零",
          requiresApproval: false,
          questions: [],
          requiredCapabilities: ["进度同步", "测试报告生成", "催办通知"],
        },
        {
          id: "phase-4",
          name: "发布上线与稳定性观察",
          dayRange: [33, 35] as [number, number],
          status: "pending" as const,
          actions: ["生成上线检查清单", "确认各环境部署状态", "监控上线后核心指标", "生成上线复盘报告"],
          successCriteria: { good: "按时上线，无P0线上事故，核心指标正常", warning: "上线延迟1天但无事故", bad: "出现P0线上事故 → 立即回滚并通知" },
          exitCondition: "上线完成且观察期（48小时）无重大问题",
          requiresApproval: true,
          approvalDescription: "上线发布需 PM + 技术负责人双重审批",
          questions: [{ id: "phase-4-q1", question: "上线后的观察期多长？", context: "观察期内 Agent 会持续监控核心指标", options: ["24小时", "48小时", "72小时"] }],
          requiredCapabilities: ["部署状态监控", "核心指标监控", "周报生成", "催办通知"],
        },
      ],
      executionOverview: "Agent 每天早上9点从飞书项目同步任务进度，生成站会摘要推送到项目群。对延期任务自动发送催办消息，关键路径延期超过2天升级通知技术负责人。每周五下午生成周报，包含进度概览、风险清单、下周重点。",
      constraints: [
        { id: "c-1", type: "time", description: "项目总周期", value: "35天" },
        { id: "c-2", type: "quality", description: "交付质量", value: "P0/P1 Bug 上线前清零" },
        { id: "c-3", type: "custom", description: "团队规模", value: "7人（3前端+2后端+1设计+1测试）" },
      ],
      skills: [
        { id: "sk-progress-sync", name: "进度同步", description: "从飞书项目拉取任务状态、负责人、截止日期等数据", inputs: [{ name: "项目ID", type: "string" }], outputs: [{ name: "任务列表", type: "json" }, { name: "进度快照", type: "json" }] },
        { id: "sk-standup-gen", name: "站会摘要生成", description: "基于进度数据生成每日站会摘要（谁在做什么/阻塞项/风险）", inputs: [{ name: "进度快照", type: "json" }, { name: "昨日摘要", type: "markdown" }], outputs: [{ name: "站会摘要", type: "markdown" }], evaluator: "摘要质量评估" },
        { id: "sk-risk-detect", name: "风险识别", description: "分析任务进度偏差，识别延期风险和关键路径阻塞", inputs: [{ name: "任务列表", type: "json" }, { name: "项目计划", type: "json" }], outputs: [{ name: "风险清单", type: "json" }, { name: "影响分析", type: "markdown" }], evaluator: "风险预警准确率" },
        { id: "sk-reminder", name: "催办通知", description: "向延期任务负责人发送催办消息，支持分级语气", inputs: [{ name: "延期任务", type: "json" }, { name: "催办级别", type: "enum" }], outputs: [{ name: "发送状态", type: "boolean" }] },
        { id: "sk-weekly-report", name: "周报生成", description: "汇总一周进度、风险、下周重点生成项目周报", inputs: [{ name: "周进度数据", type: "json" }, { name: "风险清单", type: "json" }], outputs: [{ name: "周报", type: "markdown" }] },
      ],
      evaluators: [
        { id: "ev-standup", name: "摘要质量评估", description: "评估站会摘要的完整性和准确性", metrics: [{ name: "任务覆盖率", threshold: "100%（所有活跃任务）", weight: 0.4 }, { name: "阻塞项识别率", threshold: ">90%", weight: 0.3 }, { name: "摘要准时率", threshold: "早9:30前产出", weight: 0.3 }] },
        { id: "ev-risk", name: "风险预警准确率", description: "评估风险识别的准确性和及时性", metrics: [{ name: "延期预测准确率", threshold: ">80%", weight: 0.5 }, { name: "关键路径识别", threshold: "100%覆盖", weight: 0.3 }, { name: "预警提前量", threshold: "≥1天", weight: 0.2 }] },
        { id: "ev-delivery", name: "交付效果评估", description: "评估项目整体交付情况", metrics: [{ name: "任务按时完成率", threshold: ">90%", weight: 0.4 }, { name: "PM跟进时间节省", threshold: ">60%", weight: 0.3 }, { name: "团队满意度", threshold: "≥4分/5分", weight: 0.3 }] },
      ],
      executionStrategy: "adaptive",
      maxIterations: 5,
      humanCheckpoints: ["需求变更需 PM 审批", "上线发布需双重审批"],
      decisionLoop: {
        observe: ["每日9:00从飞书项目同步任务状态", "监控任务状态变更事件", "采集代码提交和部署记录"],
        evaluate: ["对比实际进度与计划进度", "识别关键路径上的延期风险", "评估催办消息的效果（是否促进了任务更新）"],
        act: ["生成站会摘要并推送", "对延期任务发送催办消息", "关键路径延期时升级通知技术负责人"],
        feedback: ["记录催办后的任务更新响应时间", "收集PM对摘要和周报的反馈", "调整催办策略（频率/语气）"],
      },
      skillOrchestration: {
        dependencies: [
          { from: "sk-progress-sync", to: "sk-standup-gen", dataFlow: "进度数据 → 站会摘要" },
          { from: "sk-progress-sync", to: "sk-risk-detect", dataFlow: "进度数据 → 风险分析" },
          { from: "sk-risk-detect", to: "sk-reminder", dataFlow: "延期任务 → 催办通知" },
          { from: "sk-progress-sync", to: "sk-weekly-report", dataFlow: "周进度数据 → 周报" },
          { from: "sk-risk-detect", to: "sk-weekly-report", dataFlow: "风险清单 → 周报" },
        ],
        parallelGroups: [["sk-standup-gen", "sk-risk-detect"]],
        failurePolicy: [
          { skillId: "sk-progress-sync", action: "retry" as const, maxRetries: 3 },
          { skillId: "sk-reminder", action: "retry" as const, maxRetries: 2 },
          { skillId: "sk-weekly-report", action: "retry" as const, maxRetries: 1 },
        ],
      },
      contextArchitecture: {
        shortTerm: ["今日任务状态快照", "最近3天的催办记录", "当前阻塞项列表"],
        longTerm: ["项目完整计划和里程碑", "历史站会摘要", "团队成员响应模式（用于优化催办策略）"],
        external: ["飞书项目API（任务/日历）", "飞书消息API（通知/催办）", "Git仓库API（代码提交记录）"],
      },
      schedule: {
        triggers: [
          { type: "cron" as const, description: "每日进度同步+站会摘要", config: "0 9 * * 1-5" },
          { type: "cron" as const, description: "每周五周报生成", config: "0 16 * * 5" },
          { type: "event" as const, description: "任务状态变更触发风险检查", config: "飞书项目webhook: task.status.changed" },
          { type: "threshold" as const, description: "关键路径延期告警", config: "关键路径任务延期>2天" },
        ],
        cooldown: "同一人催办间隔≥24小时",
      },
      goalMetrics: {
        core: "35天内完成 App 2.0 上线，延期率<10%",
        coreReasoning: "基于团队历史交付数据，类似规模项目平均周期40天，通过 Agent 自动化跟进预计可压缩15%。10%延期率是行业优秀水平（平均20-30%）。",
        process: ["每日站会摘要准时产出", "延期任务24小时内催办", "周报每周五下午产出"],
        baseline: ["关键路径延期>3天 → 项目风险升级", "Bug 修复率<80% → 延长测试周期", "团队满意度<3分（5分制）→ 调整催办策略"],
        benchmarks: ["同规模项目平均延期率 20-30%", "人工项目管理每周耗时约 8 小时", "Agent 目标将 PM 跟进时间降低 60%"],
      },
      executionRules: [
        { category: "进度跟踪", rules: ["每日9:00同步飞书项目数据", "任务状态变更实时监控", "关键路径任务单独标记跟踪"], source: "user_confirmed" as const },
        { category: "催办规则", rules: ["延期1天：温和提醒", "延期2天：升级语气并抄送PM", "延期3天：升级通知技术负责人"], source: "ai_inferred" as const },
        { category: "汇报节奏", rules: ["每日站会摘要（早9:30前）", "每周五周报（下午5点前）", "重大风险即时通知"], source: "user_confirmed" as const },
      ],
      permissions: {
        autonomous: [
          { action: "从飞书项目拉取任务进度数据", reason: "只读操作，无风险" },
          { action: "生成站会摘要和周报", reason: "纯数据汇总，不涉及决策" },
          { action: "发送催办消息（温和级别）", reason: "按预设规则执行，不会过度打扰" },
        ],
        needApproval: [
          { trigger: "需求变更", description: "任何需求范围变更需 PM 确认", risk: "high" as const, consequence: "未经确认的需求变更可能导致返工和延期" },
          { trigger: "上线发布", description: "发布操作需 PM + 技术负责人双重确认", risk: "high" as const, consequence: "未经审核的发布可能导致线上事故" },
          { trigger: "升级通知（催办升级到技术负责人）", description: "超过温和催办级别时", risk: "medium" as const, consequence: "过度升级可能影响团队关系" },
        ],
        safeguards: ["催办消息每人每天最多1条", "不直接修改飞书项目中的任务状态", "风险升级前先通知 PM"],
      },
      reporting: {
        daily: { enabled: true, auto: true, sampleContent: "4月8日站会摘要：\n前端：小明完成首页重构（进度100%），小红商品详情页进行中（60%）\n后端：张工 API 重构延期1天（原因：接口变更），李工支付模块正常\n设计：全部交付完成\n⚠️ 风险：API 重构延期可能影响前端联调，建议今日优先处理" },
        weekly: { enabled: true, content: "进度概览、风险清单、下周重点、资源瓶颈", sampleContent: "第2周周报：\n\n进度：已完成 18/32 个任务（56%），符合预期。\n关键路径：API 重构延期2天已恢复，前端联调明天开始。\n风险：测试人力只有1人，建议第4周借调1名测试。\n下周重点：①完成前后端联调 ②设计走查 ③准备测试用例" },
        alerts: { triggers: [
          { condition: "关键路径任务延期超过2天", severity: "critical" as const },
          { condition: "同一人连续3天未更新进度", severity: "warning" as const },
          { condition: "Bug 数量超过预期", severity: "warning" as const },
        ] },
        milestones: ["需求确认完成", "开发完成（代码冻结）", "测试通过", "正式上线"],
        channel: "飞书项目群 + PM 单独通知",
      },
      estimatedDuration: "35天",
      estimatedEfficiency: "PM 每周跟进时间从 8 小时降至 2 小时，风险发现提前 1-2 天",
      riskAssessment: [
        { risk: "飞书项目数据不及时更新导致进度失真", likelihood: "medium" as const, mitigation: "对超过24小时未更新的任务自动提醒负责人更新状态" },
        { risk: "催办消息引起团队反感", likelihood: "low" as const, mitigation: "催办语气分级，首次温和提醒，频率控制每人每天最多1条" },
        { risk: "需求变更导致计划大幅调整", likelihood: "medium" as const, mitigation: "需求变更必须经 PM 审批，Agent 自动评估变更对进度的影响" },
      ],
    },
    chatMessages: [
      { id: "r5-u1", role: "user", content: "我们要做 App 2.0 改版，涉及3个前端+2个后端+1个设计师+1个测试，总周期35天。需要Agent帮我管项目：跟进每个人的任务进度（从飞书项目拉数据），每天早上给我站会摘要，识别延期风险自动催办，每周五出周报。需求变更和上线需要我审批。", timestamp: "2026-04-07T09:00:00Z" },
      { id: "r5-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n这是一个项目协调场景，Agent 的角色是项目助理——自动跟进进度、生成报告、催办延期、预警风险。", timestamp: "2026-04-07T09:00:05Z" },
      { id: "r5-a2", role: "assistant", content: "已生成「App 2.0 改版项目管理」阶段方案：\n\n**目标**：35天内完成上线，延期率<10%\n**周期**：35天，4个阶段\n\n有 2 个阶段包含追问，请在右侧画布逐阶段确认。", timestamp: "2026-04-07T09:00:15Z" },
    ],
  },

  // ============================================================
  // review-6: 智能客服 (Agentic — 能力递进驱动)
  // ============================================================
  {
    id: "review-6",
    title: "智能客服系统",
    type: "agentic" as const,
    submittedBy: "客服部 · 刘主管",
    submittedAt: "2 天前",
    status: "pending",
    description: "从基础FAQ到复杂问题处理，逐步提升客服Agent的自主处理能力，降低人工介入率",
    nodeCount: 4,
    prompt: "我们客服部每天处理约500个咨询，其中60%是重复性问题（退换货政策、物流查询、账号问题）。想用Agent来处理这些，先从简单的FAQ开始，逐步扩展到能处理复杂投诉。人工客服目前8人，希望3个月后能减少到4人。Agent回复前需要经过质检，投诉类必须转人工。",
    projectName: "智能客服系统",
    agenticConfig: {
      goal: "3个月内将客服Agent自主处理率从0提升到60%，人工客服从8人优化到4人",
      background: "客服部日均500个咨询，60%为重复性问题。当前全部由人工处理，成本高且响应慢（平均等待3分钟）。已有标准FAQ文档和退换货政策文档，可作为Agent的知识库基础。",
      totalDays: 90,
      globalSuccessCriteria: "Agent自主处理率达60%，客户满意度不低于4.2分（5分制），平均响应时间<30秒",
      approvalPoints: ["扩展新问题类型需审批", "投诉处理策略变更需审批", "人员调整方案需审批"],
      fallbacks: [
        { trigger: "客户满意度连续3天低于4.0", action: "暂停Agent自主回复，全部转人工，排查问题", severity: "critical" as const },
        { trigger: "同一问题连续3次回复不满意", action: "标记为「待优化问题」，临时转人工处理", severity: "warning" as const },
        { trigger: "Agent无法识别的问题类型", action: "自动转人工并记录，积累训练数据", severity: "info" as const },
      ],
      phases: [
        {
          id: "phase-1",
          name: "知识库构建与质检就绪",
          dayRange: [1, 14] as [number, number],
          status: "confirmed" as const,
          actions: ["整理现有FAQ文档为结构化知识库", "标注Top 50高频问题及标准回复", "配置退换货/物流查询的自动回复模板", "搭建质检规则（敏感词、语气检测）"],
          successCriteria: { good: "知识库覆盖Top 50问题，质检规则就绪", warning: "覆盖Top 30问题，质检规则基本可用", bad: "覆盖<30个问题，需要更多人工标注" },
          exitCondition: "知识库通过人工抽检，准确率>95%",
          requiresApproval: false,
          questions: [{ id: "phase-1-q1", question: "现有FAQ文档是什么格式？是否已经结构化？", context: "文档格式影响知识库搭建的工作量", options: ["已有结构化的问答对（Excel/数据库）", "有文档但需要人工整理", "只有零散的回复模板"] }],
          requiredCapabilities: ["知识库管理", "文档解析", "质检审核"],
        },
        {
          id: "phase-2",
          name: "FAQ场景试运行",
          dayRange: [15, 35] as [number, number],
          status: "pending" as const,
          actions: ["Agent 处理FAQ类问题（退换货政策、物流查询、账号问题）", "每条回复经质检后发送", "收集客户满意度评分", "人工客服处理Agent无法回答的问题", "每周分析未覆盖问题类型"],
          successCriteria: { good: "自主处理率>30%，满意度>4.2", warning: "处理率20-30%，满意度4.0-4.2", bad: "处理率<20%或满意度<4.0 → 暂停扩展，优化知识库" },
          exitCondition: "连续2周自主处理率稳定>30%且满意度>4.0",
          requiresApproval: false,
          questions: [{ id: "phase-2-q1", question: "质检是每条都检还是抽检？", context: "全检安全但会增加响应时间，抽检快但有风险", options: ["初期全检，稳定后改抽检", "从一开始就抽检（30%）", "只对新问题类型全检，已验证的问题抽检"] }],
          requiredCapabilities: ["意图分类", "知识库检索", "质检审核", "满意度收集", "人工转接"],
        },
        {
          id: "phase-3",
          name: "复杂场景扩展与系统对接",
          dayRange: [36, 70] as [number, number],
          status: "pending" as const,
          actions: ["扩展到订单修改、优惠券使用等需要系统操作的问题", "Agent 可查询订单状态并给出处理建议", "复杂投诉自动转人工但附带上下文摘要", "持续优化回复质量"],
          successCriteria: { good: "自主处理率>50%，满意度>4.2，投诉转人工率100%", warning: "处理率40-50%，满意度4.0-4.2", bad: "处理率<40%或出现投诉处理不当 → 收缩处理范围" },
          exitCondition: "自主处理率稳定>50%，无重大客诉事件",
          requiresApproval: true,
          approvalDescription: "扩展到需要系统操作的问题类型，需确认权限范围",
          questions: [{ id: "phase-3-q1", question: "Agent 是否可以直接操作订单系统（如修改地址、取消订单）？", context: "直接操作效率高但风险也高", options: ["可以操作，但限定在修改地址/取消未发货订单", "只能查询，操作类转人工", "先查询，操作需人工确认后执行"] }],
          requiredCapabilities: ["意图分类", "知识库检索", "订单查询", "质检审核", "人工转接"],
        },
        {
          id: "phase-4",
          name: "稳定运营与人力优化",
          dayRange: [71, 90] as [number, number],
          status: "pending" as const,
          actions: ["优化处理流程达到60%自主处理率", "建立问题自动分类和路由机制", "生成客服数据分析报告（热点问题、满意度趋势）", "制定人员优化方案"],
          successCriteria: { good: "自主处理率>60%，满意度>4.2，可安全减员到4人", warning: "处理率55-60%，需要5人维持", bad: "处理率<55% → 暂缓减员计划" },
          exitCondition: "连续2周处理率>60%，人员优化方案获批",
          requiresApproval: true,
          approvalDescription: "人员优化方案需客服主管和HR审批",
          questions: [],
          requiredCapabilities: ["意图分类", "知识库检索", "数据分析", "客服报告生成"],
        },
      ],
      executionOverview: "Agent 7×24小时在线接待客户咨询。收到问题后先分类（FAQ/订单/投诉/其他），FAQ类直接从知识库匹配回复，经质检后发送；订单类查询系统后回复；投诉类自动转人工并附带对话摘要。每天生成处理报告，每周分析未覆盖问题并建议知识库更新。",
      constraints: [
        { id: "c-1", type: "time", description: "目标达成周期", value: "90天" },
        { id: "c-2", type: "quality", description: "客户满意度底线", value: "不低于4.0分（5分制）" },
        { id: "c-3", type: "compliance", description: "投诉处理", value: "投诉类问题100%转人工" },
        { id: "c-4", type: "quality", description: "响应时间", value: "平均<30秒" },
      ],
      skills: [
        { id: "sk-intent-classify", name: "意图分类", description: "识别客户问题类型（FAQ/订单/投诉/其他）并路由到对应处理流程", inputs: [{ name: "客户消息", type: "text" }], outputs: [{ name: "问题类型", type: "enum" }, { name: "置信度", type: "number" }], evaluator: "分类准确率评估" },
        { id: "sk-kb-search", name: "知识库检索", description: "从FAQ知识库中匹配最相关的回复", inputs: [{ name: "客户问题", type: "text" }, { name: "问题类型", type: "enum" }], outputs: [{ name: "匹配回复", type: "text" }, { name: "匹配度", type: "number" }], evaluator: "回复质量评估" },
        { id: "sk-order-query", name: "订单查询", description: "对接订单系统查询订单状态、物流信息", inputs: [{ name: "订单号", type: "string" }, { name: "客户ID", type: "string" }], outputs: [{ name: "订单信息", type: "json" }, { name: "物流状态", type: "text" }] },
        { id: "sk-quality-check", name: "质检审核", description: "检查回复内容的准确性、语气和合规性", inputs: [{ name: "回复内容", type: "text" }, { name: "原始问题", type: "text" }], outputs: [{ name: "审核结果", type: "boolean" }, { name: "问题项", type: "string[]" }] },
        { id: "sk-human-transfer", name: "人工转接", description: "将对话转接给人工客服，附带上下文摘要", inputs: [{ name: "对话历史", type: "json" }, { name: "转接原因", type: "text" }], outputs: [{ name: "转接状态", type: "boolean" }, { name: "上下文摘要", type: "markdown" }] },
        { id: "sk-satisfaction", name: "满意度收集", description: "在对话结束后收集客户满意度评分", inputs: [{ name: "对话ID", type: "string" }], outputs: [{ name: "评分", type: "number" }, { name: "评价文本", type: "text" }] },
        { id: "sk-cs-report", name: "客服报告生成", description: "汇总处理数据生成日报/周报", inputs: [{ name: "处理记录", type: "json" }, { name: "满意度数据", type: "json" }], outputs: [{ name: "报告", type: "markdown" }] },
      ],
      evaluators: [
        { id: "ev-classify", name: "分类准确率评估", description: "评估意图分类的准确性", metrics: [{ name: "分类准确率", threshold: ">95%", weight: 0.5 }, { name: "投诉识别率", threshold: "100%（不漏判投诉）", weight: 0.3 }, { name: "分类响应时间", threshold: "<2秒", weight: 0.2 }] },
        { id: "ev-reply", name: "回复质量评估", description: "评估自动回复的质量和满意度", metrics: [{ name: "回复准确率", threshold: ">90%", weight: 0.4 }, { name: "客户满意度", threshold: "≥4.2分", weight: 0.4 }, { name: "一次解决率", threshold: ">80%", weight: 0.2 }] },
        { id: "ev-efficiency", name: "效率评估", description: "评估整体客服效率提升", metrics: [{ name: "自主处理率", threshold: "≥60%（第3个月）", weight: 0.4 }, { name: "平均响应时间", threshold: "<30秒", weight: 0.3 }, { name: "人工介入率下降", threshold: "从100%降至40%", weight: 0.3 }] },
      ],
      executionStrategy: "adaptive",
      maxIterations: 10,
      decisionLoop: {
        observe: ["实时接收客户咨询消息", "采集每次对话的满意度评分", "监控各问题类型的处理成功率"],
        evaluate: ["分析未覆盖问题类型（知识库缺口）", "识别低满意度回复的共性特征", "评估自主处理率趋势是否达标"],
        act: ["自动生成知识库更新建议", "调整分类模型的置信度阈值", "扩展或收缩Agent可处理的问题范围"],
        feedback: ["每日处理报告推送客服主管", "低满意度对话自动标记待复盘", "知识库更新后验证回复准确率变化"],
      },
      skillOrchestration: {
        dependencies: [
          { from: "sk-intent-classify", to: "sk-kb-search", dataFlow: "FAQ类问题 → 知识库检索" },
          { from: "sk-intent-classify", to: "sk-order-query", dataFlow: "订单类问题 → 订单查询" },
          { from: "sk-intent-classify", to: "sk-human-transfer", dataFlow: "投诉类问题 → 人工转接" },
          { from: "sk-kb-search", to: "sk-quality-check", dataFlow: "回复内容 → 质检审核" },
          { from: "sk-order-query", to: "sk-quality-check", dataFlow: "订单回复 → 质检审核" },
          { from: "sk-quality-check", to: "sk-satisfaction", dataFlow: "回复发送后 → 满意度收集" },
        ],
        parallelGroups: [["sk-kb-search", "sk-order-query", "sk-human-transfer"]],
        failurePolicy: [
          { skillId: "sk-kb-search", action: "fallback" as const, fallbackSkillId: "sk-human-transfer" },
          { skillId: "sk-order-query", action: "fallback" as const, fallbackSkillId: "sk-human-transfer" },
          { skillId: "sk-quality-check", action: "abort" as const },
          { skillId: "sk-satisfaction", action: "skip" as const },
        ],
      },
      contextArchitecture: {
        shortTerm: ["当前对话历史", "客户身份信息", "最近查询的订单数据"],
        longTerm: ["FAQ知识库", "客户历史对话记录", "问题类型分布统计", "满意度趋势数据"],
        external: ["订单管理系统API", "CRM客户信息API", "IM平台接口（接收/发送消息）"],
      },
      schedule: {
        triggers: [
          { type: "event" as const, description: "客户消息触发", config: "IM平台webhook: message.received" },
          { type: "cron" as const, description: "每日客服报告", config: "0 23 * * *" },
          { type: "cron" as const, description: "每周知识库更新建议", config: "0 10 * * 1" },
          { type: "threshold" as const, description: "满意度告警", config: "连续3天满意度<4.0" },
        ],
        cooldown: "同一客户连续消息合并处理，间隔<30秒视为同一轮",
      },
      humanCheckpoints: ["投诉类问题必须转人工", "新问题类型扩展需审批"],
      goalMetrics: {
        core: "3个月内Agent自主处理率达60%，人工从8人优化到4人",
        coreReasoning: "当前60%为重复性问题，理论上Agent可覆盖。考虑到初期准确率和客户接受度，设定60%为3个月目标（覆盖大部分重复问题）。每减少1名人工客服年节省约15万，4人优化可年节省60万。",
        process: ["每周自主处理率提升5%", "质检通过率>95%", "平均响应时间<30秒"],
        baseline: ["满意度<4.0 → 暂停扩展", "误回复率>5% → 收紧质检规则", "投诉升级率上升 → 排查Agent回复质量"],
        benchmarks: ["行业智能客服平均自主处理率 40-60%", "头部企业可达 70-80%", "人工客服平均响应时间 2-3 分钟"],
      },
      executionRules: [
        { category: "回复质量", rules: ["回复必须基于知识库，不允许编造信息", "语气保持友好专业", "不确定的问题转人工而非猜测"], source: "user_confirmed" as const },
        { category: "转人工规则", rules: ["投诉类100%转人工", "客户主动要求转人工时立即转接", "同一问题3次未解决自动转人工"], source: "user_confirmed" as const },
        { category: "数据安全", rules: ["不在回复中暴露其他客户信息", "订单查询需验证客户身份", "对话记录保留90天"], source: "ai_inferred" as const },
      ],
      permissions: {
        autonomous: [
          { action: "回复FAQ类问题", reason: "基于已验证的知识库，准确率有保障" },
          { action: "查询订单状态", reason: "只读操作，不修改数据" },
          { action: "生成处理报告", reason: "纯数据汇总" },
        ],
        needApproval: [
          { trigger: "扩展新问题类型", description: "新增Agent可处理的问题类别", risk: "medium" as const, consequence: "未经验证的问题类型可能导致错误回复" },
          { trigger: "修改回复模板", description: "调整标准回复内容", risk: "medium" as const, consequence: "不当的回复可能影响品牌形象" },
          { trigger: "人员调整", description: "减少人工客服人数", risk: "high" as const, consequence: "过早减员可能导致服务质量下降" },
        ],
        safeguards: ["投诉100%转人工", "质检未通过的回复不发送", "客户满意度<4.0自动暂停"],
      },
      reporting: {
        daily: { enabled: true, auto: true, sampleContent: "4月8日客服报告：总咨询512条，Agent处理186条（36%），人工处理326条。满意度4.3分。\n热点问题：退换货政策（68次）、物流查询（52次）、优惠券使用（31次）。\n未覆盖问题：商品真伪鉴别（5次）→ 建议纳入知识库。" },
        weekly: { enabled: true, content: "处理率趋势、满意度变化、热点问题分析、知识库更新建议", sampleContent: "第3周周报：Agent处理率从28%提升到36%（+8%）。满意度稳定在4.3分。\n\n新增覆盖：优惠券使用问题（+5%处理率贡献）。\n待优化：「发票开具」类问题回复准确率仅85%，建议补充知识库。\n下周目标：处理率突破40%。" },
        alerts: { triggers: [
          { condition: "满意度连续3天<4.0", severity: "critical" as const },
          { condition: "同一问题连续3次不满意", severity: "warning" as const },
          { condition: "日咨询量突增50%", severity: "info" as const },
        ] },
        milestones: ["处理率突破20%", "处理率突破40%", "处理率突破60%", "人员优化方案获批"],
        channel: "飞书群 + 客服主管单独通知",
      },
      estimatedDuration: "90天",
      estimatedEfficiency: "预计年节省人力成本60万，客户平均等待时间从3分钟降至30秒",
      riskAssessment: [
        { risk: "Agent错误回复导致客户投诉", likelihood: "medium" as const, mitigation: "质检机制兜底，不确定的问题转人工，满意度持续监控" },
        { risk: "客户不接受与AI对话", likelihood: "low" as const, mitigation: "不主动告知是AI回复，提供随时转人工的选项" },
        { risk: "知识库更新不及时导致回复过时", likelihood: "medium" as const, mitigation: "每周分析未覆盖问题，自动生成知识库更新建议" },
      ],
    },
    chatMessages: [
      { id: "r6-u1", role: "user", content: "我们客服部每天处理约500个咨询，其中60%是重复性问题（退换货政策、物流查询、账号问题）。想用Agent来处理这些，先从简单的FAQ开始，逐步扩展到能处理复杂投诉。人工客服目前8人，希望3个月后能减少到4人。Agent回复前需要经过质检，投诉类必须转人工。", timestamp: "2026-04-05T14:00:00Z" },
      { id: "r6-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n这是一个能力递进场景，Agent 从处理简单FAQ开始，逐步扩展到复杂问题，核心是在保证服务质量的前提下提升自主处理率。", timestamp: "2026-04-05T14:00:05Z" },
      { id: "r6-a2", role: "assistant", content: "已生成「智能客服系统」阶段方案：\n\n**目标**：3个月自主处理率达60%，人工从8人优化到4人\n**周期**：90天，4个阶段\n\n有 3 个阶段包含追问，请在右侧画布逐阶段确认。", timestamp: "2026-04-05T14:00:15Z" },
    ],
  },

  // ============================================================
  // review-7: 批量招聘 (Agentic — 流程阶段驱动)
  // ============================================================
  {
    id: "review-7",
    title: "校招批量招聘",
    type: "agentic" as const,
    submittedBy: "HR · 周经理",
    submittedAt: "4 天前",
    status: "confirmed",
    description: "秋招批量招聘50名应届生，Agent协助JD发布、简历筛选、面试安排、Offer发放全流程",
    nodeCount: 4,
    prompt: "秋招要招50个应届生（20个开发、15个产品、10个运营、5个设计），简历预计收到3000+份。需要Agent帮忙：自动发布JD到各平台，按条件初筛简历，安排面试时间（协调面试官日历），面试后汇总评价生成排名，Offer审批后自动发送。简历筛选标准和Offer薪资需要我确认。",
    projectName: "2026秋招批量招聘",
    agenticConfig: {
      goal: "在45天内完成50名应届生的招聘，从3000+简历中高效筛选，确保各岗位按时到岗",
      background: "公司秋招需要招聘50名应届生，覆盖开发/产品/运营/设计四个方向。预计收到3000+份简历，人工筛选工作量巨大。需要Agent协助完成从JD发布到Offer发放的全流程，重点是简历初筛和面试安排的效率提升。",
      totalDays: 45,
      globalSuccessCriteria: "45天内发出50份Offer，接受率>80%，各岗位按需求数量到位",
      approvalPoints: ["简历筛选标准需HR确认", "Offer薪资方案需HR+部门负责人审批", "特殊候选人（超预算/不符合硬性条件）需单独审批"],
      fallbacks: [
        { trigger: "某岗位简历不足（筛选后<岗位需求的3倍）", action: "扩大筛选条件或增加招聘渠道，通知HR", severity: "warning" as const },
        { trigger: "面试官连续取消面试>3次", action: "自动协调替补面试官，通知HR介入", severity: "warning" as const },
        { trigger: "Offer接受率<60%", action: "分析拒绝原因，建议调整薪资或福利方案", severity: "critical" as const },
      ],
      phases: [
        {
          id: "phase-1",
          name: "岗位发布与简历收集",
          dayRange: [1, 10] as [number, number],
          status: "confirmed" as const,
          actions: ["根据各岗位需求生成JD", "发布到Boss直聘/拉勾/牛客/官网", "收集简历并统一格式化", "按硬性条件（学历/专业/实习经历）初筛"],
          successCriteria: { good: "收到3000+简历，各岗位初筛后候选人>需求的5倍", warning: "收到2000+简历，部分岗位候选人不足5倍", bad: "简历<2000或某岗位候选人<需求3倍 → 扩大渠道" },
          exitCondition: "各岗位初筛候选人池就绪",
          requiresApproval: true,
          approvalDescription: "简历筛选标准（学历/专业/实习经历要求）需HR确认",
          questions: [{ id: "phase-1-q1", question: "简历初筛的硬性条件是什么？", context: "需要明确各岗位的最低门槛", options: ["统一要求：本科及以上，相关专业", "按岗位区分：开发要求计算机相关，产品不限专业", "我稍后提供详细的筛选标准文档"] }],
          requiredCapabilities: ["JD生成与发布", "简历解析", "简历筛选"],
        },
        {
          id: "phase-2",
          name: "笔试筛选与初面安排",
          dayRange: [11, 25] as [number, number],
          status: "confirmed" as const,
          actions: ["向初筛通过的候选人发送笔试链接", "自动批改客观题，主观题标记待人工评审", "根据笔试成绩排名，通知进入面试的候选人", "协调面试官日历安排初面时间", "面试后收集面试官评价"],
          successCriteria: { good: "笔试完成率>80%，初面安排无冲突，评价收集率100%", warning: "完成率60-80%，少量面试时间冲突", bad: "完成率<60% → 延长笔试时间或调整通知方式" },
          exitCondition: "初面完成，各岗位进入终面候选人确定",
          requiresApproval: false,
          questions: [{ id: "phase-2-q1", question: "面试安排是Agent直接发日历邀请，还是先发给你确认？", context: "直接发效率高，但可能有面试官偏好需要考虑", options: ["Agent直接发日历邀请", "先发给我确认再发", "常规的直接发，总监级面试官先确认"] }],
          requiredCapabilities: ["笔试系统对接", "自动批改", "面试安排", "消息通知", "评价汇总"],
        },
        {
          id: "phase-3",
          name: "终面评估与录用决策",
          dayRange: [26, 35] as [number, number],
          status: "pending" as const,
          actions: ["安排终面（部门负责人面试）", "汇总初面+终面评价生成候选人排名", "标记各岗位推荐录用名单", "对比候选人与岗位匹配度"],
          successCriteria: { good: "各岗位推荐人数>需求的1.2倍，排名清晰", warning: "部分岗位推荐人数刚好等于需求", bad: "某岗位推荐人数<需求 → 启动补充面试" },
          exitCondition: "各岗位录用名单确定",
          requiresApproval: true,
          approvalDescription: "录用名单需HR+部门负责人确认",
          questions: [],
          requiredCapabilities: ["面试安排", "评价汇总", "招聘报告"],
        },
        {
          id: "phase-4",
          name: "Offer发放与入职跟进",
          dayRange: [36, 45] as [number, number],
          status: "pending" as const,
          actions: ["根据薪资方案生成Offer", "发送Offer并跟踪接受状态", "未接受的候选人分析原因并启动备选", "接受Offer的候选人发送入职指南"],
          successCriteria: { good: "Offer接受率>80%，50个岗位全部到位", warning: "接受率70-80%，需要启动少量备选", bad: "接受率<70% → 分析原因，调整薪资策略" },
          exitCondition: "50个岗位全部确认入职",
          requiresApproval: true,
          approvalDescription: "Offer薪资方案需HR+部门负责人审批",
          questions: [{ id: "phase-4-q1", question: "Offer被拒后，自动启动备选还是等你决定？", context: "自动启动效率高但可能需要调整薪资", options: ["自动启动备选（同薪资）", "通知我后再决定", "普通岗位自动启动，核心岗位等我决定"] }],
          requiredCapabilities: ["Offer生成", "消息通知", "入职流程对接"],
        },
      ],
      executionOverview: "Agent 自动发布JD到多个平台并收集简历，按预设条件初筛后推送给HR确认。通过的候选人自动发送笔试链接，成绩达标者协调面试官日历安排面试。面试后汇总评价生成排名报告，录用名单确认后自动生成并发送Offer，全程跟踪候选人状态。",
      constraints: [
        { id: "c-1", type: "time", description: "招聘周期", value: "45天" },
        { id: "c-2", type: "quality", description: "招聘目标", value: "50人（开发20/产品15/运营10/设计5）" },
        { id: "c-3", type: "compliance", description: "公平性", value: "筛选标准统一，不因性别/年龄/院校歧视" },
      ],
      skills: [
        { id: "sk-jd-gen", name: "JD生成与发布", description: "根据岗位需求生成JD并发布到多个招聘平台", inputs: [{ name: "岗位需求", type: "json" }, { name: "目标平台", type: "string[]" }], outputs: [{ name: "JD内容", type: "markdown" }, { name: "发布状态", type: "json" }] },
        { id: "sk-resume-parse", name: "简历解析", description: "解析各平台收到的简历，提取结构化信息（学历/专业/经历/技能）", inputs: [{ name: "简历文件", type: "file" }], outputs: [{ name: "结构化简历", type: "json" }, { name: "解析置信度", type: "number" }] },
        { id: "sk-resume-screen", name: "简历筛选", description: "按预设条件（学历/专业/实习经历）对简历进行初筛和排名", inputs: [{ name: "结构化简历", type: "json" }, { name: "筛选标准", type: "json" }], outputs: [{ name: "筛选结果", type: "enum" }, { name: "匹配度评分", type: "number" }], evaluator: "筛选质量评估" },
        { id: "sk-interview-schedule", name: "面试安排", description: "协调面试官日历，自动安排面试时间并发送日历邀请", inputs: [{ name: "候选人列表", type: "json" }, { name: "面试官日历", type: "json" }], outputs: [{ name: "面试安排", type: "json" }, { name: "日历邀请状态", type: "boolean" }] },
        { id: "sk-eval-aggregate", name: "评价汇总", description: "汇总面试官评价，生成候选人排名和岗位匹配度报告", inputs: [{ name: "面试评价", type: "json" }], outputs: [{ name: "候选人排名", type: "json" }, { name: "匹配度报告", type: "markdown" }] },
        { id: "sk-offer-gen", name: "Offer生成", description: "根据薪资方案生成Offer文档并跟踪接受状态", inputs: [{ name: "候选人信息", type: "json" }, { name: "薪资方案", type: "json" }], outputs: [{ name: "Offer文档", type: "file" }, { name: "发送状态", type: "boolean" }] },
        { id: "sk-recruit-report", name: "招聘报告", description: "生成招聘进度日报/周报，包含各岗位漏斗数据", inputs: [{ name: "招聘数据", type: "json" }], outputs: [{ name: "报告", type: "markdown" }] },
      ],
      evaluators: [
        { id: "ev-screen", name: "筛选质量评估", description: "评估简历筛选的准确性和公平性", metrics: [{ name: "筛选准确率", threshold: ">90%（与人工复核对比）", weight: 0.4 }, { name: "公平性指标", threshold: "无歧视性偏差", weight: 0.3 }, { name: "筛选效率", threshold: "3000份<2小时", weight: 0.3 }] },
        { id: "ev-schedule", name: "面试安排效率", description: "评估面试安排的效率和冲突率", metrics: [{ name: "无冲突率", threshold: ">95%", weight: 0.4 }, { name: "候选人响应率", threshold: ">85%", weight: 0.3 }, { name: "面试官满意度", threshold: "≥4分/5分", weight: 0.3 }] },
        { id: "ev-outcome", name: "招聘结果评估", description: "评估整体招聘效果", metrics: [{ name: "Offer接受率", threshold: ">80%", weight: 0.4 }, { name: "招聘周期", threshold: "≤45天", weight: 0.3 }, { name: "各岗位到位率", threshold: "100%", weight: 0.3 }] },
      ],
      executionStrategy: "adaptive",
      maxIterations: 5,
      humanCheckpoints: ["简历筛选标准确认", "录用名单审批", "Offer薪资审批"],
      decisionLoop: {
        observe: ["各平台简历投递量和质量", "各岗位候选人漏斗数据", "面试通过率和Offer接受率"],
        evaluate: ["判断各岗位候选人是否充足", "分析Offer被拒原因", "评估筛选标准是否需要调整"],
        act: ["候选人不足时建议扩大渠道或放宽条件", "Offer被拒率高时建议调整薪资策略", "自动启动备选候选人流程"],
        feedback: ["每日招聘进度报告推送HR", "关键节点（筛选完成/面试完成）里程碑通知", "招聘结束后生成复盘报告"],
      },
      skillOrchestration: {
        dependencies: [
          { from: "sk-jd-gen", to: "sk-resume-parse", dataFlow: "JD发布后 → 收集并解析简历" },
          { from: "sk-resume-parse", to: "sk-resume-screen", dataFlow: "结构化简历 → 条件筛选" },
          { from: "sk-resume-screen", to: "sk-interview-schedule", dataFlow: "通过候选人 → 安排面试" },
          { from: "sk-interview-schedule", to: "sk-eval-aggregate", dataFlow: "面试完成 → 汇总评价" },
          { from: "sk-eval-aggregate", to: "sk-offer-gen", dataFlow: "录用名单 → 生成Offer" },
        ],
        parallelGroups: [["sk-resume-parse", "sk-recruit-report"]],
        failurePolicy: [
          { skillId: "sk-resume-parse", action: "retry" as const, maxRetries: 2 },
          { skillId: "sk-interview-schedule", action: "retry" as const, maxRetries: 3 },
          { skillId: "sk-offer-gen", action: "abort" as const },
        ],
      },
      contextArchitecture: {
        shortTerm: ["当前批次候选人状态", "本周面试安排", "待处理的Offer回复"],
        longTerm: ["岗位JD模板库", "历史招聘数据（通过率/接受率）", "面试官偏好和可用时间模式"],
        external: ["Boss直聘/拉勾/牛客API", "飞书日历API", "笔试系统API", "邮件系统API"],
      },
      schedule: {
        triggers: [
          { type: "cron" as const, description: "每日简历收集和筛选", config: "0 9 * * 1-5" },
          { type: "cron" as const, description: "每日招聘进度报告", config: "0 18 * * 1-5" },
          { type: "event" as const, description: "面试评价提交触发汇总", config: "评价系统webhook: evaluation.submitted" },
          { type: "event" as const, description: "Offer回复触发后续流程", config: "邮件系统webhook: offer.replied" },
        ],
        cooldown: "同一候选人状态更新间隔≥1小时",
      },
      goalMetrics: {
        core: "45天内发出50份Offer，接受率>80%",
        coreReasoning: "秋招窗口期有限，45天是从JD发布到Offer发放的标准周期。80%接受率基于去年数据（75%）上浮，通过更快的流程和更好的候选人体验实现。",
        process: ["简历初筛完成率>90%", "面试安排无冲突率>95%", "面试官评价收集率100%"],
        baseline: ["某岗位候选人<需求3倍 → 扩大渠道", "Offer接受率<60% → 调整薪资策略", "候选人投诉流程体验 → 排查并优化"],
        benchmarks: ["行业秋招平均周期 60 天，目标压缩到 45 天", "行业平均Offer接受率 70%，目标 80%", "人工筛选3000份简历约需 5 人天，Agent 目标 2 小时"],
      },
      executionRules: [
        { category: "筛选标准", rules: ["按岗位JD中的硬性条件筛选", "不因性别、年龄、院校进行歧视性筛选", "实习经历加分但非必须"], source: "user_confirmed" as const },
        { category: "面试安排", rules: ["面试时间避开午休（12:00-13:30）", "每个面试官每天最多安排4场面试", "候选人可选择线上或线下面试"], source: "ai_inferred" as const },
        { category: "Offer规则", rules: ["薪资在预算范围内，不超过岗位上限", "特殊候选人（超预算）需单独审批", "Offer有效期7天"], source: "user_confirmed" as const },
      ],
      permissions: {
        autonomous: [
          { action: "发布JD到各招聘平台", reason: "JD内容已确认，发布是标准操作" },
          { action: "按已确认标准筛选简历", reason: "标准已锁定，自动执行无风险" },
          { action: "协调面试时间并发送日历邀请", reason: "基于面试官可用时间自动匹配" },
          { action: "收集和汇总面试评价", reason: "纯数据汇总，不涉及决策" },
        ],
        needApproval: [
          { trigger: "调整筛选标准", description: "放宽或收紧简历筛选条件", risk: "medium" as const, consequence: "过宽导致面试工作量激增，过紧导致候选人不足" },
          { trigger: "发送Offer", description: "每份Offer需HR确认薪资后发送", risk: "high" as const, consequence: "薪资错误可能导致法律风险或预算超支" },
          { trigger: "启动备选候选人", description: "Offer被拒后启动备选流程", risk: "medium" as const, consequence: "备选候选人可能已接受其他Offer" },
        ],
        safeguards: ["不自动发送Offer（需人工确认薪资）", "筛选过程可追溯（保留筛选日志）", "候选人数据加密存储"],
      },
      reporting: {
        daily: { enabled: true, auto: true, sampleContent: "4月8日招聘日报：新收简历128份，初筛通过42份。今日面试8场（开发4/产品3/运营1），评价已收集。\n进度：开发岗已面试35人（目标60），产品岗已面试22人（目标45）。\n⚠️ 设计岗简历不足，建议增加站酷/Dribbble渠道。" },
        weekly: { enabled: true, content: "各岗位进度、候选人漏斗、面试通过率、下周重点", sampleContent: "第2周周报：\n\n收到简历1,856份（累计），初筛通过率38%。\n开发岗：已面试35/60人，通过率45%，预计下周完成初面。\n产品岗：已面试22/45人，通过率52%，进度正常。\n设计岗：简历不足，已扩展到站酷渠道，本周新增23份。\n\n下周重点：①开发岗初面冲刺 ②设计岗补充简历 ③启动终面安排" },
        alerts: { triggers: [
          { condition: "某岗位候选人不足需求3倍", severity: "warning" as const },
          { condition: "面试官连续取消>3次", severity: "warning" as const },
          { condition: "Offer接受率<60%", severity: "critical" as const },
        ] },
        milestones: ["JD全部发布", "简历初筛完成", "初面完成", "终面完成", "Offer全部发出", "50人到位"],
        channel: "飞书群 + HR周经理单独通知",
      },
      estimatedDuration: "45天",
      estimatedEfficiency: "简历筛选从5人天缩短到2小时，面试安排从人均30分钟/场降到自动化，整体招聘周期压缩25%",
      riskAssessment: [
        { risk: "优质候选人被竞争对手抢先", likelihood: "high" as const, mitigation: "缩短从面试到Offer的周期，终面后48小时内发Offer" },
        { risk: "简历筛选标准过严导致候选人不足", likelihood: "medium" as const, mitigation: "实时监控各岗位候选人漏斗，不足时自动建议放宽条件" },
        { risk: "面试官时间冲突导致面试延期", likelihood: "medium" as const, mitigation: "提前锁定面试官时间，冲突时自动协调替补面试官" },
      ],
    },
    chatMessages: [
      { id: "r7-u1", role: "user", content: "秋招要招50个应届生（20个开发、15个产品、10个运营、5个设计），简历预计收到3000+份。需要Agent帮忙：自动发布JD到各平台，按条件初筛简历，安排面试时间（协调面试官日历），面试后汇总评价生成排名，Offer审批后自动发送。简历筛选标准和Offer薪资需要我确认。", timestamp: "2026-04-03T10:00:00Z" },
      { id: "r7-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n这是一个批量招聘场景，Agent 的角色是招聘助理——自动化简历筛选、面试安排、评价汇总，让HR聚焦在决策环节。", timestamp: "2026-04-03T10:00:05Z" },
      { id: "r7-a2", role: "assistant", content: "已生成「2026秋招批量招聘」阶段方案：\n\n**目标**：45天内发出50份Offer，接受率>80%\n**周期**：45天，4个阶段\n\n有 3 个阶段包含追问，请在右侧画布逐阶段确认。", timestamp: "2026-04-03T10:00:15Z" },
    ],
  },

  // ============================================================
  // review-8: TikTok 矩阵账号运营 (Agentic — 矩阵调度驱动)
  // ============================================================
  {
    id: "review-8",
    title: "TikTok 矩阵账号运营",
    type: "agentic" as const,
    submittedBy: "海外营销部 · 张经理",
    submittedAt: "刚刚",
    status: "pending",
    description: "同时运营200个TikTok账号，通过矩阵策略批量养号，数据筛选高潜号重点投入，目标3个月矩阵总粉丝达100万",
    nodeCount: 4,
    prompt: "我们海外营销部要做TikTok矩阵运营，计划开200个号，目标是3个月矩阵总粉丝达到100万。运营方法：先批量养号，每个号每天发1-2条短视频，内容覆盖好物推荐、开箱测评、使用教程三个方向。2周后根据数据筛选出高潜力号（播放量>1万或涨粉>500/天），对高潜号加大投入（日更3条+付费推广），弱号降频到隔天1条。每个号开号时间不同，所以同一时间不同号处于不同阶段。合规红线：不搬运、不涉政、不虚假宣传。需要Agent帮我管这个矩阵：自动分配内容、监控每个号的数据、识别高潜号、调整资源分配，每周给我矩阵整体报告。策略大方向调整需要我批准。",
    projectName: "TikTok 矩阵账号运营",
    agenticConfig: {
      goal: "3个月内将200个TikTok账号的矩阵总粉丝从0提升到100万，通过数据驱动的资源调度最大化矩阵整体ROI",
      background: "海外营销部计划通过矩阵策略快速建立TikTok影响力。200个账号分批开设，每批50个，间隔1周。内容方向覆盖好物推荐（50%）、开箱测评（30%）、使用教程（20%）。核心挑战是：账号数量大、各号进度不同步、需要动态识别高潜号并调整资源分配。当前团队3人，无法人工逐号管理，需要Agent作为矩阵调度中心。",
      totalDays: 90,
      globalSuccessCriteria: "矩阵总粉丝达100万，高潜号（粉丝>1万）不少于20个，矩阵整体存活率>70%",
      approvalPoints: ["矩阵策略方向调整需审批", "单号付费推广预算>$50/天需审批", "淘汰账号批次>20个需审批"],
      fallbacks: [
        { trigger: "单号被平台限流或封禁", action: "立即停止该号发布，分析原因，标记为「待排查」，不影响其他号运营", severity: "warning" as const },
        { trigger: "矩阵整体涨粉速度连续2周低于预期50%", action: "暂停新号开设，集中优化现有高潜号策略，生成分析报告通知负责人", severity: "critical" as const },
        { trigger: "单日内容生成量超过系统负载80%", action: "优先保障高潜号内容产出，弱号自动降频", severity: "warning" as const },
        { trigger: "合规审查拦截率连续3天>10%", action: "暂停自动发布，排查内容模板合规性", severity: "critical" as const },
      ],
      phases: [
        {
          id: "phase-1",
          name: "矩阵搭建与批量冷启动",
          dayRange: [1, 14] as [number, number],
          status: "confirmed" as const,
          actions: ["分4批开设200个账号（每批50个，间隔3-4天）", "为每个账号设置差异化人设（头像/简介/内容偏好）", "每个号日更1-2条短视频，覆盖3个内容方向", "建立账号状态追踪体系（冷启动/测试中/高潜/稳定/降频/淘汰）"],
          successCriteria: { good: "200个号全部开设完成，首批50个号完成冷启动期，平均播放量>500", warning: "180+个号开设完成，首批号平均播放量300-500", bad: "开设<180个或首批号平均播放量<300 → 排查内容质量或账号设置问题" },
          exitCondition: "200个账号全部开设并发布首条内容",
          requiresApproval: false,
          questions: [
            { id: "phase-1-q1", question: "200个账号的人设如何差异化？", context: "完全相同的账号容易被平台识别为矩阵并限流", options: ["按内容方向分3组，组内微调（推荐）", "每个号完全随机生成人设", "按目标市场分组（美国/欧洲/东南亚）", "我提供人设模板，Agent在模板基础上变化"] },
            { id: "phase-1-q2", question: "内容素材从哪里来？", context: "200个号的内容量很大，需要明确素材来源", options: ["团队提供原始素材，Agent二次加工生成变体", "Agent自主生成（AI生成画面+配音）", "混合模式：核心素材人工提供，日常内容AI生成", "从素材库随机组合"] },
          ],
          requiredCapabilities: ["批量账号管理", "人设生成", "内容生成", "合规审查"],
        },
        {
          id: "phase-2",
          name: "数据筛选与账号分级",
          dayRange: [15, 35] as [number, number],
          status: "pending" as const,
          actions: ["持续监控每个号的核心指标（播放量/涨粉/互动率/完播率）", "按数据表现将账号分为4级：高潜（Top 10%）、正常（中间60%）、观察（下20%）、淘汰（末10%）", "高潜号加大内容投入（日更3条）并测试付费推广", "淘汰级账号降频到隔天1条，观察1周后无改善则停更"],
          successCriteria: { good: "识别出20+高潜号（日涨粉>500），矩阵日均总涨粉>5,000", warning: "高潜号10-20个，日均总涨粉3,000-5,000", bad: "高潜号<10个 → 检查内容策略和账号质量" },
          exitCondition: "账号分级完成，高潜号名单确定，资源分配策略生效",
          requiresApproval: true,
          approvalDescription: "高潜号付费推广预算和淘汰账号名单需确认",
          questions: [
            { id: "phase-2-q1", question: "高潜号的判定标准怎么定？", context: "标准太高会漏掉潜力号，太低会浪费资源", options: ["播放量>1万 或 日涨粉>500（推荐）", "综合评分（播放量×0.4 + 涨粉×0.3 + 互动率×0.3）Top 10%", "连续3天涨粉>300", "我自己看数据后手动标记"] },
            { id: "phase-2-q2", question: "淘汰的号怎么处理？", context: "直接弃号浪费，但继续投入也是成本", options: ["停更但保留，后续可能复活", "转为低频维护（周更1条）", "直接弃号，资源全部转移到高潜号", "降频2周后无改善再弃号（推荐）"] },
          ],
          requiredCapabilities: ["数据监控", "账号分级", "内容生成", "付费推广", "合规审查"],
        },
        {
          id: "phase-3",
          name: "高潜号加速与矩阵优化",
          dayRange: [36, 70] as [number, number],
          status: "pending" as const,
          actions: ["高潜号日更3条+付费推广（单号日预算$20-50）", "分析高潜号的爆款内容特征，反哺到其他号的内容策略", "持续进行账号分级调整（每周重新评估）", "新一轮弱号淘汰，释放资源给新晋高潜号", "跨号互动引流（高潜号评论区引导关注矩阵其他号）"],
          successCriteria: { good: "高潜号达30+个，矩阵总粉丝>50万，至少3个号粉丝破5万", warning: "高潜号20-30个，总粉丝30-50万", bad: "总粉丝<30万 → 重新评估矩阵策略" },
          exitCondition: "矩阵总粉丝突破50万，高潜号运营模式稳定",
          requiresApproval: true,
          approvalDescription: "付费推广总预算和跨号引流策略需确认",
          questions: [{ id: "phase-3-q1", question: "付费推广的总预算上限是多少？", context: "高潜号越多，推广预算需求越大", options: ["$5,000/月（约$170/天分配到各高潜号）", "$10,000/月（推荐，可支撑30个高潜号）", "$20,000/月（激进策略）", "不设上限，按ROI动态调整"] }],
          requiredCapabilities: ["内容生成", "付费推广", "数据监控", "爆款分析", "跨号引流", "合规审查"],
        },
        {
          id: "phase-4",
          name: "矩阵稳态运营与目标冲刺",
          dayRange: [71, 90] as [number, number],
          status: "pending" as const,
          actions: ["维持高潜号高频产出，冲刺100万总粉丝", "建立内容复用体系（爆款内容变体分发到多号）", "监控矩阵健康度（存活率/封号率/涨粉效率）", "生成矩阵运营复盘报告和下阶段建议"],
          successCriteria: { good: "矩阵总粉丝达100万，存活率>70%，高潜号>20个", warning: "总粉丝80-100万，存活率60-70%", bad: "总粉丝<80万 → 评估是否延长周期或调整目标" },
          exitCondition: "达成100万总粉丝目标或90天到期",
          requiresApproval: false,
          questions: [],
          requiredCapabilities: ["内容生成", "内容复用", "数据监控", "付费推广", "合规审查"],
        },
      ],
      executionOverview: "Agent 作为矩阵调度中心，管理200个TikTok账号的全生命周期。每天自动为各账号生成差异化内容并定时发布，持续采集各号数据，每周进行账号分级调整。高潜号自动加大投入，弱号自动降频。爆款内容特征自动提取并反哺到其他号。每日生成矩阵概览，每周生成详细分析报告。",
      constraints: [
        { id: "c-1", type: "time", description: "运营周期", value: "90天" },
        { id: "c-2", type: "budget", description: "付费推广预算", value: "≤$10,000/月" },
        { id: "c-3", type: "quality", description: "矩阵规模", value: "200个账号" },
        { id: "c-4", type: "compliance", description: "内容合规", value: "不搬运、不涉政、不虚假宣传" },
        { id: "c-5", type: "custom", description: "团队人力", value: "3人（无法逐号人工管理）" },
      ],
      skills: [
        { id: "sk-account-mgmt", name: "批量账号管理", description: "批量创建、配置和管理TikTok账号，维护账号状态机（冷启动/测试/高潜/稳定/降频/淘汰）", inputs: [{ name: "账号配置模板", type: "json" }, { name: "批次计划", type: "json" }], outputs: [{ name: "账号列表", type: "json" }, { name: "状态变更记录", type: "json" }] },
        { id: "sk-persona-gen", name: "人设生成", description: "为每个账号生成差异化人设（头像风格/简介/内容偏好/发布时间），避免矩阵特征被平台识别", inputs: [{ name: "人设模板", type: "json" }, { name: "差异化规则", type: "json" }], outputs: [{ name: "账号人设", type: "json" }] },
        { id: "sk-content-gen-matrix", name: "内容生成", description: "批量生成短视频内容（脚本/画面/配音），支持同一素材的多变体分发", inputs: [{ name: "素材库", type: "json" }, { name: "账号人设", type: "json" }, { name: "内容方向", type: "enum" }], outputs: [{ name: "视频内容", type: "file" }, { name: "发布计划", type: "json" }], evaluator: "内容质量评估" },
        { id: "sk-compliance-matrix", name: "合规审查", description: "检查内容是否违反平台规则和品牌红线（搬运检测/敏感词/虚假宣传）", inputs: [{ name: "待审内容", type: "file" }], outputs: [{ name: "审查结果", type: "boolean" }, { name: "违规项", type: "string[]" }] },
        { id: "sk-data-monitor-matrix", name: "数据监控", description: "采集200个账号的播放量/涨粉/互动率/完播率，生成矩阵数据面板", inputs: [{ name: "账号列表", type: "json" }], outputs: [{ name: "数据面板", type: "json" }, { name: "异常告警", type: "json" }], evaluator: "数据采集完整度" },
        { id: "sk-account-grading", name: "账号分级", description: "基于数据表现对账号进行分级（高潜/正常/观察/淘汰），输出资源分配建议", inputs: [{ name: "数据面板", type: "json" }, { name: "分级标准", type: "json" }], outputs: [{ name: "分级结果", type: "json" }, { name: "资源分配建议", type: "json" }], evaluator: "分级准确度" },
        { id: "sk-paid-promo", name: "付费推广", description: "为高潜号配置和管理TikTok付费推广（Spark Ads），控制预算和ROI", inputs: [{ name: "推广计划", type: "json" }, { name: "预算", type: "number" }], outputs: [{ name: "推广效果", type: "json" }, { name: "花费明细", type: "json" }] },
        { id: "sk-viral-analysis", name: "爆款分析", description: "分析高播放量内容的共性特征（话题/时长/开头/音乐），生成可复用的爆款模板", inputs: [{ name: "高播放内容", type: "json" }], outputs: [{ name: "爆款特征", type: "json" }, { name: "内容模板", type: "json" }] },
        { id: "sk-matrix-report", name: "矩阵报告", description: "生成矩阵整体运营报告（总粉丝/存活率/分级分布/ROI/趋势）", inputs: [{ name: "矩阵数据", type: "json" }], outputs: [{ name: "报告", type: "markdown" }] },
      ],
      evaluators: [
        { id: "ev-content-matrix", name: "内容质量评估", description: "评估批量生成内容的质量和差异化程度", metrics: [{ name: "内容差异度", threshold: "同批次内容相似度<30%", weight: 0.4 }, { name: "合规通过率", threshold: ">95%", weight: 0.3 }, { name: "平均完播率", threshold: ">40%", weight: 0.3 }] },
        { id: "ev-grading", name: "分级准确度", description: "评估账号分级的准确性（高潜号后续表现验证）", metrics: [{ name: "高潜号留存率", threshold: "标记为高潜的号，2周后仍在高潜级>80%", weight: 0.5 }, { name: "漏判率", threshold: "后来爆发但未被标记的号<5%", weight: 0.3 }, { name: "分级及时性", threshold: "数据变化后24小时内更新分级", weight: 0.2 }] },
        { id: "ev-matrix-roi", name: "矩阵ROI评估", description: "评估矩阵整体投入产出比", metrics: [{ name: "粉丝获取成本", threshold: "<$0.05/粉丝", weight: 0.4 }, { name: "高潜号占比", threshold: ">10%", weight: 0.3 }, { name: "矩阵存活率", threshold: ">70%", weight: 0.3 }] },
      ],
      executionStrategy: "adaptive",
      maxIterations: 12,
      humanCheckpoints: ["矩阵策略方向调整需审批", "付费推广总预算调整需审批", "批量淘汰账号需审批"],
      decisionLoop: {
        observe: ["采集200个账号的每日数据（播放/涨粉/互动/完播）", "监控平台政策变化和限流信号", "追踪付费推广的ROI数据", "扫描竞品矩阵的内容趋势"],
        evaluate: ["每周重新评估账号分级", "分析爆款内容特征并更新内容模板", "评估资源分配效率（高潜号投入产出比）", "判断矩阵整体增长是否达标"],
        act: ["调整各级账号的内容频率和投入", "将爆款模板分发到更多账号", "对持续低迷的号执行降频或淘汰", "为新晋高潜号配置付费推广"],
        feedback: ["每日矩阵概览推送给运营负责人", "每周详细分析报告", "重大异常（封号/限流）即时告警", "月度ROI复盘"],
      },
      skillOrchestration: {
        dependencies: [
          { from: "sk-persona-gen", to: "sk-content-gen-matrix", dataFlow: "账号人设 → 差异化内容生成" },
          { from: "sk-content-gen-matrix", to: "sk-compliance-matrix", dataFlow: "生成内容 → 合规审查" },
          { from: "sk-data-monitor-matrix", to: "sk-account-grading", dataFlow: "数据面板 → 账号分级" },
          { from: "sk-account-grading", to: "sk-paid-promo", dataFlow: "高潜号名单 → 付费推广" },
          { from: "sk-data-monitor-matrix", to: "sk-viral-analysis", dataFlow: "高播放内容 → 爆款分析" },
          { from: "sk-viral-analysis", to: "sk-content-gen-matrix", dataFlow: "爆款模板 → 反哺内容生成" },
          { from: "sk-data-monitor-matrix", to: "sk-matrix-report", dataFlow: "矩阵数据 → 生成报告" },
        ],
        parallelGroups: [["sk-content-gen-matrix", "sk-data-monitor-matrix"], ["sk-paid-promo", "sk-viral-analysis"]],
        failurePolicy: [
          { skillId: "sk-compliance-matrix", action: "retry" as const, maxRetries: 2 },
          { skillId: "sk-content-gen-matrix", action: "retry" as const, maxRetries: 3 },
          { skillId: "sk-data-monitor-matrix", action: "retry" as const, maxRetries: 3 },
          { skillId: "sk-paid-promo", action: "skip" as const },
        ],
      },
      contextArchitecture: {
        shortTerm: ["各账号今日发布计划和状态", "最近7天各号数据趋势", "待审核内容队列", "当前分级结果"],
        longTerm: ["账号全生命周期数据", "爆款内容特征库", "分级历史（用于验证分级准确度）", "内容素材库"],
        external: ["TikTok API（发布/数据采集/推广）", "合规词库和平台规则库", "竞品矩阵监控数据"],
      },
      schedule: {
        triggers: [
          { type: "cron" as const, description: "每日内容批量生成", config: "0 5 * * *" },
          { type: "cron" as const, description: "分批定时发布（错峰）", config: "0 8,11,14,17,20 * * *" },
          { type: "cron" as const, description: "每日数据采集与矩阵概览", config: "0 23 * * *" },
          { type: "cron" as const, description: "每周账号分级调整", config: "0 10 * * 1" },
          { type: "cron" as const, description: "每周矩阵分析报告", config: "0 17 * * 5" },
          { type: "event" as const, description: "账号被限流/封禁即时响应", config: "TikTok webhook: account.restricted" },
          { type: "threshold" as const, description: "单号日涨粉突破1000触发高潜标记", config: "daily_followers_gain > 1000" },
        ],
        cooldown: "同一账号内容发布间隔≥3小时，避免触发平台反垃圾机制",
      },
      goalMetrics: {
        core: "3个月矩阵总粉丝达100万，高潜号≥20个，存活率>70%",
        coreReasoning: "200个号中预计10-15%成为高潜号（行业矩阵经验），每个高潜号月均涨粉1-3万，20个高潜号3个月可贡献60-180万粉丝。加上正常号的长尾贡献，100万是积极但可达的目标。存活率70%意味着允许60个号淘汰，符合矩阵运营的自然损耗率。",
        process: ["每日内容产出200-600条（根据各号频率）", "每周完成一次账号分级调整", "高潜号付费推广ROI>3:1"],
        baseline: ["矩阵周涨粉<2万 → 触发策略复盘", "封号率>15% → 暂停新号开设并排查", "付费推广ROI<2:1 → 暂停推广优化策略"],
        benchmarks: ["TikTok矩阵运营行业高潜率 8-15%", "单号月均涨粉（高潜）1-3万", "矩阵存活率行业平均 60-75%", "粉丝获取成本行业平均 $0.03-0.10"],
      },
      executionRules: [
        { category: "账号管理", rules: ["分4批开号，每批间隔3-4天", "每个号人设差异化（头像/简介/内容偏好不重复）", "同一设备最多登录3个号"], source: "user_confirmed" as const },
        { category: "内容策略", rules: ["好物推荐50%、开箱测评30%、使用教程20%", "同一素材最多生成5个变体分发", "视频时长控制在15-60秒"], source: "user_confirmed" as const },
        { category: "分级与资源分配", rules: ["高潜号（Top 10%）：日更3条+付费推广", "正常号（中间60%）：日更1-2条", "观察号（下20%）：隔天1条，观察1周", "淘汰号（末10%）：停更"], source: "ai_inferred" as const },
        { category: "合规红线", rules: ["不搬运他人内容", "不涉及政治敏感话题", "不做虚假宣传或夸大功效", "不使用违禁音乐/素材"], source: "user_confirmed" as const },
      ],
      permissions: {
        autonomous: [
          { action: "批量生成和发布内容", reason: "有合规审查兜底，内容方向已确定" },
          { action: "采集数据并更新账号分级", reason: "基于预设标准自动执行" },
          { action: "弱号降频", reason: "按规则执行，不涉及资源增加" },
          { action: "爆款特征提取并更新内容模板", reason: "纯数据分析，不改变策略方向" },
        ],
        needApproval: [
          { trigger: "高潜号付费推广预算>$50/天", description: "单号高额推广需确认ROI", risk: "high" as const, consequence: "预算失控可能导致整体ROI下降" },
          { trigger: "批量淘汰账号>20个", description: "大规模淘汰影响矩阵规模", risk: "medium" as const, consequence: "过度淘汰可能错过后期爆发的号" },
          { trigger: "矩阵策略方向调整", description: "如内容比例调整、目标市场变更", risk: "high" as const, consequence: "方向性错误影响全部200个号" },
          { trigger: "新增内容方向", description: "超出好物/测评/教程三个方向", risk: "medium" as const, consequence: "新方向未经验证，可能拉低整体数据" },
        ],
        safeguards: ["单号日发布不超过5条", "付费推广月总预算硬上限$10,000", "合规审查未通过的内容自动拦截", "封号率>15%自动暂停新号开设"],
      },
      reporting: {
        daily: { enabled: true, auto: true, sampleContent: "4月8日矩阵概览：\n活跃号 186/200，今日发布 312 条，总涨粉 +8,200。\n\n高潜号（23个）：日涨粉 +5,800，贡献70%增长。Top 3：#TK-047 涨粉+1,200，#TK-112 涨粉+890，#TK-003 涨粉+760。\n正常号（118个）：日涨粉 +2,100。\n观察号（31个）：日涨粉 +300。\n淘汰/停更（14个）。\n\n⚠️ #TK-089 疑似被限流（播放量骤降80%），已暂停发布待排查。\n💰 付费推广花费 $156，获粉 4,200，CPA=$0.037。" },
        weekly: { enabled: true, content: "矩阵分级分布变化、涨粉趋势、爆款内容分析、ROI、下周策略建议", sampleContent: "第3周矩阵报告：\n\n总粉丝 12.8万（目标100万，完成12.8%，进度正常）。\n分级变化：高潜 18→23（+5），淘汰 8→14（+6），新晋高潜 #TK-156 表现突出。\n\n爆款分析：本周播放量Top 10内容中，7条为「开箱测评」类，平均时长22秒，开头3秒均有强视觉冲击。建议下周提高开箱测评比例到40%。\n\n付费推广ROI：3.2:1（目标>3:1，达标）。\n封号：本周0起。存活率 93%。" },
        alerts: { triggers: [
          { condition: "单号被封禁", severity: "critical" as const },
          { condition: "矩阵日涨粉<3,000", severity: "warning" as const },
          { condition: "封号率>10%", severity: "critical" as const },
          { condition: "付费推广ROI<2:1", severity: "warning" as const },
          { condition: "合规拦截率>10%", severity: "critical" as const },
        ] },
        milestones: ["首批50号完成冷启动", "高潜号突破10个", "总粉丝突破10万", "总粉丝突破50万", "总粉丝达成100万"],
        channel: "飞书群 + 运营负责人单独通知",
      },
      estimatedDuration: "90天",
      estimatedEfficiency: "3人团队管理200个号（人工模式下至少需要15人），内容产出效率提升5倍，数据分析从人工2天/次缩短到实时",
      riskAssessment: [
        { risk: "平台识别矩阵行为导致批量封号", likelihood: "medium" as const, mitigation: "账号人设差异化、发布时间错峰、IP隔离、内容变体>5种，封号率>15%自动暂停" },
        { risk: "内容同质化导致整体数据下滑", likelihood: "medium" as const, mitigation: "爆款分析持续更新内容模板，同一素材变体≤5个，每周引入新素材" },
        { risk: "付费推广预算超支但效果不达标", likelihood: "low" as const, mitigation: "单号日预算上限$50，ROI<2:1自动暂停该号推广，月总预算硬上限$10,000" },
        { risk: "团队3人无法处理Agent上报的审批请求", likelihood: "medium" as const, mitigation: "非紧急审批设48小时自动通过，紧急事项（封号/合规）才即时通知" },
      ],
    },
    chatMessages: [
      { id: "r8-u1", role: "user", content: "我们海外营销部要做TikTok矩阵运营，计划开200个号，目标是3个月矩阵总粉丝达到100万。运营方法：先批量养号，每个号每天发1-2条短视频，内容覆盖好物推荐、开箱测评、使用教程三个方向。2周后根据数据筛选出高潜力号，对高潜号加大投入，弱号降频。每个号开号时间不同，所以同一时间不同号处于不同阶段。合规红线：不搬运、不涉政、不虚假宣传。需要Agent帮我管这个矩阵。策略大方向调整需要我批准。", timestamp: "2026-04-07T15:00:00Z" },
      { id: "r8-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n这是一个矩阵调度场景，Agent 的角色是矩阵运营中心——批量管理200个账号的内容、数据和资源分配，核心能力是动态识别高潜号并优化资源配置。", timestamp: "2026-04-07T15:00:05Z" },
      { id: "r8-a2", role: "assistant", content: "已生成「TikTok 矩阵账号运营」阶段方案：\n\n**目标**：3个月矩阵总粉丝达100万\n**规模**：200个账号，分4批开设\n**周期**：90天，4个阶段\n\n有 3 个阶段包含追问（账号人设策略、高潜判定标准、推广预算），请在右侧画布逐阶段确认。", timestamp: "2026-04-07T15:00:15Z" },
    ],
  },
];

const dynamicReviews: MockReview[] = [];

export function getAllReviews(): MockReview[] {
  return [...dynamicReviews, ...MOCK_REVIEWS];
}

export function addDynamicReview(review: MockReview) {
  const idx = dynamicReviews.findIndex((r) => r.id === review.id);
  if (idx >= 0) {
    dynamicReviews[idx] = review;
  } else {
    dynamicReviews.unshift(review);
  }
}

export function getReviewById(id: string): MockReview | undefined {
  return dynamicReviews.find((r) => r.id === id) || MOCK_REVIEWS.find((r) => r.id === id);
}
