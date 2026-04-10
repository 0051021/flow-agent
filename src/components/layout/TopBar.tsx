"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useFlowAgentStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, MessageSquare,
  CheckCircle2, Send, Workflow, ChevronLeft,
  Briefcase, Code2, AlertTriangle, ArrowLeftRight,
  FileCheck, X, Download, FileJson, FileText, Image,
} from "lucide-react";
import { serializeFlowForLLM, mergeWorkflowTechConfig } from "@/lib/flow-parser";
import { addDynamicReview } from "@/lib/mock-reviews";
import type { ProjectStatus, UserRole, FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

const STATUS_LABELS: Record<ProjectStatus, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-zinc-100 text-zinc-600" },
  business_editing: { label: "业务方编辑中", className: "bg-blue-50 text-blue-700" },
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
      const modeLabels: Record<string, string> = { ai_auto: "AI 自动", human_confirm: "需人工确认", human_manual: "人工操作" };
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

export default function TopBar() {
  const {
    project, currentRole,
    annotations,
    showAnnotationPanel, setShowAnnotationPanel,
    showKnowledgePanel, setShowKnowledgePanel,
    setProjectStatus, nodes,
    chatPhase, taskType, initialSnapshot, deferredNodeIds, edges,
  } = useFlowAgentStore();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
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

  const backHref = isTech ? "/tech" : "/";

  const snapshotToReview = useCallback(() => {
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

    const reviewId = `dynamic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    addDynamicReview({
      id: reviewId,
      title: store.project.name || "未命名方案",
      type: store.taskType as "workflow" | "agentic",
      submittedBy: "业务方 · 当前用户",
      submittedAt: "刚刚",
      status: "pending",
      description: store.originalPrompt?.slice(0, 100) || "AI 生成的方案",
      nodeCount: isAgentic
        ? (store.agenticConfig?.phases?.length ?? 0)
        : store.nodes.length,
      prompt: store.originalPrompt || "",
      projectName: store.project.name || "未命名方案",
      ...(isAgentic
        ? { agenticConfig: JSON.parse(JSON.stringify(store.agenticConfig)) }
        : { nodes: JSON.parse(JSON.stringify(store.nodes)), edges: JSON.parse(JSON.stringify(store.edges)) }),
      chatMessages: [...store.chatMessages],
    });

    return reviewId;
  }, []);

  const generateTechConfig = useCallback(async () => {
    const store = useFlowAgentStore.getState();
    const isWorkflow = store.taskType === "workflow";
    const isAgentic = store.taskType === "agentic";

    if (isWorkflow && store.nodes.length > 0) {
      const { json: canvasJson } = serializeFlowForLLM(store.nodes, store.edges);
      store.addChatMessage({ id: uuidv4(), role: "assistant", content: "方案已提交，正在自动生成技术配置...", timestamp: new Date().toISOString() });
      try {
        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate_workflow_tech", currentFlow: canvasJson }),
          signal: AbortSignal.timeout(180000),
        });
        const result = await res.json();
        if (result.success && result.data?.nodes) {
          const merged = mergeWorkflowTechConfig(store.nodes, result.data.nodes);
          useFlowAgentStore.setState({ nodes: merged });
          store.addChatMessage({ id: uuidv4(), role: "assistant", content: `已为 ${result.data.nodes.length} 个节点自动生成技术配置，技术方可开始评审。`, timestamp: new Date().toISOString() });
          toast.success("技术配置已自动生成");
        } else {
          store.addChatMessage({ id: uuidv4(), role: "assistant", content: `技术配置自动生成失败（${result.error || "未知错误"}），技术方可手动补充。`, timestamp: new Date().toISOString() });
        }
      } catch { /* silent — tech can fill manually */ }
    } else if (isAgentic && store.agenticConfig) {
      const config = store.agenticConfig;
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
            toast.success("技术配置已自动生成");
          } else {
            store.addChatMessage({ id: uuidv4(), role: "assistant", content: `技术配置自动生成失败（${result.error || "未知错误"}），技术方可手动补充。`, timestamp: new Date().toISOString() });
          }
        } catch { /* silent */ }
      }
    }
  }, []);

  const handleSubmitReview = () => {
    if (project.status === "business_editing" || project.status === "draft") {
      snapshotToReview();
      setProjectStatus("tech_reviewing");
      toast.success("已提交技术评审");
      generateTechConfig();
    }
  };

  const handleApprove = () => {
    setProjectStatus("confirmed");
    toast.success("评审已通过，方案已确认");
  };

  const handleReject = () => {
    setProjectStatus("needs_revision");
    toast.info("已打回修改");
  };

  const handleResubmit = () => {
    snapshotToReview();
    setProjectStatus("tech_reviewing");
    toast.success("已重新提交评审");
    generateTechConfig();
  };

  const canConfirmWorkflow = hasFlow && taskType === "workflow" &&
    (chatPhase === "ready" || chatPhase === "questioning") &&
    project.status !== "confirmed";
  const canConfirmAgentic = taskType === "agentic" && agenticConfig !== null &&
    chatPhase === "agentic_ready" &&
    project.status !== "confirmed" && project.status !== "tech_reviewing";
  const canConfirm = canConfirmWorkflow || canConfirmAgentic;

  const diffs = showConfirmModal
    ? computeDiff(initialSnapshot?.nodes as Node<FlowNodeData>[] | undefined, nodes as Node<FlowNodeData>[])
    : [];

  const humanNodes = (nodes as Node<FlowNodeData>[]).filter(
    (n) => (n.data as unknown as FlowNodeData).executionMode !== "ai_auto"
  ).length;

  const handleConfirmScheme = () => {
    snapshotToReview();
    setProjectStatus("tech_reviewing");
    setShowConfirmModal(false);
    toast.success("方案已确认并提交技术评审");
    generateTechConfig();
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
      data.agenticConfig = agenticConfig;
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
      const cfg = agenticConfig;
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
          const modeLabel: Record<string, string> = { ai_auto: "AI 自动", human_confirm: "需人工确认", human_manual: "人工操作" };
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

  const knowledgeLabel = isTech ? "知识 & 技术参考" : "知识中心";

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

        {/* Panels toggle (mutually exclusive) */}
        <Button
          size="sm"
          variant={showKnowledgePanel ? "default" : "outline"}
          className={`h-8 text-xs ${isTech && !showKnowledgePanel ? "border-slate-600 text-slate-300 hover:bg-slate-800" : ""}`}
          onClick={() => {
            const next = !showKnowledgePanel;
            setShowKnowledgePanel(next);
            if (next) setShowAnnotationPanel(false);
          }}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1" /> {knowledgeLabel}
        </Button>
        {isTech && (
          <Button
            size="sm"
            variant={showAnnotationPanel ? "default" : "outline"}
            className={`h-8 text-xs relative ${!showAnnotationPanel ? "border-slate-600 text-slate-300 hover:bg-slate-800" : ""}`}
            onClick={() => {
              const next = !showAnnotationPanel;
              setShowAnnotationPanel(next);
              if (next) setShowKnowledgePanel(false);
            }}
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> 批注
            {unresolvedAnnotations > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {unresolvedAnnotations}
              </span>
            )}
          </Button>
        )}

        <div className={`w-px h-6 ${isTech ? "bg-slate-700" : "bg-zinc-200"} mx-1`} />

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
                  <Image className="w-3.5 h-3.5 text-purple-500" /> 导出为图片
                </button>
              </div>
            )}
          </div>
        )}

        {/* Context-aware actions */}
        {canConfirm && (
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => setShowConfirmModal(true)}>
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
    </header>
  );
}
