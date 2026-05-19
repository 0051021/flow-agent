"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useFlowAgentStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  CheckCircle2, Send, Workflow, ChevronLeft,
  Briefcase, Code2, AlertTriangle, ArrowLeftRight,
  FileCheck, X, Download, FileJson, FileText, Image as ImageIcon,
} from "lucide-react";
import { serializeFlowForLLM } from "@/lib/flow-parser";
import { addDynamicReview } from "@/lib/mock-reviews";
import { AGENTIC_NOT_RELEVANT_ANSWER, type ProjectStatus, type UserRole, type FlowNodeData, type TechTabId, type Notification as AppNotification, type AgenticTaskConfig } from "@/lib/types";
import type { Node } from "@xyflow/react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TechGenerationProgress } from "@/components/layout/TechGenerationProgress";

const STATUS_LABELS: Record<ProjectStatus, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-zinc-100 text-zinc-600" },
  business_editing: { label: "业务方编辑中", className: "bg-blue-50 text-blue-700" },
  ai_generating: { label: "AI 生成技术方案中", className: "bg-indigo-50 text-indigo-700" },
  pending_review: { label: "待技术评审", className: "bg-amber-50 text-amber-700" },
  tech_reviewing: { label: "技术评审中", className: "bg-purple-50 text-purple-700" },
  needs_revision: { label: "需修改", className: "bg-red-50 text-red-700" },
  confirmed: { label: "双方确认", className: "bg-green-50 text-green-700" },
};

const ROLE_CONFIG: Record<UserRole, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; borderColor: string }> = {
  business: {
    label: "业务方",
    icon: Briefcase,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  tech: {
    label: "技术方",
    icon: Code2,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
};

type SchemeReviewStatus = "pass" | "warning" | "block";

type SchemeReviewItem = {
  label: string;
  status: SchemeReviewStatus;
  note: string;
};

type SchemeReviewSuggestion = {
  title: string;
  detail: string;
};

type SchemeReviewResult = {
  level: "ready" | "needs_attention" | "not_ready";
  title: string;
  summary: string;
  items: SchemeReviewItem[];
  suggestions: SchemeReviewSuggestion[];
};

function sanitizeAgenticConfigForReview(config: AgenticTaskConfig): AgenticTaskConfig {
  return {
    ...config,
    phases: config.phases.map((phase) => ({
      ...phase,
      questions: (phase.questions || []).filter((question) => question.answer !== AGENTIC_NOT_RELEVANT_ANSWER),
    })),
  };
}

function computeDiff(
  initial: Node<FlowNodeData>[] | undefined,
  current: Node<FlowNodeData>[]
): { label: string; field: string; from: string; to: string }[] {
  if (!initial || initial.length === 0) return [];
  const diffs: { label: string; field: string; from: string; to: string }[] = [];
  const initialMap = new Map(initial.map((n) => [n.id, n.data as unknown as FlowNodeData]));

  for (const n of current) {
    const cur = n.data as unknown as FlowNodeData;
    const orig = initialMap.get(n.id);
    if (!orig) {
      diffs.push({ label: cur.label, field: "节点", from: "—", to: "新增" });
      continue;
    }
    if (cur.executionMode !== orig.executionMode) {
      const modeLabels: Record<string, string> = { pending: "待技术选择", ai_auto: "AI 自动", human_confirm: "需人工确认", human_manual: "人工操作" };
      diffs.push({ label: cur.label, field: "executionMode", from: modeLabels[orig.executionMode] || orig.executionMode, to: modeLabels[cur.executionMode] || cur.executionMode });
    }
    if (cur.description !== orig.description) {
      diffs.push({ label: cur.label, field: "描述", from: orig.description.slice(0, 30) + "...", to: cur.description.slice(0, 30) + "..." });
    }
    if (cur.estimatedTime !== orig.estimatedTime) {
      diffs.push({ label: cur.label, field: "预估耗时", from: orig.estimatedTime, to: cur.estimatedTime });
    }
  }

  for (const n of initial) {
    const orig = n.data as unknown as FlowNodeData;
    if (!current.find((c) => c.id === n.id)) {
      diffs.push({ label: orig.label, field: "节点", from: "存在", to: "已删除" });
    }
  }
  return diffs;
}

function hasMeaningfulText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMeaningfulList(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    return Boolean(item);
  });
}

function nodeHasRuleOrOperation(data: FlowNodeData): boolean {
  return hasMeaningfulList(data.operationSteps)
    || hasMeaningfulList(data.executionRules)
    || hasMeaningfulText(data.checkRulesText)
    || hasMeaningfulText(data.doneCriteria)
    || hasMeaningfulList(data.agenticSpec?.aiActions)
    || hasMeaningfulText(data.agenticSpec?.riskBoundaries);
}

function buildSchemeReview(params: {
  taskType: "workflow" | "agentic";
  nodes: Node<FlowNodeData>[];
  agenticConfig: AgenticTaskConfig | null;
  unansweredCount: number;
  deferredCount: number;
}): SchemeReviewResult {
  const { taskType, nodes, agenticConfig, unansweredCount, deferredCount } = params;
  const items: SchemeReviewItem[] = [];
  const suggestions: SchemeReviewSuggestion[] = [];

  if (taskType === "agentic" && agenticConfig) {
    const phases = agenticConfig.phases || [];
    const phasesMissingAction = phases.filter((phase) => !hasMeaningfulList(phase.actions));
    const phasesMissingExit = phases.filter((phase) => !hasMeaningfulText(phase.exitCondition));

    items.push({
      label: "任务目标",
      status: hasMeaningfulText(agenticConfig.goal) ? "pass" : "block",
      note: hasMeaningfulText(agenticConfig.goal) ? "已说明要达成的业务目标。" : "还缺少一句清楚的任务目标。",
    });
    items.push({
      label: "阶段拆解",
      status: phases.length >= 2 ? "pass" : phases.length > 0 ? "warning" : "block",
      note: phases.length > 0 ? `已拆成 ${phases.length} 个阶段。` : "还没有形成可讨论的阶段。",
    });
    items.push({
      label: "每阶段动作",
      status: phasesMissingAction.length === 0 ? "pass" : "warning",
      note: phasesMissingAction.length === 0 ? "各阶段已有动作说明。" : `${phasesMissingAction.length} 个阶段还缺少具体动作。`,
    });
    items.push({
      label: "完成条件",
      status: phasesMissingExit.length === 0 ? "pass" : "warning",
      note: phasesMissingExit.length === 0 ? "各阶段已有退出或完成条件。" : `${phasesMissingExit.length} 个阶段还缺少完成条件。`,
    });

    if (phasesMissingAction.length > 0) {
      suggestions.push({
        title: "补充阶段动作",
        detail: `建议先补充：${phasesMissingAction.slice(0, 3).map((phase) => phase.name).join("、")}。`,
      });
    }
    if (phasesMissingExit.length > 0) {
      suggestions.push({
        title: "补充完成条件",
        detail: "说明每个阶段做到什么程度算完成，后续技术方才好定义停止条件和验收口径。",
      });
    }
  } else {
    const flowNodes = nodes.map((node) => node.data as unknown as FlowNodeData);
    const nodesMissingDescription = flowNodes.filter((node) => !hasMeaningfulText(node.description));
    const nodesMissingInputs = flowNodes.filter((node) => !hasMeaningfulList(node.inputs));
    const nodesMissingOutputs = flowNodes.filter((node) => !hasMeaningfulList(node.outputs));
    const nodesMissingRules = flowNodes.filter((node) => !nodeHasRuleOrOperation(node));
    const confirmationNodes = flowNodes.filter((node) => node.executionMode !== "ai_auto" || node.workUnitKind === "human_gate");

    items.push({
      label: "流程骨架",
      status: flowNodes.length >= 3 ? "pass" : flowNodes.length > 0 ? "warning" : "block",
      note: flowNodes.length > 0 ? `当前共有 ${flowNodes.length} 个节点。` : "还没有形成流程节点。",
    });
    items.push({
      label: "节点说明",
      status: nodesMissingDescription.length === 0 ? "pass" : "warning",
      note: nodesMissingDescription.length === 0 ? "每个节点都有说明。" : `${nodesMissingDescription.length} 个节点还缺少说明。`,
    });
    items.push({
      label: "资料与产出",
      status: nodesMissingInputs.length === 0 && nodesMissingOutputs.length === 0 ? "pass" : "warning",
      note: nodesMissingInputs.length === 0 && nodesMissingOutputs.length === 0
        ? "输入资料和输出结果基本清楚。"
        : `${nodesMissingInputs.length} 个节点缺输入，${nodesMissingOutputs.length} 个节点缺输出。`,
    });
    items.push({
      label: "判断规则/操作说明",
      status: nodesMissingRules.length === 0 ? "pass" : "warning",
      note: nodesMissingRules.length === 0 ? "关键操作或判断口径已有记录。" : `${nodesMissingRules.length} 个节点还缺少操作清单或判断规则。`,
    });
    items.push({
      label: "人工确认边界",
      status: confirmationNodes.length > 0 ? "pass" : "warning",
      note: confirmationNodes.length > 0 ? `已有 ${confirmationNodes.length} 个节点保留人工确认。` : "还没有标出哪些地方必须由人确认。",
    });

    if (nodesMissingInputs.length > 0 || nodesMissingOutputs.length > 0) {
      suggestions.push({
        title: "先补齐资料与产出",
        detail: `重点看：${[...new Set([...nodesMissingInputs, ...nodesMissingOutputs].map((node) => node.label))].slice(0, 4).join("、")}。`,
      });
    }
    if (nodesMissingRules.length > 0) {
      suggestions.push({
        title: "补充操作或判断口径",
        detail: `建议补充：${nodesMissingRules.slice(0, 4).map((node) => node.label).join("、")}。固定操作写 SOP，策略判断写看什么信息、怎么判断、什么情况升级。`,
      });
    }
    if (confirmationNodes.length === 0) {
      suggestions.push({
        title: "标出人工确认点",
        detail: "至少说明哪些节点需要业务人员确认、审批或兜底处理，避免技术方案误判为全自动。",
      });
    }
  }

  items.push({
    label: "待确认问题",
    status: unansweredCount === 0 && deferredCount === 0 ? "pass" : "warning",
    note: unansweredCount === 0 && deferredCount === 0
      ? "当前没有未答追问。"
      : `${unansweredCount} 个追问未答，${deferredCount} 个节点使用了默认建议。`,
  });

  if (unansweredCount > 0 || deferredCount > 0) {
    suggestions.push({
      title: "处理待确认问题",
      detail: "提交技术评审前，建议先回答追问或明确哪些内容可以暂按默认建议处理。",
    });
  }

  const blockCount = items.filter((item) => item.status === "block").length;
  const warningCount = items.filter((item) => item.status === "warning").length;
  if (suggestions.length === 0) {
    suggestions.push({
      title: "可以进入下一步",
      detail: "当前方案已经具备提交讨论的基础，可以继续确认方案或导出给相关同事看。",
    });
  }

  if (blockCount > 0) {
    return {
      level: "not_ready",
      title: "暂不建议提交",
      summary: "当前还缺少生成方案的基础信息，建议先补齐关键描述。",
      items,
      suggestions,
    };
  }

  if (warningCount > 0) {
    return {
      level: "needs_attention",
      title: "可继续，但建议补充",
      summary: "方案已经有骨架，但部分节点还缺资料、规则或确认边界。",
      items,
      suggestions,
    };
  }

  return {
    level: "ready",
    title: "基本可提交",
    summary: "方案结构、输入输出和规则信息较完整，可以进入确认或技术评审。",
    items,
    suggestions,
  };
}

export default function TopBar({ backHrefOverride }: { backHrefOverride?: string }) {
  const {
    project, currentRole,
    annotations,
    setProjectStatus, nodes,
    chatPhase, taskType, initialSnapshot, deferredNodeIds, edges, allNodeConfidence, collectedAnswers,
    currentReviewId, setCurrentReviewId, upsertBusinessSubmission, updateBusinessSubmission,
  } = useFlowAgentStore();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUnansweredReminder, setShowUnansweredReminder] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTechProgress, setShowTechProgress] = useState(false);
  const [showSchemeReview, setShowSchemeReview] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as globalThis.Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  const statusConfig = STATUS_LABELS[project.status];
  const roleConfig = ROLE_CONFIG[currentRole];
  const RoleIcon = roleConfig.icon;
  const unresolvedAnnotations = annotations.filter((a) => a.status !== "resolved").length;
  const { agenticConfig } = useFlowAgentStore();
  const isTech = currentRole === "tech";
  const hasFlow = nodes.length > 0;
  const hasContent = hasFlow || agenticConfig !== null;
  const [hydratedBackHref, setHydratedBackHref] = useState<string | null>(null);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const isDemoMode = params.has("demoId") && !params.has("reviewId");
      setHydratedBackHref(backHrefOverride ?? (isDemoMode ? "/" : isTech ? "/tech" : currentReviewId ? "/me" : "/"));
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [backHrefOverride, currentReviewId, isTech]);

  const backHref = hydratedBackHref ?? (isTech ? "/tech" : "/me");

  const patchServerSubmission = useCallback(async (submissionId: string, body: Record<string, unknown>) => {
    try {
      await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // keep local flow robust even if persistence fails
    }
  }, []);

  const snapshotToReview = useCallback(async () => {
    const store = useFlowAgentStore.getState();
    const isAgentic = store.taskType === "agentic";

    if (isAgentic && !store.agenticConfig) {
      toast.error("方案数据不完整，无法提交");
      return null;
    }
    if (!isAgentic && store.nodes.length === 0) {
      toast.error("流程图为空，无法提交");
      return null;
    }

    const cleanAgenticConfig = isAgentic && store.agenticConfig
      ? sanitizeAgenticConfigForReview(store.agenticConfig)
      : null;
    const fallbackId = `dynamic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nodeCount = isAgentic
      ? (store.agenticConfig?.phases?.length ?? 0)
      : store.nodes.length;
    const title = store.project.name || "未命名方案";
    const description = store.originalPrompt?.slice(0, 120) || "AI 生成的方案";

    let reviewId = fallbackId;
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          taskType: store.taskType,
          status: "ai_generating",
          submittedBy: "业务方 · 当前用户",
          prompt: store.originalPrompt || "",
          projectName: title,
          nodeCount,
          techProgress: { total: 5, done: 0, status: "running" },
          nodes: isAgentic ? undefined : JSON.parse(JSON.stringify(store.nodes)),
          edges: isAgentic ? undefined : JSON.parse(JSON.stringify(store.edges)),
          agenticConfig: isAgentic ? JSON.parse(JSON.stringify(cleanAgenticConfig)) : undefined,
          chatMessages: [...store.chatMessages],
        }),
      });
      const result = await res.json();
      if (result?.success && result?.item?.id) {
        reviewId = result.item.id as string;
      }
    } catch {
      // fallback to in-memory review id
    }

    addDynamicReview({
      id: reviewId,
      title: store.project.name || "未命名方案",
      type: store.taskType as "workflow" | "agentic",
      submittedBy: "业务方 · 当前用户",
      submittedAt: "刚刚",
      status: "pending",
      description: store.originalPrompt?.slice(0, 100) || "AI 生成的方案",
      nodeCount,
      prompt: store.originalPrompt || "",
      projectName: store.project.name || "未命名方案",
      ...(isAgentic
        ? { agenticConfig: JSON.parse(JSON.stringify(cleanAgenticConfig)) }
        : { nodes: JSON.parse(JSON.stringify(store.nodes)), edges: JSON.parse(JSON.stringify(store.edges)) }),
      chatMessages: [...store.chatMessages],
    });

    setCurrentReviewId(reviewId);
    upsertBusinessSubmission({
      id: reviewId,
      reviewId,
      title,
      description,
      taskType: store.taskType,
      status: "ai_generating",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      techProgress: { total: 5, done: 0, status: "running" },
    });

    return reviewId;
  }, [setCurrentReviewId, upsertBusinessSubmission]);

  const generateTechConfig = useCallback(async (submissionId?: string | null) => {
    const store = useFlowAgentStore.getState();
    const isWorkflow = store.taskType === "workflow";
    const trackedSubmissionId = submissionId || store.currentReviewId;

    if (trackedSubmissionId) {
      store.updateBusinessSubmission(trackedSubmissionId, { status: "ai_generating" });
      store.updateBusinessSubmissionProgress(trackedSubmissionId, {
        total: 5,
        done: 0,
        status: "running",
      });
    }

    if (isWorkflow && store.nodes.length > 0) {
      const { json: canvasJson } = serializeFlowForLLM(store.nodes, store.edges);

      store.resetTechConfig();

      const tabs: TechTabId[] = ["overview", "documents", "externals", "guards", "deployment"];

      tabs.forEach((tab) => store.setTechTabStatus(tab, "generating"));

      store.addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: "方案已提交，正在并行生成技术配置（流程总览、文档契约、外部系统、质量守护、部署配置）...",
        timestamp: new Date().toISOString(),
      });

      let completed = 0;
      const total = tabs.length;
      const results = await Promise.allSettled(
        tabs.map(async (tab) => {
          try {
            const res = await fetch("/api/generate-tech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: tab, flow: canvasJson, prompt: store.originalPrompt }),
              signal: AbortSignal.timeout(180000),
            });
            const result = await res.json();
            if (result.success && result.data) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const setters: Record<TechTabId, (data: any) => void> = {
                overview: store.setTechOverview,
                documents: store.setTechDocuments,
                externals: store.setTechExternals,
                guards: store.setTechGuards,
                deployment: store.setTechDeployment,
              };
              setters[tab](result.data);
              return { tab, success: true };
            } else {
              store.setTechTabStatus(tab, "error", result.error || "生成失败");
              return { tab, success: false, error: result.error };
            }
          } catch (err) {
            store.setTechTabStatus(tab, "error", err instanceof Error ? err.message : "网络错误");
            return { tab, success: false, error: String(err) };
          } finally {
            completed += 1;
            if (trackedSubmissionId) {
              const doneCount = Object.values(useFlowAgentStore.getState().techConfig.tabStates)
                .filter((state) => state.status === "ready").length;
              store.updateBusinessSubmissionProgress(trackedSubmissionId, {
                total,
                done: doneCount,
                status: completed >= total ? "done" : "running",
              });
              void patchServerSubmission(trackedSubmissionId, {
                techProgress: {
                  total,
                  done: doneCount,
                  status: completed >= total ? "done" : "running",
                },
                timelineEvent: {
                  actor: "system",
                  type: "tech_generation_progress",
                  message: `技术方案生成进度 ${doneCount}/${total}`,
                },
              });
            }
          }
        })
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;

      const notification: AppNotification = {
        id: uuidv4(),
        type: "tech_config_ready",
        title: "技术方案生成完成",
        content: `${successCount}/5 个模块已生成完成`,
        timestamp: new Date().toISOString(),
        read: false,
        relatedProject: store.project.name,
      };
      store.addNotification(notification);

      store.addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: successCount === 5
          ? "已为所有模块生成技术配置，技术方可开始评审。"
          : `技术配置生成完成（${successCount}/5 成功），部分模块可能需要手动补充。`,
        timestamp: new Date().toISOString(),
      });

      if (successCount > 0) {
        store.setProjectStatus("pending_review");
        if (trackedSubmissionId) {
          store.updateBusinessSubmission(trackedSubmissionId, { status: "pending_review" });
          store.updateBusinessSubmissionProgress(trackedSubmissionId, {
            total,
            done: successCount,
            status: "done",
          });
          void patchServerSubmission(trackedSubmissionId, {
            status: "pending_review",
            techProgress: { total, done: successCount, status: "done" },
            timelineEvent: {
              actor: "system",
              type: "tech_generation_done",
              message: `技术方案生成完成（${successCount}/${total}）`,
            },
            reviewLog: {
              actor: "system",
              action: "submitted",
              note: "技术配置生成完成，等待技术评审",
              statusAfter: "pending_review",
            },
          });
        }
        toast.success(`技术配置已生成（${successCount}/5）`);
      } else {
        if (trackedSubmissionId) {
          store.updateBusinessSubmissionProgress(trackedSubmissionId, {
            total,
            done: 0,
            status: "error",
          });
          void patchServerSubmission(trackedSubmissionId, {
            techProgress: { total, done: 0, status: "error" },
            timelineEvent: {
              actor: "system",
              type: "tech_generation_done",
              message: "技术方案生成失败",
            },
          });
        }
        toast.error("技术配置生成失败，请重试");
      }
    } else if (store.taskType === "agentic" && store.agenticConfig) {
      // Keep existing agentic logic unchanged
      const config = sanitizeAgenticConfigForReview(store.agenticConfig);
      if (config.skills.length === 0) {
        store.addChatMessage({ id: uuidv4(), role: "assistant", content: "方案已提交，正在自动生成技术配置...", timestamp: new Date().toISOString() });
        try {
          const res = await fetch("/api/generate-flow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "generate_tech", currentConfig: config }),
            signal: AbortSignal.timeout(180000),
          });
          const result = await res.json();
          if (result.success && result.data) {
            store.updateAgenticField("skills", result.data.skills || []);
            store.updateAgenticField("evaluators", result.data.evaluators || []);
            store.updateAgenticField("executionStrategy", result.data.executionStrategy || "adaptive");
            store.updateAgenticField("maxIterations", result.data.maxIterations || 5);
            store.updateAgenticField("humanCheckpoints", result.data.humanCheckpoints || []);
            if (result.data.decisionLoop) store.updateAgenticField("decisionLoop", result.data.decisionLoop);
            if (result.data.skillOrchestration) store.updateAgenticField("skillOrchestration", result.data.skillOrchestration);
            if (result.data.contextArchitecture) store.updateAgenticField("contextArchitecture", result.data.contextArchitecture);
            if (result.data.schedule) store.updateAgenticField("schedule", result.data.schedule);
            store.addChatMessage({ id: uuidv4(), role: "assistant", content: "已自动生成技术配置（Skills、决策循环、调度等），技术方可开始评审。", timestamp: new Date().toISOString() });
            store.setProjectStatus("pending_review");
            if (trackedSubmissionId) {
              store.updateBusinessSubmission(trackedSubmissionId, { status: "pending_review" });
              store.updateBusinessSubmissionProgress(trackedSubmissionId, { total: 1, done: 1, status: "done" });
              void patchServerSubmission(trackedSubmissionId, {
                status: "pending_review",
                techProgress: { total: 1, done: 1, status: "done" },
                timelineEvent: {
                  actor: "system",
                  type: "tech_generation_done",
                  message: "技术配置生成完成",
                },
              });
            }
            toast.success("技术配置已自动生成");
          } else {
            store.addChatMessage({ id: uuidv4(), role: "assistant", content: `技术配置自动生成失败（${result.error || "未知错误"}），技术方可手动补充。`, timestamp: new Date().toISOString() });
            if (trackedSubmissionId) {
              store.updateBusinessSubmissionProgress(trackedSubmissionId, { total: 1, done: 0, status: "error" });
              void patchServerSubmission(trackedSubmissionId, {
                techProgress: { total: 1, done: 0, status: "error" },
                timelineEvent: {
                  actor: "system",
                  type: "tech_generation_done",
                  message: "技术配置生成失败",
                },
              });
            }
          }
        } catch {
          if (trackedSubmissionId) {
            store.updateBusinessSubmissionProgress(trackedSubmissionId, { total: 1, done: 0, status: "error" });
            void patchServerSubmission(trackedSubmissionId, {
              techProgress: { total: 1, done: 0, status: "error" },
              timelineEvent: {
                actor: "system",
                type: "tech_generation_done",
                message: "技术配置生成失败",
              },
            });
          }
        }
      }
    }
  }, [patchServerSubmission]);

  const handleSubmitReview = async () => {
    if (project.status === "business_editing" || project.status === "draft") {
      const reviewId = await snapshotToReview();
      if (!reviewId) return;
      setProjectStatus("ai_generating");
      toast.success("已提交技术评审");
      setShowTechProgress(true);
      void patchServerSubmission(reviewId, {
        status: "ai_generating",
        timelineEvent: {
          actor: "business",
          type: "submitted",
          message: "业务方提交方案，开始生成技术实现",
        },
        reviewLog: {
          actor: "business",
          action: "submitted",
          note: "业务方提交评审",
          statusAfter: "ai_generating",
        },
      });
      void generateTechConfig(reviewId);
    }
  };

  const handleApprove = () => {
    setProjectStatus("confirmed");
    if (currentReviewId) {
      updateBusinessSubmission(currentReviewId, { status: "confirmed" });
      void patchServerSubmission(currentReviewId, {
        status: "confirmed",
        timelineEvent: {
          actor: "tech",
          type: "tech_review",
          message: "技术方评审通过",
        },
        reviewLog: {
          actor: "tech",
          action: "approved",
          note: "技术评审通过",
          statusAfter: "confirmed",
        },
      });
    }
    toast.success("评审已通过，方案已确认");
  };

  const handleReject = () => {
    setProjectStatus("needs_revision");
    if (currentReviewId) {
      updateBusinessSubmission(currentReviewId, { status: "needs_revision" });
      void patchServerSubmission(currentReviewId, {
        status: "needs_revision",
        timelineEvent: {
          actor: "tech",
          type: "tech_review",
          message: "技术方打回修改",
        },
        reviewLog: {
          actor: "tech",
          action: "rejected",
          note: "需业务方修改后重新提交",
          statusAfter: "needs_revision",
        },
      });
    }
    toast.info("已打回修改");
  };

  const handleResubmit = async () => {
    const reviewId = await snapshotToReview();
    if (!reviewId) return;
    setProjectStatus("ai_generating");
    toast.success("已重新提交评审");
    setShowTechProgress(true);
    void patchServerSubmission(reviewId, {
      status: "ai_generating",
      timelineEvent: {
        actor: "business",
        type: "submitted",
        message: "业务方重新提交方案",
      },
      reviewLog: {
        actor: "business",
        action: "resubmitted",
        note: "根据反馈修改后重新提交",
        statusAfter: "ai_generating",
      },
    });
    void generateTechConfig(reviewId);
  };

  const isEditableStatus =
    project.status === "draft" || project.status === "business_editing" || project.status === "needs_revision";
  const canConfirmWorkflow = hasFlow && taskType === "workflow" &&
    (chatPhase === "ready" || chatPhase === "questioning") &&
    isEditableStatus;
  const canConfirmAgentic = taskType === "agentic" && agenticConfig !== null &&
    chatPhase === "agentic_ready" &&
    isEditableStatus;
  const canConfirm = canConfirmWorkflow || canConfirmAgentic;
  const unansweredCount = allNodeConfidence.filter((nc) => {
    if (nc.confidence === "high" || !nc.questions || nc.questions.length === 0) return false;
    const answers = collectedAnswers[nc.nodeId] || [];
    return nc.questions.some((q) => !answers.some((a) => a.question === q.question && (a.answer || "").trim() !== ""));
  }).length;
  const schemeReview = buildSchemeReview({
    taskType: taskType as "workflow" | "agentic",
    nodes: nodes as Node<FlowNodeData>[],
    agenticConfig,
    unansweredCount,
    deferredCount: deferredNodeIds.length,
  });

  const diffs = showConfirmModal
    ? computeDiff(initialSnapshot?.nodes as Node<FlowNodeData>[] | undefined, nodes as Node<FlowNodeData>[])
    : [];

  const humanNodes = (nodes as Node<FlowNodeData>[]).filter(
    (n) => (n.data as unknown as FlowNodeData).executionMode !== "ai_auto"
  ).length;

  const handleConfirmScheme = async () => {
    const reviewId = await snapshotToReview();
    if (!reviewId) return;
    setProjectStatus("ai_generating");
    setShowConfirmModal(false);
    toast.success("方案已确认并提交技术评审");
    setShowTechProgress(true);
    void patchServerSubmission(reviewId, {
      status: "ai_generating",
      timelineEvent: {
        actor: "business",
        type: "submitted",
        message: "业务方确认方案并提交技术评审",
      },
      reviewLog: {
        actor: "business",
        action: "submitted",
        note: "业务方确认并提交",
        statusAfter: "ai_generating",
      },
    });
    void generateTechConfig(reviewId);
  };

  const openConfirmFlow = () => {
    if (unansweredCount > 0) {
      setShowUnansweredReminder(true);
      return;
    }
    setShowConfirmModal(true);
  };

  const handleExportJSON = () => {
    const isAg = taskType === "agentic";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {
      project: { name: project.name, status: project.status },
      taskType,
      exportedAt: new Date().toISOString(),
    };
    if (isAg && agenticConfig) {
      data.agenticConfig = sanitizeAgenticConfigForReview(agenticConfig);
    } else {
      data.nodes = (nodes as Node<FlowNodeData>[]).map((n) => ({
        id: n.id,
        label: (n.data as unknown as FlowNodeData).label,
        description: (n.data as unknown as FlowNodeData).description,
        executionMode: (n.data as unknown as FlowNodeData).executionMode,
        estimatedTime: (n.data as unknown as FlowNodeData).estimatedTime,
      }));
      data.edges = edges.map((e) => ({ source: e.source, target: e.target }));
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${project.name || "flowagent"}-scheme.json`);
    toast.success("已导出 JSON");
    setShowExportMenu(false);
  };

  const handleExportMarkdown = () => {
    const isAg = taskType === "agentic";
    const lines = [
      `# ${project.name || "FlowAgent 方案"}`,
      "",
      `**类型**：${isAg ? "智能体" : "工作流"}`,
    ];

    if (isAg && agenticConfig) {
      const cfg = sanitizeAgenticConfigForReview(agenticConfig);
      lines.push(
        `**目标**：${cfg.goal}`,
        `**周期**：${cfg.totalDays} 天`,
        `**阶段数**：${cfg.phases.length}`,
        "",
        "## 阶段列表",
        "",
        ...cfg.phases.map((p, i) => {
          const actions = (p.actions || []).map((a) => `  - ${a}`).join("\n");
          return `### ${i + 1}. ${p.name}\n\n- **天数**：D${(p.dayRange || [])[0] ?? "?"}-D${(p.dayRange || [])[1] ?? "?"}\n- **退出条件**：${p.exitCondition || "无"}\n- **动作**：\n${actions}\n`;
        }),
      );
    } else {
      const typedNodes = nodes as Node<FlowNodeData>[];
      lines.push(
        `**节点数**：${typedNodes.length}`,
        `**人工确认**：${typedNodes.filter((n) => (n.data as unknown as FlowNodeData).executionMode !== "ai_auto").length} 个`,
        "",
        "## 节点列表",
        "",
        ...typedNodes.map((n, i) => {
          const d = n.data as unknown as FlowNodeData;
          const modeLabel: Record<string, string> = { pending: "待技术选择", ai_auto: "AI 自动", human_confirm: "需人工确认", human_manual: "人工操作" };
          return `### ${i + 1}. ${d.label}\n\n- **描述**：${d.description}\n- **执行模式**：${modeLabel[d.executionMode] || d.executionMode}\n- **预估耗时**：${d.estimatedTime}\n`;
        }),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    downloadBlob(blob, `${project.name || "flowagent"}-scheme.md`);
    toast.success("已导出 Markdown");
    setShowExportMenu(false);
  };

  const handleExportImage = async () => {
    const canvas = document.querySelector(".react-flow") as HTMLElement | null;
    if (!canvas) { toast.error("未找到画布"); return; }
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(canvas, { backgroundColor: "#fafafa" });
      const link = document.createElement("a");
      link.download = `${project.name || "flowagent"}-scheme.png`;
      link.href = dataUrl;
      link.click();
      toast.success("已导出图片");
    } catch {
      toast.error("导出图片失败，请重试");
    }
    setShowExportMenu(false);
  };

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const headerBg = isTech ? "bg-slate-900" : "bg-white";
  const headerBorder = isTech ? "border-slate-700" : "border-zinc-200";
  const titleColor = isTech ? "text-white" : "text-zinc-900";
  const subtitleColor = isTech ? "text-slate-400" : "text-zinc-600";
  const schemeReviewTone = {
    ready: "border-green-200 bg-green-50 text-green-700",
    needs_attention: "border-amber-200 bg-amber-50 text-amber-700",
    not_ready: "border-red-200 bg-red-50 text-red-700",
  }[schemeReview.level];
  const schemeReviewDotClass: Record<SchemeReviewStatus, string> = {
    pass: "bg-green-500",
    warning: "bg-amber-500",
    block: "bg-red-500",
  };
  const schemeReviewStatusLabel: Record<SchemeReviewStatus, string> = {
    pass: "已具备",
    warning: "建议补充",
    block: "缺关键项",
  };

  return (
    <header className={`h-14 border-b ${headerBorder} ${headerBg} flex items-center justify-between px-4 shrink-0 transition-colors duration-300`}>
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className={`flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg transition-colors ${
            isTech ? "hover:bg-slate-800" : "hover:bg-zinc-100"
          }`}
        >
          <ChevronLeft className={`w-4 h-4 ${isTech ? "text-slate-400" : "text-zinc-400"}`} />
          <Workflow className={`w-5 h-5 ${titleColor}`} />
          <span className={`font-semibold text-sm ${titleColor}`}>FlowAgent</span>
        </Link>
        {project.name && (
          <>
            <span className={isTech ? "text-slate-600" : "text-zinc-300"}>/</span>
            <span className={`text-sm ${subtitleColor}`}>{project.name}</span>
          </>
        )}
        <Badge className={`text-[10px] h-5 ${statusConfig.className} border-0`}>
          {statusConfig.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {/* Role indicator + switch link */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${roleConfig.bgColor} ${roleConfig.borderColor}`}>
          <RoleIcon className={`w-3.5 h-3.5 ${roleConfig.color}`} />
          <span className={`text-xs font-semibold ${roleConfig.color}`}>{roleConfig.label}</span>
          <Link
            href={isTech ? "/" : "/tech"}
            className={`ml-1 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              isTech
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
            }`}
            title={isTech ? "切换到业务方视角" : "切换到技术方视角"}
          >
            <ArrowLeftRight className="w-3 h-3" />
            {isTech ? "业务方" : "技术方"}
          </Link>
        </div>

        <div className={`w-px h-6 ${isTech ? "bg-slate-700" : "bg-zinc-200"} mx-1`} />

        {isTech && unresolvedAnnotations > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-900/30 border border-purple-700/40 text-purple-300 text-xs">
            <MessageSquare className="w-3 h-3" />
            {unresolvedAnnotations} 条批注（点击节点查看）
          </span>
        )}

        <div className={`w-px h-6 ${isTech ? "bg-slate-700" : "bg-zinc-200"} mx-1`} />

        <NotificationBell isTech={isTech} />

        {currentRole === "business" && hasContent && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => setShowSchemeReview(true)}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 方案 Review
          </Button>
        )}

        {/* Export */}
        {hasContent && (
          <div className="relative" ref={exportRef}>
            <Button
              size="sm"
              variant="outline"
              className={`h-8 text-xs ${isTech ? "border-slate-600 text-slate-300 hover:bg-slate-800" : ""}`}
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> 导出
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-50">
                <button onClick={handleExportJSON} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50">
                  <FileJson className="w-3.5 h-3.5 text-blue-500" /> 导出为 JSON
                </button>
                <button onClick={handleExportMarkdown} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50">
                  <FileText className="w-3.5 h-3.5 text-green-500" /> 导出为 Markdown
                </button>
                <button onClick={handleExportImage} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-500" /> 导出为图片
                </button>
              </div>
            )}
          </div>
        )}

        {/* Context-aware actions */}
        {canConfirm && (
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={openConfirmFlow}>
            <FileCheck className="w-3.5 h-3.5 mr-1" /> 确认方案
          </Button>
        )}

        {currentRole === "business" && hasContent && !canConfirm && (project.status === "business_editing" || project.status === "draft") && (
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSubmitReview}>
            <Send className="w-3.5 h-3.5 mr-1" /> 提交技术评审
          </Button>
        )}

        {currentRole === "business" && project.status === "needs_revision" && (
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleResubmit}>
            <Send className="w-3.5 h-3.5 mr-1" /> 重新提交评审
          </Button>
        )}

        {currentRole === "tech" && project.status === "tech_reviewing" && (
          <>
            <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={handleReject}>
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> 打回修改
            </Button>
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleApprove}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 评审通过
            </Button>
          </>
        )}

        {project.status === "confirmed" && (
          <Badge className="text-xs h-7 bg-green-100 text-green-700 border-0 px-3">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 方案已确认
          </Badge>
        )}
      </div>

      {/* Scheme review */}
      {showSchemeReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[560px] max-h-[82vh] overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">方案 Review</h3>
                <p className="mt-1 text-xs text-zinc-500">提交前检查这份业务方案是否说清楚了。</p>
              </div>
              <button onClick={() => setShowSchemeReview(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-4">
              <div className={`rounded-xl border px-4 py-3 ${schemeReviewTone}`}>
                <p className="text-sm font-semibold">{schemeReview.title}</p>
                <p className="mt-1 text-xs leading-5">{schemeReview.summary}</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-800">检查项</p>
                <div className="space-y-2">
                  {schemeReview.items.map((item) => (
                    <div key={item.label} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${schemeReviewDotClass[item.status]}`} />
                          <span className="text-xs font-medium text-zinc-900">{item.label}</span>
                        </div>
                        <span className="shrink-0 text-[11px] text-zinc-500">{schemeReviewStatusLabel[item.status]}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-zinc-600">{item.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-800">建议下一步</p>
                <div className="space-y-2">
                  {schemeReview.suggestions.map((suggestion) => (
                    <div key={suggestion.title} className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                      <p className="text-xs font-medium text-blue-900">{suggestion.title}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-700">{suggestion.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-zinc-100 px-5 py-4">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => setShowSchemeReview(false)}>
                继续完善
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setShowSchemeReview(false);
                  openConfirmFlow();
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 去确认方案
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unanswered reminder */}
      {showUnansweredReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-[440px]">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">还有待确认信息</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-zinc-700">
                当前还有 <span className="font-semibold text-amber-600">{unansweredCount}</span> 个节点追问未补充，可能影响技术实现准确性。
              </p>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-zinc-100">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => setShowUnansweredReminder(false)}>
                继续补充
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setShowUnansweredReminder(false);
                  setShowConfirmModal(true);
                }}
              >
                直接确认提交
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm scheme modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">确认方案摘要</h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>方案名称</span>
                  <span className="font-medium text-zinc-900">{project.name || "未命名"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>类型</span>
                  <span className="font-medium text-zinc-900">
                    {taskType === "agentic"
                      ? `智能体（${agenticConfig?.phases?.length ?? 0} 个阶段）`
                      : `Workflow（${nodes.length} 个节点）`}
                  </span>
                </div>
                {taskType === "agentic" && agenticConfig ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>目标</span>
                    <span className="font-medium text-zinc-900 line-clamp-2">{agenticConfig.goal}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>人机分工</span>
                    <span className="font-medium text-zinc-900">{nodes.length - humanNodes} 个 AI 自动 / {humanNodes} 个人工确认</span>
                  </div>
                )}
                {deferredNodeIds.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-orange-600">
                    <span>⚠️ {deferredNodeIds.length} 个节点暂缓确认，方案使用了 AI 默认建议</span>
                  </div>
                )}
              </div>

              {diffs.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-700 mb-2">与 AI 初始版本的差异（{diffs.length} 处）</p>
                  <div className="space-y-1.5">
                    {diffs.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-100">
                        <span className="text-blue-600 shrink-0">✏️</span>
                        <div>
                          <span className="font-medium text-zinc-800">「{d.label}」</span>
                          <span className="text-zinc-500"> {d.field}：</span>
                          <span className="text-red-500 line-through">{d.from}</span>
                          <span className="text-zinc-400"> → </span>
                          <span className="text-green-600">{d.to}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diffs.length === 0 && (
                <p className="text-xs text-zinc-400">方案与 AI 初始版本一致，未做修改。</p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-zinc-100">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => setShowConfirmModal(false)}>
                取消
              </Button>
              <Button size="sm" className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700" onClick={handleConfirmScheme}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 确认方案
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTechProgress && (
        <TechGenerationProgress
          visible={showTechProgress}
          onClose={() => setShowTechProgress(false)}
          onStayOnPage={() => setShowTechProgress(false)}
          onGoToList={() => {
            setShowTechProgress(false);
            window.location.href = isTech ? "/tech" : "/me";
          }}
        />
      )}
    </header>
  );
}
