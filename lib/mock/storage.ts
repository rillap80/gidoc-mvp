/**
 * MVP 원칙: 실제 백엔드 없이 브라우저 localStorage로 상태를 유지한다.
 * 키는 applicationId별로 네임스페이스를 나눠 여러 회사 대시보드를 한 브라우저에서 봐도 섞이지 않게 한다.
 */
import type { ContributionAction, ContributionHistoryEntry } from "@/lib/mock/contribution";
import { CONTRIBUTION_POINTS } from "@/lib/mock/contribution";
import type { VocEntry } from "@/lib/mock/voc-classifier";
import type { LearningQueueEntry } from "@/lib/mock/learning-queue";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(applicationId: string, name: string) {
  return `gidoc:${applicationId}:${name}`;
}

// ── 체크리스트 완료 상태 + 포인트 ──────────────────────────
export function getCompletedChecklist(applicationId: string): Record<string, boolean> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(key(applicationId, "checklist"));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setChecklistItemCompleted(applicationId: string, itemId: string, completed: boolean) {
  if (!isBrowser()) return;
  const current = getCompletedChecklist(applicationId);
  current[itemId] = completed;
  localStorage.setItem(key(applicationId, "checklist"), JSON.stringify(current));
}

// ── V6: 기여도(Contribution) — '포인트' 명칭은 사용하지 않으며 현금과 연결하지 않는다 ──
export function getContributionScore(applicationId: string): number {
  if (!isBrowser()) return 0;
  const raw = localStorage.getItem(key(applicationId, "contribution_score"));
  return raw ? Number(raw) || 0 : 0;
}

export function getContributionHistory(applicationId: string): ContributionHistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(key(applicationId, "contribution_history"));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addContribution(applicationId: string, action: ContributionAction): number {
  if (!isBrowser()) return 0;
  const amount = CONTRIBUTION_POINTS[action];
  const next = getContributionScore(applicationId) + amount;
  localStorage.setItem(key(applicationId, "contribution_score"), String(next));

  const history = getContributionHistory(applicationId);
  history.push({ action, amount, at: new Date().toISOString() });
  localStorage.setItem(key(applicationId, "contribution_history"), JSON.stringify(history));

  return next;
}

/** 이번달(이번 캘린더 월) 기여 히스토리만 액션별로 합산 — 섹션8 "기여 히스토리" 카드용 */
export function getThisMonthContributionBreakdown(applicationId: string): Partial<Record<ContributionAction, number>> {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${now.getMonth()}`;
  const breakdown: Partial<Record<ContributionAction, number>> = {};
  for (const entry of getContributionHistory(applicationId)) {
    const entryDate = new Date(entry.at);
    const entryMonth = `${entryDate.getFullYear()}-${entryDate.getMonth()}`;
    if (entryMonth !== thisMonth) continue;
    breakdown[entry.action] = (breakdown[entry.action] ?? 0) + 1;
  }
  return breakdown;
}

// Founding Member — 이 브라우저가 이 회사 대시보드에 "처음" 접속했을 때 한 번만 부여되고,
// 이후에는 절대 다시 계산하지 않는다 (희소성 유지 — 나중에 조건이 바뀌어도 이미 준 배지는 유지).
export function getIsFoundingMember(applicationId: string): boolean {
  if (!isBrowser()) return false;
  const existing = localStorage.getItem(key(applicationId, "founding_member"));
  if (existing !== null) return existing === "1";
  // 최초 접속 시점에 결정 — 데모 목적상 "처음 방문한 사용자는 모두 Founding Member"로 하지 않고
  // applicationId 기반으로 약 20%만 해당하도록 해 희소성을 유지한다.
  const hash = Array.from(applicationId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const isFounding = hash % 5 === 0;
  localStorage.setItem(key(applicationId, "founding_member"), isFounding ? "1" : "0");
  return isFounding;
}

// ── V6 섹션6: AI 체크인 (하루 1문항, YES/NO — 2차 진단 데이터로 저장되는 것을 흉내) ──
export function getCheckinAnswer(applicationId: string, questionId: string): "yes" | "no" | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(key(applicationId, `checkin:${questionId}`));
  return raw === "yes" || raw === "no" ? raw : null;
}

export function setCheckinAnswer(applicationId: string, questionId: string, answer: "yes" | "no") {
  if (!isBrowser()) return;
  localStorage.setItem(key(applicationId, `checkin:${questionId}`), answer);
}

// ── 1회성 지급 가드 (건강검진/2차진단처럼 "최초 1회만" 지급해야 하는 기여도) ──
export function hasAwardedOnce(applicationId: string, flag: string): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(key(applicationId, `awarded:${flag}`)) === "1";
}

export function markAwardedOnce(applicationId: string, flag: string) {
  if (!isBrowser()) return;
  localStorage.setItem(key(applicationId, `awarded:${flag}`), "1");
}

// ── 후기작성 (별점 + 한줄평) ────────────────────────────────
export interface ReviewEntry {
  rating: number; // 1~5
  text: string;
  at: string;
}

export function getReview(applicationId: string): ReviewEntry | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key(applicationId, "review"));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveReview(applicationId: string, review: ReviewEntry) {
  if (!isBrowser()) return;
  localStorage.setItem(key(applicationId, "review"), JSON.stringify(review));
}

// ── V6 섹션14: VOC(피드백) 저장 ────────────────────────────
const VOC_GLOBAL_KEY = "gidoc:voc:all"; // 관리자 화면에서 전체 회사의 피드백을 모아 봐야 하므로 전역 키 사용

export function addVocEntry(entry: VocEntry) {
  if (!isBrowser()) return;
  const all = getAllVocEntries();
  all.unshift(entry);
  localStorage.setItem(VOC_GLOBAL_KEY, JSON.stringify(all.slice(0, 200)));
}

export function updateVocStatus(id: string, status: VocEntry["status"]) {
  if (!isBrowser()) return;
  const all = getAllVocEntries();
  const next = all.map((e) => (e.id === id ? { ...e, status } : e));
  localStorage.setItem(VOC_GLOBAL_KEY, JSON.stringify(next));
}

export function getAllVocEntries(): VocEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(VOC_GLOBAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── V9 섹션8: AI Learning Queue — 전문가의견/사용자피드백/관리자메모 통합 저장소 ──
const LEARNING_QUEUE_KEY = "gidoc:learning-queue:all";

export function addLearningQueueEntry(entry: LearningQueueEntry) {
  if (!isBrowser()) return;
  const all = getLearningQueue();
  all.unshift(entry);
  localStorage.setItem(LEARNING_QUEUE_KEY, JSON.stringify(all.slice(0, 300)));
}

export function getLearningQueue(): LearningQueueEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LEARNING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function updateLearningQueueEntry(id: string, patch: Partial<Pick<LearningQueueEntry, "adopted" | "status">>) {
  if (!isBrowser()) return;
  const all = getLearningQueue();
  const next = all.map((e) => (e.id === id ? { ...e, ...patch } : e));
  localStorage.setItem(LEARNING_QUEUE_KEY, JSON.stringify(next));
}

// 체크리스트 완료로 올라간 건강점수 가산치 (표시용, 원래 결정론적 점수 위에 얹는다)
export function getHealthScoreBoost(applicationId: string): number {
  if (!isBrowser()) return 0;
  const raw = localStorage.getItem(key(applicationId, "score_boost"));
  return raw ? Number(raw) || 0 : 0;
}

export function addHealthScoreBoost(applicationId: string, amount: number): number {
  if (!isBrowser()) return 0;
  const next = getHealthScoreBoost(applicationId) + amount;
  localStorage.setItem(key(applicationId, "score_boost"), String(next));
  return next;
}

// ── 추천 코드 + 공유 횟수 ──────────────────────────────────
export function getOrCreateReferralCode(applicationId: string): string {
  if (!isBrowser()) return applicationId.slice(0, 8);
  const existing = localStorage.getItem(key(applicationId, "referral_code"));
  if (existing) return existing;
  const code = applicationId.replace(/-/g, "").slice(0, 8).toUpperCase();
  localStorage.setItem(key(applicationId, "referral_code"), code);
  return code;
}

export function incrementShareCount(applicationId: string): number {
  if (!isBrowser()) return 0;
  const raw = localStorage.getItem(key(applicationId, "share_count"));
  const next = (raw ? Number(raw) || 0 : 0) + 1;
  localStorage.setItem(key(applicationId, "share_count"), String(next));
  return next;
}

export function getShareCount(applicationId: string): number {
  if (!isBrowser()) return 0;
  const raw = localStorage.getItem(key(applicationId, "share_count"));
  return raw ? Number(raw) || 0 : 0;
}

// ── V9 섹션7: 알림센터 — 마지막으로 열어본 시각 기록 (뱃지 카운트용) ──
export function getNotificationLastSeenAt(applicationId: string): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(key(applicationId, "notif_last_seen"));
}

export function markNotificationsSeenNow(applicationId: string) {
  if (!isBrowser()) return;
  localStorage.setItem(key(applicationId, "notif_last_seen"), new Date().toISOString());
}
