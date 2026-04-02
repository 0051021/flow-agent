"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useFlowAgentStore, type ChatMessage, type ChatPhase } from "@/lib/store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bot, Send, User, Sparkles, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { parseLLMResponse, serializeFlowForLLM } from "@/lib/flow-parser";
import NodeQuestionCard, { CompletionCard } from "./QuestionCard";
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
  const currentNodeConf = phase === "questioning" && currentNodeIdx < pendingNodes.length
    ? pendingNodes[currentNodeIdx]
    : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isLoading, currentNodeConf, showCompletion]);

  useEffect(() => {
    const { initQuery } = useFlowAgentStore.getState();
    if (initQuery && !initTriggered.current && phase === "idle") {
      initTriggered.current = true;
      useFlowAgentStore.getState().setInitQuery(null);
      triggerClassify(initQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  // ============================================================
  // Phase 0: Classify task type
  // ============================================================

  const triggerClassify = useCallback(async (prompt: string) => {
    setPhase("classifying");
    setOriginalPrompt(prompt);

    try {
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, action: "classify" }),
      });
      const result = await res.json();

      if (result.success && result.taskType) {
        const detectedType = result.taskType as "workflow" | "agentic";
        setTaskType(detectedType);

        const typeLabel = detectedType === "workflow" ? "工作流（Workflow）" : "智能体（Agentic）";
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `分析完成，判断为 **${typeLabel}** 类型。\n\n${result.reason || ""}`,
          timestamp: new Date().toISOString(),
        });

        if (detectedType === "workflow") {
          await triggerDraft(prompt);
        } else {
          await triggerAgenticDraft(prompt);
        }
      } else {
        setPhase("idle");
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `分类失败：${result.error || "未知错误"}，将按工作流模式处理。`,
          timestamp: new Date().toISOString(),
        });
        setTaskType("workflow");
        await triggerDraft(prompt);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "网络错误";
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `分类请求出错：${msg}，将按工作流模式处理。`,
        timestamp: new Date().toISOString(),
      });
      setTaskType("workflow");
      await triggerDraft(prompt);
    }
  }, [addChatMessage, setPhase, setOriginalPrompt, setTaskType]);

  // ============================================================
  // Phase 1a: Draft Workflow
  // ============================================================

  const triggerDraft = useCallback(async (prompt: string) => {
    setPhase("drafting");
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

        const labelMap: Record<string, string> = {};
        for (const n of result.data.nodes || []) {
          labelMap[n.id] = n.label;
        }
        setNodeLabelMap(labelMap);

        const allNodeConf: NodeConfidence[] = result.nodeConfidence || [];
        const needConfirm = allNodeConf.filter(
          (nc) => nc.confidence !== "high" && nc.questions.length > 0
        );
        const autoSkipped = allNodeConf.length - needConfirm.length;

        if (needConfirm.length > 0) {
          const skippedMsg = autoSkipped > 0
            ? `（其中 ${autoSkipped} 个节点已自动确认）`
            : "";

          useFlowAgentStore.setState({
            pendingNodes: needConfirm,
            currentNodeIdx: 0,
            chatPhase: "questioning",
          });

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
  }, [addChatMessage, loadGeneratedFlow, setPhase, setPendingNodes, setCurrentNodeIdx, setNodeLabelMap]);

  // ============================================================
  // Phase 1b: Draft Agentic
  // ============================================================

  const triggerAgenticDraft = useCallback(async (prompt: string) => {
    setPhase("drafting_agentic");

    try {
      const res = await fetch("/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, action: "draft_agentic" }),
      });
      const result = await res.json();

      if (result.success && result.data) {
        const config: AgenticTaskConfig = {
          goal: result.data.goal || "",
          background: result.data.background || "",
          constraints: result.data.constraints || [],
          skills: result.data.skills || [],
          evaluators: result.data.evaluators || [],
          executionStrategy: result.data.executionStrategy || "adaptive",
          maxIterations: result.data.maxIterations || 5,
          humanCheckpoints: result.data.humanCheckpoints || [],
        };

        setAgenticConfig(config);

        if (result.projectName) {
          useFlowAgentStore.setState((s) => ({
            project: { ...s.project, name: result.projectName, status: "business_editing" },
          }));
        }

        const skillNames = config.skills.map((s) => s.name).join("、");
        const confirmItems: AgenticConfirmItem[] = result.confirmItems || [];

        if (confirmItems.length > 0) {
          setAgenticConfirmItems(confirmItems);
          setAgenticConfirmIdx(0);

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已生成「${result.projectName || "Agent 任务"}」配置草稿：\n\n**目标**：${config.goal}\n**技能**：${skillNames}\n\n有 ${confirmItems.length} 个细节需要确认：`,
            timestamp: new Date().toISOString(),
          });

          setPhase("confirming_agentic");
        } else {
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `已生成「${result.projectName || "Agent 任务"}」配置方案：\n\n**目标**：${config.goal}\n**技能**：${skillNames}\n**约束**：${config.constraints.length} 项\n**评估器**：${config.evaluators.length} 个\n\n请在右侧面板查看和编辑详细配置，或直接告诉我需要调整的地方。`,
            timestamp: new Date().toISOString(),
          });

          setPhase("agentic_ready");
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
  }, [addChatMessage, setPhase, setAgenticConfig]);

  // ============================================================
  // Phase 2: Node-by-node confirmation (Workflow)
  // ============================================================

  const finishQuestioning = useCallback(() => {
    setShowCompletion(true);
    setPhase("ready");
  }, [setPhase]);

  const handleNodeConfirm = useCallback(
    async (answers: { question: string; answer: string }[]) => {
      const { pendingNodes: pn, currentNodeIdx: idx, nodeLabelMap: lm, originalPrompt: op } =
        useFlowAgentStore.getState();
      const nc = pn[idx];
      if (!nc) return;

      const nodeLabel = lm[nc.nodeId] || nc.nodeId;

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
            prompt: op,
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

          const newLabelMap: Record<string, string> = { ...lm };
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

      const { currentNodeIdx: curIdx, pendingNodes: curPending } = useFlowAgentStore.getState();
      const nextIdx = curIdx + 1;
      if (nextIdx < curPending.length) {
        useFlowAgentStore.setState({
          currentNodeIdx: nextIdx,
          chatPhase: "questioning",
        });
      } else {
        finishQuestioning();
      }
    },
    [addChatMessage, loadGeneratedFlow, setPhase, setNodeLabelMap, finishQuestioning]
  );

  const handleSkipNode = useCallback(() => {
    const { pendingNodes: pn, currentNodeIdx: idx, nodeLabelMap: lm } = useFlowAgentStore.getState();
    const nc = pn[idx];
    const nodeLabel = nc ? (lm[nc.nodeId] || nc.nodeId) : "";
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: `跳过「${nodeLabel}」的确认，使用默认方案`,
      timestamp: new Date().toISOString(),
    });

    const nextIdx = idx + 1;
    if (nextIdx < pn.length) {
      useFlowAgentStore.setState({
        currentNodeIdx: nextIdx,
        chatPhase: "questioning",
      });
    } else {
      finishQuestioning();
    }
  }, [addChatMessage, finishQuestioning]);

  const handleSkipAll = useCallback(() => {
    const { pendingNodes: pn, currentNodeIdx: idx } = useFlowAgentStore.getState();
    const remaining = pn.length - idx;
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: `跳过剩余 ${remaining} 个节点的确认，就按现在的来`,
      timestamp: new Date().toISOString(),
    });
    finishQuestioning();
  }, [addChatMessage, finishQuestioning]);

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
      // No flow and no agentic config yet → classify first
      if (!hasFlow && !hasAgenticConfig && phase !== "questioning") {
        await triggerClassify(userInput);
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

  const phaseLabel: Record<ChatPhase, string> = {
    idle: "",
    classifying: "分析任务类型...",
    drafting: "生成草稿中...",
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
        {phase === "questioning" && currentNodeConf && (
          <span className="flex items-center gap-1 text-[10px] text-blue-600 ml-auto">
            确认节点 {currentNodeIdx + 1}/{pendingNodes.length}
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
                1. 自动判断是工作流还是智能体任务
                <br />
                2. 生成对应的配置方案
                <br />
                3. 逐步确认和优化细节
              </div>
            </div>
          )}

          {chatMessages.map(renderMessage)}

          {/* Node question card (Workflow) */}
          {currentNodeConf && (
            <div className="ml-9">
              <NodeQuestionCard
                key={currentNodeConf.nodeId}
                nodeConf={currentNodeConf}
                nodeLabel={nodeLabelMap[currentNodeConf.nodeId] || currentNodeConf.nodeId}
                nodeIndex={currentNodeIdx}
                totalNodes={pendingNodes.length}
                onConfirm={handleNodeConfirm}
                onSkipNode={handleSkipNode}
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
            {hasFlow || hasAgenticConfig ? "修改" : "生成"}
          </Button>
        </div>
      </div>
    </div>
  );
}
