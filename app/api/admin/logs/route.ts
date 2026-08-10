import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authFailure = checkAdminAuth(req, req.nextUrl.searchParams.get("key"));
  if (authFailure === "rate_limited") {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, { status: 429 });
  }
  if (authFailure) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const applicationId = req.nextUrl.searchParams.get("applicationId");
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId 필요" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("logs")
    .select("step, status, message, token_usage, duration_ms, cost_usd, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
