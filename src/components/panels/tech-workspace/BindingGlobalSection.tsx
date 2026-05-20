"use client";

import { useCallback, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { useFlowAgentStore } from "@/lib/store";
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
 *   "GSDS 入库流程" → "gsds"
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

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

/** 从已注册 TriggerDefinition.input_schema 展示 JobSpec input_schema 预览 */
function InputSchemaPreview({ triggerCodes }: { triggerCodes: string[] }) {
  const selectedCodes = triggerCodes.map((code) => code.trim()).filter(Boolean);
  const selectedTriggers = selectedCodes.map((code) =>
    REGISTERED_TRIGGER_OPTIONS.find((trigger) => trigger.code === code)
  );
  const missingCodes = selectedCodes.filter((code, index) => !selectedTriggers[index]);
  const schemas = selectedTriggers
    .map((trigger) => trigger?.inputSchema)
    .filter((schema): schema is Record<string, unknown> => Boolean(schema));
  const schemaKeys = [...new Set(schemas.map(stableStringify))];
  const hasIncompatibleSchemas = schemaKeys.length > 1;
  const schema =
    selectedCodes.length === 0
      ? {}
      : hasIncompatibleSchemas
        ? schemas[0] ?? {}
        : schemas[0] ?? {};

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-[13px] font-semibold text-zinc-800 mb-1">输入数据结构</p>
      <div className="flex items-start gap-1.5 mb-3">
        <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-snug">
          只读预览，来自已注册 TriggerDefinition.input_schema；导出 JobSpec 时映射为 input_schema。
        </p>
      </div>
      {selectedCodes.length === 0 ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          当前未选择触发器，JobSpec input_schema 预览为空对象；发布前必须绑定已注册 Trigger。
        </div>
      ) : null}
      {missingCodes.length > 0 ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          以下触发器不在当前资源注册清单中：{missingCodes.join("、")}。需要先注册或同步资源清单。
        </div>
      ) : null}
      {hasIncompatibleSchemas ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          多个触发器的 input_schema 不一致。建议在资源注册平台合并为统一 Trigger，或补充 Trigger 到标准 Job 输入的映射后再发布。
        </div>
      ) : null}
      {selectedTriggers.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedTriggers.map((trigger, index) =>
            trigger ? (
              <Badge key={`${trigger.code}-${index}`} variant="secondary" className="text-[10px]">
                {trigger.title} · {trigger.code}
              </Badge>
            ) : null
          )}
        </div>
      ) : null}
      <pre className="max-h-48 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-[10px] leading-relaxed text-zinc-100">
        {JSON.stringify(schema, null, 2)}
      </pre>
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
        <p className="text-[13px] font-semibold text-zinc-800 mb-1">基础信息</p>
        <p className="text-[11px] text-zinc-400 mb-3">
          填写这个自动化流程在平台里的名称、编码和说明。
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
              名称
            </label>
            <p className="text-[10px] text-zinc-400 mb-1">展示在控制台和审批页</p>
            <Input
              value={techJobMeta.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="填写流程名称"
              className="text-[12px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
              唯一编码
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
              placeholder="填写平台唯一编码"
              className={`font-mono text-[12px] ${isCodeLinked ? "bg-zinc-50 text-zinc-600" : ""}`}
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
              业务说明
            </label>
            <Textarea
              value={techJobMeta.description}
              onChange={(e) => setTechJobMeta({ description: e.target.value })}
              placeholder="用一两句话描述这个流程做什么…"
              rows={3}
              className="text-[12px] resize-none"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-[13px] font-semibold text-zinc-800 mb-1">触发条件</p>
        <p className="text-[11px] text-zinc-400 mb-3">
          什么情况下会启动这个流程？从平台已注册的触发器中选择对应编码。
        </p>
        <div className="space-y-2">
          {triggers.map((code, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Select
                value={code ?? ""}
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

      <InputSchemaPreview triggerCodes={jobTriggerCodes} />

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
