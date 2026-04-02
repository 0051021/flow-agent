"use client";

import { useFlowAgentStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, MessageSquare,
  CheckCircle2, Send, Workflow,
  Briefcase, Code2, ArrowLeftRight, AlertTriangle,
} from "lucide-react";
import type { ProjectStatus, UserRole } from "@/lib/types";

const STATUS_LABELS: Record<ProjectStatus, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-zinc-100 text-zinc-600" },
  business_editing: { label: "业务方编辑中", className: "bg-blue-50 text-blue-700" },
  pending_review: { label: "待技术评审", className: "bg-amber-50 text-amber-700" },
  tech_reviewing: { label: "技术评审中", className: "bg-purple-50 text-purple-700" },
  needs_revision: { label: "需修改", className: "bg-red-50 text-red-700" },
  confirmed: { label: "双方确认", className: "bg-green-50 text-green-700" },
};

const ROLE_CONFIG: Record<UserRole, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; borderColor: string }> = {
  business: {
    label: "业务方",
    icon: Briefcase,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  tech: {
    label: "技术方",
    icon: Code2,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
};

export default function TopBar() {
  const {
    project, currentRole, setCurrentRole,
    annotations,
    showAnnotationPanel, setShowAnnotationPanel,
    showKnowledgePanel, setShowKnowledgePanel,
    setProjectStatus, setViewMode, nodes,
  } = useFlowAgentStore();

  const statusConfig = STATUS_LABELS[project.status];
  const roleConfig = ROLE_CONFIG[currentRole];
  const RoleIcon = roleConfig.icon;
  const unresolvedAnnotations = annotations.filter((a) => a.status !== "resolved").length;
  const isTech = currentRole === "tech";
  const hasFlow = nodes.length > 0;

  const handleRoleSwitch = () => {
    const newRole: UserRole = currentRole === "business" ? "tech" : "business";
    setCurrentRole(newRole);
    setViewMode(newRole === "tech" ? "tech" : "business");
  };

  const handleSubmitReview = () => {
    if (project.status === "business_editing" || project.status === "draft") {
      setProjectStatus("tech_reviewing");
      setCurrentRole("tech");
    }
  };

  const handleApprove = () => {
    setProjectStatus("confirmed");
  };

  const handleReject = () => {
    setProjectStatus("needs_revision");
    setCurrentRole("business");
  };

  const handleResubmit = () => {
    setProjectStatus("tech_reviewing");
    setCurrentRole("tech");
  };

  const headerBg = isTech ? "bg-slate-900" : "bg-white";
  const headerBorder = isTech ? "border-slate-700" : "border-zinc-200";
  const titleColor = isTech ? "text-white" : "text-zinc-900";
  const subtitleColor = isTech ? "text-slate-400" : "text-zinc-600";

  return (
    <header className={`h-14 border-b ${headerBorder} ${headerBg} flex items-center justify-between px-4 shrink-0 transition-colors duration-300`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Workflow className={`w-5 h-5 ${titleColor}`} />
          <span className={`font-semibold text-sm ${titleColor}`}>FlowAgent</span>
        </div>
        {project.name && (
          <>
            <span className={isTech ? "text-slate-600" : "text-zinc-300"}>/</span>
            <span className={`text-sm ${subtitleColor}`}>{project.name}</span>
          </>
        )}
        <Badge className={`text-[10px] h-5 ${statusConfig.className} border-0`}>
          {statusConfig.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {/* Role switcher */}
        <button
          onClick={handleRoleSwitch}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all ${roleConfig.bgColor} ${roleConfig.borderColor}`}
        >
          <RoleIcon className={`w-3.5 h-3.5 ${roleConfig.color}`} />
          <span className={`text-xs font-semibold ${roleConfig.color}`}>{roleConfig.label}</span>
          <ArrowLeftRight className={`w-3 h-3 ${roleConfig.color} opacity-50`} />
        </button>

        <div className={`w-px h-6 ${isTech ? "bg-slate-700" : "bg-zinc-200"} mx-1`} />

        {/* Panels toggle */}
        <Button
          size="sm"
          variant={showKnowledgePanel ? "default" : "outline"}
          className={`h-8 text-xs ${isTech && !showKnowledgePanel ? "border-slate-600 text-slate-300 hover:bg-slate-800" : ""}`}
          onClick={() => setShowKnowledgePanel(!showKnowledgePanel)}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1" /> 知识中心
        </Button>
        <Button
          size="sm"
          variant={showAnnotationPanel ? "default" : "outline"}
          className={`h-8 text-xs relative ${isTech && !showAnnotationPanel ? "border-slate-600 text-slate-300 hover:bg-slate-800" : ""}`}
          onClick={() => setShowAnnotationPanel(!showAnnotationPanel)}
        >
          <MessageSquare className="w-3.5 h-3.5 mr-1" /> 批注
          {unresolvedAnnotations > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {unresolvedAnnotations}
            </span>
          )}
        </Button>

        <div className={`w-px h-6 ${isTech ? "bg-slate-700" : "bg-zinc-200"} mx-1`} />

        {/* Context-aware actions */}
        {currentRole === "business" && hasFlow && (project.status === "business_editing" || project.status === "draft") && (
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSubmitReview}>
            <Send className="w-3.5 h-3.5 mr-1" /> 提交技术评审
          </Button>
        )}

        {currentRole === "business" && project.status === "needs_revision" && (
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleResubmit}>
            <Send className="w-3.5 h-3.5 mr-1" /> 重新提交评审
          </Button>
        )}

        {currentRole === "tech" && project.status === "tech_reviewing" && (
          <>
            <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={handleReject}>
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> 打回修改
            </Button>
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleApprove}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 评审通过
            </Button>
          </>
        )}

        {project.status === "confirmed" && (
          <Badge className="text-xs h-7 bg-green-100 text-green-700 border-0 px-3">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 双方已确认
          </Badge>
        )}
      </div>
    </header>
  );
}
