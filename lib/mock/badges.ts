export interface BadgeDef {
  id: string;
  emoji: string;
  title: string;
  isUnlocked: (ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  shareCount: number;
  invitedCompanies: number;
  feedbackCount: number;
  isFoundingMember: boolean;
  todoCompletionRate: number; // 0~1
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: "first_share", emoji: "🔰", title: "첫 공유", isUnlocked: (c) => c.shareCount >= 1 },
  { id: "companies_10", emoji: "🌱", title: "기업 10곳", isUnlocked: (c) => c.invitedCompanies >= 10 },
  { id: "companies_30", emoji: "🌿", title: "기업 30곳", isUnlocked: (c) => c.invitedCompanies >= 30 },
  { id: "companies_100", emoji: "🌳", title: "기업 100곳", isUnlocked: (c) => c.invitedCompanies >= 100 },
  { id: "feedback_king", emoji: "💬", title: "AI 피드백왕", isUnlocked: (c) => c.feedbackCount >= 5 },
  { id: "beta_contributor", emoji: "🧪", title: "베타 기여자", isUnlocked: (c) => c.isFoundingMember },
  { id: "health_expert", emoji: "🏆", title: "기업 건강관리 전문가", isUnlocked: (c) => c.todoCompletionRate >= 1 },
];
