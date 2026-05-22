"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useFlowAgentStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowNodeData, FlowNodeInput, FlowNodeOutput, NodeExecutionMode, ConfirmStrategy, ConfirmStrategyConfig, ExecutionRule, FileAttachment, StrategySpec } from "@/lib/types";
import {
  RotateCcw, UserCheck, SkipForward,
  OctagonX, Settings, X, Bot, User as UserIcon,
  Plus, Trash2, Pencil, Search, Puzzle,
  Paperclip, FileText, Loader2, ListChecks, BrainCircuit,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { MOCK_MARKET_SKILLS } from "@/lib/mock-console";

function ExampleFileChips({ files, onRemove }: { files: FileAttachment[]; onRemove?: (storedName: string) => void }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {files.map((f) => (
        <span key={f.storedName} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100 text-[10px] text-blue-600 max-w-[140px]">
          <FileText className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{f.originalName}</span>
          {onRemove && (
            <button onClick={() => onRemove(f.storedName)} className="shrink-0 text-blue-400 hover:text-blue-600">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function getWorkUnitCopy(kind: FlowNodeData["workUnitKind"]) {
  const copies = {
    sop_step: {
      nature: "SOP 步骤",
      tabLabel: "🧾 操作与规则",
      stepTitle: "操作步骤",
      addLabel: "添加步骤",
      emptyHint: "例如：查看邮件 → 查找资料 → 填写表格 → 发送材料。",
      stepPlaceholder: "填写业务人员实际会做的动作",
      rulesTitle: "业务规则",
      rulesHint: "写清楚这一步要遵守的规则、例外情况或注意事项。",
      rulesPlaceholder: "例如：找不到 MSDS/SDS 时，需要邮件联系品控提供；颜色、状态等信息应来自 MSDS/SDS。",
      doneTitle: "完成标准",
      donePlaceholder: "可选；也可以由产出说明承接。",
      specTitle: "这一步怎么做",
    },
    strategy_step: {
      nature: "策略判断",
      tabLabel: "🧭 策略判断",
      stepTitle: "判断流程",
      addLabel: "添加判断步骤",
      emptyHint: "例如：先看资料完整性，再看风险等级，最后决定是否升级。",
      stepPlaceholder: "填写判断流程",
      rulesTitle: "策略/判断依据",
      rulesHint: "写清楚判断时看哪些材料、字段、信号或上下文。",
      rulesPlaceholder: "例如：订单金额、客户等级、物流状态、售后政策、历史投诉记录。",
      doneTitle: "完成标准",
      donePlaceholder: "例如：已形成带依据的判断结论，并标记是否需要升级。",
      specTitle: "这一步怎么判断",
    },
    workflow_step: {
      nature: "固定操作",
      tabLabel: "🧾 操作步骤",
      stepTitle: "具体操作步骤",
      addLabel: "添加步骤",
      emptyHint: "例如：查看客户是否提供订单号 → 要求补充必要材料 → 材料齐全后进入查询",
      stepPlaceholder: "填写这一步具体动作",
      rulesTitle: "业务规则",
      rulesHint: "写清楚这一步要遵守的规则、例外情况或校对要求；也可以上传规则文件。",
      rulesPlaceholder: "例如：破损类问题必须提供照片；客户未提供订单号时，可用邮箱或付款截图辅助定位。",
      doneTitle: "完成标准",
      donePlaceholder: "例如：必要材料已补齐，能支持下一步订单/物流/支付查询。",
      specTitle: "这一步怎么判断",
    },
    agentic_judgment: {
      nature: "业务判断",
      tabLabel: "🧭 判断规则",
      stepTitle: "判断逻辑",
      addLabel: "添加判断",
      emptyHint: "例如：先看客户语言和诉求，再判断问题类型；无法理解时转人工澄清。",
      stepPlaceholder: "填写这一步如何判断",
      rulesTitle: "判断规则",
      rulesHint: "写清楚看哪些信息、怎么判断、什么情况下需要升级或转人工。",
      rulesPlaceholder: "例如：无法识别语义或客户情绪极端时转人工；涉及退款承诺前必须先完成订单和政策判断。",
      doneTitle: "判断结果标准",
      donePlaceholder: "例如：已识别语言、问题类型、缺失材料和情绪风险。",
      specTitle: "这一步怎么判断",
    },
    agentic_strategy: {
      nature: "处理策略",
      tabLabel: "🧭 处理策略",
      stepTitle: "处理策略",
      addLabel: "添加策略",
      emptyHint: "例如：≤50美元且符合政策可普通处理；超过50美元、高风险或政策外补偿转主管确认。",
      stepPlaceholder: "填写判断后的处理策略",
      rulesTitle: "策略规则",
      rulesHint: "写清楚不同情况对应什么处理方式，以及哪些情况必须确认。",
      rulesPlaceholder: "例如：物流延误先查承运商状态；超过预计送达时间后，按国家和物流渠道判断优惠券、补发或退款。",
      doneTitle: "策略输出标准",
      donePlaceholder: "例如：输出处理建议、推荐理由、风险等级、是否需要主管确认。",
      specTitle: "这一步怎么判断",
    },
    agentic_generation: {
      nature: "内容生成",
      tabLabel: "✍️ 生成要求",
      stepTitle: "生成要求",
      addLabel: "添加要求",
      emptyHint: "例如：根据处理方案生成客户回复，涉及金额和政策时使用标准话术。",
      stepPlaceholder: "填写生成内容的要求",
      rulesTitle: "表达规则",
      rulesHint: "写清楚语气、禁用表达、必须包含的信息和需要确认的内容。",
      rulesPlaceholder: "例如：不得承诺政策外补偿；拒绝售后必须说明依据和下一步渠道。",
      doneTitle: "内容验收标准",
      donePlaceholder: "例如：客户回复包含处理结论、原因、下一步动作和预计时效。",
      specTitle: "这一步怎么生成",
    },
    agentic_feedback: {
      nature: "复盘沉淀",
      tabLabel: "📊 复盘内容",
      stepTitle: "复盘记录",
      addLabel: "添加记录项",
      emptyHint: "例如：记录客户是否接受、重复咨询原因、规则缺口和需要补充的话术。",
      stepPlaceholder: "填写要沉淀或复盘的内容",
      rulesTitle: "复盘规则",
      rulesHint: "写清楚哪些结果要回写、哪些情况要进入周复盘或规则更新。",
      rulesPlaceholder: "例如：每日汇总未解决问题和重复咨询原因；高频争议规则进入周复盘。",
      doneTitle: "沉淀结果标准",
      donePlaceholder: "例如：产出每日复盘摘要、规则补充建议和高频问题清单。",
      specTitle: "这一步怎么复盘",
    },
    human_gate: {
      nature: "确认关口",
      tabLabel: "✅ 确认标准",
      stepTitle: "确认动作",
      addLabel: "添加确认项",
      emptyHint: "例如：主管确认是否同意退款、补偿或转异常工单。",
      stepPlaceholder: "填写需要确认的事项",
      rulesTitle: "确认规则",
      rulesHint: "写清楚谁确认、确认什么、哪些情况必须升级。",
      rulesPlaceholder: "例如：金额>50美元、疑似欺诈、政策外补偿、客户连续不满必须主管确认。",
      doneTitle: "确认完成标准",
      donePlaceholder: "例如：已形成可执行处理结果，并记录确认人、理由和审计信息。",
      specTitle: "这一步怎么确认",
    },
    manual_operation: {
      nature: "人工操作",
      tabLabel: "🧾 人工操作",
      stepTitle: "人工操作步骤",
      addLabel: "添加操作",
      emptyHint: "例如：查看领导邮件 → 按 BBN/Part 查找 GSDS → 打开申请大表填写字段。",
      stepPlaceholder: "填写业务人员实际会做的动作",
      rulesTitle: "业务规则",
      rulesHint: "写清楚这一步原人工处理时会遵守的规则、注意事项或例外情况。",
      rulesPlaceholder: "例如：UN 编号必须来自 GSDS；目的港按邮件描述填写。",
      doneTitle: "完成标准",
      donePlaceholder: "例如：申请表关键字段已填写完整，能进入下一步提交。",
      specTitle: "这一步怎么做",
    },
    business_judgment: {
      nature: "业务判断",
      tabLabel: "🧭 判断口径",
      stepTitle: "判断过程",
      addLabel: "添加判断",
      emptyHint: "例如：先看客户诉求和材料是否齐全，再判断问题类型和是否需要升级。",
      stepPlaceholder: "填写业务人员实际如何判断",
      rulesTitle: "判断规则",
      rulesHint: "写清楚业务人员会看哪些信息、按什么口径判断、什么情况升级。",
      rulesPlaceholder: "例如：无法识别语义或客户情绪极端时转主管；涉及退款承诺前必须先完成订单和政策判断。",
      doneTitle: "判断结果标准",
      donePlaceholder: "例如：已形成问题类型、缺失材料、风险等级和下一步处理方向。",
      specTitle: "这一步怎么判断",
    },
    document_check: {
      nature: "文件检查",
      tabLabel: "🔍 检查规则",
      stepTitle: "检查动作",
      addLabel: "添加检查项",
      emptyHint: "例如：核对证书编号、有效期、品名、目的港是否与申请表一致。",
      stepPlaceholder: "填写业务人员实际检查的内容",
      rulesTitle: "检查规则",
      rulesHint: "写清楚需要对照哪些文件、检查哪些字段，以及检查不通过时进入哪条后续分支。",
      rulesPlaceholder: "例如：证书编号、有效期、品名和目的港需要与申请大表一致；字段不一致时输出差异清单。",
      doneTitle: "检查完成标准",
      donePlaceholder: "例如：已形成“核对通过”或“字段差异清单”，后续由对应分支处理。",
      specTitle: "这一步怎么检查",
    },
    handoff_wait: {
      nature: "交接等待",
      tabLabel: "⏳ 交接等待",
      stepTitle: "交接/等待动作",
      addLabel: "添加动作",
      emptyHint: "例如：把申请资料发送给海关 → 等待海关返回 IMI 证书。",
      stepPlaceholder: "填写交接或等待动作",
      rulesTitle: "跟进规则",
      rulesHint: "写清楚交给谁、等待什么结果、多久后跟进。",
      rulesPlaceholder: "例如：发出申请资料后通常两周收到 IMI 证书；超过时限需邮件跟进。",
      doneTitle: "完成标准",
      donePlaceholder: "例如：已收到对方返回的证书或明确反馈。",
      specTitle: "这一步怎么交接",
    },
    rework_update: {
      nature: "返修回填",
      tabLabel: "🔁 返修回填",
      stepTitle: "返修/回填动作",
      addLabel: "添加动作",
      emptyHint: "例如：证书有错时发送错误字段和正确值；或在证书无误后回填证书编号和有效期。",
      stepPlaceholder: "填写返修或回填动作",
      rulesTitle: "返修规则",
      rulesHint: "写清楚这个节点属于返修还是回填，以及进入这个节点的条件和处理去向。",
      rulesPlaceholder: "例如：证书字段有误时发回海关并等待重出证；证书无误分支才回填证书编号、有效期。",
      doneTitle: "完成标准",
      donePlaceholder: "例如：错误已发回处理，或证书信息已回填归档。",
      specTitle: "这一步怎么返修/回填",
    },
  } satisfies Record<NonNullable<FlowNodeData["workUnitKind"]>, {
    nature: string;
    tabLabel: string;
    stepTitle: string;
    addLabel: string;
    emptyHint: string;
    stepPlaceholder: string;
    rulesTitle: string;
    rulesHint: string;
    rulesPlaceholder: string;
    doneTitle: string;
    donePlaceholder: string;
    specTitle: string;
  }>;

  if (kind === "strategy_step" || kind === "agentic_judgment" || kind === "agentic_strategy" || kind === "business_judgment" || kind === "document_check") {
    return copies.strategy_step;
  }
  return copies.sop_step;
}

function useFileUpload(onUploaded: (file: FileAttachment) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const trigger = useCallback(() => inputRef.current?.click(), []);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const result = await res.json();
        if (result.success) onUploaded(result.file);
        else toast.error(`上传失败：${file.name}`, { description: result.error });
      } catch { toast.error(`上传失败：${file.name}`); }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [onUploaded]);

  const FileInput = (
    <input ref={inputRef} type="file" className="hidden" multiple
      accept=".pdf,.ppt,.pptx,.xlsx,.xls,.docx,.txt,.csv,.md,.json,.png,.jpg,.jpeg"
      onChange={handleChange} />
  );

  return { trigger, uploading, FileInput, inputRef };
}

function InputItemWithFiles({ inp, canEdit, onUpdate, onRemove, onAddFile, onRemoveFile }: {
  inp: FlowNodeInput;
  canEdit: boolean;
  onUpdate: (id: string, field: keyof FlowNodeInput, value: string | boolean) => void;
  onRemove: (id: string) => void;
  onAddFile: (file: FileAttachment) => void;
  onRemoveFile: (storedName: string) => void;
}) {
  const { trigger, uploading, FileInput } = useFileUpload(onAddFile);
  const files = inp.exampleFiles || [];

  return (
    <div className="p-2 rounded-lg border border-zinc-100 bg-zinc-50 group">
      {FileInput}
      <div className="flex items-center gap-2">
        {canEdit ? (
          <>
            <Input value={inp.name} onChange={(e) => onUpdate(inp.id, "name", e.target.value)} className="text-xs h-6 flex-1 bg-white" placeholder="名称" />
            <Input value={inp.description} onChange={(e) => onUpdate(inp.id, "description", e.target.value)} className="text-xs h-6 flex-1 bg-white" placeholder="说明" />
            <select value={inp.source} onChange={(e) => onUpdate(inp.id, "source", e.target.value)} className="text-[10px] h-6 px-1.5 rounded border border-zinc-200 bg-white text-zinc-600">
              <option value="user">用户提供</option>
              <option value="previous_step">上一步</option>
              <option value="default">默认值</option>
            </select>
            <label className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                checked={inp.required}
                onChange={(e) => onUpdate(inp.id, "required", e.target.checked)}
                className="h-3 w-3 rounded border-zinc-300 text-blue-600"
              />
              必填
            </label>
            <button onClick={() => onRemove(inp.id)} className="p-0.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <span className="text-xs flex-1">{inp.icon} {inp.name}</span>
            <span className="text-xs text-zinc-400 flex-1">{inp.description}</span>
            {!inp.required && (
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400">可选</span>
            )}
            <span className="text-[10px] text-zinc-400">{inp.source === "user" ? "👤 用户" : inp.sourceDetail || "上一步"}</span>
          </>
        )}
        <button onClick={trigger} disabled={uploading} className="p-0.5 text-zinc-300 hover:text-blue-500 transition-colors shrink-0" title="上传样例文件">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
        </button>
      </div>
      <ExampleFileChips files={files} onRemove={onRemoveFile} />
    </div>
  );
}

function OutputItemWithFiles({ out, canEdit, onUpdate, onRemove, onAddFile, onRemoveFile }: {
  out: FlowNodeOutput;
  canEdit: boolean;
  onUpdate: (id: string, field: keyof FlowNodeOutput, value: string) => void;
  onRemove: (id: string) => void;
  onAddFile: (file: FileAttachment) => void;
  onRemoveFile: (storedName: string) => void;
}) {
  const { trigger, uploading, FileInput } = useFileUpload(onAddFile);
  const files = out.exampleFiles || [];

  return (
    <div className="p-2 rounded-lg border border-zinc-100 bg-zinc-50 group">
      {FileInput}
      <div className="flex items-center gap-2">
        {canEdit ? (
          <>
            <Input value={out.name} onChange={(e) => onUpdate(out.id, "name", e.target.value)} className="text-xs h-6 flex-1 bg-white" placeholder="名称" />
            <Input value={out.description} onChange={(e) => onUpdate(out.id, "description", e.target.value)} className="text-xs h-6 flex-1 bg-white" placeholder="说明" />
            <button onClick={() => onRemove(out.id)} className="p-0.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <span className="text-xs flex-1">{out.icon} {out.name}</span>
            <span className="text-xs text-zinc-400 flex-1">{out.description}</span>
          </>
        )}
        <button onClick={trigger} disabled={uploading} className="p-0.5 text-zinc-300 hover:text-blue-500 transition-colors shrink-0" title="上传样例文件">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
        </button>
      </div>
      <ExampleFileChips files={files} onRemove={onRemoveFile} />
    </div>
  );
}

function SkillBinder({ value, disabled, onChange, onClear }: {
  value?: string;
  disabled: boolean;
  onChange: (name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = MOCK_MARKET_SKILLS.filter((s) =>
    s.status === "available" && (
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase())
    )
  );

  if (value) {
    return (
      <div>
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">绑定 Skill</p>
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2">
            <Puzzle className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-medium text-blue-700">{value}</span>
          </div>
          {!disabled && (
            <button onClick={onClear} className="text-blue-400 hover:text-blue-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">绑定 Skill</p>
      {!open ? (
        <button
          onClick={() => !disabled && setOpen(true)}
          className={`flex items-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400 transition-colors ${
            disabled ? "cursor-default opacity-60" : "hover:border-blue-300 hover:text-blue-500 cursor-pointer"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          搜索并绑定 Skill...
        </button>
      ) : (
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索技能名称..."
              className="w-full pl-8 pr-8 py-2 text-xs border-b border-zinc-100 outline-none"
            />
            <button onClick={() => { setOpen(false); setQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-[160px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-zinc-400 p-3 text-center">无匹配结果</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onChange(s.name); setOpen(false); setQuery(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700">{s.name}</span>
                    <Badge className="text-[9px] h-3.5 border-0 bg-zinc-100 text-zinc-500">{s.category === "general" ? "通用" : "行业"}</Badge>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{s.description}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ERROR_STRATEGY_CONFIG = {
  retry: { label: "自动重试", icon: RotateCcw, description: "失败后自动重试" },
  human_fallback: { label: "转人工处理", icon: UserCheck, description: "重试失败后通知人工介入" },
  skip: { label: "跳过这一步", icon: SkipForward, description: "跳过后继续执行下一步" },
  abort: { label: "终止整个流程", icon: OctagonX, description: "立即停止并通知所有相关人" },
};


const EXEC_MODES: { value: NodeExecutionMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "ai_auto", label: "AI 自动", icon: Bot },
  { value: "human_confirm", label: "需人工确认", icon: UserCheck },
  { value: "human_manual", label: "人工操作", icon: UserIcon },
];

const CONFIRM_STRATEGIES: { value: ConfirmStrategy; label: string; desc: string; icon: string }[] = [
  { value: "always", label: "每次确认", desc: "所有执行都需人工确认", icon: "🔒" },
  { value: "threshold", label: "置信度", desc: "AI 置信度低于阈值时确认", icon: "📊" },
  { value: "sampling", label: "抽检", desc: "按比例随机抽检", icon: "🎲" },
  { value: "rule_based", label: "规则触发", desc: "满足特定条件时确认", icon: "📋" },
  { value: "combined", label: "组合策略", desc: "多种策略组合使用", icon: "🔗" },
];

function ConfirmStrategyPanel({ config, editable, onChange }: {
  config: ConfirmStrategyConfig;
  editable: boolean;
  onChange: (cfg: ConfirmStrategyConfig) => void;
}) {
  const activeStrategy = CONFIRM_STRATEGIES.find((s) => s.value === config.strategy) || CONFIRM_STRATEGIES[0];

  return (
    <div className="pt-2 border-t border-dashed border-zinc-200">
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">确认策略</p>
      {editable ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {CONFIRM_STRATEGIES.map((s) => (
              <button
                key={s.value}
                onClick={() => onChange({ ...config, strategy: s.value })}
                className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] transition-all ${
                  config.strategy === s.value
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {config.strategy === "threshold" && (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[10px] text-zinc-500">置信度 &lt;</span>
              <Input
                type="number"
                value={config.threshold ?? 95}
                onChange={(e) => onChange({ ...config, threshold: Number(e.target.value) })}
                className="text-xs h-6 w-16"
                min={0}
                max={100}
              />
              <span className="text-[10px] text-zinc-500">% 时需确认</span>
            </div>
          )}

          {config.strategy === "sampling" && (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[10px] text-zinc-500">每</span>
              <Input
                type="number"
                value={config.samplingRate ? Math.round(1 / config.samplingRate) : 20}
                onChange={(e) => onChange({ ...config, samplingRate: 1 / Math.max(1, Number(e.target.value)) })}
                className="text-xs h-6 w-14"
                min={1}
              />
              <span className="text-[10px] text-zinc-500">份抽检 1 份</span>
            </div>
          )}

          {config.strategy === "rule_based" && (
            <div className="pl-1 space-y-1">
              <p className="text-[10px] text-zinc-500">触发规则：</p>
              {(config.rules || ["VIP 客户", "金额 > 10万"]).map((rule, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-amber-500">•</span>
                  <span className="text-[10px] text-zinc-600">{rule}</span>
                </div>
              ))}
              <button className="text-[10px] text-blue-500 hover:text-blue-600">+ 添加规则</button>
            </div>
          )}

          {config.strategy === "combined" && (
            <div className="pl-1 space-y-1 text-[10px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500">•</span>
                <span>置信度 &lt; {config.threshold ?? 95}% → 确认</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500">•</span>
                <span>VIP 客户 → 确认</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500">•</span>
                <span>其余按 {config.samplingRate ? `${Math.round(config.samplingRate * 100)}%` : "5%"} 抽检</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{activeStrategy.icon}</span>
          <span className="text-xs text-zinc-700">{activeStrategy.label}</span>
          <span className="text-[10px] text-zinc-400">— {activeStrategy.desc}</span>
        </div>
      )}
    </div>
  );
}

function ExecutionRulesSection({ rules, canEdit, onChange }: {
  rules: ExecutionRule[];
  canEdit: boolean;
  onChange: (rules: ExecutionRule[]) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const nonEmptyRules = rules.filter((r) => r.rule || r.detail);
  const hasRules = nonEmptyRules.length > 0 || editingIdx !== null;

  if (!hasRules && !canEdit) return null;

  const addRule = () => {
    const newRules: ExecutionRule[] = [...rules, { rule: "", detail: "", source: "user_confirmed" }];
    onChange(newRules);
    setEditingIdx(newRules.length - 1);
  };

  const removeRule = (idx: number) => {
    onChange(rules.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const updateRule = (idx: number, field: "rule" | "detail", value: string) => {
    const newRules = [...rules];
    newRules[idx] = { ...newRules[idx], [field]: value };
    onChange(newRules);
  };

  return (
    <div className="pt-2 border-t border-dashed border-zinc-200">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">注意事项</p>
        {canEdit && (
          <button onClick={addRule} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
            <Plus className="w-3 h-3" /> 添加
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <p className="text-[11px] text-zinc-400 text-center py-2 bg-zinc-50 rounded-lg">
          暂无特殊注意事项{canEdit ? "，可点击「添加」补充" : ""}
        </p>
      ) : (
        <div className="space-y-1.5">
          {rules.map((r, idx) => {
            const isEmpty = !r.rule && !r.detail;
            const isEditing = editingIdx === idx;

            if (isEmpty && !isEditing) return null;

            if (isEditing && canEdit) {
              return (
                <div key={idx} className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/30 space-y-1.5">
                  <Input
                    autoFocus
                    value={r.rule}
                    onChange={(e) => updateRule(idx, "rule", e.target.value)}
                    className="text-xs h-7 bg-white font-medium"
                    placeholder="简短概括，如：文件名容错、金额校验"
                  />
                  <Input
                    value={r.detail}
                    onChange={(e) => updateRule(idx, "detail", e.target.value)}
                    className="text-xs h-7 bg-white"
                    placeholder="具体怎么做，如：名称不匹配时取最近似的记录"
                  />
                  <div className="flex justify-end gap-1.5 pt-0.5">
                    <button
                      onClick={() => {
                        if (!r.rule && !r.detail) removeRule(idx);
                        else setEditingIdx(null);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:bg-zinc-100"
                    >
                      {!r.rule && !r.detail ? "取消" : "完成"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="p-2 rounded-lg border border-zinc-100 bg-zinc-50 group">
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                    r.source === "user_confirmed"
                      ? "bg-green-50 text-green-600 border border-green-200"
                      : "bg-blue-50 text-blue-500 border border-blue-200"
                  }`}>
                    {r.source === "user_confirmed" ? "已确认" : "AI 建议"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-700">{r.rule}</p>
                    {r.detail && <p className="text-[11px] text-zinc-500 mt-0.5">{r.detail}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setEditingIdx(idx)}
                        className="p-0.5 text-zinc-300 hover:text-blue-500"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeRule(idx)}
                        className="p-0.5 text-zinc-300 hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StrategyListField({
  title,
  hint,
  values,
  placeholder,
  onChange,
}: {
  title: string;
  hint: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const safeValues = Array.isArray(values) ? values : [];
  const updateItem = (idx: number, value: string) => {
    onChange(safeValues.map((item, itemIdx) => (itemIdx === idx ? value : item)));
  };
  const removeItem = (idx: number) => onChange(safeValues.filter((_, itemIdx) => itemIdx !== idx));
  const addItem = () => onChange([...safeValues, ""]);

  return (
    <div>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-zinc-600">{title}</p>
          <p className="mt-0.5 text-[10px] leading-4 text-zinc-400">{hint}</p>
        </div>
        <button onClick={addItem} className="flex shrink-0 items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
          <Plus className="h-3 w-3" /> 添加
        </button>
      </div>
      {safeValues.length === 0 ? (
        <button
          type="button"
          onClick={addItem}
          className="w-full rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-2.5 py-2 text-left text-[11px] text-zinc-400 hover:border-blue-200 hover:text-blue-500"
        >
          {placeholder}
        </button>
      ) : (
        <div className="space-y-1.5">
          {safeValues.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-[11px] text-zinc-400">{idx + 1}.</span>
              <Input
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                className="h-8 text-xs"
                placeholder={placeholder}
              />
              <button onClick={() => removeItem(idx)} className="p-1 text-zinc-400 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyStepFields({
  data,
  updateStrategySpec,
}: {
  data: FlowNodeData;
  updateStrategySpec: (patch: Partial<StrategySpec>) => void;
}) {
  const spec = data.strategySpec || {
    basis: data.judgmentSpec?.informationUsed || [],
    judgmentProcess: data.judgmentSpec?.judgmentRules || [],
    escalationConditions: data.judgmentSpec?.escalationConditions || [],
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-3">
        <p className="text-[11px] font-semibold text-violet-800">策略节点字段</p>
        <p className="mt-0.5 text-[10px] leading-4 text-violet-500">
          策略节点只填写判断依据、判断流程和异常/升级条件；判断结果放在“资料与产出”的输出里。
        </p>
      </div>

      <StrategyListField
        title="策略/判断依据"
        hint="写判断时看哪些材料、字段、信号或上下文；依据是“看什么”。"
        values={spec.basis || []}
        placeholder="例如：MSDS/SDS 是否存在、运输方式、目的港、品名、BBN、Part、证书有效期"
        onChange={(values) => updateStrategySpec({ basis: values })}
      />

      <StrategyListField
        title="判断流程"
        hint="写按什么顺序判断，以及什么条件对应什么结论或分支；流程是“怎么看”。"
        values={spec.judgmentProcess || []}
        placeholder="例如：先确认资料是否齐全；若 MSDS/SDS 缺失则补资料；若证书字段不一致则反馈重出证"
        onChange={(values) => updateStrategySpec({ judgmentProcess: values })}
      />

      <StrategyListField
        title="异常/升级条件"
        hint="写资料不足、规则冲突、高风险、超权限、无法判断时怎么办。"
        values={spec.escalationConditions || []}
        placeholder="例如：资料缺失时联系品控；规则冲突时找关务负责人确认；超时未回传时邮件跟进"
        onChange={(values) => updateStrategySpec({ escalationConditions: values })}
      />
    </div>
  );
}

const PANEL_WIDTH = "min(520px, 42vw)";

export default function NodeDetailPanel() {
  const { selectedNodeId, nodes, viewMode, currentRole, setSelectedNodeId, updateNodeData } = useFlowAgentStore();

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const data = node.data as unknown as FlowNodeData;
  const isTech = currentRole === "tech";
  const canEditLabel = !isTech;
  const canEditTechFields = isTech;
  const canEditErrorHandling = isTech;
  const canEditIOFields = true;

  const updateField = (field: string, value: unknown) => {
    updateNodeData(selectedNodeId, { [field]: value });
  };

  const updateInput = (inputId: string, field: keyof FlowNodeInput, value: string | boolean) => {
    const newInputs = data.inputs.map((inp) =>
      inp.id === inputId ? { ...inp, [field]: value } : inp
    );
    updateField("inputs", newInputs);
  };

  const addInput = () => {
    const newInputs = [
      ...data.inputs,
      { id: uuidv4(), name: "", icon: "📄", description: "", required: true, source: "user" as const },
    ];
    updateField("inputs", newInputs);
  };

  const removeInput = (inputId: string) => {
    updateField("inputs", data.inputs.filter((i) => i.id !== inputId));
  };

  const updateOutput = (outputId: string, field: keyof FlowNodeOutput, value: string) => {
    const newOutputs = data.outputs.map((out) =>
      out.id === outputId ? { ...out, [field]: value } : out
    );
    updateField("outputs", newOutputs);
  };

  const addOutput = () => {
    const newOutputs = [
      ...data.outputs,
      { id: uuidv4(), name: "", icon: "📋", description: "", flowsTo: [] as string[] },
    ];
    updateField("outputs", newOutputs);
  };

  const removeOutput = (outputId: string) => {
    updateField("outputs", data.outputs.filter((o) => o.id !== outputId));
  };

  const addInputFile = (inputId: string, file: FileAttachment) => {
    const newInputs = data.inputs.map((inp) =>
      inp.id === inputId ? { ...inp, exampleFiles: [...(inp.exampleFiles || []), file] } : inp
    );
    updateField("inputs", newInputs);
  };

  const removeInputFile = (inputId: string, storedName: string) => {
    const newInputs = data.inputs.map((inp) =>
      inp.id === inputId ? { ...inp, exampleFiles: (inp.exampleFiles || []).filter((f) => f.storedName !== storedName) } : inp
    );
    updateField("inputs", newInputs);
  };

  const addOutputFile = (outputId: string, file: FileAttachment) => {
    const newOutputs = data.outputs.map((out) =>
      out.id === outputId ? { ...out, exampleFiles: [...(out.exampleFiles || []), file] } : out
    );
    updateField("outputs", newOutputs);
  };

  const removeOutputFile = (outputId: string, storedName: string) => {
    const newOutputs = data.outputs.map((out) =>
      out.id === outputId ? { ...out, exampleFiles: (out.exampleFiles || []).filter((f) => f.storedName !== storedName) } : out
    );
    updateField("outputs", newOutputs);
  };

  const toggleErrorStrategy = (strategy: string) => {
    if (!canEditErrorHandling) return;
    const newHandling = data.errorHandling.map((eh) =>
      eh.strategy === strategy ? { ...eh, enabled: !eh.enabled } : eh
    );
    updateField("errorHandling", newHandling);
  };

  const operationSteps = Array.isArray(data.sopSpec?.operationSteps)
    ? data.sopSpec.operationSteps
    : Array.isArray(data.operationSteps)
      ? data.operationSteps
      : [];
  const businessRulesText = Array.isArray(data.sopSpec?.businessRules)
    ? data.sopSpec.businessRules.join("\n")
    : typeof data.checkRulesText === "string"
      ? data.checkRulesText
      : "";
  const workUnitCopy = getWorkUnitCopy(data.workUnitKind);
  const isStrategyLikeNode = data.workUnitKind === "strategy_step";
  const showDoneCriteria = false;

  const updateSopSpec = (patch: Partial<NonNullable<FlowNodeData["sopSpec"]>>) => {
    const next = {
      operationSteps,
      businessRules: businessRulesText.split(/\n+/).map((item) => item.trim()).filter(Boolean),
      ...(data.sopSpec || {}),
      ...patch,
    };
    updateNodeData(selectedNodeId, {
      sopSpec: next,
      operationSteps: next.operationSteps,
      checkRulesText: next.businessRules.join("\n"),
    });
  };
  const addOperationStep = () => updateSopSpec({ operationSteps: [...operationSteps, ""] });
  const updateOperationStep = (idx: number, value: string) =>
    updateSopSpec({ operationSteps: operationSteps.map((s, i) => (i === idx ? value : s)) });
  const removeOperationStep = (idx: number) =>
    updateSopSpec({ operationSteps: operationSteps.filter((_, i) => i !== idx) });
  const updateBusinessRules = (value: string) => {
    updateSopSpec({ businessRules: value.split(/\n+/).map((item) => item.trim()).filter(Boolean) });
  };
  const updateStrategySpec = (patch: Partial<StrategySpec>) => {
    const current = data.strategySpec || {
      basis: data.judgmentSpec?.informationUsed || [],
      judgmentProcess: data.judgmentSpec?.judgmentRules || [],
      escalationConditions: data.judgmentSpec?.escalationConditions || [],
    };
    const next = { ...current, ...patch };
    updateNodeData(selectedNodeId, {
      strategySpec: next,
      judgmentSpec: {
        ...(data.judgmentSpec || {}),
        informationUsed: next.basis,
        judgmentRules: next.judgmentProcess,
        escalationConditions: next.escalationConditions,
      },
    });
  };
  const switchBusinessKind = (kind: "sop_step" | "strategy_step") => {
    if (kind === data.workUnitKind) return;
    updateNodeData(selectedNodeId, {
      workUnitKind: kind,
      isCondition: false,
      operationSteps: kind === "sop_step" ? (operationSteps.length ? operationSteps : [""]) : [],
      checkRulesText: kind === "sop_step" ? (typeof data.checkRulesText === "string" ? data.checkRulesText : "") : "",
      sopSpec: kind === "sop_step"
        ? {
            operationSteps: operationSteps.length ? operationSteps : [""],
            businessRules: businessRulesText.split(/\n+/).map((item) => item.trim()).filter(Boolean),
          }
        : undefined,
      strategySpec: kind === "strategy_step"
        ? {
            basis: data.strategySpec?.basis || data.judgmentSpec?.informationUsed || [],
            judgmentProcess: data.strategySpec?.judgmentProcess || data.judgmentSpec?.judgmentRules || [],
            escalationConditions: data.strategySpec?.escalationConditions || data.judgmentSpec?.escalationConditions || [],
          }
        : undefined,
      doneCriteria: undefined,
      judgmentSpec: kind === "strategy_step"
        ? {
            informationUsed: data.strategySpec?.basis || data.judgmentSpec?.informationUsed || [],
            judgmentRules: data.strategySpec?.judgmentProcess || data.judgmentSpec?.judgmentRules || [],
            escalationConditions: data.strategySpec?.escalationConditions || data.judgmentSpec?.escalationConditions || [],
          }
        : undefined,
      agenticSpec: undefined,
    });
  };

  return (
    <div
      className="border-l border-zinc-200 bg-white flex flex-col h-full shrink-0"
      style={{ width: PANEL_WIDTH }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">📌</span>
          {canEditLabel ? (
            <input
              value={data.label}
              onChange={(e) => updateField("label", e.target.value)}
              className="text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none focus:ring-0 p-0 flex-1 min-w-0"
              placeholder="节点名称"
            />
          ) : (
            <h3 className="text-sm font-semibold text-zinc-900 truncate">{data.label}</h3>
          )}
          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
            {data.stepIndex}/{data.totalSteps}
          </Badge>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded-md hover:bg-zinc-100 transition-colors shrink-0"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <Tabs defaultValue="basic" className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start px-4 h-9 bg-zinc-50 rounded-none border-b border-zinc-100">
          <TabsTrigger value="basic" className="text-xs h-7">{isTech ? "📝 基本信息" : "📝 本步说明"}</TabsTrigger>
          <TabsTrigger value="io" className="text-xs h-7">{isTech ? "📥 输入输出" : "📥 资料与产出"}</TabsTrigger>
          <TabsTrigger value="error" className="text-xs h-7">{isTech ? "⚠️ 异常处理" : workUnitCopy.tabLabel}</TabsTrigger>
          {viewMode === "tech" && (
            <TabsTrigger value="tech" className="text-xs h-7">⚙️ 技术配置</TabsTrigger>
          )}
        </TabsList>

        <ScrollArea className="flex-1 min-h-0">
          {/* === 基本信息 === */}
          <TabsContent value="basic" className="px-4 py-3 mt-0 space-y-3">
            {!isTech ? (
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">节点类型</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: "sop_step" as const,
                      title: "SOP 型",
                      desc: "固定操作步骤",
                      icon: ListChecks,
                    },
                    {
                      value: "strategy_step" as const,
                      title: "策略型",
                      desc: "判断与分支依据",
                      icon: BrainCircuit,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = data.workUnitKind === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => switchBusinessKind(item.value)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold">{item.title}</span>
                          <span className="block truncate text-[10px] opacity-75">{item.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">节点描述</p>
              <Textarea
                value={data.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="text-sm min-h-[50px] bg-zinc-50 rounded-lg"
                placeholder="描述这个节点做什么"
              />
            </div>
            <div className="flex gap-4">
              {isTech ? (
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">执行方式</p>
                  <div className="flex gap-1.5">
                    {EXEC_MODES.map((mode) => {
                      const Icon = mode.icon;
                      const isActive = data.executionMode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          onClick={() => updateField("executionMode", mode.value)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-all ${
                            isActive
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">预计耗时</p>
                <Input
                  value={data.estimatedTime}
                  onChange={(e) => updateField("estimatedTime", e.target.value)}
                  className="text-xs h-7 w-28"
                  placeholder="约2分钟"
                />
              </div>
            </div>

            {/* 执行规则 — 注意事项 */}
            {isTech && (
              <>
                <ExecutionRulesSection
                  rules={data.executionRules || []}
                  canEdit={canEditTechFields}
                  onChange={(rules) => updateField("executionRules", rules)}
                />

                {data.executionMode === "human_confirm" && (
                  <ConfirmStrategyPanel
                    config={data.confirmStrategy || { strategy: "always" }}
                    editable={canEditTechFields}
                    onChange={(cfg) => updateField("confirmStrategy", cfg)}
                  />
                )}
              </>
            )}
          </TabsContent>

          {/* === 输入输出 === */}
          <TabsContent value="io" className="px-4 py-3 mt-0 space-y-4">
            {/* Inputs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">需要提供（输入）</p>
                {canEditIOFields && (
                  <button onClick={addInput} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
                    <Plus className="w-3 h-3" /> 添加
                  </button>
                )}
              </div>
              {data.inputs.length === 0 ? (
                <p className="text-[11px] text-zinc-400 text-center py-3 bg-zinc-50 rounded-lg">
                  暂无输入{canEditIOFields ? '，点击上方「添加」' : ''}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.inputs.map((inp) => (
                    <InputItemWithFiles
                      key={inp.id}
                      inp={inp}
                      canEdit={canEditIOFields}
                      onUpdate={updateInput}
                      onRemove={removeInput}
                      onAddFile={(file) => addInputFile(inp.id, file)}
                      onRemoveFile={(storedName) => removeInputFile(inp.id, storedName)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Outputs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">会产出（输出）</p>
                {canEditIOFields && (
                  <button onClick={addOutput} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
                    <Plus className="w-3 h-3" /> 添加
                  </button>
                )}
              </div>
              {data.outputs.length === 0 ? (
                <p className="text-[11px] text-zinc-400 text-center py-3 bg-zinc-50 rounded-lg">
                  暂无输出{canEditIOFields ? '，点击上方「添加」' : ''}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {!isTech && (
                    <p className="text-[11px] text-zinc-500 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                      请在“说明”中写清楚关键必填项，例如：客户名称、证书编号、日期、金额、审批意见等。
                    </p>
                  )}
                  {data.outputs.map((out) => (
                    <OutputItemWithFiles
                      key={out.id}
                      out={out}
                      canEdit={canEditIOFields}
                      onUpdate={updateOutput}
                      onRemove={removeOutput}
                      onAddFile={(file) => addOutputFile(out.id, file)}
                      onRemoveFile={(storedName) => removeOutputFile(out.id, storedName)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === 异常处理 === */}
          <TabsContent value="error" className="px-4 py-3 mt-0 space-y-2">
            {isTech ? (
              <>
                <p className="text-xs text-zinc-500 mb-2">如果这一步出错了，怎么办？</p>
                {data.errorHandling.map((eh) => {
                  const config = ERROR_STRATEGY_CONFIG[eh.strategy];
                  const Icon = config.icon;
                  return (
                    <button
                      key={eh.strategy}
                      onClick={() => toggleErrorStrategy(eh.strategy)}
                      disabled={!canEditTechFields}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left
                        ${eh.enabled ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-50"}
                        ${canEditTechFields ? "cursor-pointer hover:border-zinc-300" : "cursor-default"}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5
                        ${eh.enabled ? "border-blue-500 bg-blue-500" : "border-zinc-300"}`}>
                        {eh.enabled && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-700">{config.label}</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                {isStrategyLikeNode ? (
                  <StrategyStepFields
                    data={data}
                    updateStrategySpec={updateStrategySpec}
                  />
                ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-medium text-zinc-600">{workUnitCopy.stepTitle}</p>
                      <button onClick={addOperationStep} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
                        <Plus className="w-3 h-3" /> {workUnitCopy.addLabel}
                      </button>
                    </div>
                    {operationSteps.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 bg-zinc-50 rounded-lg px-2.5 py-2">
                        {workUnitCopy.emptyHint}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {operationSteps.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-400 w-5 shrink-0">{idx + 1}.</span>
                            <Input
                              value={step}
                              onChange={(e) => updateOperationStep(idx, e.target.value)}
                              className="h-8 text-xs"
                              placeholder={workUnitCopy.stepPlaceholder}
                            />
                            <button onClick={() => removeOperationStep(idx)} className="p-1 text-zinc-400 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[11px] font-medium text-zinc-600">{workUnitCopy.rulesTitle}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-400">{workUnitCopy.rulesHint}</p>
                      </div>
                    </div>
                    <Textarea
                      value={businessRulesText}
                      onChange={(e) => updateBusinessRules(e.target.value)}
                      className="mb-2 min-h-[72px] text-xs"
                      placeholder={workUnitCopy.rulesPlaceholder}
                    />
                  </div>

                  {showDoneCriteria ? (
                    <div>
                      <p className="text-[11px] font-medium text-zinc-600 mb-2">{workUnitCopy.doneTitle}</p>
                      <Textarea
                        value={typeof data.doneCriteria === "string" ? data.doneCriteria : ""}
                        onChange={(e) => updateField("doneCriteria", e.target.value)}
                        className="text-xs min-h-[64px]"
                        placeholder={workUnitCopy.donePlaceholder}
                      />
                    </div>
                  ) : null}
                </div>
                )}
              </>
            )}
          </TabsContent>

          {/* === 技术配置 === */}
          {viewMode === "tech" && (
            <TabsContent value="tech" className="px-4 py-3 mt-0 space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                <Settings className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-blue-700">此区域仅技术方可编辑</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">执行类型</p>
                  <div className="flex gap-2">
                    {(["deterministic", "intelligent"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          if (isTech && selectedNodeId) {
                            updateNodeData(selectedNodeId, {
                              techConfig: { ...data.techConfig, executionType: t },
                            });
                          }
                        }}
                        disabled={!isTech}
                        className={`flex-1 p-2.5 rounded-lg border-2 transition-colors text-left
                          ${data.techConfig.executionType === t ? "border-blue-400 bg-blue-50" : "border-zinc-200"}
                          ${isTech ? "cursor-pointer hover:border-blue-300" : "cursor-default opacity-60"}`}
                      >
                        <span className="text-xs font-medium">{t === "deterministic" ? "🔧 确定性执行" : "🧠 智能规划"}</span>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{t === "deterministic" ? "Workflow" : "Agent Tech"}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <SkillBinder
                  value={data.techConfig.boundSkill}
                  disabled={!isTech}
                  onChange={(skillName) => {
                    if (selectedNodeId) {
                      updateNodeData(selectedNodeId, {
                        techConfig: { ...data.techConfig, boundSkill: skillName },
                      });
                      toast.success(`已绑定 Skill：${skillName}`);
                    }
                  }}
                  onClear={() => {
                    if (selectedNodeId) {
                      updateNodeData(selectedNodeId, {
                        techConfig: { ...data.techConfig, boundSkill: undefined },
                      });
                    }
                  }}
                />
                <div>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">可行性评估</p>
                  <div className="flex gap-2">
                    {(["confirmed", "partial", "infeasible"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          if (isTech && selectedNodeId) {
                            updateNodeData(selectedNodeId, {
                              techConfig: { ...data.techConfig, feasibility: f },
                            });
                          }
                        }}
                        disabled={!isTech}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors
                          ${data.techConfig.feasibility === f ? "border-blue-400 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-500"}
                          ${isTech ? "cursor-pointer hover:border-blue-300" : "cursor-default opacity-60"}`}
                      >
                        {f === "confirmed" && "✅ 可做"}
                        {f === "partial" && "⚠️ 部分可做"}
                        {f === "infeasible" && "❌ 不可做"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  );
}
