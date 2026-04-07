"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Console error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-base font-semibold text-zinc-900 mb-2">管控台出现了问题</h2>
        <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
          {error.message || "加载管控台数据时出错，请重试。"}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            重试
          </Button>
          <Link href="/console">
            <Button size="sm">
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
              返回仪表盘
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
