"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useFlowAgentStore, type ChatMessage, type ChatPhase } from "@/lib/store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bot, Send, User, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { parseLLMResponse, serializeFlowForLLM } from "@/lib/flow-parser";
import NodeQuestionPage, { CompletionCard } from "./QuestionCard";
import AgenticConfirmCard from "./AgenticConfirmCard";
import type { NodeConfidence } from "@/lib/store";
import type { AgenticTaskConfig, AgenticConfirmItem } from "@/lib/types";

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
  } = useFlowAgentStore();
  const [input, setInput] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initTriggered = useRef(false);

  const hasFlow = nodes.length > 0;
  const hasAgenticConfig = agenticConfig !== null;
  const isLoading = [
    "classifying", "drafting", "refining_node", "refining",
    "drafting_agentic", "refining_agentic",
  ].includes(phase);
  const hasPendingQuestions = phase === "questioning" && pendingNodes.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isLoading, hasPendingQuestions, showCompletion]);

  useEffect(() => {
    const { initQuery } = useFlowAgentStore.getState();
    if (initQuery && !initTriggered.current && phase === "idle") {
      initTriggered.current = true;
      useFlowAgentStore.getState().setInitQuery(null);
      triggerUnifiedDraft(initQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  // ============================================================
  // Phase 0+1: Unified draft (classify + draft in one LLM call)
  // ============================================================

  const triggerUnifiedDraft = useCallback(async (prompt: string) => {
    setPhase("drafting");
    setOriginalPrompt(prompt);
    setPendingNodes([]);
    setCurrentNodeIdx(0);
    setShowCompletion(false);
    setCollectedAnswers({});
    setInitialSnapshot(null);
    setAllNodeConfidence([]);
    setDeferredNodeIds([]);

    try {
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, action: "unified_draft" }),
      });
      const result = await res.json();

      if (!result.success) {
        setPhase("idle");
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `生成失败：${result.error || "未知错误"}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const rawType = result.taskType as "workflow" | "agentic" | "hybrid";
      const isHybrid = rawType === "hybrid";
      const effectiveType: "workflow" | "agentic" = rawType === "agentic" ? "agentic" : "workflow";
      setTaskType(effectiveType);

      const typeLabels: Record<string, string> = {
        workflow: "工作流（Workflow）",
        agentic: "智能体（Agentic）",
        hybrid: "混合型（Hybrid）",
      };
      const hybridNote = isHybrid
        ? "\n\n> 检测到混合型场景，当前先以工作流模式呈现。"
        : "";

      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `判断为 **${typeLabels[rawType]}** 类型。${result.classifyReason || ""}${hybridNote}`,
        timestamp: new Date().toISOString(),
      });

      if (effectiveType === "agentic") {
        handleAgenticResult(result, prompt);
      } else {
        handleWorkflowResult(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "网络错误";
      toast.error("生成失败", { description: msg });
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `请求出错：${msg}`,
        timestamp: new Date().toISOString(),
      });
      setPhase("idle");
    }
  }, [addChatMessage, setPhase, setOriginalPrompt, setTaskType, setPendingNodes, setCurrentNodeIdx, setCollectedAnswers, setInitialSnapshot, setAllNodeConfidence, setDeferredNodeIds]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleWorkflowResult = useCallback((result: Record<string, any>) => {
    const data = result.data;
    if (!data) { setPhase("idle"); return; }

    const { projectName, nodes: parsedNodes, edges: parsedEdges } =
      parseLLMResponse(data);

    loadGeneratedFlow(parsedNodes, parsedEdges);
    setInitialSnapshot({ nodes: parsedNodes, edges: parsedEdges });
    useFlowAgentStore.setState((s) => ({
      project: { ...s.project, name: projectName },
    }));

    const labelMap: Record<string, string> = {};
    for (const n of (data.nodes as { id: string; label: string }[]) || []) {
      labelMap[n.id] = n.label;
    }
    setNodeLabelMap(labelMap);

    const allNodeConf: NodeConfidence[] = (result.nodeConfidence as NodeConfidence[]) || [];
    setAllNodeConfidence(allNodeConf);
    const needConfirm = allNodeConf.filter(
      (nc) => nc.confidence !== "high" && nc.questions.length > 0
    );
    const autoSkipped = allNodeConf.length - needConfirm.length;

    if (needConfirm.length > 0) {
      const skippedMsg = autoSkipped > 0
        ? `（${autoSkipped} 个节点已自动确认）`
        : "";

      useFlowAgentStore.setState({
        pendingNodes: needConfirm,
        currentNodeIdx: 0,
        chatPhase: "questioning",
      });

      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `已生成「${projectName}」草稿，共 ${allNodeConf.length} 个节点。${skippedMsg}\n\n有 ${needConfirm.length} 个节点需要确认细节：`,
        timestamp: new Date().toISOString(),
      });
    } else {
      setPhase("ready");
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `已生成「${projectName}」流程图，所有节点信息都比较完整。你可以在画布上调整，或告诉我哪里需要修改。`,
        timestamp: new Date().toISOString(),
      });
    }
  }, [addChatMessage, loadGeneratedFlow, setPhase, setNodeLabelMap, setInitialSnapshot, setAllNodeConfidence]);

  const handleAgenticResult = useCallback((result: Record<string, any>, prompt: string) => {
    const data = result.data;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (!data) { setPhase("idle"); return; }

    const config: AgenticTaskConfig = {
      goal: (data.goal as string) || "",
      background: (data.background as string) || "",
      constraints: (data.constraints as AgenticTaskConfig["constraints"]) || [],
      skills: (data.skills as AgenticTaskConfig["skills"]) || [],
      evaluators: (data.evaluators as AgenticTaskConfig["evaluators"]) || [],
      executionStrategy: (data.executionStrategy as AgenticTaskConfig["executionStrategy"]) || "adaptive",
      maxIterations: (data.maxIterations as number) || 5,
      humanCheckpoints: (data.humanCheckpoints as string[]) || [],
    };

    setAgenticConfig(config);

    const pName = (result.projectName as string) || "";
    if (pName) {
      useFlowAgentStore.setState((s) => ({
        project: { ...s.project, name: pName, status: "business_editing" },
      }));
    }

    const skillNames = config.skills.map((s) => s.name).join("、");
    const confirmItems: AgenticConfirmItem[] = (result.confirmItems as AgenticConfirmItem[]) || [];

    if (confirmItems.length > 0) {
      setAgenticConfirmItems(confirmItems);
      setAgenticConfirmIdx(0);

      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `已生成「${pName || "Agent 任务"}」配置草稿：\n\n**目标**：${config.goal}\n**技能**：${skillNames}\n\n有 ${confirmItems.length} 个细节需要确认：`,
        timestamp: new Date().toISOString(),
      });

      setPhase("confirming_agentic");
    } else {
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `已生成「${pName || "Agent 任务"}」配置方案：\n\n**目标**：${config.goal}\n**技能**：${skillNames}\n\n请在右侧面板查看详细配置。`,
        timestamp: new Date().toISOString(),
      });

      setPhase("agentic_ready");
    }
  }, [addChatMessage, setPhase, setAgenticConfig, setAgenticConfirmItems, setAgenticConfirmIdx]);

  // ============================================================
  // Phase 2: Batch confirmation (Workflow) — collect then refine once
  // ============================================================

  const handleBatchSubmit = useCallback(
    async (collected: Record<string, { question: string; answer: string }[]>) => {
      const { pendingNodes: pn, nodeLabelMap: lm, originalPrompt: op } =
        useFlowAgentStore.getState();

      const answeredSummary = Object.entries(collected)
        .map(([nodeId, answers]) => {
          const label = lm[nodeId] || nodeId;
          return `「${label}」：${answers.map((a) => a.answer).join("、")}`;
        })
        .join("\n");

      addChatMessage({
        id: uuidv4(),
        role: "user",
        content: `已确认 ${Object.keys(collected).length} 个节点：\n${answeredSummary}`,
        timestamp: new Date().toISOString(),
      });

      setPhase("refining_node");

      try {
        const { nodes: currentNodes, edges: currentEdges } =
          useFlowAgentStore.getState();
        const { json: canvasJson } = serializeFlowForLLM(currentNodes, currentEdges);

        const nodeAnswers = pn.map((nc) => ({
          nodeId: nc.nodeId,
          nodeLabel: lm[nc.nodeId] || nc.nodeId,
          answers: collected[nc.nodeId] || nc.questions.map((q) => ({
            question: q.question,
            answer: q.defaultSuggestion,
          })),
        }));

        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "refine_batch",
            prompt: op,
            currentFlow: canvasJson,
            nodeAnswers,
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

          const newLabelMap: Record<string, string> = { ...lm };
          for (const n of result.data.nodes || []) {
            newLabelMap[n.id] = n.label;
          }
          setNodeLabelMap(newLabelMap);

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已根据你的确认优化了 ${nodeAnswers.length} 个节点。你可以继续调整，或告诉我还有什么需要修改的。`,
            timestamp: new Date().toISOString(),
          });
        } else {
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `批量优化失败：${result.error || "未知错误"}，流程图保持不变。`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "网络错误";
        toast.error("优化失败", { description: msg });
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `优化请求出错：${msg}，流程图保持不变。`,
          timestamp: new Date().toISOString(),
        });
      }

      setShowCompletion(true);
      setPhase("ready");
      useFlowAgentStore.setState({ pendingNodes: [], currentNodeIdx: 0 });
    },
    [addChatMessage, loadGeneratedFlow, setPhase, setNodeLabelMap]
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
    const { agenticConfirmItems: items, agenticConfirmIdx: idx } = useFlowAgentStore.getState();
    const item = items[idx];
    if (!item) return;

    const sectionLabel = { goal: "目标", skills: "技能", constraints: "约束", evaluators: "评估" }[item.section] || item.section;
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: `「${sectionLabel}」确认：${answer}`,
      timestamp: new Date().toISOString(),
    });

    const nextIdx = idx + 1;
    if (nextIdx < items.length) {
      setAgenticConfirmIdx(nextIdx);
    } else {
      finishAgenticConfirm();
    }
  }, [addChatMessage, setAgenticConfirmIdx, finishAgenticConfirm]);

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

    const { isReviewMode } = useFlowAgentStore.getState();
    if (isReviewMode) {
      useFlowAgentStore.getState().setIsReviewMode(false);
    }

    try {
      if (!hasFlow && !hasAgenticConfig && phase !== "questioning") {
        await triggerUnifiedDraft(userInput);
        return;
      }

      // Workflow refine
      if (taskType === "workflow" && hasFlow && phase === "ready") {
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
          const nodeList = (result.data.nodes || [])
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

        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "refine_agentic",
            prompt: originalPrompt,
            currentConfig: agenticConfig,
            feedback: userInput,
          }),
        });
        const result = await res.json();

        if (result.success && result.data) {
          const newConfig: AgenticTaskConfig = {
            goal: result.data.goal || agenticConfig!.goal,
            background: result.data.background || agenticConfig!.background,
            constraints: result.data.constraints || agenticConfig!.constraints,
            skills: result.data.skills || agenticConfig!.skills,
            evaluators: result.data.evaluators || agenticConfig!.evaluators,
            executionStrategy: result.data.executionStrategy || agenticConfig!.executionStrategy,
            maxIterations: result.data.maxIterations || agenticConfig!.maxIterations,
            humanCheckpoints: result.data.humanCheckpoints || agenticConfig!.humanCheckpoints,
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
      className={`flex gap-2.5 animate-slide-up ${msg.role === "user" ? "flex-row-reverse" : ""}`}
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
      <div className="max-w-[270px]">
        <div
          className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed
          ${msg.role === "assistant" ? "bg-zinc-50 text-zinc-700" : "bg-blue-500 text-white"}`}
        >
          {renderMarkdown(msg.content, msg.id)}
        </div>
        {msg.role === "assistant" && isErrorMessage(msg.content) && originalPrompt && (
          <button
            onClick={() => triggerUnifiedDraft(originalPrompt)}
            className="flex items-center gap-1 mt-1.5 text-[11px] text-red-500 hover:text-red-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> 重试
          </button>
        )}
      </div>
    </div>
  );

  const phaseLabel: Record<ChatPhase, string> = {
    idle: "",
    classifying: "分析任务类型...",
    drafting: "分析并生成方案...",
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
    classifying: "分析中，请稍候...",
    drafting: "生成中，请稍候...",
    questioning: "也可以直接打字补充...",
    refining_node: "优化中，请稍候...",
    ready: "告诉我哪里需要修改...",
    refining: "修改中，请稍候...",
    drafting_agentic: "生成中，请稍候...",
    confirming_agentic: "也可以直接打字补充...",
    agentic_ready: "告诉我哪里需要调整...",
    refining_agentic: "修改中，请稍候...",
  };

  const showWelcome = chatMessages.length === 0 && phase === "idle";
  const inputDisabled = isLoading;

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
        {hasPendingQuestions && (
          <span className="flex items-center gap-1 text-[10px] text-blue-600 ml-auto">
            {pendingNodes.length} 个节点待确认
          </span>
        )}
        {phase === "ready" && !showCompletion && (
          <span className="text-[10px] text-zinc-400 ml-auto">可对话修改</span>
        )}
        {phase === "confirming_agentic" && currentAgenticConfirm && (
          <span className="flex items-center gap-1 text-[10px] text-violet-600 ml-auto">
            确认 {agenticConfirmIdx + 1}/{agenticConfirmItems.length}
          </span>
        )}
        {phase === "agentic_ready" && (
          <span className="text-[10px] text-violet-500 ml-auto">Agent 配置就绪</span>
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
                描述你的业务场景，我会：
                <br />
                1. 自动判断任务类型并生成方案
                <br />
                2. 标注人机分工
                <br />
                3. 确认和优化细节
              </div>
            </div>
          )}

          {chatMessages.map(renderMessage)}

          {/* Paginated node questions (Workflow) */}
          {hasPendingQuestions && (
            <div className="ml-9">
              <NodeQuestionPage
                pendingNodes={pendingNodes}
                nodeLabelMap={nodeLabelMap}
                onSubmitAll={handleBatchSubmit}
                onSkipAll={handleSkipAll}
                onDeferNode={handleDeferNode}
                disabled={isLoading}
              />
            </div>
          )}

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
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-zinc-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
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
            {hasFlow || hasAgenticConfig ? "修改" : "生成"}
          </Button>
        </div>
      </div>
    </div>
  );
}
