"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Bot, ListChecks, CheckCircle2, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { MOCK_AGENTS, MOCK_TASKS, CONSOLE_STATS } from "@/lib/mock-console";
import type { ConsoleTaskStatus } from "@/lib/types";

const STATUS_CONFIG: Record<ConsoleTaskStatus, { label: string; className: string }> = {
  queued: { label: "排队中", className: "bg-zinc-100 text-zinc-600" },
  running: { label: "执行中", className: "bg-blue-50 text-blue-700" },
  pending_confirm: { label: "待确认", className: "bg-amber-50 text-amber-700" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700" },
  error: { label: "异常", className: "bg-red-50 text-red-700" },
};

export default function ConsoleDashboard() {
  const pendingTasks = MOCK_TASKS.filter((t) => t.status === "pending_confirm");
  const errorTasks = MOCK_TASKS.filter((t) => t.status === "error");
  const recentTasks = MOCK_TASKS.slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6">
        <h1 className="text-xl font-bold text-zinc-900">仪表盘</h1>
        <p className="text-sm text-zinc-400 mt-1">平台运营概览</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <StatCard
            label="活跃 Agent"
            value={CONSOLE_STATS.activeAgents}
            icon={<Bot className="w-4 h-4 text-blue-500" />}
            trend="+1"
          />
          <StatCard
            label="本月任务量"
            value={CONSOLE_STATS.monthlyTasks}
            icon={<ListChecks className="w-4 h-4 text-violet-500" />}
            trend="+12.4%"
          />
          <StatCard
            label="成功率"
            value={`${CONSOLE_STATS.successRate}%`}
            icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          />
          <StatCard
            label="待处理"
            value={CONSOLE_STATS.pendingItems}
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
            highlight
          />
        </div>

        {/* Pending items */}
        {(pendingTasks.length > 0 || errorTasks.length > 0) && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-900">待处理事项</h2>
              <Link href="/console/tasks" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                查看全部 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {[...pendingTasks, ...errorTasks].map((task) => {
                const sc = STATUS_CONFIG[task.status];
                return (
                  <Link
                    key={task.id}
                    href={`/console/tasks/${task.id}`}
                    className="flex items-center gap-4 p-3.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all"
                  >
                    <span className="text-lg">{task.agentIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">{task.id}</span>
                        <Badge className={`text-[10px] h-4 border-0 ${sc.className}`}>{sc.label}</Badge>
                        {task.priority === "urgent" && (
                          <Badge className="text-[10px] h-4 bg-red-100 text-red-700 border-0">紧急</Badge>
                        )}
                        {task.priority === "high" && (
                          <Badge className="text-[10px] h-4 bg-amber-100 text-amber-700 border-0">高优</Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{task.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-zinc-400">{task.currentNode}</p>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {task.duration}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent tasks */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">最近任务</h2>
            <Link href="/console/tasks" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                  <th className="text-left px-4 py-2.5 font-medium">任务</th>
                  <th className="text-left px-4 py-2.5 font-medium">Agent</th>
                  <th className="text-left px-4 py-2.5 font-medium">当前节点</th>
                  <th className="text-left px-4 py-2.5 font-medium">进度</th>
                  <th className="text-left px-4 py-2.5 font-medium">状态</th>
                  <th className="text-left px-4 py-2.5 font-medium">耗时</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => {
                  const sc = STATUS_CONFIG[task.status];
                  return (
                    <tr key={task.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/console/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                          {task.id}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        <span className="mr-1">{task.agentIcon}</span>
                        {task.agentName}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{task.currentNode}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${task.status === "error" ? "bg-red-400" : "bg-blue-500"}`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">{task.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[10px] h-4 border-0 ${sc.className}`}>{sc.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">{task.duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent overview */}
        <div className="mt-8 pb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Agent 概览</h2>
            <Link href="/console/agents" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MOCK_AGENTS.filter((a) => a.status === "running").slice(0, 3).map((agent) => (
              <div key={agent.id} className="bg-white rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{agent.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{agent.name}</h3>
                    <p className="text-[10px] text-zinc-400">{agent.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <div>
                    <span className="text-zinc-400">成功率</span>
                    <span className="ml-1 font-semibold text-zinc-700">{agent.successRate}%</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">任务数</span>
                    <span className="ml-1 font-semibold text-zinc-700">{agent.taskCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, trend, highlight }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-amber-50 border-amber-200" : "bg-white border-zinc-200"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        {icon}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className={`text-2xl font-bold ${highlight ? "text-amber-700" : "text-zinc-900"}`}>{value}</span>
        {trend && <span className="text-xs text-green-600 mb-0.5">{trend}</span>}
      </div>
    </div>
  );
}
