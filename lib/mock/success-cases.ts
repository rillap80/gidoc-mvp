export type CaseCategory = "정책자금" | "세무" | "노무" | "보험" | "법무";

export interface SuccessCase {
  id: string;
  companyLabel: string; // 익명화된 회사명
  industry: string;
  category: CaseCategory;
  summary: string;
  amountManwon: number;
  isSaving: boolean; // true=절감, false=확보
  review: string;
}

const CASES: SuccessCase[] = [
  { id: "c1", companyLabel: "A제조", industry: "제조업", category: "정책자금", summary: "스마트공장 구축 지원사업 선정", amountManwon: 15000, isSaving: false, review: "신청 서류부터 전문가가 같이 봐줘서 수월했습니다." },
  { id: "c2", companyLabel: "B물류", industry: "운송업", category: "세무", summary: "경정청구로 과오납 법인세 환급", amountManwon: 2200, isSaving: true, review: "몇 년치를 놓치고 있었는지도 몰랐네요." },
  { id: "c3", companyLabel: "C푸드", industry: "음식점", category: "노무", summary: "퇴직금 미적립 리스크 사전 정비", amountManwon: 800, isSaving: true, review: "과태료 맞기 전에 미리 알아서 다행이었습니다." },
  { id: "c4", companyLabel: "D메디컬", industry: "병원", category: "보험", summary: "단체보험 재설계로 보험료 절감", amountManwon: 450, isSaving: true, review: "같은 보장인데 비용은 줄었습니다." },
  { id: "c5", companyLabel: "E테크", industry: "IT", category: "법무", summary: "표준근로계약서 정비로 분쟁 리스크 해소", amountManwon: 0, isSaving: true, review: "계약서 하나로 이렇게 달라지는지 몰랐습니다." },
  { id: "c6", companyLabel: "F건설", industry: "건설업", category: "정책자금", summary: "고용창출장려금 신규 수령", amountManwon: 3600, isSaving: false, review: "채용 계획이 있었는데 타이밍 좋게 안내받았습니다." },
];

export function getSuccessCases(filter?: CaseCategory): SuccessCase[] {
  return filter ? CASES.filter((c) => c.category === filter) : CASES;
}
