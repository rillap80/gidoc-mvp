/**
 * Final Release: '포인트(P)'는 화면 표기 단위로 사용하되, 현금이 아니라 기여도를 나타낸다.
 * (섹션7 원문: "현금이 아니다. 기여도이다.") 절대 원화(₩) 금액이나 실제 정산과 연결하지 않는다.
 */

export type ContributionAction =
  | "company_signup" // 기업가입 — 아직 실제 회원가입 플로우가 없어 정의만 해둠 (Supabase Auth 연동 후 연결)
  | "checkup" // 건강검진 완료 확인
  | "deep_diagnosis" // 2차진단(심층 건강검진) 시작
  | "contract_connected" // 계약연결 — 아직 실제 계약 확정 플로우가 없어 정의만 해둠 (관리자 승인 후 지급 예정)
  | "review" // 후기작성
  | "feedback" // 피드백(VOC)
  | "referral_signup"; // 추천가입 — MVP에서는 "공유 실행"을 근사치로 사용 (실제 가입 확인은 추후 Supabase 연동)

export const CONTRIBUTION_POINTS: Record<ContributionAction, number> = {
  company_signup: 20,
  checkup: 100,
  deep_diagnosis: 300,
  contract_connected: 500,
  review: 50,
  feedback: 20,
  referral_signup: 100,
};

export const CONTRIBUTION_LABEL: Record<ContributionAction, string> = {
  company_signup: "기업가입",
  checkup: "건강검진",
  deep_diagnosis: "2차진단",
  contract_connected: "계약연결",
  review: "후기작성",
  feedback: "피드백",
  referral_signup: "추천가입",
};

export interface ContributionTier {
  emoji: string;
  title: string;
  minScore: number;
}

// Founding Member는 점수와 무관하게 "초기 가입자"만 획득 (희소성 유지) — 별도 플래그로 판단
export const CONTRIBUTION_TIERS: ContributionTier[] = [
  { emoji: "🥉", title: "기업도우미", minScore: 0 },
  { emoji: "🥈", title: "성장파트너", minScore: 150 },
  { emoji: "🥇", title: "기업닥터", minScore: 500 },
  { emoji: "💎", title: "Grand Doctor", minScore: 1200 },
];

export function getContributionTier(score: number, isFoundingMember: boolean): ContributionTier {
  if (isFoundingMember) return { emoji: "👑", title: "Founding Member", minScore: 0 };
  let tier = CONTRIBUTION_TIERS[0];
  for (const t of CONTRIBUTION_TIERS) {
    if (score >= t.minScore) tier = t;
  }
  return tier;
}

export interface ContributionHistoryEntry {
  action: ContributionAction;
  amount: number;
  at: string; // ISO date
}
