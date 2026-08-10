/**
 * V6 섹션11 "재방문 시스템": 로그인할 때마다 항상 같은 화면이면 재방문 동기가 없다.
 * applicationId + "오늘 날짜"를 시드로 섞어서, 같은 회사라도 날짜가 바뀌면
 * 다른 기회/질문이 보이도록 한다 (같은 날 안에서는 새로고침해도 동일하게 유지).
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

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function pickN<T>(rng: () => number, pool: T[], n: number): T[] {
  const shuffled = [...pool].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

// ── 섹션4: 오늘 AI가 발견한 기회 ──────────────────────────
const OPPORTUNITY_POOL = [
  "지원사업 2건",
  "보험 절감 가능",
  "세무 개선",
  "특허 지원",
  "정부자금",
  "고용창출장려금",
  "R&D 세액공제",
  "수출바우처 지원",
];

export function getTodayOpportunities(applicationId: string): string[] {
  const rng = seededRandom(`${applicationId}-opportunities-${todayKey()}`);
  return pickN(rng, OPPORTUNITY_POOL, 5);
}

// ── 섹션5: 이번주 기업 건강 변화 ──────────────────────────
const CHANGE_REASON_POOL = [
  "정부지원 신규 항목이 반영되어 점수가 올랐습니다.",
  "재무 데이터 갱신으로 안정성 지표가 개선되었습니다.",
  "절세 가능 항목이 추가로 발견되어 반영되었습니다.",
  "특허/IP 활동이 확인되어 성장성 점수가 올랐습니다.",
];

export interface WeeklyChange {
  lastWeekScore: number;
  thisWeekScore: number;
  reason: string;
}

export function getWeeklyChange(applicationId: string, baseScore: number): WeeklyChange {
  // 주 단위로만 바뀌도록 "연도-주차"를 시드에 사용
  const now = new Date();
  const weekKey = `${now.getFullYear()}-W${Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  )}`;
  const rng = seededRandom(`${applicationId}-weekly-${weekKey}`);
  const delta = Math.floor(rng() * 6) + 1; // +1 ~ +6
  const lastWeekScore = Math.max(0, baseScore - delta);
  return {
    lastWeekScore,
    thisWeekScore: baseScore,
    reason: CHANGE_REASON_POOL[Math.floor(rng() * CHANGE_REASON_POOL.length)],
  };
}

// ── 섹션6: AI 체크인 (하루 1개 질문, YES/NO) ──────────────
const CHECKIN_QUESTION_POOL = [
  "직원 퇴직금 준비가 되어 있나요?",
  "최근 1년 내 정부지원사업에 지원해보셨나요?",
  "산재보험 가입 현황을 최근에 점검하셨나요?",
  "특허/상표 출원을 검토해보신 적 있으신가요?",
  "최근 매출채권 회수 지연을 겪은 적 있으신가요?",
  "직원 채용 시 고용지원금을 활용하고 계신가요?",
];

export function getTodayCheckinQuestion(applicationId: string): { id: string; question: string } {
  const rng = seededRandom(`${applicationId}-checkin-${todayKey()}`);
  const index = Math.floor(rng() * CHECKIN_QUESTION_POOL.length);
  return { id: `${todayKey()}:${index}`, question: CHECKIN_QUESTION_POOL[index] };
}

export function getTodayKey(): string {
  return todayKey();
}

// ── 섹션2: 주간 리포트 "이번주 새롭게 발견" ──────────────────
const DISCOVERY_POOL = ["정책사업 추가", "절세항목 추가", "보험리스크 변경", "노무리스크 변경", "특허 지원 대상 확대"];

export function getWeeklyDiscoveries(applicationId: string): string[] {
  const now = new Date();
  const weekKey = `${now.getFullYear()}-W${Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  )}`;
  const rng = seededRandom(`${applicationId}-discoveries-${weekKey}`);
  return pickN(rng, DISCOVERY_POOL, 3);
}
