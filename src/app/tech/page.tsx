"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Workflow, Code2, ArrowRight, LayoutDashboard,
  Clock, AlertTriangle, CheckCircle2, FileText,
  ArrowUpRight, Eye,
} from "lucide-react";

const MOCK_REVIEW_ITEMS = [
  {
    id: "review-1",
    title: "小红书账号运营",
    type: "agentic" as const,
    submittedBy: "市场部 · 李经理",
    submittedAt: "30 分钟前",
    status: "pending" as const,
    description: "3个月涨粉5万，涉及内容生成、合规审查、定时发布、数据监控",
    nodeCount: 7,
    prompt: "我想做小红书账号运营，先分析账号现状和竞品，然后制定内容策略，每天生成3条图文内容，内容需要经过合规审查，审查通过后定时发布，发布后监控互动数据，每周根据数据调整策略。目标是3个月涨粉5万",
  },
  {
    id: "review-2",
    title: "进出口报关流程",
    type: "workflow" as const,
    submittedBy: "外贸部 · 张主管",
    submittedAt: "2 小时前",
    status: "pending" as const,
    description: "从收到委托到海关放行的全流程自动化，涉及单据审核、编码归类、关税计算",
    nodeCount: 6,
    prompt: "我想自动化进出口报关流程，收到委托后先审核报关单据的完整性，然后根据商品描述进行海关编码归类，计算关税，填制报关单，提交海关申报，等待审核放行后通知客户",
  },
  {
    id: "review-3",
    title: "财务报销审批",
    type: "workflow" as const,
    submittedBy: "财务部 · 王会计",
    submittedAt: "昨天",
    status: "reviewed" as const,
    description: "员工报销从提交到打款的全流程，涉及发票校验、多级审批、自动打款",
    nodeCount: 5,
    prompt: "我想自动化财务报销流程，员工提交报销申请后，系统自动校验发票和金额，然后按审批规则流转给对应审批人，审批通过后自动发起打款，最后归档记录",
  },
  {
    id: "review-4",
    title: "竞品分析报告",
    type: "agentic" as const,
    submittedBy: "产品部 · 赵总监",
    submittedAt: "3 天前",
    status: "confirmed" as const,
    description: "多渠道竞品数据采集、多维度对比分析、结构化报告生成",
    nodeCount: 4,
    prompt: "我想做竞品分析，先从多个渠道采集竞品数据，然后从产品功能、用户评价、市场份额等维度进行对比分析，最后生成一份结构化的竞品分析报告",
  },
];

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
  const pendingCount = MOCK_REVIEW_ITEMS.filter((i) => i.status === "pending").length;

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
              {MOCK_REVIEW_ITEMS.filter((i) => i.status === "reviewed").length}
            </p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">双方确认</span>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {MOCK_REVIEW_ITEMS.filter((i) => i.status === "confirmed").length}
            </p>
          </div>
        </div>

        {/* Review list */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-4">评审列表</h2>
          <div className="space-y-3">
            {MOCK_REVIEW_ITEMS.map((item) => {
              const sc = STATUS_CONFIG[item.status];
              const StatusIcon = sc.icon;
              const typeBadge = TYPE_BADGE[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/editor?q=${encodeURIComponent(item.prompt)}&role=tech`}
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
