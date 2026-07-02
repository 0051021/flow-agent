import { NextRequest, NextResponse } from "next/server";
import { adapterErrorPayload, runStandardizer } from "@/lib/retail-ad-review-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "retail-ad-review-standardizer",
    method: "POST",
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await runStandardizer(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(adapterErrorPayload(error), { status: 500 });
  }
}
