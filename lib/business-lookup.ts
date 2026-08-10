/**
 * STEP2: 회사명 + 대표자명으로 사업자등록번호를 찾는다.
 * 사업자번호가 이미 있으면 이 단계는 건너뛰고 그대로 사용한다.
 *
 * 국세청 "사업자등록정보 진위확인 및 상태조회" API는 번호를 알고 있을 때 "검증"하는 용도이고,
 * 이름만으로 "검색"하려면 별도 상용 DB(예: 크레탑 자체 검색, 공공데이터포털 기업정보 API 등)가 필요하다.
 * 여기서는 크레탑 검색 결과에 사업자번호가 포함되어 있다면 그것을 우선 사용하고,
 * 없으면 BIZ_LOOKUP_API_KEY로 설정된 외부 검색 API를 호출하는 구조로 둔다.
 */

export async function resolveBizRegNo(
  companyName: string,
  ceoName: string
): Promise<string | null> {
  if (!process.env.BIZ_LOOKUP_API_KEY) {
    // 검색 API 미설정 — null 반환, 크레탑 조회 단계에서 회사명+대표자명으로 재시도
    return null;
  }

  // TODO: 실제 계약한 사업자정보 검색 API 스펙에 맞춰 구현
  // 예시 형태만 남겨둠
  try {
    const res = await fetch(
      `https://api.example-biz-lookup.kr/search?name=${encodeURIComponent(
        companyName
      )}&ceo=${encodeURIComponent(ceoName)}`,
      { headers: { Authorization: `Bearer ${process.env.BIZ_LOOKUP_API_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.bizRegNo ?? null;
  } catch {
    return null;
  }
}
