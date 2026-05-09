"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import TopBar from "@/components/layout/TopBar";
import ChatPanel from "@/components/panels/ChatPanel";
import AgenticConfigPanel from "@/components/panels/AgenticConfigPanel";
import AgenticCanvas from "@/components/panels/AgenticCanvas";
import KnowledgePanel from "@/components/panels/KnowledgePanel";
import NodeDetailPanel from "@/components/panels/NodeDetailPanel";
import TechWorkspacePanel from "@/components/panels/TechWorkspacePanel";
import TechNodePanel from "@/components/panels/TechNodePanel";
import OnboardingGuide from "@/components/ui/OnboardingGuide";
import { MessageSquare, PanelRightClose } from "lucide-react";
import { useFlowAgentStore } from "@/lib/store";
import { MOCK_ANNOTATIONS } from "@/lib/mock-data";
import { getReviewById } from "@/lib/mock-reviews";

const FlowCanvas = dynamic(() => import("@/components/flow/FlowCanvas"), { ssr: false });

function EditorContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const roleParam = searchParams.get("role");
  const reviewId = searchParams.get("reviewId");
  const timestamp = searchParams.get("t");
  const {
    project, showKnowledgePanel,
    selectedNodeId, taskType,
    currentRole, setCurrentRole, setViewMode,
  } = useFlowAgentStore();
  const initDoneRef = useRef(false);
  const reviewLoadedRef = useRef(false);

  useEffect(() => {
    if (reviewLoadedRef.current) return;
    reviewLoadedRef.current = true;

    if (reviewId) {
      const review = getReviewById(reviewId);
      if (!review) {
        useFlowAgentStore.getState().resetAll();
        return;
      }

      const statusMap = { pending: "tech_reviewing" as const, reviewed: "tech_reviewing" as const, confirmed: "confirmed" as const };
      const resolvedRole = roleParam === "tech" ? "tech" as const : "business" as const;
      const resolvedStatus = statusMap[review.status];

      useFlowAgentStore.getState().resetAll();

      const patch: Record<string, unknown> = {
        isReviewMode: true,
        currentRole: resolvedRole,
        viewMode: resolvedRole,
        originalPrompt: review.prompt,
        taskType: review.type,
        project: {
          ...useFlowAgentStore.getState().project,
          name: review.projectName,
          status: resolvedStatus,
        },
        chatMessages: review.chatMessages,
      };

      if (review.type === "workflow" && review.nodes && review.edges) {
        patch.nodes = review.nodes;
        patch.edges = review.edges;
        patch.chatPhase = "ready";
      } else if (review.type === "agentic" && review.agenticConfig) {
        patch.agenticConfig = review.agenticConfig;
        patch.chatPhase = "agentic_ready";
      }

      useFlowAgentStore.setState(patch);

    } else {
      const store = useFlowAgentStore.getState();
      store.setIsReviewMode(false);
      if (roleParam === "tech") {
        store.setCurrentRole("tech");
        store.setViewMode("tech");
      } else if (store.currentRole !== "tech" || store.nodes.length === 0) {
        store.setCurrentRole("business");
        store.setViewMode("business");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load from ?q= param (AI generation flow)
  useEffect(() => {
    if (reviewId) return;
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

    const savedFiles = [...store.initFiles];
    store.resetAll();
    if (savedFiles.length > 0) {
      useFlowAgentStore.getState().setInitFiles(savedFiles);
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
  }, [q, roleParam, reviewId]);

  // When tech role and flow/config is ready via AI, auto-set to tech_reviewing
  const techStatusRef = useRef(false);
  useEffect(() => {
    if (techStatusRef.current || reviewId) return;
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
  const showOnboarding = isFlowReady && !reviewId;
  const [onboardingDone, setOnboardingDone] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <TopBar />
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
                { label: "判断任务类型" },
                { label: "拆解工作步骤" },
                { label: "分配人机分工" },
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
              <p className="text-xs text-zinc-400 text-center pt-2">{isEnriching ? "正在补全每个节点的操作清单与关键字段" : "通常需要 10-20 秒"}</p>
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
        {showKnowledgePanel && <KnowledgePanel />}
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
  const editorKey = `${searchParams.get("q") || ""}-${searchParams.get("reviewId") || ""}-${searchParams.get("role") || ""}-${searchParams.get("t") || ""}`;
  return <EditorContent key={editorKey} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-zinc-400">加载中...</div>}>
      <EditorPageInner />
    </Suspense>
  );
}
