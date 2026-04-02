"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Target, Puzzle, ShieldCheck, BarChart3, SkipForward, Check } from "lucide-react";
import type { AgenticConfirmItem } from "@/lib/types";

const SECTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  goal: { label: "目标", icon: Target, color: "text-violet-600 bg-violet-50" },
  skills: { label: "技能", icon: Puzzle, color: "text-blue-600 bg-blue-50" },
  constraints: { label: "约束", icon: ShieldCheck, color: "text-amber-600 bg-amber-50" },
  evaluators: { label: "评估", icon: BarChart3, color: "text-green-600 bg-green-50" },
};

interface AgenticConfirmCardProps {
  item: AgenticConfirmItem;
  itemIndex: number;
  totalItems: number;
  onConfirm: (answer: string) => void;
  onSkip: () => void;
  onSkipAll: () => void;
  disabled?: boolean;
}

export default function AgenticConfirmCard({
  item, itemIndex, totalItems, onConfirm, onSkip, onSkipAll, disabled,
}: AgenticConfirmCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");

  const section = SECTION_CONFIG[item.section] || SECTION_CONFIG.goal;
  const Icon = section.icon;

  const handleConfirm = () => {
    const answer = selectedOption || customInput.trim();
    if (!answer) return;
    onConfirm(answer);
    setSelectedOption(null);
    setCustomInput("");
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
        <div className={`w-5 h-5 rounded flex items-center justify-center ${section.color}`}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-[10px] font-medium text-zinc-500">
          确认 {itemIndex + 1}/{totalItems} · {section.label}
        </span>
      </div>

      {/* Question */}
      <div className="p-3.5">
        <p className="text-sm font-medium text-zinc-800 leading-relaxed">{item.question}</p>
        {item.context && (
          <p className="text-xs text-zinc-400 mt-1">{item.context}</p>
        )}

        {/* Options */}
        {item.options && item.options.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {item.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => { setSelectedOption(opt); setCustomInput(""); }}
                disabled={disabled}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border
                  ${selectedOption === opt
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
                  }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Custom input */}
        <div className="mt-2">
          <Textarea
            value={customInput}
            onChange={(e) => { setCustomInput(e.target.value); setSelectedOption(null); }}
            placeholder="或者输入自定义回答..."
            className="text-xs min-h-[40px] max-h-[80px] resize-none"
            disabled={disabled}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-1">
            <Button
              size="sm" variant="ghost"
              className="h-6 text-[10px] px-2 text-zinc-400"
              onClick={onSkip}
              disabled={disabled}
            >
              <SkipForward className="w-3 h-3 mr-0.5" /> 跳过
            </Button>
            {totalItems - itemIndex > 1 && (
              <Button
                size="sm" variant="ghost"
                className="h-6 text-[10px] px-2 text-zinc-400"
                onClick={onSkipAll}
                disabled={disabled}
              >
                跳过全部
              </Button>
            )}
          </div>
          <Button
            size="sm"
            className="h-6 text-xs px-3 bg-violet-600 hover:bg-violet-700"
            onClick={handleConfirm}
            disabled={disabled || (!selectedOption && !customInput.trim())}
          >
            <Check className="w-3 h-3 mr-0.5" /> 确认
          </Button>
        </div>
      </div>
    </div>
  );
}
