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
    description: "3个月涨粉5万，涉及内容生成、合规审查、定时发布、数据监控",
    nodeCount: 7,
    prompt: "我想做小红书账号运营，先分析账号现状和竞品，然后制定内容策略，每天生成3条图文内容，内容需要经过合规审查，审查通过后定时发布，发布后监控互动数据，每周根据数据调整策略。目标是3个月涨粉5万",
    projectName: "小红书账号涨粉运营",
    agenticConfig: {
      goal: "3个月内小红书账号涨粉5万，通过系统化内容运营和数据驱动的策略优化实现增长",
      background: "当前账号粉丝约2000，内容更新不规律，缺乏系统化运营策略。希望通过AI辅助实现每日稳定产出高质量内容，并根据数据反馈持续优化。",
      constraints: [
        { id: "c-1", type: "time", description: "3个月内完成涨粉目标", value: "90天" },
        { id: "c-2", type: "budget", description: "每月运营预算控制", value: "不超过5000元/月" },
        { id: "c-3", type: "quality", description: "内容质量标准", value: "原创度>90%，合规通过率>95%" },
        { id: "c-4", type: "compliance", description: "平台规则合规", value: "符合小红书社区规范" },
      ],
      skills: [
        { id: "sk-1", name: "账号现状分析", description: "分析账号粉丝画像、内容表现和竞品情况", inputs: [{ name: "账号ID", type: "string" }, { name: "行业", type: "string" }], outputs: [{ name: "诊断报告", type: "markdown" }], evaluator: "数据维度覆盖率>80%" },
        { id: "sk-2", name: "竞品对标分析", description: "分析同行业Top账号的内容策略和增长路径", inputs: [{ name: "竞品列表", type: "json" }], outputs: [{ name: "竞品报告", type: "markdown" }], evaluator: "竞品覆盖数>=5" },
        { id: "sk-3", name: "内容策略制定", description: "根据分析结果制定每周内容排期和主题方向", inputs: [{ name: "诊断报告", type: "markdown" }], outputs: [{ name: "内容排期表", type: "json" }], evaluator: "排期合理性评分>7" },
        { id: "sk-4", name: "图文内容生成", description: "根据排期生成小红书图文内容（标题+正文+标签）", inputs: [{ name: "主题", type: "string" }, { name: "风格", type: "string" }], outputs: [{ name: "图文内容", type: "json" }], evaluator: "内容原创度>90%，可读性>7" },
        { id: "sk-5", name: "合规审查", description: "检查内容是否符合平台规范和广告法", inputs: [{ name: "待审内容", type: "string" }], outputs: [{ name: "审查结果", type: "json" }], evaluator: "漏检率<1%" },
        { id: "sk-6", name: "数据监控分析", description: "监控已发布内容的互动数据并生成分析报告", inputs: [{ name: "发布记录", type: "json" }], outputs: [{ name: "数据报告", type: "markdown" }], evaluator: "数据准确率100%" },
      ],
      evaluators: [
        { id: "ev-1", name: "增长效果评估", description: "评估整体涨粉效果是否达标", metrics: [{ name: "月均涨粉量", threshold: ">16,667粉丝/月", weight: 0.5 }, { name: "粉丝活跃度", threshold: "互动率>5%", weight: 0.3 }, { name: "粉丝留存率", threshold: "取关率<10%", weight: 0.2 }] },
        { id: "ev-2", name: "内容质量评估", description: "评估内容产出的稳定性和质量水平", metrics: [{ name: "内容产出达标率", threshold: "每日3条完成率>90%", weight: 0.3 }, { name: "合规通过率", threshold: "首次通过率>85%", weight: 0.4 }, { name: "爆款内容占比", threshold: "互动量>平均值2倍的内容>20%", weight: 0.3 }] },
        { id: "ev-3", name: "策略优化效果", description: "评估数据驱动的策略调整是否有效", metrics: [{ name: "周优化响应速度", threshold: "每周完成数据分析和策略调整", weight: 0.3 }, { name: "优化后内容表现", threshold: "调整后内容互动率提升>15%", weight: 0.5 }, { name: "策略迭代次数", threshold: "3个月内至少完成10次有效迭代", weight: 0.2 }] },
      ],
      executionStrategy: "adaptive",
      maxIterations: 12,
      humanCheckpoints: ["内容发布前需人工确认", "策略调整建议需运营负责人审批", "预算超支时暂停并通知"],
    },
    chatMessages: [
      { id: "r1-u1", role: "user", content: "我想做小红书账号运营，先分析账号现状和竞品，然后制定内容策略，每天生成3条图文内容，内容需要经过合规审查，审查通过后定时发布，发布后监控互动数据，每周根据数据调整策略。目标是3个月涨粉5万", timestamp: "2026-04-02T10:00:00Z" },
      { id: "r1-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n核心是达成涨粉目标，需要AI自主进行竞品分析、策略制定、内容创作和数据驱动的策略调整，虽然包含审查发布等固定流程，但整体是目标导向的智能决策任务。", timestamp: "2026-04-02T10:00:05Z" },
      { id: "r1-a2", role: "assistant", content: "已生成「小红书账号涨粉运营」配置草稿：\n\n**目标**：3个月内涨粉5万\n**技能**：账号分析、竞品对标、策略制定、内容生成、合规审查、数据监控\n**约束**：90天期限、月预算5000元、原创度>90%\n**评估器**：增长效果、内容质量、策略优化效果\n\n请在右侧面板查看和编辑完整配置。", timestamp: "2026-04-02T10:00:15Z" },
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
    description: "多渠道竞品数据采集、多维度对比分析、结构化报告生成",
    nodeCount: 4,
    prompt: "我想做竞品分析，先从多个渠道采集竞品数据，然后从产品功能、用户评价、市场份额等维度进行对比分析，最后生成一份结构化的竞品分析报告",
    projectName: "竞品分析",
    agenticConfig: {
      goal: "对标竞品的产品能力、市场表现和用户口碑，生成结构化的竞品分析报告，为产品决策提供数据支撑",
      background: "产品部需要定期跟踪竞品动态，当前依赖人工收集和整理，效率低且容易遗漏。希望通过AI自动化采集和分析，提升分析频率和质量。",
      constraints: [
        { id: "c-1", type: "time", description: "单次分析完成时间", value: "不超过1小时" },
        { id: "c-2", type: "quality", description: "数据覆盖度", value: "至少覆盖5个竞品" },
        { id: "c-3", type: "quality", description: "数据时效性", value: "数据不超过7天" },
      ],
      skills: [
        { id: "sk-1", name: "竞品数据采集", description: "从公开渠道采集竞品的产品信息、价格、评价等数据", inputs: [{ name: "竞品列表", type: "json" }, { name: "采集维度", type: "string[]" }], outputs: [{ name: "原始数据", type: "json" }], evaluator: "数据完整率>90%" },
        { id: "sk-2", name: "多维度对比分析", description: "从功能、价格、用户评价、市场份额等维度进行对比", inputs: [{ name: "竞品数据", type: "json" }], outputs: [{ name: "分析结果", type: "json" }], evaluator: "分析维度>=4个" },
        { id: "sk-3", name: "报告生成", description: "将分析结果整理为结构化的竞品分析报告", inputs: [{ name: "分析结果", type: "json" }], outputs: [{ name: "分析报告", type: "markdown" }], evaluator: "报告结构完整性>90%" },
        { id: "sk-4", name: "趋势预测", description: "基于历史数据预测竞品未来动向", inputs: [{ name: "历史数据", type: "json" }], outputs: [{ name: "趋势报告", type: "markdown" }], evaluator: "预测合理性评分>6" },
      ],
      evaluators: [
        { id: "ev-1", name: "报告质量评估", description: "评估竞品分析报告的完整性和可用性", metrics: [{ name: "数据准确率", threshold: ">95%", weight: 0.4 }, { name: "分析深度", threshold: "每个维度至少3个洞察", weight: 0.3 }, { name: "可操作性", threshold: "至少包含3条可执行建议", weight: 0.3 }] },
      ],
      executionStrategy: "sequential",
      maxIterations: 5,
      humanCheckpoints: ["报告终稿需产品总监确认后发布"],
    },
    chatMessages: [
      { id: "r4-u1", role: "user", content: "我想做竞品分析，先从多个渠道采集竞品数据，然后从产品功能、用户评价、市场份额等维度进行对比分析，最后生成一份结构化的竞品分析报告", timestamp: "2026-03-30T10:00:00Z" },
      { id: "r4-a1", role: "assistant", content: "分析完成，判断为 **智能体（Agentic）** 类型。\n\n竞品分析需要AI自主规划采集策略、选择分析维度、生成洞察，是目标导向的智能任务。", timestamp: "2026-03-30T10:00:05Z" },
      { id: "r4-a2", role: "assistant", content: "已生成「竞品分析」配置草稿：\n\n**目标**：生成结构化竞品分析报告\n**技能**：数据采集、多维度对比、报告生成、趋势预测\n**约束**：1小时内完成、覆盖5+竞品\n**评估器**：报告质量评估", timestamp: "2026-03-30T10:00:15Z" },
    ],
  },
];

export function getReviewById(id: string): MockReview | undefined {
  return MOCK_REVIEWS.find((r) => r.id === id);
}
