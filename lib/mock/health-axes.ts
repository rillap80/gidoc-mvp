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

export type HealthAxis = "재무" | "노무" | "세무" | "보험" | "정책자금" | "법무";
export const HEALTH_AXES: HealthAxis[] = ["재무", "노무", "세무", "보험", "정책자금", "법무"];

// 6축 합산이 정확히 100점이 되도록 축당 배점을 균등 배분 (100/6, 나머지는 첫 축에 더함)
const BASE_MAX = Math.floor(100 / HEALTH_AXES.length);
const REMAINDER = 100 - BASE_MAX * HEALTH_AXES.length;
export const AXIS_MAX: Record<HealthAxis, number> = HEALTH_AXES.reduce((acc, axis, i) => {
  acc[axis] = BASE_MAX + (i === 0 ? REMAINDER : 0);
  return acc;
}, {} as Record<HealthAxis, number>);

export interface AxisScore {
  axis: HealthAxis;
  score: number; // 0 ~ AXIS_MAX[axis]
  max: number;
  changeFromLastMonth: number; // +/- 점수 변화
}

export interface HealthScoreBreakdown {
  axes: AxisScore[];
  total: number;
  history: number[]; // 최근 6개월 총점 추이 (차트용)
}

export function getHealthScoreBreakdown(seedKey: string): HealthScoreBreakdown {
  const rng = seededRandom(`${seedKey}-axes`);

  const axes: AxisScore[] = HEALTH_AXES.map((axis) => {
    const max = AXIS_MAX[axis];
    const score = randInt(rng, Math.round(max * 0.4), max);
    const changeFromLastMonth = randInt(rng, -2, 4);
    return { axis, score, max, changeFromLastMonth };
  });

  const total = axes.reduce((sum, a) => sum + a.score, 0);

  const history: number[] = [];
  let cur = total;
  for (let i = 0; i < 6; i++) {
    history.unshift(Math.max(0, Math.min(100, cur)));
    cur -= randInt(rng, -3, 5);
  }

  return { axes, total, history };
}
