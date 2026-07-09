import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "flow-agent-http-adapters",
    artifact_access_configured: Boolean(process.env.TASK_PLATFORM_TOKEN || process.env.TASK_PLATFORM_API_TOKEN),
    adapters: [
      "retail-ad-review-standardizer",
      "retail-ad-review-diagnosis",
      "retail-ad-review-report-renderer",
    ],
  });
}
