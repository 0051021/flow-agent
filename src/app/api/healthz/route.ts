import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "flow-agent-http-adapters",
    adapters: [
      "retail-ad-review-standardizer",
      "retail-ad-review-diagnosis",
      "retail-ad-review-report-renderer",
    ],
  });
}
