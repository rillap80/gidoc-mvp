/**
 * gpt-4o 기준 대략적인 비용 추정치 (2025년 하반기 공개 가격 기준, USD / 1M 토큰).
 * 실제 청구액과는 프롬프트/응답 비율에 따라 오차가 있을 수 있으므로 "추정치"로만 사용할 것.
 * 가격이 바뀌면 이 상수만 갱신하면 된다.
 */
const PRICE_PER_1M_TOKENS_USD = {
  "gpt-4o": 5.0, // 입력/출력 평균 근사치 (정확한 산정을 원하면 input/output 토큰을 분리해 로깅해야 함)
  "gpt-4o-mini": 0.3,
} as const;

export function estimateCostUsd(model: keyof typeof PRICE_PER_1M_TOKENS_USD, totalTokens?: number): number | null {
  if (!totalTokens) return null;
  const rate = PRICE_PER_1M_TOKENS_USD[model];
  if (!rate) return null;
  return Number(((totalTokens / 1_000_000) * rate).toFixed(5));
}
