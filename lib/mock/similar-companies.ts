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

const INDUSTRY_POOL = ["제조업", "건설업", "도소매업", "IT/서비스업", "운송업"];
const REGION_POOL = ["경기", "서울", "인천", "충남", "경남"];
const SIZE_POOL = ["10인 이하", "20인", "50인", "100인 이상"];

export interface SimilarCompanyStats {
  industry: string;
  size: string;
  region: string;
  similarCount: number;
  govSupportPct: number;
  insuranceImprovedPct: number;
  taxRefundPct: number;
  patentPct: number;
}

/**
 * 실제 데이터가 쌓일수록 이 함수를 Supabase 집계 쿼리로 교체하면 된다 —
 * 지금은 회사(applicationId) 시드로 "그럴듯한" 익명 통계를 만든다.
 */
export function getSimilarCompanyStats(seedKey: string): SimilarCompanyStats {
  const rng = seededRandom(`${seedKey}-similar`);
  return {
    industry: INDUSTRY_POOL[Math.floor(rng() * INDUSTRY_POOL.length)],
    size: SIZE_POOL[Math.floor(rng() * SIZE_POOL.length)],
    region: REGION_POOL[Math.floor(rng() * REGION_POOL.length)],
    similarCount: randInt(rng, 40, 320),
    govSupportPct: randInt(rng, 25, 55),
    insuranceImprovedPct: randInt(rng, 20, 48),
    taxRefundPct: randInt(rng, 10, 30),
    patentPct: randInt(rng, 5, 22),
  };
}
