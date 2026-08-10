import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { checkAdminAuth } from "@/lib/admin-auth";

/**
 * STEP12 관리자 대시보드용 신청 목록.
 * applications + health_reports(점수/등급) + logs(단계별 소요시간)를 조합해 반환한다.
 * ?sort=recent_errors 를 주면 오류 건이 먼저 오도록 정렬한다.
 */
export async function GET(req: NextRequest) {
  const authFailure = checkAdminAuth(req, req.nextUrl.searchParams.get("key"));
  if (authFailure === "rate_limited") {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, { status: 429 });
  }
  if (authFailure) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const sort = req.nextUrl.searchParams.get("sort");

  const { data: applications, error } = await db
    .from("applications")
    .select("id, created_at, company_name, ceo_name, status, error_message, retry_count")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!applications || applications.length === 0) {
    return NextResponse.json({ applications: [] });
  }

  const ids = applications.map((a) => a.id);

  // 서로 독립적인 두 조회는 병렬로 실행 (성능 최적화)
  const [{ data: reports }, { data: logs }] = await Promise.all([
    db
      .from("health_reports")
      .select("application_id, health_score, risk_grade")
      .in("application_id", ids),
    db
      .from("logs")
      .select("application_id, step, status, duration_ms")
      .in("application_id", ids)
      .eq("status", "success"),
  ]);

  const reportByApp = new Map(reports?.map((r) => [r.application_id, r]));

  // 단계별 소요시간(ms) — 같은 step이 여러 번 기록됐다면 마지막 값을 사용
  const timingByApp = new Map<string, Record<string, number>>();
  for (const log of logs ?? []) {
    if (log.duration_ms == null) continue;
    const current = timingByApp.get(log.application_id) ?? {};
    current[log.step] = log.duration_ms;
    timingByApp.set(log.application_id, current);
  }

  let enriched = applications.map((app) => {
    const report = reportByApp.get(app.id);
    const timing = timingByApp.get(app.id) ?? {};
    return {
      ...app,
      health_score: report?.health_score ?? null,
      risk_grade: report?.risk_grade ?? null,
      cretop_duration_ms: timing["cretop"] ?? null,
      ai_duration_ms: timing["ai_analysis"] ?? null,
      report_duration_ms: (timing["report"] ?? 0) + (timing["report_pdf"] ?? 0) || null,
    };
  });

  if (sort === "recent_errors") {
    enriched = [...enriched].sort((a, b) => {
      if (a.status === "error" && b.status !== "error") return -1;
      if (a.status !== "error" && b.status === "error") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  return NextResponse.json({ applications: enriched });
}
