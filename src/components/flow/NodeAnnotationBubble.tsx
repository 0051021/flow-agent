"use client";

import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { X, Pencil, Plus, Send } from "lucide-react";
import { useFlowAgentStore, type NodeQuestion } from "@/lib/store";
import type { Annotation, AnnotationReply } from "@/lib/types";

export interface NodeAnnotationBubbleProps {
  nodeId: string;
  nodeLabel: string;
  position: "right" | "left";
  onClose: () => void;
}

const TRIGGER_SEL = "[data-annotation-trigger]";

function getAnswerForQuestion(
  nodeAnswers: { question: string; answer: string }[] | undefined,
  q: string
) {
  if (!nodeAnswers) return undefined;
  return nodeAnswers.find((a) => a.question === q)?.answer;
}

export default function NodeAnnotationBubble({
  nodeId,
  nodeLabel,
  position,
  onClose,
}: NodeAnnotationBubbleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    currentRole,
    annotations,
    allNodeConfidence,
    deferredNodeIds,
    collectedAnswers,
    addAnnotation,
    addReply,
    updateAnnotationStatus,
  } = useFlowAgentStore();

  const nodeConf = allNodeConfidence.find((nc) => nc.nodeId === nodeId);
  const questions: NodeQuestion[] = nodeConf?.questions ?? [];
  const nodeAnnotations = annotations.filter((a) => a.nodeId === nodeId);
  const isDeferred = deferredNodeIds.includes(nodeId);
  const answersForNode = collectedAnswers[nodeId];
  const isTechRole = currentRole === "tech";

  const [newAnnotationOpen, setNewAnnotationOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const defaultAuthor = {
    name: currentRole === "tech" ? "技术方" : "业务方",
    role: currentRole,
  } as const;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(TRIGGER_SEL)) return;
      if (rootRef.current?.contains(t)) return;
      onClose();
    };
    const id = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const submitNewAnnotation = () => {
    const t = newContent.trim();
    if (!t) return;
    const annotation: Annotation = {
      id: uuidv4(),
      nodeId,
      author: { name: defaultAuthor.name, role: defaultAuthor.role },
      content: t,
      attachments: [],
      status: "pending",
      createdAt: new Date().toISOString(),
      replies: [],
    };
    addAnnotation(annotation);
    setNewContent("");
    setNewAnnotationOpen(false);
  };

  const submitReply = (annotationId: string) => {
    const t = (replyDrafts[annotationId] ?? "").trim();
    if (!t) return;
    const reply: AnnotationReply = {
      id: uuidv4(),
      author: { name: defaultAuthor.name, role: defaultAuthor.role },
      content: t,
      createdAt: new Date().toISOString(),
    };
    addReply(annotationId, reply);
    updateAnnotationStatus(annotationId, "discussing");
    setReplyDrafts((p) => ({ ...p, [annotationId]: "" }));
  };

  const arrow =
    position === "right" ? (
      <div
        className="absolute top-5 z-[1] w-0 h-0 -left-2"
        style={{
          borderStyle: "solid",
          borderWidth: "6px 8px 6px 0",
          borderColor: "transparent #e4e4e7 transparent transparent",
        }}
        aria-hidden
      />
    ) : (
      <div
        className="absolute top-5 z-[1] w-0 h-0 -right-2"
        style={{
          borderStyle: "solid",
          borderWidth: "6px 0 6px 8px",
          borderColor: "transparent transparent transparent #e4e4e7",
        }}
        aria-hidden
      />
    );

  const innerArrow =
    position === "right" ? (
      <div
        className="absolute top-[21px] z-[2] w-0 h-0 -left-[6px]"
        style={{
          borderStyle: "solid",
          borderWidth: "5px 6px 5px 0",
          borderColor: "transparent #ffffff transparent transparent",
        }}
        aria-hidden
      />
    ) : (
      <div
        className="absolute top-[21px] z-[2] w-0 h-0 -right-[6px]"
        style={{
          borderStyle: "solid",
          borderWidth: "5px 0 5px 6px",
          borderColor: "transparent transparent transparent #ffffff",
        }}
        aria-hidden
      />
    );

  return (
    <div
      ref={rootRef}
      className="relative w-[360px] max-h-[480px] z-50 flex flex-col overflow-hidden bg-white rounded-xl border border-zinc-200 shadow-lg"
      data-annotation-bubble-root=""
    >
      {arrow}
      {innerArrow}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-zinc-100 bg-white rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm" aria-hidden>
            📝
          </span>
          <span className="text-sm font-semibold text-zinc-900 truncate" title={nodeLabel}>
            {nodeLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-zinc-100 text-zinc-500"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="min-h-0 max-h-[calc(480px-3.5rem)] flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {questions.length > 0 && (
          <section className="rounded-lg border-2 border-blue-200 bg-blue-50/60 p-2.5 space-y-2.5">
            <div className="text-[11px] font-semibold text-blue-800">▸ AI 待确认问题</div>
            {questions.map((q) => {
              const answer = getAnswerForQuestion(answersForNode, q.question);
              return (
                <div
                  key={q.id}
                  className="rounded-md bg-white/80 border border-blue-100 p-2 space-y-1.5"
                >
                  <p>
                    <span className="text-zinc-500">Q: </span>
                    <span className="text-zinc-800">{q.question}</span>
                  </p>
                  {q.options && q.options.length > 0 && (
                    <p className="text-zinc-600">
                      选项:{" "}
                      {q.options.map((opt, i) => (
                        <span key={i} className="ml-1">
                          [{String.fromCharCode(65 + i)}] {opt}
                        </span>
                      ))}
                    </p>
                  )}
                  <p>
                    <span className="text-zinc-500">AI 建议: </span>
                    <span className="text-zinc-800">{q.defaultSuggestion}</span>
                  </p>
                  <p>
                    <span className="text-zinc-500">状态: </span>
                    {answer ? (
                      <span className="text-zinc-800">已回答：{answer}</span>
                    ) : (
                      <span className="text-blue-700 font-medium">业务方未回答</span>
                    )}
                  </p>
                </div>
              );
            })}
            {!isTechRole && (
              <p className="text-[11px] text-blue-700">
                请在左侧追问卡统一回答（支持暂缓/跳过），确认后会一次性更新流程。
              </p>
            )}
          </section>
        )}

        {isDeferred && (
          <section className="rounded-lg border-2 border-orange-200 bg-orange-50/80 p-2.5 space-y-1">
            <div className="text-[11px] font-semibold text-orange-800">▸ 业务方跳过的确认项</div>
            <p className="text-orange-900 leading-relaxed">
              该节点信息待补充，使用了 AI 默认建议
            </p>
          </section>
        )}

        {isTechRole && (
          <>
            <section className="rounded-lg border-2 border-purple-200 bg-purple-50/40 p-2.5 space-y-3">
              <div className="text-[11px] font-semibold text-purple-800">▸ 技术方批注</div>
              {nodeAnnotations.length === 0 && (
                <p className="text-zinc-500 text-[11px]">暂无批注</p>
              )}
              {nodeAnnotations.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md bg-white border border-purple-100 p-2 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                    <span className="font-medium text-zinc-700">{a.author.name}</span>
                    <span>
                      {new Date(a.createdAt).toLocaleString("zh-CN", { hour12: false })}
                    </span>
                  </div>
                  <p className="text-zinc-800 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                  {a.replies.length > 0 && (
                    <ul className="pl-2 space-y-1.5 border-l-2 border-purple-100">
                      {a.replies.map((r) => (
                        <li key={r.id} className="text-[11px] text-zinc-600">
                          <span className="text-zinc-400">└─ </span>
                          <span className="text-zinc-500">{r.author.name}：</span>
                          {r.content}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-1.5 items-end pt-0.5">
                    <input
                      type="text"
                      placeholder="输入回复…"
                      className="flex-1 min-w-0 h-7 px-2 rounded-md border border-zinc-200 text-[11px] bg-white"
                      value={replyDrafts[a.id] ?? ""}
                      onChange={(e) =>
                        setReplyDrafts((p) => ({ ...p, [a.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => submitReply(a.id)}
                      className="shrink-0 inline-flex items-center gap-0.5 h-7 px-2 rounded-md bg-purple-600 text-white text-[11px] hover:bg-purple-700"
                    >
                      <Send className="w-3 h-3" />
                      发送
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setNewAnnotationOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                <Plus className="w-3.5 h-3.5" />
                添加批注
              </button>
            </div>

            {newAnnotationOpen && (
              <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
                <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  新批注
                </label>
                <textarea
                  rows={3}
                  placeholder="输入批注内容…"
                  className="w-full rounded-md border border-zinc-200 p-2 text-xs resize-y min-h-[72px] bg-white"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={submitNewAnnotation}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    提交
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
