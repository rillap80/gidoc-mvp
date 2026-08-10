import OpenAI from "openai";
import { withTimeout } from "@/lib/timeout";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_TIMEOUT_MS = 90_000;

/**
 * STEP5: 공개자료 수집 및 요약
 * - 홈페이지, 뉴스, 특허 공개정보, 정부 공개자료, 기업소개
 *
 * MVP 단계에서는 별도 크롤러 없이, 검색 가능한 소스를 모아 OpenAI로 요약하는 경량 구조로 둔다.
 * 실제 운영 시에는 다음 중 하나로 교체 권장:
 *  - 네이버/구글 뉴스 검색 API + 특허청 KIPRIS Open API + 홈페이지 자체 크롤링(robots.txt 준수)
 */
export async function collectPublicData(companyName: string) {
  // TODO: 실제 뉴스/특허/정부자료 API 연동
  // 지금은 회사명 기반으로 자리표시자 구조만 반환한다.
  const sources = {
    homepage: null as string | null,
    news: [] as { title: string; url: string; date?: string }[],
    patents: [] as { title: string; applicant?: string; date?: string }[],
    gov_notices: [] as { title: string; agency?: string }[],
  };

  const hasAnySource =
    sources.homepage != null ||
    sources.news.length > 0 ||
    sources.patents.length > 0 ||
    sources.gov_notices.length > 0;

  // 성능 최적화: 소스가 전무하면 GPT를 호출할 필요가 없다 (비용/지연시간 절약).
  // 실제 크롤러가 연결되면 hasAnySource가 true가 되면서 자동으로 요약 호출이 살아난다.
  const summary = hasAnySource
    ? await summarizeWithAI(companyName, sources)
    : "공개자료 수집 소스가 아직 연동되지 않았습니다.";

  return { sources, summary };
}

async function summarizeWithAI(
  companyName: string,
  sources: Record<string, unknown>
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "공개자료 수집 소스가 아직 연동되지 않았습니다.";
  }

  const completion = await withTimeout(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "너는 기업 리서치 애널리스트다. 주어진 공개자료 소스를 바탕으로 해당 기업의 대외 활동, 사업 방향, 시장 포지션을 3~5문장으로 객관적으로 요약하라. 자료가 비어있으면 '추가 공개자료 확인 필요'라고 명시하라.",
          },
          {
            role: "user",
            content: `회사명: ${companyName}\n수집된 소스: ${JSON.stringify(sources)}`,
          },
        ],
      }),
    OPENAI_TIMEOUT_MS,
    "공개자료 요약 호출"
  );

  return completion.choices[0]?.message?.content ?? "";
}
