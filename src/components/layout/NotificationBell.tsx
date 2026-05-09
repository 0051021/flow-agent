"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Cpu,
  Send,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowAgentStore } from "@/lib/store";
import type { Notification, NotificationType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  tech_config_ready: { icon: Cpu, className: "text-blue-500" },
  review_submitted: { icon: Send, className: "text-blue-500" },
  review_approved: { icon: CheckCircle2, className: "text-green-500" },
  review_rejected: { icon: AlertTriangle, className: "text-red-500" },
  annotation_reply: { icon: MessageSquare, className: "text-purple-500" },
  quality_alert: { icon: Shield, className: "text-orange-500" },
  system: { icon: Bell, className: "text-zinc-400" },
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}天前`;
  return new Date(iso).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MAX_LIST = 10;

export interface NotificationBellProps {
  isTech: boolean;
}

export function NotificationBell({ isTech }: NotificationBellProps) {
  const router = useRouter();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useFlowAgentStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read);
  const unreadCount = unread.length;
  const list = notifications.slice(0, MAX_LIST);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleItemClick = (n: Notification) => {
    markNotificationRead(n.id);
    if (n.actionUrl) {
      if (/^https?:\/\//i.test(n.actionUrl)) {
        window.open(n.actionUrl, "_blank", "noopener,noreferrer");
      } else {
        router.push(n.actionUrl);
      }
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-label="通知"
        className={cn(
          "h-8 w-8 p-0 relative",
          isTech && "border-slate-600 text-slate-300 hover:bg-slate-800"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-[min(100vw-2rem,20rem)] bg-white rounded-lg shadow-lg border border-zinc-200 z-50 flex flex-col max-h-[min(80vh,24rem)]"
          role="dialog"
          aria-label="通知列表"
        >
          <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-zinc-800">通知</span>
            {unreadCount > 0 && (
              <span className="text-[10px] text-blue-600">{unreadCount} 条未读</span>
            )}
          </div>
          <div className="overflow-y-auto min-h-0 flex-1">
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-zinc-400">暂无通知</p>
            ) : (
              <ul className="py-1">
                {list.map((n) => {
                  const cfg = TYPE_CONFIG[n.type];
                  const Icon = cfg.icon;
                  return (
                    <li key={n.id} className="relative">
                      {!n.read && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r bg-blue-500"
                          aria-hidden
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleItemClick(n)}
                        className={cn(
                          "w-full text-left pl-3 pr-3 py-2.5 flex gap-2.5 transition-colors",
                          n.read
                            ? "hover:bg-zinc-50"
                            : "hover:bg-blue-50/60 bg-zinc-50/40"
                        )}
                      >
                        <div className="shrink-0 mt-0.5">
                          <Icon className={cn("w-4 h-4", cfg.className)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <span
                              className={cn(
                                "text-xs font-medium line-clamp-2",
                                n.read ? "text-zinc-600" : "text-zinc-900"
                              )}
                            >
                              {n.title}
                            </span>
                            {!n.read && (
                              <span
                                className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"
                                title="未读"
                              />
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {formatRelativeTime(n.timestamp)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {list.length > 0 && (
            <div className="p-2 border-t border-zinc-100 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                disabled={unreadCount === 0}
                onClick={() => {
                  markAllNotificationsRead();
                }}
              >
                全部标为已读
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
