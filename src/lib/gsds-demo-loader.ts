import { useFlowAgentStore } from "./store";
import {
  GSDS_NODES,
  GSDS_EDGES,
  GSDS_TECH_CONFIG,
  GSDS_TECH_BINDINGS,
  GSDS_CHAT_MESSAGES,
  GSDS_TECH_JOB_META,
  GSDS_JOB_TRIGGER_CODES,
} from "./gsds-demo-seed";

/**
 * 一键加载 GSDS 入库流程 demo 到 store，
 * 同时切换为 tech 视角、填充 techConfig 和绑定数据。
 */
export function loadGsdsDemo() {
  const s = useFlowAgentStore.getState();
  s.resetAll();

  // Delay to let ReactFlow detect the empty→filled transition and trigger fitView
  requestAnimationFrame(() => {
    useFlowAgentStore.setState({
      project: {
        id: "gsds-ingest-demo",
        name: "GSDS 入库 Job",
        description: "上传并查重（条件分支）→ PDF 解析（含校验）→ 人工比对 → 入库",
        status: "tech_reviewing",
        createdAt: "2026-04-28T14:00:00Z",
        updatedAt: "2026-04-28T16:00:00Z",
      },
      currentRole: "tech",
      viewMode: "tech",
      taskType: "workflow",
      chatPhase: "ready",
      originalPrompt: "GSDS 入库流程",
      nodes: GSDS_NODES,
      edges: GSDS_EDGES,
      chatMessages: GSDS_CHAT_MESSAGES,
      techConfig: GSDS_TECH_CONFIG,
      techBindings: GSDS_TECH_BINDINGS,
      techJobMeta: GSDS_TECH_JOB_META,
      jobTriggerCodes: [...GSDS_JOB_TRIGGER_CODES],
    });
  });
}
