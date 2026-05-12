import { NextResponse } from "next/server";
import type { PersistedSubmission, SubmissionTechProgress } from "@/lib/submission-types";
import {
  createSubmission,
  createTimelineEvent,
  listSubmissions,
  updateSubmission,
} from "@/lib/server/submission-store";

export const runtime = "nodejs";

function asReviewStatus(
  status: PersistedSubmission["status"]
): "pending" | "reviewed" | "confirmed" {
  if (status === "confirmed") return "confirmed";
  if (status === "needs_revision") return "reviewed";
  if (status === "tech_reviewing") return "reviewed";
  return "pending";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    const items = await listSubmissions();

    if (view === "reviews") {
      const reviews = items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.taskType,
        submittedBy: item.submittedBy,
        submittedAt: item.submittedAt,
        status: asReviewStatus(item.status),
        description: item.description,
        nodeCount: item.nodeCount,
        prompt: item.prompt,
        projectName: item.projectName,
        nodes: item.nodes,
        edges: item.edges,
        agenticConfig: item.agenticConfig,
        chatMessages: item.chatMessages,
      }));
      return NextResponse.json({ success: true, items: reviews });
    }

    return NextResponse.json({ success: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取提交记录失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();

    const progress: SubmissionTechProgress = body.techProgress ?? {
      total: 5,
      done: 0,
      status: "running",
    };

    const submission = await createSubmission({
      reviewId: "",
      title: body.title ?? "未命名方案",
      description: body.description ?? "",
      taskType: body.taskType === "agentic" ? "agentic" : "workflow",
      status: body.status ?? "ai_generating",
      submittedBy: body.submittedBy ?? "业务方 · 当前用户",
      submittedAt: now,
      updatedAt: now,
      prompt: body.prompt ?? "",
      projectName: body.projectName ?? body.title ?? "未命名方案",
      nodeCount: body.nodeCount ?? 0,
      techProgress: progress,
      nodes: body.nodes ?? undefined,
      edges: body.edges ?? undefined,
      agenticConfig: body.agenticConfig ?? undefined,
      chatMessages: body.chatMessages ?? [],
      timeline: [
        createTimelineEvent({
          actor: "business",
          type: "submitted",
          message: "业务方提交方案，开始生成技术方案",
        }),
      ],
      reviewLogs: [],
    });

    const updated = {
      ...submission,
      reviewId: submission.id,
    };

    // write back reviewId for unified lookup
    await updateSubmission(submission.id, { reviewId: submission.id });

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建提交记录失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
