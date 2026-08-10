import type { ApplicationStatus } from "@/types";

/**
 * Result 페이지의 6단계 Progress UI 정의.
 * 백엔드 status(5개 진행 상태)보다 화면 표시 단계가 많으므로 완전 1:1 매핑은 아니다 —
 * 'ai_analysis' 상태 동안 STEP4(AI 재무분석)와 STEP5(맞춤 컨설팅 생성)를 함께 "진행중"으로 보여주고,
 * 'completed'가 되는 순간 STEP4~6이 한 번에 완료 처리된다. (자세한 근거는 README "Progress UI" 참고)
 */
export const STEP_DEFS = [
  { key: "basic_info", label: "기본정보 확인" },
  { key: "biz_lookup", label: "사업자 정보 조회" },
  { key: "cretop", label: "크레탑 재무자료 조회" },
  { key: "ai_analysis", label: "AI 재무분석" },
  { key: "consulting", label: "맞춤 컨설팅 생성" },
  { key: "report", label: "보고서 생성" },
] as const;

export type StepKey = (typeof STEP_DEFS)[number]["key"];
export type StepState = "done" | "active" | "pending" | "error";

// 요구사항에 명시된 퍼센트 매핑 그대로 사용
export const PROGRESS_PERCENT: Record<ApplicationStatus, number> = {
  received: 10,
  analyzing: 30,
  awaiting_cretop: 60,
  ai_analysis: 80,
  completed: 100,
  deep_requested: 100,
  deep_completed: 100,
  error: 0,
};

// 상태별로 몇 번째 단계(0-indexed)까지 "진행중/완료"인지
const ACTIVE_STEP_INDEX: Record<ApplicationStatus, number> = {
  received: 1, // STEP1 완료, STEP2 진행중
  analyzing: 1, // STEP2 진행중
  awaiting_cretop: 2, // STEP3 진행중
  ai_analysis: 3, // STEP4(~5) 진행중
  completed: 5, // 전체 완료
  deep_requested: 5,
  deep_completed: 5,
  error: -1,
};

export function getStepStates(status: ApplicationStatus): StepState[] {
  const activeIndex = ACTIVE_STEP_INDEX[status];

  if (status === "error") {
    // 오류 발생 시점까지는 완료로, 그 다음 단계를 에러로 표시할 정보가 없으므로
    // 첫 미완료 단계를 error로 표시 (정확한 실패 지점은 관리자 페이지 로그에서 확인)
    return STEP_DEFS.map((_, i) => (i === 0 ? "error" : "pending"));
  }

  if (status === "completed" || status === "deep_requested" || status === "deep_completed") {
    return STEP_DEFS.map(() => "done");
  }

  return STEP_DEFS.map((_, i) => {
    if (i < activeIndex) return "done";
    if (i === activeIndex) return "active";
    return "pending";
  });
}

export const STATUS_TITLE: Partial<Record<ApplicationStatus, string>> = {
  awaiting_cretop: "재무자료를 안전하게 조회하고 있습니다.",
};

export const STATUS_DESCRIPTION: Partial<Record<ApplicationStatus, string>> = {
  awaiting_cretop: "크레탑에서 최신 재무데이터를 불러오는 중입니다.\n평균 30~90초 정도 소요됩니다.",
};
