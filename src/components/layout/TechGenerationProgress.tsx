"use client";

import { useEffect } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowAgentStore } from "@/lib/store";
import type { TechTabId, TechTabStatus } from "@/lib/types";

const STEPS: { id: TechTabId; label: string }[] = [
  { id: "documents", label: "解析文档契约" },
  { id: "overview", label: "分析系统架构" },
  { id: "externals", label: "识别外部系统依赖" },
  { id: "guards", label: "设计质量守护策略" },
  { id: "deployment", label: "生成部署配置" },
];

function StatusGlyph({ status }: { status: TechTabStatus }) {
  switch (status) {
    case "idle":
      return <span className="w-2 h-2 rounded-full bg-zinc-300" aria-label="未开始" />;
    case "generating":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" aria-label="生成中" />;
    case "ready":
      return <CheckCircle2 className="w-4 h-4 text-green-500" aria-label="已完成" />;
    case "error":
      return <X className="w-4 h-4 text-red-500" aria-label="失败" />;
    default:
      return <span className="w-2 h-2 rounded-full bg-zinc-300" />;
  }
}

export interface TechGenerationProgressProps {
  visible: boolean;
  onClose: () => void;
  onStayOnPage: () => void;
  onGoToList: () => void;
}

export function TechGenerationProgress({
  visible,
  onClose,
  onStayOnPage,
  onGoToList,
}: TechGenerationProgressProps) {
  const tabStates = useFlowAgentStore((s) => s.techConfig.tabStates);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const readyCount = STEPS.filter((s) => tabStates[s.id]?.status === "ready").length;
  const progressPct = (readyCount / 5) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal
        className="bg-white rounded-xl shadow-xl w-[420px] max-w-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 text-zinc-900">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <h2 className="text-sm font-semibold">方案已提交！</h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">AI 正在生成技术实现方案...</p>
        </div>

        <div className="px-5 pb-1">
          <div className="h-1.5 w-full rounded-full bg-zinc-200 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-[width] duration-300 ease-out rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-400 mt-1.5 text-right">
            {readyCount} / 5
          </p>
        </div>

        <ul className="px-5 py-2 space-y-3">
          {STEPS.map((step) => {
            const status = tabStates[step.id]?.status ?? "idle";
            return (
              <li key={step.id} className="flex items-center gap-3">
                <div className="w-5 flex items-center justify-center shrink-0">
                  <StatusGlyph status={status} />
                </div>
                <span className="text-xs text-zinc-700 flex-1 leading-snug">{step.label}</span>
              </li>
            );
          })}
        </ul>

        <p className="px-5 pb-3 text-[11px] text-zinc-500 text-center">完成后会通过站内消息通知你</p>

        <div className="flex gap-2 px-5 py-4 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => {
              onStayOnPage();
              onClose();
            }}
          >
            留在此页面
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              onGoToList();
              onClose();
            }}
          >
            返回项目列表
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TechGenerationProgress;
