"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, ListChecks, Workflow, ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { MOCK_AGENTS } from "@/lib/mock-console";

const NAV_ITEMS = [
  { href: "/console", label: "总览", icon: LayoutDashboard, desc: "全局状况一眼看清" },
  { href: "/console/agents", label: "AI 助手", icon: Bot, desc: "你的 AI 团队" },
  { href: "/console/tasks", label: "事务中心", icon: ListChecks, desc: "待办与进展" },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="w-[220px] bg-white border-r border-zinc-200 flex flex-col shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-zinc-100">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
            <Workflow className="w-4 h-4 text-zinc-900" />
            <span className="text-sm font-semibold text-zinc-900">管控中心</span>
          </Link>
        </div>

        {/* Greeting */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs text-zinc-400">{getGreeting()}</p>
          <p className="text-[10px] text-zinc-300 mt-0.5">{MOCK_AGENTS.filter((a) => a.status === "running").length} 个 AI 助手正在为你处理业务</p>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/console" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors
                  ${isActive
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className={`text-[10px] ${isActive ? "text-zinc-400" : "text-zinc-400"}`}>{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-zinc-100">
          <ThemeToggle className="w-full justify-start gap-2 text-xs text-zinc-500" />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
