import { createServiceClient } from "@/lib/supabase";
import { resolveBizRegNo } from "@/lib/business-lookup";
import { getCretopData } from "@/lib/cretop";
import { collectPublicData } from "@/lib/public-data";
import {
  runAiAnalysis,
  computeHealthScore,
  buildStarRatings,
  buildPublicFindings,
} from "@/lib/health-score";
import { withStepLog, logStep } from "@/lib/logger";
import { assertRequiredEnv } from "@/lib/env-check";
import { notify } from "@/lib/notifications";
import type { Application, CretopData, RiskGrade } from "@/types";

const isSessionAutomationMode =
  !process.env.CRETOP_API_KEY &&
  !!process.env.CRETOP_ID &&
  !!process.env.CRETOP_PASSWORD;

// 재실행(관리자 "재실행" 버튼) 허용 상태 — 이 상태에서만 파이프라인을 다시 시작할 수 있다.
const RESTARTABLE_STATUSES = ["received", "error"] as const;

/**
 * STEP2~8 파이프라인 진입점.
 *
 * Idempotency: 동일 applicationId에 대해 이미 처리 중(analyzing/awaiting_cretop/ai_analysis)이거나
 * 완료(completed)된 건에 대해 이 함수가 다시 호출되면(중복 웹훅, 중복 클릭 등) 실제 작업을
 * 다시 시작하지 않고 현재 상태를 그대로 반환한다. 이는 "status가 RESTARTABLE일 때만
 * status를 analyzing으로 바꾸는" 조건부 UPDATE로 원자적으로 보장한다 — 두 요청이 동시에
 * 들어와도 UPDATE ... WHERE status IN (...) 는 DB 레벨에서 하나만 성공한다.
 *
 * 상태 전이: received → analyzing → awaiting_cretop → ai_analysis → completed
 * (Result 페이지의 6단계 Progress UI 및 퍼센트 매핑은 lib/pipeline-status.ts 참고)
 */
export async function runHealthCheckPipeline(applicationId: string) {
  assertRequiredEnv();
  const db = createServiceClient();

  // 원자적 상태 선점 — 이미 처리 중이면 아무 것도 하지 않고 현재 상태를 반환
  const { data: claimed, error: claimError } = await db
    .from("applications")
    .update({ status: "analyzing" })
    .eq("id", applicationId)
    .in("status", RESTARTABLE_STATUSES)
    .select()
    .maybeSingle();

  if (claimError) throw new Error(`상태 선점 실패: ${claimError.message}`);

  if (!claimed) {
    // 이미 analyzing/awaiting_cretop/ai_analysis/completed 상태 — 중복 실행 방지
    const { data: current } = await db
      .from("applications")
      .select("status")
      .eq("id", applicationId)
      .single();
    return { status: current?.status ?? "unknown", skipped: true as const };
  }

  const app = claimed as Application & { company_name: string; ceo_name: string };

  try {
    // STEP2: 사업자번호 확보 → STEP3~4: 크레탑 조회
    // (bizRegNo가 있으면 크레탑 검색 정확도가 올라가므로 의도적으로 순차 처리한다.
    //  두 작업을 병렬화하면 크레탑 조회가 사업자번호 없이 회사명만으로 진행되어
    //  검색 정확도가 떨어질 수 있어 — 안정성을 속도보다 우선했다.)
    if (isSessionAutomationMode) {
      // 세션 자동화 모드: 헤드리스 브라우저가 필요하므로 사업자번호부터 확보한 뒤 워커에게 넘긴다
      await resolveBizNoIfNeeded(app);
      await db
        .from("applications")
        .update({ status: "awaiting_cretop" })
        .eq("id", applicationId);
      return { status: "awaiting_cretop" as const };
    }

    const bizRegNo = await resolveBizNoIfNeeded(app);
    await db.from("applications").update({ status: "awaiting_cretop" }).eq("id", applicationId);
    const cretop = await withStepLog(applicationId, "cretop", () =>
      getCretopData(applicationId, app.company_name, bizRegNo ?? undefined)
    );
    return finishFromCretop(applicationId, app.company_name, app.ceo_name, cretop);
  } catch (err) {
    return handlePipelineError(applicationId, err);
  }
}

async function resolveBizNoIfNeeded(app: { id: string; biz_reg_no?: string | null; company_name: string; ceo_name: string }) {
  if (app.biz_reg_no) return app.biz_reg_no;

  const db = createServiceClient();
  const bizRegNo = await withStepLog(app.id, "biz_lookup", () =>
    resolveBizRegNo(app.company_name, app.ceo_name)
  );
  if (bizRegNo) {
    await db.from("applications").update({ biz_reg_no: bizRegNo }).eq("id", app.id);
  }
  return bizRegNo;
}

/**
 * cretop-worker.ts가 cretop_cache를 채운 뒤 호출.
 * STEP5~8을 이어서 실행한다.
 *
 * Idempotency: 워커의 continue 호출이 네트워크 재시도 등으로 중복 도착해도,
 * finishFromCretop 내부에서 health_reports가 이미 있으면 재작업 없이 즉시 반환한다.
 */
export async function continuePipelineAfterCretop(applicationId: string) {
  assertRequiredEnv();
  const db = createServiceClient();
  try {
    const { data: app, error } = await db
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .single();
    if (error || !app) throw new Error("신청 정보를 찾을 수 없습니다.");
    if (!app.cretop_cache) throw new Error("cretop_cache가 비어있습니다.");

    return finishFromCretop(applicationId, app.company_name, app.ceo_name, app.cretop_cache as CretopData);
  } catch (err) {
    return handlePipelineError(applicationId, err);
  }
}

async function finishFromCretop(
  applicationId: string,
  companyName: string,
  ceoName: string,
  cretop: CretopData
) {
  const db = createServiceClient();

  // Idempotency: 이미 완료된 건이면 재작업하지 않고 기존 결과를 그대로 반환
  const { data: existing } = await db
    .from("health_reports")
    .select("health_score, risk_grade")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (existing) {
    return { healthScore: existing.health_score, riskGrade: existing.risk_grade as RiskGrade, skipped: true as const };
  }

  await db.from("applications").update({ status: "ai_analysis" }).eq("id", applicationId);

  // STEP5: 공개자료 수집
  const publicData = await withStepLog(applicationId, "public_data", () =>
    collectPublicData(companyName)
  );

  // STEP6: 업종별 AI 분석 (14개 항목) — 30일 캐시 + 타임아웃/재시도/Circuit Breaker 적용
  const { analysis } = await runAiAnalysis(companyName, cretop, publicData.summary, applicationId);

  // STEP7: 재무비율 기반 결정론적 건강점수 (AI 주관 점수가 아님)
  const { healthScore, breakdown, riskGrade } = computeHealthScore(cretop);
  const starRatings = buildStarRatings(analysis, healthScore);

  // STEP8: 공개 노출용 findings
  const findings = buildPublicFindings(analysis);

  // DB Transaction: health_reports 저장 + applications 상태 완료 처리 + report 로그를
  // 하나의 Postgres 함수(fn_save_health_report) 안에서 원자적으로 처리 (supabase/schema.sql 참고)
  const start = Date.now();
  const { error: txError } = await db.rpc("fn_save_health_report", {
    p_application_id: applicationId,
    p_cretop_raw: cretop,
    p_public_data_summary: publicData,
    p_analysis: analysis,
    p_health_score: healthScore,
    p_score_breakdown: breakdown,
    p_risk_grade: riskGrade,
    p_star_ratings: starRatings,
    p_findings: findings,
  });

  if (txError) {
    await logStep({
      application_id: applicationId,
      step: "report",
      status: "error",
      message: `트랜잭션 저장 실패: ${txError.message}`,
      duration_ms: Date.now() - start,
    });
    throw new Error(`결과 저장 트랜잭션 실패: ${txError.message}`);
  }

  // 관리자 알림 — 실패해도 절대 파이프라인을 막지 않는다 (notify()는 예외를 던지지 않음).
  // Vercel에서는 이 함수(finishFromCretop)를 감싼 바깥쪽 waitUntil이 여기서 await된 Promise가
  // 끝날 때까지만 함수 인스턴스를 살려두므로, 알림도 반드시 await 해야 끝까지 전송된다.
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  await notify({
    event: "report_completed",
    applicationId,
    companyName,
    ceoName,
    healthScore,
    riskGrade,
    receivedAt: new Date().toISOString(),
    links: [
      { label: "결과 보기", url: `${siteUrl}/result/${applicationId}` },
      { label: "관리자 열기", url: `${siteUrl}/admin` },
    ],
  });

  return { healthScore, riskGrade };
}

async function handlePipelineError(applicationId: string, err: unknown) {
  const db = createServiceClient();
  const message = err instanceof Error ? err.message : "알 수 없는 오류";

  const { data: current } = await db
    .from("applications")
    .select("retry_count")
    .eq("id", applicationId)
    .single();

  await db
    .from("applications")
    .update({
      status: "error",
      error_message: message,
      retry_count: (current?.retry_count ?? 0) + 1,
      processing_lock_at: null,
      processing_lock_by: null,
    })
    .eq("id", applicationId);
  throw err;
}
