"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity, TrendingUp, Target, DollarSign, Settings2,
  Lightbulb, ThumbsUp, ThumbsDown, GitBranch,
  Play, CheckCircle2, XCircle, UserCheck, BarChart3,
  Flag, ShieldAlert, Clock, Send, Pause, Wallet,
  RefreshCw, MessageSquare, ChevronDown, ChevronUp,
  AlertTriangle,
} from "lucide-react";
import type { AgenticDashboardData, StrategyVersion, SpendItem } from "@/lib/mock-console";
import type { TaskEvent, TaskEventType } from "@/lib/types";

const TABS = [
  { id: "overview", label: "概览", icon: Activity },
  { id: "analytics", label: "数据", icon: BarChart3 },
  { id: "strategy", label: "策略", icon: Settings2 },
  { id: "logs", label: "日志", icon: Clock },
] as const;

type TabId = (typeof TABS)[number]["id"];

const EVENT_ICONS: Record<TaskEventType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  node_start: { icon: Play, color: "text-blue-500 bg-blue-50" },
  node_complete: { icon: CheckCircle2, color: "text-green-500 bg-green-50" },
  node_error: { icon: XCircle, color: "text-red-500 bg-red-50" },
  human_confirm: { icon: UserCheck, color: "text-amber-500 bg-amber-50" },
  system: { icon: Settings2, color: "text-zinc-500 bg-zinc-50" },
  ai_suggestion: { icon: Lightbulb, color: "text-violet-500 bg-violet-50" },
  data_report: { icon: BarChart3, color: "text-blue-500 bg-blue-50" },
  milestone: { icon: Flag, color: "text-emerald-500 bg-emerald-50" },
  intervention: { icon: ShieldAlert, color: "text-orange-600 bg-orange-50" },
};

export function AgenticTabs({
  dashboard,
  evolution,
  events,
}: {
  dashboard: AgenticDashboardData;
  evolution: StrategyVersion[];
  events: TaskEvent[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="mt-6">
      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg w-fit mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && <OverviewTab dashboard={dashboard} events={events} />}
      {activeTab === "analytics" && <AnalyticsTab dashboard={dashboard} />}
      {activeTab === "strategy" && <StrategyTab dashboard={dashboard} evolution={evolution} />}
      {activeTab === "logs" && <LogsTab events={events} />}
    </div>
  );
}

/* =================================================================
 *  Tab 1: 概览
 * ================================================================= */

function OverviewTab({ dashboard, events }: { dashboard: AgenticDashboardData; events: TaskEvent[] }) {
  const { health } = dashboard;
  const healthColors = {
    good: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", dot: "bg-green-500", badge: "bg-green-100 text-green-700" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
    critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", dot: "bg-red-500", badge: "bg-red-100 text-red-700" },
  };
  const hc = healthColors[health.level];
  const healthLabel = { good: "正常运转", warning: "需要关注", critical: "出问题了" };
  const trendIcon = { up: "↑", down: "↓", flat: "→" };
  const trendColor = { up: "text-green-600", down: "text-red-600", flat: "text-zinc-400" };

  const importantEvents = events.filter((e) =>
    ["milestone", "ai_suggestion", "human_confirm", "intervention", "node_error", "data_report"].includes(e.type)
  ).slice(-5).reverse();

  return (
    <div className="space-y-5">
      {/* Health indicator */}
      <div className={`p-5 rounded-xl border-2 ${hc.bg} ${hc.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${hc.dot} ${health.level !== "good" ? "animate-pulse" : ""}`} />
          <Badge className={`text-xs border-0 ${hc.badge}`}>{healthLabel[health.level]}</Badge>
        </div>
        <p className={`text-sm font-medium ${hc.text} mb-3`}>{health.summary}</p>
        <div className="grid grid-cols-4 gap-3">
          {health.kpis.map((kpi, i) => (
            <div key={i} className="bg-white/80 rounded-lg p-3">
              <p className="text-[10px] text-zinc-400">{kpi.label}</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-bold text-zinc-900">{kpi.value}</span>
                {kpi.trend && <span className={`text-xs ${trendColor[kpi.trend]}`}>{trendIcon[kpi.trend]}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        <QuickAction icon={<Wallet className="w-4 h-4 text-violet-600" />} label="调整预算" hint={`当前 ${dashboard.strategyParams.find((p) => p.id === "budget")?.value || "未设置"}`} onClick={() => toast.info("Demo: 弹出预算修改表单")} />
        <QuickAction icon={<RefreshCw className="w-4 h-4 text-blue-600" />} label="换个策略" hint="查看 AI 建议" onClick={() => toast.info("Demo: 跳转到策略 Tab")} />
        <QuickAction icon={<Pause className="w-4 h-4 text-amber-600" />} label="暂停运行" hint="可随时恢复" onClick={() => toast.info("Demo: 确认暂停弹窗")} />
        <QuickAction icon={<MessageSquare className="w-4 h-4 text-green-600" />} label="让 Agent 汇报" hint="生成最新报告" onClick={() => toast.success("Demo: Agent 正在生成汇报…")} />
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">最近动态</h3>
        {importantEvents.length > 0 ? (
          <div className="space-y-2">
            {importantEvents.map((event) => {
              const ec = EVENT_ICONS[event.type] || EVENT_ICONS.system;
              const Icon = ec.icon;
              return (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-100 bg-white hover:border-zinc-200 transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ec.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-700">{event.content}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{event.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 py-4 text-center">暂无重要动态</p>
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/30 transition-all text-center group">
      <div className="w-9 h-9 rounded-lg bg-zinc-50 group-hover:bg-violet-50 flex items-center justify-center transition-colors">{icon}</div>
      <span className="text-xs font-medium text-zinc-800">{label}</span>
      <span className="text-[10px] text-zinc-400 leading-tight">{hint}</span>
    </button>
  );
}

/* =================================================================
 *  Tab 2: 数据
 * ================================================================= */

function AnalyticsTab({ dashboard }: { dashboard: AgenticDashboardData }) {
  const { goalProgress, weeklyGrowth, contentPerformance, spending, followerTrend, weeklyReports } = dashboard;
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const maxFollower = Math.max(...followerTrend.map((d) => d.count), 1);

  return (
    <div className="space-y-5">
      {/* Goal + trend row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Goal ring */}
        <div className="p-5 rounded-xl border border-zinc-200 bg-white flex flex-col items-center justify-center">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">目标达成</p>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f4f4f5" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#8b5cf6" strokeWidth="8"
                strokeDasharray={`${goalProgress.percentage * 2.64} 264`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-violet-700">{goalProgress.percentage}%</span>
              <span className="text-[10px] text-zinc-400">{goalProgress.current.toLocaleString()}/{goalProgress.target.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Follower trend chart */}
        <div className="col-span-2 p-5 rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider">粉丝趋势</p>
            <span className="text-[10px] text-zinc-300">累计粉丝数</span>
          </div>
          <div className="flex items-end gap-1 h-24">
            {followerTrend.map((d, i) => {
              const h = (d.count / maxFollower) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-zinc-400">{(d.count / 1000).toFixed(1)}k</span>
                  <div className="w-full rounded-t bg-violet-300 hover:bg-violet-400 transition-colors" style={{ height: `${h}%`, minHeight: 4 }} />
                  <span className="text-[8px] text-zinc-400">{d.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weekly growth + engagement */}
      {weeklyGrowth.length > 0 && (
        <div className="p-5 rounded-xl border border-zinc-200 bg-white">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3">周涨粉 & 互动率</p>
          <div className="flex items-end gap-3 h-24">
            {weeklyGrowth.map((w, i) => {
              const maxF = Math.max(...weeklyGrowth.map((x) => x.followers));
              const h = maxF > 0 ? (w.followers / maxF) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-violet-600 font-medium">+{w.followers.toLocaleString()}</span>
                  <div className="w-full rounded-t bg-violet-200 hover:bg-violet-300 transition-colors relative" style={{ height: `${h}%`, minHeight: 4 }}>
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-emerald-600">{w.engagement}%</span>
                  </div>
                  <span className="text-[9px] text-zinc-400">{w.week}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content performance */}
      {contentPerformance.length > 0 && (
        <div className="p-5 rounded-xl border border-zinc-200 bg-white">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3">内容效果对比</p>
          <div className="space-y-3">
            {contentPerformance.map((cp, i) => {
              const maxLikes = Math.max(...contentPerformance.map((c) => c.avgLikes));
              const barW = maxLikes > 0 ? (cp.avgLikes / maxLikes) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-700 w-20 shrink-0">{cp.type}</span>
                  <div className="flex-1 h-5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400" style={{ width: `${barW}%` }} />
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <span className="text-zinc-600">赞 {cp.avgLikes}</span>
                    <span className="text-zinc-400">评 {cp.avgComments}</span>
                    <span className="text-zinc-400">{cp.count} 条</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spending */}
      {spending.total > 0 && (
        <div className="p-5 rounded-xl border border-zinc-200 bg-white">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> 花费明细
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><p className="text-[10px] text-zinc-400">总投入</p><p className="text-lg font-bold text-zinc-800">¥{spending.total.toLocaleString()}</p></div>
            <div><p className="text-[10px] text-zinc-400">本周花费</p><p className="text-lg font-bold text-zinc-800">¥{spending.thisWeek.toLocaleString()}</p></div>
            <div><p className="text-[10px] text-zinc-400">单粉成本</p><p className="text-lg font-bold text-green-700">¥{spending.costPerFollower}</p></div>
          </div>
          {spending.trend.length > 0 && (
            <div className="space-y-1.5">
              {spending.trend.map((s: SpendItem, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 w-16 shrink-0">{s.week}</span>
                  <span className="text-zinc-700 font-medium">{s.amount > 0 ? `¥${s.amount.toLocaleString()}` : "—"}</span>
                  <span className="text-zinc-400">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly reports */}
      {weeklyReports.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3">周报</p>
          <div className="space-y-2">
            {weeklyReports.map((r) => (
              <div key={r.week} className="rounded-lg border border-zinc-100 bg-white overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                  onClick={() => setExpandedReport(expandedReport === r.week ? null : r.week)}
                >
                  <span className="text-xs font-medium text-zinc-700">{r.week}</span>
                  {expandedReport === r.week ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
                </button>
                {expandedReport === r.week && (
                  <div className="px-4 pb-3 pt-0">
                    <p className="text-xs text-zinc-600 leading-relaxed">{r.summary}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =================================================================
 *  Tab 3: 策略
 * ================================================================= */

function StrategyTab({ dashboard, evolution }: { dashboard: AgenticDashboardData; evolution: StrategyVersion[] }) {
  const [suggestionActions, setSuggestionActions] = useState<Record<string, string>>({});
  const [commandText, setCommandText] = useState("");
  const [commandSent, setCommandSent] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const handleSuggestion = (id: string, action: "accepted" | "rejected") => {
    setSuggestionActions((prev) => ({ ...prev, [id]: action }));
    toast.success(action === "accepted" ? "已采纳建议" : "已忽略建议");
  };

  const handleCommand = () => {
    if (!commandText.trim()) return;
    setCommandSent(true);
    toast.success("指令已发送，Agent 将评估可行性");
    setTimeout(() => setCommandSent(false), 3000);
    setCommandText("");
  };

  return (
    <div className="space-y-5">
      {/* Current strategy params */}
      <div className="p-5 rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">当前策略参数</p>
          <Badge className="text-[10px] border-0 bg-violet-50 text-violet-600">v{evolution.length > 0 ? evolution[evolution.length - 1].version.replace("v", "") : "1"}</Badge>
        </div>
        <div className="space-y-2.5">
          {dashboard.strategyParams.map((param) => (
            <div key={param.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-zinc-500">{param.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-800 font-medium">{param.value}</span>
                {param.editable && (
                  <button onClick={() => toast.info(`Demo: 修改「${param.label}」`)} className="text-[10px] text-violet-600 hover:text-violet-800 transition-colors">修改</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy evolution */}
      {evolution.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> 策略演进
          </p>
          <div className="space-y-2">
            {evolution.map((ver, i) => {
              const isCurrent = i === evolution.length - 1;
              const isExpanded = expandedVersion === ver.version;
              return (
                <div key={ver.version} className={`rounded-lg border overflow-hidden ${isCurrent ? "border-violet-200 bg-violet-50/30" : "border-zinc-100 bg-white"}`}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50/50 transition-colors" onClick={() => setExpandedVersion(isExpanded ? null : ver.version)}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isCurrent ? "bg-violet-600 text-white" : "bg-zinc-200 text-zinc-600"}`}>
                      {ver.version.replace("(待确认)", "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-zinc-800">{ver.summary}</span>
                      <span className="text-[10px] text-zinc-400 ml-2">{ver.date}</span>
                    </div>
                    {isCurrent && <Badge className="text-[9px] border-0 bg-violet-100 text-violet-600 shrink-0">当前</Badge>}
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2 border-t border-zinc-100/50">
                      <div className="pt-2">
                        <p className="text-[10px] text-zinc-400 mb-1">变更内容</p>
                        {ver.changes.map((c, ci) => (
                          <p key={ci} className="text-xs text-zinc-600 pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-violet-300">
                            {c}
                          </p>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 mb-0.5">触发原因</p>
                        <p className="text-xs text-zinc-600">{ver.trigger}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI suggestions */}
      {dashboard.aiSuggestions.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> AI 策略建议
          </p>
          <div className="space-y-2">
            {dashboard.aiSuggestions.map((sug) => {
              const acted = suggestionActions[sug.id] || sug.status;
              return (
                <div key={sug.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-zinc-100">
                  <div className="flex-1">
                    <p className="text-xs text-zinc-700">{sug.content}</p>
                    <Badge variant="outline" className={`text-[10px] h-4 mt-1 ${sug.impact === "高" ? "border-red-200 text-red-500" : "border-amber-200 text-amber-500"}`}>
                      影响：{sug.impact}
                    </Badge>
                  </div>
                  {acted === "pending" ? (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleSuggestion(sug.id, "accepted")} className="p-1.5 rounded-md border border-green-200 text-green-600 hover:bg-green-50"><ThumbsUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleSuggestion(sug.id, "rejected")} className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:bg-zinc-50"><ThumbsDown className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${acted === "accepted" ? "border-green-200 text-green-600" : "border-zinc-200 text-zinc-400"}`}>
                      {acted === "accepted" ? "已采纳" : "已忽略"}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Free-form command */}
      <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/30">
        <p className="text-xs font-medium text-violet-800 mb-2">我有个想法</p>
        <p className="text-[10px] text-violet-600 mb-2">输入你想让 Agent 尝试的方向，它会评估可行性后执行</p>
        <div className="flex gap-2">
          <Textarea
            className="text-xs min-h-[40px] bg-white flex-1"
            placeholder="比如：下周试试合作推广、增加探店类内容…"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
          />
          <Button size="sm" className="h-auto bg-violet-600 hover:bg-violet-700 shrink-0" onClick={handleCommand} disabled={!commandText.trim() || commandSent}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
        {commandSent && <p className="text-[10px] text-green-600 mt-1.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 已发送，Agent 将在下次执行时评估</p>}
      </div>
    </div>
  );
}

/* =================================================================
 *  Tab 4: 日志
 * ================================================================= */

type EventFilter = "all" | "milestone" | "ai_suggestion" | "node_error" | "intervention" | "data_report";

const FILTER_TABS: { id: EventFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "milestone", label: "里程碑" },
  { id: "ai_suggestion", label: "AI 建议" },
  { id: "node_error", label: "异常" },
  { id: "intervention", label: "干预" },
  { id: "data_report", label: "数据报告" },
];

function LogsTab({ events }: { events: TaskEvent[] }) {
  const [filter, setFilter] = useState<EventFilter>("all");

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);
  const errorEvents = events.filter((e) => e.type === "node_error");
  const hasUnresolvedErrors = errorEvents.length > 0;

  return (
    <div className="space-y-4">
      {/* Escalation zone */}
      {hasUnresolvedErrors && (
        <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-800">Agent 需要你帮忙</h3>
          </div>
          {errorEvents.slice(-2).map((e) => (
            <div key={e.id} className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-white/60">
              <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-red-700">{e.content}</p>
                <p className="text-[10px] text-red-400 mt-0.5">{e.timestamp}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600" onClick={() => toast.info("Demo: 重试操作")}>重试</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-600" onClick={() => toast.info("Demo: 跳过该步骤")}>跳过</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.info("Demo: 人工接管")}>人工接管</Button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg w-fit">
        {FILTER_TABS.map((tab) => {
          const count = tab.id === "all" ? events.length : events.filter((e) => e.type === tab.id).length;
          if (count === 0 && tab.id !== "all") return null;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-zinc-400">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-8">没有匹配的日志</p>
        ) : (
          filtered.map((event, idx) => {
            const ec = EVENT_ICONS[event.type] || EVENT_ICONS.system;
            const Icon = ec.icon;
            const isLast = idx === filtered.length - 1;
            return (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ec.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-zinc-200 my-1" />}
                </div>
                <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
                  <div className="flex items-center gap-2">
                    {event.nodeName && <span className="text-[10px] text-zinc-400 font-medium">{event.nodeName}</span>}
                    <span className="text-[10px] text-zinc-300">{event.timestamp}</span>
                  </div>
                  <p className="text-xs text-zinc-700 mt-0.5 whitespace-pre-line">{event.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
