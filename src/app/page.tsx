"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Workflow, ArrowRight, Sparkles, BarChart3, PenTool,
  ShieldCheck, Zap, GitBranch,
  ArrowUpRight, Code2, ListChecks,
  Paperclip, X, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useFlowAgentStore, type ChatAttachment } from "@/lib/store";
import QuizPromptBuilder from "@/components/ui/QuizPromptBuilder";

const EXAMPLES = [
  {
    icon: "📱",
    title: "小红书账号运营",
    description: "把内容策略、发布节奏、合规红线和复盘方式一次讲清楚。",
    type: "agentic" as const,
    steps: 4,
    time: "约 15 分钟",
    prompt: "我们市场部要做小红书账号运营，目标是3个月从1万涨到5万粉丝。我们的运营方法是：每天发3条图文，内容以美妆测评为主（60%），穿搭教程（30%），互动话题（10%）。发布时间是早8点、中午12点、晚8点。合规红线：不提竞品品牌名、不做功效承诺、图片必须原创。每月预算不超过5000元。希望系统按这个策略协助执行，每周给我数据报告，数据不好的时候给调整建议，但改方向需要我批准。",
  },
  {
    icon: "💰",
    title: "财务报销流程",
    description: "把发票校验、审批流转、打款归档和异常处理口径理清楚。",
    type: "workflow" as const,
    steps: 5,
    time: "约 10 分钟",
    prompt: "我想自动化财务报销流程，员工提交报销申请后，系统自动校验发票和金额，然后按审批规则流转给对应审批人，审批通过后自动发起打款，最后归档记录",
  },
  {
    icon: "📋",
    title: "App 改版项目管理",
    description: "把任务分工、进度跟进、风险提醒和上线确认边界说清楚。",
    type: "agentic" as const,
    steps: 4,
    time: "约 10 分钟",
    prompt: "我们要做 App 2.0 改版，涉及3个前端+2个后端+1个设计师+1个测试，总周期35天。希望系统帮我管项目：跟进每个人的任务进度（从飞书项目拉数据），每天早上给我站会摘要，识别延期风险并提醒，每周五出周报。需求变更和上线需要我审批。",
  },
  {
    icon: "🎧",
    title: "智能客服系统",
    description: "把重复问题、质检要求、转人工标准和客服兜底方式整理出来。",
    type: "agentic" as const,
    steps: 4,
    time: "约 12 分钟",
    prompt: "我们客服部每天处理约500个咨询，其中60%是重复性问题（退换货政策、物流查询、账号问题）。希望系统先处理这些简单FAQ，再逐步扩展到复杂投诉。人工客服目前8人，希望3个月后能减少到4人。回复前需要经过质检，投诉类必须转人工。",
  },
  {
    icon: "🛍️",
    title: "跨境电商售后处理",
    description: "把材料补齐、状态查询、退款退货规则和升级边界讲清楚。",
    type: "agentic" as const,
    steps: 4,
    time: "约 12 分钟",
    prompt: "我们做跨境电商，售后团队每天大概处理1200条咨询，主要是退款、退货、物流延误、商品破损和支付失败。现在客服会先看客户使用的语言，再确认客户的问题类型。如果客户没有提供订单号，会让客户补充订单号、邮箱或付款截图；商品破损还需要客户提供照片。拿到信息后，客服会去订单系统、物流系统和支付系统里查状态。我们的规则是：50美元以内、符合售后政策的小额退款，普通客服可以直接处理；超过50美元、高风险退款、疑似欺诈、客户投诉升级、政策外补偿，都需要转给主管或专门客服处理。物流延误类问题会先查承运商状态，如果确实超过预计送达时间，再根据国家和物流渠道判断是否给优惠券、补发或退款。现在多语言沟通、查订单和判断规则占用大量客服时间，我们希望平均解决时间从10分钟降到2分钟，重复咨询率降低20%，但不能降低客户满意度。",
  },
  {
    icon: "👥",
    title: "校招批量招聘",
    description: "把简历筛选、面试协调、评价汇总和 Offer 审批口径理清楚。",
    type: "agentic" as const,
    steps: 4,
    time: "约 10 分钟",
    prompt: "秋招要招50个应届生（20个开发、15个产品、10个运营、5个设计），简历预计收到3000+份。希望系统帮忙：发布JD到各平台，按条件初筛简历，安排面试时间（协调面试官日历），面试后汇总评价生成排名，Offer审批后发送。简历筛选标准和Offer薪资需要我确认。",
  },
  {
    icon: "📊",
    title: "竞品分析报告",
    description: "把竞品范围、分析维度、数据来源和报告确认标准固定下来。",
    type: "agentic" as const,
    steps: 4,
    time: "约 8 分钟",
    prompt: "我们产品部需要定期做竞品分析。目标竞品是：飞书、钉钉、企业微信、Slack、Teams。分析维度固定为：产品功能更新、定价变化、用户评价趋势、市场份额变化。每周一出一份报告，格式要统一（摘要+各维度详情+结论建议）。数据来源限定为官网、应用商店评价、36氪/虎嗅等科技媒体。报告终稿需要我确认后才能发给团队。",
  },
  {
    icon: "🌐",
    title: "TikTok 内容矩阵运营",
    description: "把选题脚本、表现反馈、策略调整和模板沉淀方式讲清楚。",
    type: "agentic" as const,
    steps: 4,
    time: "约 15 分钟",
    prompt: "我们海外增长部要做 TikTok 内容矩阵运营，先运营 60 个账号，后续扩到 200 个。账号覆盖好物推荐、开箱测评、使用教程、场景种草四类内容。我们希望每天根据账号定位生成选题、脚本、标题、标签和发布时间建议；发布后持续看播放、完播、互动、涨粉、评论反馈和平台风险，判断哪些内容方向值得加大，哪些账号要降频或换方向。大方向调整、预算加投、内容方向新增需要运营负责人确认。目标是 8 周内筛出 10 个高潜账号，沉淀 20 个可复用内容模板，并把选题和复盘效率提升起来。",
  },
  {
    icon: "📦",
    title: "进出口报关",
    description: "把单据审核、编码归类、申报放行和客户通知节点标清楚。",
    type: "workflow" as const,
    steps: 6,
    time: "约 12 分钟",
    prompt: "我想自动化进出口报关流程，收到委托后先审核报关单据的完整性，然后根据商品描述进行海关编码归类，计算关税，填制报关单，提交海关申报，等待审核放行后通知客户",
  },
];

const FEATURES = [
  { icon: Zap, label: "AI 自动拆解工作步骤", color: "text-amber-500" },
  { icon: BarChart3, label: "清晰标注人机分工", color: "text-blue-500" },
  { icon: PenTool, label: "拖拽修改随时调整", color: "text-green-500" },
  { icon: ShieldCheck, label: "团队协作在线评审", color: "text-violet-500" },
];

type UploadCategoryId = NonNullable<ChatAttachment["jobMaterialCategory"]>;

const UPLOAD_CATEGORIES: Array<{
  id: UploadCategoryId;
  title: string;
  hint: string;
  examples: string;
  icon: typeof Workflow;
  className: string;
}> = [
  {
    id: "workflow_plan",
    title: "流程方案",
    hint: "这件事怎么一步步做",
    examples: "SOP、流程图、操作手册",
    icon: GitBranch,
    className: "hover:border-blue-200 hover:bg-blue-50/70 hover:text-blue-700",
  },
  {
    id: "business_rule_knowhow",
    title: "业务规则和 Know-how",
    hint: "判断标准和经验口径",
    examples: "校验规则、审批口径、注意事项",
    icon: ShieldCheck,
    className: "hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-emerald-700",
  },
  {
    id: "file_template",
    title: "文件模板",
    hint: "要填写或提交的文件",
    examples: "Excel 模板、申请表、样例文件",
    icon: FileText,
    className: "hover:border-violet-200 hover:bg-violet-50/70 hover:text-violet-700",
  },
];

const CATEGORY_LABEL: Record<UploadCategoryId, string> = {
  workflow_plan: "流程方案",
  business_rule_knowhow: "业务规则",
  file_template: "文件模板",
  uncategorized: "待识别",
};

export default function HomePage() {
  const [input, setInput] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCategoryRef = useRef<UploadCategoryId>("uncategorized");
  const router = useRouter();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const newAttachments: ChatAttachment[] = [];
    const category = uploadCategoryRef.current;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const result = await res.json();
        if (result.success) {
          newAttachments.push({ ...result.file, jobMaterialCategory: category });
        } else {
          toast.error(`上传失败：${file.name}`, { description: result.error });
        }
      } catch {
        toast.error(`上传失败：${file.name}`);
      }
    }
    setUploadedFiles((prev) => [...prev, ...newAttachments]);
    setUploading(false);
    uploadCategoryRef.current = "uncategorized";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const openFilePicker = useCallback((category: UploadCategoryId) => {
    uploadCategoryRef.current = category;
    fileInputRef.current?.click();
  }, []);

  const handleStart = (prompt?: string) => {
    const q = prompt || input;
    if (!q.trim() && uploadedFiles.length === 0) return;
    const runId = Date.now().toString();
    if (uploadedFiles.length > 0) {
      useFlowAgentStore.getState().setInitFiles(uploadedFiles);
      useFlowAgentStore.getState().setJobMaterials(uploadedFiles);
      try {
        sessionStorage.setItem(`flow-agent-job-materials:${runId}`, JSON.stringify(uploadedFiles));
      } catch {
        // Ignore storage failures; the in-memory store still carries the first navigation.
      }
    }
    router.push(`/editor?q=${encodeURIComponent(q.trim())}&t=${runId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 flex flex-col">
      {/* Nav */}
      <header className="h-14 border-b border-zinc-200/60 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Workflow className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-zinc-900">FlowAgent</span>
          <span className="ml-1.5 text-xs text-zinc-400 hidden sm:inline font-normal">工作流程 AI 助手</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/me"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm"
          >
            我的项目
          </Link>
          <Link
            href="/tech"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            技术方入口
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-4 pt-12 pb-16">
        <div className="text-center mb-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 text-amber-700 text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            用 AI 把工作流程理清楚
          </div>
          <h1 className="text-4xl font-extrabold text-zinc-900 mb-4 leading-tight tracking-tight">
            说说你的工作
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              AI 帮你理清流程、找出能自动化的部分
            </span>
          </h1>
          <p className="text-base text-zinc-500 leading-relaxed">
            把你每天在做的事情描述给 AI，它会帮你拆解成清晰的步骤，标出哪些可以让 AI 自动做、哪些需要你来把关。
            <br className="hidden sm:block" />
            整理好之后，你的团队可以直接拿这份方案去搭建自动化系统。
          </p>
        </div>

        {/* Input */}
        <div className="w-full max-w-2xl">
          {showQuiz ? (
            <QuizPromptBuilder
              onComplete={(prompt) => {
                setInput(prompt);
                setShowQuiz(false);
                handleStart(prompt);
              }}
              onCancel={() => setShowQuiz(false)}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-lg shadow-zinc-200/50 p-5">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.ppt,.pptx,.xlsx,.xls,.docx,.txt,.csv,.md,.json,.png,.jpg,.jpeg"
                multiple
                onChange={handleFileSelect}
              />
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.storedName}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700"
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[160px]">{f.originalName}</span>
                      <span className="shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[10px] text-blue-500">
                        {CATEGORY_LABEL[f.jobMaterialCategory ?? "uncategorized"]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadedFiles((prev) => prev.filter((x) => x.storedName !== f.storedName))}
                        className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mb-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-zinc-700">可选：上传这个业务方案的相关材料</p>
                  <button
                    type="button"
                    onClick={() => openFilePicker("uncategorized")}
                    disabled={uploading}
                    className="text-[11px] text-zinc-400 hover:text-blue-600 disabled:opacity-50"
                  >
                    不确定分类，直接上传
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {UPLOAD_CATEGORIES.map((category) => {
                    const CategoryIcon = category.icon;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => openFilePicker(category.id)}
                        disabled={uploading}
                        className={`rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-zinc-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${category.className}`}
                      >
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <CategoryIcon className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold text-zinc-800">{category.title}</span>
                        </div>
                        <p className="text-[11px] leading-4 text-zinc-500">{category.hint}</p>
                        <p className="mt-1 text-[10px] leading-4 text-zinc-400">{category.examples}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && (input.trim() || uploadedFiles.length > 0)) { e.preventDefault(); handleStart(); } }}
                placeholder="例如：我每天要处理几十张报销单，先核对发票，再找领导签字，最后录入系统，很费时间……"
                className="border-0 shadow-none focus-visible:ring-0 text-sm min-h-[80px] resize-none p-0"
              />
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-zinc-100">
                <p className="w-full text-[11px] text-zinc-400 mb-1">💡 说清楚这几点，AI 梳理得更准：</p>
                {[
                  { label: "⏰ 每天最花时间的事是什么？", hint: "我每天花大量时间在" },
                  { label: "🔁 这件事大概怎么做的？", hint: "目前的做法是先" },
                  { label: "😫 最让你头疼的环节是？", hint: "最麻烦的地方是" },
                  { label: "🤝 谁需要参与进来？", hint: "这件事需要" },
                ].map((tag) => (
                  <button
                    key={tag.label}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!input.trim()) {
                        setInput(tag.hint);
                      } else if (!input.endsWith("，") && !input.endsWith("。") && !input.endsWith(" ")) {
                        setInput(input + "，" + tag.hint);
                      } else {
                        setInput(input + tag.hint);
                      }
                    }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openFilePicker("uncategorized")}
                    disabled={uploading}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title="不确定分类时直接上传"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                    直接上传
                  </button>
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-blue-600 transition-colors"
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    不知道怎么写？回答几个问题
                  </button>
                </div>
                <Button
                  onClick={() => handleStart()}
                  disabled={!input.trim() && uploadedFiles.length === 0}
                  className="bg-zinc-900 hover:bg-zinc-800 px-5"
                >
                  帮我梳理 <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Examples */}
        <div className="w-full max-w-2xl mt-10">
          <p className="text-xs text-zinc-400 mb-3 text-center tracking-wide uppercase">业务描述示例</p>
          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white divide-y divide-zinc-100">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                onClick={() => handleStart(ex.prompt)}
                className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
              >
                <span className="mt-0.5 w-7 shrink-0 text-center text-lg">{ex.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{ex.title}</h3>
                    <span className="text-[11px] text-zinc-400">{ex.time}生成草案</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{ex.description}</p>
                </div>
                <span className="mt-1 flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                  填入 <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Pre-built demo schemes — compact list */}
        <div className="w-full max-w-2xl mt-8">
          <p className="text-xs text-zinc-400 mb-3 text-center tracking-wide uppercase">先看看效果长什么样</p>
          <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100 overflow-hidden">
            {[
              { href: "/editor?demoId=review-3", icon: "💰", label: "财务报销审批", meta: "发票校验、审批流转、打款归档", color: "text-blue-500" },
              { href: "/editor?demoId=review-1", icon: "📱", label: "小红书账号运营", meta: "内容策略、发布节奏、数据复盘", color: "text-violet-500" },
              { href: "/editor?demoId=review-5", icon: "📋", label: "App 改版项目管理", meta: "任务跟进、风险提醒、上线确认", color: "text-violet-500" },
              { href: "/editor?demoId=review-6", icon: "🎧", label: "智能客服系统", meta: "FAQ处理、质检规则、人工转接", color: "text-violet-500" },
              { href: "/editor?demoId=review-10", icon: "🌐", label: "TikTok 内容矩阵运营", meta: "选题脚本、表现反馈、模板沉淀", color: "text-violet-500" },
              { href: "/editor?demoId=review-9", icon: "🛍️", label: "跨境电商售后处理", meta: "材料补齐、状态查询、处理策略", color: "text-violet-500" },
              { href: "/editor?demoId=review-7", icon: "👥", label: "校招批量招聘", meta: "简历筛选、面试协调、Offer跟进", color: "text-violet-500" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors group"
              >
                <span className="text-lg w-7 text-center shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-800">{item.label}</span>
                  <span className="text-[11px] text-zinc-400 ml-2">{item.meta}</span>
                </div>
                <ArrowUpRight className={`w-3.5 h-3.5 ${item.color} opacity-0 group-hover:opacity-100 transition-opacity shrink-0`} />
              </Link>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="w-full max-w-2xl mt-8">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-zinc-100">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${f.color}`} />
                  <span className="text-xs text-zinc-600 leading-tight">{f.label}</span>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
