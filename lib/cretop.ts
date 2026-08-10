import type { CretopData } from "@/types";
import { retryWithBackoff } from "@/lib/retry";
import { logStep } from "@/lib/logger";

const CRETOP_API_MAX_ATTEMPTS = 3;

/**
 * STEP3~4: 크레탑(나이스디앤비) 기업정보 조회
 *
 * 원칙 (요구사항 준수):
 * - ID/PW는 절대 코드에 하드코딩하지 않는다. process.env 로만 접근한다.
 * - 공식 API 계약이 있다면 그것을 최우선 사용한다 (fetchViaApi).
 * - 공식 API가 없을 때만 로그인 세션 기반 자동화를 사용한다 (fetchViaSessionAutomation).
 *   이 경로는 Playwright 등 브라우저 자동화가 필요하며, CRETOP의 이용약관(스크래핑 허용 여부)을
 *   반드시 사전 확인해야 한다. 약관상 금지된 경우 이 경로를 사용하지 말 것.
 * - STEP11 에러 복구: 일시적 오류(네트워크/타임아웃 등)에 대비해 최대 3회 자동 재시도한다.
 *   3회 모두 실패하면 logs 테이블에 step/error/retry_count/duration을 남기고 예외를 던져
 *   agent.ts가 status='error'로 기록한다 — 관리자 페이지의 "재실행" 버튼으로 수동 재시도할 수 있다.
 */

export async function getCretopData(
  applicationId: string,
  companyName: string,
  bizRegNo?: string
): Promise<CretopData> {
  if (process.env.CRETOP_API_KEY && process.env.CRETOP_API_BASE_URL) {
    const start = Date.now();
    let attemptsMade = 0;
    try {
      return await retryWithBackoff(() => fetchViaApi(companyName, bizRegNo), {
        attempts: CRETOP_API_MAX_ATTEMPTS,
        onAttemptFailed: (attempt, err) => {
          attemptsMade = attempt;
          return logStep({
            application_id: applicationId,
            step: "cretop",
            status: "retry",
            message: `${attempt}회차 시도 실패: ${err instanceof Error ? err.message : err}`,
            retry_count: attempt,
          });
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      await logStep({
        application_id: applicationId,
        step: "cretop",
        status: "error",
        message,
        retry_count: attemptsMade || CRETOP_API_MAX_ATTEMPTS,
        duration_ms: Date.now() - start,
      });
      throw err;
    }
  }

  if (process.env.CRETOP_ID && process.env.CRETOP_PASSWORD) {
    return fetchViaSessionAutomation(companyName, bizRegNo);
  }

  // 자격증명 미설정 — 파이프라인이 멈추지 않도록 unavailable로 반환하고
  // 이후 단계(AI 분석)는 공개자료만으로 진행한다.
  return { source: "unavailable" };
}

async function fetchViaApi(
  companyName: string,
  bizRegNo?: string
): Promise<CretopData> {
  const res = await fetch(
    `${process.env.CRETOP_API_BASE_URL}/company/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRETOP_API_KEY}`,
      },
      body: JSON.stringify({ companyName, bizRegNo }),
    }
  );

  if (!res.ok) {
    throw new Error(`CRETOP API 오류: ${res.status}`);
  }

  const raw = await res.json();

  // TODO: 실제 크레탑 API 응답 필드명에 맞춰 매핑 수정
  return {
    overview: raw.overview,
    industry: raw.industry,
    ceo: raw.ceoName,
    founded_at: raw.establishedDate,
    revenue: raw.sales,
    revenue_prev_year: raw.salesPrevYear, // TODO: 전기 매출 필드명 확인
    operating_profit: raw.operatingProfit,
    net_income: raw.netIncome, // TODO: 당기순이익 필드명 확인
    assets: raw.totalAssets,
    current_assets: raw.currentAssets, // TODO: 유동자산 필드명 확인
    liabilities: raw.totalLiabilities,
    current_liabilities: raw.currentLiabilities, // TODO: 유동부채 필드명 확인
    equity: raw.totalEquity,
    operating_cashflow: raw.operatingCashFlow, // TODO: 영업활동현금흐름 필드명 확인
    credit_grade: raw.creditGrade,
    source: "api",
  };
}

async function fetchViaSessionAutomation(
  companyName: string,
  bizRegNo?: string
): Promise<CretopData> {
  // 이 분기는 정상 운영에서는 절대 실행되지 않는다 — lib/agent.ts가 세션 자동화 모드일 때
  // getCretopData()를 아예 호출하지 않고 status='awaiting_cretop'만 세팅한 뒤 즉시 반환하기
  // 때문이다(실제 로그인/조회는 worker/cretop-worker.ts가 별도 프로세스에서 수행하고,
  // 완료되면 /api/agent/continue 콜백으로 이어받는다 — README "크레탑 연동 방식" 참고).
  //
  // Playwright는 메인 Next.js 앱의 의존성에서 완전히 제외되어 있으므로(Vercel 빌드를 가볍게
  // 유지하기 위해 worker/ 폴더로 분리함) 이 함수는 여기서 브라우저를 직접 띄우지 않는다.
  // 만약 이 코드에 실제로 도달했다면 agent.ts의 세션 자동화 분기 로직이 깨진 것이므로,
  // 조용히 unavailable을 반환하는 대신 명확한 에러로 알린다.
  void companyName;
  void bizRegNo;
  throw new Error(
    "예상치 못한 경로: getCretopData가 세션 자동화 모드에서 직접 호출되었습니다. " +
      "lib/agent.ts의 isSessionAutomationMode 분기를 확인하세요 (정상 흐름은 worker/cretop-worker.ts가 담당합니다)."
  );
}
