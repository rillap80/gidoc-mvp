import { getRecentUpdates } from "@/lib/mock/briefing";
import { getWeeklyChange, getWeeklyDiscoveries } from "@/lib/mock/daily";
import { getReview } from "@/lib/mock/storage";

export interface NotificationCenterItem {
  id: string;
  label: string;
  category: "변경사항" | "의견" | "점수변화" | "추천정책";
  at: string; // ISO
}

/**
 * 기존 Mock 생성기(daily/briefing/storage)를 재조합만 할 뿐 새 데이터 소스를 만들지 않는다 —
 * "가볍게" 원칙 + 이미 있는 값들과 서로 다른 숫자가 보이는 걸 방지하기 위함.
 */
export function getNotificationCenterItems(applicationId: string, currentScore: number): NotificationCenterItem[] {
  const items: NotificationCenterItem[] = [];
  const now = new Date().toISOString();

  for (const u of getRecentUpdates(applicationId)) {
    if (!u.isNew) continue;
    items.push({ id: `update-${u.label}`, label: u.label, category: "변경사항", at: now });
  }

  const weekly = getWeeklyChange(applicationId, currentScore);
  items.push({
    id: "weekly-score",
    label: `건강점수 ${weekly.lastWeekScore}점 → ${weekly.thisWeekScore}점 (${weekly.reason})`,
    category: "점수변화",
    at: now,
  });

  for (const d of getWeeklyDiscoveries(applicationId)) {
    items.push({ id: `discovery-${d}`, label: `추천 정책: ${d}`, category: "추천정책", at: now });
  }

  const review = getReview(applicationId);
  if (review) {
    items.push({ id: "review", label: `내가 남긴 후기 (★${review.rating})가 반영되었습니다.`, category: "의견", at: review.at });
  }

  return items;
}
