"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ArrowRight, Sparkles, Bot, UserCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "flowagent_onboarding_done";

interface SpotlightStep {
  target: string;
  title: string;
  desc: string;
  emoji: string;
  placement: "right" | "bottom" | "left" | "top";
  fallbackPosition?: { top: string; left: string };
}

const STEPS: SpotlightStep[] = [
  {
    target: "[data-onboarding='flow-node']",
    title: "每张卡片 = 一个工作步骤",
    desc: "AI 把你的工作拆成了这些步骤。点击任意卡片就能查看详情、修改内容。",
    emoji: "👆",
    placement: "right",
  },
  {
    target: "[data-onboarding='exec-badge']",
    title: "谁来做？点一下就能切换",
    desc: "「AI 自动 / 需你确认 / 你来做」——直接在卡片上点击切换，不用等 AI 重新生成。",
    emoji: "🔄",
    placement: "top",
  },
  {
    target: "[data-onboarding='chat-panel']",
    title: "大改告诉 AI，小改自己动手",
    desc: "要加减步骤或改方向？在这里告诉 AI。改执行方式、改描述这些小调整，直接点卡片就行。",
    emoji: "💬",
    placement: "right",
  },
];

interface OnboardingGuideProps {
  visible: boolean;
  onDone: () => void;
}

function getRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

function getPopoverPosition(
  rect: DOMRect,
  placement: SpotlightStep["placement"],
  popoverWidth: number,
  popoverHeight: number,
) {
  const GAP = 16;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "right":
      top = rect.top + rect.height / 2 - popoverHeight / 2;
      left = rect.right + GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2 - popoverHeight / 2;
      left = rect.left - popoverWidth - GAP;
      break;
    case "bottom":
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - popoverWidth / 2;
      break;
    case "top":
      top = rect.top - popoverHeight - GAP;
      left = rect.left + rect.width / 2 - popoverWidth / 2;
      break;
  }

  top = Math.max(12, Math.min(top, window.innerHeight - popoverHeight - 12));
  left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

  return { top, left };
}

export default function OnboardingGuide({ visible, onDone }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const POPOVER_W = 300;
  const POPOVER_H = 180;

  const updateTargetRect = useCallback(() => {
    if (!show) return;
    const rect = getRect(STEPS[step]?.target ?? "");
    setTargetRect(rect);
  }, [show, step]);

  useEffect(() => {
    if (!visible) return;
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!show) return;
    updateTargetRect();
    const timer = setInterval(updateTargetRect, 500);
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [show, step, updateTargetRect]);

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const pad = 8;

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

  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - pad,
        left: targetRect.left - pad,
        width: targetRect.width + pad * 2,
        height: targetRect.height + pad * 2,
      }
    : null;

  const popoverPos = targetRect
    ? getPopoverPosition(targetRect, current.placement, POPOVER_W, POPOVER_H)
    : { top: window.innerHeight / 3, left: window.innerWidth / 2 - POPOVER_W / 2 };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "auto" }} onClick={handleDone}>
        <defs>
          <mask id="onboarding-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightStyle && (
              <rect
                x={spotlightStyle.left}
                y={spotlightStyle.top}
                width={spotlightStyle.width}
                height={spotlightStyle.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.45)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {/* Spotlight ring */}
      {spotlightStyle && (
        <div
          className="absolute rounded-xl border-2 border-blue-400 pointer-events-none transition-all duration-500 ease-out"
          style={{
            top: spotlightStyle.top,
            left: spotlightStyle.left,
            width: spotlightStyle.width,
            height: spotlightStyle.height,
            boxShadow: "0 0 0 4px rgba(59,130,246,0.15), 0 0 20px rgba(59,130,246,0.1)",
          }}
        />
      )}

      {/* Popover card */}
      <div
        className="absolute pointer-events-auto transition-all duration-500 ease-out"
        style={{
          top: popoverPos.top,
          left: popoverPos.left,
          width: POPOVER_W,
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 p-5 relative">
          <button
            onClick={handleDone}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-blue-500" : i < step ? "w-3 bg-blue-200" : "w-3 bg-zinc-100"
                }`}
              />
            ))}
            <span className="text-[10px] text-zinc-400 ml-auto">{step + 1}/{STEPS.length}</span>
          </div>

          <div className="text-2xl mb-2">{current.emoji}</div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1.5">{current.title}</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">{current.desc}</p>

          {/* Step 2 inline demo */}
          {step === 1 && (
            <div className="flex items-center gap-1.5 mt-3 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] border border-blue-200">
                <Bot className="w-3 h-3" /> AI 自动
              </span>
              <ArrowRight className="w-3 h-3 text-zinc-300" />
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[10px] border border-amber-200">
                <UserCheck className="w-3 h-3" /> 需确认
              </span>
              <ArrowRight className="w-3 h-3 text-zinc-300" />
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-[10px] border border-purple-200">
                <User className="w-3 h-3" /> 人工
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={handleDone}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              跳过
            </button>
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-zinc-900 hover:bg-zinc-800 text-xs h-8 px-4"
            >
              {isLast ? (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  知道了，开始用
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
      </div>
    </div>
  );
}
