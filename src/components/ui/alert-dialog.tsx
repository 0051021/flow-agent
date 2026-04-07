"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
}

const VARIANT_STYLES = {
  danger: {
    icon: "bg-red-100 text-red-600",
    button: "bg-red-600 hover:bg-red-700",
  },
  warning: {
    icon: "bg-amber-100 text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  default: {
    icon: "bg-blue-100 text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
  },
};

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  variant = "default",
  onConfirm,
}: AlertDialogProps) {
  if (!open) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[400px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 px-5 py-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${styles.icon}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
            {description && (
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-600 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-zinc-100 bg-zinc-50/50">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            className={`flex-1 h-9 text-xs text-white ${styles.button}`}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useAlertDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Omit<AlertDialogProps, "open" | "onOpenChange">>({
    title: "",
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (opts: Omit<AlertDialogProps, "open" | "onOpenChange">) =>
      new Promise<boolean>((resolve) => {
        setConfig({
          ...opts,
          onConfirm: () => {
            opts.onConfirm();
            resolve(true);
          },
        });
        setOpen(true);
      }),
    []
  );

  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen} {...config} />
  );

  return { confirm, dialog, open, setOpen };
}
