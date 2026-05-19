"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import TopBar from "@/components/layout/TopBar";
import AgenticConfigPanel from "@/components/panels/AgenticConfigPanel";
import AgenticCanvas from "@/components/panels/AgenticCanvas";
import NodeDetailPanel from "@/components/panels/NodeDetailPanel";
import TechWorkspacePanel from "@/components/panels/TechWorkspacePanel";
import TechNodePanel from "@/components/panels/TechNodePanel";
import OnboardingGuide from "@/components/ui/OnboardingGuide";
import { MessageSquare, PanelRightClose } from "lucide-react";
import { useFlowAgentStore, type ChatAttachment } from "@/lib/store";
import { MOCK_ANNOTATIONS } from "@/lib/mock-data";
import { getReviewById, presentAgenticReviewAsWorkflow } from "@/lib/mock-reviews";
import {
  GSDS_ADAPTIVE_CONFIG,
  GSDS_CHAT_MESSAGES,
  GSDS_EDGES,
  GSDS_JOB_TRIGGER_CODES,
  GSDS_NODES,
  GSDS_TECH_BINDINGS,
  GSDS_TECH_CONFIG,
  GSDS_TECH_JOB_META,
} from "@/lib/gsds-demo-seed";
import type { Annotation, FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

const FlowCanvas = dynamic(() => import("@/components/flow/FlowCanvas"), { ssr: false });
const ChatPanel = dynamic(() => import("@/components/panels/ChatPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col border-r border-zinc-200 bg-white">
      <div className="flex-1 p-4 text-xs text-zinc-400">正在加载助手...</div>
    </div>
  ),
});
const DEMO_NODE_Y_GAP = 360;

function normalizeWorkflowNodeLayout(nodes: unknown[] | undefined): unknown[] | undefined {
  if (!Array.isArray(nodes)) return nodes;
  const flowNodes = nodes as Node<FlowNodeData>[];
  const orderedIds = new Map(
    [...flowNodes]
      .sort((a, b) => {
        const aStep = typeof a.data?.stepIndex === "number" ? a.data.stepIndex : 0;
        const bStep = typeof b.data?.stepIndex === "number" ? b.data.stepIndex : 0;
        return aStep - bStep;
      })
      .map((node, index) => [node.id, index])
  );

  return flowNodes.map((node) => {
    const index = orderedIds.get(node.id) ?? 0;
    return {
      ...node,
      position: {
        x: node.position?.x ?? 300,
        y: index * DEMO_NODE_Y_GAP,
      },
    };
  });
}

function cloneStateValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function readJobMaterialsFromSession(runId: string | null): ChatAttachment[] {
  if (!runId || typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(`flow-agent-job-materials:${runId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as ChatAttachment[]) : [];
  } catch {
    return [];
  }
}

function isGsdsReview(payload: { id: string; title?: string; projectName?: string }) {
  return (
    payload.id === "sample-gsds-20260508" ||
    payload.title === "GSDS PDF 自动入库流程" ||
    payload.projectName === "GSDS PDF 自动入库流程"
  );
}

function extractAnnotationsFromTimeline(timeline: unknown[]): Annotation[] {
  return timeline.flatMap((event) => {
    if (!event || typeof event !== "object") return [];
    const e = event as {
      id?: unknown;
      at?: unknown;
      actor?: unknown;
      meta?: { nodeComments?: unknown };
    };
    const raw = e.meta?.nodeComments;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((comment, index) => {
      if (!comment || typeof comment !== "object") return [];
      const c = comment as { nodeId?: unknown; content?: unknown };
      if (typeof c.nodeId !== "string" || typeof c.content !== "string") return [];
      const role = e.actor === "business" ? "business" : "tech";
      return [{
        id: `${String(e.id ?? "timeline")}-${c.nodeId}-${index}`,
        nodeId: c.nodeId,
        author: {
          name: role === "tech" ? "技术方" : "业务方",
          role,
        },
        content: c.content,
        attachments: [],
        status: "pending",
        createdAt: typeof e.at === "string" ? e.at : new Date().toISOString(),
        replies: [],
      } satisfies Annotation];
    });
  });
}

function EditorContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const roleParam = searchParams.get("role");
  const reviewId = searchParams.get("reviewId");
  const demoId = searchParams.get("demoId");
  const timestamp = searchParams.get("t");
  const {
    project,
    selectedNodeId, taskType,
    currentRole,
  } = useFlowAgentStore();
  const initDoneRef = useRef(false);
  const reviewLoadedRef = useRef(false);

  useEffect(() => {
    if (reviewLoadedRef.current) return;
    reviewLoadedRef.current = true;

    if (demoId && !reviewId) {
      const demo = getReviewById(demoId);
      const store = useFlowAgentStore.getState();
      store.resetAll();
      store.setIsReviewMode(false);
      store.setCurrentReviewId(null);
      store.setCurrentRole("business");
      store.setViewMode("business");

      if (!demo) return;

      const workflowPresentation = demo.type === "agentic" ? presentAgenticReviewAsWorkflow(demo) : null;
      const patch: Record<string, unknown> = {
        originalPrompt: demo.prompt,
        taskType: workflowPresentation ? "workflow" : demo.type,
        project: {
          ...useFlowAgentStore.getState().project,
          name: demo.projectName,
          status: "business_editing",
        },
        chatMessages: workflowPresentation?.chatMessages ?? demo.chatMessages,
        annotations: [],
      };

      if (workflowPresentation) {
        patch.nodes = normalizeWorkflowNodeLayout(workflowPresentation.nodes);
        patch.edges = workflowPresentation.edges;
        patch.chatPhase = "ready";
      } else if (demo.type === "workflow" && demo.nodes && demo.edges) {
        patch.nodes = normalizeWorkflowNodeLayout(demo.nodes);
        patch.edges = demo.edges;
        patch.chatPhase = "ready";
      } else if (demo.type === "agentic" && demo.agenticConfig) {
        patch.agenticConfig = demo.agenticConfig;
        patch.chatPhase = "agentic_ready";
      }

      useFlowAgentStore.setState(patch);
      return;
    }

    if (!reviewId) {
      const store = useFlowAgentStore.getState();
      store.setIsReviewMode(false);
      store.setCurrentReviewId(null);
      if (roleParam === "tech") {
        store.setCurrentRole("tech");
        store.setViewMode("tech");
      } else if (store.currentRole !== "tech" || store.nodes.length === 0) {
        store.setCurrentRole("business");
        store.setViewMode("business");
      }
      return;
    }

    const resolvedRole = roleParam === "tech" ? "tech" as const : "business" as const;

    const applyReviewData = (
      payload: {
        id: string;
        status: string;
        prompt: string;
        type: "workflow" | "agentic";
        projectName: string;
        chatMessages: unknown[];
        nodes?: unknown[];
        edges?: unknown[];
        agenticConfig?: unknown;
        timeline?: unknown[];
      },
      source: "mock" | "server"
    ) => {
      const statusMap = { pending: "tech_reviewing" as const, reviewed: "tech_reviewing" as const, confirmed: "confirmed" as const };
      const useGsdsDemo = payload.type === "workflow" && resolvedRole === "tech" && isGsdsReview(payload);
      const fallbackStatus =
        resolvedRole === "tech"
          ? (payload.status === "confirmed" ? "confirmed" as const : "tech_reviewing" as const)
          : (payload.status as "draft" | "business_editing" | "ai_generating" | "pending_review" | "tech_reviewing" | "needs_revision" | "confirmed");
      const resolvedStatus =
        source === "mock"
          ? statusMap[payload.status as keyof typeof statusMap] ?? "tech_reviewing"
          : fallbackStatus;

      useFlowAgentStore.getState().resetAll();

      const patch: Record<string, unknown> = {
        isReviewMode: true,
        currentReviewId: payload.id,
        currentRole: resolvedRole,
        viewMode: resolvedRole,
        originalPrompt: payload.prompt,
        taskType: payload.type,
        project: {
          ...useFlowAgentStore.getState().project,
          name: payload.projectName,
          status: resolvedStatus,
        },
        chatMessages: payload.chatMessages,
        annotations: extractAnnotationsFromTimeline(payload.timeline ?? []),
      };

      if (useGsdsDemo) {
        Object.assign(patch, {
          project: {
            ...useFlowAgentStore.getState().project,
            name: "GSDS 入库 Job",
            description: "上传并查重（条件分支）→ PDF 解析（含校验）→ 人工比对 → 入库",
            status: resolvedStatus,
          },
          originalPrompt: "GSDS 入库流程",
          nodes: cloneStateValue(GSDS_NODES),
          edges: cloneStateValue(GSDS_EDGES),
          chatMessages: cloneStateValue(GSDS_CHAT_MESSAGES),
          techConfig: cloneStateValue(GSDS_TECH_CONFIG),
          techBindings: cloneStateValue(GSDS_TECH_BINDINGS),
          adaptiveConfig: cloneStateValue(GSDS_ADAPTIVE_CONFIG),
          techJobMeta: cloneStateValue(GSDS_TECH_JOB_META),
          jobTriggerCodes: [...GSDS_JOB_TRIGGER_CODES],
          chatPhase: "ready",
        });
        useFlowAgentStore.setState(patch);
        return;
      }

      const localPayloadReview = source === "mock" ? getReviewById(payload.id) : undefined;
      const businessWorkflowPresentation =
        resolvedRole === "business" && localPayloadReview?.type === "agentic"
          ? presentAgenticReviewAsWorkflow(localPayloadReview)
          : null;

      if (businessWorkflowPresentation) {
        patch.taskType = "workflow";
        patch.nodes = normalizeWorkflowNodeLayout(businessWorkflowPresentation.nodes);
        patch.edges = businessWorkflowPresentation.edges;
        patch.chatMessages = businessWorkflowPresentation.chatMessages;
        patch.chatPhase = "ready";
      } else if (payload.type === "workflow" && payload.nodes && payload.edges) {
        patch.nodes = normalizeWorkflowNodeLayout(payload.nodes);
        patch.edges = payload.edges;
        patch.chatPhase = "ready";
      } else if (payload.type === "agentic" && payload.agenticConfig) {
        patch.agenticConfig = payload.agenticConfig;
        patch.chatPhase = "agentic_ready";
      }

      useFlowAgentStore.setState(patch);
    };

    const localReview = getReviewById(reviewId);
    if (localReview) {
      applyReviewData(localReview, "mock");
      return;
    }

    let cancelled = false;
    const loadServerReview = async () => {
      try {
        const res = await fetch(`/api/submissions/${reviewId}`);
        const result = await res.json();
        if (cancelled) return;
        if (result?.success && result?.item) {
          applyReviewData(
            {
              id: result.item.id,
              status: result.item.status,
              prompt: result.item.prompt,
              type: result.item.taskType,
              projectName: result.item.projectName,
              chatMessages: result.item.chatMessages || [],
              nodes: result.item.nodes,
              edges: result.item.edges,
              agenticConfig: result.item.agenticConfig,
              timeline: result.item.timeline || [],
            },
            "server"
          );
          return;
        }
      } catch {
        // fallback below
      }
      useFlowAgentStore.getState().resetAll();
    };
    void loadServerReview();
    return () => {
      cancelled = true;
    };
  }, [demoId, reviewId, roleParam]);

  // Load from ?q= param (AI generation flow)
  useEffect(() => {
    if (reviewId || demoId) return;
    if (!q || initDoneRef.current) return;

    const store = useFlowAgentStore.getState();

    const isFreshRequest = !!timestamp;
    const wasReviewData = store.isReviewMode;
    const alreadyHasThisFlow =
      !isFreshRequest &&
      !wasReviewData &&
      store.originalPrompt === q &&
      (store.nodes.length > 0 || store.agenticConfig !== null);

    if (alreadyHasThisFlow) {
      initDoneRef.current = true;
      store.setIsReviewMode(false);
      if (roleParam !== "tech") {
        store.setCurrentRole("business");
        store.setViewMode("business");
        if (store.project.status === "tech_reviewing") {
          store.setProjectStatus("business_editing");
        }
      } else if (store.project.status !== "tech_reviewing" && store.project.status !== "confirmed") {
        store.setProjectStatus("tech_reviewing");
      }
      return;
    }

    const sessionFiles = readJobMaterialsFromSession(timestamp);
    const currentJobFiles = store.originalPrompt === q ? store.jobMaterials : [];
    const savedFiles = store.initFiles.length > 0
      ? [...store.initFiles]
      : sessionFiles.length > 0
        ? sessionFiles
        : currentJobFiles;
    store.resetAll();
    store.setCurrentReviewId(null);
    if (savedFiles.length > 0) {
      useFlowAgentStore.getState().setInitFiles(savedFiles);
      useFlowAgentStore.getState().setJobMaterials(savedFiles);
    }
    store.setIsReviewMode(false);

    if (roleParam === "tech") {
      useFlowAgentStore.getState().setCurrentRole("tech");
      useFlowAgentStore.getState().setViewMode("tech");
    } else {
      useFlowAgentStore.getState().setCurrentRole("business");
      useFlowAgentStore.getState().setViewMode("business");
    }

    const timerId = setTimeout(() => {
      if (initDoneRef.current) return;
      initDoneRef.current = true;
      const s = useFlowAgentStore.getState();
      s.addChatMessage({
        id: "init-user",
        role: "user",
        content: q,
        timestamp: new Date().toISOString(),
        attachments: savedFiles.length > 0 ? savedFiles : undefined,
      });
      s.setInitQuery(q);
    }, 0);
    return () => clearTimeout(timerId);
  }, [demoId, q, roleParam, reviewId, timestamp]);

  // When tech role and flow/config is ready via AI, auto-set to tech_reviewing
  const techStatusRef = useRef(false);
  useEffect(() => {
    if (techStatusRef.current || reviewId || demoId) return;
    if (roleParam !== "tech") return;
    const store = useFlowAgentStore.getState();
    const hasContent = store.nodes.length > 0 || store.agenticConfig !== null;
    const isReadyPhase = store.chatPhase === "ready" || store.chatPhase === "agentic_ready";
    if (hasContent && isReadyPhase && store.project.status !== "tech_reviewing" && store.project.status !== "confirmed") {
      techStatusRef.current = true;
      store.setProjectStatus("tech_reviewing");
    }
  });

  const annotationsLoadedRef = useRef(false);
  useEffect(() => {
    const store = useFlowAgentStore.getState();
    if (
      project.status === "tech_reviewing" &&
      store.currentRole === "tech" &&
      !annotationsLoadedRef.current
    ) {
      annotationsLoadedRef.current = true;
      const isAgenticMode = store.taskType === "agentic";
      MOCK_ANNOTATIONS.forEach((a) => {
        const adjusted = isAgenticMode ? { ...a, nodeId: "__global__" } : a;
        store.addAnnotation(adjusted);
      });
    }
  }, [project.status]);

  const { chatPhase, nodes: storeNodes, generationStage, enrichProgress } = useFlowAgentStore();
  const isAgentic = taskType === "agentic";
  const hasNodes = storeNodes.length > 0;
  const isGenerating = (chatPhase === "drafting" || chatPhase === "classifying") && !hasNodes;
  const isEnriching = enrichProgress.status === "running";
  const [chatOpen, setChatOpen] = useState(true);
  /** Desktop: collapse chat rail (mobile uses chatOpen only) */
  const [chatRailExpanded, setChatRailExpanded] = useState(true);
  /** Desktop: collapse tech workspace panel */
  const [techRailExpanded, setTechRailExpanded] = useState(true);

  const stageOrder: Array<"classify_start" | "classify_done" | "draft_start" | "draft_done"> = [
    "classify_start",
    "classify_done",
    "draft_start",
    "draft_done",
  ];
  const progressStep = generationStage === "idle"
    ? 0
    : Math.max(1, stageOrder.indexOf(generationStage as (typeof stageOrder)[number]) + 1);

  // 新手引导：方案生成完成后触发（仅首次、非 review 模式）
  const isFlowReady = chatPhase === "ready" || chatPhase === "agentic_ready";
  const showOnboarding = isFlowReady && !reviewId && !demoId;
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [topBarBackHrefOverride, setTopBarBackHrefOverride] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setTopBarBackHrefOverride(demoId && !reviewId ? "/" : undefined);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [demoId, reviewId]);

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <TopBar backHrefOverride={topBarBackHrefOverride} />
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile chat toggle */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="lg:hidden fixed bottom-4 left-4 z-30 w-12 h-12 rounded-full bg-zinc-900 text-white shadow-lg flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={chatOpen ? "M6 18L18 6M6 6l12 12" : "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"} />
          </svg>
        </button>
        {/* Mobile backdrop */}
        {chatOpen && (
          <div
            className="lg:hidden fixed inset-0 z-10 bg-black/30"
            onClick={() => setChatOpen(false)}
          />
        )}
        <div
          className={`${chatOpen ? "block" : "hidden"} lg:flex lg:flex-col fixed lg:relative left-0 top-0 bottom-0 lg:inset-auto lg:self-stretch z-20 lg:z-auto flex shrink-0 transition-[width] duration-200 ease-out border-r border-zinc-200 bg-white ${
            chatRailExpanded ? "lg:w-[min(420px,38vw)] w-[min(100vw-2rem,24rem)]" : "lg:w-11 w-[min(100vw-2rem,24rem)]"
          }`}
        >
          {!chatRailExpanded ? (
            <button
              type="button"
              title="展开对话"
              className="hidden lg:flex w-11 h-full shrink-0 flex-col items-center pt-4 gap-2 bg-zinc-50 hover:bg-zinc-100 border-0 cursor-pointer text-zinc-500"
              onClick={() => setChatRailExpanded(true)}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px] leading-tight [writing-mode:vertical-rl]">对话</span>
            </button>
          ) : null}
          <div
            className={`flex-1 min-h-0 min-w-0 relative flex flex-col ${!chatRailExpanded ? "hidden lg:hidden" : ""}`}
          >
            <button
              type="button"
              title="收起对话"
              className="hidden lg:flex absolute top-2 right-2 z-30 h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 shadow-sm"
              onClick={() => setChatRailExpanded(false)}
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
            <ChatPanel />
          </div>
        </div>
        {isAgentic ? (
          currentRole === "tech" ? <AgenticConfigPanel /> : <AgenticCanvas />
        ) : isGenerating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-72 space-y-5">
              {[
                { label: "理解你的业务场景" },
                { label: "判断准入信息" },
                { label: "拆解业务步骤" },
                { label: "生成业务方案" },
              ].map((step, i) => {
                const idx = i + 1;
                const isDone = progressStep > idx || (progressStep >= 4 && idx <= 4);
                const isActive = progressStep === idx && progressStep < 4;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                      isDone ? "bg-green-100 text-green-600" : isActive ? "bg-blue-100 text-blue-500" : "bg-zinc-100 text-zinc-300"
                    }`}>
                      {isDone ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-zinc-300" />
                      )}
                    </div>
                    <span className={`text-sm transition-all duration-500 ${
                      isDone ? "text-green-600 font-medium" : isActive ? "text-zinc-700 font-medium" : "text-zinc-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
              {isEnriching && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-100 text-blue-500">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <span className="text-sm text-zinc-700 font-medium">
                    补全操作清单（{enrichProgress.done}/{enrichProgress.total || 0}）
                  </span>
                </div>
              )}
              <p className="text-xs text-zinc-400 text-center pt-2">{isEnriching ? "正在补全每个节点的操作清单与校对规则" : "通常需要 10-20 秒"}</p>
            </div>
          </div>
        ) : currentRole === "tech" ? (
          <div className="flex-1 flex min-w-0 overflow-hidden">
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col border-r border-zinc-200">
              <FlowCanvas />
            </div>
            {techRailExpanded ? (
              <div className="relative w-[min(560px,46%)] max-w-[min(560px,46vw)] shrink-0 flex flex-col min-h-0 min-w-[280px] border-l border-indigo-100/60 bg-gradient-to-b from-[#f8f9ff] to-[#f0f1fa]">
                <button
                  type="button"
                  title="收起技术工作区"
                  className="hidden lg:flex absolute left-2 top-2 z-30 h-7 w-7 items-center justify-center rounded-lg border border-indigo-200/50 bg-white/70 backdrop-blur-sm text-indigo-400 hover:bg-white/90 shadow-sm"
                  onClick={() => setTechRailExpanded(false)}
                >
                  <PanelRightClose className="w-4 h-4 rotate-180" />
                </button>
                {selectedNodeId ? <TechNodePanel /> : <TechWorkspacePanel />}
              </div>
            ) : (
              <button
                type="button"
                title="展开技术工作区"
                className="hidden lg:flex w-11 shrink-0 flex-col items-center pt-4 gap-2 bg-gradient-to-b from-[#f8f9ff] to-[#f0f1fa] border-l border-indigo-100/60 text-indigo-400 hover:bg-indigo-50/50"
                onClick={() => setTechRailExpanded(true)}
              >
                <span className="text-[10px] leading-tight [writing-mode:vertical-rl]">技术区</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
              {isEnriching && (
                <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-blue-200 bg-white/95 px-2.5 py-1.5 shadow-sm">
                  <svg className="w-3.5 h-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-[11px] text-zinc-700">
                    补全操作清单 {enrichProgress.done}/{enrichProgress.total || 0}
                  </span>
                </div>
              )}
              <FlowCanvas />
            </div>
            {selectedNodeId && <NodeDetailPanel />}
          </div>
        )}
      </div>
      <OnboardingGuide
        visible={showOnboarding && !onboardingDone}
        onDone={() => setOnboardingDone(true)}
      />
    </div>
  );
}

function EditorPageInner() {
  const searchParams = useSearchParams();
  const editorKey = `${searchParams.get("q") || ""}-${searchParams.get("reviewId") || ""}-${searchParams.get("demoId") || ""}-${searchParams.get("role") || ""}-${searchParams.get("t") || ""}`;
  return <EditorContent key={editorKey} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-zinc-400">加载中...</div>}>
      <EditorPageInner />
    </Suspense>
  );
}
