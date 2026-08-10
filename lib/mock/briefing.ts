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

export interface VisitBriefing {
  newPolicyFunds: number;
  newTaxSavingItems: number;
  newInsuranceRisks: number;
  newEmploymentSupport: number;
}

export function getSinceLastVisitBriefing(seedKey: string): VisitBriefing {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const rng = seededRandom(`${seedKey}-briefing-${dayKey}`);
  return {
    newPolicyFunds: randInt(rng, 0, 3),
    newTaxSavingItems: randInt(rng, 0, 2),
    newInsuranceRisks: randInt(rng, 0, 1),
    newEmploymentSupport: randInt(rng, 0, 4),
  };
}

export interface UpdateItem {
  label: string;
  isNew: boolean;
}

export function getRecentUpdates(seedKey: string): UpdateItem[] {
  const briefing = getSinceLastVisitBriefing(seedKey);
  const items: UpdateItem[] = [];
  if (briefing.newPolicyFunds > 0) items.push({ label: `신규 정책자금 ${briefing.newPolicyFunds}건`, isNew: true });
  if (briefing.newTaxSavingItems > 0) items.push({ label: `절세 가능 항목 ${briefing.newTaxSavingItems}건`, isNew: true });
  if (briefing.newInsuranceRisks > 0) items.push({ label: `보험 리스크 ${briefing.newInsuranceRisks}건`, isNew: true });
  if (briefing.newEmploymentSupport > 0) items.push({ label: `고용지원금 ${briefing.newEmploymentSupport}건`, isNew: true });
  items.push({ label: "최근 점수 변화 확인 가능", isNew: false });
  return items;
}
