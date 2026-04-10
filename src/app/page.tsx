"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Workflow, ArrowRight, Sparkles, BarChart3, PenTool,
  ShieldCheck, Zap, LayoutDashboard, Bot, GitBranch,
  CheckCircle2, ArrowUpRight, Code2,
} from "lucide-react";
import { CONSOLE_STATS } from "@/lib/mock-console";

const EXAMPLES = [
  {
    icon: "📱",
    title: "小红书账号运营",
    description: "每日3条图文 · 美妆/穿搭/互动 · 数据驱动优化",
    type: "agentic" as const,
    steps: 4,
    time: "约 15 分钟",
    prompt: "我们市场部要做小红书账号运营，目标是3个月从1万涨到5万粉丝。我们的运营方法是：每天发3条图文，内容以美妆测评为主（60%），穿搭教程（30%），互动话题（10%）。发布时间是早8点、中午12点、晚8点。合规红线：不提竞品品牌名、不做功效承诺、图片必须原创。每月预算不超过5000元。需要Agent按这个策略执行，每周给我数据报告，数据不好的时候给调整建议，但改方向需要我批准。",
  },
  {
    icon: "💰",
    title: "财务报销流程",
    description: "提交申请 → 审批 → 打款 → 归档",
    type: "workflow" as const,
    steps: 5,
    time: "约 10 分钟",
    prompt: "我想自动化财务报销流程，员工提交报销申请后，系统自动校验发票和金额，然后按审批规则流转给对应审批人，审批通过后自动发起打款，最后归档记录",
  },
  {
    icon: "📋",
    title: "App 改版项目管理",
    description: "需求→开发→测试→上线 · 自动跟进和催办",
    type: "agentic" as const,
    steps: 4,
    time: "约 10 分钟",
    prompt: "我们要做 App 2.0 改版，涉及3个前端+2个后端+1个设计师+1个测试，总周期35天。需要Agent帮我管项目：跟进每个人的任务进度（从飞书项目拉数据），每天早上给我站会摘要，识别延期风险自动催办，每周五出周报。需求变更和上线需要我审批。",
  },
  {
    icon: "🎧",
    title: "智能客服系统",
    description: "FAQ→复杂问题 · 能力递进 · 降低人工介入",
    type: "agentic" as const,
    steps: 4,
    time: "约 12 分钟",
    prompt: "我们客服部每天处理约500个咨询，其中60%是重复性问题（退换货政策、物流查询、账号问题）。想用Agent来处理这些，先从简单的FAQ开始，逐步扩展到能处理复杂投诉。人工客服目前8人，希望3个月后能减少到4人。Agent回复前需要经过质检，投诉类必须转人工。",
  },
  {
    icon: "👥",
    title: "校招批量招聘",
    description: "JD发布→简历筛选→面试→Offer · 50人招聘",
    type: "agentic" as const,
    steps: 4,
    time: "约 10 分钟",
    prompt: "秋招要招50个应届生（20个开发、15个产品、10个运营、5个设计），简历预计收到3000+份。需要Agent帮忙：自动发布JD到各平台，按条件初筛简历，安排面试时间（协调面试官日历），面试后汇总评价生成排名，Offer审批后自动发送。简历筛选标准和Offer薪资需要我确认。",
  },
  {
    icon: "📊",
    title: "竞品分析报告",
    description: "5个竞品 · 4个维度 · 每周结构化报告",
    type: "agentic" as const,
    steps: 4,
    time: "约 8 分钟",
    prompt: "我们产品部需要定期做竞品分析。目标竞品是：飞书、钉钉、企业微信、Slack、Teams。分析维度固定为：产品功能更新、定价变化、用户评价趋势、市场份额变化。每周一出一份报告，格式要统一（摘要+各维度详情+结论建议）。数据来源限定为官网、应用商店评价、36氪/虎嗅等科技媒体。报告终稿需要我确认后才能发给团队。",
  },
  {
    icon: "🌐",
    title: "TikTok 矩阵账号运营",
    description: "200个号 · 批量养号 · 数据分级 · 资源动态调度",
    type: "agentic" as const,
    steps: 4,
    time: "约 15 分钟",
    prompt: "我们海外营销部要做TikTok矩阵运营，计划开200个号，目标是3个月矩阵总粉丝达到100万。运营方法：先批量养号，每个号每天发1-2条短视频，内容覆盖好物推荐、开箱测评、使用教程三个方向。2周后根据数据筛选出高潜力号，对高潜号加大投入，弱号降频。每个号开号时间不同，所以同一时间不同号处于不同阶段。合规红线：不搬运、不涉政、不虚假宣传。需要Agent帮我管这个矩阵。策略大方向调整需要我批准。",
  },
  {
    icon: "📦",
    title: "进出口报关",
    description: "单据审核 → 编码归类 → 申报 → 放行",
    type: "workflow" as const,
    steps: 6,
    time: "约 12 分钟",
    prompt: "我想自动化进出口报关流程，收到委托后先审核报关单据的完整性，然后根据商品描述进行海关编码归类，计算关税，填制报关单，提交海关申报，等待审核放行后通知客户",
  },
];

const TYPE_BADGE = {
  workflow: { label: "工作流", icon: GitBranch, className: "bg-blue-50 text-blue-600 border-blue-200" },
  agentic: { label: "智能体", icon: Bot, className: "bg-violet-50 text-violet-600 border-violet-200" },
};

const FEATURES = [
  { icon: Zap, label: "AI 自动判断任务类型", color: "text-amber-500" },
  { icon: BarChart3, label: "工作流 + 智能体双模式", color: "text-blue-500" },
  { icon: PenTool, label: "拖拉拽自由编辑", color: "text-green-500" },
  { icon: ShieldCheck, label: "技术方在线评审", color: "text-violet-500" },
];

export default function HomePage() {
  const [input, setInput] = useState("");
  const router = useRouter();

  const handleStart = (prompt?: string) => {
    const q = prompt || input;
    if (!q.trim()) return;
    router.push(`/editor?q=${encodeURIComponent(q.trim())}&t=${Date.now()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 flex flex-col">
      {/* Nav */}
      <header className="h-14 border-b border-zinc-200/60 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Workflow className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-zinc-900">FlowAgent</span>
          <span className="ml-2 text-xs text-zinc-400 hidden sm:inline">业务翻译平台</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tech"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            技术方入口
          </Link>
          <Link
            href="/console"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            管控后台
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-4 pt-16 pb-12">
        <div className="text-center mb-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 text-amber-700 text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            AI 驱动的业务翻译工具
          </div>
          <h1 className="text-4xl font-extrabold text-zinc-900 mb-4 leading-tight tracking-tight">
            描述你的业务场景
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              AI 帮你翻译成可执行方案
            </span>
          </h1>
          <p className="text-base text-zinc-500 leading-relaxed">
            用自然语言描述业务场景，AI 自动判断任务类型——工作流生成流程图，智能体生成任务配置。
            <br className="hidden sm:block" />
            业务方确认后，技术方评审可行性，双方在同一个平台上协作。
          </p>
        </div>

        {/* Input */}
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-lg shadow-zinc-200/50 p-5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && input.trim()) { e.preventDefault(); handleStart(); } }}
              placeholder="例如：我想做小红书账号运营，目标是3个月涨粉5万..."
              className="border-0 shadow-none focus-visible:ring-0 text-sm min-h-[80px] resize-none p-0"
            />
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-zinc-100">
              <p className="w-full text-[11px] text-zinc-400 mb-1">💡 试试描述清楚这几点，AI 翻译更准确：</p>
              {[
                { label: "🎯 你要解决什么问题？", hint: "我想自动化" },
                { label: "📋 现在是怎么做的？", hint: "目前是人工" },
                { label: "✅ 期望的结果是什么？", hint: "希望能够" },
                { label: "👥 涉及哪些角色？", hint: "涉及的角色有" },
              ].map((tag) => (
                <button
                  key={tag.label}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors cursor-pointer"
                  onClick={() => {
                    if (!input.trim()) {
                      setInput(tag.hint);
                    } else if (!input.endsWith("，") && !input.endsWith("。") && !input.endsWith(" ")) {
                      setInput(input + "，" + tag.hint);
                    } else {
                      setInput(input + tag.hint);
                    }
                  }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3">
              <p className="text-xs text-zinc-400">AI 自动判断任务类型并标注人机分工</p>
              <Button
                onClick={() => handleStart()}
                disabled={!input.trim()}
                className="bg-zinc-900 hover:bg-zinc-800 px-5"
              >
                开始翻译 <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Examples */}
        <div className="w-full max-w-2xl mt-10">
          <p className="text-sm font-medium text-zinc-400 mb-4 text-center">或者试试这些场景</p>
          <div className="grid grid-cols-2 gap-4">
            {EXAMPLES.map((ex) => {
              const badge = TYPE_BADGE[ex.type];
              const BadgeIcon = badge.icon;
              return (
                <button
                  key={ex.title}
                  onClick={() => handleStart(ex.prompt)}
                  className="bg-white rounded-2xl border border-zinc-200/80 p-5 text-left hover:border-zinc-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-xl">
                      {ex.icon}
                    </div>
                    <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${badge.className}`}>
                      <BadgeIcon className="w-3 h-3" />
                      {badge.label}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 mt-3">{ex.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{ex.description}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span>{ex.steps} {ex.type === "agentic" ? "阶段" : "步"}</span>
                      <span className="w-px h-3 bg-zinc-200" />
                      <span>{ex.time}</span>
                    </div>
                    <span className="text-xs font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      试试看 <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pre-built demo schemes */}
        <div className="w-full max-w-2xl mt-10">
          <p className="text-sm font-medium text-zinc-400 mb-4 text-center">或者直接查看完整示例方案</p>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/editor?reviewId=review-3&role=business"
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl">
                  💰
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-blue-50 text-blue-600 border-blue-200 mb-1">
                    <GitBranch className="w-3 h-3" />
                    工作流示例
                  </Badge>
                  <h3 className="text-sm font-bold text-zinc-900">财务报销审批</h3>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                完整的 5 节点流程图，包含人机分工标注、技术评审批注。
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-[11px] text-zinc-400">5 个节点 · 含批注</span>
                <span className="text-xs font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  查看方案 <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
            <Link
              href="/editor?reviewId=review-1&role=business"
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-violet-50 text-violet-600 border-violet-200 mb-1">
                    <Bot className="w-3 h-3" />
                    内容运营
                  </Badge>
                  <h3 className="text-sm font-bold text-zinc-900">小红书账号运营</h3>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                4 个阶段（冷启动→策略验证→规模化→增长冲刺），含追问和审批点。
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-[11px] text-zinc-400">4 阶段 · 90天</span>
                <span className="text-xs font-medium text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  查看方案 <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
            <Link
              href="/editor?reviewId=review-5&role=business"
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-violet-50 text-violet-600 border-violet-200 mb-1">
                    <Bot className="w-3 h-3" />
                    项目管理
                  </Badge>
                  <h3 className="text-sm font-bold text-zinc-900">App 改版项目管理</h3>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                4 个阶段（需求对齐→开发跟进→测试验收→发布上线）。
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-[11px] text-zinc-400">4 阶段 · 35天</span>
                <span className="text-xs font-medium text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  查看方案 <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
            <Link
              href="/editor?reviewId=review-6&role=business"
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl">
                  🎧
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-violet-50 text-violet-600 border-violet-200 mb-1">
                    <Bot className="w-3 h-3" />
                    智能客服
                  </Badge>
                  <h3 className="text-sm font-bold text-zinc-900">智能客服系统</h3>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                4 个阶段（知识库构建→FAQ试运行→复杂场景扩展→稳定运营）。
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-[11px] text-zinc-400">4 阶段 · 90天</span>
                <span className="text-xs font-medium text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  查看方案 <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
            <Link
              href="/editor?reviewId=review-7&role=business"
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl">
                  👥
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-violet-50 text-violet-600 border-violet-200 mb-1">
                    <Bot className="w-3 h-3" />
                    批量招聘
                  </Badge>
                  <h3 className="text-sm font-bold text-zinc-900">校招批量招聘</h3>
                </div>
                <p className="text-xs text-zinc-500 ml-auto leading-relaxed">
                  4 个阶段（岗位发布→笔试初面→终面评估→Offer发放）
                </p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-[11px] text-zinc-400">4 阶段 · 45天 · 50人招聘</span>
                <span className="text-xs font-medium text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  查看方案 <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
            <Link
              href="/editor?reviewId=review-8&role=business"
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl">
                  🌐
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-violet-50 text-violet-600 border-violet-200 mb-1">
                    <Bot className="w-3 h-3" />
                    矩阵运营
                  </Badge>
                  <h3 className="text-sm font-bold text-zinc-900">TikTok 矩阵账号运营</h3>
                </div>
                <p className="text-xs text-zinc-500 ml-auto leading-relaxed">
                  4 个阶段（批量冷启动→数据分级→加速优化→稳态冲刺）
                </p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <span className="text-[11px] text-zinc-400">4 阶段 · 90天 · 200个账号</span>
                <span className="text-xs font-medium text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  查看方案 <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="flex items-center gap-6 mt-14">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-zinc-100 shadow-sm">
                <Icon className={`w-3.5 h-3.5 ${f.color}`} />
                <span className="text-xs font-medium text-zinc-600">{f.label}</span>
              </div>
            );
          })}
        </div>

        {/* Console entry card */}
        <div className="w-full max-w-2xl mt-14">
          <Link
            href="/console"
            className="flex items-center gap-5 p-5 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-800 text-white hover:from-zinc-800 hover:to-zinc-700 transition-all shadow-lg shadow-zinc-300/50 group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-6 h-6 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold">管控后台</h3>
              <p className="text-xs text-zinc-400 mt-0.5">查看已部署 Agent 的运行状态、任务监控、人工确认</p>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs text-zinc-400">
              <div className="flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" />
                <span>{CONSOLE_STATS.activeAgents} 个 Agent</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{CONSOLE_STATS.successRate}% 成功率</span>
              </div>
              <ArrowRight className="w-4 h-4 text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
