import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`deep-status-poll:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }

  const applicationId = req.nextUrl.searchParams.get("applicationId");
  if (!isValidUuid(applicationId)) {
    return NextResponse.json({ error: "applicationId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data } = await db
    .from("deep_reports")
    .select("status, pdf_url, error_message")
    .eq("application_id", applicationId)
    .maybeSingle();

  return NextResponse.json({ deepReport: data ?? null });
}
