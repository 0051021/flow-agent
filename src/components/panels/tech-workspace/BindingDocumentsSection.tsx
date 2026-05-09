"use client";

import { useFlowAgentStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentBindingEntry, DocumentEntry } from "@/lib/types";

function DocCard({
  doc,
  binding,
  onChange,
}: {
  doc: DocumentEntry;
  binding: DocumentBindingEntry;
  onChange: (patch: Partial<DocumentBindingEntry>) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        binding.sensitivity === "confidential"
          ? "border-red-200 bg-red-50/30"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-semibold text-zinc-800">{doc.name}</span>
        <span className="text-[10px] text-zinc-400">{doc.id}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">数据源标识</label>
          <Input
            value={binding.contextSourceCode ?? ""}
            onChange={(e) => onChange({ contextSourceCode: e.target.value })}
            placeholder="ContextSource code"
            className="font-mono text-[11px] h-8"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">来源方式</label>
          <Select
            value={binding.sourceType ?? "manual"}
            onValueChange={(v) =>
              onChange({ sourceType: v as DocumentBindingEntry["sourceType"] })
            }
          >
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">manual</SelectItem>
              <SelectItem value="static">static</SelectItem>
              <SelectItem value="http">http</SelectItem>
              <SelectItem value="object_storage">object_storage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">敏感级别</label>
          <Select
            value={binding.sensitivity ?? "internal"}
            onValueChange={(v) =>
              onChange({ sensitivity: v as DocumentBindingEntry["sensitivity"] })
            }
          >
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">public</SelectItem>
              <SelectItem value="internal">internal</SelectItem>
              <SelectItem value="confidential">confidential</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {binding.sensitivity === "confidential" && (
        <p className="text-[10px] text-red-600 mt-2">
          机密文档：请确认全局上下文策略包含脱敏规则。
        </p>
      )}
    </div>
  );
}

export default function BindingDocumentsSection() {
  const documents = useFlowAgentStore((s) => s.techConfig.documents?.documents);
  const techBindings = useFlowAgentStore((s) => s.techBindings);
  const setDocumentBinding = useFlowAgentStore((s) => s.setDocumentBinding);

  if (!documents?.length) {
    return (
      <p className="text-[12px] text-zinc-400 py-4">
        暂无文档契约。请先在「流程总览」生成技术配置。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <DocCard
          key={doc.id}
          doc={doc}
          binding={techBindings.documentsById[doc.id] ?? {}}
          onChange={(patch) => setDocumentBinding(doc.id, patch)}
        />
      ))}
    </div>
  );
}
