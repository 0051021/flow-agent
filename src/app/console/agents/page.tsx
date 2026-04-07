"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search, Pause, Play, X, Clock, CheckCircle2,
  BarChart3, Zap, Bot,
} from "lucide-react";
import { MOCK_AGENTS, MOCK_TASKS } from "@/lib/mock-console";
import type { AgentStatus } from "@/lib/types";

const STATUS_CONFIG: Record<AgentStatus, { label: string; className: string; dot: string }> = {
  running: { label: "运行中", className: "bg-green-50 text-green-700", dot: "bg-green-500" },
  draft: { label: "草稿", className: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-400" },
  error: { label: "异常", className: "bg-red-50 text-red-700", dot: "bg-red-500" },
  paused: { label: "已暂停", className: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

const FILTER_TABS: { id: string; label: string; filter: (s: AgentStatus) => boolean }[] = [
  { id: "all", label: "全部", filter: () => true },
  { id: "running", label: "运行中", filter: (s) => s === "running" },
  { id: "paused", label: "已暂停", filter: (s) => s === "paused" },
  { id: "draft", label: "草稿", filter: (s) => s === "draft" },
  { id: "error", label: "异常", filter: (s) => s === "error" },
];

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});

  const currentFilter = FILTER_TABS.find((t) => t.id === activeFilter) || FILTER_TABS[0];

  const getStatus = (id: string, original: AgentStatus) => agentStatuses[id] || original;

  const filteredAgents = MOCK_AGENTS.filter((a) => {
    const status = getStatus(a.id, a.status);
    if (!currentFilter.filter(status)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.sceneName.toLowerCase().includes(q) || a.department.toLowerCase().includes(q);
    }
    return true;
  });

  const runningCount = MOCK_AGENTS.filter((a) => getStatus(a.id, a.status) === "running").length;
  const agent = selectedAgent ? MOCK_AGENTS.find((a) => a.id === selectedAgent) : null;
  const agentTasks = agent ? MOCK_TASKS.filter((t) => t.agentId === agent.id).slice(0, 5) : [];

  const handleToggleStatus = (id: string, current: AgentStatus) => {
    if (current === "running") {
      setAgentStatuses((prev) => ({ ...prev, [id]: "paused" }));
      toast.info("Agent 已暂停");
    } else if (current === "paused") {
      setAgentStatuses((prev) => ({ ...prev, [id]: "running" }));
      toast.success("Agent 已恢复运行");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Agent 团队</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {MOCK_AGENTS.length} 个 Agent · {runningCount} 个运行中
            </p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-4 mt-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="搜索 Agent 名称、场景、部门..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg">
            {FILTER_TABS.map((tab) => {
              const count = MOCK_AGENTS.filter((a) => tab.filter(getStatus(a.id, a.status))).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeFilter === tab.id
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 text-zinc-400">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Agent grid */}
        {filteredAgents.length === 0 ? (
          <EmptyState
            icon={<Bot className="w-6 h-6 text-zinc-400" />}
            title="没有匹配的 Agent"
            description={search ? "试试调整搜索关键词" : "当前筛选条件下没有 Agent"}
            className="mt-12"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {filteredAgents.map((a) => {
              const status = getStatus(a.id, a.status);
              const sc = STATUS_CONFIG[status];
              const isSelected = selectedAgent === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAgent(isSelected ? null : a.id)}
                  className={`bg-white rounded-xl border p-5 transition-all cursor-pointer ${
                    isSelected ? "border-blue-300 shadow-md ring-1 ring-blue-100" : "border-zinc-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{a.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-zinc-900">{a.name}</h3>
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            <Badge className={`text-[10px] h-4 border-0 ${sc.className}`}>{sc.label}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{a.sceneName} · {a.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] h-5">
                        {a.taskType === "workflow" ? "工作流" : "智能体"}
                      </Badge>
                      {(status === "running" || status === "paused") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(a.id, status); }}
                        >
                          {status === "running" ? <Pause className="w-3.5 h-3.5 text-zinc-500" /> : <Play className="w-3.5 h-3.5 text-green-600" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 leading-relaxed line-clamp-2">{a.description}</p>
                  {status !== "draft" ? (
                    <div className="flex items-center gap-6 mt-4 pt-3 border-t border-zinc-100">
                      <div>
                        <p className="text-[10px] text-zinc-400">成功率</p>
                        <p className="text-sm font-semibold text-zinc-900">{a.successRate}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400">任务数</p>
                        <p className="text-sm font-semibold text-zinc-900">{a.taskCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400">均耗时</p>
                        <p className="text-sm font-semibold text-zinc-900">{a.avgDuration}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-zinc-100">
                      <p className="text-xs text-zinc-400">尚未部署</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 text-[10px] text-zinc-400">
                    <span>{a.version}</span>
                    <span>活跃于 {a.lastActiveAt}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      {agent && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-zinc-200 shadow-xl z-40 overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{agent.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{agent.name}</h3>
                <p className="text-xs text-zinc-400">{agent.sceneName}</p>
              </div>
            </div>
            <button onClick={() => setSelectedAgent(null)} className="text-zinc-400 hover:text-zinc-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Status */}
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-3">基本信息</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400">状态</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[getStatus(agent.id, agent.status)].dot}`} />
                    <span className="text-sm font-medium text-zinc-900">{STATUS_CONFIG[getStatus(agent.id, agent.status)].label}</span>
                  </div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400">类型</p>
                  <p className="text-sm font-medium text-zinc-900 mt-1">{agent.taskType === "workflow" ? "工作流" : "智能体"}</p>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400">部门</p>
                  <p className="text-sm font-medium text-zinc-900 mt-1">{agent.department}</p>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400">版本</p>
                  <p className="text-sm font-medium text-zinc-900 mt-1">{agent.version}</p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            {getStatus(agent.id, agent.status) !== "draft" && (
              <div>
                <h4 className="text-xs font-medium text-zinc-500 mb-3">运行指标</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-zinc-50 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-zinc-900">{agent.successRate}%</p>
                    <p className="text-[10px] text-zinc-400">成功率</p>
                  </div>
                  <div className="text-center bg-zinc-50 rounded-lg p-3">
                    <BarChart3 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-zinc-900">{agent.taskCount}</p>
                    <p className="text-[10px] text-zinc-400">任务数</p>
                  </div>
                  <div className="text-center bg-zinc-50 rounded-lg p-3">
                    <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-zinc-900">{agent.avgDuration}</p>
                    <p className="text-[10px] text-zinc-400">均耗时</p>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-2">描述</h4>
              <p className="text-sm text-zinc-600 leading-relaxed">{agent.description}</p>
            </div>

            {/* Recent tasks */}
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-3">最近任务</h4>
              {agentTasks.length === 0 ? (
                <p className="text-xs text-zinc-400">暂无任务记录</p>
              ) : (
                <div className="space-y-2">
                  {agentTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-zinc-700">{t.id}</p>
                        <p className="text-[10px] text-zinc-400">{t.currentNode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 rounded-full bg-zinc-200 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${t.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-400">{t.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            {(getStatus(agent.id, agent.status) === "running" || getStatus(agent.id, agent.status) === "paused") && (
              <div className="pt-4 border-t border-zinc-100">
                <Button
                  size="sm"
                  variant={getStatus(agent.id, agent.status) === "running" ? "outline" : "default"}
                  className="w-full h-9 text-xs"
                  onClick={() => handleToggleStatus(agent.id, getStatus(agent.id, agent.status))}
                >
                  {getStatus(agent.id, agent.status) === "running" ? (
                    <><Pause className="w-3.5 h-3.5 mr-1.5" /> 暂停 Agent</>
                  ) : (
                    <><Play className="w-3.5 h-3.5 mr-1.5" /> 恢复运行</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
