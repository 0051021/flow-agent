"use client";

import { useState } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizStep {
  question: string;
  hint?: string;
  options: { label: string; value: string }[];
  allowOther?: boolean;
}

const QUIZ_STEPS: QuizStep[] = [
  {
    question: "你主要做什么工作？",
    hint: "选一个最接近的",
    options: [
      { label: "💰 财务/行政（报销、审批、归档）", value: "财务行政" },
      { label: "📱 市场/运营（内容、推广、数据）", value: "市场运营" },
      { label: "👥 HR（招聘、入职、绩效）", value: "人力资源" },
      { label: "🎧 客服（咨询、投诉、售后）", value: "客户服务" },
      { label: "📋 项目管理（需求、排期、跟进）", value: "项目管理" },
      { label: "📦 供应链/物流（采购、报关、仓储）", value: "供应链物流" },
    ],
    allowOther: true,
  },
  {
    question: "你最想让 AI 帮你处理哪类事？",
    hint: "选一个最让你头疼的",
    options: [
      { label: "🔁 重复性工作太多，每天花大量时间", value: "重复性工作" },
      { label: "⏰ 流程太长，中间等待太久", value: "流程等待时间长" },
      { label: "🤝 需要多人协作，沟通成本高", value: "多人协作沟通" },
      { label: "📊 数据收集和整理费时费力", value: "数据收集整理" },
      { label: "👀 需要时刻盯着，容易遗漏", value: "需要持续监控" },
    ],
    allowOther: true,
  },
  {
    question: "这件事大概分几步？",
    hint: "别想太细，大概估一下",
    options: [
      { label: "2-3 步，比较简单", value: "2到3步" },
      { label: "4-6 步，有一定流程", value: "4到6步" },
      { label: "7步以上，流程比较复杂", value: "7步以上" },
      { label: "说不清楚，我也不太确定", value: "步骤不确定" },
    ],
  },
  {
    question: "你希望哪些步骤让 AI 自动做，哪些你来把关？",
    hint: "这决定了 AI 帮你做多少",
    options: [
      { label: "🤖 能自动的都自动，我只看最终结果", value: "高度自动化，我只审核结果" },
      { label: "⚖️ 关键节点让我确认，其余 AI 处理", value: "关键步骤人工确认，其余AI处理" },
      { label: "👤 每步都想知道，AI 只做辅助", value: "我全程参与，AI只做辅助支持" },
    ],
  },
];

interface QuizPromptBuilderProps {
  onComplete: (prompt: string) => void;
  onCancel: () => void;
}

export default function QuizPromptBuilder({ onComplete, onCancel }: QuizPromptBuilderProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [otherInput, setOtherInput] = useState("");
  const [selected, setSelected] = useState<string>("");

  const currentStep = QUIZ_STEPS[stepIdx];
  const isLast = stepIdx === QUIZ_STEPS.length - 1;

  const handleSelect = (value: string) => {
    setSelected(value);
    setOtherInput("");
  };

  const handleNext = () => {
    const answer = selected === "__other__" ? otherInput.trim() : selected;
    if (!answer) return;
    const newAnswers = [...answers, answer];

    if (isLast) {
      // 生成 prompt
      const prompt = buildPrompt(newAnswers);
      onComplete(prompt);
    } else {
      setAnswers(newAnswers);
      setStepIdx(stepIdx + 1);
      setSelected("");
      setOtherInput("");
    }
  };

  const handleBack = () => {
    if (stepIdx === 0) {
      onCancel();
    } else {
      setAnswers(answers.slice(0, -1));
      setStepIdx(stepIdx - 1);
      setSelected("");
      setOtherInput("");
    }
  };

  const canNext = selected === "__other__" ? otherInput.trim().length > 0 : selected.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-lg shadow-zinc-200/50 p-5">
      {/* 步骤进度 */}
      <div className="flex items-center gap-1.5 mb-5">
        {QUIZ_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full flex-1 transition-all duration-300 ${
              i < stepIdx ? "bg-zinc-900" : i === stepIdx ? "bg-zinc-600" : "bg-zinc-100"
            }`}
          />
        ))}
      </div>

      {/* 问题 */}
      <p className="text-xs text-zinc-400 mb-1">第 {stepIdx + 1} / {QUIZ_STEPS.length} 步</p>
      <h3 className="text-sm font-bold text-zinc-900 mb-1">{currentStep.question}</h3>
      {currentStep.hint && (
        <p className="text-xs text-zinc-400 mb-4">{currentStep.hint}</p>
      )}

      {/* 选项 */}
      <div className="flex flex-col gap-2 mb-4">
        {currentStep.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`text-left text-xs px-3 py-2.5 rounded-xl border transition-all ${
              selected === opt.value
                ? "border-zinc-900 bg-zinc-50 text-zinc-900 font-medium"
                : "border-zinc-100 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {currentStep.allowOther && (
          <button
            onClick={() => handleSelect("__other__")}
            className={`text-left text-xs px-3 py-2.5 rounded-xl border transition-all ${
              selected === "__other__"
                ? "border-zinc-900 bg-zinc-50 text-zinc-900 font-medium"
                : "border-zinc-100 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            ✏️ 其他（我来描述）
          </button>
        )}
      </div>

      {/* 自定义输入 */}
      {selected === "__other__" && (
        <input
          autoFocus
          type="text"
          value={otherInput}
          onChange={(e) => setOtherInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canNext) handleNext(); }}
          placeholder="简单描述一下…"
          className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-xl mb-4 focus:outline-none focus:border-zinc-400"
        />
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
          {stepIdx === 0 ? "取消" : "上一步"}
        </button>
        <Button
          size="sm"
          onClick={handleNext}
          disabled={!canNext}
          className="bg-zinc-900 hover:bg-zinc-800 text-xs h-8 px-4 disabled:opacity-40"
        >
          {isLast ? "生成我的方案" : "下一步"}
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function buildPrompt(answers: string[]): string {
  const [domain, painPoint, steps, automationLevel] = answers;
  return `我的工作领域是${domain}。最让我头疼的是${painPoint}，这件事大概分${steps}。我希望${automationLevel}。请帮我把这个工作流程梳理清楚，标出哪些步骤 AI 可以自动完成、哪些需要我来确认。`;
}
