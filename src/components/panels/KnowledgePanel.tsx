"use client";

import { useState } from "react";
import { useFlowAgentStore } from "@/lib/store";
import { MOCK_TECH_FILES } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Search, FileText, X, ChevronDown, ChevronRight, Code2,
} from "lucide-react";
import type { KnowledgeFile } from "@/lib/types";

type TabId = "business" | "tech";

function FileList({ files, searchQuery }: { files: KnowledgeFile[]; searchQuery: string }) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const categories = [...new Set(files.map((f) => f.category))];
  const filtered = searchQuery
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : files;

  const groupedFiles = categories
    .map((cat) => ({
      category: cat,
      files: filtered.filter((f) => f.category === cat),
    }))
    .filter((g) => g.files.length > 0);

  if (groupedFiles.length === 0) {
    return <p className="text-center text-xs text-zinc-400 py-6">没有匹配的文件</p>;
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {groupedFiles.map((group) => (
        <div key={group.category}>
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            {group.category}
          </p>
          <div className="space-y-1">
            {group.files.map((file) => (
              <div key={file.id} className="rounded-lg border border-zinc-200 overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  onClick={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
                >
                  {expandedFile === file.id ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  )}
                  <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-xs font-medium text-zinc-700 truncate">{file.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 ml-auto shrink-0">
                    {file.updatedAt}
                  </Badge>
                </button>
                {expandedFile === file.id && (
                  <div className="px-3 pb-3 border-t border-zinc-100">
                    <pre className="mt-2 text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed font-sans">
                      {file.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function KnowledgePanel() {
  const { knowledgeFiles, showKnowledgePanel, setShowKnowledgePanel, currentRole } = useFlowAgentStore();
  const [searchQuery, setSearchQuery] = useState("");
  const isTech = currentRole === "tech";
  const [activeTab, setActiveTab] = useState<TabId>("business");

  if (!showKnowledgePanel) return null;

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = isTech
    ? [
        { id: "business", label: "业务文档", icon: BookOpen },
        { id: "tech", label: "技术参考", icon: Code2 },
      ]
    : [
        { id: "business", label: "业务文档", icon: BookOpen },
      ];

  const currentFiles = activeTab === "tech" ? MOCK_TECH_FILES : knowledgeFiles;

  return (
    <div className="w-[340px] border-l border-zinc-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">
            {isTech ? "知识 & 技术参考" : "知识中心"}
          </h3>
        </div>
        <button
          onClick={() => setShowKnowledgePanel(false)}
          className="p-1 rounded-md hover:bg-zinc-100 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Tabs (only show if tech has multiple tabs) */}
      {tabs.length > 1 && (
        <div className="flex border-b border-zinc-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
                  ${isActive
                    ? "text-zinc-900 border-b-2 border-zinc-900"
                    : "text-zinc-400 hover:text-zinc-600"
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`text-[10px] ${isActive ? "text-zinc-500" : "text-zinc-300"}`}>
                  {tab.id === "tech" ? MOCK_TECH_FILES.length : knowledgeFiles.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "tech" ? "搜索技术文档..." : "搜索业务文档..."}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        <FileList files={currentFiles} searchQuery={searchQuery} />
      </ScrollArea>
    </div>
  );
}
