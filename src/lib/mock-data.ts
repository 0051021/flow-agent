import type { KnowledgeFile, FlowNodeData, Annotation } from "./types";
import type { Node, Edge } from "@xyflow/react";

export const MOCK_KNOWLEDGE_FILES: KnowledgeFile[] = [
  {
    id: "kf-1",
    name: "小红书API限制说明.md",
    category: "平台规则",
    content: `# 小红书开放平台 API 限制

## 发布频率限制
- 每个账号每天最多发布 **10 条** 笔记
- 每条笔记发布间隔不少于 **5 分钟**
- 批量发布建议错开时段，避免被风控

## 数据查询限制
- 数据查询接口最多支持查询 **近 7 天** 数据
- 如需更长时间范围，需分多次查询拼接
- QPS 限制：每秒最多 10 次请求

## 内容规范
- 标题长度：最多 20 个字
- 正文长度：最多 1000 个字
- 图片数量：1-9 张
- 标签数量：最多 10 个`,
    updatedAt: "2026-03-28",
  },
  {
    id: "kf-2",
    name: "图片生成能力评估.md",
    category: "能力文档",
    content: `# 图片生成能力评估报告

## 当前能力
- 文案生成：成功率 **95%+**，质量稳定
- 图片生成：成功率约 **70%**，主要失败原因为构图不合理

## 图片生成问题
1. 人物图：面部变形概率约 15%
2. 产品图：细节丢失概率约 20%
3. 风景/抽象图：质量较好，成功率 85%+

## 建议
- 高要求场景建议 AI 生成 + 人工审核
- 可设置质量评分阈值，低于阈值自动重新生成
- 最多重试 3 次，仍不合格转人工`,
    updatedAt: "2026-03-25",
  },
  {
    id: "kf-3",
    name: "Agent决策边界规范.md",
    category: "规范文档",
    content: `# Agent 决策边界规范

## 核心原则
企业级 Agent 必须可被考核、可溯源。

## 决策分类

### AI 可自主执行
- 数据查询和分析
- 内容生成（需评估器把关）
- 格式转换和数据处理
- 定时任务触发

### 需人工确认后执行
- 内容发布（涉及品牌形象）
- 数据删除操作
- 超过预算的操作

### 必须由人决策
- 业务方向调整
- 策略变更
- 预算分配
- 人事相关决策

## 底线
涉及业务方向的决策不应由 AI 自主执行。`,
    updatedAt: "2026-03-30",
  },
  {
    id: "kf-4",
    name: "账号分析维度标准.md",
    category: "方法论",
    content: `# 小红书账号分析维度

## 基础数据
- 粉丝数、关注数、获赞与收藏数
- 近 30 天粉丝增长趋势

## 内容分析
- 近 30 条笔记的互动数据（点赞、评论、收藏、分享）
- 爆款内容特征提取
- 内容类型分布（图文/视频比例）
- 发布时间分布

## 粉丝画像
- 性别比例、年龄分布、地域分布
- 活跃时段

## 竞品对比
- 同行业 Top 10 账号数据
- 内容策略差异分析
- 增长速度对比`,
    updatedAt: "2026-03-27",
  },
];

export function generateDemoFlow(): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<FlowNodeData>[] = [
    {
      id: "node-1",
      type: "flowCard",
      position: { x: 300, y: 0 },
      data: {
        label: "账号分析",
        icon: "BarChart3",
        description: "分析账号当前粉丝画像、内容表现和竞品情况",
        stepIndex: 1,
        totalSteps: 7,
        executionMode: "ai_auto",
        estimatedTime: "约 2 分钟",
        inputs: [
          { id: "i1", name: "账号ID", icon: "📱", description: "小红书账号", required: true, source: "user" },
          { id: "i2", name: "行业", icon: "🏷️", description: "所属行业", required: true, source: "user" },
          { id: "i3", name: "时间范围", icon: "📅", description: "分析周期", required: false, source: "default", sourceDetail: "默认: 近30天" },
        ],
        outputs: [
          { id: "o1", name: "账号诊断报告", icon: "📄", description: "账号现状分析", flowsTo: ["node-2", "node-7"], dataType: "markdown" },
          { id: "o2", name: "原始数据", icon: "📈", description: "粉丝/内容数据", flowsTo: ["node-6"], dataType: "json" },
        ],
        errorHandling: [
          { strategy: "retry", enabled: true, config: { maxRetries: 3, retryInterval: 30 } },
          { strategy: "human_fallback", enabled: true, config: { notifyRole: "运营负责人" } },
          { strategy: "skip", enabled: false },
          { strategy: "abort", enabled: false },
        ],
        techConfig: { executionType: "deterministic", feasibility: "pending" },
      },
    },
    {
      id: "node-2",
      type: "flowCard",
      position: { x: 300, y: 220 },
      data: {
        label: "制定内容策略",
        icon: "Target",
        description: "根据诊断结果制定未来一周的内容方向和发布计划",
        stepIndex: 2,
        totalSteps: 7,
        executionMode: "ai_auto",
        estimatedTime: "约 3 分钟",
        inputs: [
          { id: "i1", name: "账号诊断报告", icon: "📄", description: "来自上一步", required: true, source: "previous_step", sourceDetail: "自动从「账号分析」获取" },
          { id: "i2", name: "运营目标", icon: "🎯", description: "如涨粉、提升互动", required: true, source: "user" },
        ],
        outputs: [
          { id: "o1", name: "内容排期表", icon: "📋", description: "一周内容计划", flowsTo: ["node-3"], dataType: "json" },
        ],
        errorHandling: [
          { strategy: "retry", enabled: true, config: { maxRetries: 2, retryInterval: 10 } },
          { strategy: "human_fallback", enabled: true, config: { notifyRole: "运营负责人" } },
          { strategy: "skip", enabled: false },
          { strategy: "abort", enabled: false },
        ],
        techConfig: { executionType: "intelligent", feasibility: "pending" },
      },
    },
    {
      id: "node-3",
      type: "flowCard",
      position: { x: 300, y: 440 },
      data: {
        label: "内容生成",
        icon: "PenTool",
        description: "根据策略生成小红书图文内容（标题+正文+图片+标签）",
        stepIndex: 3,
        totalSteps: 7,
        executionMode: "ai_auto",
        estimatedTime: "约 5 分钟/条",
        inputs: [
          { id: "i1", name: "内容排期表", icon: "📋", description: "来自上一步", required: true, source: "previous_step", sourceDetail: "自动从「制定策略」获取" },
          { id: "i2", name: "品牌调性", icon: "🎨", description: "内容风格要求", required: false, source: "user" },
        ],
        outputs: [
          { id: "o1", name: "图文内容", icon: "📝", description: "标题+正文+图片+标签", flowsTo: ["node-4"], dataType: "json" },
        ],
        errorHandling: [
          { strategy: "retry", enabled: true, config: { maxRetries: 3, retryInterval: 10 } },
          { strategy: "human_fallback", enabled: true, config: { notifyRole: "内容编辑" } },
          { strategy: "skip", enabled: false },
          { strategy: "abort", enabled: false },
        ],
        techConfig: { executionType: "intelligent", feasibility: "pending" },
      },
    },
    {
      id: "node-4",
      type: "flowCard",
      position: { x: 300, y: 660 },
      data: {
        label: "合规审查",
        icon: "ShieldCheck",
        description: "检查内容是否符合平台规范和品牌合规要求",
        stepIndex: 4,
        totalSteps: 7,
        executionMode: "ai_auto",
        estimatedTime: "约 30 秒",
        inputs: [
          { id: "i1", name: "图文内容", icon: "📝", description: "待审查内容", required: true, source: "previous_step", sourceDetail: "自动从「内容生成」获取" },
        ],
        outputs: [
          { id: "o1", name: "审查结果", icon: "✅", description: "通过/不通过+原因", flowsTo: ["node-5"], dataType: "json" },
        ],
        errorHandling: [
          { strategy: "retry", enabled: false },
          { strategy: "human_fallback", enabled: true, config: { notifyRole: "合规专员" } },
          { strategy: "skip", enabled: false },
          { strategy: "abort", enabled: false },
        ],
        techConfig: { executionType: "deterministic", feasibility: "pending" },
        isCondition: true,
        conditionBranches: [
          { label: "通过", icon: "✅", targetLabel: "定时发布" },
          { label: "不通过", icon: "❌", targetLabel: "内容修改（回到内容生成）" },
        ],
      },
    },
    {
      id: "node-5",
      type: "flowCard",
      position: { x: 300, y: 880 },
      data: {
        label: "定时发布",
        icon: "Clock",
        description: "按照排期表在最佳时间段自动发布内容",
        stepIndex: 5,
        totalSteps: 7,
        executionMode: "human_confirm",
        estimatedTime: "自动执行",
        inputs: [
          { id: "i1", name: "审核通过的内容", icon: "📝", description: "已通过合规审查", required: true, source: "previous_step", sourceDetail: "自动从「合规审查」获取" },
          { id: "i2", name: "发布时间", icon: "⏰", description: "排期时间", required: true, source: "previous_step", sourceDetail: "自动从「内容排期表」获取" },
        ],
        outputs: [
          { id: "o1", name: "发布记录", icon: "📤", description: "发布状态和链接", flowsTo: ["node-6"], dataType: "json" },
        ],
        errorHandling: [
          { strategy: "retry", enabled: true, config: { maxRetries: 2, retryInterval: 60 } },
          { strategy: "human_fallback", enabled: true, config: { notifyRole: "运营负责人" } },
          { strategy: "skip", enabled: false },
          { strategy: "abort", enabled: false },
        ],
        techConfig: { executionType: "deterministic", feasibility: "pending" },
      },
    },
    {
      id: "node-6",
      type: "flowCard",
      position: { x: 300, y: 1100 },
      data: {
        label: "数据监控",
        icon: "Activity",
        description: "监控已发布内容的互动数据，生成日报",
        stepIndex: 6,
        totalSteps: 7,
        executionMode: "ai_auto",
        estimatedTime: "持续运行",
        inputs: [
          { id: "i1", name: "发布记录", icon: "📤", description: "已发布的内容", required: true, source: "previous_step", sourceDetail: "自动从「定时发布」获取" },
        ],
        outputs: [
          { id: "o1", name: "数据日报", icon: "📊", description: "互动数据汇总", flowsTo: ["node-7"], dataType: "markdown" },
        ],
        errorHandling: [
          { strategy: "retry", enabled: true, config: { maxRetries: 5, retryInterval: 60 } },
          { strategy: "human_fallback", enabled: false },
          { strategy: "skip", enabled: true },
          { strategy: "abort", enabled: false },
        ],
        techConfig: { executionType: "deterministic", feasibility: "pending" },
      },
    },
    {
      id: "node-7",
      type: "flowCard",
      position: { x: 300, y: 1320 },
      data: {
        label: "策略调整建议",
        icon: "RefreshCw",
        description: "根据数据表现生成策略调整建议报告，供运营负责人决策",
        stepIndex: 7,
        totalSteps: 7,
        executionMode: "human_confirm",
        estimatedTime: "约 3 分钟",
        inputs: [
          { id: "i1", name: "数据日报", icon: "📊", description: "来自数据监控", required: true, source: "previous_step", sourceDetail: "自动从「数据监控」获取" },
          { id: "i2", name: "账号诊断报告", icon: "📄", description: "初始分析", required: true, source: "previous_step", sourceDetail: "自动从「账号分析」获取" },
        ],
        outputs: [
          { id: "o1", name: "策略调整建议", icon: "💡", description: "建议报告", flowsTo: [], dataType: "markdown" },
        ],
        errorHandling: [
          { strategy: "retry", enabled: true, config: { maxRetries: 2, retryInterval: 10 } },
          { strategy: "human_fallback", enabled: true, config: { notifyRole: "运营负责人" } },
          { strategy: "skip", enabled: false },
          { strategy: "abort", enabled: false },
        ],
        techConfig: { executionType: "intelligent", feasibility: "pending" },
      },
    },
  ];

  const edges: Edge[] = [
    { id: "e1-2", source: "node-1", target: "node-2", label: "诊断报告", animated: true, style: { stroke: "#94a3b8" } },
    { id: "e2-3", source: "node-2", target: "node-3", label: "内容排期表", animated: true, style: { stroke: "#94a3b8" } },
    { id: "e3-4", source: "node-3", target: "node-4", label: "图文内容", animated: true, style: { stroke: "#94a3b8" } },
    { id: "e4-5", source: "node-4", target: "node-5", label: "审查通过", animated: true, style: { stroke: "#22c55e" } },
    { id: "e4-3", source: "node-4", target: "node-3", label: "不通过，重新生成", animated: true, style: { stroke: "#ef4444", strokeDasharray: "5,5" } },
    { id: "e5-6", source: "node-5", target: "node-6", label: "发布记录", animated: true, style: { stroke: "#94a3b8" } },
    { id: "e6-7", source: "node-6", target: "node-7", label: "数据日报", animated: true, style: { stroke: "#94a3b8" } },
    { id: "e7-2", source: "node-7", target: "node-2", label: "每周复盘后调整", animated: false, style: { stroke: "#f59e0b", strokeDasharray: "8,4" } },
  ];

  return { nodes, edges };
}

export const MOCK_ANNOTATIONS: Annotation[] = [
  {
    id: "ann-1",
    nodeId: "node-1",
    author: { name: "王工", role: "tech" },
    content:
      "小红书 API 数据查询接口最多支持查询近 7 天数据，业务方写的「近 30 天」需要分多次查询拼接，技术上可做但耗时会增加。建议默认改为「近 7 天」，或在输入中让用户选择。",
    attachments: [
      {
        id: "att-1",
        fileName: "小红书API限制说明.md",
        source: "知识中心 > 平台规则",
        highlight: "数据查询接口最多支持查询近 7 天数据",
        lineRef: "第 12 行",
      },
    ],
    status: "pending",
    createdAt: "2026-03-31T15:30:00Z",
    replies: [],
  },
  {
    id: "ann-2",
    nodeId: "node-3",
    author: { name: "王工", role: "tech" },
    content:
      "文案生成没问题，但图片生成当前成功率约 70%，不合格的需要人工替换。建议拆成两个子步骤：① AI 生成文案 ② 人工配图，或增加一个「图片质量审核」子节点。",
    attachments: [
      {
        id: "att-2",
        fileName: "图片生成能力评估.md",
        source: "知识中心 > 能力文档",
        highlight: "图片生成：成功率约 70%，主要失败原因为构图不合理",
        lineRef: "第 38 行",
      },
    ],
    status: "pending",
    createdAt: "2026-03-31T15:45:00Z",
    replies: [],
  },
  {
    id: "ann-3",
    nodeId: "node-7",
    author: { name: "王工", role: "tech" },
    content:
      "「策略调整」本质上是业务决策，AI 只能提供数据分析和建议，最终决策应由人来做。建议改为「策略调整建议生成」，输出建议报告推送给运营负责人确认。",
    attachments: [
      {
        id: "att-3",
        fileName: "Agent决策边界规范.md",
        source: "知识中心 > 规范文档",
        highlight: "涉及业务方向的决策不应由 AI 自主执行",
        lineRef: "第 28 行",
      },
    ],
    status: "pending",
    createdAt: "2026-03-31T16:00:00Z",
    replies: [],
  },
];
