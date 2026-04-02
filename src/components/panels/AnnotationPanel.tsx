"use client";

import { useState } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Paperclip, CheckCircle2, Clock,
  AlertCircle, X, Send, FileText,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { Annotation } from "@/lib/types";

const STATUS_CONFIG: Record<Annotation["status"], { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  pending: { label: "待确认", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200" },
  discussing: { label: "讨论中", icon: MessageSquare, className: "bg-blue-50 text-blue-700 border-blue-200" },
  resolved: { label: "已解决", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" },
  needs_change: { label: "需修改", icon: AlertCircle, className: "bg-red-50 text-red-700 border-red-200" },
};

export default function AnnotationPanel() {
  const {
    selectedNodeId, annotations, nodes, showAnnotationPanel,
    setShowAnnotationPanel, addAnnotation, addReply, updateAnnotationStatus,
    viewMode, taskType,
  } = useFlowAgentStore();

  const [newContent, setNewContent] = useState("");
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const isAgentic = taskType === "agentic";
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const displayAnnotations = isAgentic
    ? annotations
    : annotations.filter((a) => a.nodeId === selectedNodeId);

  if (!showAnnotationPanel) return null;

  const handleAddAnnotation = () => {
    if (!newContent.trim()) return;
    if (!isAgentic && !selectedNodeId) return;
    const annotation: Annotation = {
      id: uuidv4(),
      nodeId: isAgentic ? "__global__" : selectedNodeId!,
      author: {
        name: viewMode === "tech" ? "王工" : "李总",
        role: viewMode === "tech" ? "tech" : "business",
      },
      content: newContent.trim(),
      attachments: [],
      status: "pending",
      createdAt: new Date().toISOString(),
      replies: [],
    };
    addAnnotation(annotation);
    setNewContent("");
  };

  const handleReply = (annotationId: string) => {
    const content = replyContent[annotationId];
    if (!content?.trim()) return;
    addReply(annotationId, {
      id: uuidv4(),
      author: {
        name: viewMode === "tech" ? "王工" : "李总",
        role: viewMode === "tech" ? "tech" : "business",
      },
      content: content.trim(),
      createdAt: new Date().toISOString(),
    });
    updateAnnotationStatus(annotationId, "discussing");
    setReplyContent((prev) => ({ ...prev, [annotationId]: "" }));
    setReplyingTo(null);
  };

  return (
    <div className="w-[380px] border-l border-zinc-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">批注</h3>
          {isAgentic ? (
            <span className="text-xs text-zinc-400">· 全局</span>
          ) : selectedNode ? (
            <span className="text-xs text-zinc-400">
              · {(selectedNode.data as unknown as { label: string }).label}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => setShowAnnotationPanel(false)}
          className="p-1 rounded-md hover:bg-zinc-100 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Annotations list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {displayAnnotations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">暂无批注</p>
              <p className="text-xs text-zinc-300 mt-1">在下方添加第一条批注</p>
            </div>
          ) : (
            displayAnnotations.map((annotation) => {
              const statusConfig = STATUS_CONFIG[annotation.status];
              const StatusIcon = statusConfig.icon;
              return (
                <div key={annotation.id} className="rounded-lg border border-zinc-200 overflow-hidden">
                  {/* Annotation header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-50">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                        ${annotation.author.role === "tech" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {annotation.author.name[0]}
                      </div>
                      <span className="text-xs font-medium text-zinc-700">{annotation.author.name}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(annotation.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] h-5 ${statusConfig.className}`}>
                      <StatusIcon className="w-3 h-3 mr-0.5" />
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Annotation content */}
                  <div className="px-3 py-2.5">
                    <p className="text-sm text-zinc-700 leading-relaxed">{annotation.content}</p>

                    {/* Attachments */}
                    {annotation.attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {annotation.attachments.map((att) => (
                          <div key={att.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <FileText className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="text-xs font-medium text-zinc-600">{att.fileName}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400">{att.source} · {att.lineRef}</p>
                            {att.highlight && (
                              <div className="mt-1.5 pl-2 border-l-2 border-amber-300 bg-amber-50/50 py-1 px-2 rounded-r">
                                <p className="text-xs text-amber-800 italic">&ldquo;{att.highlight}&rdquo;</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Replies */}
                  {annotation.replies.length > 0 && (
                    <div className="border-t border-zinc-100">
                      {annotation.replies.map((reply) => (
                        <div key={reply.id} className="px-3 py-2 border-b border-zinc-50 last:border-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium
                              ${reply.author.role === "tech" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                              {reply.author.name[0]}
                            </div>
                            <span className="text-xs font-medium text-zinc-600">{reply.author.name}</span>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(reply.createdAt).toLocaleDateString("zh-CN")}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 leading-relaxed ml-7">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply input */}
                  <div className="px-3 py-2 border-t border-zinc-100 bg-zinc-50/50">
                    {replyingTo === annotation.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={replyContent[annotation.id] || ""}
                          onChange={(e) => setReplyContent((prev) => ({ ...prev, [annotation.id]: e.target.value }))}
                          placeholder="输入回复..."
                          className="text-xs min-h-[60px] resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReplyingTo(null)}>
                            取消
                          </Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleReply(annotation.id)}>
                            <Send className="w-3 h-3 mr-1" /> 回复
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="flex-1 text-left text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                          onClick={() => setReplyingTo(annotation.id)}
                        >
                          回复此批注...
                        </button>
                        {annotation.status !== "resolved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => updateAnnotationStatus(annotation.id, "resolved")}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-0.5" /> 标记已解决
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* New annotation input */}
      <div className="border-t border-zinc-200 p-3 space-y-2">
        <Textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="添加新批注..."
          className="text-sm min-h-[80px] resize-none"
        />
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500">
            <Paperclip className="w-3 h-3 mr-1" /> 从知识中心引用
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleAddAnnotation}
            disabled={!newContent.trim() || (!isAgentic && !selectedNodeId)}
          >
            <Send className="w-3 h-3 mr-1" /> 提交批注
          </Button>
        </div>
      </div>
    </div>
  );
}
