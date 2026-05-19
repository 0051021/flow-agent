"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  Loader2,
  Server,
  FileText,
  Database,
  ChevronRight,
  ChevronDown,
  Settings,
  Zap,
} from "lucide-react";
import type { Node } from "@xyflow/react";
import { useFlowAgentStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { computeBindingCompletion } from "@/lib/tech-binding-helpers";
import BindingGlobalSection from "./tech-workspace/BindingGlobalSection";
import BindingDocumentsSection from "./tech-workspace/BindingDocumentsSection";
import BindingExternalsSection from "./tech-workspace/BindingExternalsSection";
import AdaptiveConfigSection from "./tech-workspace/AdaptiveConfigSection";
import type {
  FlowNodeData,
  TechWorkspaceBindingTabId,
  NodeGuard,
  GuardMonitor,
  GuardCheck,
  TechTabState,
} from "@/lib/types";

// --- Reusable collapsible (matches AgenticConfigPanel Section) ---

function Section({
  title,
  badge,
  badgeClassName,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  badgeClassName?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-0 my-2 rounded-xl border border-indigo-100/50 bg-white/70 backdrop-blur-sm overflow-hidden shadow-[0_1px_3px_rgba(99,102,241,0.04)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-white/90 transition-colors"
      >
        <span className="text-[12px] font-semibold text-slate-700">{title}</span>
        {badge && (
          <Badge
            className={`text-[10px] h-[18px] px-1.5 border-0 ${badgeClassName ?? "bg-indigo-50 text-indigo-500"}`}
          >
            {badge}
          </Badge>
        )}
        <div className="ml-auto text-slate-400">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>
      {open && <div className="px-3 pb-3 border-t border-indigo-50">{children}</div>}
    </div>
  );
}

// --- Small UI helpers ---



const MONITOR_TYPE_BADGE: Record<GuardMonitor["type"], { label: string; class: string }> = {
  structural: { label: "结构", class: "bg-slate-100/80 text-slate-600" },
  statistical: { label: "统计", class: "bg-indigo-50 text-indigo-600" },
  sampling: { label: "抽样", class: "bg-violet-50 text-violet-600" },
};

const CHECK_RULE_BADGE: Record<GuardCheck["rule"], { label: string; class: string }> = {
  not_empty: { label: "非空", class: "bg-slate-100/80 text-slate-600" },
  type_check: { label: "类型", class: "bg-indigo-50 text-indigo-600" },
  range: { label: "范围", class: "bg-amber-50/80 text-amber-700" },
  format: { label: "格式", class: "bg-violet-50 text-violet-600" },
};

// --- Tab skeletons ---

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm px-4 text-center">{text}</div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50/80 backdrop-blur-sm px-3 py-2 text-[12px] text-red-700">{message}</div>
  );
}

function useNodeLabelMap(nodes: Node<FlowNodeData>[]) {
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) m.set(n.id, n.data?.label ?? n.id);
    return m;
  }, [nodes]);
}

// --- Sub-panels per tab ---





function GuardsTabContent({ status, nodeGuards, nodeLabel }: { status: TechTabState["status"]; nodeGuards: NodeGuard[] | null; nodeLabel: (id: string) => string }) {
  if (status === "generating") {
    return <LoadingBlock label="正在生成质量守护配置…" />;
  }
  if (status === "idle" && (!nodeGuards || nodeGuards.length === 0)) {
    return <EmptyBlock text="暂无质量守护规则。" />;
  }
  if (!nodeGuards || nodeGuards.length === 0) {
    return <EmptyBlock text="本页无守护数据。" />;
  }

  return (
    <div className="space-y-1">
      {nodeGuards.map((g) => (
        <Section
          key={g.nodeId}
          title={nodeLabel(g.nodeId)}
          badge={`${g.monitors.length} 条监测`}
          badgeClassName="bg-emerald-50 text-emerald-700"
          defaultOpen={false}
        >
          <div className="pt-1 space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-1.5">监测规则</p>
              <div className="space-y-2">
                {g.monitors.map((m, i) => {
                  const mt = MONITOR_TYPE_BADGE[m.type];
                  return (
                    <div key={i} className="rounded-lg border border-indigo-100/40 bg-white/60 backdrop-blur-sm p-2.5">
                      <div className="flex items-center flex-wrap gap-1.5 mb-1">
                        <Badge className={`text-[9px] h-4 px-1.5 border-0 ${mt.class}`}>{mt.label}</Badge>
                        <span className="text-[12px] text-slate-700">{m.description}</span>
                        {m.threshold != null && (
                          <span className="text-[10px] text-slate-400">阈值 {m.threshold}</span>
                        )}
                      </div>
                      {m.checks.length > 0 && (
                        <ul className="mt-1.5 space-y-1 text-[10px] text-slate-500">
                          {m.checks.map((c, j) => {
                            const r = CHECK_RULE_BADGE[c.rule];
                            return (
                              <li key={j} className="flex flex-wrap items-center gap-1.5">
                                <Badge className={`text-[8px] h-3.5 px-1 border-0 ${r.class}`}>{r.label}</Badge>
                                <code className="text-slate-600">{c.field}</code>
                                <span className="text-slate-400">|</span>
                                <span>{c.severity === "error" ? "错误" : "警告"}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {g.issueCategories.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 mb-1">Issue 分类</p>
                <div className="flex flex-wrap gap-1">
                  {g.issueCategories.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] h-5 font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-1">升级策略</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-amber-100/60 bg-amber-50/40 backdrop-blur-sm p-2">
                  <p className="text-[10px] text-amber-700 font-medium mb-1">业务员</p>
                  {g.escalation.business.length === 0 ? (
                    <p className="text-slate-400">—</p>
                  ) : (
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                      {g.escalation.business.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-indigo-100/60 bg-indigo-50/40 backdrop-blur-sm p-2">
                  <p className="text-[10px] text-indigo-600 font-medium mb-1">技术员</p>
                  {g.escalation.tech.length === 0 ? (
                    <p className="text-slate-400">—</p>
                  ) : (
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                      {g.escalation.tech.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Section>
      ))}
    </div>
  );
}

// --- Main ---


const BINDING_TAB_DEFS: {
  id: TechWorkspaceBindingTabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "binding_global", label: "全局配置", icon: Settings },
  { id: "binding_documents", label: "文档资源", icon: FileText },
  { id: "binding_externals", label: "外部系统", icon: Database },
  { id: "adaptive", label: "自适应配置", icon: Zap },
];

export default function TechWorkspacePanel() {
  const { nodes, techConfig, techBindings, techJobMeta, jobTriggerCodes } = useFlowAgentStore();
  const nodeLabelMap = useNodeLabelMap(nodes);
  const nodeLabel = (id: string) => nodeLabelMap.get(id) ?? id;

  const tabStates = techConfig.tabStates;

  const completion = useMemo(
    () =>
      computeBindingCompletion(
        techBindings,
        nodes,
        techConfig.documents,
        techConfig.externals,
        {
          jobMeta: { code: techJobMeta.code, name: techJobMeta.name },
          jobTriggerCodes,
        }
      ),
    [techBindings, nodes, techConfig.documents, techConfig.externals, techJobMeta, jobTriggerCodes]
  );

  const pct = completion.percent;
  const r = 13;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="shrink-0 border-b border-indigo-100/50 bg-white/60 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 ring-1 ring-indigo-200/50 flex items-center justify-center">
          <Server className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">技术工作区</h2>
          <p className="text-[11px] text-slate-500 leading-snug">
            回填技术资源与运行配置 · 完成度{" "}
            <span className="text-indigo-600 font-semibold">{pct}%</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            全局信息在这里填写；每个节点的执行方式、技能和运行时配置请点击画布节点填写。
          </p>
        </div>
        <svg width="36" height="36" className="shrink-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={r} fill="none" stroke="#e0e7ff" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
      </div>

      <Tabs defaultValue="binding_global" className="flex-1 flex flex-col min-h-0">
        <TabsList
          variant="line"
          className="w-full justify-start h-auto min-h-9 shrink-0 rounded-none border-b border-indigo-100/40 bg-white/40 backdrop-blur-sm px-2 overflow-x-auto"
        >
          {BINDING_TAB_DEFS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="text-xs px-2.5 py-2 gap-1.5 data-active:after:bottom-0 data-active:text-indigo-600 data-active:after:bg-indigo-500 shrink-0"
            >
              <Icon className="w-3.5 h-3.5 text-slate-400 group-data-active:text-indigo-500" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="binding_global" className="flex-1 min-h-0 mt-0 p-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 h-full">
            <div className="p-4 pb-6 space-y-4">
              <BindingGlobalSection />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="binding_documents" className="flex-1 min-h-0 mt-0 p-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 h-full">
            <div className="p-4 pb-6 space-y-4">
              <BindingDocumentsSection />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="binding_externals" className="flex-1 min-h-0 mt-0 p-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 h-full">
            <div className="p-4 pb-6 space-y-4">
              <BindingExternalsSection />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="adaptive" className="flex-1 min-h-0 mt-0 p-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 h-full">
            <div className="p-4 pb-6 space-y-4">
              <p className="text-[11px] text-slate-500">
                配置运行时可调整参数、环境假设和自动调整策略。
              </p>
              <AdaptiveConfigSection />
              <Section title="AI 参考 · 质量守护" badge="只读" defaultOpen={false}>
                {tabStates.guards.status === "error" && tabStates.guards.error && (
                  <ErrorBanner message={tabStates.guards.error} />
                )}
                <GuardsTabContent
                  status={tabStates.guards.status}
                  nodeGuards={techConfig.guards?.guards ?? null}
                  nodeLabel={nodeLabel}
                />
              </Section>
            </div>
          </ScrollArea>
        </TabsContent>

      </Tabs>
    </div>
  );
}
