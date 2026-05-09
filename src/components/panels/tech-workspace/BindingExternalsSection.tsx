"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useFlowAgentStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ExternalSystemEntry {
  id: string;
  name: string;
  type: "database" | "file_system" | "api" | "web_portal" | "email";
  integration: {
    current: "manual" | "api" | "file_transfer" | "email" | "database_query";
    target: "manual" | "api" | "file_transfer" | "email" | "database_query";
    readiness: "ready" | "partial" | "not_available";
  };
  auth: {
    type: "none" | "username_password" | "bearer_token" | "certificate" | "smtp_credentials" | "unknown";
  };
  capabilities: string[];
    constraints: { type: "availability" | "rate_limit" | "file_size" | "response_time" | "format"; detail: string }[];
  humanFallback: string;
}

const SYSTEM_TYPES: { value: ExternalSystemEntry["type"]; label: string }[] = [
  { value: "database", label: "数据库" },
  { value: "file_system", label: "文件系统" },
  { value: "api", label: "API" },
  { value: "web_portal", label: "Web 门户" },
  { value: "email", label: "邮件" },
];

const INTEGRATION_MODES: { value: ExternalSystemEntry["integration"]["current"]; label: string }[] = [
  { value: "manual", label: "人工操作" },
  { value: "api", label: "API 调用" },
  { value: "file_transfer", label: "文件传输" },
  { value: "database_query", label: "数据库查询" },
  { value: "email", label: "邮件" },
];

const READINESS_OPTIONS: { value: ExternalSystemEntry["integration"]["readiness"]; label: string; desc: string }[] = [
  { value: "ready", label: "就绪", desc: "可直接对接" },
  { value: "partial", label: "部分就绪", desc: "需要额外开发或配置" },
  { value: "not_available", label: "不可用", desc: "尚未提供接口" },
];

const AUTH_TYPES: { value: ExternalSystemEntry["auth"]["type"]; label: string }[] = [
  { value: "none", label: "无认证" },
  { value: "username_password", label: "账号密码" },
  { value: "bearer_token", label: "Bearer Token" },
  { value: "certificate", label: "证书" },
  { value: "smtp_credentials", label: "SMTP 凭证" },
  { value: "unknown", label: "待确认" },
];

const CONSTRAINT_TYPES: { value: ExternalSystemEntry["constraints"][0]["type"]; label: string }[] = [
  { value: "availability", label: "可用性" },
  { value: "rate_limit", label: "限流" },
  { value: "file_size", label: "文件大小" },
  { value: "response_time", label: "响应时间" },
  { value: "format", label: "格式" },
];

const READINESS_STYLE: Record<string, string> = {
  ready: "text-emerald-700 bg-emerald-50",
  partial: "text-amber-700 bg-amber-50",
  not_available: "text-zinc-500 bg-zinc-100",
};

function makeEmptySystem(): ExternalSystemEntry {
  return {
    id: `sys-${Date.now().toString(36)}`,
    name: "",
    type: "api",
    integration: { current: "manual", target: "api", readiness: "partial" },
    auth: { type: "unknown" },
    capabilities: [],
    constraints: [],
    humanFallback: "",
  };
}

function SystemCard({
  system,
  onChange,
  onRemove,
}: {
  system: ExternalSystemEntry;
  onChange: (updated: ExternalSystemEntry) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const readinessStyle = READINESS_STYLE[system.integration.readiness] ?? "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-zinc-50/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
        <span className="text-[13px] font-semibold text-zinc-800 flex-1 text-left">
          {system.name || "未命名系统"}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${readinessStyle}`}>
          {READINESS_OPTIONS.find((r) => r.value === system.integration.readiness)?.label ?? "—"}
        </span>
        <span className="text-[10px] text-zinc-400 font-mono">{system.id}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-100 space-y-3 pt-3">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">
                系统名称 <span className="font-mono text-zinc-400">name</span>
              </label>
              <Input
                value={system.name}
                onChange={(e) => onChange({ ...system, name: e.target.value })}
                placeholder="如：GSDS 主数据库"
                className="text-[12px]"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">
                系统类型 <span className="font-mono text-zinc-400">type</span>
              </label>
              <Select value={system.type} onValueChange={(v) => onChange({ ...system, type: v as ExternalSystemEntry["type"] })}>
                <SelectTrigger className="text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 对接方式 */}
          <div>
            <p className="text-[10px] font-medium text-zinc-700 mb-1.5">
              对接方式 <span className="font-mono text-zinc-400 font-normal">integration</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] text-zinc-400 block mb-0.5">当前 current</label>
                <Select value={system.integration.current} onValueChange={(v) => onChange({ ...system, integration: { ...system.integration, current: v as ExternalSystemEntry["integration"]["current"] } })}>
                  <SelectTrigger className="text-[11px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTEGRATION_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 block mb-0.5">目标 target</label>
                <Select value={system.integration.target} onValueChange={(v) => onChange({ ...system, integration: { ...system.integration, target: v as ExternalSystemEntry["integration"]["target"] } })}>
                  <SelectTrigger className="text-[11px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTEGRATION_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 block mb-0.5">就绪度 readiness</label>
                <Select value={system.integration.readiness} onValueChange={(v) => onChange({ ...system, integration: { ...system.integration, readiness: v as ExternalSystemEntry["integration"]["readiness"] } })}>
                  <SelectTrigger className="text-[11px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {READINESS_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="flex flex-col gap-0.5 text-left">
                          <span>{r.label}</span>
                          <span className="text-[9px] text-zinc-400">{r.desc}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 认证方式 */}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">
              认证方式 <span className="font-mono text-zinc-400">auth.type</span>
            </label>
            <Select value={system.auth.type} onValueChange={(v) => onChange({ ...system, auth: { type: v as ExternalSystemEntry["auth"]["type"] } })}>
              <SelectTrigger className="text-[12px] w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 能力 */}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">
              能力清单 <span className="font-mono text-zinc-400">capabilities</span>
            </label>
            <Input
              value={system.capabilities.join("、")}
              onChange={(e) => onChange({ ...system, capabilities: e.target.value.split("、").map((s) => s.trim()).filter(Boolean) })}
              placeholder="如：INSERT、UPDATE 覆盖、按 BBN+PART 查询"
              className="text-[11px]"
            />
            <p className="text-[9px] text-zinc-400 mt-0.5">用顿号分隔多项</p>
          </div>

          {/* 约束条件 */}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">
              约束条件 <span className="font-mono text-zinc-400">constraints</span>
            </label>
            <div className="space-y-1.5">
              {system.constraints.map((c, ci) => (
                <div key={ci} className="flex gap-1.5 items-start">
                  <Select
                    value={c.type}
                    onValueChange={(v) => {
                      const next = [...system.constraints];
                      next[ci] = { ...next[ci], type: v as ExternalSystemEntry["constraints"][0]["type"] };
                      onChange({ ...system, constraints: next });
                    }}
                  >
                    <SelectTrigger className="text-[10px] h-7 w-24 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSTRAINT_TYPES.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={c.detail}
                    onChange={(e) => {
                      const next = [...system.constraints];
                      next[ci] = { ...next[ci], detail: e.target.value };
                      onChange({ ...system, constraints: next });
                    }}
                    placeholder="详细说明"
                    className="text-[10px] h-7 flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      const next = system.constraints.filter((_, j) => j !== ci);
                      onChange({ ...system, constraints: next });
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-zinc-400" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-zinc-500"
                onClick={() => onChange({ ...system, constraints: [...system.constraints, { type: "availability" as const, detail: "" }] })}
              >
                <Plus className="w-3 h-3 mr-0.5" />
                添加约束
              </Button>
            </div>
          </div>

          {/* 人工兜底 */}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">
              人工兜底方案 <span className="font-mono text-zinc-400">humanFallback</span>
            </label>
            <Textarea
              value={system.humanFallback}
              onChange={(e) => onChange({ ...system, humanFallback: e.target.value })}
              placeholder="系统不可用时的人工兜底方案…"
              rows={2}
              className="text-[11px] resize-none"
            />
          </div>

          {/* 删除 */}
          <div className="pt-1 border-t border-zinc-100">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50" onClick={onRemove}>
              <Trash2 className="w-3 h-3 mr-1" />
              移除此系统
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BindingExternalsSection() {
  const externalSystems = useFlowAgentStore((s) => s.techConfig.externals?.externalSystems);
  const setTechExternals = useFlowAgentStore((s) => s.setTechExternals);

  const systems: ExternalSystemEntry[] = (externalSystems ?? []).map((sys) => ({
    id: sys.id,
    name: sys.name,
    type: sys.type,
    integration: sys.integration,
    auth: sys.auth,
    capabilities: sys.capabilities ?? [],
    constraints: sys.constraints ?? [],
    humanFallback: sys.humanFallback ?? "",
  }));

  function updateSystem(index: number, updated: ExternalSystemEntry) {
    const next = [...systems];
    next[index] = updated;
    syncToStore(next);
  }

  function removeSystem(index: number) {
    const next = systems.filter((_, i) => i !== index);
    syncToStore(next);
  }

  function addSystem() {
    syncToStore([...systems, makeEmptySystem()]);
  }

  function syncToStore(list: ExternalSystemEntry[]) {
    const mapped = list.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      integration: s.integration,
      auth: s.auth,
      capabilities: s.capabilities,
      constraints: s.constraints,
      humanFallback: s.humanFallback,
      relatedNodes: [] as string[],
      automationPriority: "medium" as const,
      estimatedEffort: "—",
    }));
    setTechExternals({ externalSystems: mapped });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-[11px] text-blue-900 leading-relaxed">
        登记本 Job 依赖的外部系统。Runtime/Agent 执行 Skill 时，会根据这里的系统 ID 查找连接方式和凭证。
      </div>

      {systems.length === 0 && (
        <p className="text-[12px] text-zinc-400 py-4 text-center">暂无外部系统，点击下方按钮添加。</p>
      )}

      {systems.map((sys, i) => (
        <SystemCard
          key={sys.id}
          system={sys}
          onChange={(updated) => updateSystem(i, updated)}
          onRemove={() => removeSystem(i)}
        />
      ))}

      <Button type="button" variant="secondary" size="sm" className="h-8 text-[11px] w-full" onClick={addSystem}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        添加外部系统
      </Button>
    </div>
  );
}
