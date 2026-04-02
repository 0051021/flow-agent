"use client";

declare global {
  interface Window {
    __flowAgentInitQuery?: string;
  }
}

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import TopBar from "@/components/layout/TopBar";
import ChatPanel from "@/components/panels/ChatPanel";
import AnnotationPanel from "@/components/panels/AnnotationPanel";
import KnowledgePanel from "@/components/panels/KnowledgePanel";
import NodeDetailPanel from "@/components/panels/NodeDetailPanel";
import NodeEditDialog from "@/components/flow/NodeEditDialog";
import { useFlowAgentStore } from "@/lib/store";
import { MOCK_ANNOTATIONS } from "@/lib/mock-data";

const FlowCanvas = dynamic(() => import("@/components/flow/FlowCanvas"), { ssr: false });

function EditorContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const {
    project, showAnnotationPanel, showKnowledgePanel,
    selectedNodeId, editingNodeId,
  } = useFlowAgentStore();
  const lastQueryRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    // First call: mark hydrated and proceed
    hydratedRef.current = true;

    if (!q) return;

    // If store already has this query with a flow, skip (restored from localStorage)
    const store = useFlowAgentStore.getState();
    const firstMsg = store.chatMessages[0];
    if (firstMsg && firstMsg.content === q && store.nodes.length > 0) {
      lastQueryRef.current = q;
      return;
    }

    if (lastQueryRef.current === q) return;

    lastQueryRef.current = q;
    store.resetAll();

    setTimeout(() => {
      const s = useFlowAgentStore.getState();
      s.addChatMessage({
        id: "init-user",
        role: "user",
        content: q,
        timestamp: new Date().toISOString(),
      });
      window.__flowAgentInitQuery = q;
    }, 0);
  }, [q]);

  const annotationsLoadedRef = useRef(false);
  useEffect(() => {
    if (project.status === "tech_reviewing" && !annotationsLoadedRef.current) {
      annotationsLoadedRef.current = true;
      const store = useFlowAgentStore.getState();
      MOCK_ANNOTATIONS.forEach((a) => store.addAnnotation(a));
      store.setShowAnnotationPanel(true);
    }
  }, [project.status]);

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <FlowCanvas />
          </div>
          {selectedNodeId && <NodeDetailPanel />}
        </div>
        {showAnnotationPanel && <AnnotationPanel />}
        {showKnowledgePanel && <KnowledgePanel />}
      </div>
      {editingNodeId && <NodeEditDialog />}
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
