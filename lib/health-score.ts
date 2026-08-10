import OpenAI from "openai";
import type {
  CretopData,
  DeepAnalysisResult,
  Industry,
  RiskGrade,
  ScoreBreakdown,
  StarRatings,
} from "@/types";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/openai-cache";
import { logStep } from "@/lib/logger";
import { retryWithBackoff } from "@/lib/retry";
import { withTimeout, TimeoutError } from "@/lib/timeout";
import { openaiCircuitBreaker, CircuitOpenError } from "@/lib/circuit-breaker";
import { estimateCostUsd } from "@/lib/openai-cost";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_TIMEOUT_MS = 90_000;

// =========================================================
// 업종 정규화 + 업종별 분석 관점
// =========================================================

/** 크레탑 원문 업종명 → 표준 업종 카테고리로 정규화 */
export function normalizeIndustry(rawIndustry?: string): Industry {
  if (!rawIndustry) return "기타";
  const text = rawIndustry.toLowerCase();

  if (/제조|생산|가공/.test(rawIndustry)) return "제조";
  if (/건설|시공|토목|인테리어/.test(rawIndustry)) return "건설";
  if (/도매|소매|유통|판매업/.test(rawIndustry)) return "도소매";
  if (/병원|의원|의료|한의원|치과/.test(rawIndustry)) return "병원";
  if (/it|소프트웨어|정보통신|플랫폼|앱|software|정보처리/i.test(text)) return "IT";
  if (/운송|물류|화물|택배/.test(rawIndustry)) return "운송";
  if (/음식|외식|식당|카페|프랜차이즈/.test(rawIndustry)) return "음식점";
  if (/서비스|컨설팅|교육|용역/.test(rawIndustry)) return "서비스";
  return "기타";
}

/** 업종별로 AI가 특히 주목해야 할 분석 관점 — 프롬프트에 주입 */
const INDUSTRY_FOCUS: Record<Industry, string> = {
  제조: "설비투자 대비 가동률, 원자재 가격 변동 리스크, 재고자산 회전율, 스마트공장/제조혁신 정부지원사업 적합성을 특히 주목하라.",
  건설: "수주잔고 대비 매출 안정성, 공사대금 미수금 리스크, 하도급 노무 리스크(건설업 특유의 산재/체불 이슈), PF·기성금 현금흐름을 특히 주목하라.",
  도소매: "재고 회전율, 매출채권 회수기간, 온라인 채널 전환 여부, 소상공인/유통 관련 정부지원사업 적합성을 특히 주목하라.",
  병원: "비급여 진료 비중, 의료인력 노무 리스크(전공의/간호인력), 의료장비 감가상각, 의료기관 특화 세무 이슈를 특히 주목하라.",
  IT: "매출 대비 인건비 비중(개발인력), R&D 세액공제·벤처기업 인증 가능성, 특허/SW저작권 등 IP 자산화 여부, 투자유치 이력을 특히 주목하라.",
  서비스: "인건비 의존도, 매출의 계절성/거래처 집중도, 서비스업 특화 정부지원사업(고용창출장려금 등)을 특히 주목하라.",
  운송: "유가 변동에 따른 원가 리스크, 차량/장비 감가상각과 리스 부채, 화물 운송업 특화 정부지원사업, 운전자 노무 리스크를 특히 주목하라.",
  음식점: "원재료비 비중, 임차료 부담, 폐업률이 높은 업종 특성상 안정성 지표, 프랜차이즈 여부에 따른 리스크 차이를 특히 주목하라.",
  기타: "일반적인 중소기업 재무/경영 리스크 관점에서 분석하라.",
};

const ANALYSIS_SCHEMA_HINT = `
다음 JSON 스키마로만 응답하라 (다른 텍스트 금지, 14개 항목 모두 채울 것):
{
  "ai_suggested_score": 0-100,
  "risk_grade": "A" | "B" | "C" | "D" | "E",
  "cashflow": {"score": 0-100, "summary": "...", "detail": "..."},
  "debt_risk": {"score": 0-100, "summary": "...", "detail": "..."},
  "growth": {"score": 0-100, "summary": "...", "detail": "..."},
  "profitability": {"score": 0-100, "summary": "...", "detail": "..."},
  "gov_support": {"score": 0-100, "summary": "...", "detail": "..."},
  "tax_saving": {"score": 0-100, "summary": "...", "detail": "..."},
  "labor_risk": {"score": 0-100, "summary": "...", "detail": "..."},
  "insurance_risk": {"score": 0-100, "summary": "...", "detail": "..."},
  "patent_ip": {"score": 0-100, "summary": "...", "detail": "..."},
  "policy_fund": {"score": 0-100, "summary": "...", "detail": "..."},
  "venture_cert": {"score": 0-100, "summary": "...", "detail": "..."},
  "one_line_advice": "대표에게 가장 중요한 한 줄 조언"
}`;

/**
 * STEP4~5: 업종별 AI 재무/경영 분석 (14개 항목)
 * — 30일 이내 동일 재무데이터에 대한 재호출은 캐시로 스킵한다 (lib/openai-cache.ts)
 * — 90초 타임아웃 + 최대 3회 재시도(지수 백오프) + Circuit Breaker 적용
 */
export async function runAiAnalysis(
  companyName: string,
  cretop: CretopData,
  publicDataSummary: string,
  applicationId: string
): Promise<{ analysis: DeepAnalysisResult; fromCache: boolean }> {
  const cached = await getCachedAnalysis(companyName, cretop);
  if (cached) {
    await logStep({
      application_id: applicationId,
      step: "ai_analysis",
      status: "cache_hit",
      message: "캐시 히트 — GPT 재호출 생략",
    });
    return { analysis: cached, fromCache: true };
  }

  await logStep({ application_id: applicationId, step: "ai_analysis", status: "cache_miss" });

  if (!openaiCircuitBreaker.canAttempt()) {
    await logStep({
      application_id: applicationId,
      step: "ai_analysis",
      status: "error",
      message: "Circuit Breaker OPEN — OpenAI 연속 실패로 일시 차단됨",
    });
    throw new CircuitOpenError();
  }

  const industry = normalizeIndustry(cretop.industry);
  const industryFocus = INDUSTRY_FOCUS[industry];

  const start = Date.now();
  try {
    const completion = await retryWithBackoff(
      () =>
        withTimeout(
          () =>
            openai.chat.completions.create({
              model: "gpt-4o",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `너는 20년 경력의 중소기업 경영 컨설턴트이자 재무 애널리스트다. 맥킨지/PwC 수준의 객관적이고 절제된 톤으로 분석한다. 보험이나 특정 상품 판매를 유도하는 표현은 절대 쓰지 않는다. 데이터가 부족한 항목은 과장하지 말고 "추가 자료 필요"로 명시한다.\n\n[업종: ${industry}] ${industryFocus}\n${ANALYSIS_SCHEMA_HINT}`,
                },
                {
                  role: "user",
                  content: `[회사명] ${companyName}\n\n[재무/기업정보]\n${JSON.stringify(
                    cretop
                  )}\n\n[공개자료 요약]\n${publicDataSummary}\n\n위 자료를 근거로 14개 항목을 분석하라.`,
                },
              ],
            }),
          OPENAI_TIMEOUT_MS,
          "OpenAI 분석 호출"
        ),
      {
        attempts: 3,
        baseDelayMs: 3000,
        onAttemptFailed: (attempt, err) => {
          const message = err instanceof Error ? err.message : String(err);
          return logStep({
            application_id: applicationId,
            step: "ai_analysis",
            status: "retry",
            message: `${attempt}회차 시도 실패(${err instanceof TimeoutError ? "timeout" : "error"}): ${message}`,
          });
        },
      }
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let analysis: DeepAnalysisResult;
    try {
      analysis = JSON.parse(raw) as DeepAnalysisResult;
    } catch {
      throw new Error("OpenAI 응답이 유효한 JSON이 아닙니다.");
    }

    openaiCircuitBreaker.recordSuccess();

    await logStep({
      application_id: applicationId,
      step: "ai_analysis",
      status: "success",
      token_usage: completion.usage?.total_tokens,
      duration_ms: Date.now() - start,
      cost_usd: estimateCostUsd("gpt-4o", completion.usage?.total_tokens),
    });

    await setCachedAnalysis(companyName, cretop, analysis);
    return { analysis, fromCache: false };
  } catch (err) {
    openaiCircuitBreaker.recordFailure();
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    await logStep({
      application_id: applicationId,
      step: "ai_analysis",
      status: "error",
      message,
      duration_ms: Date.now() - start,
    });
    throw err;
  }
}

// =========================================================
// STEP7: 재무비율 기반 결정론적 건강점수
// AI 점수(주관적 평가)가 아니라 실제 재무비율을 계산해 점수화한다.
// 지표가 없으면(크레탑 자동화 미완성 등) 해당 항목은 제외하고 남은 지표로
// 가중치를 재분배한다 — 부분 데이터로도 점수를 낼 수 있게 한다.
// =========================================================

const RATIO_WEIGHTS = {
  revenue_growth_rate: 0.2,
  operating_margin: 0.2,
  debt_ratio: 0.15,
  current_ratio: 0.15,
  roe: 0.15,
  roa: 0.1,
  cashflow: 0.05,
} as const;

type RatioKey = keyof typeof RATIO_WEIGHTS;

// 비율값(%) → 0~100 점수로 변환하는 구간표. 업종 평균이 아직 없는 MVP 단계의 초기 가설값 —
// 실제 업종별 벤치마크 데이터가 쌓이면 업종별 구간으로 세분화 필요.
function scoreRevenueGrowth(rate: number): number {
  if (rate >= 30) return 100;
  if (rate >= 15) return 85;
  if (rate >= 5) return 70;
  if (rate >= 0) return 55;
  if (rate >= -10) return 35;
  return 15;
}
function scoreOperatingMargin(rate: number): number {
  if (rate >= 15) return 100;
  if (rate >= 8) return 85;
  if (rate >= 3) return 65;
  if (rate >= 0) return 45;
  return 20;
}
function scoreDebtRatio(rate: number): number {
  // 부채비율은 낮을수록 안정적
  if (rate <= 50) return 100;
  if (rate <= 100) return 85;
  if (rate <= 200) return 60;
  if (rate <= 300) return 35;
  return 15;
}
function scoreCurrentRatio(rate: number): number {
  // 유동비율은 높을수록 안정적 (200% 이상 우량)
  if (rate >= 200) return 100;
  if (rate >= 150) return 85;
  if (rate >= 100) return 65;
  if (rate >= 70) return 40;
  return 20;
}
function scoreRoe(rate: number): number {
  if (rate >= 15) return 100;
  if (rate >= 8) return 80;
  if (rate >= 3) return 60;
  if (rate >= 0) return 40;
  return 15;
}
function scoreRoa(rate: number): number {
  if (rate >= 8) return 100;
  if (rate >= 4) return 80;
  if (rate >= 1) return 60;
  if (rate >= 0) return 40;
  return 15;
}

export function computeHealthScore(cretop: CretopData): {
  healthScore: number;
  breakdown: ScoreBreakdown;
  riskGrade: RiskGrade;
} {
  const revenueGrowthRate =
    cretop.revenue != null && cretop.revenue_prev_year
      ? ((cretop.revenue - cretop.revenue_prev_year) / cretop.revenue_prev_year) * 100
      : null;

  const operatingMargin =
    cretop.revenue != null && cretop.revenue !== 0 && cretop.operating_profit != null
      ? (cretop.operating_profit / cretop.revenue) * 100
      : null;

  const debtRatio =
    cretop.equity != null && cretop.equity !== 0 && cretop.liabilities != null
      ? (cretop.liabilities / cretop.equity) * 100
      : null;

  const currentRatio =
    cretop.current_liabilities != null &&
    cretop.current_liabilities !== 0 &&
    cretop.current_assets != null
      ? (cretop.current_assets / cretop.current_liabilities) * 100
      : null;

  const roe =
    cretop.equity != null && cretop.equity !== 0 && cretop.net_income != null
      ? (cretop.net_income / cretop.equity) * 100
      : null;

  const roa =
    cretop.assets != null && cretop.assets !== 0 && cretop.net_income != null
      ? (cretop.net_income / cretop.assets) * 100
      : null;

  const cashflowPositive =
    cretop.operating_cashflow != null ? cretop.operating_cashflow > 0 : null;

  const subScores = {
    revenue_growth_rate: revenueGrowthRate != null ? scoreRevenueGrowth(revenueGrowthRate) : 0,
    operating_margin: operatingMargin != null ? scoreOperatingMargin(operatingMargin) : 0,
    debt_ratio: debtRatio != null ? scoreDebtRatio(debtRatio) : 0,
    current_ratio: currentRatio != null ? scoreCurrentRatio(currentRatio) : 0,
    roe: roe != null ? scoreRoe(roe) : 0,
    roa: roa != null ? scoreRoa(roa) : 0,
    cashflow: cashflowPositive == null ? 0 : cashflowPositive ? 90 : 30,
  };

  const availableKeys = (Object.keys(RATIO_WEIGHTS) as RatioKey[]).filter((key) => {
    if (key === "revenue_growth_rate") return revenueGrowthRate != null;
    if (key === "operating_margin") return operatingMargin != null;
    if (key === "debt_ratio") return debtRatio != null;
    if (key === "current_ratio") return currentRatio != null;
    if (key === "roe") return roe != null;
    if (key === "roa") return roa != null;
    if (key === "cashflow") return cashflowPositive != null;
    return false;
  });

  // 결측 지표의 가중치를 사용 가능한 지표들에 비례 재분배
  const totalAvailableWeight = availableKeys.reduce((sum, k) => sum + RATIO_WEIGHTS[k], 0);
  const weightsUsed: Record<string, number> = {};
  let weighted = 0;

  if (totalAvailableWeight > 0) {
    for (const key of availableKeys) {
      const redistributedWeight = RATIO_WEIGHTS[key] / totalAvailableWeight;
      weightsUsed[key] = redistributedWeight;
      weighted += subScores[key] * redistributedWeight;
    }
  }

  const healthScore = totalAvailableWeight > 0 ? Math.round(weighted) : 50; // 데이터 전무 시 중립값

  const riskGrade = scoreToGrade(healthScore);

  const breakdown: ScoreBreakdown = {
    revenue_growth_rate: revenueGrowthRate,
    operating_margin: operatingMargin,
    debt_ratio: debtRatio,
    current_ratio: currentRatio,
    roe,
    roa,
    cashflow_positive: cashflowPositive,
    sub_scores: subScores,
    weights_used: weightsUsed,
    data_completeness: Number((availableKeys.length / Object.keys(RATIO_WEIGHTS).length).toFixed(2)),
    notes:
      totalAvailableWeight > 0
        ? `${availableKeys.length}/${Object.keys(RATIO_WEIGHTS).length}개 지표로 산출 (결측 지표 가중치는 나머지 지표에 재분배)`
        : "재무 원자료가 부족해 중립값(50점)으로 처리됨 — 크레탑 데이터 확보 후 재계산 필요",
  };

  return { healthScore, breakdown, riskGrade };
}

function scoreToGrade(score: number): RiskGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

export function buildStarRatings(
  score: DeepAnalysisResult,
  healthScore: number
): StarRatings {
  const toStar = (s: number) => Math.max(1, Math.min(5, Math.round(s / 20)));
  return {
    finance: toStar((score.profitability.score + score.cashflow.score) / 2),
    growth: toStar(score.growth.score),
    stability: toStar(healthScore), // 결정론적 점수를 안정성 별점의 기준으로 사용
    tax: toStar(score.tax_saving.score),
    gov_support: toStar(score.gov_support.score),
    patent: toStar(score.patent_ip.score),
    labor: toStar(score.labor_risk.score),
  };
}

/**
 * STEP8: 웹 화면에 공개할 "AI가 발견한 문제" 리스트 (5개 내외)
 * — 심층보고서 유도를 위해 요약만 노출, detail은 잠금.
 */
export function buildPublicFindings(analysis: DeepAnalysisResult): string[] {
  const items = [
    analysis.cashflow,
    analysis.debt_risk,
    analysis.growth,
    analysis.profitability,
    analysis.gov_support,
    analysis.tax_saving,
    analysis.labor_risk,
    analysis.insurance_risk,
    analysis.patent_ip,
    analysis.policy_fund,
    analysis.venture_cert,
  ];
  return items
    .sort((a, b) => a.score - b.score) // 점수가 낮은(문제가 큰) 순
    .slice(0, 5)
    .map((item) => item.summary);
}
