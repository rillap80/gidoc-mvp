// =========================================================
// 파이프라인 상태
// =========================================================
export type ApplicationStatus =
  | "received" // STEP1 기본정보 확인
  | "analyzing" // STEP2 사업자 정보 조회
  | "awaiting_cretop" // STEP3 크레탑 재무자료 조회
  | "ai_analysis" // STEP4~5 AI 재무분석 + 맞춤 컨설팅 생성
  | "completed" // STEP6 보고서 생성 완료
  | "deep_requested"
  | "deep_completed"
  | "error";

export interface Application {
  id: string;
  created_at: string;
  company_name: string;
  ceo_name: string;
  biz_reg_no?: string | null;
  status: ApplicationStatus;
  error_message?: string | null;
  retry_count?: number;
  processing_lock_at?: string | null;
  processing_lock_by?: string | null;
}

// =========================================================
// 업종
// =========================================================
export type Industry =
  | "제조"
  | "건설"
  | "도소매"
  | "병원"
  | "IT"
  | "서비스"
  | "운송"
  | "음식점"
  | "기타";

// =========================================================
// 크레탑 원자료
// =========================================================
export interface CretopData {
  overview?: string;
  industry?: string; // 크레탑에서 내려주는 원문 업종명 (Industry로 정규화해서 사용)
  ceo?: string;
  founded_at?: string;

  // 손익계산서
  revenue?: number;
  revenue_prev_year?: number; // 성장률 계산용 전기 매출
  operating_profit?: number;
  net_income?: number; // ROE/ROA 계산용 당기순이익

  // 재무상태표
  assets?: number;
  current_assets?: number; // 유동비율 계산용
  liabilities?: number;
  current_liabilities?: number; // 유동비율 계산용
  equity?: number;

  // 현금흐름
  operating_cashflow?: number;

  credit_grade?: string;
  source: "api" | "session_automation" | "unavailable";
}

// CRETOP 자동화 스펙에서 부르는 이름 — 구조는 CretopData와 동일 (raw 재무 원자료).
// ROE/ROA/부채비율/유동비율 같은 파생 비율은 이 raw 값들로부터
// lib/health-score.ts의 computeHealthScore가 결정론적으로 계산한다 (사이트마다 표시 방식이
// 다른 "비율" 자체를 스크래핑하는 대신, 원자료만 정확히 가져오면 계산은 우리가 통제할 수 있다).
export type HealthData = CretopData;

// =========================================================
// AI 분석 (STEP6) — 14개 항목
// ① 건강점수는 AI가 아니라 lib/health-score.ts의 결정론적 산식(computeHealthScore)이
//    재무비율로 직접 계산해 최종값으로 사용한다. AI가 내는 ai_suggested_score는
//    참고/교차검증용으로만 저장하고 화면에는 노출하지 않는다.
// =========================================================
export interface DeepAnalysisResult {
  ai_suggested_score: number; // ① 참고용 — 최종 점수는 computeHealthScore 결과 사용
  risk_grade: RiskGrade; // ② 재무위험등급
  cashflow: AnalysisItem; // ③
  debt_risk: AnalysisItem; // ④ 부채위험
  growth: AnalysisItem; // ⑤ 성장성
  profitability: AnalysisItem; // ⑥ 수익성
  gov_support: AnalysisItem; // ⑦ 정부지원 활용 가능성
  tax_saving: AnalysisItem; // ⑧ 절세 가능성
  labor_risk: AnalysisItem; // ⑨ 노무 리스크
  insurance_risk: AnalysisItem; // ⑩ 보험 리스크
  patent_ip: AnalysisItem; // ⑪ 특허/IP 전략
  policy_fund: AnalysisItem; // ⑫ 정책자금 가능성
  venture_cert: AnalysisItem; // ⑬ 벤처기업 인증 가능성
  one_line_advice: string; // ⑭ 대표에게 가장 중요한 한 줄 조언
}

export type RiskGrade = "A" | "B" | "C" | "D" | "E";

export interface AnalysisItem {
  score: number; // 0-100, 내부 산식용
  summary: string; // 대표 노출용 한 줄 요약
  detail?: string; // 심층보고서용 상세 (2차에서만 노출)
}

// 구버전 호환 별칭 (기존 코드에서 AnalysisResult로 참조하던 부분 마이그레이션용)
export type AnalysisResult = DeepAnalysisResult;

export interface StarRatings {
  finance: number;
  growth: number;
  stability: number;
  tax: number;
  gov_support: number;
  patent: number;
  labor: number;
}

// =========================================================
// STEP7: 재무비율 기반 결정론적 건강점수 산출 근거
// =========================================================
export interface ScoreBreakdown {
  revenue_growth_rate: number | null; // 매출성장률 (%)
  operating_margin: number | null; // 영업이익률 (%)
  debt_ratio: number | null; // 부채비율 (%)
  current_ratio: number | null; // 유동비율 (%)
  roe: number | null; // 자기자본이익률 (%)
  roa: number | null; // 총자산이익률 (%)
  cashflow_positive: boolean | null; // 영업현금흐름 양(+) 여부
  sub_scores: {
    revenue_growth_rate: number;
    operating_margin: number;
    debt_ratio: number;
    current_ratio: number;
    roe: number;
    roa: number;
    cashflow: number;
  };
  weights_used: Record<string, number>; // 데이터 결측 시 가중치 재분배된 실제 사용 가중치
  data_completeness: number; // 0~1, 계산에 사용된 지표 비율
  notes: string;
}

export interface HealthReport {
  id: string;
  application_id: string;
  health_score: number;
  score_breakdown: ScoreBreakdown;
  risk_grade: RiskGrade;
  star_ratings: StarRatings;
  findings: string[]; // STEP8 "AI가 발견한 문제" 리스트 (공개분)
  locked_findings_count: number; // "추가 분석 N건 발견" 표시용
}

// =========================================================
// 로그 (STEP10)
// =========================================================
export interface LogEntry {
  application_id: string;
  step: string; // 'biz_lookup' | 'cretop' | 'public_data' | 'ai_analysis' | 'report' | 'deep_analysis' 등
  status: "started" | "success" | "error" | "retry" | "cache_hit" | "cache_miss";
  message?: string;
  token_usage?: number;
  duration_ms?: number;
  cost_usd?: number | null;
  retry_count?: number;
}
