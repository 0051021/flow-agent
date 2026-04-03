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
  ArrowRight,
} from "lucide-react";
import type { NodeConfidence } from "@/lib/store";

const NODES_PER_PAGE = 3;

// ============================================================
// Single node question block (used inside pages)
// ============================================================

function SingleNodeBlock({
  nodeConf,
  nodeLabel,
  answers,
  customInputs,
  customTexts,
  onSelectAnswer,
  onToggleCustom,
  onCustomTextChange,
  disabled,
}: {
  nodeConf: NodeConfidence;
  nodeLabel: string;
  answers: Record<string, string>;
  customInputs: Record<string, boolean>;
  customTexts: Record<string, string>;
  onSelectAnswer: (qId: string, value: string) => void;
  onToggleCustom: (qId: string) => void;
  onCustomTextChange: (qId: string, value: string) => void;
  disabled?: boolean;
}) {
  const { questions, confidence, reason } = nodeConf;

  const confidenceColor = {
    high: "text-green-600 bg-green-50 border-green-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    low: "text-red-500 bg-red-50 border-red-200",
  }[confidence];

  const confidenceLabel = {
    high: "把握较大",
    medium: "需要确认",
    low: "需要补充",
  }[confidence];

  return (
    <div className="border border-zinc-150 rounded-lg overflow-hidden">
      <div className="px-3 pt-2 pb-1.5 bg-zinc-50/80 border-b border-zinc-100">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-semibold text-zinc-800">{nodeLabel}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${confidenceColor}`}>
            {confidenceLabel}
          </span>
        </div>
        <p className="text-[10px] text-zinc-400">{reason}</p>
      </div>

      <div className="px-3 py-2 space-y-2.5">
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
                <p className="text-[10px] text-zinc-400 mb-0.5">
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
                      onClick={() => onSelectAnswer(q.id, opt.label)}
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
                      onChange={(e) => onCustomTextChange(q.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (customTexts[q.id] || "").trim()) {
                          onSelectAnswer(q.id, (customTexts[q.id] || "").trim());
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
                        if (text) onSelectAnswer(q.id, text);
                      }}
                      disabled={disabled || !(customTexts[q.id] || "").trim()}
                    >
                      确定
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors mt-0.5"
                    onClick={() => onToggleCustom(q.id)}
                    disabled={disabled}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    都不合适，我自己说
                  </button>
                )}
              </div>

              {qi < questions.length - 1 && <div className="border-b border-zinc-100 mt-2.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// NodeQuestionPage — paginated display of all pending nodes
// ============================================================

interface NodeQuestionPageProps {
  pendingNodes: NodeConfidence[];
  nodeLabelMap: Record<string, string>;
  onSubmitAll: (collected: Record<string, { question: string; answer: string }[]>) => void;
  onSkipAll: () => void;
  disabled?: boolean;
}

export default function NodeQuestionPage({
  pendingNodes,
  nodeLabelMap,
  onSubmitAll,
  onSkipAll,
  disabled,
}: NodeQuestionPageProps) {
  const [pageIdx, setPageIdx] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, boolean>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

  const totalPages = Math.ceil(pendingNodes.length / NODES_PER_PAGE);
  const pageNodes = pendingNodes.slice(
    pageIdx * NODES_PER_PAGE,
    (pageIdx + 1) * NODES_PER_PAGE
  );
  const isLastPage = pageIdx >= totalPages - 1;

  const handleSelectAnswer = useCallback((qId: string, value: string) => {
    setAllAnswers((prev) => ({ ...prev, [qId]: value }));
    setCustomInputs((prev) => ({ ...prev, [qId]: false }));
  }, []);

  const handleToggleCustom = useCallback((qId: string) => {
    setCustomInputs((prev) => ({ ...prev, [qId]: true }));
  }, []);

  const handleCustomTextChange = useCallback((qId: string, value: string) => {
    setCustomTexts((prev) => ({ ...prev, [qId]: value }));
  }, []);

  const currentPageAllAnswered = pageNodes.every((nc) =>
    nc.questions.every((q) => allAnswers[q.id])
  );

  const handleUseDefaultsForPage = () => {
    const defaults: Record<string, string> = {};
    for (const nc of pageNodes) {
      for (const q of nc.questions) {
        if (!allAnswers[q.id]) {
          defaults[q.id] = q.defaultSuggestion;
        }
      }
    }
    setAllAnswers((prev) => ({ ...prev, ...defaults }));
  };

  const handleUseAllDefaults = () => {
    const defaults: Record<string, string> = {};
    for (const nc of pendingNodes) {
      for (const q of nc.questions) {
        defaults[q.id] = q.defaultSuggestion;
      }
    }
    buildAndSubmit({ ...allAnswers, ...defaults });
  };

  const buildAndSubmit = (finalAnswers: Record<string, string>) => {
    const collected: Record<string, { question: string; answer: string }[]> = {};
    for (const nc of pendingNodes) {
      collected[nc.nodeId] = nc.questions.map((q) => ({
        question: q.question,
        answer: finalAnswers[q.id] || q.defaultSuggestion,
      }));
    }
    onSubmitAll(collected);
  };

  const handleNextPage = () => {
    if (!currentPageAllAnswered) {
      handleUseDefaultsForPage();
    }
    if (isLastPage) {
      buildAndSubmit(allAnswers);
    } else {
      setPageIdx((p) => p + 1);
    }
  };

  const handleSubmitNow = () => {
    const withDefaults = { ...allAnswers };
    for (const nc of pendingNodes) {
      for (const q of nc.questions) {
        if (!withDefaults[q.id]) {
          withDefaults[q.id] = q.defaultSuggestion;
        }
      }
    }
    buildAndSubmit(withDefaults);
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
      {/* Progress bar */}
      <div className="h-1 bg-zinc-100">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${((pageIdx + 1) / Math.max(totalPages, 1)) * 100}%` }}
        />
      </div>

      {/* Page header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-zinc-100 flex items-center justify-between">
        <span className="text-[10px] text-zinc-400 font-medium">
          {totalPages > 1 ? `第 ${pageIdx + 1}/${totalPages} 页` : `${pendingNodes.length} 个节点待确认`}
        </span>
        <div className="flex items-center gap-2">
          {pendingNodes.length > 1 && (
            <button
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
              onClick={onSkipAll}
              disabled={disabled}
            >
              <SkipForward className="w-2.5 h-2.5" />
              全部跳过
            </button>
          )}
        </div>
      </div>

      {/* Node blocks */}
      <div className="px-3 py-2.5 space-y-3">
        {pageNodes.map((nc) => (
          <SingleNodeBlock
            key={nc.nodeId}
            nodeConf={nc}
            nodeLabel={nodeLabelMap[nc.nodeId] || nc.nodeId}
            answers={allAnswers}
            customInputs={customInputs}
            customTexts={customTexts}
            onSelectAnswer={handleSelectAnswer}
            onToggleCustom={handleToggleCustom}
            onCustomTextChange={handleCustomTextChange}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="px-3 pb-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-[11px] text-zinc-500"
          onClick={handleUseAllDefaults}
          disabled={disabled}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          全部用推荐
        </Button>
        {isLastPage ? (
          <Button
            size="sm"
            className="flex-1 h-8 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSubmitNow}
            disabled={disabled}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            确认并优化
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 h-8 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleNextPage}
            disabled={disabled}
          >
            下一页
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
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
