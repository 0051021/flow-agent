"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useFlowAgentStore, type ChatMessage, type ChatPhase } from "@/lib/store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bot, Send, User, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { parseLLMResponse, serializeFlowForLLM } from "@/lib/flow-parser";
import { generateDemoFlow } from "@/lib/mock-data";
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
    showNodeQuestions, selectedNodeId, allNodeConfidence,
  } = useFlowAgentStore();
  const [input, setInput] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initTriggered = useRef(false);
  const inFlightRef = useRef(false);

  const hasFlow = nodes.length > 0;
  const hasAgenticConfig = agenticConfig !== null;
  const isLoading = [
    "classifying", "drafting", "refining_node", "refining",
    "drafting_agentic", "refining_agentic",
  ].includes(phase);
  const hasPendingQuestions = pendingNodes.length > 0 && phase === "ready";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isLoading, hasPendingQuestions, showCompletion, showNodeQuestions]);

  useEffect(() => {
    const tryInit = () => {
      const s = useFlowAgentStore.getState();
      const q = s.initQuery;
      if (q && !initTriggered.current && s.chatPhase === "idle") {
        initTriggered.current = true;
        s.setInitQuery(null);
        triggerUnifiedDraft(q);
      }
    };
    tryInit();
    const unsub = useFlowAgentStore.subscribe((state) => {
      if (state.initQuery && !initTriggered.current) {
        tryInit();
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Phase 0+1: Unified draft (classify + draft in one LLM call)
  // ============================================================

  const triggerUnifiedDraft = useCallback(async (prompt: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
        signal: AbortSignal.timeout(180000),
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

      const rawType = result.taskType as string;
      let effectiveType: "workflow" | "agentic" = rawType === "agentic" ? "agentic" : "workflow";

      if (effectiveType === "workflow" && result.data && !result.data.nodes && result.data.phases) {
        effectiveType = "agentic";
      }
      setTaskType(effectiveType);

      const typeLabels: Record<string, string> = {
        workflow: "工作流（Workflow）",
        agentic: "智能体（Agentic）",
      };

      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: `判断为 **${typeLabels[effectiveType]}** 类型。${result.classifyReason || ""}`,
        timestamp: new Date().toISOString(),
      });

      try {
        if (effectiveType === "agentic") {
          handleAgenticResult(result, prompt);
        } else {
          handleWorkflowResult(result);
        }
      } catch (parseErr) {
        console.error("Failed to parse AI result:", parseErr);
        setPhase("idle");
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `AI 返回了结果但解析失败，请重试。${parseErr instanceof Error ? parseErr.message : ""}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "网络错误";
      const isAbort = raw.includes("aborted") || raw.includes("AbortError");
      const msg = isAbort ? "AI 生成超时，请稍后重试（复杂需求可能需要更长时间）" : raw;

      const storeType = useFlowAgentStore.getState().taskType;
      const hasAgConfig = useFlowAgentStore.getState().agenticConfig !== null;
      if (storeType === "agentic" || hasAgConfig) {
        toast.error("Agentic 方案生成失败", { description: msg });
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `Agentic 方案生成出错（${msg}）。请重新描述你的需求，或者查看预置的示例方案。`,
          timestamp: new Date().toISOString(),
        });
        setPhase("idle");
      } else {
        toast.error("生成失败，已加载离线演示数据", { description: msg });
        const demo = generateDemoFlow();
        loadGeneratedFlow(demo.nodes, demo.edges);
        setInitialSnapshot({ nodes: demo.nodes, edges: demo.edges });
        setTaskType("workflow");
        useFlowAgentStore.setState((s) => ({
          project: { ...s.project, name: "小红书账号运营（离线演示）" },
        }));
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `AI 服务暂时不可用（${msg}），已加载离线演示流程图。你可以在画布上查看和编辑。`,
          timestamp: new Date().toISOString(),
        });
        setPhase("ready");
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [addChatMessage, loadGeneratedFlow, setPhase, setOriginalPrompt, setTaskType, setPendingNodes, setCurrentNodeIdx, setCollectedAnswers, setInitialSnapshot, setAllNodeConfidence, setDeferredNodeIds]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleWorkflowResult = useCallback((result: Record<string, any>) => {
    const data = result.data;
    if (!data || !data.nodes || !Array.isArray(data.nodes)) { setPhase("idle"); return; }

    console.log("[FlowAgent] raw edges from API:", JSON.stringify(data.edges?.length ?? "missing"), data.edges?.slice?.(0, 2));

    const { projectName, nodes: parsedNodes, edges: parsedEdges } =
      parseLLMResponse(data);

    console.log("[FlowAgent] parsed edges:", parsedEdges.length, "nodes:", parsedNodes.length);

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

    const allNodeConf: NodeConfidence[] = ((result.nodeConfidence as NodeConfidence[]) || []).map((nc) => ({
      ...nc,
      questions: nc.questions || [],
    }));
    setAllNodeConfidence(allNodeConf);
    const needConfirm = allNodeConf.filter(
      (nc) => nc.confidence !== "high" && nc.questions.length > 0
    );

    useFlowAgentStore.setState({
      pendingNodes: needConfirm,
      currentNodeIdx: 0,
    });

    // 统计人机分工
    const aiAutoNodes = parsedNodes.filter((n) => n.data?.executionMode === "ai_auto");
    const humanConfirmNodes = parsedNodes.filter((n) => n.data?.executionMode === "human_confirm");
    const humanManualNodes = parsedNodes.filter((n) => n.data?.executionMode === "human_manual");
    const humanTotal = humanConfirmNodes.length + humanManualNodes.length;

    // 人话版摘要（先让小白看懂价值）
    const humanSummaryParts: string[] = [];
    humanSummaryParts.push(`**「${projectName}」梳理完成 ✅**`);
    humanSummaryParts.push(`\n这件事共分 **${parsedNodes.length} 步**：`);
    if (aiAutoNodes.length > 0) {
      humanSummaryParts.push(`• 🤖 **AI 自动完成 ${aiAutoNodes.length} 步**（你不用管）`);
    }
    if (humanTotal > 0) {
      humanSummaryParts.push(`• 👤 **需要你参与 ${humanTotal} 步**（确认或手动操作）`);
    }

    if (needConfirm.length > 0) {
      const lowNodes = needConfirm.filter((nc) => nc.confidence === "low");
      const medNodes = needConfirm.filter((nc) => nc.confidence === "medium");
      const uncertainParts: string[] = [];
      if (lowNodes.length > 0) {
        uncertainParts.push(`🔴 ${lowNodes.length} 个步骤信息不够（${lowNodes.map((n) => labelMap[n.nodeId] || n.nodeId).join("、")}）`);
      }
      if (medNodes.length > 0) {
        uncertainParts.push(`🟡 ${medNodes.length} 个步骤需确认细节（${medNodes.map((n) => labelMap[n.nodeId] || n.nodeId).join("、")}）`);
      }
      humanSummaryParts.push(`\n右侧流程图已经生成，带颜色标记的步骤是 AI 觉得还需要你补充信息的地方，点击可以查看。也可以直接告诉我哪里不对。\n\n${uncertainParts.join("\n")}`);
    } else {
      humanSummaryParts.push(`\n右侧流程图已经生成，所有步骤信息都比较完整。可以在画布上查看和调整，或者直接告诉我哪里需要改。`);
    }

    addChatMessage({
      id: uuidv4(),
      role: "assistant",
      content: humanSummaryParts.join("\n"),
      timestamp: new Date().toISOString(),
    });
    setPhase("ready");
  }, [addChatMessage, loadGeneratedFlow, setPhase, setNodeLabelMap, setInitialSnapshot, setAllNodeConfidence]);

  const handleAgenticResult = useCallback((result: Record<string, any>, prompt: string) => {
    const data = result.data;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (!data) { setPhase("idle"); return; }

    const phases = (data.phases || []).map((p: Record<string, unknown>, i: number) => ({
      id: (p.id as string) || `phase-${i + 1}`,
      name: (p.name as string) || `阶段 ${i + 1}`,
      dayRange: (p.dayRange as [number, number]) || [1, 7],
      status: "pending" as const,
      actions: (p.actions as string[]) || [],
      successCriteria: (p.successCriteria as AgenticTaskConfig["phases"][0]["successCriteria"]) || { good: "", warning: "", bad: "" },
      exitCondition: (p.exitCondition as string) || "",
      requiresApproval: (p.requiresApproval as boolean) || false,
      approvalDescription: (p.approvalDescription as string) || undefined,
      questions: (p.questions as AgenticTaskConfig["phases"][0]["questions"]) || [],
      requiredCapabilities: (p.requiredCapabilities as string[]) || [],
    }));

    const config: AgenticTaskConfig = {
      goal: (data.goal as string) || "",
      background: (data.background as string) || "",
      totalDays: (data.totalDays as number) || 90,
      phases,
      globalSuccessCriteria: (data.globalSuccessCriteria as string) || "",
      approvalPoints: (data.approvalPoints as string[]) || [],
      fallbacks: (data.fallbacks as AgenticTaskConfig["fallbacks"]) || [],
      constraints: (data.constraints as AgenticTaskConfig["constraints"]) || [],
      skills: (data.skills as AgenticTaskConfig["skills"]) || [],
      evaluators: (data.evaluators as AgenticTaskConfig["evaluators"]) || [],
      executionStrategy: (data.executionStrategy as AgenticTaskConfig["executionStrategy"]) || "adaptive",
      maxIterations: (data.maxIterations as number) || 5,
      humanCheckpoints: (data.humanCheckpoints as string[]) || [],
      goalMetrics: data.goalMetrics || undefined,
      executionRules: data.executionRules || undefined,
      permissions: data.permissions || undefined,
      reporting: data.reporting || undefined,
      contentPreview: data.contentPreview || undefined,
      estimatedDuration: data.estimatedDuration || undefined,
      estimatedEfficiency: data.estimatedEfficiency || undefined,
      executionOverview: data.executionOverview || undefined,
      riskAssessment: data.riskAssessment || undefined,
    };

    setAgenticConfig(config);

    const pName = (result.projectName as string) || "";
    if (pName) {
      useFlowAgentStore.setState((s) => ({
        project: { ...s.project, name: pName, status: "business_editing" },
      }));
    }

    const goalText = config.goalMetrics?.core || config.goal;
    const phaseCount = phases.length;
    const approvalPhaseCount = phases.filter((p: { requiresApproval?: boolean }) => p.requiresApproval).length;
    const needQuestionCount = phases.filter((p: { questions?: unknown[] }) => p.questions && p.questions.length > 0).length;

    // 人话版摘要
    const agenticSummaryParts: string[] = [];
    agenticSummaryParts.push(`**「${pName || "任务方案"}」梳理完成 ✅**`);
    agenticSummaryParts.push(`\n**目标**：${goalText}`);
    agenticSummaryParts.push(`\n这件事分 **${phaseCount} 个阶段**，周期约 **${config.totalDays} 天**：`);
    agenticSummaryParts.push(`• 🤖 AI 按策略自动推进每个阶段`);
    if (approvalPhaseCount > 0) {
      agenticSummaryParts.push(`• 👤 有 **${approvalPhaseCount} 个阶段**需要你审批后才能继续`);
    }
    if (needQuestionCount > 0) {
      agenticSummaryParts.push(`\n右侧方案已生成，有 ${needQuestionCount} 个阶段需要你补充一些信息，请逐阶段确认。`);
    } else {
      agenticSummaryParts.push(`\n右侧方案已生成，可以查看每个阶段的详情，或告诉我哪里需要调整。`);
    }

    addChatMessage({
      id: uuidv4(),
      role: "assistant",
      content: agenticSummaryParts.join("\n"),
      timestamp: new Date().toISOString(),
    });
    setPhase("agentic_ready");
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
          signal: AbortSignal.timeout(180000),
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

          const confirmedIds = new Set(Object.keys(collected));
          const { allNodeConfidence: prevConf } = useFlowAgentStore.getState();
          setAllNodeConfidence(
            prevConf.map((nc) =>
              confirmedIds.has(nc.nodeId)
                ? { ...nc, confidence: "high" as const, questions: [] }
                : nc
            )
          );

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
        setShowCompletion(true);
        setPhase("ready");
        useFlowAgentStore.setState({ pendingNodes: [], currentNodeIdx: 0 });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "网络错误";
        toast.error("优化失败", { description: msg });
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: `优化请求出错：${msg}，流程图保持不变。你可以重新提交确认或继续编辑。`,
          timestamp: new Date().toISOString(),
        });
        setPhase("ready");
      }
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
    const { agenticConfirmItems: items, agenticConfirmIdx: idx, agenticConfig: config } = useFlowAgentStore.getState();
    const item = items[idx];
    if (!item) return;

    const sectionLabel = { goal: "目标", skills: "技能", constraints: "约束", evaluators: "评估" }[item.section] || item.section;
    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: `「${sectionLabel}」确认：${answer}`,
      timestamp: new Date().toISOString(),
    });

    if (config) {
      const updated = { ...config };
      switch (item.section) {
        case "goal":
          updated.goal = `${config.goal}（用户补充：${answer}）`;
          break;
        case "skills": {
          const skillIdx = config.skills.findIndex((s) =>
            item.question.includes(s.name)
          );
          if (skillIdx >= 0) {
            updated.skills = config.skills.map((s, i) =>
              i === skillIdx ? { ...s, description: `${s.description}（${answer}）` } : s
            );
          }
          break;
        }
        case "constraints": {
          const cIdx = config.constraints.findIndex((c) =>
            item.question.includes(c.description)
          );
          if (cIdx >= 0) {
            updated.constraints = config.constraints.map((c, i) =>
              i === cIdx ? { ...c, value: answer } : c
            );
          } else {
            updated.constraints = [
              ...config.constraints,
              { id: `c-user-${Date.now()}`, type: "custom", description: answer },
            ];
          }
          break;
        }
        case "evaluators": {
          const eIdx = config.evaluators.findIndex((e) =>
            item.question.includes(e.name)
          );
          if (eIdx >= 0) {
            updated.evaluators = config.evaluators.map((e, i) =>
              i === eIdx ? { ...e, description: `${e.description}（${answer}）` } : e
            );
          }
          break;
        }
      }
      setAgenticConfig(updated);
    }

    const nextIdx = idx + 1;
    if (nextIdx < items.length) {
      setAgenticConfirmIdx(nextIdx);
    } else {
      finishAgenticConfirm();
    }
  }, [addChatMessage, setAgenticConfirmIdx, setAgenticConfig, finishAgenticConfirm]);

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

      // Workflow refine — tech uses full schema, business uses biz schema
      if (taskType === "workflow" && hasFlow && (phase === "ready" || phase === "questioning")) {
        setPhase("refining");
        const { nodes: currentNodes, edges: currentEdges, currentRole } =
          useFlowAgentStore.getState();
        const { json: canvasJson } = serializeFlowForLLM(currentNodes, currentEdges);
        const refineAction = currentRole === "tech" ? "refine" : "refine_business";

        const res = await fetch("/api/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: refineAction,
            prompt: originalPrompt,
            currentFlow: canvasJson,
            feedback: userInput,
          }),
          signal: AbortSignal.timeout(180000),
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
          signal: AbortSignal.timeout(180000),
        });
        const result = await res.json();

        if (result.success && result.data) {
          const prev = agenticConfig!;
          const newConfig: AgenticTaskConfig = {
            goal: result.data.goal || prev.goal,
            background: result.data.background || prev.background,
            totalDays: result.data.totalDays || prev.totalDays,
            phases: result.data.phases || prev.phases,
            globalSuccessCriteria: result.data.globalSuccessCriteria || prev.globalSuccessCriteria,
            approvalPoints: result.data.approvalPoints || prev.approvalPoints,
            fallbacks: result.data.fallbacks || prev.fallbacks,
            constraints: result.data.constraints || prev.constraints,
            skills: result.data.skills || prev.skills,
            evaluators: result.data.evaluators || prev.evaluators,
            executionStrategy: result.data.executionStrategy || prev.executionStrategy,
            maxIterations: result.data.maxIterations || prev.maxIterations,
            humanCheckpoints: result.data.humanCheckpoints || prev.humanCheckpoints,
            goalMetrics: result.data.goalMetrics || prev.goalMetrics,
            executionRules: result.data.executionRules || prev.executionRules,
            permissions: result.data.permissions || prev.permissions,
            reporting: result.data.reporting || prev.reporting,
            contentPreview: result.data.contentPreview || prev.contentPreview,
            estimatedDuration: result.data.estimatedDuration || prev.estimatedDuration,
            estimatedEfficiency: result.data.estimatedEfficiency || prev.estimatedEfficiency,
            executionOverview: result.data.executionOverview || prev.executionOverview,
            riskAssessment: result.data.riskAssessment || prev.riskAssessment,
            decisionLoop: result.data.decisionLoop || prev.decisionLoop,
            skillOrchestration: result.data.skillOrchestration || prev.skillOrchestration,
            contextArchitecture: result.data.contextArchitecture || prev.contextArchitecture,
            schedule: result.data.schedule || prev.schedule,
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
        {hasPendingQuestions && !isLoading && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 ml-auto">
            {pendingNodes.length} 个节点可优化
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

          {/* On-demand node question (triggered by clicking confidence marker on canvas) */}
          {showNodeQuestions && selectedNodeId && (() => {
            const nodeConf = allNodeConfidence.find((nc) => nc.nodeId === selectedNodeId);
            if (!nodeConf || nodeConf.confidence === "high" || nodeConf.questions.length === 0) return null;
            return (
              <div className="ml-9">
                <NodeQuestionPage
                  pendingNodes={[nodeConf]}
                  nodeLabelMap={nodeLabelMap}
                  onSubmitAll={(collected) => {
                    useFlowAgentStore.setState({ showNodeQuestions: false });
                    handleBatchSubmit(collected);
                  }}
                  onSkipAll={() => {
                    useFlowAgentStore.setState({ showNodeQuestions: false });
                  }}
                  onDeferNode={(nodeId) => {
                    useFlowAgentStore.setState({ showNodeQuestions: false });
                    handleDeferNode(nodeId);
                  }}
                  disabled={isLoading}
                />
              </div>
            );
          })()}

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
