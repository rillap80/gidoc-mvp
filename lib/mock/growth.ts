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

// ── 섹션3: 추천 영향력 대시보드 (SNS 공유 가능한 퍼널) ──────
export interface ImpactFunnel {
  invited: number;
  diagnosed: number;
  expertConnected: number;
  expectedEffectManwon: number; // 예상 개선 효과 총합 (만원 단위)
}

export function getImpactFunnel(seedKey: string): ImpactFunnel {
  const rng = seededRandom(`${seedKey}-funnel`);
  const invited = randInt(rng, 6, 30);
  const diagnosed = randInt(rng, Math.floor(invited * 0.5), invited);
  const expertConnected = randInt(rng, Math.floor(diagnosed * 0.3), diagnosed);
  const expectedEffectManwon = randInt(rng, 8000, 68000);
  return { invited, diagnosed, expertConnected, expectedEffectManwon };
}

// ── 섹션7: 추천기업 진행현황 타임라인 ──────────────────────
export type ReferralStage = "진단완료" | "전문가 상담" | "계약 진행" | "성과 완료";
const STAGES: ReferralStage[] = ["진단완료", "전문가 상담", "계약 진행", "성과 완료"];
const COMPANY_NAME_POOL = ["대한정밀", "한빛물류", "서진테크", "미래바이오", "동탄식품", "그린전자", "한울건설", "수원메디컬"];

export interface ReferredCompanyStatus {
  name: string;
  stage: ReferralStage;
}

export function getReferredCompanyTimeline(seedKey: string): ReferredCompanyStatus[] {
  const rng = seededRandom(`${seedKey}-timeline`);
  const count = randInt(rng, 3, 6);
  return Array.from({ length: count }, (_, i) => ({
    name: COMPANY_NAME_POOL[i % COMPANY_NAME_POOL.length],
    stage: STAGES[randInt(rng, 0, STAGES.length - 1)],
  }));
}

// ── 섹션9: 지역 영향력 지도 (지도 대신 가벼운 카드 리스트로 표현) ──
const REGION_POOL = ["동탄", "수원", "오산", "화성", "평택", "용인"];

export interface RegionImpact {
  region: string;
  count: number;
}

export function getRegionImpact(seedKey: string): RegionImpact[] {
  const rng = seededRandom(`${seedKey}-region`);
  return REGION_POOL.slice(0, randInt(rng, 3, REGION_POOL.length))
    .map((region) => ({ region, count: randInt(rng, 2, 40) }))
    .sort((a, b) => b.count - a.count);
}

// ── 섹션10: 월간 건강검진 비교 리포트 ───────────────────────
export interface MonthlyComparison {
  lastMonthScore: number;
  thisMonthScore: number;
  lastMonthEffectManwon: number;
  thisMonthEffectManwon: number;
}

export function getMonthlyComparison(seedKey: string, currentScore: number, currentEffectManwon: number): MonthlyComparison {
  const rng = seededRandom(`${seedKey}-monthly-${new Date().getMonth()}`);
  return {
    lastMonthScore: Math.max(0, currentScore - randInt(rng, 2, 9)),
    thisMonthScore: currentScore,
    lastMonthEffectManwon: Math.max(0, currentEffectManwon - randInt(rng, 500, 4000)),
    thisMonthEffectManwon: currentEffectManwon,
  };
}
