"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Pencil,
  SkipForward,
  Sparkles,
} from "lucide-react";
import type { NodeConfidence } from "@/lib/store";

// ============================================================
// NodeQuestionCard — 一张卡片展示一个节点的所有问题
// ============================================================

interface NodeQuestionCardProps {
  nodeConf: NodeConfidence;
  nodeLabel: string;
  nodeIndex: number;
  totalNodes: number;
  onConfirm: (answers: { question: string; answer: string }[]) => void;
  onSkipNode: () => void;
  onSkipAll: () => void;
  disabled?: boolean;
}

export default function NodeQuestionCard({
  nodeConf,
  nodeLabel,
  nodeIndex,
  totalNodes,
  onConfirm,
  onSkipNode,
  onSkipAll,
  disabled,
}: NodeQuestionCardProps) {
  const questions = nodeConf.questions;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, boolean>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

  const setAnswer = useCallback((qId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    setCustomInputs((prev) => ({ ...prev, [qId]: false }));
  }, []);

  const allAnswered = questions.every((q) => answers[q.id]);

  const handleConfirm = () => {
    const result = questions.map((q) => ({
      question: q.question,
      answer: answers[q.id] || q.defaultSuggestion,
    }));
    onConfirm(result);
  };

  const handleUseDefaults = () => {
    const result = questions.map((q) => ({
      question: q.question,
      answer: q.defaultSuggestion,
    }));
    onConfirm(result);
  };

  const confidenceColor = {
    high: "text-green-600 bg-green-50 border-green-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    low: "text-red-500 bg-red-50 border-red-200",
  }[nodeConf.confidence];

  const confidenceLabel = {
    high: "把握较大",
    medium: "需要确认",
    low: "需要补充",
  }[nodeConf.confidence];

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
      {/* Progress bar */}
      <div className="h-1 bg-zinc-100">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${((nodeIndex + 1) / Math.max(totalNodes, 1)) * 100}%` }}
        />
      </div>

      {/* Node header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-zinc-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400 font-medium">
              节点 {nodeIndex + 1}/{totalNodes}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${confidenceColor}`}>
              {confidenceLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
              onClick={onSkipNode}
              disabled={disabled}
            >
              <ChevronRight className="w-2.5 h-2.5" />
              跳过此节点
            </button>
            {nodeIndex < totalNodes - 1 && (
              <button
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                onClick={onSkipAll}
                disabled={disabled}
              >
                <SkipForward className="w-2.5 h-2.5" />
                跳过全部
              </button>
            )}
          </div>
        </div>
        <p className="text-xs font-semibold text-zinc-800">{nodeLabel}</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">{nodeConf.reason}</p>
      </div>

      {/* Questions */}
      <div className="px-3 py-2.5 space-y-3">
        {questions.map((q, qi) => {
          const selected = answers[q.id];
          const showCustom = customInputs[q.id];

          const allOptions: { label: string; isDefault: boolean }[] = [
            { label: q.defaultSuggestion, isDefault: true },
            ...(q.options || []).map((o) => ({ label: o, isDefault: false })),
          ];

          return (
            <div key={q.id}>
              {questions.length > 1 && (
                <p className="text-[10px] text-zinc-400 mb-1">
                  问题 {qi + 1}/{questions.length}
                </p>
              )}
              <p className="text-[11px] font-medium text-zinc-700 leading-relaxed mb-0.5">
                {q.question}
              </p>
              <p className="text-[10px] text-zinc-400 mb-1.5">{q.context}</p>

              <div className="space-y-1">
                {allOptions.map((opt, oi) => {
                  const isSelected = selected === opt.label;
                  return (
                    <button
                      key={oi}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left group ${
                        isSelected
                          ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200"
                          : "border-zinc-100 bg-zinc-50 hover:bg-blue-50 hover:border-blue-200"
                      }`}
                      onClick={() => setAnswer(q.id, opt.label)}
                      disabled={disabled}
                    >
                      {opt.isDefault ? (
                        <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
                      ) : (
                        <ChevronRight className={`w-3 h-3 shrink-0 ${isSelected ? "text-blue-400" : "text-zinc-300 group-hover:text-blue-400"}`} />
                      )}
                      <span className={`text-[11px] leading-relaxed ${isSelected ? "text-blue-700 font-medium" : "text-zinc-600 group-hover:text-blue-700"}`}>
                        {opt.isDefault && (
                          <span className="text-amber-500 text-[10px] mr-1">推荐</span>
                        )}
                        {opt.label}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-3 h-3 text-blue-500 ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}

                {showCustom ? (
                  <div className="flex gap-1.5 mt-1">
                    <input
                      type="text"
                      placeholder="输入你的想法..."
                      className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                      value={customTexts[q.id] || ""}
                      onChange={(e) => setCustomTexts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (customTexts[q.id] || "").trim()) {
                          setAnswer(q.id, (customTexts[q.id] || "").trim());
                        }
                      }}
                      disabled={disabled}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2"
                      onClick={() => {
                        const text = (customTexts[q.id] || "").trim();
                        if (text) setAnswer(q.id, text);
                      }}
                      disabled={disabled || !(customTexts[q.id] || "").trim()}
                    >
                      确定
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors mt-0.5"
                    onClick={() => setCustomInputs((prev) => ({ ...prev, [q.id]: true }))}
                    disabled={disabled}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    都不合适，我自己说
                  </button>
                )}
              </div>

              {qi < questions.length - 1 && <div className="border-b border-zinc-100 mt-3" />}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="px-3 pb-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-[11px] text-zinc-500"
          onClick={handleUseDefaults}
          disabled={disabled}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          全部用推荐
        </Button>
        <Button
          size="sm"
          className="flex-1 h-8 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleConfirm}
          disabled={disabled || !allAnswered}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          确认这个节点
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// CompletionCard
// ============================================================

export function CompletionCard({ onDone }: { onDone: () => void }) {
  return (
    <div className="bg-green-50 rounded-xl border border-green-100 p-3">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        <span className="text-xs font-medium text-green-800">流程图已完善</span>
      </div>
      <p className="text-[11px] text-green-600 leading-relaxed mb-2">
        所有节点都已确认，流程图已根据你的回答优化完毕。你可以继续在画布上拖拽调整，或者告诉我还有什么需要修改的。
      </p>
      <Button
        size="sm"
        variant="outline"
        className="w-full h-7 text-[11px] border-green-200 text-green-700 hover:bg-green-100"
        onClick={onDone}
      >
        好的，我知道了
      </Button>
    </div>
  );
}
