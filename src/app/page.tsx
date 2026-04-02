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
    description: "分析账号 → 制定策略 → 生成内容 → 发布监控",
    type: "agentic" as const,
    steps: 7,
    time: "约 15 分钟",
    prompt: "我想做小红书账号运营，先分析账号现状和竞品，然后制定内容策略，每天生成3条图文内容，内容需要经过合规审查，审查通过后定时发布，发布后监控互动数据，每周根据数据调整策略。目标是3个月涨粉5万",
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
    icon: "📊",
    title: "竞品分析报告",
    description: "数据采集 → 分析对比 → 生成报告",
    type: "agentic" as const,
    steps: 4,
    time: "约 8 分钟",
    prompt: "我想做竞品分析，先从多个渠道采集竞品数据，然后从产品功能、用户评价、市场份额等维度进行对比分析，最后生成一份结构化的竞品分析报告",
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
    router.push(`/editor?q=${encodeURIComponent(q.trim())}`);
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
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-100">
              <p className="text-xs text-zinc-400">AI 会自动判断是工作流还是智能体任务</p>
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
                      <span>{ex.steps} 步</span>
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
