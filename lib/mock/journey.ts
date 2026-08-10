import { hasAwardedOnce } from "@/lib/mock/storage";

export const JOURNEY_STAGES = ["건강검진", "2차진단", "전문가상담", "계약", "성과", "후기"] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/**
 * 실제로 이 브라우저에서 확인된 행동(1회성 지급 플래그)을 근거로 현재 단계를 추정한다.
 * "성과"/"계약" 단계는 아직 실제 트리거가 없어(관리자 확정 필요) 항상 도달 전으로 처리한다 —
 * Supabase에 contracts 테이블이 생기면 그 값을 그대로 여기 반영하면 된다.
 */
export function getJourneyStageIndex(applicationId: string): number {
  if (hasAwardedOnce(applicationId, "review")) return 5; // 후기까지 작성
  if (hasAwardedOnce(applicationId, "deep_diagnosis")) return 2; // 2차진단은 했으니 최소 "전문가상담" 진행중으로 표시
  if (hasAwardedOnce(applicationId, "checkup")) return 0;
  return -1; // 아직 결과 확인 전 (대시보드에 진입하면 즉시 0으로 올라감)
}
