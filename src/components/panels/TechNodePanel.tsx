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
import type {
  FlowNodeData,
  FlowNodeInput,
  FlowNodeOutput,
  NodeBindingEntry,
  PlatformTaskType,
  SubField,
} from "@/lib/types";
import {
  REGISTERED_SKILL_OPTIONS,
  isRegisteredSkillCode,
  REGISTERED_CONTEXT_POLICY_OPTIONS,
  REGISTERED_RUNTIME_PROFILE_OPTIONS,
  REGISTERED_REVIEW_POLICY_OPTIONS,
  REGISTERED_TOOL_OPTIONS,
  REGISTERED_SECRET_OPTIONS,
  type RegisteredContextPolicyOption,
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
const TOOL_NONE = "__tool_none__";
const SECRET_NONE = "__secret_none__";

const TASK_TYPE_OPTIONS: {
  value: PlatformTaskType;
  label: string;
  desc: string;
}[] = [
  { value: "agentic", label: "agentic", desc: "大模型理解、推理、解析、生成" },
  { value: "integration", label: "integration", desc: "调用 Tool / HTTP Worker / 外部系统接口" },
  { value: "deterministic", label: "deterministic", desc: "确定性规则、校验、转换、评分" },
  { value: "human_review", label: "human_review", desc: "人工审核、确认、审批、补材料" },
];

const DEFAULT_RUNTIME_PROFILE_BY_TASK: Partial<Record<PlatformTaskType, string>> = {
  agentic: "agentic-default",
  integration: "integration-default",
  deterministic: "script-fast",
};

function inferTaskType(data: FlowNodeData): PlatformTaskType {
  if (data.executionMode === "human_manual" || data.executionMode === "human_confirm") {
    return "human_review";
  }
  return "agentic";
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

function ContextPolicySummary({ policy }: { policy: RegisteredContextPolicyOption | undefined }) {
  if (!policy) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[10px] text-amber-700">
        当前 context_policy_code 未出现在资源注册清单中。发布前需要在资源注册平台补注册，或改选已有 ContextPolicy。
      </div>
    );
  }

  const items = [
    { label: "Job 输入", value: policy.includesJobInput ? "包含" : "不包含" },
    { label: "上游输出", value: policy.includesUpstreamOutputs ? "包含" : "不包含" },
    { label: "ContextSource", value: policy.includeSources?.length ? policy.includeSources.join("、") : "无额外来源" },
    { label: "必填字段", value: policy.requiredFields?.length ? policy.requiredFields.join("、") : "未声明" },
    { label: "脱敏规则", value: policy.redactionPatterns?.length ? policy.redactionPatterns.join("、") : "默认平台脱敏" },
    { label: "最大包大小", value: policy.maxPayloadKb ? `${policy.maxPayloadKb} KB` : "平台默认" },
  ];

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-blue-700">已注册 ContextPolicy 摘要</p>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] text-blue-600">
          {policy.status ?? "published"}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-[64px_1fr] gap-2 text-[10px] leading-snug">
            <span className="text-blue-500">{item.label}</span>
            <span className="text-slate-600">{item.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] leading-snug text-slate-400">
        摘要只读，来自资源注册平台；FlowAgent 只在 JobSpec Task 中写入 context_policy_code。
      </p>
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

  const currentTaskType = binding.taskType ?? (data ? inferTaskType(data) : "agentic");
  const isHumanReview = currentTaskType === "human_review";
  const needsSkill = currentTaskType === "agentic";
  const runtimeProfileOptions = REGISTERED_RUNTIME_PROFILE_OPTIONS.filter((option) =>
    option.taskTypes.includes(currentTaskType)
  );
  const runtimeProfileCode =
    binding.runtimeProfileCode ?? DEFAULT_RUNTIME_PROFILE_BY_TASK[currentTaskType] ?? "";
  const selectedRuntimeMissing =
    !isHumanReview &&
    runtimeProfileCode.trim().length > 0 &&
    !REGISTERED_RUNTIME_PROFILE_OPTIONS.some((option) => option.code === runtimeProfileCode);
  const selectedContextPolicy = REGISTERED_CONTEXT_POLICY_OPTIONS.find(
    (p) => p.code === binding.contextPolicyCode
  );

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

  const orphanToolCodes = useMemo(() => {
    const s = new Set<string>();
    for (const c of binding.toolCodes ?? []) {
      const t = c.trim();
      if (t && !REGISTERED_TOOL_OPTIONS.some((tool) => tool.code === t)) s.add(t);
    }
    return [...s];
  }, [binding.toolCodes]);

  const orphanSecretRefs = useMemo(() => {
    const s = new Set<string>();
    for (const c of binding.secretRefs ?? []) {
      const t = c.trim();
      if (t && !REGISTERED_SECRET_OPTIONS.some((secret) => secret.code === t)) s.add(t);
    }
    return [...s];
  }, [binding.secretRefs]);

  if (!node || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-zinc-400 p-4">
        未选中节点
      </div>
    );
  }

  if (data.isCondition) {
    const branches = data.conditionBranches ?? [];
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full bg-white overflow-hidden">
        <div className="shrink-0 border-b border-zinc-200 bg-white px-4 pb-3 pt-4 lg:pt-11">
          <p className="text-[10px] text-zinc-400 mb-2 leading-snug">
            你已打开<strong className="font-medium text-zinc-600">路由节点</strong>；
            它不是 Task，不会进入 JobSpec 的 <span className="font-mono">tasks[]</span>。
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
            onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            className="text-sm font-semibold text-zinc-900 h-8 px-2 border-transparent hover:border-zinc-300 focus:border-zinc-400 bg-transparent"
          />
          <p className="mt-1 text-[10px] text-amber-600">Condition Gateway -&gt; JobSpec flow.condition</p>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-5 pb-8">
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[12px] font-semibold text-amber-900">路由节点说明</p>
              <p className="mt-1 text-[11px] leading-5 text-amber-800">
                路由节点只承载 if / else 分支。它应该读取前一个可执行 Task 的输出字段，
                然后把出边编译成 <span className="font-mono">flow.condition</span>。
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-white/80 p-3 text-[10px] leading-relaxed text-zinc-700">
{`flow:
  - from: 上游-task-code
    to: 下游-task-code
    condition:
      path: destination_region
      equals: taiwan`}
              </pre>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
              <div>
                <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
                  路由含义
                </label>
                <Textarea
                  value={data.description || ""}
                  onChange={(e) => updateNodeData(node.id, { description: e.target.value })}
                  rows={3}
                  className="text-[12px] text-zinc-600 leading-relaxed resize-none"
                  placeholder="例如：根据识别出的目的港，把订单分流到台湾、香港或人工确认路径。"
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-zinc-800 mb-1">分支规则</p>
                <p className="text-[10px] text-zinc-400 mb-2">
                  每一行对应一条出边条件。目标节点名称用于辅助理解，实际导出时会根据画布连线解析为下游 Task code。
                </p>
                <div className="space-y-2">
                  {branches.map((branch, idx) => (
                    <div key={idx} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-2 space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Input
                          value={branch.label}
                          onChange={(e) => {
                            const next = [...branches];
                            next[idx] = { ...branch, label: e.target.value };
                            updateNodeData(node.id, { conditionBranches: next });
                          }}
                          className="h-8 text-[11px]"
                          placeholder='例如 destination_region = "taiwan"'
                        />
                        <Input
                          value={branch.targetLabel}
                          onChange={(e) => {
                            const next = [...branches];
                            next[idx] = { ...branch, targetLabel: e.target.value };
                            updateNodeData(node.id, { conditionBranches: next });
                          }}
                          className="h-8 text-[11px]"
                          placeholder="目标节点名称"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateNodeData(node.id, { conditionBranches: branches.filter((_, i) => i !== idx) })}
                        >
                          <Trash2 className="w-3 h-3 text-zinc-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() =>
                      updateNodeData(node.id, {
                        conditionBranches: [
                          ...branches,
                          { label: "", icon: "•", targetLabel: "" },
                        ],
                      })
                    }
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    添加分支
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </div>
    );
  }

  const commitSkills = (rows: string[]) => {
    setNodeBinding(node.id, {
      skillBindingCodes: rows,
      skillBindingCode: undefined,
    });
  };

  const commitToolAt = (index: number, value: string) => {
    const nextToolCodes = [...(binding.toolCodes ?? [])];
    const picked = value === TOOL_NONE ? "" : value;
    nextToolCodes[index] = picked;

    const pickedTool = REGISTERED_TOOL_OPTIONS.find((tool) => tool.code === picked);
    const requiredSecrets = pickedTool?.secretRefs ?? [];
    const nextSecretRefs = Array.from(new Set([...(binding.secretRefs ?? []), ...requiredSecrets]));

    setNodeBinding(node.id, {
      toolCodes: nextToolCodes,
      secretRefs: nextSecretRefs,
    });
  };

  const commitSecretAt = (index: number, value: string) => {
    const nextSecretRefs = [...(binding.secretRefs ?? [])];
    nextSecretRefs[index] = value === SECRET_NONE ? "" : value;
    setNodeBinding(node.id, { secretRefs: nextSecretRefs });
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
            <p className="text-[11px] font-semibold text-zinc-700">Task 输入/输出 Schema</p>
            <p className="text-[10px] text-zinc-400 leading-snug mb-1">
              定义当前 Task 的验收输入和输出，导出到 JobSpec 的 input_schema / output_schema；数据来源和工具实现由已注册资源决定。
            </p>

            <DataFieldList
              title="输入字段 input_schema"
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
              title="输出字段 output_schema"
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
                  Task 类型 <span className="font-mono text-zinc-400 font-normal">type</span>
                </label>
                <Select
                  value={currentTaskType}
                  onValueChange={(v) => {
                    const picked = TASK_TYPE_OPTIONS.find((o) => o.value === v);
                    if (!picked) return;
                    const nextTaskType = picked.value;
                    const patch: Partial<NodeBindingEntry> = {
                      taskType: nextTaskType,
                    };
                    if (nextTaskType === "human_review") {
                      patch.runtimeProfileCode = undefined;
                      patch.contextPolicyCode = undefined;
                      patch.skillBindingCodes = [];
                      patch.skillBindingCode = undefined;
                      patch.toolCodes = [];
                      patch.secretRefs = [];
                      patch.reviewPolicyCode = binding.reviewPolicyCode || "gsds-data-steward-review";
                    } else {
                      patch.runtimeProfileCode =
                        DEFAULT_RUNTIME_PROFILE_BY_TASK[nextTaskType] ?? binding.runtimeProfileCode;
                      patch.reviewPolicyCode = "";
                      if (nextTaskType !== "agentic") {
                        patch.skillBindingCodes = [];
                        patch.skillBindingCode = undefined;
                      }
                    }
                    setNodeBinding(node.id, patch);
                  }}
                >
                  <SelectTrigger className="h-9 w-full min-w-0 text-[12px] *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex flex-col gap-0.5 text-left">
                          <span>{o.label}</span>
                          <span className="text-[10px] text-zinc-500">{o.desc}</span>
                          <span className="font-mono text-[10px] text-zinc-400">type: {o.value}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isHumanReview ? (
                <div>
                  <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
                    执行器配置 <span className="font-mono text-zinc-400 font-normal">runtime_profile_code</span>
                  </label>
                  <p className="text-[9px] text-zinc-400 mb-1.5">
                    选择资源注册平台已发布的 RuntimeProfile code。
                  </p>
                  <Select
                    value={runtimeProfileCode}
                    onValueChange={(v) => setNodeBinding(node.id, { runtimeProfileCode: v || undefined })}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0 text-[12px] *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                      <SelectValue placeholder="选择 RuntimeProfile…" />
                    </SelectTrigger>
                    <SelectContent>
                      {runtimeProfileOptions.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          <span className="flex flex-col gap-0.5 text-left">
                            <span>{option.title}</span>
                            <span className="font-mono text-[10px] text-zinc-400">{option.code}</span>
                            {option.summary ? (
                              <span className="text-[10px] text-zinc-500">{option.summary}</span>
                            ) : null}
                            {option.providerType ? (
                              <span className="text-[10px] text-blue-500">provider: {option.providerType}</span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                      {selectedRuntimeMissing ? (
                        <SelectItem value={runtimeProfileCode}>
                          <span className="flex flex-col gap-0.5 text-left">
                            <span className="text-amber-700">未出现在当前注册表</span>
                            <span className="font-mono text-[10px]">{runtimeProfileCode}</span>
                          </span>
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {needsSkill ? (
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">绑定 Skill</label>
                  <p className="text-[10px] text-zinc-400 mb-1.5">
                    仅 Agentic Task 需要；导出 JobSpec 时写入 <span className="font-mono">skill_codes</span>。
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
                          {skillRows.length > 1 ? (
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => commitSkills([...skillRows, ""])}
                    >
                      + 绑定更多 Skill
                    </Button>
                  </div>
                </div>
              ) : null}
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
                  <div className="mt-2">
                    {binding.contextPolicyCode ? (
                      <ContextPolicySummary policy={selectedContextPolicy} />
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[10px] text-amber-700">
                        非人工 Task 发布前必须绑定已注册的 context_policy_code。
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* review_policy_code — 仅 human_review Task 必填 */}
              {isHumanReview && (
                <div>
                  <label className="text-[10px] text-zinc-700 font-medium block mb-1">
                    人工审核策略 <span className="font-mono text-zinc-400 font-normal">review_policy_code</span>
                  </label>
                  <p className="text-[9px] text-amber-600 mb-1.5">
                    当前为 human_review Task，此字段发布前必须绑定已注册 ReviewPolicy。
                  </p>
                  <Select
                    value={binding.reviewPolicyCode ?? ""}
                    onValueChange={(v) => setNodeBinding(node.id, { reviewPolicyCode: v || undefined })}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0 text-[12px] *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                      <SelectValue placeholder="选择 ReviewPolicy…" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTERED_REVIEW_POLICY_OPTIONS.map((policy) => (
                        <SelectItem key={policy.code} value={policy.code}>
                          <span className="flex flex-col gap-0.5 text-left">
                            <span>{policy.title}</span>
                            <span className="font-mono text-[10px] text-zinc-400">{policy.code}</span>
                            {policy.summary ? (
                              <span className="text-[10px] text-zinc-500">{policy.summary}</span>
                            ) : null}
                            {policy.slaHours ? (
                              <span className="text-[10px] text-blue-500">SLA: {policy.slaHours} 小时</span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                      {binding.reviewPolicyCode &&
                      !REGISTERED_REVIEW_POLICY_OPTIONS.some((policy) => policy.code === binding.reviewPolicyCode) ? (
                        <SelectItem value={binding.reviewPolicyCode}>
                          <span className="flex flex-col gap-0.5 text-left">
                            <span className="text-amber-700">未出现在当前注册表</span>
                            <span className="font-mono text-[10px]">{binding.reviewPolicyCode}</span>
                          </span>
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* tool_codes — 非人工 Task 才显示 */}
              {!isHumanReview && (
                <>
                  <div>
                    <label className="text-[10px] text-zinc-700 font-medium block mb-0.5">
                      工具绑定 <span className="font-mono text-zinc-400 font-normal">tool_codes</span>
                    </label>
                    <p className="text-[9px] text-zinc-400 mb-1.5">从资源注册平台选择当前 Task 允许调用的 Tool code</p>
                    <div className="space-y-1.5">
                      {(binding.toolCodes ?? []).map((code, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <Select
                            value={code.trim() ? code.trim() : TOOL_NONE}
                            onValueChange={(v) => commitToolAt(i, v ?? TOOL_NONE)}
                          >
                            <SelectTrigger className="h-8 flex-1 min-w-0 text-[11px] font-mono *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                              <SelectValue placeholder="选择 Tool…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={TOOL_NONE}>
                                <span className="text-zinc-400">未选择</span>
                              </SelectItem>
                              {REGISTERED_TOOL_OPTIONS.map((tool) => (
                                <SelectItem key={tool.code} value={tool.code}>
                                  <span className="flex flex-col gap-0.5 text-left">
                                    <span>{tool.title}</span>
                                    <span className="font-mono text-[10px] text-zinc-400">{tool.code}</span>
                                    {tool.summary ? (
                                      <span className="text-[10px] text-zinc-500">{tool.summary}</span>
                                    ) : null}
                                    {tool.secretRefs?.length ? (
                                      <span className="font-mono text-[10px] text-blue-500">
                                        secret_refs: {tool.secretRefs.join(", ")}
                                      </span>
                                    ) : null}
                                  </span>
                                </SelectItem>
                              ))}
                              {orphanToolCodes.map((orphan) => (
                                <SelectItem key={orphan} value={orphan}>
                                  <span className="flex flex-col gap-0.5 text-left">
                                    <span className="text-amber-700">未出现在当前注册表</span>
                                    <span className="font-mono text-[10px]">{orphan}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                    <p className="text-[9px] text-zinc-400 mb-1.5">从资源注册平台选择 Secret code；选中 Tool 时会自动补齐其依赖 Secret</p>
                    <div className="space-y-1.5">
                      {(binding.secretRefs ?? []).map((ref, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <Select
                            value={ref.trim() ? ref.trim() : SECRET_NONE}
                            onValueChange={(v) => commitSecretAt(i, v ?? SECRET_NONE)}
                          >
                            <SelectTrigger className="h-8 flex-1 min-w-0 text-[11px] font-mono *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                              <SelectValue placeholder="选择 Secret…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SECRET_NONE}>
                                <span className="text-zinc-400">未选择</span>
                              </SelectItem>
                              {REGISTERED_SECRET_OPTIONS.map((secret) => (
                                <SelectItem key={secret.code} value={secret.code}>
                                  <span className="flex flex-col gap-0.5 text-left">
                                    <span>{secret.title}</span>
                                    <span className="font-mono text-[10px] text-zinc-400">{secret.code}</span>
                                    {secret.summary ? (
                                      <span className="text-[10px] text-zinc-500">{secret.summary}</span>
                                    ) : null}
                                    {secret.status ? (
                                      <span className="text-[10px] text-blue-500">status: {secret.status}</span>
                                    ) : null}
                                  </span>
                                </SelectItem>
                              ))}
                              {orphanSecretRefs.map((orphan) => (
                                <SelectItem key={orphan} value={orphan}>
                                  <span className="flex flex-col gap-0.5 text-left">
                                    <span className="text-amber-700">未出现在当前注册表</span>
                                    <span className="font-mono text-[10px]">{orphan}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
