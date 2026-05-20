"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useFlowAgentStore, type ChatMessage, type ChatPhase, type ChatAttachment } from "@/lib/store";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Loader2, RotateCcw, Paperclip, X, FileText, FileSpreadsheet,
  Image as ImageIcon, File as FileIcon, Sparkles, GitBranch, ShieldCheck, HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { v4 as uuidv4 } from "uuid";
import { parseLLMResponse, serializeFlowForLLM } from "@/lib/flow-parser";
import { generateDemoFlow } from "@/lib/mock-data";
import NodeQuestionPage, { CompletionCard } from "./QuestionCard";
import AgenticConfirmCard from "./AgenticConfirmCard";
import type { NodeConfidence } from "@/lib/store";
import type { AgenticTaskConfig, AgenticConfirmItem } from "@/lib/types";

function fileIcon(ext: string) {
  if ([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".md"].includes(ext)) return <FileText className="w-3.5 h-3.5" />;
  if ([".xlsx", ".xls", ".csv"].includes(ext)) return <FileSpreadsheet className="w-3.5 h-3.5" />;
  if ([".png", ".jpg", ".jpeg"].includes(ext)) return <ImageIcon className="w-3.5 h-3.5" />;
  return <FileIcon className="w-3.5 h-3.5" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

type UploadCategoryId = NonNullable<ChatAttachment["jobMaterialCategory"]>;

const UPLOAD_CATEGORIES: Array<{
  id: UploadCategoryId;
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    id: "workflow_plan",
    title: "流程方案",
    description: "SOP、流程图、操作手册",
    icon: GitBranch,
  },
  {
    id: "business_rule_knowhow",
    title: "业务规则和 Know-how",
    description: "校验规则、审批口径、注意事项",
    icon: ShieldCheck,
  },
  {
    id: "file_template",
    title: "文件模板",
    description: "Excel 模板、申请表、样例文件",
    icon: FileText,
  },
  {
    id: "uncategorized",
    title: "不确定，让 AI 识别",
    description: "先上传，稍后可调整分类",
    icon: HelpCircle,
  },
];

const CATEGORY_LABEL: Record<UploadCategoryId, string> = {
  workflow_plan: "流程方案",
  business_rule_knowhow: "业务规则",
  file_template: "文件模板",
  uncategorized: "待识别",
};

function serializeFilesForLLM(files?: ChatAttachment[]) {
  return (files || []).map((file) => ({
    path: file.path,
    originalName: file.originalName,
    ext: file.ext,
    type: file.type,
    jobMaterialCategory: file.jobMaterialCategory ?? "uncategorized",
  }));
}

type NodeMaterialPatch = {
  nodeId: string;
  attachedMaterials?: Array<{
    fileName?: string;
    category?: string;
    reason?: string;
  }>;
  relatedRules?: Array<{
    title?: string;
    reason?: string;
  }>;
  confidence?: "high" | "medium" | "low";
  reason?: string;
  questions?: NodeConfidence["questions"];
};

type ReadinessQuestion = {
  id?: string;
  question?: string;
  examples?: string[];
};

type ReadinessResult = {
  canDraft?: boolean;
  reason?: string;
  missing?: string[];
  questions?: ReadinessQuestion[];
};

export default function ChatPanel() {
  const {
    chatMessages, addChatMessage, loadGeneratedFlow, nodes, edges,
    chatPhase: phase, setChatPhase: setPhase,
    originalPrompt, setOriginalPrompt,
    pendingNodes, setPendingNodes,
    currentNodeIdx, setCurrentNodeIdx,
    nodeLabelMap, setNodeLabelMap,
    taskType, setTaskType,
    agenticConfig, setAgenticConfig,
    agenticConfirmItems, setAgenticConfirmItems,
    agenticConfirmIdx, setAgenticConfirmIdx,
    setCollectedAnswers,
    setInitialSnapshot, setAllNodeConfidence, setDeferredNodeIds,
    showNodeQuestions, selectedNodeId,
    isReviewMode, currentRole, annotations, project,
    addJobMaterials, setJobMaterials,
  } = useFlowAgentStore();
  const [input, setInput] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [readinessQuestions, setReadinessQuestions] = useState<ReadinessQuestion[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCategoryRef = useRef<UploadCategoryId>("uncategorized");

  const scrollRef = useRef<HTMLDivElement>(null);
  const initTriggered = useRef(false);
  const inFlightRef = useRef(false);
  const lastDraftHadFilesRef = useRef(false);
  const lastDraftFilesRef = useRef<ReturnType<typeof serializeFilesForLLM>>([]);
  const readinessPendingRef = useRef(false);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const newAttachments: ChatAttachment[] = [];
    const category = uploadCategoryRef.current;

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const result = await res.json();
        if (result.success) {
          newAttachments.push({ ...result.file, jobMaterialCategory: category });
        } else {
          toast.error(`上传失败：${file.name}`, { description: result.error });
        }
      } catch {
        toast.error(`上传失败：${file.name}`);
      }
    }

    setPendingFiles((prev) => [...prev, ...newAttachments]);
    setUploading(false);
    uploadCategoryRef.current = "uncategorized";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const openFilePicker = useCallback((category: UploadCategoryId) => {
    uploadCategoryRef.current = category;
    fileInputRef.current?.click();
  }, []);

  const removePendingFile = useCallback((storedName: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.storedName !== storedName));
  }, []);

  const appendReadinessAnswer = useCallback((question: string, answer: string) => {
    const line = `${question}：${answer}`;
    setInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return line;
      if (trimmed.includes(line)) return prev;
      return `${trimmed}\n${line}`;
    });
  }, []);

  const hasFlow = nodes.length > 0;
  const hasAgenticConfig = agenticConfig !== null;
  const showReadinessCard = readinessPendingRef.current && readinessQuestions.length > 0 && !hasFlow && !hasAgenticConfig;
  const isBusinessReviewMode = isReviewMode && currentRole === "business";
  const isTechReviewMode = isReviewMode && currentRole === "tech";
  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : null;
  const selectedNodeData = selectedNode?.data;
  const selectedNodeAnnotations = selectedNodeId
    ? annotations.filter((annotation) => annotation.nodeId === selectedNodeId)
    : [];
  const isLoading = [
    "classifying", "drafting", "refining_node", "refining",
    "drafting_agentic", "refining_agentic",
  ].includes(phase);
  const hasPendingQuestions = pendingNodes.length > 0 && (phase === "questioning" || phase === "ready");
  const isInitialClarification = pendingNodes.length > 0 && phase === "questioning" && taskType === "workflow";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isLoading, hasPendingQuestions, isInitialClarification, showCompletion, showNodeQuestions, showReadinessCard, readinessQuestions.length]);

  useEffect(() => {
    const tryInit = () => {
      const s = useFlowAgentStore.getState();
      const q = s.initQuery;
      if (q && !initTriggered.current && s.chatPhase === "idle") {
        initTriggered.current = true;
        const files = s.initFiles.length > 0 ? [...s.initFiles] : undefined;
        s.setInitQuery(null);
        s.setInitFiles([]);
        triggerUnifiedDraft(q, files);
      }
    };
    tryInit();
    const unsub = useFlowAgentStore.subscribe((state) => {
      if (state.initQuery && !initTriggered.current) {
        tryInit();
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Phase 0+1: Unified draft (readiness + draft)
  // ============================================================

  const triggerUnifiedDraft = useCallback(async (prompt: string, files?: ChatAttachment[]) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase("drafting");
    setOriginalPrompt(prompt);
    setPendingNodes([]);
    setCurrentNodeIdx(0);
    setShowCompletion(false);
    setCollectedAnswers({});
    setInitialSnapshot(null);
    setAllNodeConfidence([]);
    setDeferredNodeIds([]);
    setReadinessQuestions([]);
    useFlowAgentStore.getState().setGenerationStage("idle");
    useFlowAgentStore.getState().setEnrichProgress({ total: 0, done: 0, status: "idle" });

    const effectiveFiles = files && files.length > 0
      ? files
      : useFlowAgentStore.getState().jobMaterials;
    if (effectiveFiles.length > 0) {
      setJobMaterials(effectiveFiles);
    }
    const requestFiles = serializeFilesForLLM(effectiveFiles);
    const filePaths = requestFiles.map((f) => f.path);
    lastDraftHadFilesRef.current = filePaths.length > 0;
    lastDraftFilesRef.current = requestFiles;
    const progressMsgId = uuidv4();

    addChatMessage({
      id: progressMsgId,
      role: "assistant",
      content: "正在分析...",
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, action: "unified_draft", filePaths, files: requestFiles }),
        signal: AbortSignal.timeout(300000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const result = await res.json();
        if (result.action === "ask_readiness_questions") {
          const readiness = result.readiness as ReadinessResult;
          const questions = (readiness?.questions || []).filter((item) => item.question).slice(0, 5);
          readinessPendingRef.current = true;
          setReadinessQuestions(questions);
          useFlowAgentStore.getState().updateChatMessage(progressMsgId, "我还需要先确认几件事，避免一开始方向跑偏。你可以点选下面的选项，也可以直接输入自己的说法。");
          setPhase("idle");
          return;
        }
        if (!result.success) throw new Error(result.error || "未知错误");
        const rawType = result.taskType as string;
        const effectiveType: "workflow" | "agentic" = rawType === "agentic" ? "agentic" : "workflow";
        setTaskType(effectiveType);
        useFlowAgentStore.getState().updateChatMessage(progressMsgId, `判断为 **${effectiveType === "agentic" ? "智能体" : "工作流"}** 类型。`);
        if (effectiveType === "agentic") handleAgenticResult(result, prompt);
        else handleWorkflowResult(result);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let classified = false;
      let gotDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: Record<string, unknown>;
          try { event = JSON.parse(jsonStr); } catch { continue; }

          if (event.type === "progress") {
            useFlowAgentStore.getState().updateChatMessage(progressMsgId, event.message as string);
          } else if (event.type === "stage") {
            const stage = event.stage as "classify_start" | "classify_done" | "draft_start" | "draft_done";
            useFlowAgentStore.getState().setGenerationStage(stage);
          } else if (event.type === "readiness") {
            classified = true;
            const readiness = event.readiness as ReadinessResult;
            if (readiness?.canDraft === false) {
              useFlowAgentStore.getState().updateChatMessage(progressMsgId, "还需要补充一点准入信息...");
            } else {
              const reason = readiness?.reason ? `\n${readiness.reason}` : "";
              useFlowAgentStore.getState().updateChatMessage(progressMsgId, `已理解业务场景，正在整理第一版业务方案...${reason}`);
            }
            setTaskType("workflow");
          } else if (event.type === "text") {
            if (!classified) {
              useFlowAgentStore.getState().updateChatMessage(progressMsgId, "正在生成流程图...");
            }
          } else if (event.type === "done") {
            gotDone = true;
            const result = event as Record<string, unknown>;
            if (result.action === "ask_readiness_questions") {
              const readiness = result.readiness as ReadinessResult;
              const questions = (readiness?.questions || []).filter((item) => item.question).slice(0, 5);
              readinessPendingRef.current = true;
              setReadinessQuestions(questions);
              useFlowAgentStore.getState().updateChatMessage(progressMsgId, "我还需要先确认几件事，避免一开始方向跑偏。你可以点选下面的选项，也可以直接输入自己的说法。");
              setPhase("idle");
              useFlowAgentStore.getState().setGenerationStage("idle");
              continue;
            }
            const rawType = (result.taskType as string) || "workflow";
            let effectiveType: "workflow" | "agentic" = rawType === "agentic" ? "agentic" : "workflow";

            if (effectiveType === "workflow" && result.data && !(result.data as Record<string, unknown>).nodes && (result.data as Record<string, unknown>).phases) {
              effectiveType = "agentic";
            }
            setTaskType(effectiveType);

            if (!classified) {
              useFlowAgentStore.getState().updateChatMessage(progressMsgId, "已理解业务场景，正在整理第一版业务方案...");
            }

            try {
              if (effectiveType === "agentic") {
                handleAgenticResult(result as Record<string, unknown>, prompt);
                useFlowAgentStore.getState().updateChatMessage(progressMsgId, "Agentic 方案生成完成 ✅");
              } else {
                handleWorkflowResult(result as Record<string, unknown>);
                useFlowAgentStore.getState().updateChatMessage(progressMsgId, "流程图已生成，正在补全操作清单…");
              }
              useFlowAgentStore.getState().setGenerationStage("draft_done");
            } catch (parseErr) {
              console.error("Failed to parse AI result:", parseErr);
              setPhase("idle");
              addChatMessage({ id: uuidv4(), role: "assistant", content: `AI 返回了结果但解析失败，请重试。`, timestamp: new Date().toISOString() });
            }
          } else if (event.type === "error") {
            throw new Error(event.error as string);
          }
        }
      }

      if (!gotDone) {
        throw new Error("生成中断：未收到完成事件");
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "网络错误";
      const isAbort = raw.includes("aborted") || raw.includes("AbortError");
      const msg = isAbort ? "AI 生成超时，请稍后重试" : raw;

      const storeType = useFlowAgentStore.getState().taskType;
      const hasAgConfig = useFlowAgentStore.getState().agenticConfig !== null;
      if (storeType === "agentic" || hasAgConfig) {
        useFlowAgentStore.getState().updateChatMessage(progressMsgId, `Agentic 方案生成出错（${msg}）。请重新描述你的需求。`);
        setPhase("idle");
      } else {
        const demo = generateDemoFlow();
        loadGeneratedFlow(demo.nodes, demo.edges);
        setInitialSnapshot({ nodes: demo.nodes, edges: demo.edges });
        setTaskType("workflow");
        useFlowAgentStore.setState((s) => ({ project: { ...s.project, name: "小红书账号运营（离线演示）" } }));
        useFlowAgentStore.getState().updateChatMessage(progressMsgId, `AI 服务暂时不可用（${msg}），已加载离线演示流程图。`);
        setPhase("ready");
      }
    } finally {
      useFlowAgentStore.getState().setGenerationStage("idle");
      inFlightRef.current = false;
    }
  }, [addChatMessage, loadGeneratedFlow, setPhase, setOriginalPrompt, setTaskType, setPendingNodes, setCurrentNodeIdx, setCollectedAnswers, setInitialSnapshot, setAllNodeConfidence, setDeferredNodeIds, setJobMaterials]);

  const enrichWorkflowNodeContext = useCallback(async (
    sourceFlow: Record<string, unknown>,
    originalReq: string,
    labelMap: Record<string, string>,
  ) => {
    const requestFiles = lastDraftFilesRef.current;
    if (requestFiles.length === 0) return;

    try {
      const filePaths = requestFiles.map((file) => file.path);
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enrich_node_context",
          prompt: originalReq,
          currentFlow: sourceFlow,
          filePaths,
          files: requestFiles,
        }),
        signal: AbortSignal.timeout(180000),
      });
      const result = await res.json();
      if (!result.success || !Array.isArray(result.data?.nodePatches)) return;

      const patches = result.data.nodePatches as NodeMaterialPatch[];
      const materialPatches = patches.filter((patch) => patch.nodeId);
      if (materialPatches.length === 0) return;

      const questionPatches: NodeConfidence[] = materialPatches
        .filter((patch) => Array.isArray(patch.questions) && patch.questions.length > 0)
        .map((patch) => ({
          nodeId: patch.nodeId,
          confidence: patch.confidence || "medium",
          reason: patch.reason || "该节点需要根据上传材料进一步确认。",
          questions: (patch.questions || []).map((question, idx) => ({
            id: question.id || `${patch.nodeId}-material-q${idx + 1}`,
            question: question.question,
            context: question.context || patch.reason || "根据上传材料识别出的待确认点。",
            defaultSuggestion: question.defaultSuggestion || "如果没有特别要求，建议按现有材料口径处理。",
            options: question.options || [],
          })).filter((question) => question.question),
        }));

      if (questionPatches.length > 0) {
        const state = useFlowAgentStore.getState();
        const existingByNode = new Map(state.allNodeConfidence.map((item) => [item.nodeId, item]));
        for (const patch of questionPatches) {
          const current = existingByNode.get(patch.nodeId);
          if (!current) {
            existingByNode.set(patch.nodeId, patch);
            continue;
          }
          const existingQuestionIds = new Set((current.questions || []).map((question) => question.id));
          const nextQuestions = [
            ...(current.questions || []),
            ...patch.questions.filter((question) => !existingQuestionIds.has(question.id)),
          ];
          existingByNode.set(patch.nodeId, {
            ...current,
            confidence: current.confidence === "low" ? current.confidence : patch.confidence,
            reason: current.reason || patch.reason,
            questions: nextQuestions,
          });
        }

        const nextAllConfidence = Array.from(existingByNode.values());
        const nextPendingNodes = nextAllConfidence.filter((item) => item.confidence !== "high" && item.questions.length > 0);
        setAllNodeConfidence(nextAllConfidence);
        setPendingNodes(nextPendingNodes);
        if (nextPendingNodes.length > 0) {
          setPhase("questioning");
        }
        useFlowAgentStore.setState({ currentNodeIdx: 0 });
      }

      const nodesWithMaterials = materialPatches.filter((patch) =>
        (patch.attachedMaterials?.length || 0) > 0 || (patch.relatedRules?.length || 0) > 0
      );
      const lines = nodesWithMaterials.slice(0, 5).map((patch) => {
        const label = labelMap[patch.nodeId] || patch.nodeId;
        const materialNames = (patch.attachedMaterials || [])
          .map((item) => item.fileName)
          .filter(Boolean)
          .slice(0, 2)
          .join("、");
        const ruleNames = (patch.relatedRules || [])
          .map((item) => item.title)
          .filter(Boolean)
          .slice(0, 2)
          .join("、");
        const parts = [
          materialNames ? `关联材料：${materialNames}` : "",
          ruleNames ? `相关规则：${ruleNames}` : "",
        ].filter(Boolean);
        return `• ${label}：${parts.join("；")}`;
      });

      if (lines.length > 0 || questionPatches.length > 0) {
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: [
            "**已根据上传材料补充节点依据**",
            lines.length > 0 ? lines.join("\n") : "",
            questionPatches.length > 0 ? `\n发现 **${questionPatches.length} 个节点** 还需要确认，已加入左侧追问卡。` : "",
          ].filter(Boolean).join("\n"),
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // 节点材料依据是增强能力，失败不阻塞主流程
    }
  }, [addChatMessage, setAllNodeConfidence, setPendingNodes, setPhase]);

  const enrichWorkflowNodeDetails = useCallback(async (sourceFlow: Record<string, unknown>, originalReq: string) => {
    try {
      const targetTotal = Array.isArray(sourceFlow?.nodes) ? sourceFlow.nodes.length : 0;
      useFlowAgentStore.getState().setEnrichProgress({ total: targetTotal, done: 0, status: "running" });
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enrich_node_details_batch",
          prompt: originalReq,
          currentFlow: sourceFlow,
          strictTerminology: lastDraftHadFilesRef.current,
        }),
        signal: AbortSignal.timeout(180000),
      });
      const result = await res.json();
      if (!result.success || !result.data?.nodes) return;

      const enrichMap = new Map<string, {
        briefDescription?: string;
        operationSteps?: string[];
        requiredCheckFields?: string[];
        doneCriteria?: string;
      }>();

      for (const item of result.data.nodes as Array<Record<string, unknown>>) {
        const nodeId = String(item.nodeId || "");
        if (!nodeId) continue;
        enrichMap.set(nodeId, {
          briefDescription: typeof item.briefDescription === "string" ? item.briefDescription : undefined,
          operationSteps: Array.isArray(item.operationSteps) ? item.operationSteps.filter((x) => typeof x === "string") as string[] : undefined,
          requiredCheckFields: Array.isArray(item.requiredCheckFields) ? item.requiredCheckFields.filter((x) => typeof x === "string") as string[] : undefined,
          doneCriteria: typeof item.doneCriteria === "string" ? item.doneCriteria : undefined,
        });
      }

      const applyEnrichment = () => {
        const s = useFlowAgentStore.getState();
        // 避免与“节点流式上屏”竞争：若画布暂时为空，不做覆盖写回
        if (!s.nodes || s.nodes.length === 0) return false;

        const patched: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[] = s.nodes.map((n) => {
          const e = enrichMap.get(n.id);
          if (!e) return n;
          const d = n.data as unknown as Record<string, unknown>;
          const next = { ...d };

          // 用户已改过就不覆盖：仅在空值时补全
          if ((!d.description || String(d.description).trim() === "") && e.briefDescription) next.description = e.briefDescription;
          if ((!Array.isArray(d.operationSteps) || (d.operationSteps as unknown[]).length === 0) && e.operationSteps) next.operationSteps = e.operationSteps;
          if ((!Array.isArray(d.requiredCheckFields) || (d.requiredCheckFields as unknown[]).length === 0) && e.requiredCheckFields) next.requiredCheckFields = e.requiredCheckFields;
          if ((!d.doneCriteria || String(d.doneCriteria).trim() === "") && e.doneCriteria) next.doneCriteria = e.doneCriteria;
          return { ...n, data: next as import("@/lib/types").FlowNodeData };
        });

        loadGeneratedFlow(patched, s.edges);
        useFlowAgentStore.getState().setEnrichProgress({
          total: targetTotal,
          done: targetTotal,
          status: "done",
        });
        return true;
      };

      // 先尝试一次；若仍处于上屏阶段则稍后再试，避免清空画布
      if (!applyEnrichment()) {
        setTimeout(() => { applyEnrichment(); }, 400);
      }
    } catch {
      // 节点补全是增强能力，失败不阻塞主流程
      useFlowAgentStore.getState().setEnrichProgress({ total: 0, done: 0, status: "idle" });
    }
  }, [loadGeneratedFlow]);

  const mergeBusinessDetailFields = useCallback((
    nextNodes: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[],
    prevNodes: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[]
  ) => {
    const normalizeLabel = (raw: string) =>
      String(raw || "")
        .trim()
        .replace(/^\s*\d+\s*[.,、，:：)\]\-]\s*/u, "")
        .replace(/^\s*[一二三四五六七八九十百千]+\s*[.,、，:：)\]\-]\s*/u, "")
        .replace(/\s+/g, "")
        .toLowerCase();

    const prevById = new Map(prevNodes.map((n) => [n.id, n.data]));
    const prevByLabel = new Map<string, import("@/lib/types").FlowNodeData>();
    const prevByStep = new Map<number, import("@/lib/types").FlowNodeData>();
    for (const n of prevNodes) {
      const d = n.data;
      const norm = normalizeLabel(String(d?.label || ""));
      if (norm && !prevByLabel.has(norm)) prevByLabel.set(norm, d);
      if (typeof d?.stepIndex === "number" && !prevByStep.has(d.stepIndex)) prevByStep.set(d.stepIndex, d);
    }

    const resolvePrev = (n: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>) => {
      const byId = prevById.get(n.id);
      if (byId) return byId;
      const norm = normalizeLabel(String(n.data?.label || ""));
      if (norm && prevByLabel.has(norm)) return prevByLabel.get(norm);
      if (typeof n.data?.stepIndex === "number" && prevByStep.has(n.data.stepIndex)) return prevByStep.get(n.data.stepIndex);
      return undefined;
    };

    return nextNodes.map((n) => {
      const prev = resolvePrev(n);
      if (!prev) return n;
      const d = n.data as Record<string, unknown>;
      const p = prev as Record<string, unknown>;
      const merged = { ...d } as Record<string, unknown>;
      if (!Array.isArray(d.operationSteps) || (d.operationSteps as unknown[]).length === 0) {
        if (Array.isArray(p.operationSteps) && (p.operationSteps as unknown[]).length > 0) merged.operationSteps = p.operationSteps;
      }
      if (!Array.isArray(d.requiredCheckFields) || (d.requiredCheckFields as unknown[]).length === 0) {
        if (Array.isArray(p.requiredCheckFields) && (p.requiredCheckFields as unknown[]).length > 0) merged.requiredCheckFields = p.requiredCheckFields;
      }
      if (!d.doneCriteria || String(d.doneCriteria).trim() === "") {
        if (p.doneCriteria && String(p.doneCriteria).trim() !== "") merged.doneCriteria = p.doneCriteria;
      }
      return { ...n, data: merged as import("@/lib/types").FlowNodeData };
    });
  }, []);

  const forcePendingExecutionMode = useCallback((
    targetNodes: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[]
  ) => {
    return targetNodes.map((n) => ({
      ...n,
      data: {
        ...(n.data as import("@/lib/types").FlowNodeData),
        executionMode: "pending" as import("@/lib/types").NodeExecutionMode,
      } as import("@/lib/types").FlowNodeData,
    })) as import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[];
  }, []);

  const preserveExecutionModeFromCurrent = useCallback((
    nextNodes: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[],
    currentNodes: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[]
  ) => {
    const modeById = new Map(currentNodes.map((n) => [n.id, n.data.executionMode]));
    return nextNodes.map((n) => ({
      ...n,
      data: {
        ...(n.data as import("@/lib/types").FlowNodeData),
        executionMode: modeById.get(n.id) ?? (n.data as import("@/lib/types").FlowNodeData).executionMode,
      },
    }));
  }, []);

  const applyNodeDeltaUpdates = useCallback((
    currentNodes: import("@xyflow/react").Node<import("@/lib/types").FlowNodeData>[],
    updates: Array<Record<string, unknown>>
  ) => {
    const updateMap = new Map<string, Record<string, unknown>>();
    for (const item of updates) {
      const nodeId = typeof item.nodeId === "string" ? item.nodeId : "";
      if (nodeId) updateMap.set(nodeId, item);
    }
    if (updateMap.size === 0) return currentNodes;

    return currentNodes.map((node) => {
      const upd = updateMap.get(node.id);
      if (!upd) return node;

      const data = node.data as Record<string, unknown>;
      const next: Record<string, unknown> = { ...data };

      const patchScalar = (key: string) => {
        if (typeof upd[key] === "string" && String(upd[key]).trim() !== "") {
          next[key] = upd[key];
        }
      };

      patchScalar("label");
      patchScalar("description");
      patchScalar("estimatedTime");
      patchScalar("doneCriteria");

      if (Array.isArray(upd.inputs)) next.inputs = upd.inputs;
      if (Array.isArray(upd.outputs)) next.outputs = upd.outputs;
      if (Array.isArray(upd.operationSteps)) next.operationSteps = upd.operationSteps;
      if (Array.isArray(upd.requiredCheckFields)) next.requiredCheckFields = upd.requiredCheckFields;

      return { ...node, data: next as import("@/lib/types").FlowNodeData };
    });
  }, []);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleWorkflowResult = useCallback((result: Record<string, any>) => {
    const data = result.data;
    if (!data || !data.nodes || !Array.isArray(data.nodes)) { setPhase("idle"); return; }

    const { projectName, nodes: parsedNodes, edges: parsedEdges } =
      parseLLMResponse(data);
    const normalizedNodes = forcePendingExecutionMode(parsedNodes);

    setInitialSnapshot({ nodes: normalizedNodes, edges: parsedEdges });

    // Stream nodes in one by one
    const STAGGER_MS = 300;
    normalizedNodes.forEach((_, i) => {
      setTimeout(() => {
        const visibleNodes = normalizedNodes.slice(0, i + 1);
        const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
        const visibleEdges = parsedEdges.filter(
          (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
        );
        loadGeneratedFlow(visibleNodes, visibleEdges);
      }, i * STAGGER_MS);
    });
    useFlowAgentStore.setState((s) => ({
      project: { ...s.project, name: projectName },
    }));

    const labelMap: Record<string, string> = {};
    for (const n of (data.nodes as { id: string; label: string }[]) || []) {
      labelMap[n.id] = n.label;
    }
    setNodeLabelMap(labelMap);

    const allNodeConf: NodeConfidence[] = ((result.nodeConfidence as NodeConfidence[]) || []).map((nc) => ({
      ...nc,
      questions: nc.questions || [],
    }));
    setAllNodeConfidence(allNodeConf);
    const needConfirm = allNodeConf.filter(
      (nc) => nc.confidence !== "high" && nc.questions.length > 0
    );

    // Show summary after all nodes have streamed in
    const streamDoneMs = normalizedNodes.length * STAGGER_MS + 200;
    setTimeout(() => {
      useFlowAgentStore.setState({
        pendingNodes: needConfirm,
        currentNodeIdx: 0,
      });

      const humanSummaryParts: string[] = [];
      humanSummaryParts.push(`**「${projectName}」梳理完成 ✅**`);
      humanSummaryParts.push(`\n这件事共分 **${normalizedNodes.length} 步**：`);
      const normalizeStepLabel = (raw: string) =>
        raw
          // 先去掉阿拉伯数字前缀：1. / 1、 / 1，等
          .replace(/^\s*\d+\s*[.,、，:：)\]\-]\s*/u, "")
          // 再去掉中文数字前缀：一、 / 一， / 十：等
          .replace(/^\s*[一二三四五六七八九十百千]+\s*[.,、，:：)\]\-]\s*/u, "")
          .trim();

      const stepLines = normalizedNodes.map((n, i) => {
        const label = String(n.data?.label || n.id || "").trim();
        const cleanLabel = normalizeStepLabel(label) || label;
        return `${i + 1}. ${cleanLabel}`;
      });
      humanSummaryParts.push(stepLines.join("\n"));

      if (needConfirm.length > 0) {
        const lowNodes = needConfirm.filter((nc) => nc.confidence === "low");
        const medNodes = needConfirm.filter((nc) => nc.confidence === "medium");
        const uncertainParts: string[] = [];
        if (lowNodes.length > 0) {
          uncertainParts.push(`🔴 ${lowNodes.length} 个步骤信息不够（${lowNodes.map((n) => labelMap[n.nodeId] || n.nodeId).join("、")}）`);
        }
        if (medNodes.length > 0) {
          uncertainParts.push(`🟡 ${medNodes.length} 个步骤需确认细节（${medNodes.map((n) => labelMap[n.nodeId] || n.nodeId).join("、")}）`);
        }
        humanSummaryParts.push(`\n${uncertainParts.join("\n")}`);
      }

      humanSummaryParts.push(`\n**💡 小改自己动手，大改告诉我：**`);
      humanSummaryParts.push(`• 执行方式（AI/人工）→ 技术评审阶段统一配置`);
      humanSummaryParts.push(`• 改描述/补信息 → 点击卡片查看详情`);
      humanSummaryParts.push(`• 加减步骤/改方向 → 在这里告诉我`);

      // 保留最新一条“梳理完成”总结，避免重复堆叠
      useFlowAgentStore.setState((s) => ({
        chatMessages: s.chatMessages.filter((m) => !(m.role === "assistant" && m.content.includes("梳理完成 ✅"))),
      }));
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: humanSummaryParts.join("\n"),
        timestamp: new Date().toISOString(),
      });
      setPhase(needConfirm.length > 0 ? "questioning" : "ready");
      enrichWorkflowNodeContext(data as Record<string, unknown>, useFlowAgentStore.getState().originalPrompt, labelMap);
      enrichWorkflowNodeDetails(data as Record<string, unknown>, useFlowAgentStore.getState().originalPrompt);
    }, streamDoneMs);
  }, [addChatMessage, loadGeneratedFlow, setPhase, setNodeLabelMap, setInitialSnapshot, setAllNodeConfidence, enrichWorkflowNodeContext, enrichWorkflowNodeDetails, forcePendingExecutionMode]);

  const handleAgenticResult = useCallback((result: Record<string, any>, prompt: string) => {
    const data = result.data;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (!data) { setPhase("idle"); return; }

    const phases = (data.phases || []).map((p: Record<string, unknown>, i: number) => ({
      id: (p.id as string) || `phase-${i + 1}`,
      name: (p.name as string) || `阶段 ${i + 1}`,
      dayRange: (p.dayRange as [number, number]) || [1, 7],
      status: "pending" as const,
      actions: (p.actions as string[]) || [],
      successCriteria: (p.successCriteria as AgenticTaskConfig["phases"][0]["successCriteria"]) || { good: "", warning: "", bad: "" },
      exitCondition: (p.exitCondition as string) || "",
      requiresApproval: (p.requiresApproval as boolean) || false,
      approvalDescription: (p.approvalDescription as string) || undefined,
      questions: (p.questions as AgenticTaskConfig["phases"][0]["questions"]) || [],
      requiredCapabilities: (p.requiredCapabilities as string[]) || [],
    }));

    const config: AgenticTaskConfig = {
      goal: (data.goal as string) || "",
      background: (data.background as string) || "",
      totalDays: (data.totalDays as number) || 90,
      phases,
      globalSuccessCriteria: (data.globalSuccessCriteria as string) || "",
      approvalPoints: (data.approvalPoints as string[]) || [],
      fallbacks: (data.fallbacks as AgenticTaskConfig["fallbacks"]) || [],
      constraints: (data.constraints as AgenticTaskConfig["constraints"]) || [],
      skills: (data.skills as AgenticTaskConfig["skills"]) || [],
      evaluators: (data.evaluators as AgenticTaskConfig["evaluators"]) || [],
      executionStrategy: (data.executionStrategy as AgenticTaskConfig["executionStrategy"]) || "adaptive",
      maxIterations: (data.maxIterations as number) || 5,
      humanCheckpoints: (data.humanCheckpoints as string[]) || [],
      goalMetrics: data.goalMetrics || undefined,
      executionRules: data.executionRules || undefined,
      permissions: data.permissions || undefined,
      reporting: data.reporting || undefined,
      contentPreview: data.contentPreview || undefined,
      estimatedDuration: data.estimatedDuration || undefined,
      estimatedEfficiency: data.estimatedEfficiency || undefined,
      executionOverview: data.executionOverview || undefined,
      riskAssessment: data.riskAssessment || undefined,
    };

    setAgenticConfig(config);

    const pName = (result.projectName as string) || "";
    if (pName) {
      useFlowAgentStore.setState((s) => ({
        project: { ...s.project, name: pName, status: "business_editing" },
      }));
    }

    const goalText = config.goalMetrics?.core || config.goal;
    const phaseCount = phases.length;
    const approvalPhaseCount = phases.filter((p: { requiresApproval?: boolean }) => p.requiresApproval).length;
    const needQuestionCount = phases.filter((p: { questions?: unknown[] }) => p.questions && p.questions.length > 0).length;

    // 人话版摘要
    const agenticSummaryParts: string[] = [];
    agenticSummaryParts.push(`**「${pName || "任务方案"}」梳理完成 ✅**`);
    agenticSummaryParts.push(`\n**目标**：${goalText}`);
    agenticSummaryParts.push(`\n这件事分 **${phaseCount} 个阶段**，周期约 **${config.totalDays} 天**：`);
    agenticSummaryParts.push(`• 🤖 AI 按策略自动推进每个阶段`);
    if (approvalPhaseCount > 0) {
      agenticSummaryParts.push(`• 👤 有 **${approvalPhaseCount} 个阶段**需要你审批后才能继续`);
    }
    if (needQuestionCount > 0) {
      agenticSummaryParts.push(`\n右侧方案已生成，有 ${needQuestionCount} 个阶段需要你补充一些信息，请逐阶段确认。`);
    }

    agenticSummaryParts.push(`\n**💡 小改自己动手，大改告诉我：**`);
    agenticSummaryParts.push(`• 改阶段细节 → 点击右侧卡片直接修改`);
    agenticSummaryParts.push(`• 加减阶段/改方向 → 在这里告诉我`);

    addChatMessage({
      id: uuidv4(),
      role: "assistant",
      content: agenticSummaryParts.join("\n"),
      timestamp: new Date().toISOString(),
    });
    setPhase("agentic_ready");
  }, [addChatMessage, setPhase, setAgenticConfig, setAgenticConfirmItems, setAgenticConfirmIdx]);

  // ============================================================
  // Phase 2: Batch confirmation (Workflow) — collect then refine once
  // ============================================================

  const handleBatchSubmit = useCallback(
    async (collected: Record<string, { question: string; answer: string }[]>) => {
      const { allNodeConfidence: allConf, nodeLabelMap: lm, originalPrompt: op } =
        useFlowAgentStore.getState();

      const collectedNodeIds = Object.keys(collected);
      if (collectedNodeIds.length === 0) return;

      const answeredSummary = Object.entries(collected)
        .map(([nodeId, answers]) => {
          const label = lm[nodeId] || nodeId;
          return `「${label}」：${answers.map((a) => a.answer).join("、")}`;
        })
        .join("\n");

      addChatMessage({
        id: uuidv4(),
        role: "user",
        content: `已确认 ${collectedNodeIds.length} 个节点：\n${answeredSummary}`,
        timestamp: new Date().toISOString(),
      });

      setPhase("refining_node");

      try {
        const { nodes: currentNodes, edges: currentEdges } =
          useFlowAgentStore.getState();
        const { json: canvasJson } = serializeFlowForLLM(currentNodes, currentEdges);

        const confMap = new Map(allConf.map((nc) => [nc.nodeId, nc]));
        const nodeAnswers = collectedNodeIds.map((nodeId) => ({
          nodeId,
          nodeLabel: lm[nodeId] || nodeId,
          answers: collected[nodeId] || confMap.get(nodeId)?.questions.map((q) => ({
            question: q.question,
            answer: q.defaultSuggestion,
          })) || [],
        }));

        let applied = false;
        let fallbackReason = "";

        // Fast path: only patch answered nodes
        try {
          const deltaRes = await fetch("/api/generate-flow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "refine_batch_delta",
              prompt: op,
              currentFlow: canvasJson,
              nodeAnswers,
            }),
            signal: AbortSignal.timeout(120000),
          });
          const deltaResult = await deltaRes.json();
          if (deltaResult.success && deltaResult.data) {
            const deltaData = deltaResult.data as {
              requiresFullRefine?: boolean;
              reason?: string;
              updates?: Array<Record<string, unknown>>;
            };
            if (deltaData.requiresFullRefine) {
              fallbackReason = deltaData.reason || "本次回答涉及流程结构调整";
            } else {
              const updates = Array.isArray(deltaData.updates) ? deltaData.updates : [];
              const deltaNodes = applyNodeDeltaUpdates(currentNodes, updates);
              const mergedNodes = mergeBusinessDetailFields(deltaNodes, currentNodes);
              loadGeneratedFlow(mergedNodes, currentEdges);

              const newLabelMap: Record<string, string> = { ...lm };
              for (const n of mergedNodes) {
                newLabelMap[n.id] = String(n.data?.label || newLabelMap[n.id] || n.id);
              }
              setNodeLabelMap(newLabelMap);

              applied = true;
              addChatMessage({
                id: uuidv4(),
                role: "assistant",
                content: updates.length > 0
                  ? `已快速更新 ${updates.length} 个节点细节。`
                  : "这些确认与当前内容一致，节点无需改动。",
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            fallbackReason = deltaResult.error || "快速更新不可用";
          }
        } catch {
          fallbackReason = "快速更新请求失败";
        }

        // Fallback: full refine (for structural changes or fast-path failure)
        if (!applied) {
          const res = await fetch("/api/generate-flow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "refine_batch",
              prompt: op,
              currentFlow: canvasJson,
              nodeAnswers,
            }),
            signal: AbortSignal.timeout(300000),
          });
          const result = await res.json();

          if (result.success && result.data) {
            const { projectName, nodes: parsedNodes, edges: parsedEdges } =
              parseLLMResponse(result.data);
            const withModePreserved = preserveExecutionModeFromCurrent(parsedNodes, currentNodes);
            const mergedNodes = mergeBusinessDetailFields(withModePreserved, currentNodes);
            loadGeneratedFlow(mergedNodes, parsedEdges);
            if (projectName) {
              useFlowAgentStore.setState((s) => ({
                project: { ...s.project, name: projectName },
              }));
            }

            const newLabelMap: Record<string, string> = { ...lm };
            for (const n of result.data.nodes || []) {
              newLabelMap[n.id] = n.label;
            }
            setNodeLabelMap(newLabelMap);

            applied = true;
            addChatMessage({
              id: uuidv4(),
              role: "assistant",
              content: fallbackReason
                ? `${fallbackReason}，已切换为完整更新并优化了 ${nodeAnswers.length} 个节点。`
                : `已根据你的确认优化了 ${nodeAnswers.length} 个节点。你可以继续调整，或告诉我还有什么需要修改的。`,
              timestamp: new Date().toISOString(),
            });

            // 保险兜底：完整更新后再做一次节点细节补全，防止模型漏返 operationSteps 等字段
            enrichWorkflowNodeDetails(result.data as Record<string, unknown>, op || "");
          } else {
            addChatMessage({
              id: uuidv4(),
              role: "assistant",
              content: `批量优化失败：${result.error || "未知错误"}，流程图保持不变。`,
              timestamp: new Date().toISOString(),
            });
          }
        }

        if (applied) {
          const confirmedIds = new Set(Object.keys(collected));
          const { allNodeConfidence: prevConf } = useFlowAgentStore.getState();
          setAllNodeConfidence(
            prevConf.map((nc) =>
              confirmedIds.has(nc.nodeId)
                ? { ...nc, confidence: "high" as const, questions: [] }
                : nc
            )
          );
        }

        setShowCompletion(true);
        setPhase("ready");
        useFlowAgentStore.setState({ pendingNodes: [], currentNodeIdx: 0 });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "网络错误";
        toast.error("优化失败", { description: msg });
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `优化请求出错：${msg}，流程图保持不变。你可以重新提交确认或继续编辑。`,
          timestamp: new Date().toISOString(),
        });
        setPhase("ready");
      }
    },
    [addChatMessage, loadGeneratedFlow, setPhase, setNodeLabelMap, mergeBusinessDetailFields, applyNodeDeltaUpdates, enrichWorkflowNodeDetails, preserveExecutionModeFromCurrent]
  );

  const handleDeferNode = useCallback((nodeId: string) => {
    const store = useFlowAgentStore.getState();
    store.addDeferredNodeId(nodeId);
    const remaining = store.pendingNodes.filter((n) => n.nodeId !== nodeId);
    setPendingNodes(remaining);
    if (remaining.length === 0) {
      setShowCompletion(true);
      setPhase("ready");
      useFlowAgentStore.setState({ currentNodeIdx: 0 });
    }
  }, [setPendingNodes, setPhase]);

  const handleSkipAll = useCallback(() => {
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: "跳过全部确认，使用 AI 推荐方案",
      timestamp: new Date().toISOString(),
    });
    setShowCompletion(true);
    setPhase("ready");
    useFlowAgentStore.setState({ pendingNodes: [], currentNodeIdx: 0 });
  }, [addChatMessage, setPhase]);

  const handleCompletionDone = () => {
    setShowCompletion(false);
  };

  // ============================================================
  // Phase 2b: Agentic confirm items
  // ============================================================

  const currentAgenticConfirm = phase === "confirming_agentic" && agenticConfirmIdx < agenticConfirmItems.length
    ? agenticConfirmItems[agenticConfirmIdx]
    : null;

  const finishAgenticConfirm = useCallback(() => {
    addChatMessage({
      id: uuidv4(),
      role: "assistant",
      content: "所有确认项已完成。请在右侧面板查看完整配置，或告诉我需要调整的地方。",
      timestamp: new Date().toISOString(),
    });
    setPhase("agentic_ready");
    setAgenticConfirmItems([]);
    setAgenticConfirmIdx(0);
  }, [addChatMessage, setPhase, setAgenticConfirmItems, setAgenticConfirmIdx]);

  const handleAgenticConfirm = useCallback((answer: string) => {
    const { agenticConfirmItems: items, agenticConfirmIdx: idx, agenticConfig: config } = useFlowAgentStore.getState();
    const item = items[idx];
    if (!item) return;

    const sectionLabel = { goal: "目标", skills: "技能", constraints: "约束", evaluators: "评估" }[item.section] || item.section;
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: `「${sectionLabel}」确认：${answer}`,
      timestamp: new Date().toISOString(),
    });

    if (config) {
      const updated = { ...config };
      switch (item.section) {
        case "goal":
          updated.goal = `${config.goal}（用户补充：${answer}）`;
          break;
        case "skills": {
          const skillIdx = config.skills.findIndex((s) =>
            item.question.includes(s.name)
          );
          if (skillIdx >= 0) {
            updated.skills = config.skills.map((s, i) =>
              i === skillIdx ? { ...s, description: `${s.description}（${answer}）` } : s
            );
          }
          break;
        }
        case "constraints": {
          const cIdx = config.constraints.findIndex((c) =>
            item.question.includes(c.description)
          );
          if (cIdx >= 0) {
            updated.constraints = config.constraints.map((c, i) =>
              i === cIdx ? { ...c, value: answer } : c
            );
          } else {
            updated.constraints = [
              ...config.constraints,
              { id: `c-user-${Date.now()}`, type: "custom", description: answer },
            ];
          }
          break;
        }
        case "evaluators": {
          const eIdx = config.evaluators.findIndex((e) =>
            item.question.includes(e.name)
          );
          if (eIdx >= 0) {
            updated.evaluators = config.evaluators.map((e, i) =>
              i === eIdx ? { ...e, description: `${e.description}（${answer}）` } : e
            );
          }
          break;
        }
      }
      setAgenticConfig(updated);
    }

    const nextIdx = idx + 1;
    if (nextIdx < items.length) {
      setAgenticConfirmIdx(nextIdx);
    } else {
      finishAgenticConfirm();
    }
  }, [addChatMessage, setAgenticConfirmIdx, setAgenticConfig, finishAgenticConfirm]);

  const handleAgenticSkipConfirm = useCallback(() => {
    const { agenticConfirmItems: items, agenticConfirmIdx: idx } = useFlowAgentStore.getState();
    const nextIdx = idx + 1;
    if (nextIdx < items.length) {
      setAgenticConfirmIdx(nextIdx);
    } else {
      finishAgenticConfirm();
    }
  }, [setAgenticConfirmIdx, finishAgenticConfirm]);

  const handleAgenticSkipAllConfirm = useCallback(() => {
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: "跳过剩余确认项，使用 AI 推荐方案",
      timestamp: new Date().toISOString(),
    });
    finishAgenticConfirm();
  }, [addChatMessage, finishAgenticConfirm]);

  // ============================================================
  // Phase 3: Free chat (Workflow refine / Agentic refine)
  // ============================================================

  function buildReviewAssistantReply(userInput: string) {
    const nodeLabel = selectedNodeData?.label ?? "当前选中的节点";
    const modeLabelMap: Record<string, string> = {
      pending: "待确认",
      ai_auto: "AI 自动处理",
      human_confirm: "AI 处理后你确认",
      human_manual: "人工处理",
    };
    const mode = selectedNodeData?.executionMode
      ? modeLabelMap[selectedNodeData.executionMode] ?? selectedNodeData.executionMode
      : "未选择节点";
    const commentText = selectedNodeAnnotations.map((annotation) => annotation.content).join("\n");
    const fields = selectedNodeData?.requiredCheckFields?.length
      ? selectedNodeData.requiredCheckFields.join("、")
      : "暂无明确字段";

    if (!selectedNodeData) {
      return "你可以先点选中间流程图上的一个节点，我会结合该节点的技术批注、资料与产出、校对规则，帮你判断要补充什么。";
    }

    if (userInput.includes("回复") || userInput.includes("技术方")) {
      return `可以这样回复技术方：\n\n关于「${nodeLabel}」节点，我们会补充确认以下信息：${fields}。目前业务理解是：该节点处理方式为「${mode}」。如果技术方关注的是：${commentText || "暂无具体批注"}，我们会按实际业务规则补齐后再重新提交评审。`;
    }

    if (userInput.includes("补充") || userInput.includes("信息")) {
      return `这个节点建议先补充这几类信息：\n\n1. 需要校对的字段或材料：${fields}\n2. 当前处理方式是否符合实际：${mode}\n3. 技术批注中提到的规则或限制：${commentText || "暂无具体批注"}\n\n补充后可以点节点批注里的回复框，直接回给技术方。`;
    }

    if (userInput.includes("自动化") || userInput.includes("不能完全自动")) {
      return `「${nodeLabel}」当前被标记为「${mode}」。如果不是 AI 自动处理，通常是因为这一步可能涉及人工登录、外部系统限制、验证码、人工判断或最终确认。你可以把实际操作规则补充清楚，技术方再判断能否进一步自动化。`;
    }

    return `我对「${nodeLabel}」的理解是：这一步当前处理方式为「${mode}」。技术批注关注的是：${commentText || "暂无具体批注"}。如果你要修改，建议优先补齐校对规则和相关材料：${fields}，然后在节点批注里回复技术方。`;
  }

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || isLoading) return;
    const userInput = input.trim();
    const attachments = pendingFiles.length > 0 ? [...pendingFiles] : undefined;
    if (attachments?.length) {
      addJobMaterials(attachments);
    }
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: userInput || (attachments ? `上传了 ${attachments.length} 个文件` : ""),
      timestamp: new Date().toISOString(),
      attachments,
    });
    setInput("");
    setPendingFiles([]);

    const storeSnapshot = useFlowAgentStore.getState();
    if (storeSnapshot.isReviewMode && storeSnapshot.currentRole === "business") {
      const reply = buildReviewAssistantReply(userInput || "我需要补充哪些信息？");
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (storeSnapshot.isReviewMode) {
      useFlowAgentStore.getState().setIsReviewMode(false);
    }

    try {
      if (!hasFlow && !hasAgenticConfig && phase !== "questioning") {
        const draftPrompt =
          readinessPendingRef.current && originalPrompt.trim() && originalPrompt.trim() !== userInput.trim()
            ? `${originalPrompt}\n\n用户针对准入问题的补充：${userInput}`
            : userInput;
        readinessPendingRef.current = false;
        setReadinessQuestions([]);
        await triggerUnifiedDraft(draftPrompt, attachments);
        return;
      }

      // Workflow refine — tech uses full schema, business uses biz schema
      if (taskType === "workflow" && hasFlow && (phase === "ready" || phase === "questioning")) {
        setPhase("refining");
        const { nodes: currentNodes, edges: currentEdges, currentRole } =
          useFlowAgentStore.getState();
        const { json: canvasJson } = serializeFlowForLLM(currentNodes, currentEdges);
        const refineAction = currentRole === "tech" ? "refine" : "refine_business";

        const effectiveFiles = attachments && attachments.length > 0
          ? attachments
          : useFlowAgentStore.getState().jobMaterials;
        const requestFiles = serializeFilesForLLM(effectiveFiles);
        const filePaths = requestFiles.map((f) => f.path);
        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: refineAction,
            prompt: originalPrompt,
            currentFlow: canvasJson,
            feedback: userInput,
            filePaths,
            files: requestFiles,
          }),
          signal: AbortSignal.timeout(300000),
        });
        const result = await res.json();

        if (result.success && result.data) {
          const { projectName, nodes: parsedNodes, edges: parsedEdges } =
            parseLLMResponse(result.data);
          const businessNodes =
            refineAction === "refine_business"
              ? preserveExecutionModeFromCurrent(parsedNodes, currentNodes)
              : parsedNodes;
          const mergedNodes = mergeBusinessDetailFields(businessNodes, currentNodes);
          const nodeList = (result.data.nodes || [])
            .map((n: { label: string }, i: number) => `${i + 1}. **${n.label}**`)
            .join("\n");

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已更新流程图：\n\n${nodeList}\n\n还有需要调整的吗？`,
            timestamp: new Date().toISOString(),
          });

          loadGeneratedFlow(mergedNodes, parsedEdges);
          if (projectName) {
            useFlowAgentStore.setState((s) => ({
              project: { ...s.project, name: projectName },
            }));
          }

          const newLabelMap: Record<string, string> = {};
          for (const n of result.data.nodes || []) {
            newLabelMap[n.id] = n.label;
          }
          setNodeLabelMap(newLabelMap);
        } else {
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `修改失败：${result.error}`,
            timestamp: new Date().toISOString(),
          });
        }
        setPhase("ready");
        return;
      }

      // Agentic refine
      if (taskType === "agentic" && hasAgenticConfig && phase === "agentic_ready") {
        setPhase("refining_agentic");

        const effectiveFiles = attachments && attachments.length > 0
          ? attachments
          : useFlowAgentStore.getState().jobMaterials;
        const requestFiles = serializeFilesForLLM(effectiveFiles);
        const filePaths = requestFiles.map((f) => f.path);
        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "refine_agentic",
            prompt: originalPrompt,
            currentConfig: agenticConfig,
            feedback: userInput,
            filePaths,
            files: requestFiles,
          }),
          signal: AbortSignal.timeout(300000),
        });
        const result = await res.json();

        if (result.success && result.data) {
          const prev = agenticConfig!;
          const newConfig: AgenticTaskConfig = {
            goal: result.data.goal || prev.goal,
            background: result.data.background || prev.background,
            totalDays: result.data.totalDays || prev.totalDays,
            phases: result.data.phases || prev.phases,
            globalSuccessCriteria: result.data.globalSuccessCriteria || prev.globalSuccessCriteria,
            approvalPoints: result.data.approvalPoints || prev.approvalPoints,
            fallbacks: result.data.fallbacks || prev.fallbacks,
            constraints: result.data.constraints || prev.constraints,
            skills: result.data.skills || prev.skills,
            evaluators: result.data.evaluators || prev.evaluators,
            executionStrategy: result.data.executionStrategy || prev.executionStrategy,
            maxIterations: result.data.maxIterations || prev.maxIterations,
            humanCheckpoints: result.data.humanCheckpoints || prev.humanCheckpoints,
            goalMetrics: result.data.goalMetrics || prev.goalMetrics,
            executionRules: result.data.executionRules || prev.executionRules,
            permissions: result.data.permissions || prev.permissions,
            reporting: result.data.reporting || prev.reporting,
            contentPreview: result.data.contentPreview || prev.contentPreview,
            estimatedDuration: result.data.estimatedDuration || prev.estimatedDuration,
            estimatedEfficiency: result.data.estimatedEfficiency || prev.estimatedEfficiency,
            executionOverview: result.data.executionOverview || prev.executionOverview,
            riskAssessment: result.data.riskAssessment || prev.riskAssessment,
            decisionLoop: result.data.decisionLoop || prev.decisionLoop,
            skillOrchestration: result.data.skillOrchestration || prev.skillOrchestration,
            contextArchitecture: result.data.contextArchitecture || prev.contextArchitecture,
            schedule: result.data.schedule || prev.schedule,
          };
          setAgenticConfig(newConfig);

          if (result.projectName) {
            useFlowAgentStore.setState((s) => ({
              project: { ...s.project, name: result.projectName },
            }));
          }

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已更新任务配置。右侧面板已同步刷新，还有需要调整的吗？`,
            timestamp: new Date().toISOString(),
          });
        } else {
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `修改失败：${result.error}`,
            timestamp: new Date().toISOString(),
          });
        }
        setPhase("agentic_ready");
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "网络错误";
      toast.error("请求失败", { description: msg });
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `请求出错：${msg}`,
        timestamp: new Date().toISOString(),
      });
      if (hasAgenticConfig) {
        setPhase("agentic_ready");
      } else if (hasFlow) {
        setPhase("ready");
      } else {
        setPhase("idle");
      }
    }
  };

  // ============================================================
  // Render
  // ============================================================

  const renderMarkdown = (text: string, msgId: string) => {
    return text.split("\n").map((line, i) => {
      const isBlockquote = line.startsWith("> ");
      const isListItem = /^\d+\.\s/.test(line) || line.startsWith("- ");
      const content = isBlockquote ? line.slice(2) : line;

      const renderInline = (str: string) =>
        str.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={`${msgId}-b${i}-${j}`}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={`${msgId}-c${i}-${j}`} className="px-1 py-0.5 bg-zinc-200/60 rounded text-[12px] font-mono">{part.slice(1, -1)}</code>;
          return <span key={`${msgId}-t${i}-${j}`}>{part}</span>;
        });

      if (isBlockquote) {
        return (
          <span key={`${msgId}-l${i}`} className="block border-l-2 border-zinc-300 pl-2 my-1 text-zinc-500 italic text-xs">
            {renderInline(content)}
          </span>
        );
      }
      if (isListItem) {
        return (
          <span key={`${msgId}-l${i}`} className="block pl-2">
            {renderInline(line)}
          </span>
        );
      }
      return (
        <span key={`${msgId}-l${i}`}>
          {renderInline(content)}
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  const isErrorMessage = (content: string) =>
    content.startsWith("请求出错：") || content.startsWith("生成失败：") || content.startsWith("修改失败：") || content.startsWith("优化请求出错：") || content.startsWith("批量优化失败：");

  const renderMessage = (msg: ChatMessage) => (
    <div
      key={msg.id}
      className={`animate-slide-up ${msg.role === "user" ? "flex justify-end" : ""}`}
    >
      {msg.role === "user" ? (
        <div className="max-w-[88%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-800">
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {msg.attachments.map((f) => (
                <span key={f.storedName} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200/80 text-[11px] text-zinc-500">
                  {fileIcon(f.ext)}
                  <span className="truncate max-w-[120px]">{f.originalName}</span>
                </span>
              ))}
            </div>
          )}
          {renderMarkdown(msg.content, msg.id)}
        </div>
      ) : (
        <div className="text-[13px] leading-relaxed text-zinc-700">
          {renderMarkdown(msg.content, msg.id)}
          {isErrorMessage(msg.content) && originalPrompt && (
            <button
              onClick={() => triggerUnifiedDraft(originalPrompt)}
              className="flex items-center gap-1 mt-1.5 text-[11px] text-red-500 hover:text-red-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> 重试
            </button>
          )}
        </div>
      )}
    </div>
  );

  const phaseLabel: Record<ChatPhase, string> = {
    idle: "",
    classifying: "理解业务场景...",
    drafting: "整理业务流程草案...",
    questioning: "",
    refining_node: "优化节点中...",
    ready: "",
    refining: "修改流程图中...",
    drafting_agentic: "生成任务配置...",
    confirming_agentic: "",
    agentic_ready: "",
    refining_agentic: "修改任务配置...",
  };

  const placeholder: Record<ChatPhase, string> = {
    idle: "描述你的业务场景...",
    classifying: "理解中，请稍候...",
    drafting: "生成中，请稍候...",
    questioning: "先确认上方问题，或直接补充说明...",
    refining_node: "优化中，请稍候...",
    ready: "告诉我哪里需要修改...",
    refining: "修改中，请稍候...",
    drafting_agentic: "生成中，请稍候...",
    confirming_agentic: "也可以直接打字补充...",
    agentic_ready: "告诉我哪里需要调整...",
    refining_agentic: "修改中，请稍候...",
  };

  const showWelcome = chatMessages.length === 0 && phase === "idle" && !isBusinessReviewMode;
  const inputDisabled = isLoading;
  const reviewPlaceholder = selectedNodeData
    ? "问我这条批注、补充项或回复怎么写..."
    : "问我技术批注是什么意思，或让我帮你整理补充项...";
  const techPlaceholder = selectedNodeData
    ? "记录这个节点的技术判断、风险或需要业务补充的内容..."
    : "记录技术评审意见，或让我整理待补充问题...";
  const effectivePlaceholder = isBusinessReviewMode ? reviewPlaceholder : isTechReviewMode ? techPlaceholder : placeholder[phase];
  const reviewQuickQuestions = [
    "帮我解释这条技术批注",
    "我需要补充哪些信息？",
    "帮我写一段回复技术方的话",
    "这条批注涉及哪些资料和字段？",
  ];
  const draftQuickQuestions = [
    "帮我完善当前节点",
    "检查这个方案哪里还没说清楚",
    "帮我补充判断规则",
    "帮我做一次方案 Review",
  ];
  const techQuickQuestions = [
    "整理还缺哪些资源编码",
    "帮我写一条业务补充问题",
    "总结当前节点的技术风险",
    "检查导出前还缺什么",
  ];
  const shouldShowDraftAssistantIntro = !isInitialClarification && !isBusinessReviewMode && !isTechReviewMode && (chatMessages.length > 0 || hasFlow || hasAgenticConfig || phase === "idle");

  return (
    <div className="w-full border-r border-zinc-200 bg-white flex flex-col h-full flex-1 min-h-0" data-onboarding="chat-panel">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="px-4 py-5 space-y-5">
          {shouldShowDraftAssistantIntro && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-[13px] leading-6 text-blue-900">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">流程澄清助手</p>
                  <p className="mt-1 text-blue-700">
                    我负责把业务描述整理成可评审流程，帮你补齐节点说明、资料与产出、校对规则和结果输出标准；技术怎么落地会交给技术方判断。
                  </p>
                </div>
              </div>
              {showWelcome ? (
                <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-blue-700">
                  你可以直接描述业务场景，也可以上传表格、规则文件或流程材料。
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {draftQuickQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => setInput(question)}
                      className="block w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-left text-xs text-zinc-700 hover:border-blue-200 hover:bg-blue-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isBusinessReviewMode && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-[13px] leading-6 text-blue-900">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">批注理解助手</p>
                  <p className="mt-1 text-blue-700">
                    我基于技术批注、业务字段和当前方案上下文，帮你理解技术方想确认什么，并整理补充项和回复草稿；我不会替技术方做实现承诺。
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {reviewQuickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => setInput(question)}
                    className="block w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-left text-xs text-zinc-700 hover:border-blue-200 hover:bg-blue-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isTechReviewMode && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-3.5 py-3 text-[13px] leading-6 text-indigo-950">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">技术评审助手</p>
                  <p className="mt-1 text-indigo-700">
                    我帮你围绕当前流程整理技术评审意见、待注册资源、节点风险和需要业务方补充的问题；节点执行配置请在右侧技术工作区或点击画布节点填写。
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {techQuickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => setInput(question)}
                    className="block w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 text-left text-xs text-zinc-700 hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map(renderMessage)}

          {showReadinessCard && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-[13px] leading-6 text-blue-950">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">补充到可以生成草稿</p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    点选下面的选项会自动填到输入框，也可以直接用自己的话补充。
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {readinessQuestions.map((item, index) => {
                  const question = item.question || "";
                  return (
                    <div key={item.id || question || index} className="rounded-xl border border-blue-100 bg-white px-3 py-2.5">
                      <p className="text-xs font-medium text-zinc-800">{index + 1}. {question}</p>
                      {item.examples && item.examples.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.examples.map((example) => (
                            <button
                              key={`${question}-${example}`}
                              type="button"
                              onClick={() => appendReadinessAnswer(question, example)}
                              className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] leading-4 text-zinc-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              {example}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setInput("先按你的理解生成草稿，缺的内容后面再补。")}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  先生成草稿
                </button>
                <button
                  type="button"
                  onClick={() => setInput("")}
                  className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-blue-700 hover:bg-blue-50"
                >
                  我自己补充
                </button>
              </div>
            </div>
          )}

          {/* 集中追问卡：业务侧统一在左侧回答，可暂缓/跳过，再一次性更新流程 */}
          {hasPendingQuestions && (() => {
            const prioritized = (() => {
              if (!showNodeQuestions || !selectedNodeId) return pendingNodes;
              const selected = pendingNodes.find((n) => n.nodeId === selectedNodeId);
              if (!selected) return pendingNodes;
              return [selected, ...pendingNodes.filter((n) => n.nodeId !== selectedNodeId)];
            })();
            return (
              <div className="ml-9">
                {isInitialClarification && (
                  <div className="mb-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900">
                    <p className="font-semibold">第一版流程图已生成</p>
                    <p className="mt-0.5 text-blue-700">
                      还有 {prioritized.length} 个节点需要确认。确认后我会把这些信息合并进流程图；也可以全部跳过，后面再改。
                    </p>
                  </div>
                )}
                <NodeQuestionPage
                  pendingNodes={prioritized}
                  nodeLabelMap={nodeLabelMap}
                  onSubmitAll={(collected) => {
                    useFlowAgentStore.setState({ showNodeQuestions: false });
                    handleBatchSubmit(collected);
                  }}
                  onSkipAll={handleSkipAll}
                  onDeferNode={handleDeferNode}
                  disabled={isLoading}
                />
              </div>
            );
          })()}

          {showCompletion && (
            <div className="ml-9">
              <CompletionCard onDone={handleCompletionDone} />
            </div>
          )}

          {/* Agentic confirm card */}
          {currentAgenticConfirm && (
            <div className="ml-9">
              <AgenticConfirmCard
                key={currentAgenticConfirm.id}
                item={currentAgenticConfirm}
                itemIndex={agenticConfirmIdx}
                totalItems={agenticConfirmItems.length}
                onConfirm={handleAgenticConfirm}
                onSkip={handleAgenticSkipConfirm}
                onSkipAll={handleAgenticSkipAllConfirm}
              />
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{phaseLabel[phase]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-100 px-3 py-3">
        {/* Pending file chips */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingFiles.map((f) => (
              <div
                key={f.storedName}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100 text-xs text-zinc-600 max-w-[200px]"
              >
                {fileIcon(f.ext)}
                <span className="truncate flex-1">{f.originalName}</span>
                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 shrink-0">
                  {CATEGORY_LABEL[f.jobMaterialCategory ?? "uncategorized"]}
                </span>
                <span className="text-zinc-400 shrink-0">{formatFileSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(f.storedName)}
                  className="shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.ppt,.pptx,.xlsx,.xls,.docx,.txt,.csv,.md,.json,.png,.jpg,.jpeg"
            multiple
            onChange={handleFileSelect}
          />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={effectivePlaceholder}
            className="text-[13px] min-h-[44px] max-h-[120px] resize-none rounded-xl border-zinc-200 bg-zinc-50 pl-10 pr-10 focus:bg-white transition-colors"
            disabled={inputDisabled}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={inputDisabled || uploading}
              className="absolute left-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-30"
              title="上传文件"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64 p-1.5">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 py-1.5">上传为哪类方案材料？</DropdownMenuLabel>
                {UPLOAD_CATEGORIES.slice(0, 3).map((category) => {
                  const CategoryIcon = category.icon;
                  return (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => openFilePicker(category.id)}
                      className="items-start gap-2 px-2 py-2"
                    >
                      <CategoryIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-zinc-800">{category.title}</span>
                        <span className="block text-[11px] leading-4 text-zinc-400">{category.description}</span>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {UPLOAD_CATEGORIES.slice(3).map((category) => {
                  const CategoryIcon = category.icon;
                  return (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => openFilePicker(category.id)}
                      className="items-start gap-2 px-2 py-2"
                    >
                      <CategoryIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-zinc-800">{category.title}</span>
                        <span className="block text-[11px] leading-4 text-zinc-400">{category.description}</span>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={handleSend}
            disabled={(!input.trim() && pendingFiles.length === 0) || inputDisabled}
            className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white transition-opacity disabled:opacity-30 hover:bg-zinc-800"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
