"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, ListChecks, Workflow, ChevronLeft } from "lucide-react";

const NAV_ITEMS = [
  { href: "/console", label: "仪表盘", icon: LayoutDashboard },
  { href: "/console/agents", label: "Agent 团队", icon: Bot },
  { href: "/console/tasks", label: "任务监控", icon: ListChecks },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="w-[200px] bg-white border-r border-zinc-200 flex flex-col shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-zinc-100">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
            <Workflow className="w-4 h-4 text-zinc-900" />
            <span className="text-sm font-semibold text-zinc-900">管控后台</span>
          </Link>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/console" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                  ${isActive
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
