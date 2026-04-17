"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "flowagent_onboarding_done";

const STEPS = [
  {
    title: "AI 帮你梳理好了",
    desc: "右边是根据你的描述生成的方案草稿，把你的工作拆成了一步步清晰的流程。",
    emoji: "🎉",
  },
  {
    title: "颜色标记 = 需要你补充",
    desc: "带黄色或红色标记的步骤，是 AI 觉得信息不够的地方。点击步骤可以查看问题、补充说明。",
    emoji: "🔍",
  },
  {
    title: "可以随时修改",
    desc: "觉得哪步不对？直接点击步骤修改，或者在左边对话框告诉 AI「第 3 步改成…」都行。",
    emoji: "✏️",
  },
  {
    title: "满意了就确认",
    desc: "调整好之后，点击右上角的「确认方案」，你的团队就能拿这份方案去搭建自动化系统了。",
    emoji: "✅",
  },
];

interface OnboardingGuideProps {
  visible: boolean;
  onDone: () => void;
}

export default function OnboardingGuide({ visible, onDone }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) return;
    // 延迟一点再出现，让方案先渲染
    const t = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(t);
  }, [visible]);

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleDone();
    } else {
      setStep(step + 1);
    }
  };

  const handleDone = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setShow(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={handleDone} />

      {/* 引导卡片 — 固定在画布中央偏上 */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto w-80">
        <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6 relative">
          {/* 关闭按钮 */}
          <button
            onClick={handleDone}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* 步骤指示 */}
          <div className="flex items-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-zinc-900" : i < step ? "w-3 bg-zinc-300" : "w-3 bg-zinc-100"
                }`}
              />
            ))}
          </div>

          {/* 内容 */}
          <div className="text-3xl mb-3">{current.emoji}</div>
          <h3 className="text-sm font-bold text-zinc-900 mb-2">{current.title}</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">{current.desc}</p>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={handleDone}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              跳过引导
            </button>
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-zinc-900 hover:bg-zinc-800 text-xs h-8 px-4"
            >
              {isLast ? (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  开始使用
                </>
              ) : (
                <>
                  下一步
                  <ArrowRight className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 小箭头指向画布 */}
        <div className="w-4 h-4 bg-white border-r border-b border-zinc-200 rotate-45 mx-auto -mt-2 shadow-sm" />
      </div>
    </div>
  );
}
