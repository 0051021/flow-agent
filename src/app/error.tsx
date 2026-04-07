"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">页面出现了问题</h2>
        <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
          {error.message || "发生了意外错误，请重试或返回首页。"}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            重试
          </Button>
          <Link href="/">
            <Button size="sm">
              <Home className="w-3.5 h-3.5 mr-1.5" />
              返回首页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
