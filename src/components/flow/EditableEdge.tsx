"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useFlowAgentStore } from "@/lib/store";

export default function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style = {},
  animated,
  selected,
}: EdgeProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(label || ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(String(label || ""));
  }, [label]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    const store = useFlowAgentStore.getState();
    const updated = store.edges.map((e) =>
      e.id === id ? { ...e, label: text.trim() } : e
    );
    store.setEdges(updated);
  }, [id, text]);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  const edgeStyle = {
    ...style,
    strokeWidth: selected ? 3 : (style.strokeWidth as number) || 2,
    filter: selected ? "drop-shadow(0 0 3px rgba(59,130,246,0.5))" : undefined,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        className={animated ? "react-flow__edge-path animated" : "react-flow__edge-path"}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") { setText(String(label || "")); setEditing(false); }
              }}
              className="text-xs px-2.5 py-1 rounded-md border border-blue-400 bg-white shadow-md outline-none ring-2 ring-blue-200 w-32 text-center"
            />
          ) : (
            <button
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
              title="双击编辑条件"
              className={`group text-xs px-2.5 py-1 rounded-md transition-all cursor-text ${
                text
                  ? `bg-white border shadow-sm ${selected ? "border-blue-400 text-blue-700 shadow-blue-100" : "border-zinc-200 text-zinc-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-md"}`
                  : "bg-white/80 border border-dashed border-zinc-300 text-zinc-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50"
              }`}
            >
              <span className="flex items-center gap-1">
                {text ? (
                  <>
                    {text}
                    <svg className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    添加条件
                  </>
                )}
              </span>
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
