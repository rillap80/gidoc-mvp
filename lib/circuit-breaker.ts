/**
 * 매우 단순한 메모리 기반 Circuit Breaker.
 *
 * 주의: 서버리스 환경(Netlify Functions)에서는 인스턴스가 요청마다 새로 뜰 수 있어
 * 이 인메모리 상태가 완벽하게 공유되지 않는다. 그래도 같은 웜 인스턴스가 재사용되는 동안은
 * 연속 장애 시 OpenAI에 불필요한 재시도 폭주를 막는 효과가 있다. 완전한 다중 인스턴스 공유가
 * 필요하면 Supabase 테이블이나 Redis로 상태를 옮기는 것을 고려할 것 (README 참고).
 */
export class CircuitBreaker {
  private failureCount = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 60_000
  ) {}

  canAttempt(): boolean {
    if (this.state === "open") {
      if (Date.now() - this.openedAt > this.cooldownMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = "closed";
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  getState() {
    return this.state;
  }
}

export class CircuitOpenError extends Error {
  constructor(message = "일시적으로 서비스 호출이 제한되고 있습니다. 잠시 후 다시 시도하세요.") {
    super(message);
    this.name = "CircuitOpenError";
  }
}

// OpenAI 호출 전용 싱글턴 (모듈 스코프 — 같은 프로세스에서 재사용됨)
export const openaiCircuitBreaker = new CircuitBreaker(5, 60_000);
