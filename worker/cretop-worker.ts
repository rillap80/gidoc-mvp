/**
 * 크레탑 로그인 세션 자동화 워커.
 *
 * 왜 별도 스크립트인가:
 *   Playwright 헤드리스 브라우저는 Netlify Functions 같은 서버리스 환경에서
 *   타임아웃(기본 10~26초)과 바이너리 크기 제약 때문에 안정적으로 못 돌린다.
 *   그래서 이 스크립트는 Next.js 앱과 별개로, 사람이 로그인하듯 브라우저를 계속 띄워둘 수 있는
 *   환경(예: 저렴한 VPS, 사무실 PC의 백그라운드 프로세스, Railway/Render 같은 상시구동 서비스)에서
 *   cron 또는 무한루프로 돌린다.
 *
 * Worker Lock:
 *   워커를 2대 이상 띄워도(스케일아웃, 재배포 중 중복 실행 등) 같은 신청 건을 동시에
 *   처리하지 않도록 applications.processing_lock_at/processing_lock_by로 선점한다.
 *   락은 원자적 조건부 UPDATE로 획득하므로(WHERE 절에 락 조건 포함) 두 워커가 동시에
 *   같은 행을 시도해도 한쪽만 성공한다. 5분 이상 갱신되지 않은 락은 죽은 워커의 것으로
 *   간주하고 다른 워커가 회수할 수 있다.
 *
 * 실행 방법:
 *   npm start                    # 1회 폴링 후 종료 (cron으로 주기 실행 시)
 *   npm run start:loop           # 30초 간격으로 계속 폴링
 *
 * 필요 env (.env.local 또는 시스템 env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   CRETOP_ID, CRETOP_PASSWORD, SITE_URL (Next.js 앱 도메인), GOOGLE_FORM_WEBHOOK_SECRET
 */
import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { loginAndFetchFinancials } from "./cretop-automation";
import { retryWithBackoff } from "../lib/retry";
import { logStep } from "../lib/logger";
import { maskCretopCredentials } from "../lib/secret-mask";

const CRETOP_MAX_ATTEMPTS = 3;

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const WORKER_ID = `worker-${process.pid}-${crypto.randomBytes(3).toString("hex")}`;
const STALE_LOCK_MS = 5 * 60 * 1000;

/** 원자적 락 선점 — 성공하면 true, 이미 다른 워커가 선점 중이면 false */
async function claimApplication(applicationId: string): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  const { data, error } = await db
    .from("applications")
    .update({ processing_lock_at: new Date().toISOString(), processing_lock_by: WORKER_ID })
    .eq("id", applicationId)
    .eq("status", "awaiting_cretop")
    .or(`processing_lock_at.is.null,processing_lock_at.lt.${staleThreshold}`)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[cretop-worker] 락 획득 실패: ${error.message}`);
    return false;
  }
  return !!data;
}

async function releaseLock(applicationId: string) {
  await db
    .from("applications")
    .update({ processing_lock_at: null, processing_lock_by: null })
    .eq("id", applicationId)
    .eq("processing_lock_by", WORKER_ID);
}

async function processOne(applicationId: string, companyName: string, bizRegNo: string | null) {
  const claimed = await claimApplication(applicationId);
  if (!claimed) {
    console.log(`[cretop-worker] 스킵(다른 워커가 처리 중): ${companyName} (${applicationId})`);
    return;
  }

  console.log(`[cretop-worker] 처리 시작: ${companyName} (${applicationId})`);
  const start = Date.now();
  let attemptsMade = 0;

  try {
    // STEP11 에러 복구: 로그인/네트워크 일시 오류에 대비해 최대 3회 자동 재시도
    // (CRETOP_ID/CRETOP_PASSWORD는 lib/cretop-automation.ts 내부에서만 env로 읽는다 —
    //  이 워커를 포함해 어떤 코드에도 자격증명 문자열을 직접 전달하지 않는다.)
    const result = await retryWithBackoff(
      () => loginAndFetchFinancials(companyName, bizRegNo ?? undefined),
      {
        attempts: CRETOP_MAX_ATTEMPTS,
        baseDelayMs: 5000,
        onAttemptFailed: (attempt, err) => {
          attemptsMade = attempt;
          // cretop-automation.ts가 이미 마스킹하지만, 다른 예외 경로에 대비해 한 번 더 마스킹한다.
          const message = maskCretopCredentials(err instanceof Error ? err.message : String(err));
          console.warn(`[cretop-worker] ${attempt}회차 실패: ${message}`);
          return logStep({
            application_id: applicationId,
            step: "cretop",
            status: "retry",
            message: `${attempt}회차 시도 실패: ${message}`,
            retry_count: attempt,
          });
        },
      }
    );

    const { pdfBuffer, ...cretopData } = result;
    void pdfBuffer;
    // TODO: pdfBuffer가 있으면 Google Drive에 업로드하고 health_reports.cretop_pdf_url에 반영
    // (lib/google.ts의 uploadPdfToDrive 재사용 가능 — 이 스크립트에선 지면상 생략)

    await db
      .from("applications")
      .update({ cretop_cache: cretopData })
      .eq("id", applicationId);

    await logStep({
      application_id: applicationId,
      step: "cretop",
      status: "success",
      duration_ms: Date.now() - start,
    });

    const res = await fetch(`${SITE_URL}/api/agent/continue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        secret: process.env.GOOGLE_FORM_WEBHOOK_SECRET,
      }),
    });

    if (!res.ok) {
      throw new Error(`continue API 실패: ${res.status}`);
    }
    console.log(`[cretop-worker] 완료: ${companyName}`);
    // 성공 시 락 해제는 continue → fn_save_health_report 트랜잭션에서 처리됨
  } catch (err) {
    const message = maskCretopCredentials(err instanceof Error ? err.message : "알 수 없는 오류");
    console.error(`[cretop-worker] 실패: ${companyName} — ${message}`);

    // 최종 실패 로그 — step/error/retry_count/duration 명시적 기록
    await logStep({
      application_id: applicationId,
      step: "cretop",
      status: "error",
      message,
      retry_count: attemptsMade || CRETOP_MAX_ATTEMPTS,
      duration_ms: Date.now() - start,
    });

    await db
      .from("applications")
      .update({ status: "error", error_message: `크레탑 조회 실패: ${message}` })
      .eq("id", applicationId);
    await releaseLock(applicationId);
  }
}

async function pollOnce() {
  const { data: rows, error } = await db
    .from("applications")
    .select("id, company_name, biz_reg_no")
    .eq("status", "awaiting_cretop")
    .limit(5);

  if (error) {
    console.error("[cretop-worker] 폴링 오류:", error.message);
    return;
  }
  if (!rows || rows.length === 0) return;

  // 크레탑은 동시 세션 제한이 있을 수 있으므로 순차 처리
  for (const row of rows) {
    await processOne(row.id, row.company_name, row.biz_reg_no);
  }
}

async function main() {
  const loop = process.argv.includes("--loop");

  if (!loop) {
    await pollOnce();
    return;
  }

  console.log(`[cretop-worker] 상시 폴링 모드 시작 (worker id: ${WORKER_ID}, 30초 간격, Ctrl+C로 종료)`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await pollOnce();
    await new Promise((r) => setTimeout(r, 30000));
  }
}

main().catch((e) => {
  console.error("[cretop-worker] 치명적 오류:", e);
  process.exit(1);
});
