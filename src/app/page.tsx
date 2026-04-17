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
  CheckCircle2, ArrowUpRight, Code2, ListChecks,
} from "lucide-react";
import { CONSOLE_STATS } from "@/lib/mock-console";
import QuizPromptBuilder from "@/components/ui/QuizPromptBuilder";

const EXAMPLES = [
  {
    icon: "📱",
    title: "小红书账号运营",
    description: "每天手动想内容、盯数据太累？让 AI 按策略自动执行，你只管审核方向。",
    type: "agentic" as const,
    steps: 4,
    time: "约 15 分钟",
    prompt: "我们市场部要做小红书账号运营，目标是3个月从1万涨到5万粉丝。我们的运营方法是：每天发3条图文，内容以美妆测评为主（60%），穿搭教程（30%），互动话题（10%）。发布时间是早8点、中午12点、晚8点。合规红线：不提竞品品牌名、不做功效承诺、图片必须原创。每月预算不超过5000元。需要Agent按这个策略执行，每周给我数据报告，数据不好的时候给调整建议，但改方向需要我批准。",
  },
  {
    icon: "💰",
    title: "财务报销流程",
    description: "报销单堆着没人审？审批流程一团乱？把整个流程理清楚，该自动的自动。",
    type: "workflow" as const,
    steps: 5,
    time: "约 10 分钟",
    prompt: "我想自动化财务报销流程，员工提交报销申请后，系统自动校验发票和金额，然后按审批规则流转给对应审批人，审批通过后自动发起打款，最后归档记录",
  },
  {
    icon: "📋",
    title: "App 改版项目管理",
    description: "项目进度靠人催、风险靠感觉？让 AI 盯进度、报风险，你专注做决策。",
    type: "agentic" as const,
    steps: 4,
    time: "约 10 分钟",
    prompt: "我们要做 App 2.0 改版，涉及3个前端+2个后端+1个设计师+1个测试，总周期35天。需要Agent帮我管项目：跟进每个人的任务进度（从飞书项目拉数据），每天早上给我站会摘要，识别延期风险自动催办，每周五出周报。需求变更和上线需要我审批。",
  },
  {
    icon: "🎧",
    title: "智能客服系统",
    description: "60% 都是重复问题，客服天天答同样的话？让 AI 先处理，复杂的再转人工。",
    type: "agentic" as const,
    steps: 4,
    time: "约 12 分钟",
    prompt: "我们客服部每天处理约500个咨询，其中60%是重复性问题（退换货政策、物流查询、账号问题）。想用Agent来处理这些，先从简单的FAQ开始，逐步扩展到能处理复杂投诉。人工客服目前8人，希望3个月后能减少到4人。Agent回复前需要经过质检，投诉类必须转人工。",
  },
  {
    icon: "👥",
    title: "校招批量招聘",
    description: "3000+ 份简历靠人看？面试时间协调一团乱？把筛选和跟进交给 AI。",
    type: "agentic" as const,
    steps: 4,
    time: "约 10 分钟",
    prompt: "秋招要招50个应届生（20个开发、15个产品、10个运营、5个设计），简历预计收到3000+份。需要Agent帮忙：自动发布JD到各平台，按条件初筛简历，安排面试时间（协调面试官日历），面试后汇总评价生成排名，Offer审批后自动发送。简历筛选标准和Offer薪资需要我确认。",
  },
  {
    icon: "📊",
    title: "竞品分析报告",
    description: "每周手动收集竞品动态太费时？让 AI 定期追踪、整理成报告给你看。",
    type: "agentic" as const,
    steps: 4,
    time: "约 8 分钟",
    prompt: "我们产品部需要定期做竞品分析。目标竞品是：飞书、钉钉、企业微信、Slack、Teams。分析维度固定为：产品功能更新、定价变化、用户评价趋势、市场份额变化。每周一出一份报告，格式要统一（摘要+各维度详情+结论建议）。数据来源限定为官网、应用商店评价、36氪/虎嗅等科技媒体。报告终稿需要我确认后才能发给团队。",
  },
  {
    icon: "🌐",
    title: "TikTok 矩阵账号运营",
    description: "200 个账号靠人盯、数据分级靠感觉？规则定好，AI 帮你管这个矩阵。",
    type: "agentic" as const,
    steps: 4,
    time: "约 15 分钟",
    prompt: "我们海外营销部要做TikTok矩阵运营，计划开200个号，目标是3个月矩阵总粉丝达到100万。运营方法：先批量养号，每个号每天发1-2条短视频，内容覆盖好物推荐、开箱测评、使用教程三个方向。2周后根据数据筛选出高潜力号，对高潜号加大投入，弱号降频。每个号开号时间不同，所以同一时间不同号处于不同阶段。合规红线：不搬运、不涉政、不虚假宣传。需要Agent帮我管这个矩阵。策略大方向调整需要我批准。",
  },
  {
    icon: "📦",
    title: "进出口报关",
    description: "报关单据多、编码归类靠经验、漏了就麻烦？把每个环节标清楚、管起来。",
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
  { icon: Zap, label: "AI 自动拆解工作步骤", color: "text-amber-500" },
  { icon: BarChart3, label: "清晰标注人机分工", color: "text-blue-500" },
  { icon: PenTool, label: "拖拽修改随时调整", color: "text-green-500" },
  { icon: ShieldCheck, label: "团队协作在线评审", color: "text-violet-500" },
];

export default function HomePage() {
  const [input, setInput] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
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
          <span className="ml-1.5 text-xs text-zinc-400 hidden sm:inline font-normal">工作流程 AI 助手</span>
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
      <main className="flex-1 flex flex-col items-center px-4 pt-12 pb-16">
        <div className="text-center mb-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 text-amber-700 text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            用 AI 把工作流程理清楚
          </div>
          <h1 className="text-4xl font-extrabold text-zinc-900 mb-4 leading-tight tracking-tight">
            说说你的工作
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              AI 帮你理清流程、找出能自动化的部分
            </span>
          </h1>
          <p className="text-base text-zinc-500 leading-relaxed">
            把你每天在做的事情描述给 AI，它会帮你拆解成清晰的步骤，标出哪些可以让 AI 自动做、哪些需要你来把关。
            <br className="hidden sm:block" />
            整理好之后，你的团队可以直接拿这份方案去搭建自动化系统。
          </p>
        </div>

        {/* Input */}
        <div className="w-full max-w-2xl">
          {showQuiz ? (
            <QuizPromptBuilder
              onComplete={(prompt) => {
                setInput(prompt);
                setShowQuiz(false);
                handleStart(prompt);
              }}
              onCancel={() => setShowQuiz(false)}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-lg shadow-zinc-200/50 p-5">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && input.trim()) { e.preventDefault(); handleStart(); } }}
                placeholder="例如：我每天要处理几十张报销单，先核对发票，再找领导签字，最后录入系统，很费时间……"
                className="border-0 shadow-none focus-visible:ring-0 text-sm min-h-[80px] resize-none p-0"
              />
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-zinc-100">
                <p className="w-full text-[11px] text-zinc-400 mb-1">💡 说清楚这几点，AI 梳理得更准：</p>
                {[
                  { label: "⏰ 每天最花时间的事是什么？", hint: "我每天花大量时间在" },
                  { label: "🔁 这件事大概怎么做的？", hint: "目前的做法是先" },
                  { label: "😫 最让你头疼的环节是？", hint: "最麻烦的地方是" },
                  { label: "🤝 谁需要参与进来？", hint: "这件事需要" },
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
                <button
                  onClick={() => setShowQuiz(true)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-blue-600 transition-colors"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  不知道怎么写？回答几个问题
                </button>
                <Button
                  onClick={() => handleStart()}
                  disabled={!input.trim()}
                  className="bg-zinc-900 hover:bg-zinc-800 px-5"
                >
                  帮我梳理 <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Examples */}
        <div className="w-full max-w-2xl mt-10">
          <p className="text-xs text-zinc-400 mb-3 text-center tracking-wide uppercase">常见场景</p>
          <div className="grid grid-cols-2 gap-3">
            {EXAMPLES.map((ex) => {
              const badge = TYPE_BADGE[ex.type];
              const BadgeIcon = badge.icon;
              return (
                <button
                  key={ex.title}
                  onClick={() => handleStart(ex.prompt)}
                  className="bg-white rounded-2xl border border-zinc-200/80 p-4 text-left hover:border-zinc-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xl">{ex.icon}</span>
                    <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${badge.className}`}>
                      <BadgeIcon className="w-3 h-3" />
                      {badge.label}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900">{ex.title}</h3>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">{ex.description}</p>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100">
                    <span className="text-[11px] text-zinc-400">{ex.steps} {ex.type === "agentic" ? "阶段" : "步"} · {ex.time}</span>
                    <span className="text-[11px] font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      试试 <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pre-built demo schemes — compact list */}
        <div className="w-full max-w-2xl mt-8">
          <p className="text-xs text-zinc-400 mb-3 text-center tracking-wide uppercase">先看看效果长什么样</p>
          <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100 overflow-hidden">
            {[
              { href: "/editor?reviewId=review-3&role=business", icon: "💰", label: "财务报销审批", meta: "5 个步骤 · 含人工审批节点", color: "text-blue-500" },
              { href: "/editor?reviewId=review-1&role=business", icon: "📱", label: "小红书账号运营", meta: "4 阶段 · 90天 · 含批准点", color: "text-violet-500" },
              { href: "/editor?reviewId=review-5&role=business", icon: "📋", label: "App 改版项目管理", meta: "4 阶段 · 35天 · 自动跟进催办", color: "text-violet-500" },
              { href: "/editor?reviewId=review-6&role=business", icon: "🎧", label: "智能客服系统", meta: "4 阶段 · 90天 · 渐进式替代人工", color: "text-violet-500" },
              { href: "/editor?reviewId=review-7&role=business", icon: "👥", label: "校招批量招聘", meta: "4 阶段 · 45天 · 50人规模", color: "text-violet-500" },
              { href: "/editor?reviewId=review-8&role=business", icon: "🌐", label: "TikTok 矩阵运营", meta: "4 阶段 · 90天 · 200个账号", color: "text-violet-500" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors group"
              >
                <span className="text-lg w-7 text-center shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-800">{item.label}</span>
                  <span className="text-[11px] text-zinc-400 ml-2">{item.meta}</span>
                </div>
                <ArrowUpRight className={`w-3.5 h-3.5 ${item.color} opacity-0 group-hover:opacity-100 transition-opacity shrink-0`} />
              </Link>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="w-full max-w-2xl mt-8">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-zinc-100">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${f.color}`} />
                  <span className="text-xs text-zinc-600 leading-tight">{f.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Console entry card */}
        <div className="w-full max-w-2xl mt-8">
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
