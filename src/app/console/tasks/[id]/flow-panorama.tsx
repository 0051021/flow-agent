"use client";

import type { FlowNodeDef, FlowNodeStatus } from "@/lib/types";

const NODE_STATUS_STYLES: Record<
  FlowNodeStatus,
  { dot: string; line: string; text: string; bg: string }
> = {
  completed: {
    dot: "bg-green-500",
    line: "bg-green-400",
    text: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  running: {
    dot: "bg-blue-500 animate-pulse",
    line: "bg-blue-300",
    text: "text-blue-700",
    bg: "bg-blue-50 border-blue-300 ring-2 ring-blue-200",
  },
  pending_confirm: {
    dot: "bg-amber-500 animate-pulse",
    line: "bg-amber-300",
    text: "text-amber-700",
    bg: "bg-amber-50 border-amber-300 ring-2 ring-amber-200",
  },
  error: {
    dot: "bg-red-500",
    line: "bg-red-300",
    text: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
  waiting: {
    dot: "bg-zinc-300",
    line: "bg-zinc-200",
    text: "text-zinc-400",
    bg: "bg-zinc-50 border-zinc-200",
  },
};

const NODE_TYPE_LABEL: Record<string, string> = {
  ai_auto: "AI",
  human_confirm: "人工",
  human_manual: "手动",
};

export function FlowPanorama({
  nodes,
  className = "",
}: {
  nodes: FlowNodeDef[];
  className?: string;
}) {
  return (
    <div className={`${className}`}>
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {nodes.map((node, i) => {
          const s = NODE_STATUS_STYLES[node.status];
          const isLast = i === nodes.length - 1;
          const nextStyle =
            NODE_STATUS_STYLES[
              nodes[i + 1]?.status === "waiting" ? "waiting" : node.status
            ];
          return (
            <div key={node.id} className="flex items-start shrink-0" style={{ minWidth: 0 }}>
              <div className="flex flex-col items-center" style={{ width: "clamp(80px, 14vw, 140px)" }}>
                <div className={`w-full px-2.5 py-2 rounded-lg border text-center transition-all ${s.bg}`}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                    <span className={`text-[10px] font-semibold truncate ${s.text}`}>{node.label}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={`text-[9px] px-1 py-px rounded ${
                        node.type === "human_confirm"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {NODE_TYPE_LABEL[node.type] || "AI"}
                    </span>
                    {node.duration ? (
                      <span className="text-[9px] text-zinc-400">{node.duration}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              {!isLast ? (
                <div className="flex items-center self-center pt-0.5" style={{ width: 24, marginTop: 2 }}>
                  <div className={`h-0.5 flex-1 ${nextStyle.line}`} />
                  <div
                    className={`w-0 h-0 border-t-[3px] border-b-[3px] border-l-[5px] border-t-transparent border-b-transparent ${nextStyle.line.replace("bg-", "border-l-")}`}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
