/**
 * 메모리 기반 슬라이딩 윈도우 Rate Limiter.
 *
 * ⚠️ 한계: 서버리스(Netlify Functions)는 인스턴스가 여러 개 뜰 수 있어 이 메모리 상태가
 * 인스턴스 간에 공유되지 않는다. 즉 "완벽한" 전역 rate limit은 아니고, 같은 웜 인스턴스가
 * 재사용되는 동안의 스팸성 반복 요청을 줄여주는 1차 방어선이다.
 * 트래픽이 커지면 Upstash Ratelimit(Redis 기반) 등 분산 환경에서 정확히 동작하는
 * 솔루션으로 교체를 권장한다.
 */
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return false;
}

/** 클라이언트 식별용 — IP를 최우선으로 사용 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
