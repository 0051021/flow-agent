"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useFlowAgentStore, type ChatMessage } from "@/lib/store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bot, Send, User, Sparkles, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { parseLLMResponse, serializeFlowForLLM } from "@/lib/flow-parser";
import NodeQuestionCard, {
  CompletionCard,
  type NodeConfidence,
} from "./QuestionCard";

type Phase =
  | "idle"
  | "drafting"
  | "questioning"     // showing node question card
  | "refining_node"   // calling refine_node API
  | "ready"
  | "refining";       // free chat refine

export default function ChatPanel() {
  const { chatMessages, addChatMessage, loadGeneratedFlow, nodes, edges } =
    useFlowAgentStore();
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [originalPrompt, setOriginalPrompt] = useState("");

  // Node-based questioning state
  const [pendingNodes, setPendingNodes] = useState<NodeConfidence[]>([]);
  const [currentNodeIdx, setCurrentNodeIdx] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);

  // Map nodeId → label from the flow data
  const [nodeLabelMap, setNodeLabelMap] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const initTriggered = useRef(false);

  const hasFlow = nodes.length > 0;
  const isLoading = phase === "drafting" || phase === "refining_node" || phase === "refining";
  const currentNodeConf = phase === "questioning" && currentNodeIdx < pendingNodes.length
    ? pendingNodes[currentNodeIdx]
    : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isLoading, currentNodeConf, showCompletion]);

  useEffect(() => {
    const w = window as Window & { __flowAgentInitQuery?: string };
    const initQuery = w.__flowAgentInitQuery;
    if (initQuery && !initTriggered.current && phase === "idle") {
      initTriggered.current = true;
      delete w.__flowAgentInitQuery;
      triggerDraft(initQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  // ============================================================
  // Phase 1: Draft
  // ============================================================

  const triggerDraft = useCallback(async (prompt: string) => {
    setPhase("drafting");
    setOriginalPrompt(prompt);
    setPendingNodes([]);
    setCurrentNodeIdx(0);
    setShowCompletion(false);

    try {
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, action: "draft" }),
      });
      const result = await res.json();

      if (result.success && result.data) {
        const { projectName, nodes: parsedNodes, edges: parsedEdges } =
          parseLLMResponse(result.data);

        loadGeneratedFlow(parsedNodes, parsedEdges);
        useFlowAgentStore.setState((s) => ({
          project: { ...s.project, name: projectName },
        }));

        // Build nodeId → label map from LLM response
        const labelMap: Record<string, string> = {};
        for (const n of result.data.nodes || []) {
          labelMap[n.id] = n.label;
        }
        setNodeLabelMap(labelMap);

        const allNodeConf: NodeConfidence[] = result.nodeConfidence || [];

        // Filter: only show nodes that need confirmation (medium/low)
        const needConfirm = allNodeConf.filter(
          (nc) => nc.confidence !== "high" && nc.questions.length > 0
        );
        const autoSkipped = allNodeConf.length - needConfirm.length;

        if (needConfirm.length > 0) {
          setPendingNodes(needConfirm);
          setCurrentNodeIdx(0);
          setPhase("questioning");

          const skippedMsg = autoSkipped > 0
            ? `（其中 ${autoSkipped} 个节点已自动确认）`
            : "";

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已生成「${projectName}」草稿流程图，共 ${allNodeConf.length} 个节点。${skippedMsg}\n\n让我逐个确认需要补充细节的节点：`,
            timestamp: new Date().toISOString(),
          });
        } else {
          setPhase("ready");
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已生成「${projectName}」流程图，所有节点信息都比较完整。你可以在画布上拖拽调整，或告诉我哪里需要修改。`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        setPhase("idle");
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `生成失败：${result.error || "未知错误"}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "网络错误";
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `请求出错：${msg}`,
        timestamp: new Date().toISOString(),
      });
      setPhase("idle");
    }
  }, [addChatMessage, loadGeneratedFlow]);

  // ============================================================
  // Phase 2: Node-by-node confirmation → refine_node
  // ============================================================

  const handleNodeConfirm = useCallback(
    async (answers: { question: string; answer: string }[]) => {
      const nc = pendingNodes[currentNodeIdx];
      if (!nc) return;

      const nodeLabel = nodeLabelMap[nc.nodeId] || nc.nodeId;

      addChatMessage({
        id: uuidv4(),
        role: "user",
        content: `「${nodeLabel}」已确认：\n${answers.map((a) => `• ${a.answer}`).join("\n")}`,
        timestamp: new Date().toISOString(),
      });

      setPhase("refining_node");

      try {
        const { nodes: currentNodes, edges: currentEdges } =
          useFlowAgentStore.getState();
        const { json: canvasJson } = serializeFlowForLLM(currentNodes, currentEdges);

        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "refine_node",
            prompt: originalPrompt,
            currentFlow: canvasJson,
            nodeId: nc.nodeId,
            nodeLabel,
            answers,
          }),
        });
        const result = await res.json();

        if (result.success && result.data) {
          const { projectName, nodes: parsedNodes, edges: parsedEdges } =
            parseLLMResponse(result.data);
          loadGeneratedFlow(parsedNodes, parsedEdges);
          if (projectName) {
            useFlowAgentStore.setState((s) => ({
              project: { ...s.project, name: projectName },
            }));
          }

          const newLabelMap: Record<string, string> = { ...nodeLabelMap };
          for (const n of result.data.nodes || []) {
            newLabelMap[n.id] = n.label;
          }
          setNodeLabelMap(newLabelMap);
        } else {
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `优化「${nodeLabel}」失败：${result.error || "未知错误"}，已跳过该节点的优化。`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "网络错误";
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `优化「${nodeLabel}」时出错：${msg}，已跳过该节点的优化。`,
          timestamp: new Date().toISOString(),
        });
      }

      // Always advance — the node's answers are recorded, flow still usable
      const nextIdx = currentNodeIdx + 1;
      if (nextIdx < pendingNodes.length) {
        setCurrentNodeIdx(nextIdx);
        setPhase("questioning");
      } else {
        finishQuestioning();
      }
    },
    [pendingNodes, currentNodeIdx, nodeLabelMap, originalPrompt, addChatMessage, loadGeneratedFlow]
  );

  const handleSkipAll = useCallback(() => {
    const remaining = pendingNodes.length - currentNodeIdx;
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: `跳过剩余 ${remaining} 个节点的确认，就按现在的来`,
      timestamp: new Date().toISOString(),
    });
    finishQuestioning();
  }, [addChatMessage, pendingNodes.length, currentNodeIdx]);

  const finishQuestioning = () => {
    setShowCompletion(true);
    setPhase("ready");
  };

  const handleCompletionDone = () => {
    setShowCompletion(false);
  };

  // ============================================================
  // Phase 3: Free chat refine
  // ============================================================

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userInput = input.trim();
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: userInput,
      timestamp: new Date().toISOString(),
    });
    setInput("");

    try {
      if (!hasFlow && phase !== "questioning") {
        await triggerDraft(userInput);
        return;
      }

      if (hasFlow && phase === "ready") {
        setPhase("refining");
        const { nodes: currentNodes, edges: currentEdges } =
          useFlowAgentStore.getState();
        const { json: canvasJson } = serializeFlowForLLM(currentNodes, currentEdges);

        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "refine",
            prompt: originalPrompt,
            currentFlow: canvasJson,
            feedback: userInput,
          }),
        });
        const result = await res.json();

        if (result.success && result.data) {
          const { projectName, nodes: parsedNodes, edges: parsedEdges } =
            parseLLMResponse(result.data);
          const nodeList = result.data.nodes
            .map((n: { label: string }, i: number) => `${i + 1}. **${n.label}**`)
            .join("\n");

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已更新流程图：\n\n${nodeList}\n\n还有需要调整的吗？`,
            timestamp: new Date().toISOString(),
          });

          loadGeneratedFlow(parsedNodes, parsedEdges);
          if (projectName) {
            useFlowAgentStore.setState((s) => ({
              project: { ...s.project, name: projectName },
            }));
          }
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "网络错误";
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `请求出错：${msg}`,
        timestamp: new Date().toISOString(),
      });
      setPhase(hasFlow ? "ready" : "idle");
    }
  };

  // ============================================================
  // Render
  // ============================================================

  const renderMessage = (msg: ChatMessage) => (
    <div
      key={msg.id}
      className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
        ${msg.role === "assistant" ? "bg-zinc-900" : "bg-blue-500"}`}
      >
        {msg.role === "assistant" ? (
          <Bot className="w-3.5 h-3.5 text-white" />
        ) : (
          <User className="w-3.5 h-3.5 text-white" />
        )}
      </div>
      <div
        className={`max-w-[270px] rounded-xl px-3 py-2.5 text-sm leading-relaxed
        ${msg.role === "assistant" ? "bg-zinc-50 text-zinc-700" : "bg-blue-500 text-white"}`}
      >
        {msg.content.split("\n").map((line, i) => (
          <span key={`${msg.id}-l${i}`}>
            {line.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**"))
                return (
                  <strong key={`${msg.id}-b${i}-${j}`}>
                    {part.slice(2, -2)}
                  </strong>
                );
              return <span key={`${msg.id}-t${i}-${j}`}>{part}</span>;
            })}
            {i < msg.content.split("\n").length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    drafting: "生成草稿中...",
    questioning: "",
    refining_node: "优化节点中...",
    ready: "",
    refining: "修改流程图中...",
  };

  const placeholder: Record<Phase, string> = {
    idle: "描述你的业务流程...",
    drafting: "生成中，请稍候...",
    questioning: "也可以直接打字补充...",
    refining_node: "优化中，请稍候...",
    ready: "告诉我哪里需要修改...",
    refining: "修改中，请稍候...",
  };

  const showWelcome = chatMessages.length === 0 && phase === "idle";
  const inputDisabled = isLoading || phase === "questioning";

  return (
    <div className="w-[340px] border-r border-zinc-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-zinc-900">AI 助手</h3>
        {isLoading && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 ml-auto">
            <Loader2 className="w-3 h-3 animate-spin" /> {phaseLabel[phase]}
          </span>
        )}
        {phase === "questioning" && currentNodeConf && (
          <span className="flex items-center gap-1 text-[10px] text-blue-600 ml-auto">
            确认节点 {currentNodeIdx + 1}/{pendingNodes.length}
          </span>
        )}
        {phase === "ready" && !showCompletion && (
          <span className="text-[10px] text-zinc-400 ml-auto">可对话修改</span>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {showWelcome && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="max-w-[270px] rounded-xl px-3 py-2.5 text-sm leading-relaxed bg-zinc-50 text-zinc-700">
                你好！我是 FlowAgent AI 助手。
                <br /><br />
                描述你的业务流程，我会：
                <br />
                1. 先快速生成一个草稿流程图
                <br />
                2. 按节点逐个确认需要补充的细节
                <br />
                3. 每确认一个节点，流程图实时优化
              </div>
            </div>
          )}

          {chatMessages.map(renderMessage)}

          {/* Node question card */}
          {currentNodeConf && (
            <div className="ml-9">
              <NodeQuestionCard
                key={currentNodeConf.nodeId}
                nodeConf={currentNodeConf}
                nodeLabel={nodeLabelMap[currentNodeConf.nodeId] || currentNodeConf.nodeId}
                nodeIndex={currentNodeIdx}
                totalNodes={pendingNodes.length}
                onConfirm={handleNodeConfirm}
                onSkipAll={handleSkipAll}
                disabled={phase === "refining_node"}
              />
            </div>
          )}

          {showCompletion && (
            <div className="ml-9">
              <CompletionCard onDone={handleCompletionDone} />
            </div>
          )}

          {isLoading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-zinc-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{phaseLabel[phase]}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-200 p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder[phase]}
          className="text-sm min-h-[60px] max-h-[120px] resize-none"
          disabled={inputDisabled}
        />
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || inputDisabled}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {hasFlow ? "修改" : "生成"}
          </Button>
        </div>
      </div>
    </div>
  );
}
