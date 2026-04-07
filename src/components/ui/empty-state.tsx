import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}>
      <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
        {icon || <Inbox className="w-6 h-6 text-zinc-400" />}
      </div>
      <h3 className="text-sm font-medium text-zinc-700 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
