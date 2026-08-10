import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase";
import { runHealthCheckPipeline } from "@/lib/agent";
import { PROGRESS_PERCENT } from "@/lib/pipeline-status";
import { checkAdminAuth } from "@/lib/admin-auth";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validate";
import type { ApplicationStatus } from "@/types";

// 재시도용 수동 트리거 — 관리자 페이지 "재실행" 버튼 전용이므로 관리자 키를 요구한다.
// (인증 없이 열려 있으면 누구나 임의의 applicationId로 파이프라인을 재실행시켜
//  OpenAI 비용을 소모시킬 수 있는 보안 구멍이 되므로 반드시 막아야 한다.)
//
// 전체 파이프라인(공개자료 수집 + AI 분석, 재시도 포함)은 수 분이 걸릴 수 있어 Vercel Functions의
// 응답 타임아웃을 넘길 위험이 있다. 그래서 이 라우트는 즉시 응답하고 실행은 waitUntil로 백그라운드에서
// 계속한다 — 관리자 페이지는 이미 10초 간격으로 목록을 다시 불러오므로 자연스럽게 진행상황이 보인다.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { applicationId, key } = body;

  const authFailure = checkAdminAuth(req, key ?? null);
  if (authFailure === "rate_limited") {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }
  if (authFailure) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(applicationId)) {
    return NextResponse.json({ error: "applicationId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  waitUntil(
    runHealthCheckPipeline(applicationId).catch((e) =>
      console.error("[agent/run] 재실행 실패:", e instanceof Error ? e.message : e)
    )
  );

  return NextResponse.json({ status: "restarted" });
}

// 결과 화면(app/result/[id])에서 진행상태 폴링 — 새로고침해도 이 API로 현재 상태를 그대로 이어받는다.
// 공개 라우트(신청자 본인이 접근)이므로 IP당 분당 40회로 남용을 제한한다 (3초 간격 폴링 기준 충분).
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`result-poll:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }

  const id = req.nextUrl.searchParams.get("applicationId");
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "applicationId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: app } = await db
    .from("applications")
    .select("status, error_message")
    .eq("id", id)
    .single();

  // 보안(v10 점검): health_reports.cretop_raw / public_data_summary / analysis(잠긴 detail 포함) /
  // score_breakdown 은 공개 결과 화면에 필요 없는 내부 데이터다. applicationId만 알면 누구나
  // 이 API를 호출할 수 있으므로, select("*")로 전체 컬럼을 내려주지 않고 화면에 실제로
  // 필요한 요약 컬럼만 명시적으로 골라서 반환한다.
  const { data: report } = await db
    .from("health_reports")
    .select("health_score, risk_grade, star_ratings, findings")
    .eq("application_id", id)
    .maybeSingle();

  const status = (app?.status ?? "received") as ApplicationStatus;

  return NextResponse.json({
    application: app,
    report,
    progressPercent: PROGRESS_PERCENT[status] ?? 0,
  });
}
