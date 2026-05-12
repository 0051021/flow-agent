"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Code2,
  FileText,
  Loader2,
  Search,
  UserRoundCheck,
} from "lucide-react";

type TechReviewItem = {
  id: string;
  title: string;
  type: "workflow" | "agentic";
  submittedBy: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "confirmed";
  description: string;
  nodeCount: number;
};

const STATUS_COPY: Record<TechReviewItem["status"], { label: string; className: string }> = {
  pending: { label: "待评审", className: "border-amber-200 bg-amber-50 text-amber-700" },
  reviewed: { label: "已评审", className: "border-blue-200 bg-blue-50 text-blue-700" },
  confirmed: { label: "已确认", className: "border-green-200 bg-green-50 text-green-700" },
};

function formatTime(value: string) {
  if (!value) return "-";
  if (!value.includes("T")) return value;
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TechMePage() {
  const [items, setItems] = useState<TechReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/submissions?view=reviews");
        const result = await res.json();
        if (!cancelled && result?.success && Array.isArray(result.items)) {
          setItems(result.items);
        }
      } catch {
        // keep empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.submittedBy.toLowerCase().includes(q)
    ));
  }, [items, query]);

  const pendingCount = items.filter((item) => item.status === "pending").length;
  const reviewedCount = items.filter((item) => item.status === "reviewed").length;
  const confirmedCount = items.filter((item) => item.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">技术方个人主页</p>
              <p className="text-[11px] text-slate-400">收到的业务评审流程</p>
            </div>
          </div>
          <Link href="/" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            业务方入口
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">我的评审收件箱</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                这里放业务方已经提交给技术方的流程。技术方从这里进入评审工作台，给节点添加批注、判断人机分工和可行性。
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索流程、提交人..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-amber-700">待评审</p>
                <Clock3 className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{pendingCount}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-700">已评审</p>
                <UserRoundCheck className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-blue-900">{reviewedCount}</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-green-700">已确认</p>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-green-900">{confirmedCount}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">收到的评审流程</h2>
              <p className="mt-1 text-xs text-slate-400">只展示服务端留存的真实提交记录。</p>
            </div>
            {loading ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                读取中
              </span>
            ) : null}
          </div>

          {filtered.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <FileText className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">暂无收到的评审流程</p>
              <p className="mt-1 text-xs text-slate-400">业务方提交后会出现在这里。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const status = STATUS_COPY[item.status] ?? STATUS_COPY.pending;
                return (
                  <Link
                    key={item.id}
                    href={`/editor?reviewId=${item.id}&role=tech`}
                    className="group block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                          <Badge variant="outline" className={`h-5 text-[10px] ${status.className}`}>{status.label}</Badge>
                          <Badge variant="outline" className="h-5 border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                            {item.type === "agentic" ? "智能体" : "工作流"}
                          </Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span>{item.nodeCount} 个节点</span>
                          <span>提交人：{item.submittedBy}</span>
                          <span>{formatTime(item.submittedAt)}</span>
                        </div>
                      </div>
                      <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                        进入评审
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
