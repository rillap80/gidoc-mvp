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

const TOP_ISSUE_POOL = ["정책자금 미활용", "보험 리스크", "절세 항목 누락", "노무 리스크", "특허 미보호", "정부지원 사각지대"];

export interface TopIssue {
  label: string;
  count: number;
}

/**
 * ⚠️ Mock: 실제로는 health_reports.findings 컬럼을 전체 집계해야 정확한 TOP5가 나온다.
 * 지금은 요청 건수(rows.length)에 비례해 그럴듯한 분포를 만든다.
 */
export function getTopIssuesMock(seedKey: string, totalApplications: number): TopIssue[] {
  const rng = seededRandom(`${seedKey}-topissues-${new Date().toISOString().slice(0, 10)}`);
  return TOP_ISSUE_POOL
    .map((label) => ({ label, count: Math.round(rng() * Math.max(1, totalApplications)) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

const SUMMARY_TEMPLATES = [
  "이번주 기업들은 정책자금 관심도가 증가했습니다.",
  "보험 리스크 문의가 감소했습니다.",
  "노무 상담 요청이 증가했습니다.",
  "절세 항목 발견 건수가 지난주 대비 늘었습니다.",
  "특허/IP 관련 문의가 눈에 띄게 늘었습니다.",
];

/** ⚠️ Mock: 실제 GPT 요약이 아니라 요일 시드로 템플릿을 골라 보여준다 (가볍게 유지 원칙). */
export function getAiWeeklySummaryMock(seedKey: string): string[] {
  const rng = seededRandom(`${seedKey}-summary-${new Date().toISOString().slice(0, 10)}`);
  const shuffled = [...SUMMARY_TEMPLATES].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3);
}
