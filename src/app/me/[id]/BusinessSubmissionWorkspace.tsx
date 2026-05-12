"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BackgroundVariant,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Hand,
  Mail,
  MessageSquareText,
  Send,
  Sparkles,
  Table,
  Upload,
  UserCheck,
  Workflow,
} from "lucide-react";
import type { PersistedSubmission } from "@/lib/submission-types";
import type { FlowNodeData, NodeExecutionMode, ProjectStatus } from "@/lib/types";

type DetailStatus = "waiting" | "action_needed" | "approved";
type SaveStatus = "idle" | "saving" | "saved" | "error";

type NodeComment = {
  id: string;
  nodeId: string;
  content: string;
  author?: string;
  at?: string;
};

type NodeCommentReply = {
  id: string;
  content: string;
  author: string;
  at: string;
};

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type BusinessNodeData = FlowNodeData & {
  nodeId: string;
  selected?: boolean;
  comments?: NodeComment[];
  repliesByCommentId?: Record<string, NodeCommentReply[]>;
  submissionId?: string;
  onSelect?: (nodeId: string) => void;
  onReply?: (comment: NodeComment, content: string) => void;
};

const READ_NODE_X = 120;
const READ_NODE_Y_GAP = 250;

const STATUS_COPY: Record<DetailStatus, { label: string; description: string; className: string }> = {
  waiting: {
    label: "待评审",
    description: "方案已经提交，正在等待技术方给出评审结论。",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  action_needed: {
    label: "待处理",
    description: "技术方留下了节点批注，需要业务方补充确认。",
    className: "border-red-200 bg-red-50 text-red-800",
  },
  approved: {
    label: "已通过",
    description: "技术评审已经通过，可以进入后续落地或复用。",
    className: "border-green-200 bg-green-50 text-green-800",
  },
};

const MODE_COPY: Record<NodeExecutionMode, { label: string; shortLabel: string; description: string; className: string; icon: typeof Bot }> = {
  pending: {
    label: "待确认",
    shortLabel: "待确认",
    description: "还未确定由 AI 还是人工处理。",
    className: "border-zinc-200 bg-zinc-50 text-zinc-600",
    icon: CircleAlert,
  },
  ai_auto: {
    label: "AI 自动处理",
    shortLabel: "AI 自动",
    description: "系统可自动完成，业务方主要查看结果。",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Bot,
  },
  human_confirm: {
    label: "AI 处理后你确认",
    shortLabel: "你确认",
    description: "AI 先处理，关键结果需要业务方确认。",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: UserCheck,
  },
  human_manual: {
    label: "人工处理",
    shortLabel: "人工",
    description: "这一段仍需要人工登录系统、沟通或提交。",
    className: "border-zinc-300 bg-white text-zinc-700",
    icon: Hand,
  },
};

const ICON_MAP: Record<string, typeof Workflow> = {
  Workflow,
  Mail,
  Table,
  Upload,
  FileText,
  Bot,
  UserCheck,
};

function getDetailStatus(status: ProjectStatus): DetailStatus {
  if (status === "needs_revision" || status === "draft" || status === "business_editing") return "action_needed";
  if (status === "confirmed") return "approved";
  return "waiting";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function summarizeCommentAsTodo(content: string) {
  return content
    .replace(/^请业务确认[：:]?/, "")
    .replace(/^请确认[：:]?/, "")
    .replace(/^需要确认[：:]?/, "")
    .replace(/。$/, "")
    .trim();
}

function getNextStep(item: PersistedSubmission) {
  if (item.status === "needs_revision") return "查看节点批注，补充确认后重新提交。";
  if (item.status === "confirmed") return "可以把这套方案作为模板，进入试运行或落地排期。";
  if (item.status === "ai_generating") return "AI 正在整理技术评审材料，完成后会进入技术评审。";
  if (item.status === "tech_reviewing") return "技术方正在评审，请等待结论。";
  return "等待技术方给出评审结论。";
}

function extractNodeComments(item: PersistedSubmission): NodeComment[] {
  return item.timeline.flatMap((event) => {
    const raw = event.meta?.nodeComments;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((comment, index) => {
      if (!comment || typeof comment !== "object") return [];
      const nodeId = "nodeId" in comment ? comment.nodeId : null;
      const content = "content" in comment ? comment.content : null;
      if (typeof nodeId !== "string" || typeof content !== "string") return [];
      return [{
        id: `${event.id}-${nodeId}-${index}`,
        nodeId,
        content,
        author: event.actor === "tech" ? "技术方" : event.actor === "system" ? "系统" : "业务方",
        at: event.at,
      }];
    });
  });
}

function BusinessFlowNode({ data }: NodeProps<Node<BusinessNodeData>>) {
  const nodeData = data as BusinessNodeData;
  const [showComments, setShowComments] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const mode = nodeData.executionMode ?? "pending";
  const modeCopy = MODE_COPY[mode];
  const ModeIcon = modeCopy.icon;
  const Icon = ICON_MAP[nodeData.icon] ?? Workflow;
  const hasComments = !!nodeData.comments?.length;

  return (
    <div
      className={`w-[320px] rounded-2xl border-2 bg-white shadow-sm transition-all ${
        nodeData.selected ? "border-blue-500 ring-4 ring-blue-100" : hasComments ? "border-red-200" : "border-zinc-200"
      }`}
      onClick={() => nodeData.onSelect?.(nodeData.nodeId)}
    >
      {hasComments ? (
        <button
          type="button"
          aria-label={`查看 ${nodeData.comments?.length ?? 0} 条技术批注`}
          onClick={(event) => {
            event.stopPropagation();
            setShowComments((open) => !open);
            nodeData.onSelect?.(nodeData.nodeId);
          }}
          className="absolute -right-5 -top-4 z-40 flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-600 shadow-lg transition hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
            <MessageSquareText className="h-3 w-3" />
          </span>
          技术批注 {nodeData.comments?.length}
        </button>
      ) : null}

      <Handle type="target" position={Position.Top} id="top-in" className="!h-3 !w-3 !border-2 !border-white !bg-zinc-300" />
      <Handle type="source" position={Position.Bottom} id="bottom-out" className="!h-3 !w-3 !border-2 !border-white !bg-zinc-300" />
      <Handle type="target" position={Position.Left} id="left-in" className="!h-3 !w-3 !border-2 !border-white !bg-zinc-300" />
      <Handle type="source" position={Position.Right} id="right-out" className="!h-3 !w-3 !border-2 !border-white !bg-zinc-300" />

      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-zinc-400">步骤 {nodeData.stepIndex}/{nodeData.totalSteps}</p>
            <h3 className="truncate text-sm font-semibold text-zinc-950">{nodeData.label}</h3>
          </div>
        </div>
        {hasComments ? <span className="h-6 w-16 shrink-0" /> : null}
      </div>

      <p className="line-clamp-2 px-4 pt-3 text-xs leading-5 text-zinc-500">{nodeData.description}</p>

      <div className="px-4 pt-3">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${modeCopy.className}`}>
          <ModeIcon className="h-3.5 w-3.5" />
          {modeCopy.label}
        </span>
      </div>

      <div className="mt-3 border-t border-zinc-100 px-4 py-3 text-[11px] text-zinc-400">
        预计耗时：{nodeData.estimatedTime}
      </div>

      {showComments && hasComments ? (
        <div
          className="absolute left-full top-3 z-50 ml-4 w-[320px] rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-950">节点批注</p>
            <button
              type="button"
              onClick={() => setShowComments(false)}
              className="text-[11px] text-zinc-400 hover:text-zinc-700"
            >
              关闭
            </button>
          </div>
          <div className="space-y-3">
            {nodeData.comments?.map((comment) => {
              const replies = nodeData.repliesByCommentId?.[comment.id] ?? [];
              const draft = replyDrafts[comment.id] ?? "";
              return (
                <div key={comment.id} className="rounded-xl border border-red-100 bg-red-50/80 p-3">
                  <p className="text-sm leading-6 text-red-950">{comment.content}</p>
                  <p className="mt-2 text-[11px] text-red-500">
                    {comment.author || "技术方"}{comment.at ? ` · ${formatTime(comment.at)}` : ""}
                  </p>
                  {replies.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border border-blue-100 bg-white px-2.5 py-2">
                          <p className="text-xs leading-5 text-zinc-700">{reply.content}</p>
                          <p className="mt-1 text-[10px] text-zinc-400">{reply.author} · {formatTime(reply.at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [comment.id]: event.target.value }))}
                      placeholder="回复技术方..."
                      className="h-16 w-full resize-none bg-transparent text-xs leading-5 text-zinc-700 outline-none placeholder:text-zinc-400"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={!draft.trim()}
                        onClick={() => {
                          const content = draft.trim();
                          if (!content) return;
                          nodeData.onReply?.(comment, content);
                          setReplyDrafts((prev) => ({ ...prev, [comment.id]: "" }));
                        }}
                        className="rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        回复
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const BUSINESS_DETAIL_NODE_TYPES = { businessDetailNode: BusinessFlowNode };

function ModePill({ mode }: { mode: NodeExecutionMode }) {
  const copy = MODE_COPY[mode];
  const Icon = copy.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${copy.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {copy.label}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
      {children}
    </p>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  minHeight = "min-h-24",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`${minHeight} w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-700 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50`}
    />
  );
}

function AssistantPanel({
  item,
  nodes,
  selectedNodeId,
  onSelectNode,
}: {
  item: PersistedSubmission;
  nodes: Node<BusinessNodeData>[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const status = getDetailStatus(item.status);
  const statusCopy = STATUS_COPY[status];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedData = selectedNode?.data;
  const selectedMode = selectedData?.executionMode ?? "pending";
  const selectedComments = selectedData?.comments ?? [];
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "我是批注理解助手，会基于当前方案、选中节点和技术批注，帮你看懂反馈、整理待补充项，并起草回复。涉及技术可行性的判断，我会帮你整理成追问技术方的问题。",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const quickQuestions = [
    "帮我解释这条技术批注",
    "我需要补充哪些信息？",
    "帮我写一段回复技术方的话",
    "这条批注涉及哪些节点和字段？",
  ];
  const contextLines = [
    `项目：${item.title}`,
    `状态：${statusCopy.label}`,
    `当前节点：${selectedData ? selectedData.label : "未选择"}`,
    `人机分工：${selectedData ? MODE_COPY[selectedMode].label : "未选择"}`,
    `节点批注：${selectedComments.length ? `${selectedComments.length} 条` : "暂无"}`,
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, selectedNodeId]);

  const buildAssistantReply = (question: string) => {
    const technicalDecisionKeywords = ["能不能自动化", "怎么实现", "有没有接口", "能不能上线", "能不能跳过", "是否安全", "部署", "代码", "接口"];
    if (!selectedData) {
      return "先在流程图或节点导航里选择一个节点，我就能结合这个节点的说明、人机分工和技术批注来回答。";
    }

    const commentTodos = selectedComments.map((comment) => summarizeCommentAsTodo(comment.content));

    if (selectedComments.length === 0) {
      return `当前节点「${selectedData.label}」暂时没有技术批注。你可以继续检查节点描述、资料与产出、结果输出标准是否足够清楚。`;
    }

    if (question.includes("回复")) {
      return `可以这样回复技术方：\n\n关于「${selectedData.label}」节点，我们已看到批注。我们会补充确认：${commentTodos.join("；")}。补齐后会重新提交评审。`;
    }

    if (question.includes("补充") || question.includes("哪些信息")) {
      return `这个节点建议优先补充：\n${commentTodos.map((todo, index) => `${index + 1}. ${todo}`).join("\n")}`;
    }

    if (technicalDecisionKeywords.some((keyword) => question.includes(keyword))) {
      return `这个问题需要技术方确认，我不能替技术方判断。\n\n我可以帮你整理成追问：\n“关于「${selectedData.label}」节点，目前技术判断的主要限制是什么？是接口、权限、验证码/二次认证，还是业务规则还不稳定？我们需要补充哪些业务信息才能继续评审？”`;
    }

    if (question.includes("节点") || question.includes("字段")) {
      const fields = [
        ...selectedData.inputs.map((input) => input.name),
        ...selectedData.outputs.map((output) => output.name),
        ...(selectedData.requiredCheckFields ?? []),
      ];
      return `这条批注关联到「${selectedData.label}」节点。当前可关注的字段包括：${fields.length ? fields.join("、") : "暂无明确字段"}。技术批注关注点是：${commentTodos.join("；")}。`;
    }

    return `我理解当前节点「${selectedData.label}」的技术批注是：\n${selectedComments.map((comment, index) => `${index + 1}. ${comment.content}`).join("\n")}\n\n业务上要做的是把这些不确定规则补明确，然后重新提交给技术方评审。`;
  };

  const sendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    messageIdRef.current += 1;
    const messageId = messageIdRef.current;
    const userMessage: AssistantMessage = {
      id: `user-${messageId}`,
      role: "user",
      content: trimmed,
    };
    const assistantMessage: AssistantMessage = {
      id: `assistant-${messageId}`,
      role: "assistant",
      content: buildAssistantReply(trimmed),
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
  };

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">批注理解助手</h2>
            <p className="text-xs text-zinc-400">解释批注、整理补充项、起草回复</p>
          </div>
        </div>
        <div className={`mt-4 rounded-xl border p-3 ${statusCopy.className}`}>
          <p className="text-xs font-semibold">{statusCopy.label}</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{statusCopy.description}</p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-zinc-500">节点导航</p>
          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {nodes.map((node) => {
              const nodeData = node.data;
              const mode = nodeData.executionMode ?? "pending";
              const hasComments = !!nodeData.comments?.length;
              const active = node.id === selectedNodeId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active ? "border-blue-200 bg-blue-50" : "border-zinc-100 bg-zinc-50 hover:bg-zinc-100"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-zinc-800">
                      {String(nodeData.stepIndex).padStart(2, "0")} {nodeData.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-zinc-400">{MODE_COPY[mode].shortLabel}</span>
                  </span>
                  {hasComments ? (
                    <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                      批注
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-medium text-zinc-500">当前上下文</p>
          <div className="mt-2 space-y-1 text-[11px] leading-5 text-zinc-500">
            {contextLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 whitespace-pre-line ${
                message.role === "user"
                  ? "bg-zinc-900 text-white"
                  : "border border-blue-100 bg-blue-50 text-blue-900"
              }`}>
                {message.content}
              </div>
            </div>
          ))}
        </div>

        <section>
          <p className="mb-2 text-xs font-medium text-zinc-500">可以这样问</p>
          <div className="space-y-2">
            {quickQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => sendMessage(question)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-xs leading-5 text-zinc-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
              >
                {question}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-zinc-100 p-3">
        <div className="mb-2 rounded-xl bg-zinc-50 px-3 py-2 text-[11px] leading-5 text-zinc-500">
          {getNextStep(item)}
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="问问这条批注、补充项或回复怎么写..."
            className="min-h-10 flex-1 resize-none bg-transparent px-1 py-1.5 text-xs leading-5 text-zinc-700 outline-none placeholder:text-zinc-400"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NodeInspector({
  selectedNode,
  onUpdateNodeData,
}: {
  selectedNode?: Node<BusinessNodeData>;
  onUpdateNodeData: (nodeId: string, updater: (data: FlowNodeData) => FlowNodeData) => void;
}) {
  const [activeTab, setActiveTab] = useState<"basic" | "io" | "checklist">("basic");
  const data = selectedNode?.data;

  if (!data) {
    return (
      <aside className="flex w-[380px] shrink-0 flex-col border-l border-zinc-200 bg-white p-5">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100">
            <Workflow className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-700">选择一个节点</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">查看该节点的人机分工、业务需要确认的字段和输入产出。</p>
        </div>
      </aside>
    );
  }

  const mode = data.executionMode ?? "pending";
  const operationSteps = Array.isArray(data.operationSteps) ? data.operationSteps : [];
  const doneCriteria = typeof data.doneCriteria === "string" ? data.doneCriteria : "";
  const updateData = (updater: (current: FlowNodeData) => FlowNodeData) => {
    onUpdateNodeData(data.nodeId, updater);
  };
  const updateInput = (inputId: string, patch: Partial<FlowNodeData["inputs"][number]>) => {
    updateData((current) => ({
      ...current,
      inputs: current.inputs.map((input) => (input.id === inputId ? { ...input, ...patch } : input)),
    }));
  };
  const updateOutput = (outputId: string, patch: Partial<FlowNodeData["outputs"][number]>) => {
    updateData((current) => ({
      ...current,
      outputs: current.outputs.map((output) => (output.id === outputId ? { ...output, ...patch } : output)),
    }));
  };
  const tabs = [
    { id: "basic" as const, label: "本步说明" },
    { id: "io" as const, label: "资料与产出" },
    { id: "checklist" as const, label: "操作清单" },
  ];

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="border-b border-zinc-100">
        <div className="p-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm shrink-0">📌</span>
            <h2 className="truncate text-sm font-semibold text-zinc-950">{data.label}</h2>
            <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              {data.stepIndex}/{data.totalSteps}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            打开方案后就可以按技术批注直接补充；技术批注请点节点上的气泡查看和回复。
          </p>
        </div>
        <div className="flex h-9 items-center gap-1 border-t border-zinc-100 bg-zinc-50 px-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:bg-white/70 hover:text-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "basic" ? (
          <div className="space-y-4">
            <section>
              <FieldLabel>节点描述</FieldLabel>
              <TextArea
                value={data.description}
                onChange={(value) => updateData((current) => ({ ...current, description: value }))}
                placeholder="写清楚这个节点要完成什么业务动作"
              />
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <FieldLabel>预计耗时</FieldLabel>
                <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-medium text-zinc-700">
                  {data.estimatedTime}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400">技术评审给出的未来节点耗时，业务方只查看。</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <FieldLabel>处理方式</FieldLabel>
                <div className="mt-2">
                  <ModePill mode={mode} />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400">技术评审定义的人机分工，业务方只查看。</p>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "io" ? (
          <div className="space-y-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <FieldLabel>需要提供（输入）</FieldLabel>
              </div>
              {data.inputs.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 px-3 py-3 text-[11px] text-zinc-400">暂无输入</p>
              ) : (
                <div className="space-y-2">
                  {data.inputs.map((input) => (
                    <div key={input.id} className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{input.icon}</span>
                        <TextInput
                          value={input.name}
                          onChange={(value) => updateInput(input.id, { name: value })}
                          placeholder="输入项名称"
                        />
                      </div>
                      <div className="flex justify-end">
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] text-zinc-400">
                          {input.source === "user" ? "业务提供" : input.sourceDetail || "上一步"}
                        </span>
                      </div>
                      <TextArea
                        value={input.description}
                        onChange={(value) => updateInput(input.id, { description: value })}
                        minHeight="min-h-16"
                        placeholder="补充输入要求"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <FieldLabel>会产出（输出）</FieldLabel>
              </div>
              {data.outputs.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 px-3 py-3 text-[11px] text-zinc-400">暂无输出</p>
              ) : (
                <div className="space-y-2">
                  <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
                    如果技术方要求补充字段，请优先把关键必填项写清楚，例如证书编号、日期、运输方式、审批意见等。
                  </p>
                  {data.outputs.map((output) => (
                    <div key={output.id} className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{output.icon}</span>
                        <TextInput
                          value={output.name}
                          onChange={(value) => updateOutput(output.id, { name: value })}
                          placeholder="输出项名称"
                        />
                      </div>
                      <TextArea
                        value={output.description}
                        onChange={(value) => updateOutput(output.id, { description: value })}
                        minHeight="min-h-16"
                        placeholder="补充输出说明"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "checklist" ? (
          <div className="space-y-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium text-zinc-600">节点内操作步骤（SOP）</p>
                <button
                  type="button"
                  onClick={() => updateData((current) => ({
                    ...current,
                    operationSteps: [...(current.operationSteps ?? []), ""],
                  }))}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:border-blue-200 hover:text-blue-700"
                >
                  添加
                </button>
              </div>
              {operationSteps.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-400">
                  暂无操作步骤。可以直接在这里补齐。
                </p>
              ) : (
                <div className="space-y-2">
                  {operationSteps.map((step, index) => (
                    <div key={`${index}-${step}`} className="flex gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <span className="text-xs font-medium text-zinc-400">{index + 1}.</span>
                      <input
                        value={step}
                        onChange={(event) => updateData((current) => ({
                          ...current,
                          operationSteps: (current.operationSteps ?? []).map((item, itemIndex) => (
                            itemIndex === index ? event.target.value : item
                          )),
                        }))}
                        placeholder="写下这一步要做什么"
                        className="min-w-0 flex-1 bg-transparent text-xs leading-5 text-zinc-700 outline-none placeholder:text-zinc-400"
                      />
                      <button
                        type="button"
                        onClick={() => updateData((current) => ({
                          ...current,
                          operationSteps: (current.operationSteps ?? []).filter((_, itemIndex) => itemIndex !== index),
                        }))}
                        className="text-[11px] text-zinc-400 hover:text-red-500"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-zinc-600">校对规则</p>
                  <p className="mt-0.5 text-[10px] text-zinc-400">写清楚字段一致性、校对项和例外规则；规则文件可在编辑页上传。</p>
                </div>
              </div>
              <TextArea
                value={typeof data.checkRulesText === "string" ? data.checkRulesText : ""}
                onChange={(value) => updateData((current) => ({ ...current, checkRulesText: value }))}
                minHeight="min-h-20"
                placeholder="例如：申请编号需与邮件主题一致；运输方式决定写入哪个归档表；品名、目的港、金额等字段需要逐项一致。"
              />
            </section>

            <section>
              <p className="mb-2 text-[11px] font-medium text-zinc-600">结果输出标准</p>
              <TextArea
                value={doneCriteria}
                onChange={(value) => updateData((current) => ({ ...current, doneCriteria: value }))}
                minHeight="min-h-20"
                placeholder="写清楚这个节点应该产出什么、字段要满足什么标准"
              />
            </section>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default function BusinessSubmissionWorkspace({ item }: { item: PersistedSubmission }) {
  const nodeComments = useMemo(() => extractNodeComments(item), [item]);
  const [repliesByCommentId, setRepliesByCommentId] = useState<Record<string, NodeCommentReply[]>>({});
  const [selectedNodeId, setSelectedNodeId] = useState(item.nodes?.[0]?.id ?? null);
  const [workingNodes, setWorkingNodes] = useState<Node<FlowNodeData>[]>(() => item.nodes ?? []);
  const [, setSaveStatus] = useState<SaveStatus>("idle");
  const lastSavedNodesRef = useRef(JSON.stringify(item.nodes ?? []));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = getDetailStatus(item.status);
  const statusCopy = STATUS_COPY[status];

  useEffect(() => {
    const nextNodes = item.nodes ?? [];
    setWorkingNodes(nextNodes);
    lastSavedNodesRef.current = JSON.stringify(nextNodes);
    setSaveStatus("idle");
  }, [item.id, item.nodes]);

  useEffect(() => {
    const serialized = JSON.stringify(workingNodes);
    if (serialized === lastSavedNodesRef.current) return;

    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/submissions/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes: workingNodes }),
        });
        if (!response.ok) throw new Error("save failed");
        lastSavedNodesRef.current = serialized;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [item.id, workingNodes]);

  const updateNodeData = useCallback((nodeId: string, updater: (data: FlowNodeData) => FlowNodeData) => {
    setWorkingNodes((prev) => prev.map((node) => (
      node.id === nodeId
        ? { ...node, data: updater(node.data as FlowNodeData) }
        : node
    )));
  }, []);

  const nodes = useMemo<Node<BusinessNodeData>[]>(() => {
    return [...workingNodes]
      .sort((a, b) => ((a.data as FlowNodeData).stepIndex ?? 0) - ((b.data as FlowNodeData).stepIndex ?? 0))
      .map((node, index) => ({
      ...node,
      type: "businessDetailNode",
      position: {
        x: READ_NODE_X,
        y: index * READ_NODE_Y_GAP,
      },
      data: {
        ...(node.data as FlowNodeData),
        nodeId: node.id,
        selected: node.id === selectedNodeId,
        comments: nodeComments.filter((comment) => comment.nodeId === node.id),
        repliesByCommentId,
        submissionId: item.id,
        onSelect: setSelectedNodeId,
        onReply: (comment: NodeComment, content: string) => {
          const reply: NodeCommentReply = {
            id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            content,
            author: "业务方",
            at: new Date().toISOString(),
          };
          setRepliesByCommentId((prev) => ({
            ...prev,
            [comment.id]: [...(prev[comment.id] ?? []), reply],
          }));
          void fetch(`/api/submissions/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timelineEvent: {
                actor: "business",
                type: "tech_review",
                message: `业务方回复「${(node.data as FlowNodeData).label}」节点批注：${content}`,
                meta: {
                  nodeComments: [
                    {
                      nodeId: node.id,
                      content: `业务方回复：${content}`,
                    },
                  ],
                },
              },
            }),
          }).catch(() => undefined);
        },
      },
    }));
  }, [item.id, nodeComments, repliesByCommentId, selectedNodeId, workingNodes]);

  const edges = useMemo<Edge[]>(() => {
    return (item.edges ?? []).map((edge) => ({
      ...edge,
      animated: true,
      sourceHandle: "bottom-out",
      targetHandle: "top-in",
      type: "smoothstep",
      style: { stroke: "#94a3b8" },
    }));
  }, [item.edges]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const progressPct = item.techProgress.total > 0
    ? Math.round((item.techProgress.done / item.techProgress.total) * 100)
    : 0;

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/me" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Workflow className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-zinc-950">{item.title}</h1>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusCopy.className}`}>
                {statusCopy.label}
              </span>
            </div>
            <p className="truncate text-xs text-zinc-400">{item.description}</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 text-xs text-zinc-500 md:flex">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            更新于 {formatTime(item.updatedAt)}
          </span>
          <span className="h-4 w-px bg-zinc-200" />
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            材料进度 {progressPct}%
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <AssistantPanel
          item={item}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />

        <main className="relative min-w-0 flex-1">
          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur">
            <p className="text-center text-xs font-medium text-zinc-700">业务方案流程图</p>
            <p className="text-center text-[11px] text-zinc-400">点击节点查看批注和人机分工</p>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={BUSINESS_DETAIL_NODE_TYPES}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView={nodes.length <= 4}
            fitViewOptions={{ padding: 0.25 }}
            defaultViewport={{ x: 130, y: 80, zoom: 0.86 }}
            minZoom={0.25}
            maxZoom={1.4}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e4e7" />
            <Controls className="!border-zinc-200 !bg-white !shadow-sm" />
            <MiniMap className="!border-zinc-200 !bg-white" nodeColor="#d4d4d8" maskColor="rgba(255,255,255,0.65)" />
          </ReactFlow>
        </main>

        <NodeInspector selectedNode={selectedNode} onUpdateNodeData={updateNodeData} />
      </div>
    </div>
  );
}
