import { NextRequest, NextResponse } from "next/server";
import { adapterErrorPayload, runDiagnosis } from "@/lib/retail-ad-review-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "retail-ad-review-diagnosis",
    method: "POST",
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await runDiagnosis(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(adapterErrorPayload(error), { status: 500 });
  }
}
