"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Workflow, ArrowRight, Sparkles, BarChart3, PenTool, ShieldCheck } from "lucide-react";

const EXAMPLES = [
  {
    icon: "📱",
    title: "小红书账号运营",
    description: "分析账号 → 制定策略 → 生成内容 → 发布监控",
    steps: 7,
    time: "约 15 分钟",
    prompt: "我想做小红书账号运营，先分析账号现状和竞品，然后制定内容策略，每天生成3条图文内容，内容需要经过合规审查，审查通过后定时发布，发布后监控互动数据，每周根据数据调整策略",
  },
  {
    icon: "💰",
    title: "财务报销流程",
    description: "提交申请 → 审批 → 打款 → 归档",
    steps: 5,
    time: "约 10 分钟",
    prompt: "我想自动化财务报销流程，员工提交报销申请后，系统自动校验发票和金额，然后按审批规则流转给对应审批人，审批通过后自动发起打款，最后归档记录",
  },
  {
    icon: "📊",
    title: "竞品分析报告",
    description: "数据采集 → 分析对比 → 生成报告",
    steps: 4,
    time: "约 8 分钟",
    prompt: "我想做竞品分析，先从多个渠道采集竞品数据，然后从产品功能、用户评价、市场份额等维度进行对比分析，最后生成一份结构化的竞品分析报告",
  },
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
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Nav */}
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center px-6">
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-zinc-900" />
          <span className="font-semibold text-zinc-900">FlowAgent</span>
        </div>
        <span className="ml-3 text-xs text-zinc-400">从业务描述到 Agent 任务的翻译平台</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI 驱动的业务翻译工具
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-3">
            描述你的业务流程，AI 帮你画成流程图
          </h1>
          <p className="text-zinc-500 max-w-lg mx-auto">
            用自然语言描述业务流程，AI 自动生成可编辑的流程图。
            业务方确认后，技术方评审可行性，双方在同一张图上协作。
          </p>
        </div>

        {/* Input */}
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && input.trim()) { e.preventDefault(); handleStart(); } }}
              placeholder="例如：我想做小红书账号运营，先分析账号现状，然后制定内容策略，每天生成3条内容，发布后监控数据..."
              className="border-0 shadow-none focus-visible:ring-0 text-sm min-h-[80px] resize-none p-0"
            />
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-100">
              <p className="text-xs text-zinc-400">描述越具体，生成的流程图越准确</p>
              <Button onClick={() => handleStart()} disabled={!input.trim()}>
                生成流程图 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Examples */}
        <div className="w-full max-w-2xl mt-8">
          <p className="text-xs text-zinc-400 mb-3 text-center">或者试试这些场景</p>
          <div className="grid grid-cols-3 gap-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                onClick={() => handleStart(ex.prompt)}
                className="bg-white rounded-xl border border-zinc-200 p-4 text-left hover:border-zinc-300 hover:shadow-sm transition-all group"
              >
                <span className="text-2xl">{ex.icon}</span>
                <h3 className="text-sm font-semibold text-zinc-900 mt-2">{ex.title}</h3>
                <p className="text-xs text-zinc-500 mt-1">{ex.description}</p>
                <div className="flex items-center gap-2 mt-3 text-[10px] text-zinc-400">
                  <span>{ex.steps} 步</span>
                  <span>·</span>
                  <span>{ex.time}</span>
                </div>
                <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mt-2 inline-block">
                  使用此场景 →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="flex items-center gap-8 mt-12 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>AI 自动生成流程图</span>
          </div>
          <div className="flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5" />
            <span>拖拉拽自由编辑</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>技术方在线评审</span>
          </div>
        </div>
      </main>
    </div>
  );
}
