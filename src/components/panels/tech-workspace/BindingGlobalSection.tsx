"use client";

import { useCallback, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { useFlowAgentStore } from "@/lib/store";
import type { FlowNodeData } from "@/lib/types";
import { computeBindingCompletion } from "@/lib/tech-binding-helpers";
import { REGISTERED_TRIGGER_OPTIONS } from "@/lib/registered-skills";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 从名称派生 kebab-case 编码：
 *   "GSDS 入库 Job" → "gsds-job"
 *   "PDF Parser Service" → "pdf-parser-service"
 *   纯中文 → "job-" + 4 位随机
 */
function slugify(name: string): string {
  const tokens = name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => /^[a-zA-Z0-9]+$/.test(t))
    .map((t) => t.toLowerCase());

  if (tokens.length === 0) {
    return `job-${Math.random().toString(36).slice(2, 6)}`;
  }
  return tokens.join("-");
}

/** 从首节点 inputs 自动推导 Job 输入 Schema 并展示只读预览 */
function InputSchemaPreview() {
  const nodes = useFlowAgentStore((s) => s.nodes);

  const { schema, source } = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => {
      const da = a.data as unknown as FlowNodeData;
      const db = b.data as unknown as FlowNodeData;
      return (da.stepIndex ?? 0) - (db.stepIndex ?? 0);
    });
    const first = sorted[0];
    if (!first) return { schema: null, source: "" };
    const data = first.data as unknown as FlowNodeData;
    const userInputs = data.inputs.filter((i) => i.source === "user");
    if (userInputs.length === 0) return { schema: null, source: data.label };

    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];
    for (const inp of userInputs) {
      const key = inp.name.replace(/\s+/g, "_").toLowerCase();
      const dt = inp.dataType || "string";
      const prop: Record<string, unknown> = { type: dt, description: inp.description || inp.name };

      if (inp.subFields && inp.subFields.length > 0) {
        if (dt === "json" || dt === "object") {
          const sub: Record<string, { type: string; description: string }> = {};
          for (const sf of inp.subFields) {
            if (sf.key.trim()) sub[sf.key] = { type: sf.type || "string", description: sf.desc };
          }
          prop.type = "object";
          prop.properties = sub;
        } else if (dt === "array") {
          const items: Record<string, { type: string; description: string }> = {};
          for (const sf of inp.subFields) {
            if (sf.key.trim()) items[sf.key] = { type: sf.type || "string", description: sf.desc };
          }
          prop.type = "array";
          prop.items = { type: "object", properties: items };
        }
      }

      properties[key] = prop;
      if (inp.required) required.push(key);
    }
    return {
      schema: { type: "object" as const, properties, ...(required.length ? { required } : {}) },
      source: data.label,
    };
  }, [nodes]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-[13px] font-semibold text-zinc-800 mb-1">输入数据结构</p>
      <div className="flex items-start gap-1.5 mb-3">
        <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-snug">
          自动从首节点「{source || "—"}」的用户输入推导，导出 JobSpec 时写入{" "}
          <span className="font-mono">input_schema</span>。无需手动编写。
        </p>
      </div>
      {schema ? (
        <pre className="text-[10px] font-mono bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-x-auto max-h-48 leading-relaxed">
          {JSON.stringify(schema, null, 2)}
        </pre>
      ) : (
        <p className="text-[11px] text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">
          首节点暂无用户输入项，导出时将省略此字段。
        </p>
      )}
    </div>
  );
}

export default function BindingGlobalSection() {
  const techBindings = useFlowAgentStore((s) => s.techBindings);
  const nodes = useFlowAgentStore((s) => s.nodes);
  const techConfig = useFlowAgentStore((s) => s.techConfig);
  const techJobMeta = useFlowAgentStore((s) => s.techJobMeta);
  const jobTriggerCodes = useFlowAgentStore((s) => s.jobTriggerCodes);
  const setTechJobMeta = useFlowAgentStore((s) => s.setTechJobMeta);
  const setJobTriggerCodes = useFlowAgentStore((s) => s.setJobTriggerCodes);
  const setTechBindingsGlobal = useFlowAgentStore((s) => s.setTechBindingsGlobal);

  const completion = useMemo(
    () =>
      computeBindingCompletion(
        techBindings,
        nodes,
        techConfig.documents,
        techConfig.externals,
        {
          jobMeta: { code: techJobMeta.code, name: techJobMeta.name },
          jobTriggerCodes,
        }
      ),
    [techBindings, nodes, techConfig.documents, techConfig.externals, techJobMeta, jobTriggerCodes]
  );

  const g = techBindings.global;

  const isCodeLinked = !techJobMeta.codeManuallyEdited;
  const derivedCode = useMemo(() => slugify(techJobMeta.name), [techJobMeta.name]);

  const handleNameChange = useCallback(
    (name: string) => {
      if (isCodeLinked) {
        setTechJobMeta({ name, code: slugify(name) });
      } else {
        setTechJobMeta({ name });
      }
    },
    [isCodeLinked, setTechJobMeta]
  );

  const handleCodeChange = useCallback(
    (code: string) => {
      setTechJobMeta({ code, codeManuallyEdited: true });
    },
    [setTechJobMeta]
  );

  const handleResetCodeLink = useCallback(() => {
    setTechJobMeta({ code: derivedCode, codeManuallyEdited: false });
  }, [derivedCode, setTechJobMeta]);

  const triggers = jobTriggerCodes.length > 0 ? jobTriggerCodes : [""];

  const updateTrigger = (index: number, value: string) => {
    const next = [...triggers];
    next[index] = value;
    setJobTriggerCodes(next);
  };

  const addTrigger = () => {
    setJobTriggerCodes([...triggers, ""]);
  };

  const removeTrigger = (index: number) => {
    const next = triggers.filter((_, i) => i !== index);
    setJobTriggerCodes(next.length > 0 ? next : [""]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-[13px] font-semibold text-zinc-800 mb-1">Job 元信息</p>
        <p className="text-[11px] text-zinc-400 mb-3">
          Job 在平台中的唯一标识与基本描述，导出后对应 JobSpec 的 metadata 部分。
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
              名称 <span className="font-mono text-zinc-400 font-normal">metadata.name</span>
            </label>
            <p className="text-[10px] text-zinc-400 mb-1">展示在控制台和审批页</p>
            <Input
              value={techJobMeta.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="GSDS 入库 Job"
              className="text-[12px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
              唯一编码 <span className="font-mono text-zinc-400 font-normal">metadata.code</span>
            </label>
            <div className="flex items-center gap-1.5 mb-1">
              {isCodeLinked ? (
                <p className="text-[10px] text-blue-500">自动从名称派生 · 手动修改后将停止联动</p>
              ) : (
                <>
                  <p className="text-[10px] text-zinc-400">已手动指定</p>
                  <button
                    type="button"
                    onClick={handleResetCodeLink}
                    className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
                    title="恢复为从名称自动派生"
                  >
                    <RotateCcw className="w-3 h-3" />
                    恢复自动
                  </button>
                </>
              )}
            </div>
            <p className="text-[9px] text-zinc-400 mb-1">最终唯一性由平台注册时校验，重复则拒绝</p>
            <Input
              value={techJobMeta.code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="gsds-ingest-job"
              className={`font-mono text-[12px] ${isCodeLinked ? "bg-zinc-50 text-zinc-600" : ""}`}
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
              业务说明 <span className="font-mono text-zinc-400 font-normal">metadata.description</span>
            </label>
            <Textarea
              value={techJobMeta.description}
              onChange={(e) => setTechJobMeta({ description: e.target.value })}
              placeholder="用一两句话描述这个 Job 做什么…"
              rows={3}
              className="text-[12px] resize-none"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-[13px] font-semibold text-zinc-800 mb-1">触发条件</p>
        <p className="text-[11px] text-zinc-400 mb-3">
          什么情况下会启动这个 Job？从平台已注册的触发器中填写对应编码，一行一项。
        </p>
        <div className="space-y-2">
          {triggers.map((code, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Select
                value={code || undefined}
                onValueChange={(v) => updateTrigger(i, v ?? "")}
              >
                <SelectTrigger className="text-[12px] w-full min-w-0">
                  <SelectValue placeholder="选择触发器…" />
                </SelectTrigger>
                <SelectContent>
                  {REGISTERED_TRIGGER_OPTIONS.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      <span className="flex flex-col gap-0.5 text-left">
                        <span>{t.title}</span>
                        <span className="text-[9px] text-zinc-400 font-mono">{t.code}</span>
                        {t.summary && (
                          <span className="text-[9px] text-zinc-400">{t.summary}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {triggers.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 shrink-0"
                  onClick={() => removeTrigger(i)}
                  aria-label="删除"
                >
                  <Trash2 className="w-4 h-4 text-zinc-400" />
                </Button>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" className="h-8 text-[11px]" onClick={addTrigger}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            添加触发器
          </Button>
        </div>
      </div>

      <InputSchemaPreview />

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-[13px] font-semibold text-zinc-800 mb-1">全局配置</p>
        <p className="text-[11px] text-zinc-400 mb-3">
          对应 JobSpec 的 <span className="font-mono">globalConfig</span> 部分。
        </p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
              时区 <span className="font-mono text-zinc-400 font-normal">globalConfig.timezone</span>
            </label>
            <Input
              value={g.timezone ?? ""}
              onChange={(e) => setTechBindingsGlobal({ timezone: e.target.value })}
              className="font-mono text-[12px]"
              placeholder="Asia/Shanghai"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-zinc-800">导出前校验</p>
          <Badge variant="secondary" className="text-[10px]">
            {completion.percent}%
          </Badge>
        </div>
        <ul className="space-y-1.5">
          {completion.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px]">
              {c.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <span className={c.ok ? "text-zinc-600" : "text-zinc-700"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
