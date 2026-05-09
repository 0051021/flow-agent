"use client";

import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";
import type { SequenceDiagram } from "@/lib/types";

export interface SequenceDiagramViewProps {
  data: SequenceDiagram;
}

const initOnce = (() => {
  let done = false;
  return () => {
    if (done) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      sequence: {
        useMaxWidth: true,
        diagramMarginX: 8,
        diagramMarginY: 8,
        /** 单行/多行消息文案相对箭头水平居中；默认偏左容易看起来像「没对齐」 */
        messageAlign: "center",
      },
    });
    done = true;
  };
})();

function mermaidQuote(name: string): string {
  const escaped = name.replace(/"/g, "\\\"");
  return `"${escaped}"`;
}

/** Build unique stable aliases for mermaid `participant` lines (avoids id issues with CJK / spaces). */
function buildParticipantMap(participants: string[], messages: SequenceDiagram["messages"]) {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const p of participants) {
    if (!seen.has(p)) {
      seen.add(p);
      order.push(p);
    }
  }
  for (const m of messages) {
    if (!seen.has(m.from)) {
      seen.add(m.from);
      order.push(m.from);
    }
    if (!seen.has(m.to)) {
      seen.add(m.to);
      order.push(m.to);
    }
  }
  const alias = new Map<string, string>();
  order.forEach((p, i) => {
    alias.set(p, `P${i}`);
  });
  return { order, alias };
}

function escapeMessageLabel(s: string): string {
  return s.replace(/"/g, "'").split("\n").join(" ");
}

export function buildSequenceMermaidCode(data: SequenceDiagram): string {
  const { order, alias } = buildParticipantMap(data.participants, data.messages);
  const lines: string[] = ["sequenceDiagram"];
  for (const name of order) {
    const id = alias.get(name)!;
    lines.push(`  participant ${id} as ${mermaidQuote(name)}`);
  }
  for (const msg of data.messages) {
    const a = alias.get(msg.from) ?? mermaidQuote(msg.from);
    const b = alias.get(msg.to) ?? mermaidQuote(msg.to);
    const label = escapeMessageLabel(msg.label);
    const op = msg.type === "async" ? "-->>" : "->>";
    lines.push(`  ${a}${op}${b}: ${label}`);
  }
  return lines.join("\n");
}

export default function SequenceDiagramView({ data }: SequenceDiagramViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const safeId = `seq-${reactId.replace(/[:]/g, "")}`;
  const [error, setError] = useState<string | null>(null);
  const code = buildSequenceMermaidCode(data);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    initOnce();

    (async () => {
      if (ref.current) ref.current.innerHTML = "";
      try {
        const { svg } = await mermaid.render(`${safeId}-${Date.now()}`, code);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
        if (ref.current && !cancelled) ref.current.innerHTML = "";
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, safeId]);

  return (
    <div className="w-full min-w-0">
      {error && (
        <div className="mb-2 space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
            时序图渲染失败，已显示 Mermaid 源码。{error}
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-zinc-900 p-3 text-[10px] font-mono leading-relaxed text-green-300 whitespace-pre-wrap">
            {code}
          </pre>
        </div>
      )}
      <div
        ref={ref}
        className={`mermaid-sequence w-full overflow-x-auto text-[11px] [&_svg]:max-w-full [&_svg]:h-auto ${error ? "hidden" : ""}`}
      />
    </div>
  );
}
