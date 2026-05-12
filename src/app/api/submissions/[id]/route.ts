import { NextResponse } from "next/server";
import type { PersistedSubmission } from "@/lib/submission-types";
import {
  createReviewLog,
  createTimelineEvent,
  getSubmissionById,
  updateSubmission,
} from "@/lib/server/submission-store";

export const runtime = "nodejs";

type PatchBody = {
  status?: PersistedSubmission["status"];
  techProgress?: PersistedSubmission["techProgress"];
  title?: string;
  description?: string;
  nodes?: PersistedSubmission["nodes"];
  edges?: PersistedSubmission["edges"];
  timelineEvent?: Omit<PersistedSubmission["timeline"][number], "id" | "at">;
  reviewLog?: Omit<PersistedSubmission["reviewLogs"][number], "id" | "at">;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const item = await getSubmissionById(id);
    if (!item) {
      return NextResponse.json({ success: false, error: "未找到提交记录" }, { status: 404 });
    }
    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取提交记录失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    const current = await getSubmissionById(id);
    if (!current) {
      return NextResponse.json({ success: false, error: "未找到提交记录" }, { status: 404 });
    }

    const timeline = [...current.timeline];
    const reviewLogs = [...current.reviewLogs];

    if (body.timelineEvent) {
      timeline.unshift(createTimelineEvent(body.timelineEvent));
    }
    if (body.reviewLog) {
      reviewLogs.unshift(createReviewLog(body.reviewLog));
    }

    const updated = await updateSubmission(id, {
      ...(body.status ? { status: body.status } : {}),
      ...(body.techProgress ? { techProgress: body.techProgress } : {}),
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(Array.isArray(body.nodes) ? { nodes: body.nodes } : {}),
      ...(Array.isArray(body.edges) ? { edges: body.edges } : {}),
      timeline,
      reviewLogs,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新提交记录失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
