/**
 * Sprint 10 MVP 원칙: 모든 금액/등급 데이터는 Mock이다.
 * 다만 매번 새로고침할 때마다 숫자가 바뀌면 신뢰도가 떨어지므로,
 * applicationId를 시드로 한 결정론적 PRNG로 "이 회사는 항상 같은 숫자"를 보장한다.
 */

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export interface MoneyEffect {
  label: string;
  amountManwon: number; // 만원 단위
  badge?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  impactLabel: string; // "예상효과" 표시 문구 (금액 또는 "과태료 예방" 같은 텍스트)
  minutes: number;
}

export interface MonthlyChange {
  healthScoreDelta: number;
  taxSavingDeltaManwon: number;
  insuranceSavingDeltaManwon: number;
  policyFundStatus: string; // "신규발견" 등
}

export interface ReferralStats {
  invitedCompanies: number;
  contractsCompleted: number;
  expectedRewardWon: number;
  nationalRank: number;
  sharesThisMonth: number;
}

export interface MockDashboardData {
  healthScore: number;
  industryAvgScore: number;
  taxSaving: MoneyEffect;
  policyFund: MoneyEffect;
  insuranceSaving: MoneyEffect;
  govSupport: MoneyEffect;
  laborSaving: MoneyEffect;
  otherSaving: MoneyEffect;
  totalEffectManwon: number;
  checklist: ChecklistItem[];
  monthlyChange: MonthlyChange;
  referral: ReferralStats;
  aiMessage: string;
}

export function generateMockDashboardData(seedKey: string): MockDashboardData {
  const rng = seededRandom(seedKey || "gidoc-default");

  const healthScore = randInt(rng, 62, 88);
  // 대표 심리 자극: 동종업계 평균은 대체로 내 점수보다 살짝 높게 — 개선 여지를 느끼게 함
  const industryAvgScore = Math.min(96, healthScore + randInt(rng, 3, 14));

  const taxSaving: MoneyEffect = { label: "세무절감", amountManwon: randInt(rng, 800, 3200), badge: "예상금액" };
  const policyFund: MoneyEffect = { label: "정책자금 가능", amountManwon: randInt(rng, 8000, 45000), badge: "예상금액" };
  const insuranceSaving: MoneyEffect = { label: "보험절감", amountManwon: randInt(rng, 80, 600), badge: "예상금액" };
  const govSupport: MoneyEffect = { label: "정부지원", amountManwon: randInt(rng, 1200, 8000), badge: "예상금액" };
  const laborSaving: MoneyEffect = { label: "노무절감", amountManwon: randInt(rng, 100, 900), badge: "예상금액" };
  const otherSaving: MoneyEffect = { label: "기타절감", amountManwon: randInt(rng, 50, 500), badge: "예상금액" };

  const totalEffectManwon =
    taxSaving.amountManwon +
    policyFund.amountManwon +
    insuranceSaving.amountManwon +
    govSupport.amountManwon +
    laborSaving.amountManwon +
    otherSaving.amountManwon;

  const checklist: ChecklistItem[] = [
    { id: "policy_fund_apply", label: "정책자금 신청", impactLabel: `${Math.round(policyFund.amountManwon / 10000)}억원`, minutes: 3 },
    { id: "insurance_review", label: "보험 점검", impactLabel: `${insuranceSaving.amountManwon.toLocaleString()}만원`, minutes: 5 },
    { id: "labor_check", label: "노무진단", impactLabel: "과태료 예방", minutes: 4 },
    { id: "tax_review", label: "세무검토", impactLabel: `${taxSaving.amountManwon.toLocaleString()}만원`, minutes: 4 },
    { id: "patent_review", label: "특허검토", impactLabel: "R&D 세액공제 가능", minutes: 3 },
  ];

  const monthlyChange: MonthlyChange = {
    healthScoreDelta: randInt(rng, 1, 6),
    taxSavingDeltaManwon: randInt(rng, 50, 400),
    insuranceSavingDeltaManwon: randInt(rng, 10, 120),
    policyFundStatus: "신규발견",
  };

  const referral: ReferralStats = {
    invitedCompanies: randInt(rng, 3, 40),
    contractsCompleted: randInt(rng, 0, 12),
    expectedRewardWon: randInt(rng, 30, 400) * 10000,
    nationalRank: randInt(rng, 3, 200),
    sharesThisMonth: randInt(rng, 0, 20),
  };

  const aiMessage = `대표님. 이번달 ${taxSaving.amountManwon.toLocaleString()}만원 절세 가능성이 발견되었습니다. 확인하시겠습니까?`;

  return {
    healthScore,
    industryAvgScore,
    taxSaving,
    policyFund,
    insuranceSaving,
    govSupport,
    laborSaving,
    otherSaving,
    totalEffectManwon,
    checklist,
    monthlyChange,
    referral,
    aiMessage,
  };
}

/** "1,840만원" 스타일 포맷 */
export function formatManwon(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rest = manwon % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${manwon.toLocaleString()}만원`;
}

/** "₩ 18,400,000" 스타일 포맷 */
export function formatWon(manwon: number): string {
  return `₩ ${(manwon * 10000).toLocaleString()}`;
}
