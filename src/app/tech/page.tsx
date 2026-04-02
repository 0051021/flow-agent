"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Workflow, Code2, ArrowRight, LayoutDashboard,
  Clock, AlertTriangle, CheckCircle2, FileText,
  ArrowUpRight, Eye,
} from "lucide-react";
import { MOCK_REVIEWS } from "@/lib/mock-reviews";

const STATUS_CONFIG = {
  pending: { label: "待评审", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  reviewed: { label: "已评审", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Eye },
  confirmed: { label: "双方确认", className: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
};

const TYPE_BADGE = {
  workflow: { label: "工作流", className: "bg-blue-50 text-blue-600 border-blue-200" },
  agentic: { label: "智能体", className: "bg-violet-50 text-violet-600 border-violet-200" },
};

export default function TechLandingPage() {
  const pendingCount = MOCK_REVIEWS.filter((i) => i.status === "pending").length;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Nav */}
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white">FlowAgent</span>
          <Badge className="text-[10px] h-5 bg-purple-500/20 text-purple-300 border-0">
            技术方
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Workflow className="w-3.5 h-3.5" />
            业务方入口
          </Link>
          <Link
            href="/console"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            管控后台
            <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">技术评审工作台</h1>
          <p className="text-sm text-slate-400 mt-1">
            评估业务方提交的场景方案，标注技术可行性和约束条件
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">待评审</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">{pendingCount}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">已评审</span>
              <Eye className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {MOCK_REVIEWS.filter((i) => i.status === "reviewed").length}
            </p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">双方确认</span>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {MOCK_REVIEWS.filter((i) => i.status === "confirmed").length}
            </p>
          </div>
        </div>

        {/* Review list */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-4">评审列表</h2>
          <div className="space-y-3">
            {MOCK_REVIEWS.map((item) => {
              const sc = STATUS_CONFIG[item.status];
              const StatusIcon = sc.icon;
              const typeBadge = TYPE_BADGE[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/editor?reviewId=${item.id}&role=tech`}
                  className="block rounded-xl bg-slate-900 border border-slate-800 p-5 hover:border-slate-600 hover:bg-slate-900/80 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                        <Badge variant="outline" className={`text-[10px] h-5 ${typeBadge.className}`}>
                          {typeBadge.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] h-5 ${sc.className}`}>
                          <StatusIcon className="w-3 h-3 mr-0.5" />
                          {sc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {item.nodeCount} 个节点
                        </span>
                        <span>提交人：{item.submittedBy}</span>
                        <span>{item.submittedAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {item.status === "pending" && (
                        <span className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          开始评审 <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                      {item.status !== "pending" && (
                        <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          查看详情 <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
