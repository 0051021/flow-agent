"use client";

import { Badge } from "@/components/ui/badge";
import { MOCK_AGENTS } from "@/lib/mock-console";
import type { AgentStatus } from "@/lib/types";

const STATUS_CONFIG: Record<AgentStatus, { label: string; className: string; dot: string }> = {
  running: { label: "运行中", className: "bg-green-50 text-green-700", dot: "bg-green-500" },
  draft: { label: "草稿", className: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-400" },
  error: { label: "异常", className: "bg-red-50 text-red-700", dot: "bg-red-500" },
  paused: { label: "已暂停", className: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

export default function AgentsPage() {
  const runningCount = MOCK_AGENTS.filter((a) => a.status === "running").length;

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

        <div className="grid grid-cols-2 gap-4 mt-6">
          {MOCK_AGENTS.map((agent) => {
            const sc = STATUS_CONFIG[agent.status];
            return (
              <div
                key={agent.id}
                className="bg-white rounded-xl border border-zinc-200 p-5 hover:shadow-sm transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{agent.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900">{agent.name}</h3>
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          <Badge className={`text-[10px] h-4 border-0 ${sc.className}`}>{sc.label}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {agent.sceneName} · {agent.department}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {agent.taskType === "workflow" ? "工作流" : "智能体"}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{agent.description}</p>

                {/* Stats */}
                {agent.status !== "draft" ? (
                  <div className="flex items-center gap-6 mt-4 pt-3 border-t border-zinc-100">
                    <div>
                      <p className="text-[10px] text-zinc-400">成功率</p>
                      <p className="text-sm font-semibold text-zinc-900">{agent.successRate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400">任务数</p>
                      <p className="text-sm font-semibold text-zinc-900">{agent.taskCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400">均耗时</p>
                      <p className="text-sm font-semibold text-zinc-900">{agent.avgDuration}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t border-zinc-100">
                    <p className="text-xs text-zinc-400">尚未部署</p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 text-[10px] text-zinc-400">
                  <span>{agent.version}</span>
                  <span>活跃于 {agent.lastActiveAt}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
