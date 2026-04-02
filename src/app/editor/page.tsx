"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import TopBar from "@/components/layout/TopBar";
import ChatPanel from "@/components/panels/ChatPanel";
import AgenticConfigPanel from "@/components/panels/AgenticConfigPanel";
import AnnotationPanel from "@/components/panels/AnnotationPanel";
import KnowledgePanel from "@/components/panels/KnowledgePanel";
import NodeDetailPanel from "@/components/panels/NodeDetailPanel";
import NodeEditDialog from "@/components/flow/NodeEditDialog";
import { useFlowAgentStore } from "@/lib/store";
import { MOCK_ANNOTATIONS } from "@/lib/mock-data";
import { getReviewById } from "@/lib/mock-reviews";

const FlowCanvas = dynamic(() => import("@/components/flow/FlowCanvas"), { ssr: false });

function EditorContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const roleParam = searchParams.get("role");
  const reviewId = searchParams.get("reviewId");
  const {
    project, showAnnotationPanel, showKnowledgePanel,
    selectedNodeId, editingNodeId, taskType,
    currentRole, setCurrentRole, setViewMode,
  } = useFlowAgentStore();
  const initDoneRef = useRef(false);
  const roleSetRef = useRef(false);

  useEffect(() => {
    if (roleSetRef.current) return;
    if (roleParam === "tech" && currentRole !== "tech") {
      roleSetRef.current = true;
      setCurrentRole("tech");
      setViewMode("tech");
    } else if (roleParam === "business" && currentRole !== "business") {
      roleSetRef.current = true;
      setCurrentRole("business");
      setViewMode("business");
    }
  }, [roleParam, currentRole, setCurrentRole, setViewMode]);

  // Load mock review data directly (no AI generation)
  useEffect(() => {
    if (!reviewId || initDoneRef.current) return;
    const review = getReviewById(reviewId);
    if (!review) return;
    initDoneRef.current = true;

    const store = useFlowAgentStore.getState();
    store.resetAll();
    store.setIsReviewMode(true);
    store.setCurrentRole("tech");
    store.setViewMode("tech");

    const statusMap = { pending: "tech_reviewing" as const, reviewed: "tech_reviewing" as const, confirmed: "confirmed" as const };
    store.setProjectStatus(statusMap[review.status]);

    store.setOriginalPrompt(review.prompt);
    store.setTaskType(review.type);

    if (review.type === "workflow" && review.nodes && review.edges) {
      store.loadGeneratedFlow(review.nodes, review.edges);
      store.setProjectStatus(statusMap[review.status]);
      store.setChatPhase("ready");
    } else if (review.type === "agentic" && review.agenticConfig) {
      store.setAgenticConfig(review.agenticConfig);
      store.setChatPhase("agentic_ready");
    }

    const p = store.project;
    store.setNodes(store.nodes);
    useFlowAgentStore.setState({
      project: { ...p, name: review.projectName, status: statusMap[review.status] },
    });

    review.chatMessages.forEach((msg) => store.addChatMessage(msg));
  }, [reviewId]);

  // Load from ?q= param (AI generation flow)
  useEffect(() => {
    if (reviewId) return;
    if (!q || initDoneRef.current) return;
    initDoneRef.current = true;

    const store = useFlowAgentStore.getState();

    const alreadyHasThisFlow =
      store.originalPrompt === q && (store.nodes.length > 0 || store.agenticConfig !== null);

    if (alreadyHasThisFlow) {
      if (roleParam === "tech" && store.project.status !== "tech_reviewing" && store.project.status !== "confirmed") {
        store.setProjectStatus("tech_reviewing");
      }
      return;
    }

    store.resetAll();

    if (roleParam === "tech") {
      useFlowAgentStore.getState().setCurrentRole("tech");
      useFlowAgentStore.getState().setViewMode("tech");
    }

    setTimeout(() => {
      const s = useFlowAgentStore.getState();
      s.addChatMessage({
        id: "init-user",
        role: "user",
        content: q,
        timestamp: new Date().toISOString(),
      });
      s.setInitQuery(q);
    }, 0);
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
    if (project.status === "tech_reviewing" && !annotationsLoadedRef.current) {
      annotationsLoadedRef.current = true;
      const store = useFlowAgentStore.getState();
      const isAgenticMode = store.taskType === "agentic";
      MOCK_ANNOTATIONS.forEach((a) => {
        const adjusted = isAgenticMode ? { ...a, nodeId: "__global__" } : a;
        store.addAnnotation(adjusted);
      });
      store.setShowAnnotationPanel(true);
    }
  }, [project.status]);

  const isAgentic = taskType === "agentic";

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel />
        {isAgentic ? (
          <AgenticConfigPanel />
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
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-zinc-400">加载中...</div>}>
      <EditorContent />
    </Suspense>
  );
}
