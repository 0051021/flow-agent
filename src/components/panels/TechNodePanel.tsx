"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronRight, Plus, Trash2, FileText } from "lucide-react";
import { useFlowAgentStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FlowNodeData, FlowNodeInput, FlowNodeOutput, NodeBindingEntry, PlatformTaskType, SubField } from "@/lib/types";
import {
  REGISTERED_SKILL_OPTIONS,
  isRegisteredSkillCode,
  REGISTERED_CONTEXT_POLICY_OPTIONS,
} from "@/lib/registered-skills";

function slugifyTaskCode(name: string): string {
  const tokens = name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => /^[a-zA-Z0-9]+$/.test(t))
    .map((t) => t.toLowerCase());
  if (tokens.length === 0) return `task-${Math.random().toString(36).slice(2, 6)}`;
  return tokens.join("-");
}

/** Select 占位：未选择具体 Skill（导出前会被过滤） */
const SKILL_NONE = "__skill_none__";

const EXECUTION_MODE_OPTIONS: {
  value: string;
  label: string;
  desc: string;
  taskType: PlatformTaskType;
  runtimeProfileCode: string;
}[] = [
  { value: "agentic-default", label: "AI 自主执行", desc: "调用大模型进行理解、推理、解析", taskType: "agentic", runtimeProfileCode: "agentic-default" },
  { value: "integration-default", label: "接口调用", desc: "调 HTTP / API，查数据库、发请求", taskType: "integration", runtimeProfileCode: "integration-default" },
  { value: "script-fast", label: "脚本执行", desc: "纯规则校验、数据转换，不走大模型", taskType: "deterministic", runtimeProfileCode: "script-fast" },
  { value: "human-bridge", label: "人工处理", desc: "推送给人完成，等待回调", taskType: "human_review", runtimeProfileCode: "human-bridge" },
];

function inferExecutionMode(data: FlowNodeData): string {
  if (data.executionMode === "human_manual" || data.executionMode === "human_confirm") {
    return "human-bridge";
  }
  return "agentic-default";
}

const COMPLEX_TYPES = new Set(["json", "object", "array", "map", "record"]);

const EXAMPLE_HINT: Record<string, string> = {
  json: "描述对象内部有哪些字段，方便上下游对齐",
  object: "描述对象内部有哪些字段，方便上下游对齐",
  array: "描述列表中每一项的结构",
  map: "描述 key-value 的结构",
  record: "描述记录的字段结构",
};


const DATA_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "string", label: "string — 文本" },
  { value: "number", label: "number — 数值" },
  { value: "boolean", label: "boolean — 是/否" },
  { value: "json", label: "json — 结构化对象" },
  { value: "array", label: "array — 列表" },
  { value: "file", label: "file — 文件引用" },
];

function SubFieldEditor({
  hint,
  subFields,
  onChange,
}: {
  hint: string;
  subFields: SubField[];
  onChange: (sf: SubField[]) => void;
}) {
  return (
    <div className="ml-5 pl-2 border-l-2 border-zinc-200 space-y-1.5">
      <p className="text-[9px] text-zinc-400">{hint}</p>
      {subFields.map((sf, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            value={sf.key}
            onChange={(e) => {
              const next = [...subFields];
              next[i] = { ...sf, key: e.target.value };
              onChange(next);
            }}
            className="h-7 text-[10px] font-mono flex-1 min-w-0"
            placeholder="字段名"
          />
          <Select
            value={sf.type || "string"}
            onValueChange={(v) => {
              const next = [...subFields];
              next[i] = { ...sf, type: v ?? "string" };
              onChange(next);
            }}
          >
            <SelectTrigger className="h-7 text-[10px] font-mono w-20 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={sf.desc}
            onChange={(e) => {
              const next = [...subFields];
              next[i] = { ...sf, desc: e.target.value };
              onChange(next);
            }}
            className="h-7 text-[10px] text-zinc-500 flex-1 min-w-0"
            placeholder="说明"
          />
          <button
            type="button"
            onClick={() => onChange(subFields.filter((_, j) => j !== i))}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...subFields, { key: "", type: "string", desc: "" }])}
        className="flex items-center gap-1 text-[9px] text-blue-500 hover:text-blue-700 transition-colors"
      >
        <Plus className="w-2.5 h-2.5" /> 添加子字段
      </button>
    </div>
  );
}

type AnyField = FlowNodeInput | FlowNodeOutput;

function DataFieldList<T extends AnyField>({
  title,
  fields,
  showSource,
  onUpdate,
  onAdd,
  addLabel,
}: {
  title: string;
  fields: T[];
  showSource?: boolean;
  onUpdate: (next: T[]) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <p className="text-[10px] text-zinc-500 font-medium mb-1.5">{title}</p>
      <div className="space-y-1">
        {fields.map((field, idx) => {
          const dt = (field.dataType ?? "").toLowerCase();
          const isComplex = COMPLEX_TYPES.has(dt);
          const isExpanded = expandedIds.has(field.id);

          return (
            <div key={field.id} className="space-y-1">
              <div className="flex items-center gap-1.5">
                {isComplex ? (
                  <button
                    type="button"
                    onClick={() => toggle(field.id)}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 transition-colors"
                    title={isExpanded ? "收起示例" : "展开示例"}
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                ) : (
                  <div className="shrink-0 w-5" />
                )}
                <Input
                  value={field.name}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...field, name: e.target.value };
                    onUpdate(next);
                  }}
                  className="h-8 text-[11px] flex-1 min-w-0"
                  placeholder="字段名称"
                />
                <Select
                  value={field.dataType ?? "string"}
                  onValueChange={(v) => {
                    const next = [...fields];
                    next[idx] = { ...field, dataType: v };
                    onUpdate(next);
                  }}
                >
                  <SelectTrigger className="h-8 text-[11px] font-mono w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showSource && "source" in field ? (
                  <span className="text-[9px] text-zinc-400 w-8 shrink-0 text-center">
                    {(field as FlowNodeInput).source === "user" ? "入" : "↓"}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onUpdate(fields.filter((_, i) => i !== idx))}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="删除此字段"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="ml-5">
                <Input
                  value={field.description}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...field, description: e.target.value };
                    onUpdate(next);
                  }}
                  className="h-6 text-[10px] text-zinc-500 border-transparent bg-transparent hover:border-zinc-200 focus:border-zinc-300 px-1.5 italic placeholder:not-italic"
                  placeholder="说明这个字段的含义…"
                />
              </div>
              {isComplex && isExpanded && (
                <SubFieldEditor
                  hint={EXAMPLE_HINT[dt] ?? EXAMPLE_HINT.json}
                  subFields={field.subFields ?? []}
                  onChange={(sf) => {
                    const next = [...fields];
                    next[idx] = { ...field, subFields: sf };
                    onUpdate(next);
                  }}
                />
              )}
              {field.exampleFiles && field.exampleFiles.length > 0 && (
                <div className="ml-5 flex flex-wrap gap-1">
                  {field.exampleFiles.map((f) => (
                    <span key={f.storedName} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100 text-[10px] text-blue-600">
                      <FileText className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate max-w-[100px]">{f.originalName}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 transition-colors ml-5"
        >
          <Plus className="w-3 h-3" /> {addLabel}
        </button>
      </div>
    </div>
  );
}

export default function TechNodePanel() {
  const selectedNodeId = useFlowAgentStore((s) => s.selectedNodeId);
  const nodes = useFlowAgentStore((s) => s.nodes);
  const techBindings = useFlowAgentStore((s) => s.techBindings);
  const setNodeBinding = useFlowAgentStore((s) => s.setNodeBinding);
  const setSelectedNodeId = useFlowAgentStore((s) => s.setSelectedNodeId);
  const updateNodeData = useFlowAgentStore((s) => s.updateNodeData);
  const node = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined),
    [nodes, selectedNodeId]
  );

  const binding: NodeBindingEntry = node ? techBindings.nodesById[node.id] ?? {} : {};
  const data = node?.data as FlowNodeData | undefined;

  const currentMode = binding.runtimeProfileCode ?? (data ? inferExecutionMode(data) : "agentic-default");
  const modeEntry = EXECUTION_MODE_OPTIONS.find((o) => o.value === currentMode) ?? EXECUTION_MODE_OPTIONS[0];
  const isHumanReview = modeEntry.taskType === "human_review";
  const needsSkill = !isHumanReview;

  const [taskCodeOverride, setTaskCodeOverride] = useState(false);
  const derivedTaskCode = data ? slugifyTaskCode(data.label) : "";
  const taskCode = binding.taskCode ?? derivedTaskCode;

  const skillRows = useMemo(() => {
    if (!needsSkill) return [] as string[];
    const raw =
      binding.skillBindingCodes && binding.skillBindingCodes.length > 0
        ? binding.skillBindingCodes
        : binding.skillBindingCode?.trim()
          ? [binding.skillBindingCode]
          : [""];
    return raw.map((c) => (typeof c === "string" ? c.trim() : ""));
  }, [binding, needsSkill]);

  const orphanSkillCodes = useMemo(() => {
    const s = new Set<string>();
    for (const c of skillRows) {
      const t = c.trim();
      if (t && !isRegisteredSkillCode(t)) s.add(t);
    }
    return [...s];
  }, [skillRows]);

  if (!node || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-zinc-400 p-4">
        未选中节点
      </div>
    );
  }

  const commitSkills = (rows: string[]) => {
    setNodeBinding(node.id, {
      skillBindingCodes: rows,
      skillBindingCode: undefined,
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-white overflow-hidden">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 pb-3 pt-4 lg:pt-11">
        <p className="text-[10px] text-zinc-400 mb-2 leading-snug">
          你已打开<strong className="font-medium text-zinc-600">单个节点的 Task</strong>
          绑定；与左侧画布步骤一一对应，不属于 Job 全局。
        </p>
        <Button
          type="button"
          variant="outline"
          className="mb-3 h-10 w-full justify-start gap-2 border-zinc-200 bg-zinc-50/80 text-[13px] font-medium text-zinc-800 hover:bg-zinc-100"
          onClick={() => setSelectedNodeId(null)}
        >
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          返回 Job 全局配置
        </Button>
        <Input
          value={data.label}
          onChange={(e) => {
            updateNodeData(node.id, { label: e.target.value });
            if (!taskCodeOverride) {
              setNodeBinding(node.id, { taskCode: undefined });
            }
          }}
          className="text-sm font-semibold text-zinc-900 h-8 px-2 border-transparent hover:border-zinc-300 focus:border-zinc-400 bg-transparent"
        />
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] text-zinc-400 shrink-0">Task 编码</span>
          <Input
            value={taskCode}
            readOnly={!taskCodeOverride}
            onChange={(e) => {
              if (taskCodeOverride) {
                setNodeBinding(node.id, { taskCode: e.target.value });
              }
            }}
            className={`font-mono text-[11px] h-6 px-1.5 flex-1 min-w-0 ${
              taskCodeOverride
                ? "border-zinc-300 bg-white"
                : "border-transparent bg-transparent text-zinc-500"
            }`}
          />
          {!taskCodeOverride ? (
            <button
              type="button"
              className="text-[10px] text-blue-500 hover:text-blue-700 shrink-0"
              onClick={() => {
                setTaskCodeOverride(true);
                setNodeBinding(node.id, { taskCode: taskCode });
              }}
            >
              手动编辑
            </button>
          ) : (
            <button
              type="button"
              className="text-[10px] text-zinc-400 hover:text-zinc-600 shrink-0"
              onClick={() => {
                setTaskCodeOverride(false);
                setNodeBinding(node.id, { taskCode: undefined });
              }}
            >
              自动
            </button>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 truncate mt-0.5">步骤 {data.stepIndex}/{data.totalSteps}</p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-5 pb-8">
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-zinc-700">执行器指令（Task.instruction）</p>
            <Textarea
              value={data.description || ""}
              onChange={(e) => updateNodeData(node.id, { description: e.target.value })}
              rows={3}
              className="text-[12px] text-zinc-600 leading-relaxed resize-none border-transparent hover:border-zinc-300 focus:border-zinc-400 bg-transparent p-2"
              placeholder="描述这个步骤要做什么…"
            />
            <p className="text-[10px] text-zinc-400">
              导出 JobSpec 时映射为 instruction；精细 Prompt 写在 Skill 内。
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-700">数据契约</p>
            <p className="text-[10px] text-zinc-400 leading-snug mb-1">
              AI 自动生成，可增删和修改字段。
            </p>

            <DataFieldList
              title="需要提供（输入）"
              fields={data.inputs}
              showSource
              onUpdate={(next) => updateNodeData(node.id, { inputs: next })}
              onAdd={() => {
                const newInput = {
                  id: `i-${node.id}-${Date.now()}`,
                  name: "",
                  icon: "📎",
                  description: "",
                  required: false,
                  source: "previous_step" as const,
                  dataType: "string",
                };
                updateNodeData(node.id, { inputs: [...data.inputs, newInput] });
              }}
              addLabel="添加输入字段"
            />

            <DataFieldList
              title="会产出（输出）"
              fields={data.outputs}
              onUpdate={(next) => updateNodeData(node.id, { outputs: next })}
              onAdd={() => {
                const newOutput = {
                  id: `o-${node.id}-${Date.now()}`,
                  name: "",
                  icon: "📎",
                  description: "",
                  flowsTo: [] as string[],
                  dataType: "string",
                };
                updateNodeData(node.id, { outputs: [...data.outputs, newOutput] });
              }}
              addLabel="添加输出字段"
            />
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-800">绑定（JobSpec Task）</p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
                  执行方式
                </label>
                <Select
                  value={currentMode}
                  onValueChange={(v) => {
                    const picked = EXECUTION_MODE_OPTIONS.find((o) => o.value === v);
                    if (!picked) return;
                    const patch: Partial<NodeBindingEntry> = {
                      taskType: picked.taskType,
                      runtimeProfileCode: picked.runtimeProfileCode,
                    };
                    if (picked.taskType === "human_review") {
                      patch.skillBindingCodes = [];
                      patch.skillBindingCode = undefined;
                    }
                    setNodeBinding(node.id, patch);
                  }}
                >
                  <SelectTrigger className="h-9 w-full min-w-0 text-[12px] *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXECUTION_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex flex-col gap-0.5 text-left">
                          <span>{o.label}</span>
                          <span className="text-[10px] text-zinc-500">{o.desc}</span>
                          <span className="font-mono text-[10px] text-zinc-400">taskType: {o.taskType} · runtime: {o.runtimeProfileCode}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={needsSkill ? "" : "hidden"}>
                <label className="text-[10px] text-zinc-500 block mb-1">绑定 Skill</label>
                <p className="text-[10px] text-zinc-400 mb-1.5">
                  从平台已注册列表中选择；导出 JobSpec 时仍写入 <span className="font-mono">skill_codes</span>。
                </p>
                <div className="space-y-1.5">
                  {skillRows.map((code, idx) => {
                    const selectValue = code.trim() ? code.trim() : SKILL_NONE;
                    return (
                      <div key={idx} className="flex gap-1">
                        <Select
                          value={selectValue}
                          onValueChange={(v) => {
                            const picked = v ?? SKILL_NONE;
                            const next = [...skillRows];
                            next[idx] = picked === SKILL_NONE ? "" : picked;
                            commitSkills(next);
                          }}
                          disabled={!needsSkill}
                        >
                          <SelectTrigger className="h-9 w-full min-w-0 text-[12px] *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                            <SelectValue placeholder="选择已注册的 Skill" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKILL_NONE}>
                              <span className="text-zinc-400">未选择</span>
                            </SelectItem>
                            {REGISTERED_SKILL_OPTIONS.map((s) => (
                              <SelectItem key={s.code} value={s.code}>
                                <span className="flex flex-col gap-0.5 text-left">
                                  <span>{s.title}</span>
                                  <span className="font-mono text-[10px] text-zinc-400">{s.code}</span>
                                  {s.summary ? (
                                    <span className="text-[10px] text-zinc-500">{s.summary}</span>
                                  ) : null}
                                </span>
                              </SelectItem>
                            ))}
                            {orphanSkillCodes.map((orphan) => (
                              <SelectItem key={orphan} value={orphan}>
                                <span className="flex flex-col gap-0.5 text-left">
                                  <span className="text-amber-700">未出现在当前注册表</span>
                                  <span className="font-mono text-[10px]">{orphan}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {needsSkill && skillRows.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0 px-2 text-[10px]"
                            onClick={() => {
                              const next = skillRows.filter((_, i) => i !== idx);
                              commitSkills(next.length ? next : [""]);
                            }}
                          >
                            删
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  {needsSkill ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => commitSkills([...skillRows, ""])}
                    >
                      + 绑定更多 Skill
                    </Button>
                  ) : null}
                </div>
              </div>
              {/* context_policy_code — 非人工 Task 必填 */}
              {!isHumanReview && (
                <div>
                  <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
                    上下文策略 <span className="font-mono text-zinc-400 font-normal">context_policy_code</span>
                  </label>
                  <p className="text-[9px] text-zinc-400 mb-1.5">
                    决定前序输出如何打包传给当前 Task，影响 Token 用量和推理质量
                  </p>
                  <Select
                    value={binding.contextPolicyCode ?? ""}
                    onValueChange={(v) => setNodeBinding(node.id, { contextPolicyCode: v || undefined })}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0 text-[12px] *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                      <SelectValue placeholder="选择上下文策略…" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTERED_CONTEXT_POLICY_OPTIONS.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          <span className="flex flex-col gap-0.5 text-left">
                            <span>{p.title}</span>
                            <span className="font-mono text-[10px] text-zinc-400">{p.code}</span>
                            {p.summary && <span className="text-[10px] text-zinc-500">{p.summary}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* review_policy_code */}
              <div>
                <label className="text-[10px] text-zinc-700 font-medium block mb-1">
                  人工确认 <span className="font-mono text-zinc-400 font-normal">review_policy_code</span>
                </label>
                {isHumanReview && (
                  <p className="text-[9px] text-amber-600 mb-1.5">
                    当前为「人工处理」模式，此字段必填
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNodeBinding(node.id, { reviewPolicyCode: "" })}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      !binding.reviewPolicyCode
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="block text-[12px] font-medium">自动通过</span>
                    <span className="block text-[10px] mt-0.5 opacity-70">执行完直接进入下一步</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNodeBinding(node.id, { reviewPolicyCode: "human-approve" })}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      binding.reviewPolicyCode
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="block text-[12px] font-medium">需要人工放行</span>
                    <span className="block text-[10px] mt-0.5 opacity-70">等待确认后才继续</span>
                  </button>
                </div>
              </div>

              {/* tool_codes — 非人工 Task 才显示 */}
              {!isHumanReview && (
                <>
                  <div>
                    <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
                      工具绑定 <span className="font-mono text-zinc-400 font-normal">tool_codes</span>
                    </label>
                    <p className="text-[9px] text-zinc-400 mb-1.5">Skill 执行时需要调用的平台工具（如文档抓取、邮件发送等）</p>
                    <div className="space-y-1.5">
                      {(binding.toolCodes ?? []).map((code, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <Input
                            value={code}
                            onChange={(e) => {
                              const next = [...(binding.toolCodes ?? [])];
                              next[i] = e.target.value;
                              setNodeBinding(node.id, { toolCodes: next });
                            }}
                            placeholder="如 contract-doc-fetch"
                            className="font-mono text-[11px] h-8 flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const next = (binding.toolCodes ?? []).filter((_, j) => j !== i);
                              setNodeBinding(node.id, { toolCodes: next });
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
                        className="h-7 text-[10px] text-zinc-500"
                        onClick={() => setNodeBinding(node.id, { toolCodes: [...(binding.toolCodes ?? []), ""] })}
                      >
                        <Plus className="w-3 h-3 mr-0.5" />
                        添加工具
                      </Button>
                    </div>
                  </div>

                  {/* secret_refs */}
                  <div>
                    <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
                      凭证引用 <span className="font-mono text-zinc-400 font-normal">secret_refs</span>
                    </label>
                    <p className="text-[9px] text-zinc-400 mb-1.5">Skill 连接外部系统时需要的密钥/凭证，由平台凭证管理器托管</p>
                    <div className="space-y-1.5">
                      {(binding.secretRefs ?? []).map((ref, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <Input
                            value={ref}
                            onChange={(e) => {
                              const next = [...(binding.secretRefs ?? [])];
                              next[i] = e.target.value;
                              setNodeBinding(node.id, { secretRefs: next });
                            }}
                            placeholder="如 contract-system-api-key"
                            className="font-mono text-[11px] h-8 flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const next = (binding.secretRefs ?? []).filter((_, j) => j !== i);
                              setNodeBinding(node.id, { secretRefs: next });
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
                        className="h-7 text-[10px] text-zinc-500"
                        onClick={() => setNodeBinding(node.id, { secretRefs: [...(binding.secretRefs ?? []), ""] })}
                      >
                        <Plus className="w-3 h-3 mr-0.5" />
                        添加凭证
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
