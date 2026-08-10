export type LearningRole = "고객" | "전문가" | "관리자";
export type LearningCategory = "노무" | "세무" | "보험" | "법무" | "정책자금" | "기타";
export type LearningStatus = "대기" | "학습대상" | "학습완료" | "보류";

export interface LearningQueueEntry {
  id: string;
  author: string;
  role: LearningRole;
  category: LearningCategory;
  content: string;
  importance: 1 | 2 | 3 | 4 | 5;
  adopted: boolean; // AI 학습 후보 여부
  status: LearningStatus;
  createdAt: string;
}
