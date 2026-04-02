"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { MOCK_TASKS } from "@/lib/mock-console";
import type { ConsoleTaskStatus } from "@/lib/types";

const STATUS_CONFIG: Record<ConsoleTaskStatus, { label: string; className: string }> = {
  queued: { label: "排队中", className: "bg-zinc-100 text-zinc-600" },
  running: { label: "执行中", className: "bg-blue-50 text-blue-700" },
  pending_confirm: { label: "待确认", className: "bg-amber-50 text-amber-700" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700" },
  error: { label: "异常", className: "bg-red-50 text-red-700" },
};

const FILTER_TABS: { id: string; label: string; filter: (s: ConsoleTaskStatus) => boolean }[] = [
  { id: "all", label: "全部", filter: () => true },
  { id: "running", label: "执行中", filter: (s) => s === "running" },
  { id: "pending", label: "待确认", filter: (s) => s === "pending_confirm" },
  { id: "completed", label: "已完成", filter: (s) => s === "completed" },
  { id: "error", label: "异常", filter: (s) => s === "error" },
];

export default function TasksPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const currentFilter = FILTER_TABS.find((t) => t.id === activeFilter) || FILTER_TABS[0];
  const filteredTasks = MOCK_TASKS.filter((t) => currentFilter.filter(t.status));

  const pendingCount = MOCK_TASKS.filter((t) => t.status === "pending_confirm").length;
  const errorCount = MOCK_TASKS.filter((t) => t.status === "error").length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6">
        <h1 className="text-xl font-bold text-zinc-900">任务监控</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {MOCK_TASKS.length} 个任务 · {pendingCount} 个待确认 · {errorCount} 个异常
        </p>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-6 p-1 bg-zinc-100 rounded-lg w-fit">
          {FILTER_TABS.map((tab) => {
            const count = MOCK_TASKS.filter((t) => tab.filter(t.status)).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${activeFilter === tab.id
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

        {/* Table */}
        <div className="mt-4 bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                <th className="text-left px-4 py-3 font-medium">任务</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">当前节点</th>
                <th className="text-left px-4 py-3 font-medium">进度</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">耗时</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const sc = STATUS_CONFIG[task.status];
                return (
                  <tr key={task.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/console/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                        {task.id}
                      </Link>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{task.description}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <div className="flex items-center gap-1.5">
                        <span>{task.agentIcon}</span>
                        <span className="text-xs">{task.agentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{task.currentNode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${task.status === "error" ? "bg-red-400" : task.status === "completed" ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 w-8">{task.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge className={`text-[10px] h-4 border-0 ${sc.className}`}>{sc.label}</Badge>
                        {task.priority === "urgent" && (
                          <Badge className="text-[10px] h-4 bg-red-100 text-red-700 border-0">紧急</Badge>
                        )}
                        {task.priority === "high" && (
                          <Badge className="text-[10px] h-4 bg-amber-100 text-amber-700 border-0">高优</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <Clock className="w-3 h-3" />
                        {task.duration}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
