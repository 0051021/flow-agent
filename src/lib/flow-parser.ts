import type { FlowNodeData } from "./types";
import type { Node, Edge } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import dagre from "@dagrejs/dagre";

interface LLMNode {
  id: string;
  label: string;
  icon: string;
  description: string;
  executionMode: "ai_auto" | "human_confirm" | "human_manual";
  estimatedTime: string;
  inputs: {
    name: string;
    icon: string;
    description: string;
    required: boolean;
    source: "user" | "previous_step" | "default";
    sourceDetail?: string;
  }[];
  outputs: {
    name: string;
    icon: string;
    description: string;
  }[];
  executionRules?: {
    rule: string;
    detail: string;
    source: "ai_inferred" | "user_confirmed";
  }[];
  isCondition?: boolean;
  conditionBranches?: { label: string; icon: string; targetLabel: string }[] | null;
  executionType?: "deterministic" | "intelligent";
}

interface LLMEdge {
  source: string;
  target: string;
  label: string;
  style: "normal" | "success" | "error" | "loop";
}

interface LLMFlowData {
  projectName: string;
  nodes: LLMNode[];
  edges: LLMEdge[];
}

const EDGE_STYLE_MAP: Record<string, { stroke: string; dash?: boolean }> = {
  normal: { stroke: "#94a3b8" },
  success: { stroke: "#22c55e" },
  error: { stroke: "#ef4444", dash: true },
  loop: { stroke: "#f59e0b", dash: true },
};

const NODE_WIDTH = 340;
const NODE_HEIGHT = 260;

/**
 * Use dagre for proper hierarchical DAG layout.
 * Dagre handles layering, crossing minimisation, and coordinate assignment
 * far better than hand-rolled heuristics.
 */
function computeDAGLayout(
  nodeIds: string[],
  edges: LLMEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodeIds.length === 0) return positions;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 100,
    ranksep: 120,
    edgesep: 40,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const id of nodeIds) {
    g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const forwardEdges = edges.filter((e) => e.style !== "loop");
  const nodeIdSet = new Set(nodeIds);
  for (const e of forwardEdges) {
    if (nodeIdSet.has(e.source) && nodeIdSet.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  for (const id of nodeIds) {
    const node = g.node(id);
    if (node) {
      positions.set(id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 });
    }
  }

  return positions;
}

export function parseLLMResponse(data: LLMFlowData): {
  projectName: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
} {
  const nodeIds = new Set(data.nodes.map((n) => n.id));
  const nodeIdArray = [...nodeIds];
  const positions = computeDAGLayout(nodeIdArray, data.edges);
  const totalSteps = data.nodes.length;

  const nodes: Node<FlowNodeData>[] = data.nodes.map((n, index) => ({
    id: n.id,
    type: "flowCard",
    position: positions.get(n.id) || { x: 0, y: index * (NODE_HEIGHT + 120) },
    data: {
      label: n.label,
      icon: n.icon,
      description: n.description,
      stepIndex: index + 1,
      totalSteps,
      executionMode: n.executionMode,
      estimatedTime: n.estimatedTime,
      inputs: (n.inputs || []).map((inp) => ({
        id: uuidv4(),
        name: inp.name,
        icon: inp.icon,
        description: inp.description,
        required: inp.required,
        source: inp.source,
        sourceDetail: inp.sourceDetail,
      })),
      outputs: (n.outputs || []).map((out) => ({
        id: uuidv4(),
        name: out.name,
        icon: out.icon,
        description: out.description,
        flowsTo: [],
        dataType: undefined,
      })),
      executionRules: (n.executionRules || []).map((r) => ({
        rule: r.rule,
        detail: r.detail,
        source: r.source || "ai_inferred",
      })),
      errorHandling: [
        { strategy: "retry" as const, enabled: true, config: { maxRetries: 3, retryInterval: 30 } },
        { strategy: "human_fallback" as const, enabled: true, config: { notifyRole: "负责人" } },
        { strategy: "skip" as const, enabled: false },
        { strategy: "abort" as const, enabled: false },
      ],
      techConfig: {
        executionType: n.executionType || "deterministic",
        feasibility: "pending" as const,
      },
      isCondition: n.isCondition || false,
      conditionBranches: n.conditionBranches || undefined,
    },
  }));

  const resolveNodeId = (raw: string): string | null => {
    if (nodeIds.has(raw)) return raw;
    const prefixed = raw.startsWith("node-") ? raw : `node-${raw}`;
    if (nodeIds.has(prefixed)) return prefixed;
    const stripped = raw.replace(/^node-/, "");
    for (const id of nodeIds) {
      if (id.replace(/^node-/, "") === stripped) return id;
    }
    return null;
  };

  let validEdges = (data.edges || []).reduce<LLMEdge[]>((acc, e) => {
    if (!e) return acc;
    const src = resolveNodeId(e.source);
    const tgt = resolveNodeId(e.target);
    if (src && tgt) {
      acc.push({ ...e, source: src, target: tgt });
    }
    return acc;
  }, []);

  if (validEdges.length === 0 && data.nodes.length > 1) {
    console.warn("[FlowAgent] No valid edges from AI, generating sequential fallback edges");
    validEdges = data.nodes.slice(0, -1).map((n, i) => ({
      source: n.id,
      target: data.nodes[i + 1].id,
      label: "",
      style: "normal" as const,
    }));
  }

  // Standard flowchart convention:
  // - Main path (straight down): bottom-center → top-center
  // - Side branch (target offset horizontally): side-of-source → top-of-target
  // - Back edge (loop back up): side → side
  // - Merge (multiple sources into one target): bottom-of-each → top-center-of-target

  const edges: Edge[] = validEdges.map((e) => {
    const s = EDGE_STYLE_MAP[e.style] || EDGE_STYLE_MAP.normal;
    const srcPos = positions.get(e.source);
    const tgtPos = positions.get(e.target);

    let sourceHandle = "bottom-out";
    let targetHandle = "top-in";

    if (srcPos && tgtPos) {
      const dy = tgtPos.y - srcPos.y;
      const dx = tgtPos.x - srcPos.x;
      const absDx = Math.abs(dx);

      if (dy < -NODE_HEIGHT * 0.3) {
        // Back edge: target is above source → loop via side
        const side = dx >= 0 ? "right" : "left";
        sourceHandle = `${side}-out`;
        targetHandle = `${side}-in`;
      } else if (absDx > NODE_WIDTH * 0.5) {
        // Side branch: target is significantly to the left or right
        // Exit from the SIDE of the source, enter from the TOP of target
        sourceHandle = dx > 0 ? "right-out" : "left-out";
        targetHandle = "top-in";
      }
      // else: straight down → default bottom-out / top-in
    }

    return {
      id: `e-${uuidv4()}`,
      source: e.source,
      target: e.target,
      sourceHandle,
      targetHandle,
      label: e.label,
      type: "editable",
      animated: e.style !== "loop",
      style: {
        stroke: s.stroke,
        strokeWidth: 2,
        ...(s.dash ? { strokeDasharray: "6,3" } : {}),
      },
    };
  });

  return { projectName: data.projectName, nodes, edges };
}

/**
 * Serialize current canvas state back to LLM-readable structured text.
 * This is NOT an image — it's a structured description that LLM can parse and modify.
 */
export function serializeFlowForLLM(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): { json: object; readable: string } {
  // Build the JSON structure (same format LLM outputs)
  const json = {
    nodes: nodes.map((n) => {
      const d = n.data as unknown as FlowNodeData;
      const tc = d.techConfig ?? { executionType: "deterministic" };
      return {
        id: n.id,
        label: d.label || "未命名节点",
        icon: d.icon || "Zap",
        description: d.description || "",
        executionMode: d.executionMode || "ai_auto",
        estimatedTime: d.estimatedTime || "待定",
        inputs: (d.inputs || []).map((inp) => ({
          name: inp.name,
          icon: inp.icon,
          description: inp.description,
          required: inp.required,
          source: inp.source,
          sourceDetail: inp.sourceDetail,
        })),
        outputs: (d.outputs || []).map((out) => ({
          name: out.name,
          icon: out.icon,
          description: out.description,
        })),
        executionRules: (d.executionRules || []).map((r) => ({
          rule: r.rule,
          detail: r.detail,
          source: r.source,
        })),
        isCondition: d.isCondition,
        conditionBranches: d.conditionBranches || null,
        executionType: tc.executionType,
      };
    }),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: (e.label as string) || "",
      style: inferEdgeStyle(e),
    })),
  };

  // Build human/LLM readable text representation
  const edgeMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
    edgeMap.get(e.source)!.push(`→ [${(e.label as string) || ""}] → ${e.target}`);
  }

  const lines: string[] = ["## 流程图结构\n"];

  for (const n of nodes) {
    const d = n.data as unknown as FlowNodeData;
    if (!d) continue;
    const tc = d.techConfig ?? { executionType: "deterministic" };
    const mode = { ai_auto: "AI自动", human_confirm: "需人工确认", human_manual: "人工操作" }[d.executionMode] || "未知";
    const type = tc.executionType === "deterministic" ? "确定性执行" : "智能规划";

    lines.push(`### ${n.id}: ${d.label || "未命名"}`);
    lines.push(`- 描述: ${d.description || ""}`);
    lines.push(`- 执行方式: ${mode} | ${type}`);
    lines.push(`- 预计耗时: ${d.estimatedTime || "待定"}`);

    const inputs = d.inputs || [];
    if (inputs.length > 0) {
      lines.push(`- 输入:`);
      for (const inp of inputs) {
        const src = inp.source === "user" ? "用户提供" : inp.sourceDetail || "上一步";
        lines.push(`  - ${inp.name} (${src}${inp.required ? ", 必填" : ""})`);
      }
    }

    const outputs = d.outputs || [];
    if (outputs.length > 0) {
      lines.push(`- 输出:`);
      for (const out of outputs) {
        lines.push(`  - ${out.name}: ${out.description}`);
      }
    }

    const rules = d.executionRules || [];
    if (rules.length > 0) {
      lines.push(`- 执行规则:`);
      for (const r of rules) {
        const src = r.source === "user_confirmed" ? "✅用户确认" : "🤖AI推断";
        lines.push(`  - [${src}] ${r.rule}: ${r.detail}`);
      }
    }

    if (d.isCondition && d.conditionBranches) {
      lines.push(`- 条件分支:`);
      for (const b of d.conditionBranches) {
        lines.push(`  - ${b.icon} ${b.label} → ${b.targetLabel}`);
      }
    }

    const outEdges = edgeMap.get(n.id);
    if (outEdges) {
      lines.push(`- 连接: ${outEdges.join(", ")}`);
    }

    lines.push("");
  }

  // Show parallel branches explicitly
  const rootNodes = findRootNodes(nodes, edges);
  const convergenceNodes = findConvergenceNodes(nodes, edges);
  if (rootNodes.length > 1) {
    lines.push(`\n注意: 有 ${rootNodes.length} 个并行起点: ${rootNodes.map((n) => n.id).join(", ")}`);
  }
  if (convergenceNodes.length > 0) {
    lines.push(`汇聚节点: ${convergenceNodes.map((n) => n.id).join(", ")}`);
  }

  return { json, readable: lines.join("\n") };
}

function inferEdgeStyle(e: Edge): string {
  const stroke = (e.style as Record<string, string>)?.stroke;
  if (stroke === "#22c55e") return "success";
  if (stroke === "#ef4444") return "error";
  if (stroke === "#f59e0b") return "loop";
  return "normal";
}

function findRootNodes(nodes: Node[], edges: Edge[]): Node[] {
  const targets = new Set(edges.map((e) => e.target));
  return nodes.filter((n) => !targets.has(n.id));
}

function findConvergenceNodes(nodes: Node[], edges: Edge[]): Node[] {
  const inCount = new Map<string, number>();
  for (const e of edges) {
    inCount.set(e.target, (inCount.get(e.target) || 0) + 1);
  }
  return nodes.filter((n) => (inCount.get(n.id) || 0) > 1);
}

interface WorkflowTechNodeConfig {
  id: string;
  executionType?: "deterministic" | "intelligent";
  executionRules?: { rule: string; detail: string; source: string }[];
  errorHandling?: { strategy: string; enabled: boolean; config?: Record<string, unknown> }[];
  techConfig?: {
    executionType?: string;
    boundSkill?: string;
    evaluator?: string;
    timeout?: number;
  };
  inputDataTypes?: Record<string, string>;
  outputDataTypes?: Record<string, string>;
}

export function mergeWorkflowTechConfig(
  nodes: Node<FlowNodeData>[],
  techNodes: WorkflowTechNodeConfig[]
): Node<FlowNodeData>[] {
  const techMap = new Map(techNodes.map((tn) => [tn.id, tn]));

  return nodes.map((node) => {
    const tech = techMap.get(node.id);
    if (!tech) return node;

    const d = node.data as FlowNodeData;
    const mergedRules = tech.executionRules?.length
      ? tech.executionRules.map((r) => ({
          rule: r.rule,
          detail: r.detail,
          source: (r.source || "ai_inferred") as "ai_inferred" | "user_confirmed",
        }))
      : d.executionRules;

    const mergedErrorHandling = tech.errorHandling?.length
      ? tech.errorHandling.map((eh) => ({
          strategy: eh.strategy as "retry" | "human_fallback" | "skip" | "abort",
          enabled: eh.enabled,
          config: eh.config,
        }))
      : d.errorHandling;

    const execType = tech.executionType || tech.techConfig?.executionType || d.techConfig?.executionType || "deterministic";
    const mergedTechConfig = {
      ...d.techConfig,
      executionType: execType as "deterministic" | "intelligent",
      boundSkill: tech.techConfig?.boundSkill || d.techConfig?.boundSkill,
      evaluator: tech.techConfig?.evaluator || d.techConfig?.evaluator,
      timeout: tech.techConfig?.timeout || d.techConfig?.timeout,
    };

    const mergedInputs = d.inputs.map((inp) => ({
      ...inp,
      dataType: tech.inputDataTypes?.[inp.name] || inp.dataType,
    }));

    const mergedOutputs = d.outputs.map((out) => ({
      ...out,
      dataType: tech.outputDataTypes?.[out.name] || out.dataType,
    }));

    return {
      ...node,
      data: {
        ...d,
        executionRules: mergedRules,
        errorHandling: mergedErrorHandling,
        techConfig: mergedTechConfig,
        inputs: mergedInputs,
        outputs: mergedOutputs,
      },
    };
  });
}
