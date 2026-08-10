/**
 * V6 섹션14 "AI VOC 분석": 모든 의견을 자동 분류한다 (버그/기능추가/UX/정책/신규아이디어).
 *
 * MVP 원칙(무겁게 만들지 않는다)에 따라, 지금은 매 제출마다 OpenAI를 호출하지 않고
 * 키워드 기반 경량 휴리스틱으로 분류한다. classify()의 시그니처만 유지하면
 * 나중에 이 함수 내부만 실제 GPT 호출(예: lib/health-score.ts에서 하던 것과 동일한 패턴)로
 * 교체해도 호출부(관리자 페이지 등)는 전혀 손댈 필요가 없다.
 */

export type VocCategory = "버그" | "기능추가" | "UX" | "정책" | "신규아이디어";

const CATEGORY_KEYWORDS: Record<VocCategory, string[]> = {
  버그: ["오류", "에러", "안됨", "안돼요", "버그", "깨짐", "멈춤", "실패"],
  기능추가: ["추가해주세요", "기능이 있으면", "필요합니다", "지원해주세요", "연동"],
  UX: ["헷갈", "불편", "디자인", "찾기 어려", "느려요", "복잡"],
  정책: ["정책", "규정", "약관", "기준", "수수료"],
  신규아이디어: ["제안", "아이디어", "이런 건 어떨까요", "새로운"],
};

export function classifyVoc(text: string): VocCategory {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [VocCategory, string[]][]) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return "신규아이디어"; // 명확한 신호가 없으면 아이디어함으로 분류 (버그로 오분류해 놓치는 것보다 안전)
}

export interface VocEntry {
  id: string;
  text: string;
  category: VocCategory;
  rating?: number; // 1~5, 결과 화면 별점 (섹션12)
  status: VocStatus;
  createdAt: string;
}

export type VocStatus = "pending" | "approved" | "held" | "rejected" | "planned";

export const VOC_STATUS_LABEL: Record<VocStatus, string> = {
  pending: "대기",
  approved: "승인",
  held: "보류",
  rejected: "반려",
  planned: "기능추가예정",
};
