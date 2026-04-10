"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useFlowAgentStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target, ChevronRight, ChevronDown, Clock, CheckCircle2,
  AlertTriangle, Zap, Users, Layers,
  Send, ExternalLink, Copy, Check, X,
  Eye, Brain, Play, MessageSquare,
  ArrowRight, ArrowDown, RotateCcw, Pause,
  Database, Globe, Timer, Cpu, GitBranch,
  Shield, BarChart3, Activity, RefreshCw,
  Calendar, Bolt, AlertCircle, Workflow,
} from "lucide-react";
import type {
  AgenticSkill, AgenticEvaluator, AgenticPhase,
  AgenticSkillOrchestration, AgenticDecisionLoop,
  AgenticContextLayer, AgenticSchedule, AgenticFallback,
} from "@/lib/types";

function buildConfigSummary(config: NonNullable<ReturnType<typeof useFlowAgentStore.getState>["agenticConfig"]>, projectName: string) {
  return {
    agent_name: projectName,
    goal: config.goal,
    execution_strategy: config.executionStrategy,
    max_iterations: config.maxIterations,
    skills: config.skills.map((s: AgenticSkill) => ({ name: s.name, inputs: s.inputs.map((i) => i.name), outputs: s.outputs.map((o) => o.name) })),
    constraints: config.constraints.map((c) => ({ type: c.type, rule: c.value })),
    evaluators: config.evaluators.map((e: AgenticEvaluator) => ({ name: e.name, metrics: e.metrics.map((m) => `${m.name} ${m.threshold}`) })),
    human_checkpoints: config.humanCheckpoints,
    decision_loop: config.decisionLoop,
    skill_orchestration: config.skillOrchestration ? {
      dependencies: config.skillOrchestration.dependencies.length,
      parallel_groups: config.skillOrchestration.parallelGroups?.length ?? 0,
      failure_policies: config.skillOrchestration.failurePolicy.length,
    } : null,
    context_layers: config.contextArchitecture,
    schedule: config.schedule,
  };
}

// Reusable collapsible section wrapper
function Section({ icon: Icon, iconColor, title, badge, badgeColor, defaultOpen = false, children }: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-4 my-2 rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-zinc-50/50 transition-colors"
      >
        <Icon className={`w-4 h-4 ${iconColor} shrink-0`} />
        <span className="text-[13px] font-semibold text-zinc-800">{title}</span>
        {badge && (
          <Badge className={`text-[10px] h-[18px] px-1.5 border-0 ${badgeColor || "bg-zinc-100 text-zinc-500"}`}>
            {badge}
          </Badge>
        )}
        <div className="ml-auto">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
        </div>
      </button>
      {open && <div className="px-4 pb-4 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

export default function AgenticConfigPanel() {
  const { agenticConfig, chatPhase, project, currentRole } = useFlowAgentStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const isReady = chatPhase === "agentic_ready";
  const isTech = currentRole === "tech";

  if (!agenticConfig) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        等待 AI 生成任务配置...
      </div>
    );
  }

  const configJson = buildConfigSummary(agenticConfig, project.name || "未命名 Agent");

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setShowJson(true);
      useFlowAgentStore.getState().setProjectStatus("tech_reviewing");
      toast.success("已提交至管控后台");
    }, 1500);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(configJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasOrchestration = agenticConfig.skillOrchestration && agenticConfig.skillOrchestration.dependencies.length > 0;
  const hasDecisionLoop = agenticConfig.decisionLoop && agenticConfig.decisionLoop.observe.length > 0;
  const hasContext = agenticConfig.contextArchitecture && agenticConfig.contextArchitecture.shortTerm.length > 0;
  const hasSchedule = agenticConfig.schedule && agenticConfig.schedule.triggers.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-100/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900">Agent 运行架构</h2>
            <p className="text-[11px] text-zinc-400">技术视角</p>
          </div>
          <Badge className="text-[10px] h-5 bg-blue-50 text-blue-700 border-0">
            {agenticConfig.executionStrategy === "adaptive" ? "自适应" : agenticConfig.executionStrategy === "parallel" ? "并行" : "顺序"}
          </Badge>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Overview card — always visible, not collapsible */}
        <div className="mx-4 my-2 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-[13px] font-semibold text-zinc-800">业务目标</span>
          </div>
          <p className="text-[13px] text-zinc-700 leading-relaxed">{agenticConfig.goal}</p>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{agenticConfig.totalDays}天</span>
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{agenticConfig.phases.length}阶段</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{agenticConfig.skills.length}技能</span>
            <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" />迭代{agenticConfig.maxIterations}次</span>
          </div>
        </div>

        {/* Skill Orchestration — default OPEN (most important for tech) */}
        {hasOrchestration && (
          <Section
            icon={GitBranch} iconColor="text-violet-600"
            title="技能编排"
            badge={`${agenticConfig.skillOrchestration!.dependencies.length}条链路`}
            badgeColor="bg-violet-50 text-violet-600"
            defaultOpen
          >
            <SkillOrchestrationContent
              skills={agenticConfig.skills}
              orchestration={agenticConfig.skillOrchestration!}
            />
          </Section>
        )}

        {!hasOrchestration && agenticConfig.skills.length > 0 && (
          <Section icon={Zap} iconColor="text-violet-600" title="技能列表" badge={`${agenticConfig.skills.length}`} badgeColor="bg-violet-50 text-violet-600" defaultOpen>
            <SkillListContent skills={agenticConfig.skills} />
          </Section>
        )}

        {/* Decision Loop — default closed */}
        {hasDecisionLoop && (
          <Section icon={RotateCcw} iconColor="text-green-600" title="决策循环" badge="OODA" badgeColor="bg-green-50 text-green-600">
            <DecisionLoopContent loop={agenticConfig.decisionLoop!} />
          </Section>
        )}

        {/* Phase ↔ Skill Mapping — default closed */}
        {agenticConfig.phases.length > 0 && agenticConfig.skills.length > 0 && (
          <Section icon={Workflow} iconColor="text-orange-600" title="阶段 → 技能映射" badge={`${agenticConfig.phases.length}阶段`} badgeColor="bg-orange-50 text-orange-600">
            <PhaseSkillContent phases={agenticConfig.phases} skills={agenticConfig.skills} />
          </Section>
        )}

        {/* Context — default closed */}
        {hasContext && (
          <Section icon={Database} iconColor="text-violet-600" title="上下文架构" badgeColor="bg-violet-50 text-violet-600">
            <ContextContent context={agenticConfig.contextArchitecture!} />
          </Section>
        )}

        {/* Schedule — default closed */}
        {hasSchedule && (
          <Section icon={Calendar} iconColor="text-blue-600" title="触发器与调度" badge={`${agenticConfig.schedule!.triggers.length}`} badgeColor="bg-blue-50 text-blue-600">
            <ScheduleContent schedule={agenticConfig.schedule!} />
          </Section>
        )}

        {/* Evaluators — default closed */}
        {agenticConfig.evaluators.length > 0 && (
          <Section icon={BarChart3} iconColor="text-emerald-600" title="评估体系" badge={`${agenticConfig.evaluators.length}`} badgeColor="bg-emerald-50 text-emerald-600">
            <EvaluatorsContent evaluators={agenticConfig.evaluators} />
          </Section>
        )}

        {/* Fallbacks + Human Checkpoints — combined into one section */}
        {(agenticConfig.fallbacks.length > 0 || agenticConfig.humanCheckpoints.length > 0) && (
          <Section icon={Shield} iconColor="text-red-600" title="兜底与审批" badge={`${agenticConfig.fallbacks.length + agenticConfig.humanCheckpoints.length}`} badgeColor="bg-red-50 text-red-600">
            <SafeguardsContent fallbacks={agenticConfig.fallbacks} checkpoints={agenticConfig.humanCheckpoints} />
          </Section>
        )}

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>

      {/* Submitted: config JSON preview */}
      {submitted && showJson && (
        <div className="border-t border-zinc-200 bg-white shrink-0">
          <div className="px-5 pt-3 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已提交，等待技术方评审
            </div>
            <button onClick={() => setShowJson(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mx-5 mb-2 rounded-lg bg-zinc-900 text-green-400 text-[11px] font-mono leading-relaxed max-h-40 overflow-y-auto p-3 relative">
            <button onClick={handleCopyJson} className="absolute top-2 right-2 p-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors" title="复制 JSON">
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <pre className="whitespace-pre-wrap">{JSON.stringify(configJson, null, 2)}</pre>
          </div>
          <div className="px-5 pb-3">
            <Button variant="outline" className="w-full text-xs h-8" onClick={() => router.push("/console/agents")}>
              <ExternalLink className="w-3 h-3 mr-1.5" />
              前往管控后台查看
            </Button>
          </div>
        </div>
      )}

      {/* Footer actions */}
      {isReady && !submitted && (
        <div className="px-5 py-3 border-t border-zinc-200 bg-white shrink-0">
          {isTech ? (
            <p className="text-[11px] text-zinc-500">确认技能编排、触发器、评估体系合理后，点击顶部「评审通过」</p>
          ) : (
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-sm h-9" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <><div className="w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />正在提交...</>
              ) : (
                <><Send className="w-3.5 h-3.5 mr-1.5" />提交至管控后台</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Skill Orchestration — flow chain + expandable details
// ============================================================

function SkillOrchestrationContent({ skills, orchestration }: {
  skills: AgenticSkill[];
  orchestration: AgenticSkillOrchestration;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  const parallelSet = new Set<string>();
  orchestration.parallelGroups?.forEach((group) => group.forEach((id) => parallelSet.add(id)));
  const failurePolicyMap = new Map(orchestration.failurePolicy.map((p) => [p.skillId, p]));

  const FAILURE_LABELS: Record<string, { label: string; color: string }> = {
    retry: { label: "重试", color: "text-blue-600 bg-blue-50" },
    skip: { label: "跳过", color: "text-zinc-500 bg-zinc-50" },
    abort: { label: "中止", color: "text-red-600 bg-red-50" },
    fallback: { label: "降级", color: "text-amber-600 bg-amber-50" },
  };

  return (
    <div className="pt-3 space-y-3">
      {/* Compact flow chain */}
      <div className="space-y-1.5">
        {orchestration.dependencies.map((dep, i) => {
          const fromSkill = skillMap.get(dep.from);
          const toSkill = skillMap.get(dep.to);
          const isFromParallel = parallelSet.has(dep.from);
          const isToParallel = parallelSet.has(dep.to);
          return (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className={`px-2 py-1 rounded-md font-medium ${isFromParallel ? "bg-green-50 text-green-700 border border-green-200" : "bg-zinc-50 text-zinc-700 border border-zinc-200"}`}>
                {fromSkill?.name || dep.from}
              </span>
              <ArrowRight className="w-3 h-3 text-zinc-300 shrink-0" />
              <span className={`px-2 py-1 rounded-md font-medium ${isToParallel ? "bg-green-50 text-green-700 border border-green-200" : "bg-zinc-50 text-zinc-700 border border-zinc-200"}`}>
                {toSkill?.name || dep.to}
              </span>
              <span className="text-zinc-400 text-[10px] ml-1 truncate">{dep.dataFlow}</span>
            </div>
          );
        })}
      </div>

      {/* Parallel groups */}
      {orchestration.parallelGroups && orchestration.parallelGroups.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-green-600">
          <Activity className="w-3 h-3" />
          <span>可并行：</span>
          {orchestration.parallelGroups.map((group, gi) => (
            <span key={gi} className="font-medium">{group.map((id) => skillMap.get(id)?.name || id).join(" + ")}</span>
          ))}
        </div>
      )}

      {/* Toggle details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-[11px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
      >
        {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {showDetails ? "收起技能详情" : "展开技能详情"}（输入/输出/失败策略）
      </button>

      {showDetails && (
        <div className="space-y-2">
          {skills.map((skill) => {
            const policy = failurePolicyMap.get(skill.id);
            return (
              <div key={skill.id} className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="w-3 h-3 text-violet-500" />
                  <span className="text-[11px] font-semibold text-zinc-800">{skill.name}</span>
                  {policy && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ml-auto ${FAILURE_LABELS[policy.action]?.color || ""}`}>
                      失败→{FAILURE_LABELS[policy.action]?.label}{policy.maxRetries ? `×${policy.maxRetries}` : ""}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mb-1.5">{skill.description}</p>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="flex flex-wrap gap-1">
                    {skill.inputs.map((inp, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{inp.name}</span>
                    ))}
                  </div>
                  <ArrowRight className="w-2.5 h-2.5 text-zinc-300 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {skill.outputs.map((out, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-100">{out.name}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkillListContent({ skills }: { skills: AgenticSkill[] }) {
  return (
    <div className="pt-3 space-y-2">
      {skills.map((skill) => (
        <div key={skill.id} className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3 h-3 text-violet-500" />
            <span className="text-[11px] font-semibold text-zinc-800">{skill.name}</span>
          </div>
          <p className="text-[10px] text-zinc-500">{skill.description}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Decision Loop — horizontal 4-column layout
// ============================================================

function DecisionLoopContent({ loop }: { loop: AgenticDecisionLoop }) {
  const stages: { key: keyof AgenticDecisionLoop; label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }[] = [
    { key: "observe", label: "观察", icon: Eye, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
    { key: "evaluate", label: "评估", icon: Brain, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
    { key: "act", label: "行动", icon: Play, color: "text-green-600", bg: "bg-green-50 border-green-100" },
    { key: "feedback", label: "反馈", icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
  ];

  return (
    <div className="pt-3">
      <div className="grid grid-cols-2 gap-2">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const items = loop[stage.key];
          return (
            <div key={stage.key} className={`rounded-lg border p-2.5 ${stage.bg}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3 h-3 ${stage.color}`} />
                <span className={`text-[11px] font-semibold ${stage.color}`}>{stage.label}</span>
              </div>
              <div className="space-y-0.5">
                {items.map((item, i) => (
                  <p key={i} className="text-[10px] text-zinc-600 leading-snug">• {item}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-zinc-400">
        <RotateCcw className="w-3 h-3" />
        <span>持续循环直到达成退出条件</span>
      </div>
    </div>
  );
}

// ============================================================
// Phase ↔ Skill Mapping — compact table
// ============================================================

function capMatchesSkill(cap: string, skill: AgenticSkill): boolean {
  const capLower = cap.toLowerCase();
  const nameLower = skill.name.toLowerCase();
  const descLower = skill.description.toLowerCase();

  if (nameLower.includes(capLower) || capLower.includes(nameLower)) return true;
  if (descLower.includes(capLower)) return true;

  const capTokens = capLower.split(/[\s/（）()·、，]+/).filter(Boolean);
  return capTokens.some((token) => token.length >= 2 && (nameLower.includes(token) || descLower.includes(token)));
}

function PhaseSkillContent({ phases, skills }: { phases: AgenticPhase[]; skills: AgenticSkill[] }) {
  return (
    <div className="pt-3">
      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-violet-200" />
          <span className="text-zinc-500">已有技能覆盖</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-200" />
          <span className="text-zinc-500">待补充技能</span>
        </span>
      </div>

      <div className="space-y-1.5">
        {phases.map((phase) => {
          const caps = phase.requiredCapabilities || [];
          const matched = caps.filter((cap) => skills.some((s) => capMatchesSkill(cap, s)));
          const unmatched = caps.filter((cap) => !skills.some((s) => capMatchesSkill(cap, s)));
          return (
            <div key={phase.id} className="flex items-start gap-2.5 py-2 border-b border-zinc-100 last:border-0">
              <div className="shrink-0 w-[120px]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${phase.status === "confirmed" ? "bg-green-500" : phase.status === "reviewing" ? "bg-amber-500" : "bg-zinc-300"}`} />
                  <span className="text-[11px] font-medium text-zinc-800 truncate">{phase.name}</span>
                </div>
                <span className="text-[10px] text-zinc-400 ml-3">D{phase.dayRange[0]}-{phase.dayRange[1]}</span>
              </div>
              <div className="flex flex-wrap gap-1 flex-1">
                {matched.map((cap) => (
                  <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">{cap}</span>
                ))}
                {unmatched.map((cap) => (
                  <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 flex items-center gap-0.5">
                    {cap}<AlertCircle className="w-2.5 h-2.5" />
                  </span>
                ))}
                {caps.length === 0 && <span className="text-[10px] text-zinc-400">—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Context Architecture — 3 rows
// ============================================================

function ContextContent({ context }: { context: AgenticContextLayer }) {
  const layers: { key: keyof AgenticContextLayer; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { key: "shortTerm", label: "短期记忆", icon: Timer, color: "text-blue-600" },
    { key: "longTerm", label: "长期记忆", icon: Database, color: "text-violet-600" },
    { key: "external", label: "外部数据源", icon: Globe, color: "text-green-600" },
  ];

  return (
    <div className="pt-3 space-y-2.5">
      {layers.map((layer) => {
        const items = context[layer.key];
        if (!items || items.length === 0) return null;
        const Icon = layer.icon;
        return (
          <div key={layer.key}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3 h-3 ${layer.color}`} />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{layer.label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {items.map((item, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-zinc-600">{item}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Schedule — compact list
// ============================================================

function ScheduleContent({ schedule }: { schedule: AgenticSchedule }) {
  const TRIGGER_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
    cron: { icon: Calendar, label: "定时", color: "text-blue-600 bg-blue-50 border-blue-100" },
    event: { icon: Bolt, label: "事件", color: "text-green-600 bg-green-50 border-green-100" },
    threshold: { icon: AlertTriangle, label: "阈值", color: "text-amber-600 bg-amber-50 border-amber-100" },
  };

  return (
    <div className="pt-3 space-y-1.5">
      {schedule.triggers.map((trigger, i) => {
        const style = TRIGGER_STYLES[trigger.type] || TRIGGER_STYLES.cron;
        const Icon = style.icon;
        const humanReadable = trigger.type === "cron" ? cronToHuman(trigger.config) : trigger.config;
        return (
          <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${style.color}`}>
            <Icon className="w-3 h-3 shrink-0" />
            <span className="text-[11px] font-medium flex-1">{trigger.description}</span>
            <span className="text-[10px] opacity-70 shrink-0" title={trigger.type === "cron" ? `cron: ${trigger.config}` : undefined}>
              {humanReadable}
            </span>
          </div>
        );
      })}
      {schedule.cooldown && (
        <p className="text-[10px] text-zinc-400 flex items-center gap-1 pt-1"><Clock className="w-3 h-3" />冷却: {schedule.cooldown}</p>
      )}
    </div>
  );
}

function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;
  const [min, hour, , , dow] = parts;

  const dowMap: Record<string, string> = { "0": "周日", "1": "周一", "2": "周二", "3": "周三", "4": "周四", "5": "周五", "6": "周六" };
  let dayStr = "";
  if (dow === "*") {
    dayStr = "每天";
  } else if (dow === "1-5") {
    dayStr = "工作日";
  } else if (dowMap[dow]) {
    dayStr = `每${dowMap[dow]}`;
  } else {
    dayStr = `每周${dow}`;
  }

  const hourNum = parseInt(hour);
  const minStr = min === "0" ? "00" : min;
  const timeStr = `${hourNum}:${minStr}`;

  return `${dayStr} ${timeStr}`;
}

// ============================================================
// Evaluators — compact metrics
// ============================================================

function EvaluatorsContent({ evaluators }: { evaluators: AgenticEvaluator[] }) {
  return (
    <div className="pt-3 space-y-2">
      {evaluators.map((ev) => (
        <div key={ev.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 overflow-hidden">
          <div className="px-2.5 py-2 flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3 text-emerald-500" />
            <span className="text-[11px] font-semibold text-zinc-800">{ev.name}</span>
          </div>
          <div className="px-2.5 pb-2 space-y-1">
            {ev.metrics.map((metric, mi) => (
              <div key={mi} className="flex items-center gap-2 text-[10px]">
                <span className="text-zinc-600 flex-1">{metric.name}</span>
                <div className="w-12 h-1 rounded-full bg-zinc-200 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${metric.weight * 100}%` }} />
                </div>
                <span className="text-zinc-400 shrink-0 w-[60px] text-right">{metric.threshold}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Safeguards — fallbacks + human checkpoints combined
// ============================================================

function SafeguardsContent({ fallbacks, checkpoints }: { fallbacks: AgenticFallback[]; checkpoints: string[] }) {
  const SEVERITY_STYLES: Record<string, string> = {
    critical: "bg-red-50 border-red-100 text-red-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
    info: "bg-blue-50 border-blue-100 text-blue-700",
  };

  return (
    <div className="pt-3 space-y-1.5">
      {fallbacks.map((fb, i) => (
        <div key={`fb-${i}`} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border ${SEVERITY_STYLES[fb.severity] || SEVERITY_STYLES.info}`}>
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium">{fb.trigger}</p>
            <p className="text-[10px] opacity-70">{fb.action}</p>
          </div>
        </div>
      ))}
      {checkpoints.map((cp, i) => (
        <div key={`cp-${i}`} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-amber-50 border-amber-100 text-amber-700">
          <Pause className="w-3 h-3 shrink-0" />
          <span className="text-[11px]">{cp}</span>
        </div>
      ))}
    </div>
  );
}
