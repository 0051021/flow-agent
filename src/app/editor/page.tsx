"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import TopBar from "@/components/layout/TopBar";
import ChatPanel from "@/components/panels/ChatPanel";
import AgenticConfigPanel from "@/components/panels/AgenticConfigPanel";
import AgenticCanvas from "@/components/panels/AgenticCanvas";
import AnnotationPanel from "@/components/panels/AnnotationPanel";
import KnowledgePanel from "@/components/panels/KnowledgePanel";
import NodeDetailPanel from "@/components/panels/NodeDetailPanel";
import NodeEditDialog from "@/components/flow/NodeEditDialog";
import OnboardingGuide from "@/components/ui/OnboardingGuide";
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
    project, showAnnotationPanel, showKnowledgePanel,
    selectedNodeId, editingNodeId, taskType,
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
      } else {
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

    store.resetAll();
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
      store.setShowAnnotationPanel(true);
    }
  }, [project.status]);

  const { chatPhase } = useFlowAgentStore();
  const isAgentic = taskType === "agentic";
  const isGenerating = chatPhase === "drafting" || chatPhase === "classifying";
  const [chatOpen, setChatOpen] = useState(true);

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
        <div className={`${chatOpen ? "block" : "hidden"} lg:block fixed lg:relative left-0 top-0 bottom-0 lg:inset-auto z-20 lg:z-auto`}>
          <ChatPanel />
        </div>
        {isAgentic ? (
          currentRole === "tech" ? <AgenticConfigPanel /> : <AgenticCanvas />
        ) : isGenerating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-xl bg-zinc-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-zinc-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-500">AI 正在分析你的业务场景…</p>
              <p className="text-xs text-zinc-400">正在判断任务类型并生成方案</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <FlowCanvas />
            </div>
            {selectedNodeId && <NodeDetailPanel />}
          </div>
        )}
        {showAnnotationPanel && <AnnotationPanel />}
        {showKnowledgePanel && <KnowledgePanel />}
      </div>
      {editingNodeId && !isAgentic && <NodeEditDialog />}
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
